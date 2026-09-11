import { isAdmin } from '@/lib/auth';
import { getInquiryActivity } from '@/lib/db';
import { isUuid } from '@/lib/security';
import { serverFailure } from '@/lib/observability';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'no-store'}});
  const{id}=await params;if(!isUuid(id))return Response.json({error:'ID inválido.'},{status:400});
  try{return Response.json({activity:await getInquiryActivity(id,120)},{headers:{'cache-control':'private, no-store'}});}catch(error){return await serverFailure('admin.inquiries.activity',error);}
}
