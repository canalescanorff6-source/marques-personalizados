import { hasRecentAdminReauthentication,isAdmin } from '@/lib/auth';
import { logAdminAction,StaleWriteError,updateSiteSettings, requireCriticalAuditIntent } from '@/lib/db';
import { settingsSchema } from '@/lib/validation';
import { readJsonBody,sameOriginRequest } from '@/lib/security';
import { serverFailure } from '@/lib/observability';
import { recordAdminSecurityEventWithAlert } from '@/lib/admin-security-alerts';
import { requireExpectedUpdatedAt } from '@/lib/concurrency';

export async function PATCH(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  if(!(await hasRecentAdminReauthentication()))return Response.json({error:'Confirme novamente sua identidade para alterar as configurações do site.',reauth_required:true},{status:428});
  try{
    const body=await readJsonBody(request,48_000);const expectedUpdatedAt=requireExpectedUpdatedAt(body.expected_updated_at);const parsed=settingsSchema.safeParse(body);if(!parsed.success)return Response.json({error:'Confira os campos das configurações.',details:parsed.error.flatten()},{status:400});
    await requireCriticalAuditIntent('settings_update','settings','1','Alteração crítica das configurações públicas autorizada após step-up MFA.');
    const settings=await updateSiteSettings(parsed.data,expectedUpdatedAt);
    await logAdminAction('update','settings','1','Configurações gerais do site atualizadas após confirmação reforçada.');
    await recordAdminSecurityEventWithAlert({eventType:'critical_action',severity:'warning',summary:'Configurações gerais, contatos ou identidade pública do site foram alterados.'});
    return Response.json({settings});
  }catch(e){if(e instanceof StaleWriteError)return Response.json({error:e.message},{status:409});if((e instanceof Error?e.message:'')==='PAYLOAD_TOO_LARGE')return Response.json({error:'As configurações excedem o limite permitido.'},{status:413});return await serverFailure('admin.settings.update',e);}
}
