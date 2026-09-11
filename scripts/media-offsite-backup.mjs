import crypto from 'node:crypto';
import {S3Client,ListObjectsV2Command,HeadObjectCommand,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3';
import {neon} from '@neondatabase/serverless';
import {mediaMirrorKey} from '../lib/media-dr.ts';
import {normalizeOffsitePrefix} from '../lib/offsite-backup.ts';
import {assertManagedMediaKey} from '../lib/storage-policy.ts';
import {assertDistinctStorageTargets,normalizeExternalDrEndpoint,normalizeStorageBucket,normalizeStorageTransportEndpoint} from '../lib/dr-storage-policy.ts';
function req(n){const v=String(process.env[n]||'').trim();if(!v)throw new Error(`${n} ausente`);return v;}
async function readBody(body,maxBytes=64*1024*1024){if(!body)throw new Error('Objeto S3 sem corpo');const chunks=[];let bytes=0;for await(const chunk of body){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=b.length;if(bytes>maxBytes)throw new Error(`Objeto de mídia excede ${maxBytes} bytes`);chunks.push(b);}return Buffer.concat(chunks);}
const sourceEndpoint=normalizeStorageTransportEndpoint(req('S3_ENDPOINT'),'S3_ENDPOINT'),sourceBucket=normalizeStorageBucket(req('S3_BUCKET'),'S3_BUCKET'),sourceAccess=req('S3_ACCESS_KEY_ID'),sourceSecret=req('S3_SECRET_ACCESS_KEY');
const destEndpoint=normalizeExternalDrEndpoint(req('BACKUP_S3_ENDPOINT'),'BACKUP_S3_ENDPOINT'),destBucket=normalizeStorageBucket(req('BACKUP_S3_BUCKET'),'BACKUP_S3_BUCKET'),destAccess=req('BACKUP_S3_ACCESS_KEY_ID'),destSecret=req('BACKUP_S3_SECRET_ACCESS_KEY'),databaseUrl=req('DATABASE_URL');
assertDistinctStorageTargets({endpoint:sourceEndpoint,bucket:sourceBucket},{endpoint:destEndpoint,bucket:destBucket},'MEDIA_BACKUP_TARGET');
const prefix=normalizeOffsitePrefix(process.env.BACKUP_S3_PREFIX);
const source=new S3Client({endpoint:sourceEndpoint,region:'auto',forcePathStyle:true,credentials:{accessKeyId:sourceAccess,secretAccessKey:sourceSecret}});
const dest=new S3Client({endpoint:destEndpoint,region:String(process.env.BACKUP_S3_REGION||'auto'),forcePathStyle:String(process.env.BACKUP_S3_FORCE_PATH_STYLE||'1')!=='0',credentials:{accessKeyId:destAccess,secretAccessKey:destSecret}});
let token;const objects=[];do{const page=await source.send(new ListObjectsV2Command({Bucket:sourceBucket,Prefix:'catalog/',ContinuationToken:token}));for(const o of page.Contents||[])if(o.Key)objects.push(o);token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);
let mirrored=0,skipped=0,bytes=0;
for(const item of objects){const key=assertManagedMediaKey(item.Key);const mirror=mediaMirrorKey(key,prefix);const sourceSize=Number(item.Size||0),etag=String(item.ETag||'').replace(/"/g,'');let destHead=null;try{destHead=await dest.send(new HeadObjectCommand({Bucket:destBucket,Key:mirror}));}catch{}
if(destHead&&Number(destHead.ContentLength||-1)===sourceSize&&String(destHead.Metadata?.['source-etag']||'')===etag&&/^[0-9a-f]{64}$/.test(String(destHead.Metadata?.['source-sha256']||''))){skipped++;bytes+=sourceSize;continue;}
const srcObj=await source.send(new GetObjectCommand({Bucket:sourceBucket,Key:key}));const sourceBody=await readBody(srcObj.Body);if(sourceBody.length!==sourceSize)throw new Error(`Leitura de origem divergente: ${key}`);const sourceSha=crypto.createHash('sha256').update(sourceBody).digest('hex');
await dest.send(new PutObjectCommand({Bucket:destBucket,Key:mirror,Body:sourceBody,ContentLength:sourceBody.length,ContentType:srcObj.ContentType||'application/octet-stream',Metadata:{'source-etag':etag,'source-sha256':sourceSha,'source-key-sha256':crypto.createHash('sha256').update(key).digest('hex')}}));
const verifyObj=await dest.send(new GetObjectCommand({Bucket:destBucket,Key:mirror}));const verifyBody=await readBody(verifyObj.Body);const verifySha=crypto.createHash('sha256').update(verifyBody).digest('hex');if(verifyBody.length!==sourceBody.length||verifySha!==sourceSha)throw new Error(`Falha de SHA-256 ao verificar espelho: ${key}`);mirrored++;bytes+=sourceSize;}
const fingerprint=crypto.createHash('sha256').update(`${new URL(destEndpoint).origin}|${destBucket}|${prefix}/media`).digest('hex').slice(0,32);const sql=neon(databaseUrl);await sql.query('INSERT INTO media_backup_receipts(source_count,mirrored_count,skipped_count,verified_bytes,destination_fingerprint,verified_at) VALUES($1,$2,$3,$4,$5,now())',[objects.length,mirrored,skipped,bytes,fingerprint]);console.log(`MEDIA_BACKUP_OK source=${objects.length} mirrored=${mirrored} skipped=${skipped} bytes=${bytes}`);
