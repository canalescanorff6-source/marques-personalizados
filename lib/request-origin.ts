function localHostname(hostname:string){
  const host=hostname.toLowerCase().replace(/^\[|\]$/g,'');
  return host==='localhost'||host==='127.0.0.1'||host==='::1';
}

function configuredProductionOrigin(){
  const raw=String(process.env.NEXT_PUBLIC_SITE_URL||'').trim();
  if(!raw)return'';
  try{
    const url=new URL(raw);
    if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)return'';
    if(url.protocol!=='https:'&&!(url.protocol==='http:'&&localHostname(url.hostname)))return'';
    return url.origin;
  }catch{return'';}
}

export function trustedRequestOrigin(request:Request){
  if(process.env.NODE_ENV==='production')return configuredProductionOrigin();
  try{return new URL(request.url).origin;}catch{return'';}
}

export function sameOriginBoundary(request:Request){
  const fetchSite=request.headers.get('sec-fetch-site')?.trim().toLowerCase();
  if(fetchSite&&!['same-origin','none'].includes(fetchSite))return false;
  const expected=trustedRequestOrigin(request);if(!expected)return false;
  const origin=request.headers.get('origin');
  if(origin){try{return new URL(origin).origin===expected;}catch{return false;}}
  const referer=request.headers.get('referer');
  if(referer){try{return new URL(referer).origin===expected;}catch{return false;}}
  // Requisições não-browser (CLI/health tooling) não carregam os Fetch Metadata headers.
  // Browsers modernos enviam Origin/Referer e Sec-Fetch-Site em mutações cross-origin.
  return !fetchSite;
}
