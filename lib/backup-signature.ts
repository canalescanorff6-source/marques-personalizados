import crypto from 'node:crypto';

export const BACKUP_SIGNATURE_CONTRACT='marques-backup-signature-v1';
export type BackupSignatureInput={version:number;backup_format:string;schema_version:number;created_at:string;content_sha256:string;counts:Record<string,unknown>};
export type BackupAuthenticity={status:'verified'|'unsigned'|'unverified';key_source:'current'|'previous'|null;key_id:string|null};

function normalizedCounts(counts:Record<string,unknown>){return Object.fromEntries(Object.entries(counts).map(([key,value]):[string,number]=>[key,Number(value||0)]).sort(([a],[b])=>a.localeCompare(b)));}
export function backupSignaturePayload(input:BackupSignatureInput){return JSON.stringify({contract:BACKUP_SIGNATURE_CONTRACT,version:Number(input.version),backup_format:String(input.backup_format),schema_version:Number(input.schema_version),created_at:String(input.created_at),content_sha256:String(input.content_sha256).toLowerCase(),counts:normalizedCounts(input.counts)});}
function hmac(secret:string,payload:string){return crypto.createHmac('sha256',secret).update(payload).digest('hex');}
function equalHex(a:string,b:string){if(!/^[0-9a-f]{64}$/i.test(a)||!(/^[0-9a-f]{64}$/i.test(b)))return false;try{return crypto.timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}catch{return false;}}
export function backupSigningConfig(){const current=String(process.env.BACKUP_SIGNING_SECRET||'').trim();const previous=String(process.env.BACKUP_SIGNING_PREVIOUS_SECRET||'').trim();const keyId=String(process.env.BACKUP_SIGNING_KEY_ID||'primary').trim().slice(0,64)||'primary';return{current,previous,keyId};}
export function createBackupSignature(input:BackupSignatureInput){const {current,keyId}=backupSigningConfig();if(current.length<32)throw new Error('BACKUP_SIGNING_SECRET_MISSING');return{contract:BACKUP_SIGNATURE_CONTRACT,algorithm:'hmac-sha256',key_id:keyId,value:hmac(current,backupSignaturePayload(input))};}
export function verifyBackupSignature(input:BackupSignatureInput,signature:unknown,options:{requireAuthenticity?:boolean}={}):BackupAuthenticity{
  const requireAuthenticity=Boolean(options.requireAuthenticity);
  if(!signature||typeof signature!=='object'||Array.isArray(signature)){if(requireAuthenticity)throw new Error('BACKUP_SIGNATURE_REQUIRED');return{status:'unsigned',key_source:null,key_id:null};}
  const row=signature as Record<string,unknown>;const contract=String(row.contract||''),algorithm=String(row.algorithm||''),value=String(row.value||''),keyId=String(row.key_id||'')||null;
  if(contract!==BACKUP_SIGNATURE_CONTRACT||algorithm!=='hmac-sha256'||!/^[0-9a-f]{64}$/i.test(value))throw new Error('BACKUP_SIGNATURE_INVALID');
  const {current,previous}=backupSigningConfig();const payload=backupSignaturePayload(input);
  if(current.length>=32&&equalHex(value,hmac(current,payload)))return{status:'verified',key_source:'current',key_id:keyId};
  if(previous.length>=32&&equalHex(value,hmac(previous,payload)))return{status:'verified',key_source:'previous',key_id:keyId};
  if(current.length<32&&previous.length<32){if(requireAuthenticity)throw new Error('BACKUP_SIGNING_SECRET_MISSING');return{status:'unverified',key_source:null,key_id:keyId};}
  throw new Error('BACKUP_SIGNATURE_INVALID');
}
