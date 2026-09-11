import { clearAdminMfaChallenge,hasValidAdminMfaChallenge,setAdminSession } from '@/lib/auth';
import { consumeAdminMfaStep,consumeAdminRecoveryCode,logAdminAction } from '@/lib/db';
import { getAdminMfaConfiguration,verifyAdminTotpCode } from '@/lib/mfa';
import { hashAdminRecoveryCode,isAdminRecoveryCode } from '@/lib/recovery-codes';
import { serverFailure } from '@/lib/observability';
import { protectedRateLimit,readJsonBody,sameOriginRequest } from '@/lib/security';

export async function POST(request:Request){
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  const rate=await protectedRateLimit(request,'admin-mfa',6,5*60_000);
  if(!rate.allowed){await logAdminAction('mfa_blocked','auth',null,'Tentativas de segundo fator limitadas.');return Response.json({error:'Muitas tentativas de código. Aguarde alguns minutos.'},{status:429});}
  const config=getAdminMfaConfiguration();
  if(!config.required||!config.valid)return Response.json({error:'MFA administrativo indisponível.'},{status:409});
  if(!(await hasValidAdminMfaChallenge()))return Response.json({error:'O desafio de segurança expirou. Digite sua senha novamente.'},{status:401});
  let body:Record<string,unknown>={};try{body=await readJsonBody(request,2_000);}catch{return Response.json({error:'Código inválido.'},{status:400});}
  const recoveryCode=typeof body.recovery_code==='string'?body.recovery_code.trim():'';
  const code=typeof body.code==='string'?body.code.trim():'';
  try{
    if(recoveryCode){
      if(!process.env.DATABASE_URL)return Response.json({error:'Códigos de recuperação exigem o Neon configurado.'},{status:503});
      if(!isAdminRecoveryCode(recoveryCode))return Response.json({error:'Código de recuperação inválido ou já utilizado.'},{status:401});
      const fresh=await consumeAdminRecoveryCode(hashAdminRecoveryCode(recoveryCode));
      if(!fresh)return Response.json({error:'Código de recuperação inválido ou já utilizado.'},{status:401});
      await setAdminSession(request,{mfaVerified:true,authMethod:'recovery'});
      await clearAdminMfaChallenge();
      await logAdminAction('login_recovery_code','auth',null,'Entrada no painel administrativo validada com código de recuperação de uso único.');
      return Response.json({ok:true,method:'recovery'});
    }
    const step=verifyAdminTotpCode(code);if(step===null)return Response.json({error:'Código inválido ou expirado.'},{status:401});
    if(process.env.DATABASE_URL){const fresh=await consumeAdminMfaStep(step);if(!fresh)return Response.json({error:'Este código já foi utilizado. Aguarde o próximo código do autenticador.'},{status:409});}
    else if(process.env.NODE_ENV==='production'&&!(process.env.GITHUB_ACTIONS==='true'&&process.env.MARQUES_CI_STATELESS_AUTH==='1'))return Response.json({error:'MFA exige o Neon configurado em produção.'},{status:503});
    await setAdminSession(request,{mfaVerified:true,authMethod:'totp'});
    await clearAdminMfaChallenge();
    await logAdminAction('login_mfa','auth',null,'Entrada no painel administrativo validada com TOTP.');
    return Response.json({ok:true,method:'totp'});
  }catch(error){return await serverFailure('admin.mfa.verify',error,503,'Não foi possível concluir a autenticação em duas etapas.');}
}
