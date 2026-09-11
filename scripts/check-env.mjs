const production=process.argv.includes('--production')||process.argv.includes('--strict');
const errors=[];const warnings=[];
const sessionSecret=process.env.SESSION_SECRET||'';
const adminHash=process.env.ADMIN_PASSWORD_HASH||'';
const privacyHashSecret=process.env.PRIVACY_HASH_SECRET||'';
const backupSigningSecret=(process.env.BACKUP_SIGNING_SECRET||'').trim();
const backupSigningPreviousSecret=(process.env.BACKUP_SIGNING_PREVIOUS_SECRET||'').trim();
const backupSigningKeyId=(process.env.BACKUP_SIGNING_KEY_ID||'primary').trim();
const backupEncryptionSecret=(process.env.BACKUP_ENCRYPTION_SECRET||'').trim();
const backupEncryptionPreviousSecret=(process.env.BACKUP_ENCRYPTION_PREVIOUS_SECRET||'').trim();
const backupEncryptionKeyId=(process.env.BACKUP_ENCRYPTION_KEY_ID||'primary').trim();
const adminPlain=process.env.ADMIN_PASSWORD||'';
const adminTotp=(process.env.ADMIN_TOTP_SECRET||'').toUpperCase().replace(/[\s-]+/g,'').replace(/=+$/,'');
const securityWebhookUrl=(process.env.ADMIN_SECURITY_WEBHOOK_URL||'').trim();
const securityWebhookSecret=(process.env.ADMIN_SECURITY_WEBHOOK_SECRET||'').trim();
const backupOffsiteEnabled=String(process.env.BACKUP_OFFSITE_ENABLED||'').trim()==='1';
const mediaBackupMaxAgeRaw=String(process.env.MEDIA_BACKUP_MAX_AGE_HOURS||'36').trim();const mediaBackupMaxAge=Number(mediaBackupMaxAgeRaw);if(!Number.isInteger(mediaBackupMaxAge)||mediaBackupMaxAge<24||mediaBackupMaxAge>720)errors.push('MEDIA_BACKUP_MAX_AGE_HOURS deve ser inteiro entre 24 e 720');
const recoveryDrillMaxAgeRaw=String(process.env.RECOVERY_DRILL_MAX_AGE_HOURS||'192').trim();const recoveryDrillMaxAge=Number(recoveryDrillMaxAgeRaw);if(!Number.isInteger(recoveryDrillMaxAge)||recoveryDrillMaxAge<48||recoveryDrillMaxAge>720)errors.push('RECOVERY_DRILL_MAX_AGE_HOURS deve ser inteiro entre 48 e 720');
const backupMaxAgeRaw=String(process.env.BACKUP_OFFSITE_MAX_AGE_HOURS||'36').trim();const backupMaxAge=Number(backupMaxAgeRaw);if(!Number.isInteger(backupMaxAge)||backupMaxAge<24||backupMaxAge>720)errors.push('BACKUP_OFFSITE_MAX_AGE_HOURS deve ser inteiro entre 24 e 720');
const backupOffsiteFlag=String(process.env.BACKUP_OFFSITE_ENABLED||'').trim();
const backupS3Endpoint=String(process.env.BACKUP_S3_ENDPOINT||'').trim();
const backupS3Bucket=String(process.env.BACKUP_S3_BUCKET||'').trim();
const backupS3AccessKey=String(process.env.BACKUP_S3_ACCESS_KEY_ID||'').trim();
const backupS3SecretKey=String(process.env.BACKUP_S3_SECRET_ACCESS_KEY||'').trim();
const backupS3Prefix=String(process.env.BACKUP_S3_PREFIX||'marques-backups').trim();
const backupS3RetentionRaw=String(process.env.BACKUP_OFFSITE_RETENTION_DAYS||'45').trim();
const backupS3ForcePathStyle=String(process.env.BACKUP_S3_FORCE_PATH_STYLE||'1').trim();
const backupStorageValues=[backupS3Endpoint,backupS3Bucket,backupS3AccessKey,backupS3SecretKey];
const backupStorageProvided=backupStorageValues.filter(Boolean).length;
const backupStorageComplete=backupStorageProvided===backupStorageValues.length;

