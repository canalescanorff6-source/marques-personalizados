export async function verifyRuntimeDb(sql){
  const errors=[];
  async function rows(text,params=[]){return await sql.query(text,params);}
  const requiredTables=['products','categories','site_settings','testimonials','inquiries','faqs','site_events_daily','admin_audit_log','request_rate_limits','inquiry_activity','social_content_plans','marketing_campaigns','admin_sessions','admin_mfa_used_steps','admin_mfa_recovery_codes','admin_known_devices','admin_security_events','operational_incidents','admin_restore_snapshots','admin_audit_chain_state','privacy_requests','offsite_backup_receipts','recovery_drill_receipts','media_backup_receipts','media_recovery_drill_receipts','media_deletion_tombstones','media_lifecycle_leases'];
  const tableRows=await rows(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name = ANY($1::text[])`,[requiredTables]);
  const tables=new Set(tableRows.map(r=>String(r.table_name)));
  for(const table of requiredTables)if(!tables.has(table))errors.push(`Tabela ausente: ${table}`);

  const requiredColumns={
    products:['category_id','badge','customization_fields','publish_at','unpublish_at','min_quantity','production_time','seo_title','seo_description'],
    inquiries:['event_brief','closed_at','idempotency_key','quote_items','quoted_value_cents','follow_up_at','admin_notes','payment_status','paid_cents','production_status','production_due_at','review_requested_at','repurchase_contacted_at','repurchase_contact_year','anonymized_at','version'],
    site_settings:['whatsapp_template_first_contact','whatsapp_template_follow_up','whatsapp_template_quote_ready','whatsapp_template_confirmation','whatsapp_template_review_request','whatsapp_template_repurchase','whatsapp_template_approval','whatsapp_template_ready','pricing_hourly_rate_cents','pricing_overhead_percent','pricing_waste_percent','pricing_target_margin_percent','pricing_payment_fee_percent','announcement_link','announcement_start_at','announcement_end_at','logo_url','hero_image_url','facebook_url','tiktok_url','pinterest_url','youtube_url','google_business_url','google_review_url','social_default_hashtags','bio_title','bio_description','monthly_sales_goal_cents'],
    social_content_plans:['channel','planned_at','status','product_id','campaign','notes'],
    marketing_campaigns:['name','slug','channel','status','starts_at','ends_at','goal_leads','goal_revenue_cents','spend_cents','notes'],
    request_rate_limits:['key_hash','expires_at','count'],
    admin_audit_log:['summary','metadata','severity','request_id','actor_session_id','actor_device_hash','auth_method','prev_integrity_hash','integrity_hash','chain_version'],
    admin_audit_chain_state:['singleton','last_audit_id','last_hash','updated_at'],
    admin_sessions:['session_hash','device_hash','device_label','user_agent','user_agent_hash','ip_hash','created_at','last_seen_at','expires_at','mfa_verified_at','last_reauth_at','auth_method','revoked_at'],
    admin_mfa_used_steps:['step','used_at'],
    admin_mfa_recovery_codes:['code_hash','created_at','used_at'],
    admin_known_devices:['device_hash','device_label','user_agent','user_agent_hash','first_seen_at','last_seen_at','last_login_at','revoked_at'],
    admin_security_events:['event_type','severity','device_hash','device_label','summary','created_at','acknowledged_at'],
    operational_incidents:['fingerprint','scope','severity','status_code','error_name','message','last_reference','occurrences','first_seen_at','last_seen_at','acknowledged_at','resolved_at'],
    privacy_requests:['subject_hash','identity_type','action','matched_inquiries','created_at','last_applied_at'],
    media_deletion_tombstones:['url','storage_key','deleted_at','storage_deleted_at','last_operation','attempt_count','last_attempt_at','last_error_code'],
    media_lifecycle_leases:['storage_key','url','operation','token','acquired_at','expires_at'],
  };
  const colRows=await rows(`SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = ANY($1::text[])`,[Object.keys(requiredColumns)]);
  const cols=new Map();for(const r of colRows){const set=cols.get(String(r.table_name))||new Set();set.add(String(r.column_name));cols.set(String(r.table_name),set);}
  for(const [table,names] of Object.entries(requiredColumns))for(const name of names)if(!cols.get(table)?.has(name))errors.push(`Coluna ausente: ${table}.${name}`);

  const lifecycleFunctions=new Map([['marques_acquire_media_lease',3],['marques_cancel_media_lease',4],['marques_begin_media_delete',2],['marques_complete_media_delete',3],['marques_fail_media_delete',4],['marques_begin_media_upload',2],['marques_complete_media_upload',3],['marques_fail_media_upload',4]]);
  const functionRows=await rows(`SELECT proname,pronargs,pg_get_functiondef(oid) definition FROM pg_proc WHERE proname = ANY($1::text[])`,[['marques_restore_business_payload','marques_anonymize_privacy_subject',...lifecycleFunctions.keys()]]);
  const restoreFn=functionRows.find(r=>String(r.proname)==='marques_restore_business_payload'&&Number(r.pronargs)===5);
  if(!restoreFn)errors.push('Função marques_restore_business_payload schema 27 (5 argumentos) ausente.');
  else if(!String(restoreFn.definition||'').includes('MEDIA_LIFECYCLE_ACTIVE')||!String(restoreFn.definition||'').includes('media-lifecycle-global'))errors.push('Restore não está serializado com o lifecycle externo de mídia.');
  if(!functionRows.some(r=>String(r.proname)==='marques_anonymize_privacy_subject'))errors.push('Função marques_anonymize_privacy_subject ausente.');
  for(const [name,arity] of lifecycleFunctions)if(!functionRows.some(r=>String(r.proname)===name&&Number(r.pronargs)===arity))errors.push(`Função de lifecycle de mídia ausente/incompatível: ${name}/${arity}`);
  const acquireFn=functionRows.find(r=>String(r.proname)==='marques_acquire_media_lease'&&Number(r.pronargs)===3);
  if(acquireFn&&!String(acquireFn.definition||'').includes('media-lifecycle-global'))errors.push('Aquisição de lease não compartilha lock global com restore.');
  const legacyFunctions=await rows(`SELECT proname FROM pg_proc WHERE proname IN ('marques_reserve_media_delete','marques_reactivate_media')`);
  if(legacyFunctions.length)errors.push('Funções de mídia V6.48/V6.49 inseguras ainda existem no schema 27.');

  const requiredIndexes=['idx_admin_audit_chain_version_id','idx_products_public_stock_order','idx_inquiries_payment_created','idx_inquiries_production_created','idx_inquiries_source_created','idx_inquiries_version','idx_inquiries_terminal_history','idx_inquiries_open_attention','idx_inquiries_delivered_history','idx_inquiries_post_sale_pending','idx_inquiries_event_agenda','idx_inquiries_follow_up_agenda','idx_inquiries_repurchase_event','idx_inquiries_repurchase_contact','idx_inquiries_anonymized_at','idx_inquiries_privacy_email','idx_inquiries_privacy_whatsapp','idx_privacy_requests_applied','idx_offsite_backup_receipts_verified','idx_recovery_drill_receipts_succeeded','idx_media_backup_receipts_verified','idx_media_recovery_drill_receipts_succeeded','idx_media_deletion_tombstones_deleted_at','idx_media_deletion_tombstones_pending','idx_media_lifecycle_leases_expires_at'];
  const indexRows=await rows(`SELECT indexname FROM pg_indexes WHERE schemaname='public' AND indexname = ANY($1::text[])`,[requiredIndexes]);
  const indexes=new Set(indexRows.map(r=>String(r.indexname)));for(const index of requiredIndexes)if(!indexes.has(index))errors.push(`Índice ausente: ${index}`);
  const constraintRows=await rows(`SELECT conname FROM pg_constraint WHERE conname = ANY($1::text[])`,[['media_deletion_tombstones_last_operation_check','media_deletion_tombstones_attempt_count_check']]);
  const constraints=new Set(constraintRows.map(r=>String(r.conname)));for(const name of ['media_deletion_tombstones_last_operation_check','media_deletion_tombstones_attempt_count_check'])if(!constraints.has(name))errors.push(`Constraint ausente: ${name}`);
  const requiredTriggers=['admin_audit_append_only','admin_audit_chain_before_insert','admin_audit_chain_after_insert','marketing_campaign_slug_immutable','trg_inquiries_version_monotonic','trg_inquiries_commercial_guard','offsite_backup_receipts_append_only','recovery_drill_receipts_append_only','media_backup_receipts_append_only','media_recovery_drill_receipts_append_only','trg_products_media_tombstone_guard','trg_categories_media_tombstone_guard','trg_site_settings_media_tombstone_guard'];
  const triggerRows=await rows(`SELECT tgname FROM pg_trigger WHERE tgname = ANY($1::text[]) AND NOT tgisinternal`,[requiredTriggers]);
  const triggers=new Set(triggerRows.map(r=>String(r.tgname)));for(const trigger of requiredTriggers)if(!triggers.has(trigger))errors.push(`Trigger ausente: ${trigger}`);

  if(!errors.length){
    const orphan=await rows(`SELECT COUNT(*)::int n FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.category_id IS NULL OR c.id IS NULL`);
    if(Number(orphan[0]?.n||0)>0)errors.push(`${orphan[0].n} produto(s) sem category_id válido.`);
    const mismatch=await rows(`SELECT COUNT(*)::int n FROM products p JOIN categories c ON c.id=p.category_id WHERE p.category IS DISTINCT FROM c.name`);
    if(Number(mismatch[0]?.n||0)>0)errors.push(`${mismatch[0].n} produto(s) com categoria textual dessincronizada.`);
    const invalidWindows=await rows(`SELECT COUNT(*)::int n FROM products WHERE publish_at IS NOT NULL AND unpublish_at IS NOT NULL AND unpublish_at<=publish_at`);
    if(Number(invalidWindows[0]?.n||0)>0)errors.push(`${invalidWindows[0].n} produto(s) com janela de publicação inválida.`);
    const invalidCustom=await rows(`SELECT COUNT(*)::int n FROM products WHERE customization_fields IS NULL OR jsonb_typeof(customization_fields)<>'array'`);
    if(Number(invalidCustom[0]?.n||0)>0)errors.push(`${invalidCustom[0].n} produto(s) com customization_fields inválido.`);
    const invalidVersion=await rows(`SELECT COUNT(*)::int n FROM inquiries WHERE version IS NULL OR version<1`);
    if(Number(invalidVersion[0]?.n||0)>0)errors.push(`${invalidVersion[0].n} atendimento(s) com version inválida.`);
    const invalidPrivacy=await rows(`SELECT COUNT(*)::int n FROM inquiries WHERE anonymized_at IS NOT NULL AND (name<>'Cliente anonimizado' OR whatsapp<>'' OR email IS NOT NULL OR event_date IS NOT NULL OR message<>'' OR admin_notes<>'' OR follow_up_at IS NOT NULL OR event_brief<>'{}'::jsonb OR idempotency_key IS NOT NULL OR production_due_at IS NOT NULL OR review_requested_at IS NOT NULL OR repurchase_contacted_at IS NOT NULL OR repurchase_contact_year IS NOT NULL)`);
    if(Number(invalidPrivacy[0]?.n||0)>0)errors.push(`${invalidPrivacy[0].n} atendimento(s) marcado(s) como anonimizado(s) ainda contêm dados pessoais.`);
    const invalidCommercial=await rows(`SELECT COUNT(*)::int n FROM inquiries WHERE (payment_status='pendente' AND COALESCE(paid_cents,0)<>0) OR (payment_status='sinal' AND (COALESCE(quoted_value_cents,0)<=0 OR COALESCE(paid_cents,0)<=0 OR paid_cents>=quoted_value_cents)) OR (payment_status='pago' AND (COALESCE(quoted_value_cents,0)<=0 OR COALESCE(paid_cents,0)<quoted_value_cents)) OR (COALESCE(production_status,'nao_iniciado')<>'nao_iniciado' AND status<>'fechado')`);
    if(Number(invalidCommercial[0]?.n||0)>0)errors.push(`${invalidCommercial[0].n} atendimento(s) com estado comercial incoerente.`);
    const tombstonedRefs=await rows(`SELECT COUNT(*)::int n FROM media_deletion_tombstones t WHERE EXISTS(SELECT 1 FROM products p CROSS JOIN LATERAL unnest(p.image_urls) media_url WHERE media_url=t.url OR marques_media_key_from_url(media_url)=t.storage_key) OR EXISTS(SELECT 1 FROM categories c WHERE c.image_url=t.url OR marques_media_key_from_url(c.image_url)=t.storage_key) OR EXISTS(SELECT 1 FROM site_settings st WHERE st.logo_url=t.url OR st.hero_image_url=t.url OR marques_media_key_from_url(st.logo_url)=t.storage_key OR marques_media_key_from_url(st.hero_image_url)=t.storage_key)`);
    if(Number(tombstonedRefs[0]?.n||0)>0)errors.push(`${tombstonedRefs[0].n} mídia(s) tombstonada(s) ainda referenciada(s).`);
    const stuckMedia=await rows(`SELECT COUNT(*)::int n FROM media_deletion_tombstones WHERE storage_deleted_at IS NULL AND last_attempt_at IS NOT NULL AND (last_error_code<>'' OR last_attempt_at<now()-interval '15 minutes')`);
    if(Number(stuckMedia[0]?.n||0)>0)errors.push(`${stuckMedia[0].n} operação(ões) de mídia pendentes/falhas exigem retry.`);
    const expiredLeases=await rows(`SELECT COUNT(*)::int n FROM media_lifecycle_leases WHERE expires_at<=now()`);
    if(Number(expiredLeases[0]?.n||0)>0)errors.push(`${expiredLeases[0].n} lease(s) de mídia expirada(s) exigem reconciliação antes de restore.`);
    const auditChain=await rows(`WITH ordered AS (SELECT a.*,lag(integrity_hash) OVER(ORDER BY id) expected_prev FROM admin_audit_log a),checked AS (SELECT *,marques_admin_audit_hash(prev_integrity_hash,id,action,entity_type,entity_id,summary,metadata,severity,request_id,actor_session_id,actor_device_hash,auth_method,created_at) expected_hash FROM ordered) SELECT COUNT(*) FILTER (WHERE chain_version<>1 OR prev_integrity_hash IS DISTINCT FROM COALESCE(expected_prev,'') OR integrity_hash IS DISTINCT FROM expected_hash)::int broken FROM checked`);
    if(Number(auditChain[0]?.broken||0)>0)errors.push(`${auditChain[0].broken} registro(s) com cadeia de auditoria inválida.`);
    const auditAnchor=await rows(`SELECT s.last_audit_id::text state_id,s.last_hash state_hash,COALESCE((SELECT id::text FROM admin_audit_log ORDER BY id DESC LIMIT 1),'') last_id,COALESCE((SELECT integrity_hash FROM admin_audit_log ORDER BY id DESC LIMIT 1),'') last_hash FROM admin_audit_chain_state s WHERE singleton=1`);
    if(!auditAnchor[0]||String(auditAnchor[0].state_id||'')!==String(auditAnchor[0].last_id||'')||String(auditAnchor[0].state_hash||'')!==String(auditAnchor[0].last_hash||''))errors.push('Âncora da cadeia de auditoria divergente do último registro.');
  }
  return {ok:errors.length===0,errors,tables:[...tables]};
}
