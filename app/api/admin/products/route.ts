import { isAdmin } from '@/lib/auth';
import { categoryExists, createProductIdempotent, logAdminAction } from '@/lib/db';
import { productSchema } from '@/lib/validation';
import { readJsonBody, sameOriginRequest } from '@/lib/security';
import { serverFailure } from '@/lib/observability';
import { idempotencyHttpError, requireAdminCreateIdempotencyKey } from '@/lib/idempotency';
import { productPublishIssues, publishIssuesMessage } from '@/lib/product-readiness';

export async function POST(request:Request){
  if(!(await isAdmin())) return Response.json({error:'Não autorizado.'},{status:401});
  if(!sameOriginRequest(request)) return Response.json({error:'Origem inválida.'},{status:403});
  try{
    const idempotencyKey=requireAdminCreateIdempotencyKey(request);const body=await readJsonBody(request,64_000);const parsed=productSchema.safeParse(body);
    if(!parsed.success) return Response.json({error:'Dados inválidos. Confira os campos do produto.',details:parsed.error.flatten()},{status:400});
    if(!(await categoryExists(parsed.data.category))) return Response.json({error:'Selecione uma categoria ativa e cadastrada.'},{status:400});
    const publishIssues=parsed.data.active?productPublishIssues(parsed.data):[];if(publishIssues.length)return Response.json({error:publishIssuesMessage(publishIssues),issues:publishIssues},{status:422});
    const {product,created}=await createProductIdempotent(parsed.data,idempotencyKey);if(created)await logAdminAction('create','product',product.id,`Produto criado: ${product.name}`,{requestId:idempotencyKey});return Response.json({product,deduplicated:!created},{status:created?201:200});
  }catch(e){const idem=idempotencyHttpError(e);if(idem)return Response.json({error:idem.message},{status:idem.status});const msg=(e instanceof Error?e.message:'');if(msg==='PAYLOAD_TOO_LARGE')return Response.json({error:'Os dados do produto excedem o limite permitido.'},{status:413});if(msg.toLowerCase().includes('unique')||msg.toLowerCase().includes('duplicate'))return Response.json({error:'Já existe um produto com esse slug.'},{status:409});return await serverFailure('admin.products.create',e);}
}
