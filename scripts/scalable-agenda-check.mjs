import fs from 'node:fs';
const errors=[];const read=file=>fs.readFileSync(file,'utf8');
const db=read('lib/db.ts');const route=read('app/api/admin/agenda/route.ts');const manager=read('components/admin/AgendaManager.tsx');const dashboard=read('components/AdminDashboard.tsx');const window=read('lib/agenda-window.ts');const schema=read('sql/schema.sql').toLowerCase();const runtime=read('scripts/db-runtime-contract.mjs');const ci=read('.github/workflows/ci.yml');const pkg=JSON.parse(read('package.json'));
function need(src,token,label){if(!src.includes(token))errors.push(`${label}: ausente ${token}`);}
for(const token of ['AdminAgendaWorkspace','getAdminAgenda','event_date BETWEEN CURRENT_DATE-1','follow_up_at>=now()-interval \'1 day\'','production_due_at>=now()-interval \'90 days\'','social_content_plans','publish_at IS NOT NULL','unpublish_at IS NOT NULL'])need(db,token,'DB Agenda');
for(const token of ['ADMIN_AGENDA_WINDOWS','30,60,90,180','normalizeAdminAgendaDays','isAdminAgendaDays'])need(window,token,'Janela Agenda');
for(const token of ['isAdmin()','getAdminAgenda','isAdminAgendaDays','cache-control','serverFailure'])need(route,token,'API Agenda');
for(const token of ['/api/admin/agenda?days=','AdminAgendaWorkspace','summary.next_7','summary.events','summary.follow_ups','summary.production','summary.publications','Baixar .ics','Tentar novamente'])need(manager,token,'UI Agenda');
if(manager.includes('inquiries:Inquiry[]')||manager.includes('products:Product[]')||manager.includes('inquiries.filter(')||manager.includes('/api/admin/social-plan'))errors.push('AgendaManager ainda depende do lote do CRM/produtos ou da rota social-plan antiga.');
if(!dashboard.includes("{tab==='agenda'&&<AgendaManager/>}"))errors.push('AdminDashboard ainda injeta CRM/produtos na Agenda.');
for(const index of ['idx_inquiries_event_agenda','idx_inquiries_follow_up_agenda']){need(schema,index,'Schema Agenda');need(runtime,index,'db:verify Agenda');}

if(!pkg.scripts?.['check:agenda-scale'])errors.push('check:agenda-scale ausente.');
if(!pkg.scripts?.verify?.includes('check:agenda-scale'))errors.push('verify não exige check:agenda-scale.');
need(ci,'npm run check:agenda-scale','CI');
if(errors.length){console.error(`Scalable Agenda Check: FALHOU (${errors.length})`);for(const error of errors)console.error(`- ${error}`);process.exit(1);}
console.log('Scalable Agenda Check: OK — calendário global por período, índices próprios e UI independente do CRM paginado.');
