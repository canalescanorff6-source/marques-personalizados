import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { safeErrorCode, timedProbe } from './health-policy';
import { assertManagedMediaKey, managedMediaKeyFromPublicUrl, managedMediaPublicUrl, normalizeStorageEndpoint, normalizeStoragePublicBase } from './storage-policy';

export function storageConfig(){
  const rawEndpoint=String(process.env.S3_ENDPOINT||'').trim();
  const bucket=String(process.env.S3_BUCKET||'').trim();
  const accessKeyId=String(process.env.S3_ACCESS_KEY_ID||'').trim();
  const secretAccessKey=String(process.env.S3_SECRET_ACCESS_KEY||'').trim();
  const rawPublicBase=String(process.env.S3_PUBLIC_BASE_URL||'').trim();
  const required=process.env.S3_REQUIRED==='1';
  const values=[rawEndpoint,bucket,accessKeyId,secretAccessKey,rawPublicBase];
  const provided=values.filter(Boolean).length;
  const complete=provided===values.length;
  const partial=provided>0&&!complete;
  let endpoint=rawEndpoint,publicBase=rawPublicBase,invalid=false,errorCode='';
  if(complete){
    try{
      const production=process.env.NODE_ENV==='production';
      endpoint=normalizeStorageEndpoint(rawEndpoint,{production});
      publicBase=normalizeStoragePublicBase(rawPublicBase,{production});
      if(!bucket||/[\u0000-\u001f\u007f]/.test(bucket))throw new Error('STORAGE_BUCKET_INVALID');
    }catch(error){invalid=true;errorCode=error instanceof Error?error.message:'STORAGE_CONFIG_INVALID';}
  }
  const configured=complete&&!invalid;
  return {endpoint,bucket,accessKeyId,secretAccessKey,publicBase,configured,partial,invalid,required,errorCode};
}

export function storageClient(){
  const c=storageConfig();if(!c.configured)return null;
  return new S3Client({region:'auto',endpoint:c.endpoint,forcePathStyle:true,credentials:{accessKeyId:c.accessKeyId,secretAccessKey:c.secretAccessKey}});
}

export function keyFromPublicUrl(url:string){const c=storageConfig();if(!c.configured)return null;return managedMediaKeyFromPublicUrl(c.publicBase,url);}

export async function listMedia(cursor?:string){
  const c=storageConfig(),client=storageClient();if(!client)return {configured:false,items:[],next:null};
  const res=await client.send(new ListObjectsV2Command({Bucket:c.bucket,Prefix:'catalog/',MaxKeys:80,ContinuationToken:cursor||undefined}));
  const items=[] as {key:string;url:string;size:number;updated_at:string}[];
  for(const item of res.Contents||[]){
    if(!item.Key)continue;
    try{const key=assertManagedMediaKey(item.Key);items.push({key,url:managedMediaPublicUrl(c.publicBase,key),size:item.Size||0,updated_at:item.LastModified?.toISOString()||''});}catch{}
  }
  return {configured:true,items,next:res.IsTruncated?res.NextContinuationToken||null:null};
}

function missingObjectError(error:unknown){const value=error&&typeof error==='object'?error as {name?:string;$metadata?:{httpStatusCode?:number}}:{};return value.$metadata?.httpStatusCode===404||value.name==='NotFound'||value.name==='NoSuchKey';}

export async function verifyMediaObject(key:string,expectedSha256:string,expectedBytes:number){
  const c=storageConfig(),client=storageClient();if(!client)throw new Error('MEDIA_STORAGE_UNAVAILABLE');const safeKey=assertManagedMediaKey(key);
  const head=await client.send(new HeadObjectCommand({Bucket:c.bucket,Key:safeKey}));
  const remoteSha=String(head.Metadata?.['content-sha256']||'').toLowerCase();
  if(Number(head.ContentLength)!==expectedBytes||remoteSha!==expectedSha256.toLowerCase())throw new Error('MEDIA_UPLOAD_ATTESTATION_FAILED');
  return true;
}

export async function deleteMedia(url:string){
  const c=storageConfig(),client=storageClient(),key=keyFromPublicUrl(url);
  if(!client||!key)throw new Error('MEDIA_URL_NOT_MANAGED');
  await client.send(new DeleteObjectCommand({Bucket:c.bucket,Key:key}));
  try{await client.send(new HeadObjectCommand({Bucket:c.bucket,Key:key}));throw new Error('MEDIA_DELETE_NOT_CONFIRMED');}
  catch(error){if(missingObjectError(error))return;throw error;}
}

export async function probeStorage(timeoutMs=2200){
  const c=storageConfig();
  if(c.partial)return{ok:false,state:'partial-config' as const,configured:false,required:c.required,latency_ms:0,error_code:'PARTIAL_CONFIG'};
  if(c.invalid)return{ok:false,state:'invalid' as const,configured:false,required:c.required,latency_ms:0,error_code:c.errorCode||'STORAGE_CONFIG_INVALID'};
  if(!c.configured)return{ok:!c.required,state:'not-configured' as const,configured:false,required:c.required,latency_ms:0};
  const client=storageClient();if(!client)return{ok:false,state:'unavailable' as const,configured:true,required:c.required,latency_ms:0,error_code:'CLIENT_UNAVAILABLE'};
  const result=await timedProbe(()=>client.send(new ListObjectsV2Command({Bucket:c.bucket,Prefix:'catalog/',MaxKeys:1})),timeoutMs);
  if(result.ok)return{ok:true,state:'ok' as const,configured:true,required:c.required,latency_ms:result.latency_ms};
  return{ok:false,state:result.timed_out?'timeout' as const:'unavailable' as const,configured:true,required:c.required,latency_ms:result.latency_ms,timed_out:result.timed_out,error_code:result.timed_out?'PROBE_TIMEOUT':safeErrorCode(result.error)};
}
