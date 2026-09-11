import { adminGlobalRateLimit,distributedRateBuckets,strictDistributedRateScope } from '../lib/rate-limit-policy.ts';
const failures=[];const expect=(condition,label)=>{if(!condition)failures.push(label);};
expect(strictDistributedRateScope('admin-login'),'admin-login deve usar política estrita');
expect(!strictDistributedRateScope('catalog'),'catálogo público não deve usar teto global administrativo');
const admin=distributedRateBuckets('admin-login',8,true);
expect(admin.length===2,'Admin estrito precisa de dois buckets');
expect(admin[0]?.subject==='client'&&admin[0]?.scope==='admin-login'&&admin[0]?.limit===8,'primeiro bucket deve limitar o cliente');
expect(admin[1]?.subject==='global'&&admin[1]?.scope==='admin-login:global','segundo bucket deve ser global e independente do IP');
expect(admin[1]?.limit===32&&adminGlobalRateLimit(8)===32,'login deve ter teto global 4x o limite individual');
const publicPlan=distributedRateBuckets('inquiry',6,false);
expect(publicPlan.length===1&&publicPlan[0]?.subject==='client','escopo público mantém bucket por cliente');
expect(adminGlobalRateLimit(1)===12,'teto global mínimo precisa evitar valores inutilizáveis');
expect(adminGlobalRateLimit(1000)===600,'teto global precisa ter limite superior');
if(failures.length){console.error(`Rate Limit Policy Self-Test: FALHOU (${failures.length})`);for(const failure of failures)console.error('- '+failure);process.exit(1);}
console.log('Rate Limit Policy Self-Test: OK — Admin usa limite por cliente + teto global anti-spoof.');
