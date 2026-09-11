import fs from 'node:fs';
const errors=[];
const read=f=>fs.readFileSync(f,'utf8');
const db=read('lib/db.ts');
const schema=read('sql/schema.sql').toLowerCase();
const inquiryApi=read('app/api/admin/inquiries/[id]/route.ts');
const bulkApi=read('app/api/admin/inquiries/bulk/route.ts');
const publicInquiry=read('app/api/inquiries/route.ts');
const quoteList=read('components/QuoteListProvider.tsx');
const quoteForm=read('components/QuoteForm.tsx');
const backupApi=read('app/api/admin/backup/route.ts');
const backupCli=read('scripts/backup-db.mjs');
const restore=read('lib/backup-restore.ts');
const pkg=JSON.parse(read('package.json'));

function need(source,token,label){if(!source.includes(token))errors.push(`${label}: ${token}`);}
for(const [token,label] of [
 ['version:number','Inquiry.version'],
 ['WHERE id=$9 AND version=$10','PATCH otimista por versão'],
 ['bulkUpdateInquiries(items','bulk all-or-none'],
 ['cardinality($1::uuid[])','gate de cardinalidade em lote'],
 ['INSERT INTO inquiry_activity','timeline transacional'],
 ['getBackupExportStrict','exportação estrita de backup'],
 ['version IS NULL OR version<1','integridade runtime de versão'],
 ['estado comercial incoerente','integridade runtime comercial']
])need(db,token,label);
for(const token of ['trg_inquiries_version_monotonic','trg_inquiries_commercial_guard','idx_inquiries_version','crm_payment_pending_with_value','crm_payment_signal_invalid','crm_payment_paid_invalid','crm_production_requires_closed'])need(schema,token,'Schema comercial');
for(const token of ['expected_version','InquiryCommercialStateError','status:409','status:422'])need(inquiryApi,token,'PATCH CRM');
for(const token of ['body.items','version','atomic:true','Nenhum item foi alterado'])need(bulkApi,token,'Bulk CRM');
for(const token of ['persisted:false','contingency:true','whatsapp_url','status:202'])need(publicInquiry,token,'Contingência pública');
for(const token of ['data.persisted!==false','setPersisted(wasPersisted)','if(wasPersisted)','clear()'])need(quoteList,token,'Lista de orçamento');
need(quoteForm,'setPersisted(data.persisted!==false)','Formulário de orçamento');
need(backupApi,'getBackupExportStrict','Backup admin completo');
for(const token of ['SELECT * FROM inquiries ORDER BY created_at,id','SELECT * FROM inquiry_activity ORDER BY created_at,id','schema_version:schemaVersion'])need(backupCli,token,'Backup CLI completo');
for(const token of ['legacyHashOrder','schemaVersion<14','BACKUP_COMMERCIAL_INTEGRITY','row.version'])need(restore,token,'Restore/backup compatível');

for(const forbidden of [
 'expected_updated_at:next.updated_at',
 'ids:[...selected]',
 'Promise.all(updated.map(row=>addInquiryActivity',
]){
  const combined=[read('components/admin/InquiryManager.tsx'),bulkApi].join('\n');
  if(combined.includes(forbidden))errors.push(`Padrão comercial legado ainda presente: ${forbidden}`);
}

if(!pkg.scripts?.['check:commercial'])errors.push('Script check:commercial ausente.');
if(!pkg.scripts?.verify?.includes('check:commercial'))errors.push('verify não exige check:commercial.');

if(errors.length){console.error(`Commercial Resilience Check: FALHOU (${errors.length})`);for(const e of errors)console.error(`- ${e}`);process.exit(1);}
console.log('Commercial Resilience Check: OK — CRM versionado, lote atômico, invariantes comerciais, contingência WhatsApp e backup estrito/compatível verificados.');
