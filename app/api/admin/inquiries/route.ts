import { isAdmin } from '@/lib/auth';
import { getInquiryCommercialInsights, getInquiryCommercialSummary, getInquiryCustomerStats, getInquiryHistoryPage, getInquiryMarketingStats } from '@/lib/db';
import { decodeInquiryHistoryCursor, encodeInquiryHistoryCursor } from '@/lib/crm-cursor';
import { serverFailure } from '@/lib/observability';

export const dynamic='force-dynamic';
export const revalidate=0;

export async function GET(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'private, no-store'}});
  const url=new URL(request.url);const view=url.searchParams.get('view')||'summary';
  try{
    if(view==='summary')return Response.json({summary:await getInquiryCommercialSummary()},{headers:{'cache-control':'private, no-store'}});
    if(view==='insights'){
      const requested=Number(url.searchParams.get('days')||30);const days=([7,30,90] as const).includes(requested as 7|30|90)?requested:30;
      return Response.json({insights:await getInquiryCommercialInsights(days),days},{headers:{'cache-control':'private, no-store'}});
    }
    if(view==='marketing')return Response.json({marketing:await getInquiryMarketingStats()},{headers:{'cache-control':'private, no-store'}});
    if(view==='history'){
      const rawCursor=url.searchParams.get('cursor');const before=decodeInquiryHistoryCursor(rawCursor);if(rawCursor&&!before)return Response.json({error:'Cursor inválido.'},{status:400,headers:{'cache-control':'private, no-store'}});
      const requested=Number(url.searchParams.get('limit')||80);const limit=Number.isInteger(requested)?Math.min(200,Math.max(20,requested)):80;const page=await getInquiryHistoryPage(limit,before);const customer_stats=await getInquiryCustomerStats(page.items.map(row=>row.whatsapp));
      return Response.json({items:page.items,customer_stats,next_cursor:encodeInquiryHistoryCursor(page.next),has_more:page.has_more},{headers:{'cache-control':'private, no-store'}});
    }
    return Response.json({error:'Visualização inválida.'},{status:400,headers:{'cache-control':'private, no-store'}});
  }catch(error){return await serverFailure('admin.inquiries.list',error);}
}
