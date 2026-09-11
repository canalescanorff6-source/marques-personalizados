import process from 'node:process';
import { performance } from 'node:perf_hooks';

const positional=process.argv.slice(2).filter(x=>!x.startsWith('--'));
const rawBase=positional[0]||process.env.LOAD_BASE_URL||process.env.DEPLOY_BASE_URL||'';
const total=Math.min(80,Math.max(8,Number(process.argv.find(x=>x.startsWith('--requests='))?.split('=')[1]||24)||24));
const concurrency=Math.min(10,Math.max(1,Number(process.argv.find(x=>x.startsWith('--concurrency='))?.split('=')[1]||4)||4));
const maxP95=Math.min(10_000,Math.max(500,Number(process.argv.find(x=>x.startsWith('--p95='))?.split('=')[1]||3000)||3000));
const maxFailureRate=Math.min(0.25,Math.max(0,Number(process.argv.find(x=>x.startsWith('--max-failure-rate='))?.split('=')[1]||0.05)||0.05));
if(!rawBase){console.error('Uso: npm run check:load -- https://seu-dominio [--requests=24] [--concurrency=4] [--p95=3000]');process.exit(2);}
let origin='';try{const u=new URL(rawBase);if(!['http:','https:'].includes(u.protocol)||u.pathname!=='/'||u.search||u.hash)throw new Error();if(u.protocol!=='https:'&&!['localhost','127.0.0.1','::1'].includes(u.hostname))throw new Error();origin=u.origin;}catch{console.error('LOAD_BASE_URL inválida; use somente a origem HTTPS.');process.exit(2);}

const timings=[];let failures=0;let throttled=0;let cursor=0;
async function hit(i){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),7000);const started=performance.now();try{
  // Parâmetro desconhecido e único evita que o smoke seja satisfeito apenas por
  // cache de CDN, sem alterar a semântica do endpoint de catálogo.
  const r=await fetch(`${origin}/api/catalog?limit=6&page=1&_load_smoke=${Date.now()}-${i}`,{cache:'no-store',headers:{'user-agent':'Marques-Load-Smoke/6.22'},signal:controller.signal});
  timings.push(performance.now()-started);if(r.status===429)throttled++;if(!r.ok)failures++;
  try{const body=await r.json();if(r.ok&&(!Array.isArray(body?.items)||typeof body?.total!=='number'))failures++;}catch{if(r.ok)failures++;}
}catch{timings.push(performance.now()-started);failures++;}finally{clearTimeout(timer);}}
async function worker(){for(;;){const i=cursor++;if(i>=total)return;await hit(i);}}
await Promise.all(Array.from({length:Math.min(concurrency,total)},()=>worker()));
timings.sort((a,b)=>a-b);const percentile=(p)=>timings[Math.min(timings.length-1,Math.max(0,Math.ceil(timings.length*p)-1))]||0;const p50=percentile(.5),p95=percentile(.95),max=timings.at(-1)||0;const failureRate=failures/total;
console.log(`Load Smoke — ${origin}`);console.log(`requests=${total} concurrency=${concurrency} failures=${failures} throttled=${throttled}`);console.log(`p50=${p50.toFixed(0)}ms p95=${p95.toFixed(0)}ms max=${max.toFixed(0)}ms`);
if(throttled>0){console.error('Load Smoke: FALHOU — o smoke atingiu rate limit; revise capacidade/limites antes da promoção.');process.exit(1);}if(failureRate>maxFailureRate){console.error(`Load Smoke: FALHOU — taxa de falha ${(failureRate*100).toFixed(1)}% > ${(maxFailureRate*100).toFixed(1)}%.`);process.exit(1);}if(p95>maxP95){console.error(`Load Smoke: FALHOU — p95 ${p95.toFixed(0)}ms > ${maxP95}ms.`);process.exit(1);}console.log('Load Smoke: OK');