const storageValues=[process.env.S3_ENDPOINT,process.env.S3_BUCKET,process.env.S3_ACCESS_KEY_ID,process.env.S3_SECRET_ACCESS_KEY,process.env.S3_PUBLIC_BASE_URL].map(value=>String(value||'').trim());
const storageProvided=storageValues.filter(Boolean).length;
const storageComplete=storageProvided===storageValues.length;
const storageRequired=process.env.S3_REQUIRED==='1';
const releaseId=String(process.env.APP_RELEASE_ID||'').trim();
const deployedAt=String(process.env.APP_DEPLOYED_AT||'').trim();

function isPrivateOrLocalHost(hostname){
  const host=String(hostname||'').toLowerCase().replace(/^\[|\]$/g,'');
  if(!host||host==='localhost'||host==='0.0.0.0'||host==='::1'||host.endsWith('.local'))return true;
  if(/^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host))return true;
  const m=host.match(/^172\.(\d{1,3})\./);if(m&&Number(m[1])>=16&&Number(m[1])<=31)return true;
  return false;
}

const mediaDrillEnabled=String(process.env.MEDIA_RECOVERY_DRILL_ENABLED||'').trim();
const mediaDrillMaxAge=Number(process.env.MEDIA_RECOVERY_DRILL_MAX_AGE_HOURS||192);
const drillS3Names=['DRILL_S3_ENDPOINT','DRILL_S3_BUCKET','DRILL_S3_ACCESS_KEY_ID','DRILL_S3_SECRET_ACCESS_KEY'];
const drillS3Provided=drillS3Names.filter(n=>String(process.env[n]||'').trim()).length;
const drillS3Complete=drillS3Provided===drillS3Names.length;
if(mediaDrillEnabled&&!['0','1'].includes(mediaDrillEnabled))errors.push('MEDIA_RECOVERY_DRILL_ENABLED deve ser 0, 1 ou vazio');
if(!Number.isInteger(mediaDrillMaxAge)||mediaDrillMaxAge<48||mediaDrillMaxAge>720)errors.push('MEDIA_RECOVERY_DRILL_MAX_AGE_HOURS deve ser inteiro entre 48 e 720');
if(drillS3Provided>0&&!drillS3Complete)errors.push('Configuração DRILL_S3 parcial: preencha endpoint, bucket e credenciais em conjunto');
if(mediaDrillEnabled==='1'&&!drillS3Complete)errors.push('MEDIA_RECOVERY_DRILL_ENABLED=1 exige configuração DRILL_S3 completa');
if(process.env.DRILL_S3_FORCE_PATH_STYLE&&!['0','1'].includes(process.env.DRILL_S3_FORCE_PATH_STYLE))errors.push('DRILL_S3_FORCE_PATH_STYLE deve ser 0 ou 1');

if(production){
  if(!adminHash)errors.push('ADMIN_PASSWORD_HASH (obrigatório em produção; não use senha em texto puro)');
  else if(!/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/i.test(adminHash))errors.push('ADMIN_PASSWORD_HASH Scrypt válido (gere com npm run admin:hash-password)');
  if(adminPlain)warnings.push('ADMIN_PASSWORD está definido em produção; remova-o após configurar ADMIN_PASSWORD_HASH');
  if(!adminTotp)errors.push('ADMIN_TOTP_SECRET (MFA/TOTP obrigatório em produção; gere com npm run admin:generate-mfa)');
  else if(!/^[A-Z2-7]{16,128}$/.test(adminTotp))errors.push('ADMIN_TOTP_SECRET Base32 válido (16 a 128 caracteres)');
}else if(!adminHash&&!adminPlain)errors.push('ADMIN_PASSWORD_HASH ou ADMIN_PASSWORD');
if(!sessionSecret)errors.push('SESSION_SECRET');
if(sessionSecret&&sessionSecret.length<32)errors.push('SESSION_SECRET com pelo menos 32 caracteres');
if(production&&privacyHashSecret.length<32)errors.push('PRIVACY_HASH_SECRET com pelo menos 32 caracteres e estável para preservar tombstones de privacidade');
if(production&&backupSigningSecret.length<32)errors.push('BACKUP_SIGNING_SECRET com pelo menos 32 caracteres para autenticar backups');
if(backupSigningPreviousSecret&&backupSigningPreviousSecret.length<32)errors.push('BACKUP_SIGNING_PREVIOUS_SECRET deve ter pelo menos 32 caracteres quando configurado');
if(backupSigningSecret&&backupSigningPreviousSecret&&backupSigningSecret===backupSigningPreviousSecret)errors.push('BACKUP_SIGNING_PREVIOUS_SECRET deve ser diferente da chave atual');
if(backupSigningKeyId&&!/^[A-Za-z0-9._:-]{1,64}$/.test(backupSigningKeyId))errors.push('BACKUP_SIGNING_KEY_ID inválido (1-64 caracteres seguros)');
if(production&&backupEncryptionSecret.length<32)errors.push('BACKUP_ENCRYPTION_SECRET com pelo menos 32 caracteres para proteger backups em repouso');
if(backupEncryptionPreviousSecret&&backupEncryptionPreviousSecret.length<32)errors.push('BACKUP_ENCRYPTION_PREVIOUS_SECRET deve ter pelo menos 32 caracteres quando configurado');
if(backupEncryptionSecret&&backupEncryptionPreviousSecret&&backupEncryptionSecret===backupEncryptionPreviousSecret)errors.push('BACKUP_ENCRYPTION_PREVIOUS_SECRET deve ser diferente da chave atual');
if(backupEncryptionKeyId&&!/^[A-Za-z0-9._:-]{1,64}$/.test(backupEncryptionKeyId))errors.push('BACKUP_ENCRYPTION_KEY_ID inválido (1-64 caracteres seguros)');
if(!production&&!privacyHashSecret)warnings.push('PRIVACY_HASH_SECRET ausente: ambiente local usará fallback; configure um segredo estável antes da produção');
if(!production&&!backupSigningSecret)warnings.push('BACKUP_SIGNING_SECRET ausente: backups locais não poderão ser assinados até configurar a chave');
if(!production&&!backupEncryptionSecret)warnings.push('BACKUP_ENCRYPTION_SECRET ausente: backups locais não poderão ser criptografados até configurar a chave');

