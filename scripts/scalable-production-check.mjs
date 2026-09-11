import fs from 'node:fs';
const errors=[];const read=f=>fs.readFileSync(f,'utf8');const db=read('lib/db.ts');const route=read('app/api/admin/production/route.ts');const manager=read('components/admin/ProductionManager.tsx');const cursor=read('lib/production-cursor.ts');const schema=read('sql/schema.sql').toLowerCase();const runtime=read('scripts/db-runtime-contract.mjs');const ci=read('.github/workflows/ci.yml');const pkg=JSON.parse(read('package.json'));
function need(src,token,label){if(!src.includes(token))errors.push(`${label}: ausente ${token}`);}
for(const token of ['ProductionSummary','ProductionWorkspace','getProductionSummary','getProductionDeliveredPage','getProductionWorkspace',"production_status='entregue'","(updated_at,id)<","review_requested_at IS NULL"])need(db,token,'DB produção escalável');
for(const token of ['idx_inquiries_delivered_history','idx_inquiries_post_sale_pending']){need(schema,token,'Schema produção escalável');need(runtime,token,'db:verify produção escalável');}
for(const token of ['isAdmin()','getProductionWorkspace','getProductionDeliveredPage','decodeProductionCursor','encodeProductionCursor',"view==='history'",'cache-control'])need(route,token,'API produção');
for(const token of ['updated_at','base64url','uuid','return null'])need(cursor,token,'Cursor de produção');
for(const token of ['/api/admin/production?view=workspace','/api/admin/production?view=history','summary.review_pending_count','aftercare','Carregar mais entregues','Pós-venda','requestReview','/review'])need(manager,token,'UI Produção');
if(manager.includes('inquiries.filter('))errors.push('ProductionManager ainda calcula produção a partir do lote paginado do CRM.');

if(!pkg.scripts?.['check:production-scale'])errors.push('check:production-scale ausente.');
if(!pkg.scripts?.verify?.includes('check:production-scale'))errors.push('verify não exige check:production-scale.');
need(ci,'npm run check:production-scale','CI');
if(errors.length){console.error(`Scalable Production Check: FALHOU (${errors.length})`);for(const e of errors)console.error(`- ${e}`);process.exit(1);}console.log('Scalable Production Check: OK — fila global, histórico entregue por cursor, KPIs globais e pós-venda independentes da paginação do CRM.');
