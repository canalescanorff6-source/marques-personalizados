import { isAdmin } from '@/lib/auth';
import { getAdminAgenda } from '@/lib/db';
import { serverFailure } from '@/lib/observability';
import { isAdminAgendaDays } from '@/lib/agenda-window';

export const dynamic='force-dynamic';
export const revalidate=0;
const noStore={'cache-control':'private, no-store'};

export async function GET(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:noStore});
  const value=Number(new URL(request.url).searchParams.get('days')||60);
  if(!isAdminAgendaDays(value))return Response.json({error:'Período inválido.'},{status:400,headers:noStore});
  try{return Response.json(await getAdminAgenda(value),{headers:noStore});}
  catch(error){return await serverFailure('admin.agenda.list',error);}
}
