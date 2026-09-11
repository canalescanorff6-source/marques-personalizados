import { isAdmin } from '@/lib/auth';
import { getArchivedProducts } from '@/lib/db';
import { serverFailure } from '@/lib/observability';
export async function GET(){if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});try{return Response.json({products:await getArchivedProducts()},{headers:{'cache-control':'private, no-store'}});}catch(e){return await serverFailure('admin.products.trash.list',e);}}
