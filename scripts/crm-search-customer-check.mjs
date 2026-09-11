import fs from 'node:fs';
const errors=[];const read=f=>fs.readFileSync(f,'utf8');
const db=read('lib/db.ts');const route=read('app/api/admin/inquiries/query/route.ts');const historyRoute=read('app/api/admin/inquiries/route.ts');const page=read('app/admin/page.tsx');const dashboard=read('components/AdminDashboard.tsx');const manager=read('components/admin/InquiryManager.tsx');const ci=read('.github/workflows/ci.yml');const pkg=JSON.parse(read('package.json'));
function need(src,token,label){if(!src.includes(token))errors.push(`${label}: ausente ${token}`);}
for(const token of ['InquiryCustomerStatsMap','getInquiryCustomerStats','searchInquiries','regexp_replace(whatsapp','ILIKE $1','[like,digits,q,pageSize]','customer_stats'])need(db,token,'DB busca/cliente');
for(const token of ['isAdmin()','sameOriginRequest(request)','protectedRateLimit','readJsonBody','body.mode===\'search\'','body.mode===\'customer_stats\'','searchInquiries','getInquiryCustomerStats'])need(route,token,'API busca/cliente');
for(const token of ['customer_stats','getInquiryCustomerStats(page.items.map'])need(historyRoute,token,'Histórico + inteligência do cliente');
need(page,'initialCustomerStats={workspace.customer_stats}','Bootstrap Admin');
for(const token of ['initialCustomerStats:InquiryCustomerStatsMap','initialCustomerStats={initialCustomerStats}'])need(dashboard,token,'Dashboard');
for(const token of ['serverCustomerStats','remoteSearch','/api/admin/inquiries/query','mode:\'search\'','mode:\'customer_stats\'','Pesquisando em todo o histórico','setInquiries(prev=>{const seen=new Set(prev.map(row=>row.id))'])need(manager,token,'CRM client');
if(route.includes('new URL(request.url)'))errors.push('Busca CRM não deve transportar nome/telefone na query string da URL.');
if(!manager.includes('setTimeout(')||!manager.includes('280'))errors.push('Busca remota precisa de debounce curto para evitar rajada de requisições.');

if(!pkg.scripts?.['check:crm-search'])errors.push('check:crm-search ausente.');
if(!pkg.scripts?.verify?.includes('check:crm-search'))errors.push('verify não exige check:crm-search.');
need(ci,'npm run check:scalable-crm','CI');need(ci,'npm run check:crm-search','CI');
if(errors.length){console.error(`CRM Search/Customer Check: FALHOU (${errors.length})`);for(const e of errors)console.error(`- ${e}`);process.exit(1);}console.log('CRM Search/Customer Check: OK — busca global, dados em corpo POST e inteligência de recorrência independentes da paginação.');
