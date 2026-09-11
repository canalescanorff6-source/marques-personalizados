import { isAdmin } from '@/lib/auth';
import { getAnalyticsSummary } from '@/lib/db';
import { serverFailure } from '@/lib/observability';

export const dynamic='force-dynamic';
export const revalidate=0;

export async function GET(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'private, no-store'}});
  const url=new URL(request.url);
  const requested=Number(url.searchParams.get('days')||30);
  const days=([7,30,90] as const).includes(requested as 7|30|90)?requested:30;
  try{
    const analytics=await getAnalyticsSummary(days);
    return Response.json({analytics,days},{headers:{'cache-control':'private, no-store'}});
  }catch(error){return await serverFailure('admin.analytics',error);}
}
