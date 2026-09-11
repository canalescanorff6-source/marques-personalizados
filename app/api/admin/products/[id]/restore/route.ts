import { isAdmin } from '@/lib/auth';
import { logAdminAction, restoreProduct,StaleWriteError } from '@/lib/db';
import { serverFailure } from '@/lib/observability';
import { sameOriginRequest } from '@/lib/security';
import { expectedUpdatedAtFromRequest } from '@/lib/concurrency';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});const{id}=await params;if(!UUID.test(id))return Response.json({error:'ID inválido.'},{status:400});try{const expectedUpdatedAt=expectedUpdatedAtFromRequest(request);const product=await restoreProduct(id,expectedUpdatedAt);if(!product)return Response.json({error:'Produto arquivado não encontrado.'},{status:404});await logAdminAction('restore','product',id,`Produto restaurado como rascunho: ${product.name}`);return Response.json({product});}catch(e){if(e instanceof StaleWriteError)return Response.json({error:e.message},{status:409});return await serverFailure('admin.products.restore',e);}}
