export type StorageTarget={endpoint:string;bucket:string};

function normalizedHost(hostname:string){return String(hostname||'').trim().toLowerCase().replace(/^\[|\]$/g,'').replace(/\.$/,'');}
function ipv4Parts(host:string){const parts=host.split('.');if(parts.length!==4)return null;const nums=parts.map(Number);return nums.every(n=>Number.isInteger(n)&&n>=0&&n<=255)?nums:null;}
export function isPrivateOrLocalStorageHost(hostname:string){
  const host=normalizedHost(hostname);if(!host)return true;
  if(host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local')||host==='0.0.0.0'||host==='::'||host==='::1')return true;
  const ip=ipv4Parts(host);if(ip){const[a,b]=ip;if(a===10||a===127||a===0||a===169&&b===254||a===192&&b===168||a===172&&b>=16&&b<=31||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19))return true;}
  if(host.includes(':')){const compact=host.replace(/^0+:/,'');if(/^f[cd]/.test(compact)||/^fe[89ab]/.test(compact))return true;}
  return false;
}
function parseEndpoint(value:unknown,{external=false,label='S3 endpoint'}:{external?:boolean;label?:string}={}){
  let url:URL;try{url=new URL(String(value||'').trim());}catch{throw new Error(`${label.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}_INVALID`);}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error(`${label.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}_INVALID`);
  if(external&&isPrivateOrLocalStorageHost(url.hostname))throw new Error(`${label.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}_NOT_EXTERNAL`);
  return url.toString().replace(/\/$/,'');
}
export function normalizeStorageTransportEndpoint(value:unknown,label='S3 endpoint'){return parseEndpoint(value,{label});}
export function normalizeExternalDrEndpoint(value:unknown,label='Backup S3 endpoint'){return parseEndpoint(value,{external:true,label});}
export function normalizeStorageBucket(value:unknown,label='S3 bucket'){
  const bucket=String(value||'').trim();if(!bucket||bucket.length>255||/[\u0000-\u001f\u007f]/.test(bucket))throw new Error(`${label.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}_INVALID`);return bucket;
}
export function sameStorageTarget(a:StorageTarget,b:StorageTarget){return new URL(a.endpoint).origin===new URL(b.endpoint).origin&&a.bucket===b.bucket;}
export function assertDistinctStorageTargets(a:StorageTarget,b:StorageTarget,label='Storage targets'){if(sameStorageTarget(a,b))throw new Error(`${label.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}_MUST_BE_DISTINCT`);return true;}
