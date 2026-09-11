import { isAdmin } from '@/lib/auth';
import { getInquiryCustomerStats, searchInquiries } from '@/lib/db';
import { serverFailure } from '@/lib/observability';
import { protectedRateLimit, readJsonBody, sameOriginRequest } from '@/lib/security';

export const dynamic='force-dynamic';
export const revalidate=0;

export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'private, no-store'}});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403,headers:{'cache-control':'private, no-store'}});
  const limited=await protectedRateLimit(request,'admin-inquiry-query',120,60_000);if(!limited.allowed)return Response.json({error:'Muitas consultas em pouco tempo.'},{status:429,headers:{'cache-control':'private, no-store'}});
  let body:Record<string,unknown>;try{body=await readJsonBody(request,24_000);}catch{return Response.json({error:'Dados inválidos.'},{status:400,headers:{'cache-control':'private, no-store'}});}
  try{
    if(body.mode==='search'){
      const query=String(body.query||'').trim().slice(0,120);if(query.length<2)return Response.json({items:[],customer_stats:{}},{headers:{'cache-control':'private, no-store'}});
      const items=await searchInquiries(query,80);const customer_stats=await getInquiryCustomerStats(items.map(row=>row.whatsapp));return Response.json({items,customer_stats},{headers:{'cache-control':'private, no-store'}});
    }
    if(body.mode==='customer_stats'){
      const phones=Array.isArray(body.phones)?body.phones.slice(0,120).map(value=>String(value||'').slice(0,40)):[];const customer_stats=await getInquiryCustomerStats(phones);return Response.json({customer_stats},{headers:{'cache-control':'private, no-store'}});
    }
    return Response.json({error:'Consulta inválida.'},{status:400,headers:{'cache-control':'private, no-store'}});
  }catch(error){return await serverFailure('admin.inquiries.query',error);}
}
