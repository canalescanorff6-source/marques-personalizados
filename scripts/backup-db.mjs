import { neon } from '@neondatabase/serverless';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createBackupSignature } from '../lib/backup-signature.ts';
import { encryptBackupText } from '../lib/backup-encryption.ts';

if(!process.env.DATABASE_URL){console.error('Defina DATABASE_URL antes de executar npm run db:backup');process.exit(1);}
const sql=neon(process.env.DATABASE_URL);
async function strict(label,query){try{return await sql.query(query);}catch(error){throw new Error(`Falha ao exportar ${label}: ${error instanceof Error?error.message:'erro desconhecido'}`);}}
const [rawProducts,categories,inquiries,settingsRows,testimonials,faqs,inquiryActivity,socialPlans,marketingCampaigns,siteEvents,audit,privacyTombstones]=await Promise.all([
  strict('products','SELECT * FROM products ORDER BY created_at,id'),
  strict('categories','SELECT * FROM categories ORDER BY sort_order,name,id'),
  strict('inquiries','SELECT * FROM inquiries ORDER BY created_at,id'),
  strict('site_settings','SELECT * FROM site_settings WHERE id=1'),
  strict('testimonials','SELECT * FROM testimonials ORDER BY sort_order,created_at,id'),
  strict('faqs','SELECT * FROM faqs ORDER BY sort_order,created_at,id'),
  strict('inquiry_activity','SELECT * FROM inquiry_activity ORDER BY created_at,id'),
  strict('social_content_plans','SELECT * FROM social_content_plans ORDER BY planned_at,id'),
  strict('marketing_campaigns','SELECT * FROM marketing_campaigns ORDER BY created_at,id'),
  strict('site_events_daily','SELECT * FROM site_events_daily ORDER BY day,event,path'),
  strict('admin_audit_log','SELECT * FROM admin_audit_log ORDER BY created_at,id'),
  strict('privacy_requests',"SELECT subject_hash,identity_type,action,matched_inquiries,created_at,last_applied_at FROM privacy_requests WHERE action='anonymized' ORDER BY identity_type,subject_hash")
]);
if(!settingsRows[0]){console.error('Backup bloqueado: site_settings não possui o registro id=1.');process.exit(1);}
const products=rawProducts.filter(row=>!row.deleted_at);const archivedProducts=rawProducts.filter(row=>Boolean(row.deleted_at));
const schemaProbe=await strict('schema probe',`SELECT
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_restore_snapshots') AS restore_snapshots,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='marketing_campaign_slug_immutable' AND NOT tgisinternal) AS concurrency_guard,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='inquiries' AND column_name='version') AS inquiry_version,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_inquiries_version_monotonic' AND NOT tgisinternal) AS inquiry_version_guard,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_inquiries_commercial_guard' AND NOT tgisinternal) AS inquiry_commercial_guard,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_terminal_history') AS scalable_history,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_open_attention') AS scalable_open,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_delivered_history') AS production_history,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_post_sale_pending') AS production_aftercare,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_event_agenda') AS agenda_event,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_follow_up_agenda') AS agenda_follow_up,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_repurchase_event') AS reactivation_event,
  EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_repurchase_contact') AS repurchase_contact,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_log' AND column_name='prev_integrity_hash') AS audit_prev_hash,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_log' AND column_name='chain_version') AS audit_chain_version,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_audit_chain_state') AS audit_chain_state,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='admin_audit_chain_before_insert' AND NOT tgisinternal) AS audit_chain_before,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='admin_audit_chain_after_insert' AND NOT tgisinternal) AS audit_chain_after,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='inquiries' AND column_name='anonymized_at') AS privacy_anonymized_at,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='privacy_requests') AS privacy_requests,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_anonymize_privacy_subject') AS privacy_anonymize_func,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_restore_business_payload' AND pronargs IN (4,5)) AS privacy_restore_vault,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_restore_business_payload' AND pronargs=5) AS media_restore_mode,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='offsite_backup_receipts') AS offsite_backup_receipts,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='recovery_drill_receipts') AS recovery_drill_receipts,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='media_backup_receipts') AS media_backup_receipts,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='media_recovery_drill_receipts') AS media_recovery_drill_receipts,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='media_deletion_tombstones') AS media_deletion_tombstones,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_reserve_media_delete' AND pronargs=2) AS media_delete_reserve,
  EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_reactivate_media' AND pronargs=2) AS media_reactivate,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_products_media_tombstone_guard' AND NOT tgisinternal) AS media_product_guard,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_categories_media_tombstone_guard' AND NOT tgisinternal) AS media_category_guard,
  EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_site_settings_media_tombstone_guard' AND NOT tgisinternal) AS media_settings_guard,
  EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='operational_incidents') AS operational_incidents,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_log' AND column_name='integrity_hash') AS audit_integrity,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_sessions' AND column_name='last_reauth_at') AS critical_reauth,
  EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') AS category_id`);
