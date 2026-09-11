import crypto from 'crypto';
import { cookies,headers } from 'next/headers';
import { createAdminSessionRecord,getAdminSessionContextByHash,hasRecentAdminReauth,registerAdminKnownDevice,revokeAdminSessionByHash,verifyAdminSessionRecord } from './db';
import { getAdminMfaConfiguration } from './mfa';
import { recordAdminSecurityEventWithAlert } from './admin-security-alerts';

const COOKIE_NAME='catalog_admin_session';
const MFA_COOKIE_NAME='catalog_admin_mfa_challenge';
const DEVICE_COOKIE_NAME='catalog_admin_device';
const MAX_AGE=60*60*12;
const MFA_MAX_AGE=5*60;
const DEVICE_MAX_AGE=60*60*24*180;
const SCRYPT_HASH=/^scrypt\$([0-9a-f]{32})\$([0-9a-f]{128})$/i;
const TOKEN_SESSION=/^[A-Za-z0-9_-]{32}$/;
const TOKEN_SIGNATURE=/^[A-Za-z0-9_-]{43}$/;

type ParsedSession={expires:number;sessionId:string;sessionHash:string};

function secret(){const value=process.env.SESSION_SECRET;if(!value||value.length<32)throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres.');return value;}
function sign(payload:string){return crypto.createHmac('sha256',secret()).update(payload).digest('base64url');}
function digest(label:string,value:string){return crypto.createHmac('sha256',secret()).update(`${label}:${value}`).digest('hex');}
function safeEqual(a:Buffer,b:Buffer){const len=Math.max(a.length,b.length,1);const aa=Buffer.alloc(len);const bb=Buffer.alloc(len);a.copy(aa);b.copy(bb);const equal=crypto.timingSafeEqual(aa,bb);return equal&&a.length===b.length;}
function firstHeaderValue(value:string|null){return value?.split(',')[0]?.trim()||'';}
function clientIp(request?:Request){if(!request)return'unknown';return firstHeaderValue(request.headers.get('x-forwarded-for'))||firstHeaderValue(request.headers.get('x-real-ip'))||'unknown';}
async function currentUserAgentHash(){try{const store=await headers();const userAgent=(store.get('user-agent')||'').slice(0,500);return userAgent?digest('admin-ua',userAgent):'';}catch{return '';}}
function allowCiStatelessAdmin(){return process.env.GITHUB_ACTIONS==='true'&&process.env.MARQUES_CI_STATELESS_AUTH==='1';}
function deviceLabel(userAgent:string){
  const ua=userAgent.toLowerCase();
  const browser=ua.includes('edg/')?'Edge':ua.includes('firefox/')?'Firefox':ua.includes('chrome/')&&!ua.includes('edg/')?'Chrome':ua.includes('safari/')&&!ua.includes('chrome/')?'Safari':'Navegador';
  const os=ua.includes('iphone')?'iPhone':ua.includes('ipad')?'iPad':ua.includes('android')?'Android':ua.includes('windows')?'Windows':ua.includes('mac os')?'macOS':ua.includes('linux')?'Linux':'Dispositivo';
  return `${browser} • ${os}`;
}
function parseSignedToken(token:string|undefined,purpose:'admin'|'mfa',maxAge:number){
  if(!token)return null;const parts=token.split('.');if(parts.length!==4)return null;
  const [role,exp,nonce,signature]=parts;const expires=Number(exp);const now=Math.floor(Date.now()/1000);
  if(role!==purpose||!Number.isSafeInteger(expires)||expires<=now||expires>now+maxAge+60||!TOKEN_SESSION.test(nonce)||!TOKEN_SIGNATURE.test(signature))return null;
  const payload=`${role}.${exp}.${nonce}`;const expected=sign(payload);if(!safeEqual(Buffer.from(signature),Buffer.from(expected)))return null;
  return{expires,nonce};
}
function createSignedToken(purpose:'admin'|'mfa',maxAge:number){const expires=Math.floor(Date.now()/1000)+maxAge;const nonce=crypto.randomBytes(24).toString('base64url');const payload=`${purpose}.${expires}.${nonce}`;return `${payload}.${sign(payload)}`;}
function parseSessionToken(token?:string):ParsedSession|null{const parsed=parseSignedToken(token,'admin',MAX_AGE);return parsed?{expires:parsed.expires,sessionId:parsed.nonce,sessionHash:digest('admin-session',parsed.nonce)}:null;}

export function validateAdminPassword(password:string){
  if(!password||Buffer.byteLength(password,'utf8')>512)return false;
  const hashed=process.env.ADMIN_PASSWORD_HASH||'';
  if(hashed){
    const match=hashed.match(SCRYPT_HASH);if(!match)return false;
    try{const expected=Buffer.from(match[2],'hex');const actual=crypto.scryptSync(password,Buffer.from(match[1],'hex'),expected.length);return safeEqual(actual,expected);}catch{return false;}
  }
  const expected=process.env.ADMIN_PASSWORD||'';if(!expected)return false;
  return safeEqual(Buffer.from(password),Buffer.from(expected));
}

export function createSessionToken(){return createSignedToken('admin',MAX_AGE);}
export function verifySessionToken(token?:string){return Boolean(parseSessionToken(token));}

export async function setAdminMfaChallenge(){
  const store=await cookies();store.set(MFA_COOKIE_NAME,createSignedToken('mfa',MFA_MAX_AGE),{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:MFA_MAX_AGE});
}
export async function hasValidAdminMfaChallenge(){const store=await cookies();return Boolean(parseSignedToken(store.get(MFA_COOKIE_NAME)?.value,'mfa',MFA_MAX_AGE));}
export async function clearAdminMfaChallenge(){const store=await cookies();store.set(MFA_COOKIE_NAME,'',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});}