if(backupOffsiteFlag&&!['0','1'].includes(backupOffsiteFlag))errors.push('BACKUP_OFFSITE_ENABLED deve ser 0, 1 ou vazio');
if(backupStorageProvided>0&&!backupStorageComplete)errors.push('Configuração de backup S3 parcial: preencha BACKUP_S3_ENDPOINT, BACKUP_S3_BUCKET, BACKUP_S3_ACCESS_KEY_ID e BACKUP_S3_SECRET_ACCESS_KEY em conjunto');
if(backupOffsiteEnabled&&!backupStorageComplete)errors.push('BACKUP_OFFSITE_ENABLED=1 exige configuração BACKUP_S3 completa');
if(backupS3ForcePathStyle&&!['0','1'].includes(backupS3ForcePathStyle))errors.push('BACKUP_S3_FORCE_PATH_STYLE deve ser 0 ou 1');
const backupRetention=Number(backupS3RetentionRaw);if(!Number.isInteger(backupRetention)||backupRetention<7||backupRetention>3650)errors.push('BACKUP_OFFSITE_RETENTION_DAYS deve ser inteiro entre 7 e 3650');
const normalizedBackupPrefix=backupS3Prefix.replace(/^\/+|\/+$/g,'');if(!normalizedBackupPrefix||normalizedBackupPrefix.length>120||!/^[A-Za-z0-9._\-/]+$/.test(normalizedBackupPrefix)||normalizedBackupPrefix.includes('..'))errors.push('BACKUP_S3_PREFIX inválido');
if(process.env.S3_REQUIRED&&!['0','1'].includes(process.env.S3_REQUIRED))errors.push('S3_REQUIRED deve ser 0, 1 ou vazio');
if(storageProvided>0&&!storageComplete)errors.push('Configuração S3 parcial: preencha S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY e S3_PUBLIC_BASE_URL em conjunto');
if(storageRequired&&!storageComplete)errors.push('S3_REQUIRED=1 exige configuração S3 completa');
if(releaseId&&!/^[A-Za-z0-9._:@/+\-]{1,80}$/.test(releaseId))errors.push('APP_RELEASE_ID inválido (1-80 caracteres seguros)');
if(deployedAt&&Number.isNaN(Date.parse(deployedAt)))errors.push('APP_DEPLOYED_AT deve ser data ISO-8601 válida');

