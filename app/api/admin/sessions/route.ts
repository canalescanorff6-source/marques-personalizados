import { clearAdminSession,currentAdminSession,hasRecentAdminReauthentication,isAdmin } from '@/lib/auth';
import { getAdminSessions,logAdminAction,revokeAdminSessionById,revokeOtherAdminSessions, requireCriticalAuditIntent } from '@/lib/db';
import { serverFailure } from '@/lib/observability';
import { recordAdminSecurityEventWithAlert } from '@/lib/admin-security-alerts';
import { isUuid,readJsonBody,sameOriginRequest } from '@/lib/security';
export async function GET(){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'private, no-store'}});
  try{
    const current=await currentAdminSession();if(!current)return Response.json({error:'Sessão inválida.'},{status:401,headers:{'cache-control':'private, no-store'}});
    if(current.store==='stateless')return Response.json({store:'stateless',current_session_id:null,sessions:[]},{headers:{'cache-control':'private, no-store'}});
    const sessions=await getAdminSessions();return Response.json({store:'database',current_session_id:current.sessionId,sessions},{headers:{'cache-control':'private, no-store'}});
  }catch(error){return await serverFailure('admin.sessions.list',error);}
}
export async function DELETE(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  try{
    const current=await currentAdminSession();if(!current)return Response.json({error:'Sessão inválida.'},{status:401});
    if(current.store==='stateless')return Response.json({error:'O controle de sessões exige o Neon configurado.'},{status:409});
    if(!(await hasRecentAdminReauthentication()))return Response.json({error:'Confirme novamente sua identidade para encerrar sessões.',reauth_required:true},{status:428});
    const body=await readJsonBody(request,4_000);const action=typeof body.action==='string'?body.action:'';
    if(action==='revoke_others'){
      await requireCriticalAuditIntent('revoke_other_sessions','auth',null,'Revogação das outras sessões administrativas autorizada.');
      const revoked=await revokeOtherAdminSessions(current.sessionHash);await logAdminAction('revoke_other_sessions','auth',null,`${revoked} outra(s) sessão(ões) administrativa(s) encerrada(s).`);await recordAdminSecurityEventWithAlert({eventType:'critical_action',severity:'warning',deviceHash:current.deviceHash||'',summary:`${revoked} outra(s) sessão(ões) administrativa(s) foram encerradas.`});return Response.json({ok:true,revoked});
    }
    const sessionId=typeof body.session_id==='string'?body.session_id:'';if(!isUuid(sessionId))return Response.json({error:'Sessão inválida.'},{status:400});
    const isCurrent=sessionId===current.sessionId;await requireCriticalAuditIntent('revoke_session','auth',sessionId,isCurrent?'Revogação da sessão administrativa atual autorizada.':'Revogação de sessão administrativa remota autorizada.');const revoked=await revokeAdminSessionById(sessionId);if(!revoked)return Response.json({error:'Sessão não encontrada ou já encerrada.'},{status:404});
    await logAdminAction('revoke_session','auth',sessionId,isCurrent?'Sessão administrativa atual encerrada.':'Sessão administrativa remota encerrada.');await recordAdminSecurityEventWithAlert({eventType:'critical_action',severity:'warning',deviceHash:current.deviceHash||'',summary:isCurrent?'Sessão administrativa atual encerrada.':'Uma sessão administrativa remota foi encerrada.'});
    if(isCurrent)await clearAdminSession();return Response.json({ok:true,revoked:1,logged_out:isCurrent});
  }catch(error){return await serverFailure('admin.sessions.revoke',error);}
}
