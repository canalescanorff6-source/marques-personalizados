import { hasRecentAdminReauthentication,isAdmin } from '@/lib/auth';
import { acknowledgeOperationalIncident,checkAdminAuditIntegrity,checkDataIntegrity,checkDatabase,checkSchema,getAdminAudit,getOffsiteBackupFreshness,getRecoveryDrillFreshness,getMediaBackupFreshness,getMediaRecoveryDrillFreshness,getOperationalIncidentSummary,getOperationalIncidents,logAdminAction,resolveOperationalIncident, requireCriticalAuditIntent } from '@/lib/db';
import { isUuid,readJsonBody,sameOriginRequest } from '@/lib/security';
import { serverFailure } from '@/lib/observability';
import { probeStorage } from '@/lib/storage';
import { getReleaseInfo } from '@/lib/release';

export const dynamic='force-dynamic';

export async function GET(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'private, no-store'}});
  try{
    const summaryOnly=new URL(request.url).searchParams.get('summary')==='1';
    const [database,schema,integrity,auditIntegrity,incidentSummary,storage,backupFreshness,recoveryDrill,mediaBackup,mediaRecoveryDrill]=await Promise.all([checkDatabase(),checkSchema(),checkDataIntegrity(),checkAdminAuditIntegrity(),getOperationalIncidentSummary(),probeStorage(2200),getOffsiteBackupFreshness(),getRecoveryDrillFreshness(),getMediaBackupFreshness(),getMediaRecoveryDrillFreshness()]);
    const release=getReleaseInfo();
    if(summaryOnly)return Response.json({database,schema,integrity,audit_integrity:auditIntegrity,storage,backup_freshness:backupFreshness,recovery_drill:recoveryDrill,media_backup:mediaBackup,media_recovery_drill:mediaRecoveryDrill,release,incident_summary:incidentSummary,generated_at:new Date().toISOString()},{headers:{'cache-control':'private, no-store'}});
    const [incidents,audit]=await Promise.all([getOperationalIncidents(80),getAdminAudit(120)]);
    return Response.json({database,schema,integrity,audit_integrity:auditIntegrity,storage,backup_freshness:backupFreshness,recovery_drill:recoveryDrill,media_backup:mediaBackup,media_recovery_drill:mediaRecoveryDrill,release,incidents,incident_summary:incidentSummary,audit,generated_at:new Date().toISOString()},{headers:{'cache-control':'private, no-store'}});
  }catch(error){return await serverFailure('admin.operations.list',error);}
}

export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  try{
    const body=await readJsonBody(request,8_000);
    const action=typeof body.action==='string'?body.action:'';
    const incidentId=typeof body.incident_id==='string'?body.incident_id:'';
    if(!isUuid(incidentId))return Response.json({error:'Incidente inválido.'},{status:400});
    if(action==='acknowledge_incident'){
      const ok=await acknowledgeOperationalIncident(incidentId);if(!ok)return Response.json({error:'Incidente não encontrado.'},{status:404});
      await logAdminAction('acknowledge','operational_incident',incidentId,'Incidente operacional revisado.',{severity:'info'});
      return Response.json({ok:true});
    }
    if(action==='resolve_incident'){
      if(!(await hasRecentAdminReauthentication()))return Response.json({error:'Confirme novamente sua identidade para marcar o incidente como resolvido.',reauth_required:true},{status:428});
      await requireCriticalAuditIntent('resolve_incident','operational_incident',incidentId,'Resolução de incidente operacional autorizada após step-up MFA.');const ok=await resolveOperationalIncident(incidentId);if(!ok)return Response.json({error:'Incidente não encontrado.'},{status:404});
      await logAdminAction('resolve','operational_incident',incidentId,'Incidente operacional marcado como resolvido após confirmação reforçada.',{severity:'warning'});
      return Response.json({ok:true});
    }
    return Response.json({error:'Ação inválida.'},{status:400});
  }catch(error){if((error instanceof Error?error.message:'')==='PAYLOAD_TOO_LARGE')return Response.json({error:'Payload excede o limite permitido.'},{status:413});return await serverFailure('admin.operations.action',error);}
}
