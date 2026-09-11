import crypto from 'crypto';
import { hasRecentAdminReauthentication,isAdmin } from '@/lib/auth';
import { checkSchema,getBackupExportStrict,logAdminAction, requireCriticalAuditIntent } from '@/lib/db';
import { recordAdminSecurityEventWithAlert } from '@/lib/admin-security-alerts';
import { serverFailure } from '@/lib/observability';
import { createBackupSignature } from '@/lib/backup-signature';
import { encryptBackupText } from '@/lib/backup-encryption';

const MAX_BACKUP_BYTES=25*1024*1024;
const MAX_ENCRYPTED_BACKUP_BYTES=36*1024*1024;
export async function GET(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'private, no-store'}});
  if(!(await hasRecentAdminReauthentication()))return Response.json({error:'Confirme novamente sua identidade para acessar o backup.',reauth_required:true},{status:428,headers:{'cache-control':'private, no-store'}});
  const authorizeOnly=new URL(request.url).searchParams.get('authorize')==='1';if(authorizeOnly)return Response.json({ok:true},{headers:{'cache-control':'private, no-store'}});
  try{
    await requireCriticalAuditIntent('backup_export','system',null,'Início de exportação de backup administrativo após step-up MFA.');
    const schema=await checkSchema();if(!schema.configured||schema.version<11)throw new Error('BACKUP_SCHEMA_UNAVAILABLE');const mediaSafe=schema.version>=26;const content=await getBackupExportStrict({includeMediaTombstones:mediaSafe});
    const contentJson=JSON.stringify(content);const sha256=crypto.createHash('sha256').update(contentJson).digest('hex');
    const counts:Record<string,number>={};for(const [key,value] of Object.entries(content)){if(Array.isArray(value))counts[key]=value.length;}
    const createdAt=new Date().toISOString();const version=mediaSafe?9:8,backup_format=mediaSafe?'marques-catalog-v9':'marques-catalog-v8';const signature=createBackupSignature({version,backup_format,schema_version:schema.version,created_at:createdAt,content_sha256:sha256,counts});
    const payload={version,backup_format,schema_version:schema.version,created_at:createdAt,manifest:{algorithm:'sha256',content_sha256:sha256,counts,signature},...content};
    const encoded=JSON.stringify(payload,null,2);if(Buffer.byteLength(encoded,'utf8')>MAX_BACKUP_BYTES)return Response.json({error:'O backup interno excede 25 MB. Faça a exportação pelo terminal ou reduza o histórico antes de tentar novamente.'},{status:413,headers:{'cache-control':'private, no-store'}});
    const encrypted=encryptBackupText(encoded);if(Buffer.byteLength(encrypted,'utf8')>MAX_ENCRYPTED_BACKUP_BYTES)return Response.json({error:'O envelope criptografado excede o limite seguro de download pelo painel.'},{status:413,headers:{'cache-control':'private, no-store'}});
    await logAdminAction('backup','system',null,`Backup assinado e criptografado exportado (${sha256.slice(0,12)}…).`,{severity:'warning',metadata:{format:payload.backup_format,content_sha256:sha256,signature_key_id:signature.key_id,encryption:'aes-256-gcm',counts}});
    await recordAdminSecurityEventWithAlert({eventType:'critical_action',severity:'warning',summary:'Backup administrativo assinado e criptografado exportado.'});
    return new Response(encrypted,{headers:{'content-type':'application/json; charset=utf-8','content-disposition':`attachment; filename="marques-backup-v${payload.version}-${new Date().toISOString().slice(0,10)}.encrypted.json"`,'cache-control':'private, no-store','x-backup-sha256':sha256,'x-backup-authenticity':'hmac-sha256','x-backup-encryption':'aes-256-gcm'}});
  }catch(e){return await serverFailure('admin.backup',e);}
}
