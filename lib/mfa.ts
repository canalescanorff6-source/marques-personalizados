import crypto from 'crypto';

const BASE32_ALPHABET='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const SECRET_PATTERN=/^[A-Z2-7]{16,128}$/;
const TOTP_CODE=/^\d{6}$/;
const STEP_SECONDS=30;

export type AdminMfaConfiguration={configured:boolean;valid:boolean;required:boolean;secret:string};

export function normalizeTotpSecret(value:string){return value.toUpperCase().replace(/[\s-]+/g,'').replace(/=+$/,'');}

export function getAdminMfaConfiguration():AdminMfaConfiguration{
  const raw=process.env.ADMIN_TOTP_SECRET||'';
  const secret=normalizeTotpSecret(raw);
  const configured=Boolean(raw.trim());
  const valid=configured&&SECRET_PATTERN.test(secret);
  return{configured,valid,required:process.env.NODE_ENV==='production'||configured,secret};
}

function decodeBase32(secret:string){
  let bits='';
  for(const char of secret){const index=BASE32_ALPHABET.indexOf(char);if(index<0)throw new Error('TOTP_SECRET_INVALID');bits+=index.toString(2).padStart(5,'0');}
  const bytes:number[]=[];
  for(let offset=0;offset+8<=bits.length;offset+=8)bytes.push(Number.parseInt(bits.slice(offset,offset+8),2));
  return Buffer.from(bytes);
}

function codeAtStep(secret:string,step:number){
  const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));
  const digest=crypto.createHmac('sha1',decodeBase32(secret)).update(counter).digest();
  const offset=digest[digest.length-1]&0x0f;
  const binary=((digest[offset]&0x7f)<<24)|((digest[offset+1]&0xff)<<16)|((digest[offset+2]&0xff)<<8)|(digest[offset+3]&0xff);
  return String(binary%1_000_000).padStart(6,'0');
}

function safeCodeEqual(a:string,b:string){
  const aa=Buffer.from(a);const bb=Buffer.from(b);
  return aa.length===bb.length&&crypto.timingSafeEqual(aa,bb);
}

export function verifyAdminTotpCode(code:string,now=Date.now()){
  if(!TOTP_CODE.test(code))return null;
  const config=getAdminMfaConfiguration();if(!config.valid)return null;
  const step=Math.floor(now/1000/STEP_SECONDS);
  for(const candidate of [step,step-1,step+1])if(safeCodeEqual(code,codeAtStep(config.secret,candidate)))return candidate;
  return null;
}
