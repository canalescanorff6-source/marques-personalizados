import { isAdmin } from '@/lib/auth';
import { getInquiryReactivationWorkspace,logAdminAction,markInquiryReactivationContact } from '@/lib/db';
import { serverFailure } from '@/lib/observability';
import { isUuid,protectedRateLimit,readJsonBody,sameOriginRequest } from '@/lib/security';
import { decodeReactivationCursor,encodeReactivationCursor } from '@/lib/reactivation-cursor';

export const dynamic='force-dynamic';
export const revalidate=0;
const noStore={'cache-control':'private, no-store'};

export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:noStore});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403,headers:noStore});
  try{
    const body=await readJsonBody(request,8_000);const action=typeof body.action==='string'?body.action:'';
    if(action==='list'){
      const rate=await protectedRateLimit(request,'admin-reactivation-list',120,10*60_000);if(!rate.allowed)return Response.json({error:'Muitas consultas de reativação. Aguarde alguns minutos.'},{status:429,headers:noStore});
      const requested=Number(body.limit||120);const limit=Number.isInteger(requested)?Math.min(500,Math.max(20,requested)):120;const rawCursor=typeof body.cursor==='string'?body.cursor:null;const before=decodeReactivationCursor(rawCursor);if(rawCursor&&!before)return Response.json({error:'Cursor inválido.'},{status:400,headers:noStore});const workspace=await getInquiryReactivationWorkspace(limit,before);return Response.json({...workspace,next_cursor:encodeReactivationCursor(workspace.next)},{headers:noStore});
    }
    if(action==='mark'){
      const rate=await protectedRateLimit(request,'admin-reactivation-mark',80,10*60_000);if(!rate.allowed)return Response.json({error:'Muitos registros de reativação em pouco tempo.'},{status:429,headers:noStore});
      const id=String(body.id||'');const cycleYear=Number(body.cycle_year);if(!isUuid(id)||!Number.isInteger(cycleYear)||cycleYear<2000||cycleYear>2200)return Response.json({error:'Oportunidade de reativação inválida.'},{status:400,headers:noStore});
      const inquiry=await markInquiryReactivationContact(id,cycleYear);if(!inquiry)return Response.json({error:'Esta oportunidade já foi registrada, expirou ou mudou de ciclo.',conflict:true},{status:409,headers:noStore});
      await logAdminAction('reactivation_contact','inquiry',id,`Recontato anual registrado para o ciclo ${cycleYear}.`,{metadata:{cycle_year:cycleYear}});
      return Response.json({inquiry},{headers:noStore});
    }
    return Response.json({error:'Ação inválida.'},{status:400,headers:noStore});
  }catch(error){return await serverFailure('admin.inquiries.reactivation',error,503,'Não foi possível atualizar a fila de reativação.');}
}
