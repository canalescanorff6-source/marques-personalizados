import { setAdminMfaChallenge,setAdminSession,validateAdminPassword } from '@/lib/auth';
import { logAdminAction } from '@/lib/db';
import { getAdminMfaConfiguration } from '@/lib/mfa';
import { protectedRateLimit,readJsonBody,sameOriginRequest } from '@/lib/security';
import { serverFailure } from '@/lib/observability';

export async function POST(request:Request){
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  const rate=await protectedRateLimit(request,'admin-login',8,10*60_000);
  if(!rate.allowed){await logAdminAction('login_blocked','auth',null,'Tentativas de login limitadas.');return Response.json({error:'Muitas tentativas. Tente novamente em alguns minutos.'},{status:429});}
  let body:Record<string,unknown>={};try{body=await readJsonBody(request,4_000);}catch{return Response.json({error:'Dados inválidos.'},{status:400});}
  if(typeof body.password!=='string'||!validateAdminPassword(body.password))return Response.json({error:'Credenciais inválidas.'},{status:401});
  try{
    const mfa=getAdminMfaConfiguration();
    if(mfa.required){
      if(!mfa.valid)return Response.json({error:'MFA administrativo não está configurado corretamente.'},{status:503});
      await setAdminMfaChallenge();
      await logAdminAction('login_password_verified','auth',null,'Senha administrativa validada; aguardando segundo fator.');
      return Response.json({ok:true,mfa_required:true});
    }
    await setAdminSession(request,{mfaVerified:false});
    await logAdminAction('login','auth',null,'Entrada no painel administrativo sem MFA (ambiente não produtivo).');
    return Response.json({ok:true,mfa_required:false});
  }catch(error){return await serverFailure('admin.login.session',error,503,'Não foi possível iniciar a sessão administrativa.');}
}
