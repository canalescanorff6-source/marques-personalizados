import fs from 'node:fs';
const platform=JSON.parse(fs.readFileSync(new URL('../platform-contract.json',import.meta.url),'utf8'));
const expectedSchema=Number(platform.schemaVersion);
const base=(process.argv[2]||process.env.NEXT_PUBLIC_SITE_URL||'').replace(/\/$/,'');
if(!/^https?:\/\//.test(base)){console.error('Uso: npm run check:live -- https://seusite.com.br');process.exit(1);}
let failures=0;
const report=(ok,label,detail='')=>{console.log(`${ok?'✓':'✗'} ${label}${detail?` — ${detail}`:''}`);if(!ok)failures++;};
async function req(path,opts={}){const controller=new AbortController();const t=setTimeout(()=>controller.abort(),12_000);try{return await fetch(`${base}${path}`,{redirect:'manual',cache:'no-store',...opts,signal:controller.signal});}finally{clearTimeout(t);}}
async function json(response){try{return await response.json();}catch{return {};}}
function hasHeader(response,name){return Boolean(response.headers.get(name));}
function includesToken(value,token){return String(value||'').toLowerCase().includes(token.toLowerCase());}

try{
  let r=await req('/api/health?mode=live');const live=await json(r);report(r.ok&&live.ok===true,'Liveness',`${r.status}`);report(includesToken(r.headers.get('content-type'),'application/json'),'Liveness retorna JSON');report(Boolean(live.release?.id),'Liveness expõe identidade do release',String(live.release?.id||'?'));
  r=await req('/api/health');const h=await json(r);report(r.ok&&h.ok===true&&Number(h.schema?.version||0)>=expectedSchema,'Readiness',`HTTP ${r.status} / schema ${h.schema?.version??'?'}`);report(includesToken(r.headers.get('cache-control'),'no-store'),'Health sem cache');report(Array.isArray(h.blockers)&&h.blockers.length===0,'Readiness sem bloqueadores',Array.isArray(h.blockers)?h.blockers.join(', '):'?');
  r=await req('/api/health?mode=deep');const deep=await json(r);report(r.ok&&deep.ok===true,'Deep health',`HTTP ${r.status}`);report(Array.isArray(deep.blockers)&&deep.blockers.length===0,'Deep health sem dependência degradada',Array.isArray(deep.blockers)?deep.blockers.join(', '):'?');if(deep.storage?.configured)report(deep.storage.ok===true,'Storage configurado responde',String(deep.storage.state||'?'));

  r=await req('/');report(r.ok,'Home',`${r.status}`);
  const csp=r.headers.get('content-security-policy')||'';
  report(Boolean(csp),'CSP presente');
  for(const token of ["object-src 'none'","frame-ancestors 'none'","base-uri 'self'","form-action 'self'"])report(includesToken(csp,token),`CSP contém ${token}`);
  report(includesToken(r.headers.get('x-content-type-options'),'nosniff'),'X-Content-Type-Options presente');
  report(includesToken(r.headers.get('x-frame-options'),'deny'),'X-Frame-Options DENY');
  report(hasHeader(r,'referrer-policy'),'Referrer-Policy presente');
  report(!hasHeader(r,'x-powered-by'),'X-Powered-By removido');
  if(base.startsWith('https://'))report(includesToken(r.headers.get('strict-transport-security'),'max-age='),'HSTS presente');

  r=await req('/robots.txt');report(r.ok,'robots.txt');
  r=await req('/sitemap.xml');report(r.ok,'sitemap.xml');report(includesToken(r.headers.get('content-type'),'xml'),'sitemap retorna XML');
  r=await req('/manifest.webmanifest');report(r.ok||r.status===404,'Manifest não quebra deploy',`${r.status}`);

  r=await req('/api/catalog?page=1&limit=2');const c=await json(r);report(r.ok&&Array.isArray(c.items),'API catálogo paginada');
  const firstProduct=Array.isArray(c.items)?c.items[0]:null;
  if(firstProduct?.slug){const pr=await req(`/catalogo/${firstProduct.slug}`);report(pr.ok,'Página de produto real',`${pr.status}`);}
  const firstTag=firstProduct?.tags?.[0];if(firstTag){const slug=String(firstTag).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');const tr=await req(`/temas/${slug}`);report(tr.ok,'Página de tema real',`${tr.status}`);}

  r=await req('/api/search?q=topo');report(r.ok,'API busca');
  r=await req('/api/quote-list?items=');report(r.ok,'API lista compartilhável',`${r.status}`);
  r=await req('/api/concierge',{method:'POST',headers:{'content-type':'application/json','origin':base,'sec-fetch-site':'same-origin'},body:JSON.stringify({theme:'aniversário',categories:[]})});report(r.ok||r.status===400,'API Concierge',`${r.status}`);

  const evil='https://cross-origin.invalid';
  r=await req('/api/concierge',{method:'POST',headers:{'content-type':'application/json','origin':evil,'sec-fetch-site':'cross-site'},body:'{}'});report(r.status===403,'Concierge rejeita origem cruzada',`${r.status}`);
  r=await req('/api/admin/login',{method:'POST',headers:{'content-type':'application/json','origin':evil,'sec-fetch-site':'cross-site'},body:JSON.stringify({password:'invalid-live-check'})});report(r.status===403,'Login admin rejeita origem cruzada',`${r.status}`);

  r=await req('/api/admin/backup');report(r.status===401,'Backup protegido',`${r.status}`);report(includesToken(r.headers.get('cache-control'),'no-store'),'API admin sem cache');
  r=await req('/api/admin/media');report(r.status===401,'Mídia protegida',`${r.status}`);
  r=await req('/admin/login');report(r.ok,'Login administrativo responde',`${r.status}`);const adminCsp=r.headers.get('content-security-policy')||'';const adminScript=adminCsp.split(';').map(x=>x.trim()).find(x=>x.startsWith('script-src '))||'';report(/'nonce-[A-Za-z0-9+/_=-]+'/.test(adminScript),'Admin CSP possui nonce');report(includesToken(adminScript,"'strict-dynamic'")&&!includesToken(adminScript,"'unsafe-inline'"),'Admin script-src estrito');report(includesToken(r.headers.get('cache-control'),'no-store'),'Admin login sem cache');report(includesToken(r.headers.get('x-robots-tag'),'noindex'),'Admin login noindex por header');
  r=await req('/admin');report([302,303,307,308].includes(r.status),'Admin exige autenticação',`${r.status}`);

  r=await req('/__marques_live_check_missing__');report(r.status===404,'404 real não retorna sucesso',`${r.status}`);
}catch(e){console.error('Falha no smoke test:',e instanceof Error?e.message:String(e));failures++;}
if(failures){console.error(`Smoke test: ${failures} falha(s).`);process.exit(1);}console.log('Smoke test de produção: OK.');
