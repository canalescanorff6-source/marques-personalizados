import crypto from 'node:crypto';

export type PrivacyIdentityType='phone'|'email';
export type PrivacyIdentity={type:PrivacyIdentityType;normalized:string;hash:string};
export type PrivacyTombstone={subject_hash:string;identity_type:PrivacyIdentityType;action:'anonymized';matched_inquiries:number;created_at:string;last_applied_at:string};

export function normalizePrivacyPhone(value:string){return value.replace(/\D/g,'').slice(0,20);}
export function normalizePrivacyEmail(value:string){return value.trim().toLocaleLowerCase('pt-BR').slice(0,320);}
export function privacyHashSecret(){
  const dedicated=(process.env.PRIVACY_HASH_SECRET||'').trim();
  if(dedicated.length>=32)return dedicated;
  if(process.env.NODE_ENV==='production')throw new Error('PRIVACY_HASH_SECRET deve ter ao menos 32 caracteres em produção.');
  const fallback=(process.env.SESSION_SECRET||'local-privacy-development-only').trim();
  return fallback||'local-privacy-development-only';
}
function hmac(kind:PrivacyIdentityType,value:string){return crypto.createHmac('sha256',privacyHashSecret()).update(`${kind}:${value}`).digest('hex');}
export function privacyIdentity(type:PrivacyIdentityType,value:string):PrivacyIdentity|null{
  const normalized=type==='phone'?normalizePrivacyPhone(value):normalizePrivacyEmail(value);
  if(type==='phone'&&normalized.length<8)return null;
  if(type==='email'&&(!normalized.includes('@')||normalized.length<5))return null;
  return{type,normalized,hash:hmac(type,normalized)};
}
export function privacyIdentities(input:{phone?:string|null;email?:string|null}){
  const out:PrivacyIdentity[]=[];const phone=privacyIdentity('phone',String(input.phone||''));const email=privacyIdentity('email',String(input.email||''));if(phone)out.push(phone);if(email)out.push(email);return out;
}
function timestamp(value:unknown,fallback:string){if(typeof value!=='string'||!value.trim())return fallback;const parsed=new Date(value);return Number.isFinite(parsed.getTime())?parsed.toISOString():fallback;}
export function normalizePrivacyTombstones(value:unknown,{strict=false}:{strict?:boolean}={}):PrivacyTombstone[]{
  if(!Array.isArray(value)){if(strict)throw new Error('BACKUP_PRIVACY_TOMBSTONES_INVALID');return[];}
  const now=new Date().toISOString();const out=new Map<string,PrivacyTombstone>();
  for(const item of value){
    if(!item||typeof item!=='object'||Array.isArray(item)){if(strict)throw new Error('BACKUP_PRIVACY_TOMBSTONE_INVALID');continue;}
    const row=item as Record<string,unknown>;const subject_hash=String(row.subject_hash||'').toLowerCase();const identity_type=String(row.identity_type||'');const action=String(row.action||'anonymized');
    if(!/^[0-9a-f]{64}$/.test(subject_hash)||!['phone','email'].includes(identity_type)||action!=='anonymized'){if(strict)throw new Error('BACKUP_PRIVACY_TOMBSTONE_INVALID');continue;}
    const allowed=new Set(['subject_hash','identity_type','action','matched_inquiries','created_at','last_applied_at']);if(strict&&Object.keys(row).some(key=>!allowed.has(key)))throw new Error('BACKUP_PRIVACY_TOMBSTONE_INVALID');
    const created_at=timestamp(row.created_at,now),last_applied_at=timestamp(row.last_applied_at,created_at),matched_inquiries=Math.max(0,Math.floor(Number(row.matched_inquiries||0)||0));const key=`${identity_type}:${subject_hash}`;
    const existing=out.get(key);if(!existing){out.set(key,{subject_hash,identity_type:identity_type as PrivacyIdentityType,action:'anonymized',matched_inquiries,created_at,last_applied_at});continue;}
    out.set(key,{...existing,matched_inquiries:Math.max(existing.matched_inquiries,matched_inquiries),created_at:new Date(existing.created_at)<=new Date(created_at)?existing.created_at:created_at,last_applied_at:new Date(existing.last_applied_at)>=new Date(last_applied_at)?existing.last_applied_at:last_applied_at});
  }
  return[...out.values()].sort((a,b)=>a.identity_type.localeCompare(b.identity_type)||a.subject_hash.localeCompare(b.subject_hash));
}
export function mergePrivacyTombstones(...sources:unknown[]):PrivacyTombstone[]{return normalizePrivacyTombstones(sources.flatMap(source=>Array.isArray(source)?source:[]));}
function cleanQuoteItems(value:unknown){
  if(!Array.isArray(value))return[];
  return value.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))return null;
    const row=item as Record<string,unknown>;
    return{product_id:typeof row.product_id==='string'?row.product_id:'',name:typeof row.name==='string'?row.name:'',category:typeof row.category==='string'?row.category:'',quantity:Number.isFinite(Number(row.quantity))?Math.max(1,Number(row.quantity)):1};
  }).filter(Boolean);
}
export function anonymizeInquiryRecord(row:Record<string,unknown>){
  return{...row,name:'Cliente anonimizado',whatsapp:'',email:null,event_date:null,message:'',quote_items:cleanQuoteItems(row.quote_items),admin_notes:'',follow_up_at:null,event_brief:{},idempotency_key:null,production_due_at:null,review_requested_at:null,repurchase_contacted_at:null,repurchase_contact_year:null,anonymized_at:new Date().toISOString()};
}
export function sanitizeRestorePayloadPrivacy(payload:Record<string,unknown>,tombstoneHashes:Set<string>){
  if(!tombstoneHashes.size)return{payload,anonymizedInquiryIds:new Set<string>(),anonymizedCount:0,removedActivityCount:0};
  const rows=Array.isArray(payload.inquiries)?payload.inquiries:[];const anonymizedInquiryIds=new Set<string>();let anonymizedCount=0;
  const inquiries=rows.map(item=>{
    if(!item||typeof item!=='object'||Array.isArray(item))return item;
    const row=item as Record<string,unknown>;const identities=privacyIdentities({phone:typeof row.whatsapp==='string'?row.whatsapp:'',email:typeof row.email==='string'?row.email:''});
    if(!identities.some(identity=>tombstoneHashes.has(identity.hash)))return row;
    if(typeof row.id==='string')anonymizedInquiryIds.add(row.id);anonymizedCount++;return anonymizeInquiryRecord(row);
  });
  const activities=Array.isArray(payload.inquiry_activity)?payload.inquiry_activity:[];const keptActivities=activities.filter(item=>!(item&&typeof item==='object'&&!Array.isArray(item)&&anonymizedInquiryIds.has(String((item as Record<string,unknown>).inquiry_id||''))));
  return{payload:{...payload,inquiries,inquiry_activity:keptActivities},anonymizedInquiryIds,anonymizedCount,removedActivityCount:activities.length-keptActivities.length};
}
