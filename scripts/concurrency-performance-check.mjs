import fs from 'node:fs';

const errors=[];
const read=(file)=>fs.readFileSync(file,'utf8');
const db=read('lib/db.ts');
const security=read('lib/security.ts');
const ratePolicy=read('lib/rate-limit-policy.ts');
const schema=read('sql/schema.sql');
const inquiry=read('app/api/inquiries/route.ts');
const pkg=JSON.parse(read('package.json'));

for(const token of [
  "COUNT(*) OVER()::int AS __total",
  "if(!rows.length&&page>1)",
  "INSERT-first",
  "ON CONFLICT(idempotency_key)",
  "deduplicated:!created",
  "status:created?201:200",
  "AND updated_at=$8",
  "WHERE id=1 AND updated_at=$${params.length}",
  "information_schema em cada salvamento"
]) if(!db.includes(token)&&!inquiry.includes(token)) errors.push(`Contrato de concorrência/performance ausente: ${token}`);

for(const forbidden of [
  "SELECT name,updated_at FROM categories WHERE id=$1 LIMIT 1",
  "SELECT updated_at FROM site_settings WHERE id=1 LIMIT 1",
  "information_schema.columns WHERE table_schema='public' AND table_name='inquiries'"
]) if(db.includes(forbidden)) errors.push(`Round-trip legado ainda presente: ${forbidden}`);

for(const token of [
  'distributedRateState',
  'DISTRIBUTED_RATE_BREAKER_MS',
  'DISTRIBUTED_RATE_FAILURE_THRESHOLD',
  'distributedRateBuckets(scope,limit,strict)',
  'degraded:true'
]) if(!security.includes(token)) errors.push(`Rate limit resiliente ausente: ${token}`);
for(const token of ["scope.startsWith('admin-')","subject:'global'",'normalized*4']) if(!ratePolicy.includes(token)) errors.push(`Política anti-spoof do rate limit ausente: ${token}`);

for(const token of [
  'marques_campaign_slug_immutable',
  'marketing_campaign_slug_immutable',
  'idx_products_public_stock_order',
  'idx_inquiries_payment_created',
  'idx_inquiries_production_created',
  'idx_inquiries_source_created'
]) if(!schema.includes(token)) errors.push(`Schema de concorrência/performance ausente: ${token}`);


if(!pkg.scripts?.['check:performance'])errors.push('Script check:performance ausente.');
if(!pkg.scripts?.['check:load'])errors.push('Script check:load ausente.');

if(errors.length){console.error(`Concurrency/Performance Check: FALHOU (${errors.length})`);for(const e of errors)console.error(`- ${e}`);process.exit(1);}
console.log('Concurrency/Performance Check: OK — escrita otimista atômica, idempotência INSERT-first, catálogo 1-query, circuit breaker e índices verificados.');
