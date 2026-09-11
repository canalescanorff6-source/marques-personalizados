import { clearAdminSession,currentAdminSession,hasRecentAdminReauthentication,isAdmin } from '@/lib/auth';
import { acknowledgeAdminSecurityEvents,consumeAdminMfaStep,getAdminKnownDevices,getAdminRecoveryCodeStatus,getAdminSecurityEvents,logAdminAction,replaceAdminRecoveryCodes,revokeAdminKnownDeviceById, requireCriticalAuditIntent } from '@/lib/db';
import { verifyAdminTotpCode } from '@/lib/mfa';
import { generateAdminRecoveryCodes,hashAdminRecoveryCode } from '@/lib/recovery-codes';
import { serverFailure } from '@/lib/observability';
import { getAdminSecurityWebhookStatus,recordAdminSecurityEventWithAlert } from '@/lib/admin-security-alerts';
import { isUuid,protectedRateLimit,readJsonBody,sameOriginRequest } from '@/lib/security';

export async function GET(){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'private, no-store'}});
  try{
    const current=await currentAdminSession();if(!current)return Response.json({error:'Sessão inválida.'},{status:401,headers:{'cache-control':'private, no-store'}});
    if(current.store==='stateless')return Response.json({store:'stateless',recovery:{configured:false,total:0,remaining:0},devices:[],events:[],unread_count:0,current_device_hash:'',webhook:getAdminSecurityWebhookStatus()},{headers:{'cache-control':'private, no-store'}});
    const [recovery,devices,events]=await Promise.all([getAdminRecoveryCodeStatus(),getAdminKnownDevices(),getAdminSecurityEvents(40)]);
    return Response.json({store:'database',recovery,devices,events,unread_count:events.filter(event=>!event.acknowledged_at).length,current_device_hash:current.deviceHash||'',webhook:getAdminSecurityWebhookStatus()},{headers:{'cache-control':'private, no-store'}});
  }catch(error){return await serverFailure('admin.security.overview',error);}
}

export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  try{
    const current=await currentAdminSession();if(!current)return Response.json({error:'Sessão inválida.'},{status:401});
    if(current.store==='stateless')return Response.json({error:'A central de segurança exige o Neon configurado.'},{status:409});
    const body=await readJsonBody(request,8_000);const action=typeof body.action==='string'?body.action:'';
    if(action==='acknowledge_events'){
      const ids=Array.isArray(body.ids)?body.ids.filter((value):value is number=>typeof value==='number'):[];
      const acknowledged=await acknowledgeAdminSecurityEvents(ids);return Response.json({ok:true,acknowledged});
    }
    if(action!=='rotate_recovery_codes')return Response.json({error:'Ação inválida.'},{status:400});
    const rate=await protectedRateLimit(request,'admin-recovery-rotate',4,10*60_000);if(!rate.allowed)return Response.json({error:'Muitas tentativas. Aguarde alguns minutos.'},{status:429});
    const code=typeof body.code==='string'?body.code.trim():'';const step=verifyAdminTotpCode(code);if(step===null)return Response.json({error:'Confirme com um código TOTP válido.'},{status:401});
    const fresh=await consumeAdminMfaStep(step);if(!fresh)return Response.json({error:'Este código TOTP já foi utilizado. Aguarde o próximo código.'},{status:409});
    await requireCriticalAuditIntent('rotate_recovery_codes','auth',null,'Rotação dos códigos de recuperação autorizada após TOTP novo.');
    const codes=generateAdminRecoveryCodes(10);const count=await replaceAdminRecoveryCodes(codes.map(hashAdminRecoveryCode));
    await recordAdminSecurityEventWithAlert({eventType:'recovery_codes_rotated',severity:'info',deviceHash:current.deviceHash||'',summary:`${count} códigos de recuperação foram gerados novamente.`});
    await logAdminAction('rotate_recovery_codes','auth',null,`${count} códigos de recuperação substituídos após revalidação TOTP.`);
    return Response.json({ok:true,codes,remaining:count},{headers:{'cache-control':'private, no-store'}});
  }catch(error){return await serverFailure('admin.security.update',error,503,'Não foi possível atualizar as proteções de segurança.');}
}

export async function DELETE(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  try{
    const current=await currentAdminSession();if(!current)return Response.json({error:'Sessão inválida.'},{status:401});
    if(current.store==='stateless')return Response.json({error:'O controle de dispositivos exige o Neon configurado.'},{status:409});
    if(!(await hasRecentAdminReauthentication()))return Response.json({error:'Confirme novamente sua identidade para remover um dispositivo.',reauth_required:true},{status:428});
    const body=await readJsonBody(request,4_000);const deviceId=typeof body.device_id==='string'?body.device_id:'';if(!isUuid(deviceId))return Response.json({error:'Dispositivo inválido.'},{status:400});
    await requireCriticalAuditIntent('revoke_known_device','auth',deviceId,'Remoção de dispositivo conhecido autorizada após step-up MFA.');
    const revoked=await revokeAdminKnownDeviceById(deviceId);if(!revoked)return Response.json({error:'Dispositivo não encontrado.'},{status:404});
    const isCurrent=Boolean(current.deviceHash&&current.deviceHash===revoked.deviceHash);
    await recordAdminSecurityEventWithAlert({eventType:'device_revoked',severity:'warning',deviceHash:revoked.deviceHash,deviceLabel:revoked.deviceLabel,summary:`Dispositivo removido da lista de confiança: ${revoked.deviceLabel}.`});
    await logAdminAction('revoke_known_device','auth',deviceId,isCurrent?'Dispositivo atual removido e sessões vinculadas encerradas.':'Dispositivo conhecido removido e sessões vinculadas encerradas.');
    if(isCurrent)await clearAdminSession();
    return Response.json({ok:true,logged_out:isCurrent});
  }catch(error){return await serverFailure('admin.security.device_revoke',error);}
}