if(production){
  if(!process.env.DATABASE_URL)errors.push('DATABASE_URL');
  if(process.env.MARQUES_CI_STATELESS_AUTH)errors.push('MARQUES_CI_STATELESS_AUTH deve permanecer vazio em produção');
  const rawSite=process.env.NEXT_PUBLIC_SITE_URL||'';
  try{
    const site=new URL(rawSite);
    if(site.protocol!=='https:'||site.username||site.password||site.pathname!=='/'||site.search||site.hash)throw new Error();
    if(['localhost','127.0.0.1','::1'].includes(site.hostname))throw new Error();
  }catch{errors.push('NEXT_PUBLIC_SITE_URL HTTPS válido, sem caminho/query e não-localhost');}
  if((process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||'').replace(/\D/g,'').length<10)errors.push('NEXT_PUBLIC_WHATSAPP_NUMBER válido');
  if(storageComplete){
    try{const endpoint=new URL(String(process.env.S3_ENDPOINT));if(endpoint.protocol!=='https:'||endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw new Error();}catch{errors.push('S3_ENDPOINT HTTPS válido, sem credenciais/query/fragmento em produção');}
    try{const publicBase=new URL(String(process.env.S3_PUBLIC_BASE_URL));if(publicBase.protocol!=='https:'||publicBase.username||publicBase.password||publicBase.search||publicBase.hash)throw new Error();}catch{errors.push('S3_PUBLIC_BASE_URL HTTPS válido, sem credenciais/query/fragmento em produção');}
  }
  if(backupStorageComplete){
    try{const offsite=new URL(backupS3Endpoint);if(offsite.protocol!=='https:'||offsite.username||offsite.password||isPrivateOrLocalHost(offsite.hostname))throw new Error();}catch{errors.push('BACKUP_S3_ENDPOINT deve ser HTTPS válido, sem credenciais e destino externo em produção');}
    if(storageComplete){
      try{const media=new URL(String(process.env.S3_ENDPOINT));const offsite=new URL(backupS3Endpoint);if(media.origin===offsite.origin&&String(process.env.S3_BUCKET||'').trim()===backupS3Bucket)errors.push('Backup offsite deve usar bucket separado do S3 público de mídia');}catch{}
    }
  }
  if(drillS3Complete){
    try{const drill=new URL(String(process.env.DRILL_S3_ENDPOINT));if(drill.protocol!=='https:'||drill.username||drill.password||isPrivateOrLocalHost(drill.hostname))throw new Error();}catch{errors.push('DRILL_S3_ENDPOINT deve ser HTTPS válido, sem credenciais e destino externo em produção');}
    try{const drill=new URL(String(process.env.DRILL_S3_ENDPOINT));if(storageComplete){const media=new URL(String(process.env.S3_ENDPOINT));if(media.origin===drill.origin&&String(process.env.S3_BUCKET||'').trim()===String(process.env.DRILL_S3_BUCKET||'').trim())errors.push('DRILL_S3 deve usar bucket separado do S3 público de mídia');}if(backupStorageComplete){const vault=new URL(backupS3Endpoint);if(vault.origin===drill.origin&&backupS3Bucket===String(process.env.DRILL_S3_BUCKET||'').trim())errors.push('DRILL_S3 deve usar bucket separado do cofre de backup');}}catch{}
  }
  if(!backupOffsiteEnabled)warnings.push('BACKUP_OFFSITE_ENABLED não está ativo; disaster recovery ainda depende de execução manual do job offsite');
  if(!releaseId)warnings.push('APP_RELEASE_ID não configurado; o deploy gate não conseguirá confirmar um release específico');
  if(securityWebhookUrl){
    try{const webhook=new URL(securityWebhookUrl);if(webhook.protocol!=='https:'||webhook.username||webhook.password||isPrivateOrLocalHost(webhook.hostname))throw new Error();}catch{errors.push('ADMIN_SECURITY_WEBHOOK_URL HTTPS válido e destino externo');}
    if(securityWebhookSecret.length<32)errors.push('ADMIN_SECURITY_WEBHOOK_SECRET com pelo menos 32 caracteres quando webhook estiver ativo');
  }
}
if(!process.env.DATABASE_URL)warnings.push('Neon não configurado: catálogo usa demonstração');
if(!storageComplete&&!storageRequired)warnings.push('Storage S3 opcional não configurado');
if(!backupStorageComplete)warnings.push('Backup S3 offsite opcional não configurado');
if(!securityWebhookUrl)warnings.push('Webhook externo de segurança opcional não configurado');
if(!production&&!adminHash&&adminPlain)warnings.push('ADMIN_PASSWORD funciona apenas como compatibilidade; ADMIN_PASSWORD_HASH Scrypt é recomendado');
if(errors.length){console.error(`Preflight ${production?'de produção':'básico'} falhou: ${errors.join(', ')}`);for(const w of warnings)console.warn(`Aviso: ${w}`);process.exit(1);}
console.log(`Preflight ${production?'de produção':'básico'}: OK`);for(const w of warnings)console.warn(`Aviso: ${w}`);
