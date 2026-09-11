export const DEFAULT_OFFSITE_PREFIX='marques-backups';
export const DEFAULT_OFFSITE_RETENTION_DAYS=45;
const BACKUP_FILE_RE=/^marques-catalog-v(?:7|8|9)-schema\d+-\d{4}-\d{2}-\d{2}T[^/]+\.encrypted\.json$/;

export function normalizeOffsitePrefix(value:unknown){
  const raw=String(value||'').trim().replace(/^\/+|\/+$/g,'');
  if(!raw)return DEFAULT_OFFSITE_PREFIX;
  if(raw.length>120||!/[A-Za-z0-9]/.test(raw)||!/^[A-Za-z0-9._\-/]+$/.test(raw)||raw.includes('..'))throw new Error('BACKUP_OFFSITE_PREFIX_INVALID');
  return raw.replace(/\/{2,}/g,'/');
}
export function databaseBackupRoot(prefix=DEFAULT_OFFSITE_PREFIX){return `${normalizeOffsitePrefix(prefix)}/database`;}
export function normalizeOffsiteRetentionDays(value:unknown){
  if(value===undefined||value===null||String(value).trim()==='')return DEFAULT_OFFSITE_RETENTION_DAYS;
  const parsed=Number(value);if(!Number.isInteger(parsed)||parsed<7||parsed>3650)throw new Error('BACKUP_OFFSITE_RETENTION_INVALID');return parsed;
}
export function offsiteBackupObjectKey(filename:string,prefix=DEFAULT_OFFSITE_PREFIX,now=new Date()){
  const root=databaseBackupRoot(prefix);const safeName=filename.replace(/[^A-Za-z0-9._-]/g,'_').slice(-180);if(!safeName||!BACKUP_FILE_RE.test(safeName))throw new Error('BACKUP_OFFSITE_FILENAME_INVALID');
  const yyyy=String(now.getUTCFullYear());const mm=String(now.getUTCMonth()+1).padStart(2,'0');return`${root}/${yyyy}/${mm}/${safeName}`;
}
export function isCurrentDatabaseBackupObjectKey(key:string,prefix=DEFAULT_OFFSITE_PREFIX){
  const root=`${databaseBackupRoot(prefix)}/`;if(!String(key||'').startsWith(root))return false;const relative=String(key).slice(root.length);const parts=relative.split('/');return parts.length===3&&/^\d{4}$/.test(parts[0])&&/^(0[1-9]|1[0-2])$/.test(parts[1])&&BACKUP_FILE_RE.test(parts[2]);
}
export function isLegacyDatabaseBackupObjectKey(key:string,prefix=DEFAULT_OFFSITE_PREFIX){
  const root=`${normalizeOffsitePrefix(prefix)}/`;if(!String(key||'').startsWith(root)||String(key).startsWith(`${root}media/`)||String(key).startsWith(`${root}database/`))return false;const relative=String(key).slice(root.length);const parts=relative.split('/');return parts.length===3&&/^\d{4}$/.test(parts[0])&&/^(0[1-9]|1[0-2])$/.test(parts[1])&&BACKUP_FILE_RE.test(parts[2]);
}
export function isDatabaseBackupObjectKey(key:string,prefix=DEFAULT_OFFSITE_PREFIX){return isCurrentDatabaseBackupObjectKey(key,prefix)||isLegacyDatabaseBackupObjectKey(key,prefix);}

export function selectLatestDatabaseBackupObject<T extends {Key?:string;LastModified?:Date}>(items:T[],prefix=DEFAULT_OFFSITE_PREFIX){
  let latest:T|null=null;for(const item of items){if(!item.Key||!item.LastModified||!isDatabaseBackupObjectKey(item.Key,prefix))continue;if(!latest||!latest.LastModified||item.LastModified>latest.LastModified||(item.LastModified.getTime()===latest.LastModified.getTime()&&item.Key>String(latest.Key||'')))latest=item;}return latest;
}
export function offsiteRetentionCutoff(retentionDays:number,now=new Date()){const days=normalizeOffsiteRetentionDays(retentionDays);return new Date(now.getTime()-days*86_400_000);}
export function shouldDeleteOffsiteObject(lastModified:Date|undefined,retentionDays:number,currentKey:string,key:string,now=new Date(),prefix=DEFAULT_OFFSITE_PREFIX){
  if(!lastModified||!key||key===currentKey||!isDatabaseBackupObjectKey(key,prefix))return false;return lastModified.getTime()<offsiteRetentionCutoff(retentionDays,now).getTime();
}
