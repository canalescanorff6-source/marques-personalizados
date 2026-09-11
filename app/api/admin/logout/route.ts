import { clearAdminSession,isAdmin } from '@/lib/auth';
import { logAdminAction } from '@/lib/db';
import { sameOriginRequest } from '@/lib/security';
import { serverFailure } from '@/lib/observability';
export async function POST(request:Request){
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  const authenticated=await isAdmin();if(authenticated)await logAdminAction('logout','auth',null,'Saída do painel administrativo.');
  try{await clearAdminSession();return Response.json({ok:true});}
  catch(error){return await serverFailure('admin.logout.revoke',error,503,'A sessão local foi encerrada, mas não foi possível confirmar a revogação no servidor.');}
}
