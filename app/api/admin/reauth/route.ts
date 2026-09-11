import { currentAdminSession,isAdmin } from '@/lib/auth';
import { consumeAdminMfaStep,logAdminAction,markAdminSessionReauthenticated } from '@/lib/db';
import { recordAdminSecurityEventWithAlert } from '@/lib/admin-security-alerts';
import { verifyAdminTotpCode } from '@/lib/mfa';
import { serverFailure } from '@/lib/observability';
import { protectedRateLimit,readJsonBody,sameOriginRequest } from '@/lib/security';

const REAUTH_MAX_AGE_SECONDS=5*60;

export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'private, no-store'}});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  const rate=await protectedRateLimit(request,'admin-reauth',5,5*60_000);
  if(!rate.allowed)return Response.json({error:'Muitas tentativas de confirmação. Aguarde alguns minutos.'},{status:429});
  try{
    const current=await currentAdminSession();if(!current)return Response.json({error:'Sessão inválida.'},{status:401});
    if(current.store==='stateless')return Response.json({error:'A confirmação reforçada exige o Neon configurado.'},{status:409});
    const body=await readJsonBody(request,2_000);const code=typeof body.code==='string'?body.code.trim():'';
    const step=verifyAdminTotpCode(code);if(step===null)return Response.json({error:'Código TOTP inválido ou expirado.'},{status:401});
    const fresh=await consumeAdminMfaStep(step);if(!fresh)return Response.json({error:'Este código TOTP já foi utilizado. Aguarde o próximo código.'},{status:409});
    const updated=await markAdminSessionReauthenticated(current.sessionHash);if(!updated)return Response.json({error:'Sessão não encontrada ou expirada.'},{status:401});
    await logAdminAction('critical_reauth','auth',current.sessionId,'Confirmação TOTP reforçada para ações administrativas críticas.');
    await recordAdminSecurityEventWithAlert({eventType:'critical_reauth',severity:'info',deviceHash:current.deviceHash||'',summary:'Confirmação reforçada concluída para uma ação administrativa crítica.'});
    return Response.json({ok:true,expires_in:REAUTH_MAX_AGE_SECONDS},{headers:{'cache-control':'private, no-store'}});
  }catch(error){return await serverFailure('admin.reauth',error,503,'Não foi possível confirmar novamente sua identidade.');}
}
