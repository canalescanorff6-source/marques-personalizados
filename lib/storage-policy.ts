export const MANAGED_MEDIA_PREFIX='catalog/';

function parsedHttpUrl(value:string){
  let url:URL;
  try{url=new URL(String(value||'').trim());}catch{throw new Error('STORAGE_URL_INVALID');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('STORAGE_URL_INVALID');
  return url;
}

export function normalizeStorageEndpoint(value:string,{production=false}:{production?:boolean}={}){
  const url=parsedHttpUrl(value);
  if(production&&url.protocol!=='https:')throw new Error('STORAGE_ENDPOINT_INSECURE');
  return url.toString().replace(/\/$/,'');
}

export function normalizeStoragePublicBase(value:string,{production=false}:{production?:boolean}={}){
  const url=parsedHttpUrl(value);
  if(production&&url.protocol!=='https:')throw new Error('STORAGE_PUBLIC_BASE_INSECURE');
  url.pathname=url.pathname.replace(/\/+$/,'');
  return url.toString().replace(/\/$/,'');
}

export function assertManagedMediaKey(value:string){
  const key=String(value||'');
  if(!key.startsWith(MANAGED_MEDIA_PREFIX)||key.length<=MANAGED_MEDIA_PREFIX.length||key.length>1024)throw new Error('MEDIA_KEY_OUTSIDE_NAMESPACE');
  if(/[\\\u0000-\u001f\u007f]/.test(key))throw new Error('MEDIA_KEY_INVALID');
  const parts=key.split('/');
  if(parts.some(part=>!part||part==='.'||part==='..'))throw new Error('MEDIA_KEY_INVALID');
  return key;
}

export function managedMediaKeyFromPublicUrl(publicBase:string,candidate:string){
  let base:URL,url:URL;
  try{base=parsedHttpUrl(publicBase);url=parsedHttpUrl(candidate);}catch{return null;}
  if(base.origin!==url.origin)return null;
  const basePath=`${base.pathname.replace(/\/+$/,'')}/`;
  if(!url.pathname.startsWith(basePath))return null;
  const encoded=url.pathname.slice(basePath.length);
  if(!encoded||/%2f|%5c/i.test(encoded))return null;
  let key:string;try{key=decodeURIComponent(encoded);}catch{return null;}
  try{return assertManagedMediaKey(key);}catch{return null;}
}

export function managedMediaPublicUrl(publicBase:string,key:string){
  const safeKey=assertManagedMediaKey(key);
  const base=normalizeStoragePublicBase(publicBase);
  return `${base}/${safeKey.split('/').map(encodeURIComponent).join('/')}`;
}
