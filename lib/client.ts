type AdminReauthHandler=()=>Promise<boolean>;
let adminReauthHandler:AdminReauthHandler|null=null;
export function registerAdminReauthHandler(handler:AdminReauthHandler|null){adminReauthHandler=handler;}

export class ApiRequestError extends Error {
  status:number;
  reference?:string;
  reauthRequired:boolean;
  constructor(message:string,status=500,reference?:string,reauthRequired=false){super(message);this.name='ApiRequestError';this.status=status;this.reference=reference;this.reauthRequired=reauthRequired;}
}

const RETRY_SAFE_ADMIN_CREATE_PATHS=new Set(['/api/admin/products','/api/admin/categories','/api/admin/testimonials','/api/admin/faqs','/api/admin/campaigns','/api/admin/social-plan']);
type PendingCreateKey={key:string;expiresAt:number};
const pendingCreateKeys=new Map<string,PendingCreateKey>();
const CREATE_KEY_TTL_MS=2*60*60*1000;
const CREATE_KEY_STORAGE_PREFIX='marques.admin-create-idem.v1:';
function identityFingerprint(identity:string){let a=2166136261,b=5381;for(let i=0;i<identity.length;i++){const code=identity.charCodeAt(i);a=Math.imul(a^code,16777619);b=Math.imul(b,33)^code;}return `${(a>>>0).toString(16).padStart(8,'0')}${(b>>>0).toString(16).padStart(8,'0')}-${identity.length}`;}
function storageKey(identity:string){return `${CREATE_KEY_STORAGE_PREFIX}${identityFingerprint(identity)}`;}
function readStoredCreateKey(identity:string,now=Date.now()):PendingCreateKey|null{if(typeof window==='undefined')return null;try{const raw=sessionStorage.getItem(storageKey(identity));if(!raw)return null;const value=JSON.parse(raw) as PendingCreateKey;if(typeof value?.key!=='string'||!Number.isFinite(value?.expiresAt)||value.expiresAt<=now){sessionStorage.removeItem(storageKey(identity));return null;}return value;}catch{return null;}}
function storeCreateKey(identity:string,pending:PendingCreateKey){if(typeof window==='undefined')return;try{sessionStorage.setItem(storageKey(identity),JSON.stringify(pending));}catch{}}
function clearCreateKey(identity:string){pendingCreateKeys.delete(identity);if(typeof window!=='undefined'){try{sessionStorage.removeItem(storageKey(identity));}catch{}}}
function requestPath(input:RequestInfo|URL){const raw=typeof input==='string'?input:input instanceof URL?input.toString():input.url;try{return new URL(raw,typeof window!=='undefined'?window.location.origin:'http://local.invalid').pathname;}catch{return'';}}
function newRequestId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const bytes=new Uint8Array(16);globalThis.crypto.getRandomValues(bytes);bytes[6]=(bytes[6]&0x0f)|0x40;bytes[8]=(bytes[8]&0x3f)|0x80;const hex=[...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;}
function prunePendingCreateKeys(now=Date.now()){for(const [identity,pending] of pendingCreateKeys)if(pending.expiresAt<=now)pendingCreateKeys.delete(identity);}
function prepareRetrySafeAdminCreate(input:RequestInfo|URL,init:RequestInit){
  const method=(init.method||'GET').toUpperCase();const path=requestPath(input);if(method!=='POST'||!RETRY_SAFE_ADMIN_CREATE_PATHS.has(path)||typeof init.body!=='string')return{init,identity:null as string|null};
  const now=Date.now();prunePendingCreateKeys(now);const identity=`${path}
${init.body}`;const headers=new Headers(init.headers);let key=headers.get('idempotency-key')?.trim()||'';if(!key){key=pendingCreateKeys.get(identity)?.key||readStoredCreateKey(identity,now)?.key||newRequestId();headers.set('idempotency-key',key);}const pending={key,expiresAt:now+CREATE_KEY_TTL_MS};pendingCreateKeys.set(identity,pending);storeCreateKey(identity,pending);return{init:{...init,headers},identity};
}

function wait(ms:number){return new Promise(resolve=>setTimeout(resolve,ms));}
function maybeHandleAdminSessionExpired(input:RequestInfo|URL,status:number){
  if(status!==401||typeof window==='undefined')return false;
  const raw=typeof input==='string'?input:input instanceof URL?input.toString():input.url;
  let pathname='';
  try{pathname=new URL(raw,window.location.origin).pathname;}catch{return false;}
  if(!pathname.startsWith('/api/admin/')||pathname==='/api/admin/login'||pathname==='/api/admin/logout')return false;
  const next=`${window.location.pathname}${window.location.search}${window.location.hash}`;
  const target=`/admin/login?reason=expired&next=${encodeURIComponent(next.startsWith('/admin')?next:'/admin')}`;
  window.location.assign(target);
  return true;
}

async function requestOnce<T>(input:RequestInfo|URL,init:RequestInit,timeoutMs:number):Promise<T>{
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(input,{...init,signal:controller.signal});const text=await response.text();let data:Record<string,unknown>={};
    try{const parsed:unknown=text?JSON.parse(text):{};data=parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed as Record<string,unknown>:{};}catch{data={};}
    if(!response.ok){maybeHandleAdminSessionExpired(input,response.status);const rawMessage=typeof data.error==='string'?data.error:typeof data.message==='string'?data.message:`Falha na requisição (${response.status}).`;const reference=typeof data.reference==='string'?data.reference:undefined;throw new ApiRequestError(reference?`${rawMessage} Referência: ${reference}`:rawMessage,response.status,reference,data.reauth_required===true);}
    return data as T;
  }catch(error){
    if(error instanceof ApiRequestError)throw error;
    if(error instanceof DOMException&&error.name==='AbortError')throw new ApiRequestError('A conexão demorou demais. Tente novamente.',408);
    throw new ApiRequestError('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.',503);
  }finally{clearTimeout(timer);}
}
export async function fetchJson<T>(input:RequestInfo|URL,init:RequestInit={},timeoutMs=15000):Promise<T>{
  const prepared=prepareRetrySafeAdminCreate(input,init);const requestInit=prepared.init;const method=(requestInit.method||'GET').toUpperCase();const attempts=prepared.identity?2:method==='GET'?2:1;let last:unknown;let reauthRetried=false;
  for(let attempt=0;attempt<attempts;attempt++){
    try{const result=await requestOnce<T>(input,requestInit,timeoutMs);if(prepared.identity)clearCreateKey(prepared.identity);return result;}catch(error){
      last=error;
      const path=requestPath(input);const adminRequest=path.startsWith('/api/admin/');
      if(error instanceof ApiRequestError&&error.status===428&&error.reauthRequired&&adminRequest&&adminReauthHandler&&!reauthRetried){
        reauthRetried=true;const confirmed=await adminReauthHandler();if(confirmed){const result=await requestOnce<T>(input,requestInit,timeoutMs);if(prepared.identity)clearCreateKey(prepared.identity);return result;}
      }
      const retryable=error instanceof ApiRequestError&&(error.status===408||error.status===502||error.status===503||error.status===504);
      if(attempt+1>=attempts||!retryable){if(prepared.identity&&!retryable)clearCreateKey(prepared.identity);throw error;}await wait(220+attempt*180);
    }
  }
  throw last instanceof Error?last:new ApiRequestError('Falha inesperada na requisição.',500);
}
