import { assertManagedMediaKey } from './storage-policy.ts';

export type MediaDeletionTombstone={url:string;storage_key:string;deleted_at:string};
function plain(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
function canonicalUrl(value:unknown,key:string){let url:URL;try{url=new URL(String(value||'').trim());}catch{throw new Error('BACKUP_MEDIA_TOMBSTONE_INVALID');}if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||/%2f|%5c/i.test(url.pathname))throw new Error('BACKUP_MEDIA_TOMBSTONE_INVALID');let decoded='';try{decoded=decodeURIComponent(url.pathname);}catch{throw new Error('BACKUP_MEDIA_TOMBSTONE_INVALID');}if(!decoded.endsWith(`/${key}`))throw new Error('BACKUP_MEDIA_TOMBSTONE_INVALID');return url.toString();}
export function normalizeMediaDeletionTombstones(value:unknown,{strict=false}:{strict?:boolean}={}):MediaDeletionTombstone[]{
  if(!Array.isArray(value)){if(strict)throw new Error('BACKUP_MEDIA_TOMBSTONES_INVALID');return[];}
  const rows:MediaDeletionTombstone[]=[];const urls=new Set<string>(),keys=new Set<string>();
  for(const item of value){
    try{
      if(!plain(item))throw new Error('BACKUP_MEDIA_TOMBSTONE_INVALID');
      if(strict&&Object.keys(item).some(key=>!['url','storage_key','deleted_at'].includes(key)))throw new Error('BACKUP_MEDIA_TOMBSTONE_INVALID');
      const storage_key=assertManagedMediaKey(String(item.storage_key||''));const url=canonicalUrl(item.url,storage_key);const date=new Date(String(item.deleted_at||''));if(!Number.isFinite(date.getTime()))throw new Error('BACKUP_MEDIA_TOMBSTONE_INVALID');
      if(urls.has(url)||keys.has(storage_key))throw new Error('BACKUP_MEDIA_TOMBSTONE_DUPLICATE');urls.add(url);keys.add(storage_key);rows.push({url,storage_key,deleted_at:date.toISOString()});
    }catch(error){if(strict)throw error;}
  }
  return rows.sort((a,b)=>a.storage_key.localeCompare(b.storage_key)||a.url.localeCompare(b.url));
}

export function mergeMediaDeletionTombstones(current:unknown,embedded:unknown){
  const backup=normalizeMediaDeletionTombstones(embedded,{strict:true});
  const live=normalizeMediaDeletionTombstones(current,{strict:true});
  const byKey=new Map<string,MediaDeletionTombstone>();
  for(const row of backup)byKey.set(row.storage_key,row);
  // O estado atual vence para a mesma chave: preserva a URL canônica do ambiente
  // e impede que um restore externo reverta uma deleção já conhecida localmente.
  for(const row of live)byKey.set(row.storage_key,row);
  return normalizeMediaDeletionTombstones([...byKey.values()],{strict:true});
}
function managedKeyCandidate(value:unknown){
  if(typeof value!=='string'||!value)return null;
  let url:URL;try{url=new URL(value);}catch{return null;}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||/%2f|%5c/i.test(url.pathname))return null;
  const marker='/catalog/';const pos=url.pathname.indexOf(marker);if(pos<0)return null;
  let decoded='';try{decoded=decodeURIComponent(url.pathname.slice(pos+1));}catch{return null;}
  try{return assertManagedMediaKey(decoded);}catch{return null;}
}
function mediaReferences(payload:Record<string,unknown>){
  const refs:string[]=[];const add=(value:unknown)=>{if(typeof value==='string'&&value.trim())refs.push(value.trim());};
  for(const section of ['products','archived_products']){const rows=Array.isArray(payload[section])?payload[section]:[];for(const item of rows){if(!plain(item)||!Array.isArray(item.image_urls))continue;for(const value of item.image_urls)add(value);}}
  const categories=Array.isArray(payload.categories)?payload.categories:[];for(const item of categories)if(plain(item))add(item.image_url);
  if(plain(payload.settings)){add(payload.settings.logo_url);add(payload.settings.hero_image_url);}
  return refs;
}
export function mediaTombstoneReferenceConflicts(payload:Record<string,unknown>,tombstones:unknown){
  const rows=normalizeMediaDeletionTombstones(tombstones,{strict:true});if(!rows.length)return[];
  const urls=new Set(rows.map(row=>row.url)),keys=new Set(rows.map(row=>row.storage_key));
  return [...new Set(mediaReferences(payload).filter(url=>urls.has(url)||Boolean(managedKeyCandidate(url)&&keys.has(managedKeyCandidate(url)!))))].sort();
}
export function assertNoMediaTombstoneReferences(payload:Record<string,unknown>,tombstones:unknown){
  const conflicts=mediaTombstoneReferenceConflicts(payload,tombstones);if(conflicts.length)throw new Error('BACKUP_MEDIA_REFERENCE_CONFLICT');return conflicts;
}
