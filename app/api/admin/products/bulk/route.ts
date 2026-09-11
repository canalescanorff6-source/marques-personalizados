import { isAdmin } from '@/lib/auth';
import { bulkUpdateProducts, logAdminAction, ProductPublishReadinessError, StaleWriteError, type ProductBulkAction, type ProductVersionRef } from '@/lib/db';
import { isUuid, readJsonBody, sameOriginRequest } from '@/lib/security';
import { serverFailure } from '@/lib/observability';

const actions=new Set<ProductBulkAction>(['publish','hide','feature','unfeature','move_category']);
export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  try{
    const body=await readJsonBody(request,32_000);const rawItems=Array.isArray(body.items)?body.items:[];const items:ProductVersionRef[]=rawItems.slice(0,201).flatMap((item:unknown)=>{if(!item||typeof item!=='object'||Array.isArray(item))return[];const row=item as Record<string,unknown>;const id=typeof row.id==='string'?row.id:'';const updatedAt=typeof row.updated_at==='string'?row.updated_at:'';return isUuid(id)&&updatedAt&&!Number.isNaN(new Date(updatedAt).getTime())?[{id,updated_at:updatedAt}]:[];});const action=body.action as ProductBulkAction;
    const categoryId=typeof body.category_id==='string'&&isUuid(body.category_id)?body.category_id:undefined;const uniqueIds=new Set(items.map(item=>item.id));if(!rawItems.length||rawItems.length>200||items.length!==rawItems.length||uniqueIds.size!==items.length||!actions.has(action)||(action==='move_category'&&!categoryId))return Response.json({error:'Seleção, versão ou ação inválida.'},{status:400});
    const products=await bulkUpdateProducts(items,action,categoryId);await logAdminAction('bulk_update','product',null,`${products.length} produto(s): ${action}.`);return Response.json({products,count:products.length});
  }catch(e){if(e instanceof StaleWriteError)return Response.json({error:e.message,conflict:true,atomic:true},{status:409});if(e instanceof ProductPublishReadinessError)return Response.json({error:`Não foi possível publicar. Complete primeiro: ${e.blockers.join(', ')}${e.blockers.length>=20?'…':''}.`,blockers:e.blockers},{status:422});if((e instanceof Error?e.message:'')==='CATEGORY_NOT_FOUND')return Response.json({error:'Categoria de destino não encontrada ou inativa.'},{status:400});if((e instanceof Error?e.message:'')==='PAYLOAD_TOO_LARGE')return Response.json({error:'Seleção muito grande.'},{status:413});return await serverFailure('admin.products.bulk',e);}
}