export async function isAdmin(){
  const store=await cookies();const parsed=parseSessionToken(store.get(COOKIE_NAME)?.value);if(!parsed)return false;
  if(!process.env.DATABASE_URL)return process.env.NODE_ENV!=='production'||allowCiStatelessAdmin();
  const requireMfa=getAdminMfaConfiguration().required;
  try{return await verifyAdminSessionRecord(parsed.sessionHash,await currentUserAgentHash(),requireMfa);}catch{return false;}
}

export async function setAdminSession(request?:Request,options:{mfaVerified?:boolean;authMethod?:'password'|'totp'|'recovery'}={}){
  const mfa=getAdminMfaConfiguration();if(mfa.required&&!options.mfaVerified)throw new Error('MFA_REQUIRED');
  if(process.env.NODE_ENV==='production'&&!process.env.DATABASE_URL&&!allowCiStatelessAdmin())throw new Error('DATABASE_REQUIRED');
  const token=createSessionToken();const parsed=parseSessionToken(token);if(!parsed)throw new Error('Falha ao criar sessão administrativa.');
  const store=await cookies();
  let deviceToken=store.get(DEVICE_COOKIE_NAME)?.value||'';if(!TOKEN_SESSION.test(deviceToken))deviceToken=crypto.randomBytes(24).toString('base64url');
  if(process.env.DATABASE_URL){
    const userAgent=(request?.headers.get('user-agent')||'').slice(0,500);const ip=clientIp(request);const label=deviceLabel(userAgent);const deviceHash=digest('admin-device',deviceToken);const userAgentHash=digest('admin-ua',userAgent||'unknown');
    const known=await registerAdminKnownDevice({deviceHash,deviceLabel:label,userAgent,userAgentHash});
    if(known.isNew)await recordAdminSecurityEventWithAlert({eventType:'new_device_login',severity:'warning',deviceHash,deviceLabel:label,summary:`Novo dispositivo autenticado: ${label}.`});
    await createAdminSessionRecord({sessionHash:parsed.sessionHash,deviceHash,deviceLabel:label,userAgent,userAgentHash,ipHash:digest('admin-ip',ip),expiresAt:new Date(parsed.expires*1000).toISOString(),mfaVerifiedAt:options.mfaVerified?new Date().toISOString():null,authMethod:options.authMethod||(options.mfaVerified?'totp':'password')});
    if(options.authMethod==='recovery')await recordAdminSecurityEventWithAlert({eventType:'recovery_code_login',severity:'warning',deviceHash,deviceLabel:label,summary:`Login administrativo concluído com código de recuperação em ${label}.`});
  }
  store.set(DEVICE_COOKIE_NAME,deviceToken,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:DEVICE_MAX_AGE});
  store.set(COOKIE_NAME,token,{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:MAX_AGE});
  await clearAdminMfaChallenge();
}

export async function currentAdminSession(){
  const store=await cookies();const parsed=parseSessionToken(store.get(COOKIE_NAME)?.value);if(!parsed)return null;
  if(!process.env.DATABASE_URL)return process.env.NODE_ENV==='production'&&!allowCiStatelessAdmin()?null:{sessionHash:parsed.sessionHash,sessionId:null,store:'stateless' as const};
  const requireMfa=getAdminMfaConfiguration().required;
  try{const context=await getAdminSessionContextByHash(parsed.sessionHash,await currentUserAgentHash(),requireMfa);return context?{sessionHash:parsed.sessionHash,sessionId:context.id,deviceHash:context.deviceHash,authMethod:context.authMethod,store:'database' as const}:null;}catch{return null;}
}


export async function hasRecentAdminReauthentication(maxAgeSeconds=300){
  const current=await currentAdminSession();if(!current)return false;
  if(current.store==='stateless')return process.env.NODE_ENV!=='production'||allowCiStatelessAdmin();
  try{return await hasRecentAdminReauth(current.sessionHash,maxAgeSeconds);}catch{return false;}
}

export async function clearAdminSession(){
  const store=await cookies();const parsed=parseSessionToken(store.get(COOKIE_NAME)?.value);let revokeError:unknown;
  if(parsed&&process.env.DATABASE_URL){try{await revokeAdminSessionByHash(parsed.sessionHash);}catch(error){revokeError=error;}}
  store.set(COOKIE_NAME,'',{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:0});
  await clearAdminMfaChallenge();
  if(revokeError)throw revokeError;
}
