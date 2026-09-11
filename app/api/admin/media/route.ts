import { hasRecentAdminReauthentication,isAdmin } from '@/lib/auth';
import { beginMediaDeletion,completeMediaDeletion,failMediaDeletion,getMediaDeletionTombstones,logAdminAction,requireCriticalAuditIntent } from '@/lib/db';
import { deleteMedia,keyFromPublicUrl,listMedia } from '@/lib/storage';
import { readJsonBody,sameOriginRequest } from '@/lib/security';
import { mediaLifecycleErrorCode,mediaLifecycleRetryAfterSeconds } from '@/lib/media-lifecycle';
import { serverFailure } from '@/lib/observability';
import { recordAdminSecurityEventWithAlert } from '@/lib/admin-security-alerts';
export async function GET(request:Request){if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});try{const cursor=new URL(request.url).searchParams.get('cursor')||undefined;const [page,tombstones]=await Promise.all([listMedia(cursor),getMediaDeletionTombstones()]);const blocked=new Set(tombstones.map(item=>item.storage_key));return Response.json({...page,items:page.items.map(item=>({...item,unavailable:blocked.has(item.key)}))},{headers:{'cache-control':'private, no-store'}});}catch(e){return await serverFailure('admin.media.list',e);}}
export async function DELETE(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  if(!(await hasRecentAdminReauthentication()))return Response.json({error:'Confirme novamente sua identidade para excluir mídia permanentemente.',reauth_required:true},{status:428});
  try{
    const body=await readJsonBody(request,8_000);const url=String(body.url||'');const storageKey=keyFromPublicUrl(url);if(!storageKey)return Response.json({error:'A URL não pertence ao namespace gerenciado da biblioteca de mídia.'},{status:400});
    await requireCriticalAuditIntent('delete_media','media',null,'Exclusão permanente de mídia autorizada após step-up MFA.',{url_hash:'redacted'});
    const lease=await beginMediaDeletion(url,storageKey);
    if(lease.state==='in_use')return Response.json({error:'Esta imagem ainda está sendo usada no site. Remova-a do produto/categoria/logo/hero antes.'},{status:409});
    if(lease.state==='busy')return Response.json({error:'Esta mídia já possui uma operação em andamento. Tente novamente em instantes.'},{status:409,headers:{'retry-after':String(mediaLifecycleRetryAfterSeconds(lease.expires_at))}});
    try{await deleteMedia(url);await completeMediaDeletion(url,storageKey,lease.token);}catch(error){await failMediaDeletion(url,storageKey,lease.token,mediaLifecycleErrorCode(error)).catch(()=>false);throw error;}
    await logAdminAction('delete','media',null,'Arquivo removido da biblioteca de mídia.',{metadata:{lifecycle:'lease-v1'}});
    await recordAdminSecurityEventWithAlert({eventType:'critical_action',severity:'warning',summary:'Arquivo removido permanentemente da biblioteca de mídia.'});
    return Response.json({ok:true});
  }catch(e){return await serverFailure('admin.media.delete',e);}
}
