import fs from 'node:fs';
const errors=[];const read=f=>fs.readFileSync(f,'utf8');const db=read('lib/db.ts');const schema=read('sql/schema.sql').toLowerCase();const page=read('app/admin/page.tsx');const dashboard=read('components/AdminDashboard.tsx');const manager=read('components/admin/InquiryManager.tsx');const overview=read('components/admin/OverviewManager.tsx');const promotion=read('components/admin/PromotionStudio.tsx');const campaigns=read('components/admin/CampaignManager.tsx');const route=read('app/api/admin/inquiries/route.ts');const runtime=read('scripts/db-runtime-contract.mjs');const pkg=JSON.parse(read('package.json'));
function need(source,token,label){if(!source.includes(token))errors.push(`${label}: ${token}`);}
for(const token of ['getInquiryWorkspace','getInquiryHistoryPage','getInquiryCommercialSummary','getInquiryCommercialInsights','getInquiryMarketingStats','inquiryOperationalWhere','(created_at,id)<','COUNT(*) FILTER','weighted_pipeline_cents'])need(db,token,'DB CRM escalável');
for(const token of ['idx_inquiries_terminal_history','idx_inquiries_open_attention']){need(schema,token,'Índice CRM escalável');need(runtime,token,'db:verify CRM escalável');}
for(const token of ['getInquiryWorkspace(80)','getInquiryCommercialSummary()','getInquiryCommercialInsights(30)','initialInquiryHistoryCursor'])need(page,token,'Bootstrap Admin');
for(const token of ['commercialSummary','/api/admin/inquiries?view=summary','initialCommercialInsights','production_open_count'])need(dashboard,token,'KPIs globais');
for(const token of ['initialHistoryCursor','loadMoreHistory','next_cursor','Carregar mais histórico','KPIs e relatórios continuam globais'])need(manager,token,'Paginação do CRM');
for(const token of ['initialCommercialInsights','view=insights','setCommercialInsights'])need(overview,token,'Insights globais');
for(const token of ["view==='history'","view==='summary'","view==='insights'","view==='marketing'",'decodeInquiryHistoryCursor','cache-control'])need(route,token,'API CRM escalável');
for(const token of ['view=marketing','marketingStats.social_rows','campaignStats'])need(promotion,token,'Marketing global');
for(const token of ['statsBySlug','InquiryMarketingCampaignRow'])need(campaigns,token,'Campanhas globais');
if(promotion.includes('inquiries.filter(')||campaigns.includes('inquiries.filter('))errors.push('Marketing/Campanhas ainda dependem do lote paginado de inquiries.');
if(db.includes('ORDER BY created_at DESC LIMIT 500'))errors.push('getInquiries ainda contém LIMIT 500 legado.');

if(!pkg.scripts?.['check:scalable-crm'])errors.push('Script check:scalable-crm ausente.');
if(!pkg.scripts?.verify?.includes('check:scalable-crm'))errors.push('verify não exige check:scalable-crm.');
if(errors.length){console.error(`Scalable CRM Check: FALHOU (${errors.length})`);for(const e of errors)console.error(`- ${e}`);process.exit(1);}console.log('Scalable CRM Check: OK — workspace operacional sem LIMIT 500, histórico por cursor e KPIs/insights globais verificados.');
