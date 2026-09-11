import { isAdmin } from '@/lib/auth';
import { logAdminAction,markInquiryReviewRequested } from '@/lib/db';
import { isUuid,sameOriginRequest } from '@/lib/security';
import { serverFailure } from '@/lib/observability';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});const{id}=await params;if(!isUuid(id))return Response.json({error:'ID inválido.'},{status:400});try{const inquiry=await markInquiryReviewRequested(id);if(!inquiry)return Response.json({error:'Atendimento não encontrado.'},{status:404});await logAdminAction('review_request','inquiry',id,'Pedido de avaliação aberto no WhatsApp.');return Response.json({inquiry});}catch(e){return await serverFailure('admin.inquiries.review',e);}}
