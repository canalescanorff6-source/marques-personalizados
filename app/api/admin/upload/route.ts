import { PutObjectCommand } from '@aws-sdk/client-s3';
import { isAdmin } from '@/lib/auth';
import { beginMediaUpload,completeMediaUpload,failMediaUpload,logAdminAction } from '@/lib/db';
import { sameOriginRequest } from '@/lib/security';
import { isMultipartFormData,readMultipartFormDataWithinLimit } from '@/lib/request-limits';
import { storageClient,storageConfig,verifyMediaObject } from '@/lib/storage';
import { contentAddressedMediaKey } from '@/lib/media-key';
import { managedMediaPublicUrl } from '@/lib/storage-policy';
import { mediaLifecycleErrorCode,mediaLifecycleRetryAfterSeconds } from '@/lib/media-lifecycle';
import { serverFailure } from '@/lib/observability';
export const runtime='nodejs';
const MAX_FILE_BYTES=8*1024*1024;
const MAX_MULTIPART_BYTES=MAX_FILE_BYTES+512*1024;
function detectedType(buffer:Buffer){if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return'image/png';if(buffer.length>=3&&buffer[0]===0xff&&buffer[1]===0xd8&&buffer[2]===0xff)return'image/jpeg';if(buffer.length>=12&&buffer.toString('ascii',0,4)==='RIFF'&&buffer.toString('ascii',8,12)==='WEBP')return'image/webp';return'';}
export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  try{
    const c=storageConfig(),client=storageClient();if(!client||!c.configured)return Response.json({error:'Upload não configurado. Use uma URL de imagem ou configure o Storage.'},{status:503});
    if(!isMultipartFormData(request))return Response.json({error:'Envie a imagem como multipart/form-data.'},{status:415});
    const form=await readMultipartFormDataWithinLimit(request,MAX_MULTIPART_BYTES);const file=form.get('file');if(!(file instanceof File))return Response.json({error:'Arquivo ausente.'},{status:400});
    if(file.size>MAX_FILE_BYTES)return Response.json({error:'Imagem maior que 8 MB.'},{status:413});
    const buffer=Buffer.from(await file.arrayBuffer());const type=detectedType(buffer);if(!type)return Response.json({error:'O conteúdo do arquivo não é JPG, PNG ou WEBP válido.'},{status:400});
    const {digest,key}=contentAddressedMediaKey(buffer,type);const url=managedMediaPublicUrl(c.publicBase,key);const lease=await beginMediaUpload(url,key);
    if(lease.state==='busy')return Response.json({error:'Esta mídia já possui uma operação em andamento. Tente novamente em instantes.'},{status:409,headers:{'retry-after':String(mediaLifecycleRetryAfterSeconds(lease.expires_at))}});
    if(lease.state!=='acquired')return Response.json({error:'Não foi possível reservar esta mídia para upload.'},{status:409});
    try{
      await client.send(new PutObjectCommand({Bucket:c.bucket,Key:key,Body:buffer,ContentType:type,CacheControl:'public,max-age=31536000,immutable',Metadata:{'content-sha256':digest}}));
      await verifyMediaObject(key,digest,buffer.length);
      await completeMediaUpload(url,key,lease.token);
    }catch(error){await failMediaUpload(url,key,lease.token,mediaLifecycleErrorCode(error)).catch(()=>false);throw error;}
    await logAdminAction('upload','media',null,'Imagem disponibilizada na biblioteca.',{metadata:{sha256:digest,size_bytes:file.size,content_type:type,lifecycle:'lease-v1'}});
    return Response.json({url});
  }catch(e){const message=e instanceof Error?e.message:'';if(message==='PAYLOAD_TOO_LARGE')return Response.json({error:'A requisição de upload excede o limite permitido.'},{status:413});if(message==='INVALID_MULTIPART_BODY'||message==='INVALID_MULTIPART_CONTENT_TYPE')return Response.json({error:'O formulário de upload é inválido.'},{status:400});return await serverFailure('admin.upload',e);}
}
