function parsedHttps(value:string){
  try{
    const url=new URL(value);
    if(url.protocol!=='https:'||url.username||url.password)return null;
    return url;
  }catch{return null;}
}

export function isSafeRootRelativeUrl(value:string){
  const input=String(value||'').trim();
  return /^\/(?!\/)/.test(input)&&!/[\\\u0000-\u001f\u007f]/.test(input);
}

export function isSafeExternalHttpsUrl(value:string){
  const input=String(value||'').trim();
  return Boolean(input&&parsedHttps(input));
}

export function isSafePublicUrl(value:string){
  const input=String(value||'').trim();
  return !input||isSafeRootRelativeUrl(input)||isSafeExternalHttpsUrl(input);
}

export function normalizeExternalHttpsUrl(value:string|undefined){
  const input=String(value||'').trim();
  return isSafeExternalHttpsUrl(input)?input:'';
}

export function normalizePublicUrl(value:string|undefined){
  const input=String(value||'').trim();
  return isSafePublicUrl(input)?input:'';
}

export function normalizeSiteOrigin(value:string|undefined){
  const input=String(value||'').trim();
  const url=parsedHttps(input);
  if(!url||url.pathname!=='/'||url.search||url.hash)return '';
  return url.origin;
}
