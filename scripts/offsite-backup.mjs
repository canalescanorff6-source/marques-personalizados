import crypto from 'node:crypto';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {S3Client,PutObjectCommand,HeadObjectCommand,GetObjectCommand,ListObjectsV2Command,DeleteObjectsCommand} from '@aws-sdk/client-s3';
import {neon} from '@neondatabase/serverless';
import {decryptBackupText} from '../lib/backup-encryption.ts';
import {verifyBackupText} from '../lib/backup-restore.ts';
import {databaseBackupRoot,normalizeOffsitePrefix,normalizeOffsiteRetentionDays,offsiteBackupObjectKey,shouldDeleteOffsiteObject} from '../lib/offsite-backup.ts';
import {normalizeExternalDrEndpoint,normalizeStorageBucket} from '../lib/dr-storage-policy.ts';

function required(name){const value=String(process.env[name]||'').trim();if(!value)throw new Error(`${name} ausente`);return value;}
async function sha256Body(body){if(!body)throw new Error('Leitura de volta do backup retornou corpo vazio');const hash=crypto.createHash('sha256');let bytes=0;for await(const chunk of body){const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);hash.update(buffer);bytes+=buffer.length;}return{sha256:hash.digest('hex'),bytes};}
const endpoint=normalizeExternalDrEndpoint(required('BACKUP_S3_ENDPOINT'),'BACKUP_S3_ENDPOINT'),bucket=normalizeStorageBucket(required('BACKUP_S3_BUCKET'),'BACKUP_S3_BUCKET'),accessKeyId=required('BACKUP_S3_ACCESS_KEY_ID'),secretAccessKey=required('BACKUP_S3_SECRET_ACCESS_KEY');
const region=String(process.env.BACKUP_S3_REGION||'auto').trim()||'auto',prefix=normalizeOffsitePrefix(process.env.BACKUP_S3_PREFIX),retentionDays=normalizeOffsiteRetentionDays(process.env.BACKUP_OFFSITE_RETENTION_DAYS),forcePathStyle=String(process.env.BACKUP_S3_FORCE_PATH_STYLE||'1')!=='0';
const client=new S3Client({endpoint,region,forcePathStyle,credentials:{accessKeyId,secretAccessKey}});
const tmp=await fsp.mkdtemp(path.join(os.tmpdir(),'marques-offsite-backup-'));
try{
  const run=spawnSync(process.execPath,['--no-warnings','--experimental-strip-types','scripts/backup-db.mjs'],{cwd:process.cwd(),env:{...process.env,BACKUP_OUTPUT_DIR:tmp},encoding:'utf8',maxBuffer:2*1024*1024});
  if(run.status!==0)throw new Error(`db:backup falhou: ${(run.stderr||run.stdout||'').trim()}`);process.stdout.write(run.stdout||'');
  const match=String(run.stdout||'').match(/^BACKUP_FILE=(.+)$/m);if(!match)throw new Error('db:backup não informou BACKUP_FILE');const file=path.resolve(match[1].trim());if(!file.startsWith(path.resolve(tmp)+path.sep)||!fs.existsSync(file))throw new Error('BACKUP_FILE inválido');
  const verify=spawnSync(process.execPath,['--no-warnings','--experimental-strip-types','scripts/verify-backup.mjs',file,'--strict'],{cwd:process.cwd(),env:process.env,encoding:'utf8',maxBuffer:2*1024*1024});if(verify.status!==0)throw new Error(`Backup recém-gerado falhou na verificação strict: ${(verify.stderr||verify.stdout||'').trim()}`);process.stdout.write(verify.stdout||'');
  const body=await fsp.readFile(file);const envelopeSha256=crypto.createHash('sha256').update(body).digest('hex'),contentMd5=crypto.createHash('md5').update(body).digest('base64');
  const decrypted=decryptBackupText(body.toString('utf8'),{requireEncryption:true});const verifiedBackup=verifyBackupText(decrypted.plaintext,{requireAuthenticity:true});const backupContract=String(verifiedBackup.backup.backup_format||'');if(!/^marques-catalog-v(?:8|9)$/.test(backupContract))throw new Error('Formato de backup offsite não permitido');
  const key=offsiteBackupObjectKey(path.basename(file),prefix);
  const metadata={'envelope-sha256':envelopeSha256,'content-sha256':verifiedBackup.sha256,'backup-contract':backupContract,'schema-version':String(verifiedBackup.schemaVersion),'source':'marques-catalogo'};
  await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:'application/json',ContentMD5:contentMd5,Metadata:metadata}));
  const head=await client.send(new HeadObjectCommand({Bucket:bucket,Key:key}));const remoteSha=String(head.Metadata?.['envelope-sha256']||'').toLowerCase(),remoteContract=String(head.Metadata?.['backup-contract']||''),remoteSchema=String(head.Metadata?.['schema-version']||''),remoteContentSha=String(head.Metadata?.['content-sha256']||'').toLowerCase();if(Number(head.ContentLength)!==body.length||remoteSha!==envelopeSha256||remoteContract!==backupContract||remoteSchema!==String(verifiedBackup.schemaVersion)||remoteContentSha!==verifiedBackup.sha256)throw new Error('Verificação pós-upload falhou: tamanho/metadados do backup divergem');
  const readback=await client.send(new GetObjectCommand({Bucket:bucket,Key:key}));const verified=await sha256Body(readback.Body);if(verified.bytes!==body.length||verified.sha256!==envelopeSha256)throw new Error('Verificação pós-upload falhou: leitura remota diverge do backup local');
  let token;const stale=[],root=`${databaseBackupRoot(prefix)}/`;do{const page=await client.send(new ListObjectsV2Command({Bucket:bucket,Prefix:root,ContinuationToken:token}));for(const item of page.Contents||[])if(item.Key&&shouldDeleteOffsiteObject(item.LastModified,retentionDays,key,item.Key,new Date(),prefix))stale.push(item.Key);token=page.IsTruncated?page.NextContinuationToken:undefined;}while(token);
  let deleted=0;for(let i=0;i<stale.length;i+=1000){const batch=stale.slice(i,i+1000);if(!batch.length)continue;const result=await client.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:batch.map(Key=>({Key})),Quiet:true}}));if(result.Errors?.length)throw new Error(`Falha ao aplicar retenção em ${result.Errors.length} objeto(s)`);deleted+=batch.length;}
  const databaseUrl=required('DATABASE_URL'),sql=neon(databaseUrl),destinationFingerprint=crypto.createHash('sha256').update(`${new URL(endpoint).origin}|${bucket}|${databaseBackupRoot(prefix)}`).digest('hex').slice(0,32);
  const receiptRows=await sql.query('INSERT INTO offsite_backup_receipts(envelope_sha256,object_key,destination_fingerprint,bytes,retention_days,deleted_count,verified_at) VALUES($1,$2,$3,$4,$5,$6,now()) RETURNING id,verified_at',[envelopeSha256,key,destinationFingerprint,body.length,retentionDays,deleted]);
  if(!receiptRows[0])throw new Error('Backup remoto foi validado, mas o recibo operacional não pôde ser registrado');
  console.log(`OFFSITE_RECEIPT_OK id=${receiptRows[0].id} verified_at=${new Date(receiptRows[0].verified_at).toISOString()}`);
  console.log(`OFFSITE_BACKUP_OK bucket=${bucket} key=${key} bytes=${body.length} sha256=${envelopeSha256} contract=${backupContract} schema=${verifiedBackup.schemaVersion} retention_days=${retentionDays} deleted=${deleted}`);
}finally{await fsp.rm(tmp,{recursive:true,force:true});}