const probe=schemaProbe[0]||{};
const v18=probe.restore_snapshots&&probe.concurrency_guard&&probe.inquiry_version&&probe.inquiry_version_guard&&probe.inquiry_commercial_guard&&probe.scalable_history&&probe.scalable_open&&probe.production_history&&probe.production_aftercare&&probe.agenda_event&&probe.agenda_follow_up&&probe.reactivation_event&&probe.repurchase_contact;
const v19=v18&&probe.audit_prev_hash&&probe.audit_chain_version&&probe.audit_chain_state&&probe.audit_chain_before&&probe.audit_chain_after;
const v20=v19&&probe.privacy_anonymized_at&&probe.privacy_requests&&probe.privacy_anonymize_func;
const v21=v20&&probe.privacy_restore_vault;
const v22=v21&&probe.offsite_backup_receipts;
const v23=v22&&probe.recovery_drill_receipts;
const v24=v23&&probe.media_backup_receipts;
const v25=v24&&probe.media_recovery_drill_receipts;
const v26=v25&&probe.media_deletion_tombstones&&probe.media_delete_reserve&&probe.media_reactivate&&probe.media_product_guard&&probe.media_category_guard&&probe.media_settings_guard&&probe.media_restore_mode;
const schemaVersion=v26?26:v25?25:v24?24:v23?23:v22?22:v21?21:v20?20:v19?19:v18?18:probe.restore_snapshots&&probe.concurrency_guard&&probe.inquiry_version&&probe.inquiry_version_guard&&probe.inquiry_commercial_guard&&probe.scalable_history&&probe.scalable_open&&probe.production_history&&probe.production_aftercare&&probe.agenda_event&&probe.agenda_follow_up?17:probe.restore_snapshots&&probe.concurrency_guard&&probe.inquiry_version&&probe.inquiry_version_guard&&probe.inquiry_commercial_guard&&probe.scalable_history&&probe.scalable_open&&probe.production_history&&probe.production_aftercare?16:probe.restore_snapshots&&probe.concurrency_guard&&probe.inquiry_version&&probe.inquiry_version_guard&&probe.inquiry_commercial_guard&&probe.scalable_history&&probe.scalable_open?15:probe.restore_snapshots&&probe.concurrency_guard&&probe.inquiry_version&&probe.inquiry_version_guard&&probe.inquiry_commercial_guard?14:probe.restore_snapshots&&probe.concurrency_guard?13:probe.restore_snapshots?12:probe.operational_incidents&&probe.audit_integrity?11:probe.critical_reauth?10:probe.category_id?6:5;
// Ordem canônica: V8 preserva privacidade; V9 (schema 26+) assina também tombstones de mídia.
const privacy_tombstones=privacyTombstones.map(row=>({subject_hash:String(row.subject_hash||'').toLowerCase(),identity_type:String(row.identity_type||''),action:'anonymized',matched_inquiries:Number(row.matched_inquiries||0),created_at:new Date(String(row.created_at)).toISOString(),last_applied_at:new Date(String(row.last_applied_at)).toISOString()}));
const content={products,archived_products:archivedProducts,categories,inquiries,settings:settingsRows[0],testimonials,faqs,inquiry_activity:inquiryActivity,social_content_plans:socialPlans,marketing_campaigns:marketingCampaigns,site_events_daily:siteEvents,audit,privacy_tombstones};
if(v26)content.media_deletion_tombstones=await strict('media_deletion_tombstones','SELECT url,storage_key,deleted_at FROM media_deletion_tombstones ORDER BY storage_key,url');
const contentSha256=crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
const counts=Object.fromEntries(Object.entries(content).filter(([,value])=>Array.isArray(value)).map(([key,value])=>[key,value.length]));
const createdAt=new Date().toISOString();const version=v26?9:8,backup_format=v26?'marques-catalog-v9':'marques-catalog-v8';const signature=createBackupSignature({version,backup_format,schema_version:schemaVersion,created_at:createdAt,content_sha256:contentSha256,counts});const payload={version,backup_format,schema_version:schemaVersion,created_at:createdAt,manifest:{algorithm:'sha256',content_sha256:contentSha256,counts,signature},...content};
const encoded=JSON.stringify(payload,null,2);if(Buffer.byteLength(encoded,'utf8')>25*1024*1024){console.error('Backup bloqueado: conteúdo interno excederia 25 MB.');process.exit(1);}
const encrypted=encryptBackupText(encoded);if(Buffer.byteLength(encrypted,'utf8')>36*1024*1024){console.error('Backup bloqueado: envelope criptografado excederia 36 MB.');process.exit(1);}
const dir=path.resolve(process.env.BACKUP_OUTPUT_DIR||'backups');await fs.mkdir(dir,{recursive:true});const stamp=new Date().toISOString().replace(/[:.]/g,'-');const file=path.join(dir,`marques-catalog-v${version}-schema${schemaVersion}-${stamp}.encrypted.json`);await fs.writeFile(file,encrypted);console.log(`Backup assinado e criptografado salvo em ${file}`);console.log(`BACKUP_FILE=${file}`);console.log(`SHA-256 do conteúdo: ${contentSha256}`);console.log(`Autenticidade: HMAC-SHA256 (${signature.key_id})`);console.log('Confidencialidade: AES-256-GCM');console.log(`Registros exportados: ${Object.entries(counts).map(([key,value])=>`${key}=${value}`).join(', ')}`);
