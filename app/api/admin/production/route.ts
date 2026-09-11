import { isAdmin } from '@/lib/auth';
import { getProductionDeliveredPage, getProductionSummary, getProductionWorkspace } from '@/lib/db';
import { decodeProductionCursor, encodeProductionCursor } from '@/lib/production-cursor';
import { serverFailure } from '@/lib/observability';

export const dynamic='force-dynamic';
export const revalidate=0;
const noStore={'cache-control':'private, no-store'};

export async function GET(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:noStore});
  const url=new URL(request.url);const view=url.searchParams.get('view')||'workspace';
  try{
    if(view==='summary')return Response.json({summary:await getProductionSummary()},{headers:noStore});
    const requested=Number(url.searchParams.get('limit')||60);const limit=Number.isInteger(requested)?Math.min(160,Math.max(20,requested)):60;
    if(view==='workspace'){
      const workspace=await getProductionWorkspace(limit);
      return Response.json({queue:workspace.queue,aftercare:workspace.aftercare,summary:workspace.summary,delivered:workspace.delivered.items,next_cursor:encodeProductionCursor(workspace.delivered.next),has_more:workspace.delivered.has_more},{headers:noStore});
    }
    if(view==='history'){
      const rawCursor=url.searchParams.get('cursor');const before=decodeProductionCursor(rawCursor);if(rawCursor&&!before)return Response.json({error:'Cursor inválido.'},{status:400,headers:noStore});
      const page=await getProductionDeliveredPage(limit,before);
      return Response.json({items:page.items,next_cursor:encodeProductionCursor(page.next),has_more:page.has_more},{headers:noStore});
    }
    return Response.json({error:'Visualização inválida.'},{status:400,headers:noStore});
  }catch(error){return await serverFailure('admin.production.list',error);}
}
