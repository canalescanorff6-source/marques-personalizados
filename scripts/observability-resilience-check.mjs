import fs from 'node:fs';
const errors=[];
function need(file,token,message){const text=fs.readFileSync(file,'utf8');if(!text.includes(token))errors.push(message);}
for(const file of ['components/admin/OperationsCenter.tsx','components/admin/OperationsAlertBanner.tsx','app/api/admin/operations/route.ts','scripts/verify-backup.mjs','scripts/backup-integrity-self-test.mjs'])if(!fs.existsSync(file))errors.push(`Arquivo ausente: ${file}`);
need('sql/schema.sql','CREATE TABLE IF NOT EXISTS operational_incidents','operational_incidents ausente');
need('sql/schema.sql','admin_audit_append_only','trigger append-only da auditoria ausente');
need('sql/schema.sql','admin_audit_set_integrity_hash','hash de integridade da auditoria ausente');
need('sql/schema.sql','integrity_hash text','admin_audit_log.integrity_hash ausente');
need('lib/observability.ts','recordOperationalIncident','erros do servidor não persistem incidente');
need('lib/observability.ts','[REDACTED]','redação de segredo em observabilidade ausente');
need('lib/observability.ts','setTimeout(resolve,900)','persistência de incidente precisa ter limite de latência');
need('app/api/admin/operations/route.ts','checkAdminAuditIntegrity','API operacional não verifica auditoria');
need('components/AdminDashboard.tsx',"'operacao'",'aba Operação ausente');
need('components/AdminDashboard.tsx','OperationsAlertBanner','alerta operacional no painel ausente');
need('components/admin/OperationsCenter.tsx','Incidentes operacionais','UI de incidentes ausente');
need('app/api/admin/backup/route.ts',"'marques-catalog-v9':'marques-catalog-v8'",'backup verificável V8/V9 ausente');
need('app/api/admin/backup/route.ts',"createHash('sha256')",'backup sem SHA-256');
need('lib/backup-restore.ts','timingSafeEqual','verificador de backup não compara hash em tempo constante');
need('scripts/backup-db.mjs',"'marques-catalog-v9':'marques-catalog-v8'",'db:backup não usa formato verificável V8/V9');
need('scripts/backup-db.mjs',"createHash('sha256')",'db:backup sem SHA-256');
const routes=[];function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const path=`${dir}/${entry.name}`;if(entry.isDirectory())walk(path);else if(entry.name==='route.ts')routes.push(path);}}walk('app/api');
for(const file of routes){const text=fs.readFileSync(file,'utf8');if(text.includes('serverFailure(')&&text.includes('return serverFailure('))errors.push(`${file}: serverFailure precisa ser aguardado para persistir incidente`);}
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));if(!String(pkg.scripts?.['check:observability']||'').includes('observability-resilience-check'))errors.push('script check:observability ausente');if(!String(pkg.scripts?.['backup:verify']||'').includes('verify-backup'))errors.push('script backup:verify ausente');if(!String(pkg.scripts?.verify||'').includes('check:observability'))errors.push('verify não exige check:observability');
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');if(!ci.includes('npm run check:observability'))errors.push('CI não exige check:observability');
if(errors.length){console.error(`Observability/Resilience Check: ${errors.length} problema(s)`);for(const e of errors)console.error(`- ${e}`);process.exit(1);}console.log(`Observability/Resilience Check: OK (${routes.length} rotas inspecionadas).`);
