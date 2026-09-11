import { isAdmin } from '@/lib/auth';
import { bulkUpdateInquiries,InquiryCommercialStateError,logAdminAction,StaleWriteError,type InquiryVersionRef } from '@/lib/db';
import { isUuid,readJsonBody,sameOriginRequest } from '@/lib/security';
import { serverFailure } from '@/lib/observability';
const statuses=['novo','contatado','orcado','fechado','perdido'] as const;
export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  try{
    const body=await readJsonBody(request,32_000);const items:InquiryVersionRef[]=[];if(Array.isArray(body.items)){for(const raw of body.items){if(!raw||typeof raw!=='object'||Array.isArray(raw))continue;const row=raw as Record<string,unknown>;const id=String(row.id||''),version=Number(row.version);if(isUuid(id)&&Number.isInteger(version)&&version>0&&!items.some(item=>item.id===id))items.push({id,version});if(items.length>=100)break;}}if(!items.length)return Response.json({error:'Selecione ao menos um atendimento com versão válida.'},{status:400});
    let status:typeof statuses[number]|undefined;let followUpAt:string|null|undefined;let summary='';
    if(body.action==='status'&&typeof body.status==='string'&&statuses.includes(body.status as typeof statuses[number])){status=body.status as typeof statuses[number];summary=`Status alterado em lote para ${status}.`;}
    else if(body.action==='follow_up'){const days=Number(body.days);if(![1,3,7].includes(days))return Response.json({error:'Período de follow-up inválido.'},{status:400});const d=new Date();d.setDate(d.getDate()+days);d.setHours(10,0,0,0);followUpAt=d.toISOString();summary=`Follow-up em lote definido para ${d.toLocaleString('pt-BR')}.`;}
    else if(body.action==='clear_follow_up'){followUpAt=null;summary='Follow-up removido em lote.';}
    else return Response.json({error:'Ação em lote inválida.'},{status:400});
    const inquiries=await bulkUpdateInquiries(items,{status,follow_up_at:followUpAt},summary);
    await logAdminAction('bulk','inquiry',null,`${summary} ${inquiries.length} atendimento(s).`,{metadata:{all_or_none:true,versions:items.length}});return Response.json({inquiries,updated:inquiries.length,atomic:true});
  }catch(error){if(error instanceof StaleWriteError)return Response.json({error:'A ação em lote foi cancelada porque pelo menos um atendimento mudou em outra aba/dispositivo. Nenhum item foi alterado.',conflict:true},{status:409});if(error instanceof InquiryCommercialStateError)return Response.json({error:error.message,code:error.code},{status:422});return await serverFailure('admin.inquiries.bulk',error);}
}
