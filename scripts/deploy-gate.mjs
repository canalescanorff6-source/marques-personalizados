import fs from 'node:fs';
import process from 'node:process';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const platform=JSON.parse(fs.readFileSync('platform-contract.json','utf8'));
const expectedSchema=Number(platform.schemaVersion);

const positional=process.argv.slice(2).filter(x=>!x.startsWith('--'));
const rawBase=positional[0]||process.env.DEPLOY_BASE_URL||process.env.NEXT_PUBLIC_SITE_URL||'';
const expected=(process.argv.find(x=>x.startsWith('--release='))?.split('=').slice(1).join('=')||process.env.EXPECTED_RELEASE_ID||'').trim();
const previous=(process.argv.find(x=>x.startsWith('--previous-release='))?.split('=').slice(1).join('=')||process.env.PREVIOUS_RELEASE_ID||'').trim();
const requireStorage=process.argv.includes('--require-storage')||process.env.DEPLOY_REQUIRE_STORAGE==='1';
const requireBackupFresh=process.argv.includes('--require-backup-fresh')||process.env.DEPLOY_REQUIRE_BACKUP_FRESH==='1';
const requireRecoveryDrillFresh=process.argv.includes('--require-recovery-drill-fresh')||process.env.DEPLOY_REQUIRE_RECOVERY_DRILL_FRESH==='1';
const requireMediaRecoveryDrillFresh=process.argv.includes('--require-media-recovery-drill-fresh')||process.env.DEPLOY_REQUIRE_MEDIA_RECOVERY_DRILL_FRESH==='1';
const samples=Math.min(8,Math.max(2,Number(process.argv.find(x=>x.startsWith('--samples='))?.split('=')[1]||3)||3));
if(!rawBase){console.error('Uso: npm run check:deploy -- https://seu-dominio --release=ID [--require-storage]');process.exit(2);}
let base;try{base=new URL(rawBase);if(!['https:','http:'].includes(base.protocol))throw new Error();if(base.pathname!=='/'||base.search||base.hash)throw new Error();}catch{console.error('Base URL inválida. Use somente a origem, ex.: https://catalogo.exemplo.com');process.exit(2);}
if(base.protocol!=='https:'&&!['localhost','127.0.0.1','::1'].includes(base.hostname)){console.error('Deploy gate exige HTTPS fora de localhost.');process.exit(2);}
const origin=base.origin;
const failures=[];const warnings=[];const releaseIds=[];
async function req(path,timeout=5000){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);try{return await fetch(`${origin}${path}`,{redirect:'manual',cache:'no-store',headers:{'user-agent':`Marques-Deploy-Gate/${pkg.version}`},signal:controller.signal});}finally{clearTimeout(timer);}}
async function json(response){try{return await response.json();}catch{return null;}}
function ok(condition,label,detail=''){if(!condition)failures.push(`${label}${detail?`: ${detail}`:''}`);else console.log(`✓ ${label}${detail?` — ${detail}`:''}`);}

try{
  const live=await req('/api/health?mode=live');const liveBody=await json(live);ok(live.ok&&liveBody?.ok===true,'Liveness',`HTTP ${live.status}`);if(liveBody?.release?.id)releaseIds.push(String(liveBody.release.id));
  const ready=await req('/api/health');const readyBody=await json(ready);ok(ready.ok&&readyBody?.ok===true,'Readiness',`HTTP ${ready.status}`);ok(Number(readyBody?.schema?.version||0)>=expectedSchema,'Schema runtime',String(readyBody?.schema?.version??'?'));
  const deep=await req('/api/health?mode=deep',7000);const deepBody=await json(deep);ok(deep.ok&&deepBody?.ok===true,'Deep health',`HTTP ${deep.status}`);ok(!Array.isArray(deepBody?.blockers)||deepBody.blockers.length===0,'Deep health sem bloqueadores',Array.isArray(deepBody?.blockers)?deepBody.blockers.join(', '):'');
  if(requireStorage)ok(deepBody?.storage?.configured===true&&deepBody?.storage?.ok===true,'Storage obrigatório disponível',String(deepBody?.storage?.state||'?'));
  if(requireBackupFresh)ok(deepBody?.backup_freshness?.ok===true,'Backup offsite recente',deepBody?.backup_freshness?.state||'missing');
  if(requireRecoveryDrillFresh)ok(deepBody?.recovery_drill?.ok===true,'Recovery drill recente',deepBody?.recovery_drill?.state||'missing');
  if(requireMediaRecoveryDrillFresh)ok(deepBody?.media_recovery_drill?.ok===true,'Media recovery drill recente',deepBody?.media_recovery_drill?.state||'missing');
  else if(deepBody?.storage?.configured&&deepBody?.storage?.ok!==true)failures.push(`Storage configurado indisponível: ${deepBody?.storage?.state||'unknown'}`);
  if(deepBody?.release?.id)releaseIds.push(String(deepBody.release.id));
  const home=await req('/');ok(home.ok,'Página pública',`HTTP ${home.status}`);ok((home.headers.get('content-type')||'').includes('text/html'),'Página pública retorna HTML');
  const adminLogin=await req('/admin/login');ok(adminLogin.ok,'Login administrativo responde',`HTTP ${adminLogin.status}`);const adminCsp=adminLogin.headers.get('content-security-policy')||'';const adminScript=adminCsp.split(';').map(x=>x.trim()).find(x=>x.startsWith('script-src '))||'';ok(/'nonce-[A-Za-z0-9+/_=-]+'/.test(adminScript),'Admin CSP usa nonce por request');ok(adminScript.includes("'strict-dynamic'")&&!adminScript.includes("'unsafe-inline'"),'Admin script-src não permite inline sem nonce');ok((adminLogin.headers.get('cache-control')||'').includes('no-store'),'Admin login não é cacheável');
  const admin=await req('/admin');ok(admin.status>=250&&admin.status<400,'Entrada do Admin responde',`HTTP ${admin.status}`);
  for(let i=0;i<samples;i++){const response=await req('/api/health?mode=live');const body=await json(response);if(body?.release?.id)releaseIds.push(String(body.release.id));await new Promise(r=>setTimeout(r,120));}
}catch(error){failures.push(`Erro de rede/probe: ${error instanceof Error?error.message:String(error)}`);}
const unique=[...new Set(releaseIds)];
ok(unique.length===1,'Release consistente entre probes',unique.join(', ')||'sem release');
if(expected)ok(unique[0]===expected,'Release esperado ativo',`esperado ${expected}; encontrado ${unique[0]||'?'}`);
else warnings.push('EXPECTED_RELEASE_ID não informado; o gate valida consistência, mas não confirma um ID específico.');
if(unique[0]===`v${pkg.version}`)warnings.push('Release remoto usa fallback da versão do app; configure APP_RELEASE_ID no deploy para detectar versões/commits com precisão.');
if(failures.length){console.error(`\nDeploy Gate: FALHOU (${failures.length})`);for(const f of failures)console.error(`- ${f}`);if(previous)console.error(`Rollback recomendado: promova novamente o release anterior ${previous} e execute este gate contra ele antes de liberar tráfego.`);else console.error('Rollback recomendado: restaure a última publicação conhecida como saudável e execute novamente o deploy gate.');process.exit(1);}
console.log(`\nDeploy Gate: OK — ${origin} — release ${unique[0]||'desconhecido'}`);for(const w of warnings)console.warn(`Aviso: ${w}`);
