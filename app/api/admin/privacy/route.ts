import { hasRecentAdminReauthentication,isAdmin } from '@/lib/auth';
import { anonymizePrivacySubject,exportPrivacySubject,logAdminAction,lookupPrivacySubject, requireCriticalAuditIntent } from '@/lib/db';
import { recordAdminSecurityEventWithAlert } from '@/lib/admin-security-alerts';
import { serverFailure } from '@/lib/observability';
import { protectedRateLimit,readJsonBody,sameOriginRequest } from '@/lib/security';
import type { PrivacyIdentityType } from '@/lib/privacy';

export const dynamic='force-dynamic';
export const revalidate=0;
const noStore={'cache-control':'private, no-store'};
function identityType(value:unknown):PrivacyIdentityType|null{return value==='phone'||value==='email'?value:null;}
function privacyError(error:unknown){const text=error instanceof Error?error.message:String(error);if(text==='PRIVACY_IDENTITY_INVALID')return{status:400,error:'Informe um WhatsApp ou e-mail válido para a busca exata.'};const active=text.match(/PRIVACY_ACTIVE_INQUIRIES:(\d+)/);if(active)return{status:409,error:`A anonimização foi bloqueada porque ${active[1]} atendimento(s) ainda exigem ação. Finalize ou encerre esses atendimentos antes de apagar os dados pessoais.`};return null;}

export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:noStore});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403,headers:noStore});
  let body:Record<string,unknown>;try{body=await readJsonBody(request,24_000);}catch{return Response.json({error:'Dados inválidos.'},{status:400,headers:noStore});}
  const action=typeof body.action==='string'?body.action:'';const type=identityType(body.identity_type);const value=typeof body.value==='string'?body.value.trim().slice(0,320):'';
  if(!type||!value)return Response.json({error:'Identificador de privacidade inválido.'},{status:400,headers:noStore});
  try{
    if(action==='lookup'){
      const rate=await protectedRateLimit(request,'admin-privacy-lookup',90,10*60_000);if(!rate.allowed)return Response.json({error:'Muitas consultas de privacidade. Aguarde alguns minutos.'},{status:429,headers:noStore});
      return Response.json({result:await lookupPrivacySubject(type,value)},{headers:noStore});
    }
    if(action==='export'){
      if(!(await hasRecentAdminReauthentication()))return Response.json({error:'Confirme novamente sua identidade antes de exportar dados pessoais.',reauth_required:true},{status:428,headers:noStore});
      const rate=await protectedRateLimit(request,'admin-privacy-export',20,30*60_000);if(!rate.allowed)return Response.json({error:'Limite de exportações de privacidade atingido. Aguarde antes de tentar novamente.'},{status:429,headers:noStore});
      await requireCriticalAuditIntent('privacy_export','privacy_subject',null,'Exportação individual de dados pessoais autorizada após step-up MFA.',{identity_type:type});const data=await exportPrivacySubject(type,value);await logAdminAction('privacy_export','privacy_subject',null,`Exportação individual de dados preparada (${data.inquiries.length} atendimento(s)).`,{severity:'warning',metadata:{identity_type:type,records:data.inquiries.length,activity:data.activity.length}});return Response.json({data},{headers:noStore});
    }
    if(action==='anonymize'){
      if(!(await hasRecentAdminReauthentication()))return Response.json({error:'Confirme novamente sua identidade antes de anonimizar dados pessoais.',reauth_required:true},{status:428,headers:noStore});
      if(body.confirmation!=='ANONIMIZAR')return Response.json({error:'Confirmação inválida. Digite ANONIMIZAR.'},{status:400,headers:noStore});
      const rate=await protectedRateLimit(request,'admin-privacy-anonymize',8,60*60_000);if(!rate.allowed)return Response.json({error:'Limite de anonimizações atingido. Aguarde antes de tentar novamente.'},{status:429,headers:noStore});
      await requireCriticalAuditIntent('privacy_anonymize','privacy_subject',null,'Anonimização de dados pessoais autorizada após step-up MFA.',{identity_type:type});const result=await anonymizePrivacySubject(type,value);await logAdminAction('privacy_anonymize','privacy_subject',null,`Dados pessoais anonimizados em ${result.anonymized} atendimento(s).`,{severity:'critical',metadata:{identity_type:type,records:result.anonymized,activity_deleted:result.activity_deleted,snapshots_deleted:result.snapshots_deleted}});await recordAdminSecurityEventWithAlert({eventType:'critical_action',severity:'critical',summary:`Anonimização de dados pessoais executada em ${result.anonymized} atendimento(s).`});return Response.json({ok:true,result,external_backups_warning:'Backups JSON já exportados anteriormente ficam fora do alcance do aplicativo e precisam seguir a política de retenção/eliminação do negócio.'},{headers:noStore});
    }
    return Response.json({error:'Ação inválida.'},{status:400,headers:noStore});
  }catch(error){const known=privacyError(error);if(known)return Response.json({error:known.error},{status:known.status,headers:noStore});return await serverFailure('admin.privacy',error,503,'Não foi possível concluir a operação de privacidade.');}
}
