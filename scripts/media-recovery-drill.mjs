import crypto from 'node:crypto';
import {S3Client,ListObjectsV2Command,GetObjectCommand,PutObjectCommand,DeleteObjectsCommand} from '@aws-sdk/client-s3';
import {neon} from '@neondatabase/serverless';
import {normalizeOffsitePrefix} from '../lib/offsite-backup.ts';
import {assertIsolatedMediaDrillTarget} from '../lib/media-recovery-drill.ts';
import {assertManagedMediaKey} from '../lib/storage-policy.ts';
import {assertDistinctStorageTargets,normalizeExternalDrEndpoint,normalizeStorageBucket,normalizeStorageTransportEndpoint} from '../lib/dr-storage-policy.ts';
function req(n){const v=String(process.env[n]||'').trim();if(!v)throw new Error(`${n} ausente`);return v;}
async function bodyBuffer(body,max=64*1024*1024){if(!body)throw new Error('Objeto sem corpo');const chunks=[];let total=0;for await(const c of body){const b=Buffer.isBuffer(c)?c:Buffer.from(c);total+=b.length;if(total>max)throw new Error(`Objeto excede ${max} bytes`);chunks.push(b);}return Buffer.concat(chunks);}
const started=Date.now();
const databaseUrl=req('DATABASE_URL');
const publicEndpoint=normalizeStorageTransportEndpoint(req('S3_ENDPOINT'),'S3_ENDPOINT'),publicBucket=normalizeStorageBucket(req('S3_BUCKET'),'S3_BUCKET');
const vaultEndpoint=normalizeExternalDrEndpoint(req('BACKUP_S3_ENDPOINT'),'BACKUP_S3_ENDPOINT'),vaultBucket=normalizeStorageBucket(req('BACKUP_S3_BUCKET'),'BACKUP_S3_BUCKET'),vaultAccess=req('BACKUP_S3_ACCESS_KEY_ID'),vaultSecret=req('BACKUP_S3_SECRET_ACCESS_KEY');
const drillEndpoint=normalizeExternalDrEndpoint(req('DRILL_S3_ENDPOINT'),'DRILL_S3_ENDPOINT'),drillBucket=normalizeStorageBucket(req('DRILL_S3_BUCKET'),'DRILL_S3_BUCKET'),drillAccess=req('DRILL_S3_ACCESS_KEY_ID'),drillSecret=req('DRILL_S3_SECRET_ACCESS_KEY');
if(String(process.env.MEDIA_RECOVERY_DRILL_CONFIRM_ISOLATED||'')!=='1')throw new Error('MEDIA_RECOVERY_DRILL_CONFIRM_ISOLATED=1 é obrigatório');
assertDistinctStorageTargets({endpoint:publicEndpoint,bucket:publicBucket},{endpoint:vaultEndpoint,bucket:vaultBucket},'MEDIA_PUBLIC_VAULT');
assertDistinctStorageTargets({endpoint:publicEndpoint,bucket:publicBucket},{endpoint:drillEndpoint,bucket:drillBucket},'MEDIA_PUBLIC_DRILL');
assertDistinctStorageTargets({endpoint:vaultEndpoint,bucket:vaultBucket},{endpoint:drillEndpoint,bucket:drillBucket},'MEDIA_VAULT_DRILL');
assertIsolatedMediaDrillTarget(publicEndpoint,publicBucket,vaultEndpoint,vaultBucket,drillEndpoint,drillBucket);
const prefix=normalizeOffsitePrefix(process.env.BACKUP_S3_PREFIX),root=`${prefix}/media/catalog/`,run=`media-recovery-drill/${new Date().toISOString().replace(/[:.]/g,'-')}-${crypto.randomBytes(6).toString('hex')}/`;
const vault=new S3Client({endpoint:vaultEndpoint,region:String(process.env.BACKUP_S3_REGION||'auto'),forcePathStyle:String(process.env.BACKUP_S3_FORCE_PATH_STYLE||'1')!=='0',credentials:{accessKeyId:vaultAccess,secretAccessKey:vaultSecret}});
const drill=new S3Client({endpoint:drillEndpoint,region:String(process.env.DRILL_S3_REGION||'auto'),forcePathStyle:String(process.env.DRILL_S3_FORCE_PATH_STYLE||'1')!=='0',credentials:{accessKeyId:drillAccess,secretAccessKey:drillSecret}});
let token;const created=[];let count=0,bytes=0;
try{
  do{const page=await vault.send(new ListObjectsV2Command({Bucket:vaultBucket,Prefix:root,ContinuationToken:token}));for(const item of page.Contents||[]){if(!item.Key)continue;const sourceKey=assertManagedMediaKey(item.Key.slice(`${prefix}/media/`.length));const src=await vault.send(new GetObjectCommand({Bucket:vaultBucket,Key:item.Key}));const buf=await bodyBuffer(src.Body);const expected=String(src.Metadata?.['source-sha256']||'');if(!/^[0-9a-f]{64}$/.test(expected))throw new Error(`Objeto de backup sem source-sha256: ${item.Key}`);const actual=crypto.createHash('sha256').update(buf).digest('hex');if(actual!==expected)throw new Error(`Objeto de backup corrompido: ${item.Key}`);const relative=sourceKey;const targetKey=`${run}${relative}`;await drill.send(new PutObjectCommand({Bucket:drillBucket,Key:targetKey,Body:buf,ContentLength:buf.length,ContentType:src.ContentType||'application/octet-stream',Metadata:{'source-sha256':expected}}));created.push(targetKey);const verify=await drill.send(new GetObjectCommand({Bucket:drillBucket,Key:targetKey}));const restored=await bodyBuffer(verify.Body);if(crypto.createHash('sha256').update(restored).digest('hex')!==expected)throw new Error(`Restore drill divergente: ${relative}`);count++;bytes+=buf.length;}token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);
  if(count===0)throw new Error('Cofre de mídia não contém objetos para ensaio');
  const vaultFp=crypto.createHash('sha256').update(`${new URL(vaultEndpoint).origin}|${vaultBucket}|${root}`).digest('hex').slice(0,32),drillFp=crypto.createHash('sha256').update(`${new URL(drillEndpoint).origin}|${drillBucket}`).digest('hex').slice(0,32),duration=Date.now()-started;
  const sql=neon(databaseUrl);await sql.query('INSERT INTO media_recovery_drill_receipts(object_count,verified_bytes,vault_fingerprint,drill_target_fingerprint,duration_ms,succeeded_at) VALUES($1,$2,$3,$4,$5,now())',[count,bytes,vaultFp,drillFp,duration]);
  console.log(`MEDIA_RECOVERY_DRILL_OK objects=${count} bytes=${bytes} duration_ms=${duration}`);
}finally{
  for(let i=0;i<created.length;i+=1000){
    const batch=created.slice(i,i+1000);
    if(batch.length){
      await drill.send(new DeleteObjectsCommand({Bucket:drillBucket,Delete:{Objects:batch.map(Key=>({Key})),Quiet:true}}));
    }
  }
}
