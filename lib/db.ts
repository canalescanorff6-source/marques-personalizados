import { neon } from '@neondatabase/serverless';
import { fallbackCategories, fallbackSiteSettings } from './config';
import { slugifyText } from './seo';
import { normalizeAdminAgendaDays } from './agenda-window';
import { mergePrivacyTombstones, privacyIdentities, sanitizeRestorePayloadPrivacy, type PrivacyIdentityType, type PrivacyTombstone } from './privacy';
import { evaluateBackupFreshness, normalizeBackupMaxAgeHours, type BackupFreshness } from './backup-freshness';
import { evaluateRecoveryDrillFreshness, normalizeRecoveryDrillMaxAgeHours, type RecoveryDrillFreshness } from './recovery-drill';
import { evaluateMediaBackupFreshness, normalizeMediaBackupMaxAgeHours } from './media-dr';
import { evaluateMediaRecoveryDrillFreshness, normalizeMediaRecoveryDrillMaxAgeHours } from './media-recovery-drill';
import { assertNoMediaTombstoneReferences,mergeMediaDeletionTombstones,normalizeMediaDeletionTombstones } from './media-tombstones';
import { parseMediaLifecycleLease,type MediaLifecycleLease } from './media-lifecycle';
import { normalizeExternalHttpsUrl,normalizePublicUrl } from './public-url';
import { adminCreateIdFromKey,assertIdempotentReplay,CreateUniqueConflictError,type AdminCreateScope } from './idempotency';
import platformContract from '../platform-contract.json' with { type: 'json' };

export type ProductCustomizationField = {
  id: string;
  label: string;
  type: 'text' | 'number' | 'select';
  required: boolean;
  placeholder?: string;
  options: string[];
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  category: string;
  category_id?: string | null;
  description: string;
  price_cents: number | null;
  image_urls: string[];
  featured: boolean;
  active: boolean;
  stock_status: 'disponivel' | 'sob_encomenda' | 'indisponivel';
  tags: string[];
  sort_order: number;
  min_quantity: number | null;
  production_time: string;
  seo_title: string;
  seo_description: string;
  badge: string;
  customization_fields: ProductCustomizationField[];
  publish_at: string | null;
  unpublish_at: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string;
  image_url: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SiteSettings = typeof fallbackSiteSettings & { updated_at?: string };

export type Testimonial = {
  id:string;
  name:string;
  location:string;
  quote:string;
  rating:number;
  active:boolean;
  sort_order:number;
  created_at:string;
  updated_at:string;
};

export type InquiryQuoteItem = { product_id:string; name:string; category:string; quantity:number; customizations?:Record<string,string> };

export type MarketingAttribution={source?:string;medium?:string;campaign?:string;content?:string;term?:string;landing_path?:string;referrer_host?:string};

export type InquiryEventBrief = {
  occasion?: string;
  theme?: string;
  celebrant_name?: string;
  celebrant_age?: string;
  guest_count?: number | null;
  budget_range?: string;
  desired_categories?: string[];
  source?: 'site' | 'concierge' | 'shared_list';
  attribution?: MarketingAttribution;
};

export type Inquiry = {
  id: string;
  name: string;
  whatsapp: string;
  email: string | null;
  event_date: string | null;
  product_id: string | null;
  product_name: string;
  category: string;
  message: string;
  status: 'novo' | 'contatado' | 'orcado' | 'fechado' | 'perdido';
  source: string;
  quote_items: InquiryQuoteItem[];
  admin_notes: string;
  quoted_value_cents: number | null;
  follow_up_at: string | null;
  event_brief: InquiryEventBrief;
  closed_at: string | null;
  payment_status: 'pendente'|'sinal'|'pago';
  paid_cents: number;
  production_status: 'nao_iniciado'|'arte'|'aguardando_aprovacao'|'producao'|'pronto'|'entregue';
  production_due_at: string | null;
  review_requested_at: string | null;
  repurchase_contacted_at: string | null;
  repurchase_contact_year: number | null;
  repurchase_next_anniversary?: string | null;
  repurchase_cycle_year?: number | null;
  anonymized_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};

export type InquiryActivity = {
  id: number;
  inquiry_id: string;
  kind: string;
  summary: string;
  metadata: Record<string,unknown>;
  created_at: string;
};

export type InquiryCommercialSummary={
  total:number;
  operational_count:number;
  new_count:number;
  closed_count:number;
  lost_count:number;
  decided_count:number;
  pipeline_value_cents:number;
  closed_value_cents:number;
  received_value_cents:number;
  receivable_value_cents:number;
  weighted_pipeline_cents:number;
  revenue_30_cents:number;
  month_revenue_cents:number;
  production_open_count:number;
  agenda_events_30_count:number;
  agenda_production_30_count:number;
};
export type InquiryCommercialSourceRow={source:string;leads:number;closed:number;closedValue:number};
export type InquiryCommercialCampaignRow={campaign:string;source:string;leads:number;closed:number;closedValue:number};
export type InquiryCommercialInsights={source_rows:InquiryCommercialSourceRow[];campaign_rows:InquiryCommercialCampaignRow[]};
export type InquiryMarketingSourceRow={source:string;leads:number;closed:number;revenue:number;received:number};
export type InquiryMarketingCampaignRow={campaign:string;leads:number;closed:number;revenue:number;received:number};
export type InquiryMarketingStats={social_rows:InquiryMarketingSourceRow[];campaign_rows:InquiryMarketingCampaignRow[]};
export type InquiryHistoryPointer={created_at:string;id:string};
export type InquiryCustomerStats={requests:number;closed:number;closedValue:number;lastRequest:string};
export type InquiryCustomerStatsMap=Record<string,InquiryCustomerStats>;
export type InquiryHistoryPage={items:Inquiry[];next:InquiryHistoryPointer|null;has_more:boolean};
export type InquiryWorkspace={items:Inquiry[];history:InquiryHistoryPage;operational_count:number;customer_stats:InquiryCustomerStatsMap};
export type InquiryReactivationPointer={next_anniversary:string;id:string};
export type InquiryReactivationWorkspace={items:Inquiry[];customer_stats:InquiryCustomerStatsMap;total:number;next:InquiryReactivationPointer|null;has_more:boolean};
export type ProductionSummary={
  open_count:number;
  active_count:number;
  overdue_count:number;
  approval_count:number;
  ready_count:number;
  without_signal_count:number;
  delivered_30_count:number;
  delivered_total_count:number;
  review_pending_count:number;
};
export type ProductionHistoryPointer={updated_at:string;id:string};
export type ProductionHistoryPage={items:Inquiry[];next:ProductionHistoryPointer|null;has_more:boolean};
export type ProductionWorkspace={queue:Inquiry[];aftercare:Inquiry[];summary:ProductionSummary;delivered:ProductionHistoryPage};
export type AdminAgendaKind='evento'|'retorno'|'producao'|'publicacao'|'retirada'|'divulgacao';
export type AdminAgendaItem={
  id:string;
  kind:AdminAgendaKind;
  date:string;
  title:string;
  subtitle:string;
  href?:string;
  all_day:boolean;
};
export type AdminAgendaSummary={total:number;next_7:number;events:number;follow_ups:number;production:number;publications:number};
export type AdminAgendaWorkspace={days:30|60|90|180;generated_at:string;items:AdminAgendaItem[];summary:AdminAgendaSummary};

export type SocialContentPlan = {
  id:string;
  title:string;
  channel:'instagram'|'whatsapp'|'facebook'|'tiktok'|'pinterest'|'youtube';
  planned_at:string;
  status:'planejado'|'publicado'|'cancelado';
  product_id:string|null;
  campaign:string;
  notes:string;
  created_at:string;
  updated_at:string;
};

export type MarketingCampaign = {
  id:string;
  name:string;
  slug:string;
  channel:'instagram'|'whatsapp'|'facebook'|'tiktok'|'pinterest'|'youtube'|'google'|'outro';
  status:'planejada'|'ativa'|'encerrada';
  starts_at:string|null;
  ends_at:string|null;
  goal_leads:number;
  goal_revenue_cents:number;
  spend_cents:number;
  notes:string;
  created_at:string;
  updated_at:string;
};

function getSql() {
  const url = process.env.DATABASE_URL;
  return url ? neon(url) : null;
}

export async function checkDatabase() {
  const sql = getSql();
  if (!sql) return { configured: false, ok: false };
  try { await sql`SELECT 1 AS ok`; return { configured: true, ok: true }; }
  catch { return { configured: true, ok: false }; }
}

type DbRow=Record<string,unknown>;
type SqlClient=NonNullable<ReturnType<typeof getSql>>;
type SqlQueryParams=Parameters<SqlClient['query']>[1];
function asRows(value:unknown):DbRow[]{return Array.isArray(value)?value.filter((row):row is DbRow=>Boolean(row)&&typeof row==='object'&&!Array.isArray(row)):[];}
function errorText(error:unknown){return error instanceof Error?error.message:String(error);}
function missingColumn(error:unknown,column:string){const text=errorText(error).toLowerCase();return text.includes('column')&&text.includes(column.toLowerCase())&&text.includes('does not exist');}
function normalizeProduct(row:DbRow):Product{const base=row as unknown as Product;const imageUrls=Array.isArray(row.image_urls)?row.image_urls.filter((value):value is string=>typeof value==='string').map(value=>normalizePublicUrl(value)).filter(Boolean):[];return {...base,category_id:typeof row.category_id==='string'?row.category_id:null,image_urls:imageUrls,tags:Array.isArray(row.tags)?row.tags.filter((value):value is string=>typeof value==='string'):[],badge:String(row.badge||''),customization_fields:Array.isArray(row.customization_fields)?row.customization_fields as ProductCustomizationField[]:[],publish_at:row.publish_at?new Date(String(row.publish_at)).toISOString():null,unpublish_at:row.unpublish_at?new Date(String(row.unpublish_at)).toISOString():null,deleted_at:row.deleted_at?new Date(String(row.deleted_at)).toISOString():null};}
function normalizeProducts(rows:DbRow[]):Product[]{return rows.map(normalizeProduct);}
function normalizeCategory(row:DbRow):Category{const base=row as unknown as Category;const image=normalizePublicUrl(typeof row.image_url==='string'?row.image_url:'');return{...base,image_url:image||null};}
function normalizeInquiry(row:DbRow):Inquiry{const base=row as unknown as Inquiry;const eventBrief=row.event_brief&&typeof row.event_brief==='object'&&!Array.isArray(row.event_brief)?row.event_brief as InquiryEventBrief:{};return {...base,quote_items:Array.isArray(row.quote_items)?row.quote_items as InquiryQuoteItem[]:[],event_brief:eventBrief,quoted_value_cents:row.quoted_value_cents==null?null:Number(row.quoted_value_cents),paid_cents:Number(row.paid_cents||0),payment_status:(row.payment_status||'pendente') as Inquiry['payment_status'],production_status:(row.production_status||'nao_iniciado') as Inquiry['production_status'],production_due_at:row.production_due_at?new Date(String(row.production_due_at)).toISOString():null,review_requested_at:row.review_requested_at?new Date(String(row.review_requested_at)).toISOString():null,repurchase_contacted_at:row.repurchase_contacted_at?new Date(String(row.repurchase_contacted_at)).toISOString():null,repurchase_contact_year:row.repurchase_contact_year==null?null:Number(row.repurchase_contact_year),repurchase_next_anniversary:row.repurchase_next_anniversary?String(row.repurchase_next_anniversary):undefined,repurchase_cycle_year:row.repurchase_cycle_year==null?undefined:Number(row.repurchase_cycle_year),anonymized_at:row.anonymized_at?new Date(String(row.anonymized_at)).toISOString():null,version:Math.max(1,Number(row.version||1))};}
function normalizeInquiries(rows:DbRow[]):Inquiry[]{return rows.map(normalizeInquiry);}
function normalizeMarketingCampaign(row:DbRow):MarketingCampaign{const base=row as unknown as MarketingCampaign;return {...base,starts_at:row.starts_at?new Date(String(row.starts_at)).toISOString():null,ends_at:row.ends_at?new Date(String(row.ends_at)).toISOString():null,goal_leads:Number(row.goal_leads||0),goal_revenue_cents:Number(row.goal_revenue_cents||0),spend_cents:Number(row.spend_cents||0)};}
function replayDate(value:unknown){if(!value)return null;const date=new Date(String(value));return Number.isNaN(date.getTime())?String(value):date.toISOString();}
async function resolveIdempotentCreate<T>(scope:AdminCreateScope,id:string,inserted:DbRow|undefined,load:()=>Promise<DbRow|undefined>,normalize:(row:DbRow)=>T,existingPayload:(value:T)=>unknown,requestedPayload:unknown):Promise<{value:T;created:boolean}>{
  if(inserted)return{value:normalize(inserted),created:true};
  const row=await load();if(!row)throw new CreateUniqueConflictError(scope);
  const value=normalize(row);assertIdempotentReplay(scope,existingPayload(value),requestedPayload);return{value,created:false};
}
async function query(sql:SqlClient,text:string,params:unknown[]=[]):Promise<DbRow[]>{const rows=await sql.query(text,params as SqlQueryParams);return asRows(rows);}


export async function getProducts(includeInactive = false): Promise<Product[]> {
  const sql=getSql(); if(!sql) return demoProducts;
  if(includeInactive){try{const rows=await sql`SELECT * FROM products WHERE deleted_at IS NULL ORDER BY featured DESC,sort_order ASC,created_at DESC`;return normalizeProducts(asRows(rows));}catch(error){if(!missingColumn(error,'deleted_at'))throw error;const rows=await sql`SELECT * FROM products ORDER BY featured DESC,sort_order ASC,created_at DESC`;return normalizeProducts(asRows(rows));}}
  try{
    const rows=await sql`SELECT p.* FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active=true AND c.active=true AND (p.publish_at IS NULL OR p.publish_at<=now()) AND (p.unpublish_at IS NULL OR p.unpublish_at>now()) ORDER BY p.featured DESC,p.sort_order ASC,p.created_at DESC`;
    return normalizeProducts(asRows(rows));
  }catch(error){
    if(!missingColumn(error,'category_id')&&!missingColumn(error,'publish_at')&&!missingColumn(error,'unpublish_at'))throw error;
    const rows=await sql`SELECT p.* FROM products p WHERE p.active=true AND EXISTS(SELECT 1 FROM categories c WHERE c.name=p.category AND c.active=true) ORDER BY p.featured DESC,p.sort_order ASC,p.created_at DESC`;
    return normalizeProducts(asRows(rows));
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  const sql = getSql();
  if (!sql) return demoProducts.find((p) => p.id === id) || null;
  const rows = await sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
  return rows[0] ? normalizeProduct(rows[0]) : null;
}

export async function getProductBySlug(slug:string,includeInactive=false):Promise<Product|null>{
  const sql=getSql(); if(!sql)return demoProducts.find(p=>p.slug===slug)||null;
  if(includeInactive){try{const rows=await sql`SELECT * FROM products WHERE slug=${slug} AND deleted_at IS NULL LIMIT 1`;return rows[0]?normalizeProduct(rows[0]):null;}catch(error){if(!missingColumn(error,'deleted_at'))throw error;const rows=await sql`SELECT * FROM products WHERE slug=${slug} LIMIT 1`;return rows[0]?normalizeProduct(rows[0]):null;}}
  try{const rows=await sql`SELECT p.* FROM products p JOIN categories c ON c.id=p.category_id WHERE p.slug=${slug} AND p.active=true AND c.active=true AND (p.publish_at IS NULL OR p.publish_at<=now()) AND (p.unpublish_at IS NULL OR p.unpublish_at>now()) LIMIT 1`;return rows[0]?normalizeProduct(rows[0]):null;}
  catch(error){if(!missingColumn(error,'category_id')&&!missingColumn(error,'publish_at')&&!missingColumn(error,'unpublish_at'))throw error;const rows=await sql`SELECT p.* FROM products p WHERE p.slug=${slug} AND p.active=true AND EXISTS(SELECT 1 FROM categories c WHERE c.name=p.category AND c.active=true) LIMIT 1`;return rows[0]?normalizeProduct(rows[0]):null;}
}

export async function createProduct(input: Omit<Product, 'id' | 'created_at' | 'updated_at'>) {
  const sql = getSql();
  if (!sql) throw new Error('DATABASE_URL não configurada.');
  const rows = await query(sql,`
    INSERT INTO products (slug,name,category,description,price_cents,image_urls,featured,active,stock_status,tags,sort_order,min_quantity,production_time,seo_title,seo_description,badge,customization_fields,publish_at,unpublish_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$19) RETURNING *
  `,[input.slug,input.name,input.category,input.description,input.price_cents,input.image_urls,input.featured,input.active,input.stock_status,input.tags,input.sort_order,input.min_quantity,input.production_time,input.seo_title,input.seo_description,input.badge,JSON.stringify(input.customization_fields||[]),input.publish_at,input.unpublish_at]);
  return normalizeProduct(rows[0]);
}

export async function createProductIdempotent(input:Omit<Product,'id'|'created_at'|'updated_at'>,idempotencyKey:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const id=adminCreateIdFromKey('product',idempotencyKey);
  const params:unknown[]=[id,input.slug,input.name,input.category,input.description,input.price_cents,input.image_urls,input.featured,input.active,input.stock_status,input.tags,input.sort_order,input.min_quantity,input.production_time,input.seo_title,input.seo_description,input.badge,JSON.stringify(input.customization_fields||[]),input.publish_at,input.unpublish_at];
  const rows=await query(sql,`INSERT INTO products (id,slug,name,category,description,price_cents,image_urls,featured,active,stock_status,tags,sort_order,min_quantity,production_time,seo_title,seo_description,badge,customization_fields,publish_at,unpublish_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18::jsonb,$19,$20) ON CONFLICT DO NOTHING RETURNING *`,params);
  const requested={slug:input.slug,name:input.name,category:input.category,description:input.description,price_cents:input.price_cents,image_urls:input.image_urls,featured:input.featured,active:input.active,stock_status:input.stock_status,tags:input.tags,sort_order:input.sort_order,min_quantity:input.min_quantity,production_time:input.production_time,seo_title:input.seo_title,seo_description:input.seo_description,badge:input.badge,customization_fields:input.customization_fields||[],publish_at:input.publish_at,unpublish_at:input.unpublish_at};
  const result=await resolveIdempotentCreate('product',id,rows[0],async()=>{const existing=await query(sql,`SELECT * FROM products WHERE id=$1 LIMIT 1`,[id]);return existing[0];},normalizeProduct,value=>({slug:value.slug,name:value.name,category:value.category,description:value.description,price_cents:value.price_cents,image_urls:value.image_urls,featured:value.featured,active:value.active,stock_status:value.stock_status,tags:value.tags,sort_order:value.sort_order,min_quantity:value.min_quantity,production_time:value.production_time,seo_title:value.seo_title,seo_description:value.seo_description,badge:value.badge,customization_fields:value.customization_fields||[],publish_at:value.publish_at,unpublish_at:value.unpublish_at}),requested);
  return{product:result.value,created:result.created};
}

export async function updateProduct(id:string,input:Omit<Product,'id'|'created_at'|'updated_at'>,expectedUpdatedAt:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');
  const params:unknown[]=[input.slug,input.name,input.category,input.description,input.price_cents,input.image_urls,input.featured,input.active,input.stock_status,input.tags,input.sort_order,input.min_quantity,input.production_time,input.seo_title,input.seo_description,input.badge,JSON.stringify(input.customization_fields||[]),input.publish_at,input.unpublish_at,id,expectedUpdatedAt];
  const text=`UPDATE products SET slug=$1,name=$2,category=$3,description=$4,price_cents=$5,image_urls=$6,featured=$7,active=$8,stock_status=$9,tags=$10,sort_order=$11,min_quantity=$12,production_time=$13,seo_title=$14,seo_description=$15,badge=$16,customization_fields=$17::jsonb,publish_at=$18,unpublish_at=$19,updated_at=now() WHERE id=$20 AND updated_at=$21 RETURNING *`;
  const rows=await query(sql,text,params);if(rows[0])return normalizeProduct(rows[0]);const exists=await query(sql,`SELECT 1 FROM products WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return undefined;
}

export async function deleteProduct(id:string,expectedUpdatedAt:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');
  try{const rows=await query(sql,`UPDATE products SET active=false,deleted_at=now(),updated_at=now() WHERE id=$1 AND deleted_at IS NULL AND updated_at=$2 RETURNING *`,[id,expectedUpdatedAt]);if(rows[0])return normalizeProduct(rows[0]);const exists=await query(sql,`SELECT 1 FROM products WHERE id=$1 AND deleted_at IS NULL LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return undefined;}
  catch(error){if(error instanceof StaleWriteError)throw error;if(!missingColumn(error,'deleted_at'))throw error;const rows=await query(sql,`UPDATE products SET active=false,updated_at=now() WHERE id=$1 AND updated_at=$2 RETURNING *`,[id,expectedUpdatedAt]);if(rows[0])return normalizeProduct(rows[0]);const exists=await query(sql,`SELECT 1 FROM products WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return undefined;}
}
export async function getArchivedProducts():Promise<Product[]>{const sql=getSql();if(!sql)return[];try{return normalizeProducts(await query(sql,`SELECT * FROM products WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC LIMIT 500`));}catch(error){if(missingColumn(error,'deleted_at'))return[];throw error;}}
export async function restoreProduct(id:string,expectedUpdatedAt:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');try{const rows=await query(sql,`UPDATE products SET deleted_at=NULL,active=false,updated_at=now() WHERE id=$1 AND deleted_at IS NOT NULL AND updated_at=$2 RETURNING *`,[id,expectedUpdatedAt]);if(rows[0])return normalizeProduct(rows[0]);const exists=await query(sql,`SELECT 1 FROM products WHERE id=$1 AND deleted_at IS NOT NULL LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return undefined;}catch(error){if(error instanceof StaleWriteError)throw error;if(missingColumn(error,'deleted_at'))return undefined;throw error;}}
export async function permanentlyDeleteProduct(id:string,expectedUpdatedAt:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');try{const rows=await query(sql,`DELETE FROM products WHERE id=$1 AND deleted_at IS NOT NULL AND updated_at=$2 RETURNING id`,[id,expectedUpdatedAt]);if(rows[0])return true;const exists=await query(sql,`SELECT 1 FROM products WHERE id=$1 AND deleted_at IS NOT NULL LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return false;}catch(error){if(error instanceof StaleWriteError)throw error;if(missingColumn(error,'deleted_at'))throw new Error('ARCHIVE_SCHEMA_REQUIRED');throw error;}}


export class ProductPublishReadinessError extends Error{blockers:string[];constructor(blockers:string[]){super('PRODUCTS_NOT_READY');this.name='ProductPublishReadinessError';this.blockers=blockers;}}
export type ProductBulkAction='publish'|'hide'|'feature'|'unfeature'|'move_category';
export type ProductVersionRef={id:string;updated_at:string};
export async function bulkUpdateProducts(refs:ProductVersionRef[],action:ProductBulkAction,categoryId?:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const safe=refs.slice(0,200);if(!safe.length)return[] as Product[];const expected=JSON.stringify(safe);
  if(action==='publish'){
    const blockers=await query(sql,`WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(id uuid,updated_at timestamptz)) SELECT p.name FROM products p JOIN expected e ON e.id=p.id AND e.updated_at=p.updated_at LEFT JOIN categories c ON c.id=p.category_id WHERE p.deleted_at IS NULL AND (cardinality(COALESCE(p.image_urls,'{}'::text[]))=0 OR length(trim(p.description))<20 OR trim(COALESCE(p.production_time,''))='' OR p.category_id IS NULL OR c.active IS DISTINCT FROM true) ORDER BY p.name LIMIT 20`,[expected]);
    if(blockers.length)throw new ProductPublishReadinessError(blockers.map(row=>String(row.name)));
  }
  let rows:DbRow[]=[];
  if(action==='move_category'){
    if(!categoryId)throw new Error('CATEGORY_REQUIRED');const category=await query(sql,`SELECT id FROM categories WHERE id=$1 AND active=true LIMIT 1`,[categoryId]);if(!category[0])throw new Error('CATEGORY_NOT_FOUND');
    rows=await query(sql,`WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(id uuid,updated_at timestamptz)), matched AS (SELECT count(*)::int n FROM products p JOIN expected e ON e.id=p.id AND e.updated_at=p.updated_at WHERE p.deleted_at IS NULL) UPDATE products p SET category_id=$2,updated_at=now() FROM expected e WHERE p.id=e.id AND p.updated_at=e.updated_at AND p.deleted_at IS NULL AND (SELECT n FROM matched)=(SELECT count(*) FROM expected) RETURNING p.*`,[expected,categoryId]);
  }else{
    const set=action==='publish'?'active=true':action==='hide'?'active=false':action==='feature'?'featured=true':'featured=false';
    rows=await query(sql,`WITH expected AS (SELECT * FROM jsonb_to_recordset($1::jsonb) AS e(id uuid,updated_at timestamptz)), matched AS (SELECT count(*)::int n FROM products p JOIN expected e ON e.id=p.id AND e.updated_at=p.updated_at WHERE p.deleted_at IS NULL) UPDATE products p SET ${set},updated_at=now() FROM expected e WHERE p.id=e.id AND p.updated_at=e.updated_at AND p.deleted_at IS NULL AND (SELECT n FROM matched)=(SELECT count(*) FROM expected) RETURNING p.*`,[expected]);
  }
  if(rows.length!==safe.length)throw new StaleWriteError('A ação em lote foi cancelada porque pelo menos um produto mudou em outra aba ou dispositivo. Nenhum produto foi alterado.');
  return normalizeProducts(rows);
}

export async function getCategories(includeInactive = false): Promise<Category[]> {
  const sql = getSql();
  if (!sql) return fallbackCategories.map((name, i) => ({
    id: `demo-cat-${i+1}`,
    slug: name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,''),
    name, description: '', image_url: null, active: true, sort_order: i+1,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString()
  }));
  const rows = includeInactive
    ? await sql`SELECT * FROM categories ORDER BY sort_order ASC, name ASC`
    : await sql`SELECT * FROM categories WHERE active=true ORDER BY sort_order ASC, name ASC`;
  return asRows(rows).map(normalizeCategory);
}

export async function createCategory(input: Omit<Category,'id'|'created_at'|'updated_at'>) {
  const sql = getSql();
  if (!sql) throw new Error('DATABASE_URL não configurada.');
  const rows = await sql`
    INSERT INTO categories (slug,name,description,image_url,active,sort_order)
    VALUES (${input.slug},${input.name},${input.description},${input.image_url},${input.active},${input.sort_order}) RETURNING *
  `;
  return normalizeCategory(rows[0] as DbRow);
}

export async function createCategoryIdempotent(input:Omit<Category,'id'|'created_at'|'updated_at'>,idempotencyKey:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const id=adminCreateIdFromKey('category',idempotencyKey);
  const rows=await query(sql,`INSERT INTO categories (id,slug,name,description,image_url,active,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING *`,[id,input.slug,input.name,input.description,input.image_url,input.active,input.sort_order]);
  const requested={slug:input.slug,name:input.name,description:input.description,image_url:input.image_url||null,active:input.active,sort_order:input.sort_order};
  const result=await resolveIdempotentCreate('category',id,rows[0],async()=>{const existing=await query(sql,`SELECT * FROM categories WHERE id=$1 LIMIT 1`,[id]);return existing[0];},normalizeCategory,value=>({slug:value.slug,name:value.name,description:value.description,image_url:value.image_url||null,active:value.active,sort_order:value.sort_order}),requested);
  return{category:result.value,created:result.created};
}

export async function updateCategory(id:string,input:Omit<Category,'id'|'created_at'|'updated_at'>,expectedUpdatedAt:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');
  const params:unknown[]=[input.slug,input.name,input.description,input.image_url,input.active,input.sort_order,id,expectedUpdatedAt];
  const text=`UPDATE categories SET slug=$1,name=$2,description=$3,image_url=$4,active=$5,sort_order=$6,updated_at=now() WHERE id=$7 AND updated_at=$8 RETURNING *`;
  const rows=await query(sql,text,params);if(rows[0])return normalizeCategory(rows[0]);const exists=await query(sql,`SELECT 1 FROM categories WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return undefined;
}

export async function deleteCategory(id:string,expectedUpdatedAt:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');
  const rows=await query(sql,`DELETE FROM categories c WHERE c.id=$1 AND c.updated_at=$2 AND NOT EXISTS (SELECT 1 FROM products p WHERE p.category_id=c.id OR p.category=c.name) RETURNING id`,[id,expectedUpdatedAt]);
  if(rows[0])return true;
  const current=await query(sql,`SELECT updated_at FROM categories WHERE id=$1 LIMIT 1`,[id]);if(!current[0])return false;
  if(new Date(String(current[0].updated_at)).getTime()!==new Date(expectedUpdatedAt).getTime())throw new StaleWriteError();
  return false;
}


export async function categoryExists(name:string){
  const sql=getSql();
  if(!sql) return fallbackCategories.includes(name as (typeof fallbackCategories)[number]);
  const rows=await sql`SELECT id FROM categories WHERE name=${name} AND active=true LIMIT 1`;
  return Boolean(rows[0]);
}


export async function getTestimonials(includeInactive=false):Promise<Testimonial[]> {
  const sql=getSql(); if(!sql) return [];
  try{
    const rows=includeInactive
      ? await sql`SELECT * FROM testimonials ORDER BY sort_order ASC, created_at DESC`
      : await sql`SELECT * FROM testimonials WHERE active=true ORDER BY sort_order ASC, created_at DESC`;
    return rows as Testimonial[];
  }catch{return [];}
}

export async function createTestimonial(input:Omit<Testimonial,'id'|'created_at'|'updated_at'>){
  const sql=getSql(); if(!sql) throw new Error('DATABASE_URL não configurada.');
  const rows=await sql`INSERT INTO testimonials (name,location,quote,rating,active,sort_order) VALUES (${input.name},${input.location},${input.quote},${input.rating},${input.active},${input.sort_order}) RETURNING *`;
  return rows[0] as Testimonial;
}

export async function createTestimonialIdempotent(input:Omit<Testimonial,'id'|'created_at'|'updated_at'>,idempotencyKey:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const id=adminCreateIdFromKey('testimonial',idempotencyKey);
  const rows=await query(sql,`INSERT INTO testimonials (id,name,location,quote,rating,active,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING *`,[id,input.name,input.location,input.quote,input.rating,input.active,input.sort_order]);
  const normalize=(row:DbRow)=>row as unknown as Testimonial;const requested={name:input.name,location:input.location,quote:input.quote,rating:input.rating,active:input.active,sort_order:input.sort_order};
  const result=await resolveIdempotentCreate('testimonial',id,rows[0],async()=>{const existing=await query(sql,`SELECT * FROM testimonials WHERE id=$1 LIMIT 1`,[id]);return existing[0];},normalize,value=>({name:value.name,location:value.location,quote:value.quote,rating:Number(value.rating),active:Boolean(value.active),sort_order:Number(value.sort_order)}),requested);
  return{testimonial:result.value,created:result.created};
}

export async function updateTestimonial(id:string,input:Omit<Testimonial,'id'|'created_at'|'updated_at'>,expectedUpdatedAt:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const params:unknown[]=[input.name,input.location,input.quote,input.rating,input.active,input.sort_order,id,expectedUpdatedAt];
  const rows=await query(sql,`UPDATE testimonials SET name=$1,location=$2,quote=$3,rating=$4,active=$5,sort_order=$6,updated_at=now() WHERE id=$7 AND updated_at=$8 RETURNING *`,params);if(rows[0])return rows[0] as Testimonial;const exists=await query(sql,`SELECT 1 FROM testimonials WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return undefined;
}

export async function deleteTestimonial(id:string,expectedUpdatedAt:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const rows=await query(sql,`DELETE FROM testimonials WHERE id=$1 AND updated_at=$2 RETURNING id`,[id,expectedUpdatedAt]);if(rows[0])return true;const exists=await query(sql,`SELECT 1 FROM testimonials WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return false;}

export async function getSocialContentPlans(limit=200):Promise<SocialContentPlan[]>{const sql=getSql();if(!sql)return[];try{return await query(sql,`SELECT * FROM social_content_plans ORDER BY CASE status WHEN 'planejado' THEN 0 WHEN 'publicado' THEN 1 ELSE 2 END,planned_at ASC LIMIT $1`,[Math.min(5000,Math.max(1,limit))]) as SocialContentPlan[];}catch{return[];}}
export async function createSocialContentPlan(input:Omit<SocialContentPlan,'id'|'created_at'|'updated_at'>){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const rows=await query(sql,`INSERT INTO social_content_plans(title,channel,planned_at,status,product_id,campaign,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *`,[input.title,input.channel,input.planned_at,input.status,input.product_id||null,input.campaign,input.notes]);return rows[0] as SocialContentPlan;}
export async function createSocialContentPlanIdempotent(input:Omit<SocialContentPlan,'id'|'created_at'|'updated_at'>,idempotencyKey:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const id=adminCreateIdFromKey('social_plan',idempotencyKey);const rows=await query(sql,`INSERT INTO social_content_plans(id,title,channel,planned_at,status,product_id,campaign,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING *`,[id,input.title,input.channel,input.planned_at,input.status,input.product_id||null,input.campaign,input.notes]);const requested={title:input.title,channel:input.channel,planned_at:replayDate(input.planned_at),status:input.status,product_id:input.product_id||null,campaign:input.campaign,notes:input.notes};const normalize=(row:DbRow)=>row as unknown as SocialContentPlan;const result=await resolveIdempotentCreate('social_plan',id,rows[0],async()=>{const existing=await query(sql,`SELECT * FROM social_content_plans WHERE id=$1 LIMIT 1`,[id]);return existing[0];},normalize,value=>({title:value.title,channel:value.channel,planned_at:replayDate(value.planned_at),status:value.status,product_id:value.product_id||null,campaign:value.campaign,notes:value.notes}),requested);return{plan:result.value,created:result.created};}
export async function updateSocialContentPlan(id:string,input:Omit<SocialContentPlan,'id'|'created_at'|'updated_at'>,expectedUpdatedAt:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const params:unknown[]=[input.title,input.channel,input.planned_at,input.status,input.product_id||null,input.campaign,input.notes,id,expectedUpdatedAt];const rows=await query(sql,`UPDATE social_content_plans SET title=$1,channel=$2,planned_at=$3,status=$4,product_id=$5,campaign=$6,notes=$7,updated_at=now() WHERE id=$8 AND updated_at=$9 RETURNING *`,params);if(rows[0])return rows[0] as SocialContentPlan;const exists=await query(sql,`SELECT 1 FROM social_content_plans WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return undefined;}
export async function deleteSocialContentPlan(id:string,expectedUpdatedAt:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const rows=await query(sql,`DELETE FROM social_content_plans WHERE id=$1 AND updated_at=$2 RETURNING id`,[id,expectedUpdatedAt]);if(rows[0])return true;const exists=await query(sql,`SELECT 1 FROM social_content_plans WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return false;}


function agendaIso(value:unknown,allDay=false){
  if(!value)return'';
  if(allDay){const raw=String(value);const match=raw.match(/^(\d{4}-\d{2}-\d{2})/);return match?.[1]||'';}
  const date=new Date(String(value));return Number.isNaN(date.getTime())?'':date.toISOString();
}
function agendaItem(row:DbRow,kind:AdminAgendaKind,allDay=false):AdminAgendaItem|null{
  const date=agendaIso(row.date,allDay);if(!date)return null;
  const href=String(row.href||'').trim();
  return{id:String(row.id||''),kind,date,title:String(row.title||'').slice(0,180),subtitle:String(row.subtitle||'').slice(0,320),...(href?{href}:{}),all_day:allDay};
}
export async function getAdminAgenda(days=60):Promise<AdminAgendaWorkspace>{
  const safeDays=normalizeAdminAgendaDays(days);const generatedAt=new Date().toISOString();
  const empty:AdminAgendaWorkspace={days:safeDays,generated_at:generatedAt,items:[],summary:{total:0,next_7:0,events:0,follow_ups:0,production:0,publications:0}};
  const sql=getSql();if(!sql)return empty;
  const [eventRows,followRows,productionRows,socialRows,publicationRows]=await Promise.all([
    query(sql,`SELECT 'event-'||id::text AS id,event_date AS date,name AS title,concat(CASE WHEN COALESCE(event_brief->>'theme','')<>'' THEN 'Tema: '||(event_brief->>'theme')||' • ' ELSE '' END,CASE WHEN jsonb_array_length(COALESCE(quote_items,'[]'::jsonb))>0 THEN jsonb_array_length(COALESCE(quote_items,'[]'::jsonb))::text||' item(ns)' ELSE COALESCE(NULLIF(product_name,''),NULLIF(category,''),'Projeto personalizado') END) AS subtitle,'/admin/orcamentos/'||id::text||'/proposta' AS href FROM inquiries WHERE status<>'perdido' AND event_date IS NOT NULL AND event_date BETWEEN CURRENT_DATE-1 AND CURRENT_DATE+$1::int ORDER BY event_date,id`,[safeDays]),
    query(sql,`SELECT 'follow-'||id::text AS id,follow_up_at AS date,'Retornar para '||name AS title,whatsapp AS subtitle,'' AS href FROM inquiries WHERE status NOT IN ('fechado','perdido') AND follow_up_at IS NOT NULL AND follow_up_at>=now()-interval '1 day' AND follow_up_at<now()+($1::text||' days')::interval+interval '1 day' ORDER BY follow_up_at,id`,[safeDays]),
    query(sql,`SELECT 'production-'||id::text AS id,production_due_at AS date,'Produção — '||name AS title,replace(COALESCE(production_status,'nao_iniciado'),'_',' ')||' • '||COALESCE(NULLIF(product_name,''),NULLIF(category,''),'Pedido personalizado') AS subtitle,'/admin?tab=producao' AS href FROM inquiries WHERE status='fechado' AND COALESCE(production_status,'nao_iniciado')<>'entregue' AND production_due_at IS NOT NULL AND production_due_at>=now()-interval '90 days' AND production_due_at<now()+($1::text||' days')::interval+interval '1 day' ORDER BY production_due_at,id`,[safeDays]),
    query(sql,`SELECT 'social-'||id::text AS id,planned_at AS date,title,channel||CASE WHEN COALESCE(campaign,'')<>'' THEN ' • '||campaign ELSE '' END AS subtitle,'' AS href FROM social_content_plans WHERE status='planejado' AND planned_at>=now()-interval '1 day' AND planned_at<now()+($1::text||' days')::interval+interval '1 day' ORDER BY planned_at,id`,[safeDays]),
    query(sql,`SELECT 'pub-'||id::text AS id,publish_at AS date,name AS title,'Entrar no ar • '||category AS subtitle,'/catalogo/'||slug||'?preview=1' AS href,'publicacao' AS agenda_kind FROM products WHERE active=true AND deleted_at IS NULL AND publish_at IS NOT NULL AND publish_at>=now()-interval '1 day' AND publish_at<now()+($1::text||' days')::interval+interval '1 day' UNION ALL SELECT 'unpub-'||id::text AS id,unpublish_at AS date,name AS title,'Retirar do catálogo • '||category AS subtitle,'/catalogo/'||slug||'?preview=1' AS href,'retirada' AS agenda_kind FROM products WHERE active=true AND deleted_at IS NULL AND unpublish_at IS NOT NULL AND unpublish_at>=now()-interval '1 day' AND unpublish_at<now()+($1::text||' days')::interval+interval '1 day' ORDER BY date,id`,[safeDays])
  ]);
  const items:AdminAgendaItem[]=[];
  for(const row of eventRows){const item=agendaItem(row,'evento',true);if(item)items.push(item);}
  for(const row of followRows){const item=agendaItem(row,'retorno');if(item)items.push(item);}
  for(const row of productionRows){const item=agendaItem(row,'producao');if(item)items.push(item);}
  for(const row of socialRows){const item=agendaItem(row,'divulgacao');if(item)items.push(item);}
  for(const row of publicationRows){const kind=row.agenda_kind==='retirada'?'retirada':'publicacao';const item=agendaItem(row,kind);if(item)items.push(item);}
  items.sort((a,b)=>{const av=a.all_day?new Date(`${a.date}T12:00:00`).getTime():new Date(a.date).getTime();const bv=b.all_day?new Date(`${b.date}T12:00:00`).getTime():new Date(b.date).getTime();return av-bv||a.id.localeCompare(b.id);});
  const now=Date.now(),next7=now+7*86400000;const itemTime=(item:AdminAgendaItem)=>item.all_day?new Date(`${item.date}T12:00:00`).getTime():new Date(item.date).getTime();
  return{days:safeDays,generated_at:generatedAt,items,summary:{total:items.length,next_7:items.filter(item=>{const t=itemTime(item);return t>=now&&t<=next7;}).length,events:items.filter(item=>item.kind==='evento').length,follow_ups:items.filter(item=>item.kind==='retorno').length,production:items.filter(item=>item.kind==='producao').length,publications:items.filter(item=>['publicacao','retirada','divulgacao'].includes(item.kind)).length}};
}


export async function getMarketingCampaigns(limit=200):Promise<MarketingCampaign[]>{const sql=getSql();if(!sql)return[];try{const rows=await query(sql,`SELECT * FROM marketing_campaigns ORDER BY CASE status WHEN 'ativa' THEN 0 WHEN 'planejada' THEN 1 ELSE 2 END,COALESCE(starts_at,created_at) DESC LIMIT $1`,[Math.min(5000,Math.max(1,limit))]);return rows.map(normalizeMarketingCampaign);}catch{return[];}}
export async function createMarketingCampaign(input:Omit<MarketingCampaign,'id'|'created_at'|'updated_at'>){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');try{const rows=await query(sql,`INSERT INTO marketing_campaigns(name,slug,channel,status,starts_at,ends_at,goal_leads,goal_revenue_cents,spend_cents,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,[input.name,input.slug,input.channel,input.status,input.starts_at||null,input.ends_at||null,input.goal_leads,input.goal_revenue_cents,input.spend_cents,input.notes]);const row=rows[0];if(!row)throw new Error('CAMPAIGN_CREATE_FAILED');return normalizeMarketingCampaign(row);}catch(error){if(!missingColumn(error,'spend_cents'))throw error;const rows=await query(sql,`INSERT INTO marketing_campaigns(name,slug,channel,status,starts_at,ends_at,goal_leads,goal_revenue_cents,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[input.name,input.slug,input.channel,input.status,input.starts_at||null,input.ends_at||null,input.goal_leads,input.goal_revenue_cents,input.notes]);const row=rows[0];if(!row)throw new Error('CAMPAIGN_CREATE_FAILED');return normalizeMarketingCampaign({...row,spend_cents:0});}}
export async function createMarketingCampaignIdempotent(input:Omit<MarketingCampaign,'id'|'created_at'|'updated_at'>,idempotencyKey:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const id=adminCreateIdFromKey('marketing_campaign',idempotencyKey);let rows:DbRow[];try{rows=await query(sql,`INSERT INTO marketing_campaigns(id,name,slug,channel,status,starts_at,ends_at,goal_leads,goal_revenue_cents,spend_cents,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING RETURNING *`,[id,input.name,input.slug,input.channel,input.status,input.starts_at||null,input.ends_at||null,input.goal_leads,input.goal_revenue_cents,input.spend_cents,input.notes]);}catch(error){if(!missingColumn(error,'spend_cents'))throw error;rows=await query(sql,`INSERT INTO marketing_campaigns(id,name,slug,channel,status,starts_at,ends_at,goal_leads,goal_revenue_cents,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT DO NOTHING RETURNING *`,[id,input.name,input.slug,input.channel,input.status,input.starts_at||null,input.ends_at||null,input.goal_leads,input.goal_revenue_cents,input.notes]);}const requested={name:input.name,slug:input.slug,channel:input.channel,status:input.status,starts_at:replayDate(input.starts_at),ends_at:replayDate(input.ends_at),goal_leads:input.goal_leads,goal_revenue_cents:input.goal_revenue_cents,spend_cents:input.spend_cents,notes:input.notes};const result=await resolveIdempotentCreate('marketing_campaign',id,rows[0],async()=>{const existing=await query(sql,`SELECT * FROM marketing_campaigns WHERE id=$1 LIMIT 1`,[id]);return existing[0];},normalizeMarketingCampaign,value=>({name:value.name,slug:value.slug,channel:value.channel,status:value.status,starts_at:replayDate(value.starts_at),ends_at:replayDate(value.ends_at),goal_leads:value.goal_leads,goal_revenue_cents:value.goal_revenue_cents,spend_cents:value.spend_cents,notes:value.notes}),requested);return{campaign:result.value,created:result.created};}
export async function updateMarketingCampaign(id:string,input:Omit<MarketingCampaign,'id'|'created_at'|'updated_at'>,expectedUpdatedAt:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');
  async function resolveMiss(){const current=await query(sql,`SELECT slug FROM marketing_campaigns WHERE id=$1 LIMIT 1`,[id]);if(!current[0])return undefined;if(String(current[0].slug)!==input.slug)throw new CampaignSlugImmutableError();throw new StaleWriteError();}
  try{
    const params:unknown[]=[input.name,input.slug,input.channel,input.status,input.starts_at||null,input.ends_at||null,input.goal_leads,input.goal_revenue_cents,input.spend_cents,input.notes,id,expectedUpdatedAt];
    const text=`UPDATE marketing_campaigns SET name=$1,slug=$2,channel=$3,status=$4,starts_at=$5,ends_at=$6,goal_leads=$7,goal_revenue_cents=$8,spend_cents=$9,notes=$10,updated_at=now() WHERE id=$11 AND slug=$2 AND updated_at=$12 RETURNING *`;
    const rows=await query(sql,text,params);if(!rows[0])return resolveMiss();return normalizeMarketingCampaign(rows[0]);
  }catch(error){
    if(error instanceof CampaignSlugImmutableError||error instanceof StaleWriteError)throw error;
    if(errorText(error).includes('MARKETING_CAMPAIGN_SLUG_IMMUTABLE'))throw new CampaignSlugImmutableError();
    if(!missingColumn(error,'spend_cents'))throw error;
    const params:unknown[]=[input.name,input.slug,input.channel,input.status,input.starts_at||null,input.ends_at||null,input.goal_leads,input.goal_revenue_cents,input.notes,id,expectedUpdatedAt];
    const text=`UPDATE marketing_campaigns SET name=$1,slug=$2,channel=$3,status=$4,starts_at=$5,ends_at=$6,goal_leads=$7,goal_revenue_cents=$8,notes=$9,updated_at=now() WHERE id=$10 AND slug=$2 AND updated_at=$11 RETURNING *`;
    const rows=await query(sql,text,params);if(!rows[0])return resolveMiss();return normalizeMarketingCampaign({...rows[0],spend_cents:0});
  }
}
export async function deleteMarketingCampaign(id:string,expectedUpdatedAt:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const rows=await query(sql,`SELECT slug,updated_at FROM marketing_campaigns WHERE id=$1 LIMIT 1`,[id]);if(!rows[0])return false;if(new Date(String(rows[0].updated_at)).getTime()!==new Date(expectedUpdatedAt).getTime())throw new StaleWriteError();const slug=String(rows[0].slug||'');try{const usage=await query(sql,`SELECT COUNT(*)::int AS total FROM inquiries WHERE COALESCE(event_brief->'attribution'->>'campaign','')=$1`,[slug]);const leadCount=Number(usage[0]?.total||0);if(leadCount>0)throw new CampaignHasLeadsError(leadCount);}catch(error){if(error instanceof CampaignHasLeadsError)throw error;if(!missingColumn(error,'event_brief'))throw error;}const deleted=await query(sql,`DELETE FROM marketing_campaigns WHERE id=$1 AND updated_at=$2 RETURNING id`,[id,expectedUpdatedAt]);if(!deleted[0])throw new StaleWriteError();return true;}


export async function getSiteSettings(): Promise<SiteSettings> {
  const sql = getSql();
  if (!sql) return fallbackSiteSettings;
  try {
    const rows = await sql`SELECT * FROM site_settings WHERE id=1 LIMIT 1`;
    if (!rows[0]) return fallbackSiteSettings;
    const row = rows[0] as Record<string, unknown>;
    return {
      ...fallbackSiteSettings,
      ...row,
      brand_name: String(row.brand_name || fallbackSiteSettings.brand_name),
      brand_initial: String(row.brand_initial || fallbackSiteSettings.brand_initial),
      whatsapp_number: String(row.whatsapp_number || fallbackSiteSettings.whatsapp_number),
      logo_url: normalizePublicUrl(String(row.logo_url || fallbackSiteSettings.logo_url)),
      hero_image_url: normalizePublicUrl(String(row.hero_image_url || fallbackSiteSettings.hero_image_url)),
      instagram_url: normalizeExternalHttpsUrl(String(row.instagram_url || fallbackSiteSettings.instagram_url)),
      facebook_url: normalizeExternalHttpsUrl(String(row.facebook_url || fallbackSiteSettings.facebook_url)),
      tiktok_url: normalizeExternalHttpsUrl(String(row.tiktok_url || fallbackSiteSettings.tiktok_url)),
      pinterest_url: normalizeExternalHttpsUrl(String(row.pinterest_url || fallbackSiteSettings.pinterest_url)),
      youtube_url: normalizeExternalHttpsUrl(String(row.youtube_url || fallbackSiteSettings.youtube_url)),
      google_business_url: normalizeExternalHttpsUrl(String(row.google_business_url || fallbackSiteSettings.google_business_url)),
      google_review_url: normalizeExternalHttpsUrl(String(row.google_review_url || fallbackSiteSettings.google_review_url)),
      location: String(row.location || fallbackSiteSettings.location),
      seo_title: String(row.seo_title || fallbackSiteSettings.seo_title),
      seo_description: String(row.seo_description || fallbackSiteSettings.seo_description),
      announcement_link: normalizePublicUrl(String(row.announcement_link || '')),
      announcement_start_at: row.announcement_start_at ? new Date(row.announcement_start_at as string).toISOString() : '',
      announcement_end_at: row.announcement_end_at ? new Date(row.announcement_end_at as string).toISOString() : '',
      monthly_sales_goal_cents: Number(row.monthly_sales_goal_cents || 0),
      pricing_hourly_rate_cents: Number(row.pricing_hourly_rate_cents ?? fallbackSiteSettings.pricing_hourly_rate_cents),
      pricing_overhead_percent: Number(row.pricing_overhead_percent ?? fallbackSiteSettings.pricing_overhead_percent),
      pricing_waste_percent: Number(row.pricing_waste_percent ?? fallbackSiteSettings.pricing_waste_percent),
      pricing_target_margin_percent: Number(row.pricing_target_margin_percent ?? fallbackSiteSettings.pricing_target_margin_percent),
      pricing_payment_fee_percent: Number(row.pricing_payment_fee_percent ?? fallbackSiteSettings.pricing_payment_fee_percent),
    } as SiteSettings;
  } catch {
    return fallbackSiteSettings;
  }
}

export async function updateSiteSettings(input: SiteSettings,expectedUpdatedAt:string) {
  const sql = getSql();
  if (!sql) throw new Error('DATABASE_URL não configurada.');
  await query(sql,`INSERT INTO site_settings(id) VALUES(1) ON CONFLICT(id) DO NOTHING`);
  // O schema mínimo de produção é validado pelo readiness. Evitamos consultar
  // information_schema em cada salvamento e fazemos o controle otimista no
  // mesmo UPDATE para eliminar a janela read-then-write.
  const writable=[
    'brand_name','brand_initial','logo_url','hero_image_url','hero_eyebrow','hero_title','hero_highlight','hero_description',
    'whatsapp_number','instagram_url','facebook_url','tiktok_url','pinterest_url','youtube_url','google_business_url','google_review_url',
    'social_default_hashtags','bio_title','bio_description','monthly_sales_goal_cents','pricing_hourly_rate_cents','pricing_overhead_percent','pricing_waste_percent','pricing_target_margin_percent','pricing_payment_fee_percent',
    'whatsapp_template_first_contact','whatsapp_template_follow_up','whatsapp_template_quote_ready','whatsapp_template_confirmation','whatsapp_template_review_request','whatsapp_template_repurchase','whatsapp_template_approval','whatsapp_template_ready',
    'location','contact_email','announcement','announcement_link','announcement_start_at','announcement_end_at','about_title','about_text','seo_title','seo_description'
  ] as const;
  const params:unknown[]=writable.map(field=>{
    const value=(input as unknown as Record<string,unknown>)[field];
    if(field==='announcement_start_at'||field==='announcement_end_at')return value||null;
    return value;
  });
  const setters=writable.map((field,index)=>`${field}=$${index+1}`).join(',');
  params.push(expectedUpdatedAt);
  const text=`UPDATE site_settings SET ${setters},updated_at=now() WHERE id=1 AND updated_at=$${params.length} RETURNING *`;
  const rows=await query(sql,text,params);
  if(!rows[0])throw new StaleWriteError();
  return {...fallbackSiteSettings,...(rows[0]||{})} as SiteSettings;
}



async function addInquiryActivityWithSql(sql:SqlClient,inquiryId:string,kind:string,summary:string,metadata:Record<string,unknown>={}){
  try{await query(sql,`INSERT INTO inquiry_activity(inquiry_id,kind,summary,metadata) VALUES($1,$2,$3,$4::jsonb)`,[inquiryId,kind.slice(0,60),summary.slice(0,500),JSON.stringify(metadata)]);}catch{}
}
export async function addInquiryActivity(inquiryId:string,kind:string,summary:string,metadata:Record<string,unknown>={}){const sql=getSql();if(!sql)return;await addInquiryActivityWithSql(sql,inquiryId,kind,summary,metadata);}
export async function getInquiryActivity(inquiryId:string,limit=100):Promise<InquiryActivity[]>{const sql=getSql();if(!sql)return[];try{return await query(sql,`SELECT * FROM inquiry_activity WHERE inquiry_id=$1 ORDER BY created_at DESC LIMIT $2`,[inquiryId,Math.min(200,Math.max(1,limit))]) as InquiryActivity[];}catch{return[];}}
export async function getAllInquiryActivity(limit=5000):Promise<InquiryActivity[]>{const sql=getSql();if(!sql)return[];try{return await query(sql,`SELECT * FROM inquiry_activity ORDER BY created_at ASC LIMIT $1`,[Math.min(10000,Math.max(1,limit))]) as InquiryActivity[];}catch{return[];}}

export async function createInquiry(input:{name:string;whatsapp:string;email?:string;event_date?:string;product_id?:string;product_name?:string;category?:string;message:string;quote_items?:InquiryQuoteItem[];event_brief?:InquiryEventBrief;source?:string;idempotency_key?:string}):Promise<{inquiry:Inquiry;created:boolean}> {
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');
  const quoteItems=JSON.stringify(input.quote_items||[]),eventBrief=JSON.stringify(input.event_brief||{}),key=input.idempotency_key||null;const source=input.source||input.event_brief?.source||'site';
  try{
    // INSERT-first e timeline na MESMA instrução: ou o lead + atividade entram juntos,
    // ou nenhum deles é persistido. O índice idempotente arbitra retries concorrentes.
    const rows=await query(sql,`WITH inserted AS (
      INSERT INTO inquiries(name,whatsapp,email,event_date,product_id,product_name,category,message,quote_items,event_brief,source,idempotency_key)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11,$12)
      ON CONFLICT(idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
      RETURNING *
    ), activity AS (
      INSERT INTO inquiry_activity(inquiry_id,kind,summary,metadata)
      SELECT id,'created','Solicitação recebida pelo site.',jsonb_build_object('source',$11) FROM inserted
      RETURNING inquiry_id
    )
    SELECT inserted.*,true AS __created FROM inserted
    UNION ALL
    SELECT existing.*,false AS __created FROM inquiries existing
      WHERE $12::uuid IS NOT NULL AND existing.idempotency_key=$12::uuid AND NOT EXISTS(SELECT 1 FROM inserted)
    LIMIT 1`,[input.name,input.whatsapp,input.email||null,input.event_date||null,input.product_id||null,input.product_name||'',input.category||'',input.message,quoteItems,eventBrief,source,key]);
    if(rows[0])return{inquiry:normalizeInquiry(rows[0]),created:rows[0].__created===true};
    throw new Error('Não foi possível persistir o orçamento.');
  }catch(error){
    if(!missingColumn(error,'idempotency_key')&&!missingColumn(error,'version'))throw error;
    const rows=await query(sql,`WITH inserted AS (
      INSERT INTO inquiries(name,whatsapp,email,event_date,product_id,product_name,category,message,quote_items,event_brief,source)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11) RETURNING *
    ), activity AS (
      INSERT INTO inquiry_activity(inquiry_id,kind,summary,metadata)
      SELECT id,'created','Solicitação recebida pelo site.',jsonb_build_object('source',$11) FROM inserted RETURNING inquiry_id
    ) SELECT inserted.*,true AS __created FROM inserted`,[input.name,input.whatsapp,input.email||null,input.event_date||null,input.product_id||null,input.product_name||'',input.category||'',input.message,quoteItems,eventBrief,source]);
    if(!rows[0])throw new Error('Não foi possível persistir o orçamento.');return{inquiry:normalizeInquiry(rows[0]),created:true};
  }
}

const inquiryOperationalWhere=`(
  status NOT IN ('fechado','perdido')
  OR (
    status='fechado' AND (
      COALESCE(production_status,'nao_iniciado')<>'entregue'
      OR follow_up_at IS NOT NULL
      OR review_requested_at IS NULL
      OR (event_date IS NOT NULL AND event_date>=CURRENT_DATE)
    )
  )
)`;
const inquiryTerminalWhere=`NOT ${inquiryOperationalWhere}`;

export async function getInquiryCommercialSummary():Promise<InquiryCommercialSummary>{
  const empty:InquiryCommercialSummary={total:0,operational_count:0,new_count:0,closed_count:0,lost_count:0,decided_count:0,pipeline_value_cents:0,closed_value_cents:0,received_value_cents:0,receivable_value_cents:0,weighted_pipeline_cents:0,revenue_30_cents:0,month_revenue_cents:0,production_open_count:0,agenda_events_30_count:0,agenda_production_30_count:0};
  const sql=getSql();if(!sql)return empty;
  const rows=await query(sql,`SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER(WHERE ${inquiryOperationalWhere})::int AS operational_count,
    COUNT(*) FILTER(WHERE status='novo')::int AS new_count,
    COUNT(*) FILTER(WHERE status='fechado')::int AS closed_count,
    COUNT(*) FILTER(WHERE status='perdido')::int AS lost_count,
    COUNT(*) FILTER(WHERE status IN ('fechado','perdido'))::int AS decided_count,
    COALESCE(SUM(COALESCE(quoted_value_cents,0)) FILTER(WHERE status IN ('novo','contatado','orcado')),0)::bigint AS pipeline_value_cents,
    COALESCE(SUM(COALESCE(quoted_value_cents,0)) FILTER(WHERE status='fechado'),0)::bigint AS closed_value_cents,
    COALESCE(SUM(COALESCE(paid_cents,0)),0)::bigint AS received_value_cents,
    COALESCE(SUM(GREATEST(0,COALESCE(quoted_value_cents,0)-COALESCE(paid_cents,0))) FILTER(WHERE status='fechado'),0)::bigint AS receivable_value_cents,
    COALESCE(SUM(CASE status WHEN 'novo' THEN ROUND(COALESCE(quoted_value_cents,0)*0.15) WHEN 'contatado' THEN ROUND(COALESCE(quoted_value_cents,0)*0.35) WHEN 'orcado' THEN ROUND(COALESCE(quoted_value_cents,0)*0.65) ELSE 0 END),0)::bigint AS weighted_pipeline_cents,
    COALESCE(SUM(COALESCE(quoted_value_cents,0)) FILTER(WHERE status='fechado' AND closed_at>=now()-interval '30 days'),0)::bigint AS revenue_30_cents,
    COALESCE(SUM(COALESCE(quoted_value_cents,0)) FILTER(WHERE status='fechado' AND closed_at>=date_trunc('month',now())),0)::bigint AS month_revenue_cents,
    COUNT(*) FILTER(WHERE status='fechado' AND COALESCE(production_status,'nao_iniciado')<>'entregue')::int AS production_open_count,
    COUNT(*) FILTER(WHERE status<>'perdido' AND event_date BETWEEN CURRENT_DATE AND CURRENT_DATE+30)::int AS agenda_events_30_count,
    COUNT(*) FILTER(WHERE status='fechado' AND COALESCE(production_status,'nao_iniciado')<>'entregue' AND production_due_at>=now()-interval '1 day' AND production_due_at<now()+interval '30 days')::int AS agenda_production_30_count
  FROM inquiries`);
  const r=rows[0]||{};return{total:Number(r.total||0),operational_count:Number(r.operational_count||0),new_count:Number(r.new_count||0),closed_count:Number(r.closed_count||0),lost_count:Number(r.lost_count||0),decided_count:Number(r.decided_count||0),pipeline_value_cents:Number(r.pipeline_value_cents||0),closed_value_cents:Number(r.closed_value_cents||0),received_value_cents:Number(r.received_value_cents||0),receivable_value_cents:Number(r.receivable_value_cents||0),weighted_pipeline_cents:Number(r.weighted_pipeline_cents||0),revenue_30_cents:Number(r.revenue_30_cents||0),month_revenue_cents:Number(r.month_revenue_cents||0),production_open_count:Number(r.production_open_count||0),agenda_events_30_count:Number(r.agenda_events_30_count||0),agenda_production_30_count:Number(r.agenda_production_30_count||0)};
}

export async function getInquiryCommercialInsights(days=30):Promise<InquiryCommercialInsights>{
  const sql=getSql();if(!sql)return{source_rows:[],campaign_rows:[]};const safeDays=[7,30,90].includes(days)?days:30;
  const source=await query(sql,`SELECT COALESCE(NULLIF(event_brief->'attribution'->>'source',''),CASE source WHEN 'concierge' THEN 'Concierge' WHEN 'shared_list' THEN 'Lista compartilhada' ELSE 'Direto' END) AS source,COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE status='fechado')::int AS closed,COALESCE(SUM(COALESCE(quoted_value_cents,0)) FILTER(WHERE status='fechado'),0)::bigint AS closed_value FROM inquiries WHERE created_at>=now()-($1::text||' days')::interval GROUP BY 1 ORDER BY leads DESC,closed DESC LIMIT 10`,[String(safeDays)]);
  const campaigns=await query(sql,`SELECT COALESCE(NULLIF(event_brief->'attribution'->>'campaign',''),'') AS campaign,COALESCE(NULLIF(event_brief->'attribution'->>'source',''),'Direto') AS source,COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE status='fechado')::int AS closed,COALESCE(SUM(COALESCE(quoted_value_cents,0)) FILTER(WHERE status='fechado'),0)::bigint AS closed_value FROM inquiries WHERE created_at>=now()-($1::text||' days')::interval AND COALESCE(NULLIF(event_brief->'attribution'->>'campaign',''),'')<>'' GROUP BY 1,2 ORDER BY closed_value DESC,leads DESC LIMIT 12`,[String(safeDays)]);
  return{source_rows:source.map(r=>({source:String(r.source||'Direto').slice(0,80),leads:Number(r.leads||0),closed:Number(r.closed||0),closedValue:Number(r.closed_value||0)})),campaign_rows:campaigns.map(r=>({campaign:String(r.campaign||'').slice(0,80),source:String(r.source||'Direto').slice(0,50),leads:Number(r.leads||0),closed:Number(r.closed||0),closedValue:Number(r.closed_value||0)}))};
}

export async function getInquiryMarketingStats():Promise<InquiryMarketingStats>{
  const sql=getSql();if(!sql)return{social_rows:[],campaign_rows:[]};
  const [social,campaigns]=await Promise.all([
    query(sql,`SELECT LOWER(COALESCE(NULLIF(event_brief->'attribution'->>'source',''),'direct')) AS source,COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE status='fechado')::int AS closed,COALESCE(SUM(COALESCE(quoted_value_cents,0)) FILTER(WHERE status='fechado'),0)::bigint AS revenue,COALESCE(SUM(COALESCE(paid_cents,0)) FILTER(WHERE status='fechado'),0)::bigint AS received FROM inquiries WHERE LOWER(COALESCE(NULLIF(event_brief->'attribution'->>'source',''),'direct')) IN ('instagram','whatsapp','facebook','tiktok','pinterest','youtube') GROUP BY 1 ORDER BY leads DESC,revenue DESC`),
    query(sql,`SELECT LOWER(COALESCE(NULLIF(event_brief->'attribution'->>'campaign',''),'')) AS campaign,COUNT(*)::int AS leads,COUNT(*) FILTER(WHERE status='fechado')::int AS closed,COALESCE(SUM(COALESCE(quoted_value_cents,0)) FILTER(WHERE status='fechado'),0)::bigint AS revenue,COALESCE(SUM(COALESCE(paid_cents,0)) FILTER(WHERE status='fechado'),0)::bigint AS received FROM inquiries WHERE COALESCE(NULLIF(event_brief->'attribution'->>'campaign',''),'')<>'' GROUP BY 1 ORDER BY revenue DESC,leads DESC`)
  ]);
  return{social_rows:social.map(r=>({source:String(r.source||'direct').slice(0,50),leads:Number(r.leads||0),closed:Number(r.closed||0),revenue:Number(r.revenue||0),received:Number(r.received||0)})),campaign_rows:campaigns.map(r=>({campaign:String(r.campaign||'').slice(0,80),leads:Number(r.leads||0),closed:Number(r.closed||0),revenue:Number(r.revenue||0),received:Number(r.received||0)}))};
}

function inquiryPhoneDigits(value:string){return String(value||'').replace(/\D/g,'').slice(0,30);}


const inquiryReactivationCte=`WITH repurchase_base AS (
  SELECT i.*,
    regexp_replace(i.whatsapp,'[^0-9]','','g') AS phone_digits,
    CASE
      WHEN marques_anniversary_date(i.event_date,extract(year from CURRENT_DATE)::int)>=CURRENT_DATE
        THEN marques_anniversary_date(i.event_date,extract(year from CURRENT_DATE)::int)
      ELSE marques_anniversary_date(i.event_date,extract(year from CURRENT_DATE)::int+1)
    END AS next_anniversary
  FROM inquiries i
  WHERE i.status='fechado' AND i.event_date IS NOT NULL AND i.event_date<CURRENT_DATE
), repurchase_ranked AS (
  SELECT b.*,
    extract(year from b.next_anniversary)::int AS cycle_year,
    row_number() OVER(PARTITION BY b.phone_digits ORDER BY b.next_anniversary ASC,b.created_at DESC,b.id DESC) AS rn
  FROM repurchase_base b
  WHERE b.phone_digits ~ '^[0-9]{8,30}$'
    AND b.next_anniversary BETWEEN CURRENT_DATE AND CURRENT_DATE+60
    AND NOT EXISTS (
      SELECT 1 FROM inquiries contact
      WHERE regexp_replace(contact.whatsapp,'[^0-9]','','g')=b.phone_digits
        AND contact.repurchase_contact_year=extract(year from b.next_anniversary)::int
    )
)`;

export async function getInquiryReactivationWorkspace(limit=120,before:InquiryReactivationPointer|null=null):Promise<InquiryReactivationWorkspace>{
  const sql=getSql();if(!sql)return{items:[],customer_stats:{},total:0,next:null,has_more:false};const safeLimit=Math.min(500,Math.max(20,limit));
  const [rows,countRows]=await Promise.all([
    query(sql,`${inquiryReactivationCte} SELECT repurchase_ranked.*,next_anniversary::text AS repurchase_next_anniversary,cycle_year AS repurchase_cycle_year FROM repurchase_ranked WHERE rn=1 AND ($1::date IS NULL OR (next_anniversary,id)>($1::date,$2::uuid)) ORDER BY next_anniversary ASC,id ASC LIMIT $3`,[before?.next_anniversary||null,before?.id||null,safeLimit+1]),
    query(sql,`${inquiryReactivationCte} SELECT COUNT(*)::int AS total FROM repurchase_ranked WHERE rn=1`)
  ]);
  const has_more=rows.length>safeLimit;const visible=has_more?rows.slice(0,safeLimit):rows;const items=normalizeInquiries(visible);const last=visible.at(-1);const next=has_more&&last?{next_anniversary:String(last.next_anniversary||last.repurchase_next_anniversary||''),id:String(last.id)}:null;const customer_stats=await getInquiryCustomerStats(items.map(item=>item.whatsapp));return{items,customer_stats,total:Number(countRows[0]?.total||0),next,has_more};
}

export async function markInquiryReactivationContact(id:string,cycleYear:number){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');if(!Number.isInteger(cycleYear)||cycleYear<2000||cycleYear>2200)return undefined;
  const rows=await query(sql,`${inquiryReactivationCte}, target AS (
    SELECT id,next_anniversary,cycle_year FROM repurchase_ranked WHERE rn=1 AND id=$1 AND cycle_year=$2 LIMIT 1
  ), updated AS (
    UPDATE inquiries i SET repurchase_contacted_at=now(),repurchase_contact_year=$2,updated_at=now()
    FROM target t WHERE i.id=t.id
      AND NOT EXISTS (
        SELECT 1 FROM inquiries contact
        WHERE regexp_replace(contact.whatsapp,'[^0-9]','','g')=regexp_replace(i.whatsapp,'[^0-9]','','g')
          AND contact.repurchase_contact_year=$2
      )
    RETURNING i.*,t.next_anniversary
  ), activity AS (
    INSERT INTO inquiry_activity(inquiry_id,kind,summary,metadata)
    SELECT id,'reactivation','Recontato anual aberto no WhatsApp.',jsonb_build_object('cycle_year',$2,'next_anniversary',next_anniversary) FROM updated
    RETURNING inquiry_id
  ) SELECT updated.*,updated.next_anniversary::text AS repurchase_next_anniversary,$2::int AS repurchase_cycle_year FROM updated`,[id,cycleYear]);
  return rows[0]?normalizeInquiry(rows[0]):undefined;
}

export async function getInquiryCustomerStats(phones:string[]):Promise<InquiryCustomerStatsMap>{
  const sql=getSql();const keys=[...new Set(phones.map(inquiryPhoneDigits).filter(value=>value.length>=8))];if(!sql||!keys.length)return{};
  const rows=await query(sql,`SELECT regexp_replace(whatsapp,'[^0-9]','','g') AS phone,COUNT(*)::int AS requests,COUNT(*) FILTER(WHERE status='fechado')::int AS closed,COALESCE(SUM(COALESCE(quoted_value_cents,0)) FILTER(WHERE status='fechado'),0)::bigint AS closed_value,MAX(created_at) AS last_request FROM inquiries WHERE regexp_replace(whatsapp,'[^0-9]','','g')=ANY($1::text[]) GROUP BY 1`,[keys]);
  return Object.fromEntries(rows.map(row=>[String(row.phone||''),{requests:Number(row.requests||0),closed:Number(row.closed||0),closedValue:Number(row.closed_value||0),lastRequest:row.last_request?new Date(String(row.last_request)).toISOString():new Date(0).toISOString()}]));
}

export async function searchInquiries(term:string,limit=80):Promise<Inquiry[]>{
  const sql=getSql();const q=String(term||'').trim().slice(0,120);if(!sql||q.length<2)return[];const escaped=q.replace(/\\/g,'\\\\').replace(/%/g,'\\%').replace(/_/g,'\\_');const like=`%${escaped}%`;const digits=inquiryPhoneDigits(q);const pageSize=Math.min(120,Math.max(20,limit));
  const rows=await query(sql,`SELECT * FROM inquiries WHERE anonymized_at IS NULL AND (name ILIKE $1 ESCAPE '\\' OR whatsapp ILIKE $1 ESCAPE '\\' OR COALESCE(email,'') ILIKE $1 ESCAPE '\\' OR COALESCE(product_name,'') ILIKE $1 ESCAPE '\\' OR COALESCE(category,'') ILIKE $1 ESCAPE '\\' OR COALESCE(message,'') ILIKE $1 ESCAPE '\\' OR COALESCE(admin_notes,'') ILIKE $1 ESCAPE '\\' OR COALESCE(event_brief::text,'') ILIKE $1 ESCAPE '\\' OR COALESCE(quote_items::text,'') ILIKE $1 ESCAPE '\\' OR ($2<>'' AND regexp_replace(whatsapp,'[^0-9]','','g') LIKE '%'||$2||'%')) ORDER BY CASE WHEN $2<>'' AND regexp_replace(whatsapp,'[^0-9]','','g')=$2 THEN 0 WHEN LOWER(name)=LOWER($3) THEN 1 ELSE 2 END,created_at DESC,id DESC LIMIT $4`,[like,digits,q,pageSize]);
  return normalizeInquiries(rows);
}

export async function getInquiryHistoryPage(limit=80,before?:InquiryHistoryPointer|null):Promise<InquiryHistoryPage>{
  const sql=getSql();if(!sql)return{items:[],next:null,has_more:false};const pageSize=Math.min(200,Math.max(20,limit));const params:unknown[]=[];let beforeSql='';
  if(before){params.push(before.created_at,before.id);beforeSql=` AND (created_at,id)<($1::timestamptz,$2::uuid)`;}
  params.push(pageSize+1);const limitRef=`$${params.length}`;
  const rows=await query(sql,`SELECT * FROM inquiries WHERE ${inquiryTerminalWhere}${beforeSql} ORDER BY created_at DESC,id DESC LIMIT ${limitRef}`,params);const hasMore=rows.length>pageSize;const page=hasMore?rows.slice(0,pageSize):rows;const items=normalizeInquiries(page);const last=items[items.length-1];return{items,next:hasMore&&last?{created_at:last.created_at,id:last.id}:null,has_more:hasMore};
}

export async function getInquiryWorkspace(historyLimit=80):Promise<InquiryWorkspace>{
  const sql=getSql();if(!sql)return{items:[],history:{items:[],next:null,has_more:false},operational_count:0,customer_stats:{}};
  const [operational,history]=await Promise.all([query(sql,`SELECT * FROM inquiries WHERE ${inquiryOperationalWhere} ORDER BY CASE WHEN status='novo' THEN 0 WHEN follow_up_at IS NOT NULL AND follow_up_at<now() THEN 1 ELSE 2 END,COALESCE(follow_up_at,created_at) DESC,created_at DESC`),getInquiryHistoryPage(historyLimit)]);const active=normalizeInquiries(operational);const seen=new Set(active.map(row=>row.id));const historyItems=history.items.filter(row=>!seen.has(row.id));const items=[...active,...historyItems];const customer_stats=await getInquiryCustomerStats(items.map(row=>row.whatsapp));return{items,history:{...history,items:historyItems},operational_count:active.length,customer_stats};
}

export async function getProductionSummary():Promise<ProductionSummary>{
  const empty:ProductionSummary={open_count:0,active_count:0,overdue_count:0,approval_count:0,ready_count:0,without_signal_count:0,delivered_30_count:0,delivered_total_count:0,review_pending_count:0};
  const sql=getSql();if(!sql)return empty;
  const rows=await query(sql,`SELECT
    COUNT(*) FILTER(WHERE status='fechado' AND COALESCE(production_status,'nao_iniciado')<>'entregue')::int AS open_count,
    COUNT(*) FILTER(WHERE status='fechado' AND COALESCE(production_status,'nao_iniciado') NOT IN ('nao_iniciado','entregue'))::int AS active_count,
    COUNT(*) FILTER(WHERE status='fechado' AND COALESCE(production_status,'nao_iniciado')<>'entregue' AND production_due_at IS NOT NULL AND production_due_at<now())::int AS overdue_count,
    COUNT(*) FILTER(WHERE status='fechado' AND production_status='aguardando_aprovacao')::int AS approval_count,
    COUNT(*) FILTER(WHERE status='fechado' AND production_status='pronto')::int AS ready_count,
    COUNT(*) FILTER(WHERE status='fechado' AND COALESCE(production_status,'nao_iniciado')<>'entregue' AND payment_status='pendente')::int AS without_signal_count,
    COUNT(*) FILTER(WHERE status='fechado' AND production_status='entregue' AND updated_at>=now()-interval '30 days')::int AS delivered_30_count,
    COUNT(*) FILTER(WHERE status='fechado' AND production_status='entregue')::int AS delivered_total_count,
    COUNT(*) FILTER(WHERE status='fechado' AND production_status='entregue' AND review_requested_at IS NULL)::int AS review_pending_count
  FROM inquiries`);
  const r=rows[0]||{};return{open_count:Number(r.open_count||0),active_count:Number(r.active_count||0),overdue_count:Number(r.overdue_count||0),approval_count:Number(r.approval_count||0),ready_count:Number(r.ready_count||0),without_signal_count:Number(r.without_signal_count||0),delivered_30_count:Number(r.delivered_30_count||0),delivered_total_count:Number(r.delivered_total_count||0),review_pending_count:Number(r.review_pending_count||0)};
}

export async function getProductionDeliveredPage(limit=60,before?:ProductionHistoryPointer|null):Promise<ProductionHistoryPage>{
  const sql=getSql();if(!sql)return{items:[],next:null,has_more:false};const pageSize=Math.min(160,Math.max(20,limit));const params:unknown[]=[];let beforeSql='';
  if(before){params.push(before.updated_at,before.id);beforeSql=` AND (updated_at,id)<($1::timestamptz,$2::uuid)`;}
  params.push(pageSize+1);const limitRef=`$${params.length}`;
  const rows=await query(sql,`SELECT * FROM inquiries WHERE status='fechado' AND production_status='entregue'${beforeSql} ORDER BY updated_at DESC,id DESC LIMIT ${limitRef}`,params);const hasMore=rows.length>pageSize;const page=hasMore?rows.slice(0,pageSize):rows;const items=normalizeInquiries(page);const last=items[items.length-1];return{items,next:hasMore&&last?{updated_at:last.updated_at,id:last.id}:null,has_more:hasMore};
}

export async function getProductionWorkspace(deliveredLimit=60):Promise<ProductionWorkspace>{
  const sql=getSql();if(!sql)return{queue:[],aftercare:[],summary:await getProductionSummary(),delivered:{items:[],next:null,has_more:false}};
  const [queueRows,aftercareRows,summary,delivered]=await Promise.all([
    query(sql,`SELECT * FROM inquiries WHERE status='fechado' AND COALESCE(production_status,'nao_iniciado')<>'entregue' ORDER BY production_due_at ASC NULLS LAST,event_date ASC NULLS LAST,created_at ASC,id ASC`),
    query(sql,`SELECT * FROM inquiries WHERE status='fechado' AND production_status='entregue' AND review_requested_at IS NULL ORDER BY updated_at DESC,id DESC`),
    getProductionSummary(),
    getProductionDeliveredPage(deliveredLimit)
  ]);
  return{queue:normalizeInquiries(queueRows),aftercare:normalizeInquiries(aftercareRows),summary,delivered};
}

export async function getInquiries():Promise<Inquiry[]> {
  return (await getInquiryWorkspace()).items;
}

export async function getInquiryById(id:string):Promise<Inquiry|undefined>{
  const sql=getSql();if(!sql)return undefined;
  const rows=await query(sql,`SELECT * FROM inquiries WHERE id=$1 LIMIT 1`,[id]);
  return rows[0]?normalizeInquiry(rows[0]):undefined;
}

export type InquiryUpdateInput={status:Inquiry['status'];admin_notes:string;quoted_value_cents:number|null;follow_up_at:string|null;payment_status:Inquiry['payment_status'];paid_cents:number;production_status:Inquiry['production_status'];production_due_at:string|null};
export type InquiryVersionRef={id:string;version:number};
export class InquiryCommercialStateError extends Error{code:string;constructor(code:string,message:string){super(message);this.name='InquiryCommercialStateError';this.code=code;}}
function inquiryCommercialError(error:unknown):InquiryCommercialStateError|null{const text=errorText(error);const messages:Record<string,string>={CRM_PAYMENT_PENDING_WITH_VALUE:'Pagamento pendente não pode ter valor recebido.',CRM_PAYMENT_SIGNAL_INVALID:'Para marcar como sinal, informe valor orçado e um valor recebido maior que zero e menor que o total.',CRM_PAYMENT_PAID_INVALID:'Para marcar como pago, o valor recebido precisa cobrir o valor orçado.',CRM_PRODUCTION_REQUIRES_CLOSED:'A produção só pode avançar depois que o atendimento estiver fechado.'};for(const [code,message] of Object.entries(messages))if(text.includes(code))return new InquiryCommercialStateError(code,message);return null;}

export async function updateInquiry(id:string,input:InquiryUpdateInput,expectedVersion:number,activitySummary:string,activityMetadata:Record<string,unknown>={}){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');if(!Number.isInteger(expectedVersion)||expectedVersion<1)throw new StaleWriteError();
  try{
    const rows=await query(sql,`WITH updated AS (
      UPDATE inquiries SET status=$1,admin_notes=$2,quoted_value_cents=$3,follow_up_at=$4,payment_status=$5,paid_cents=$6,production_status=$7,production_due_at=$8,
        closed_at=CASE WHEN $1='fechado' THEN COALESCE(closed_at,now()) ELSE NULL END,updated_at=now()
      WHERE id=$9 AND version=$10 RETURNING *
    ), activity AS (
      INSERT INTO inquiry_activity(inquiry_id,kind,summary,metadata)
      SELECT id,'update',$11,$12::jsonb FROM updated RETURNING inquiry_id
    ) SELECT * FROM updated`,[input.status,input.admin_notes,input.quoted_value_cents,input.follow_up_at,input.payment_status,input.paid_cents,input.production_status,input.production_due_at,id,expectedVersion,activitySummary.slice(0,500),JSON.stringify(activityMetadata)]);
    if(rows[0])return normalizeInquiry(rows[0]);const exists=await query(sql,`SELECT 1 FROM inquiries WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return undefined;
  }catch(error){const commercial=inquiryCommercialError(error);if(commercial)throw commercial;throw error;}
}

export async function markInquiryReviewRequested(id:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');
  try{const rows=await query(sql,`WITH updated AS (UPDATE inquiries SET review_requested_at=now(),updated_at=now() WHERE id=$1 AND review_requested_at IS NULL RETURNING *), activity AS (INSERT INTO inquiry_activity(inquiry_id,kind,summary) SELECT id,'review','Avaliação solicitada ao cliente.' FROM updated RETURNING inquiry_id) SELECT * FROM updated`,[id]);if(rows[0])return normalizeInquiry(rows[0]);return getInquiryById(id);}
  catch(error){if(missingColumn(error,'review_requested_at'))return getInquiryById(id);throw error;}
}

export async function bulkUpdateInquiries(items:InquiryVersionRef[],patch:{status?:Inquiry['status'];follow_up_at?:string|null},summary:string){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const safe=items.slice(0,100);if(!safe.length)return[] as Inquiry[];const ids=safe.map(x=>x.id),versions=safe.map(x=>x.version);if(new Set(ids).size!==ids.length||versions.some(v=>!Number.isInteger(v)||v<1))throw new StaleWriteError();
  try{
    let rows:DbRow[]=[];
    if(patch.status)rows=await query(sql,`WITH expected AS (SELECT * FROM unnest($1::uuid[],$2::bigint[]) AS x(id,version)), matched AS (SELECT i.id FROM inquiries i JOIN expected e ON e.id=i.id AND e.version=i.version), updated AS (
      UPDATE inquiries i SET status=$3,closed_at=CASE WHEN $3='fechado' THEN COALESCE(i.closed_at,now()) ELSE NULL END,updated_at=now() FROM expected e
      WHERE i.id=e.id AND i.version=e.version AND (SELECT count(*) FROM matched)=cardinality($1::uuid[]) RETURNING i.*
    ), activity AS (INSERT INTO inquiry_activity(inquiry_id,kind,summary,metadata) SELECT id,'bulk',$4,jsonb_build_object('count',cardinality($1::uuid[])) FROM updated RETURNING inquiry_id) SELECT * FROM updated`,[ids,versions,patch.status,summary.slice(0,500)]);
    else if(Object.prototype.hasOwnProperty.call(patch,'follow_up_at'))rows=await query(sql,`WITH expected AS (SELECT * FROM unnest($1::uuid[],$2::bigint[]) AS x(id,version)), matched AS (SELECT i.id FROM inquiries i JOIN expected e ON e.id=i.id AND e.version=i.version), updated AS (
      UPDATE inquiries i SET follow_up_at=$3,updated_at=now() FROM expected e
      WHERE i.id=e.id AND i.version=e.version AND (SELECT count(*) FROM matched)=cardinality($1::uuid[]) RETURNING i.*
    ), activity AS (INSERT INTO inquiry_activity(inquiry_id,kind,summary,metadata) SELECT id,'bulk',$4,jsonb_build_object('count',cardinality($1::uuid[])) FROM updated RETURNING inquiry_id) SELECT * FROM updated`,[ids,versions,patch.follow_up_at??null,summary.slice(0,500)]);
    if(rows.length===safe.length)return normalizeInquiries(rows);throw new StaleWriteError();
  }catch(error){const commercial=inquiryCommercialError(error);if(commercial)throw commercial;throw error;}
}

export async function deleteInquiry(id:string,expectedVersion:number){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');if(!Number.isInteger(expectedVersion)||expectedVersion<1)throw new StaleWriteError();
  const rows=await query(sql,`DELETE FROM inquiries WHERE id=$1 AND version=$2 RETURNING id`,[id,expectedVersion]);if(rows[0])return true;const exists=await query(sql,`SELECT 1 FROM inquiries WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return false;
}


function privacyWhere(identityType:PrivacyIdentityType){return identityType==='phone'?`regexp_replace(whatsapp,'[^0-9]','','g')=$1`:`lower(trim(COALESCE(email,'')))=$1`;}
export async function lookupPrivacySubject(identityType:PrivacyIdentityType,value:string):Promise<PrivacyLookupResult>{
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const identity=privacyIdentities(identityType==='phone'?{phone:value}:{email:value})[0];if(!identity)throw new Error('PRIVACY_IDENTITY_INVALID');
  const where=privacyWhere(identityType);const rows=await query(sql,`SELECT * FROM inquiries WHERE anonymized_at IS NULL AND ${where} ORDER BY created_at DESC,id DESC`,[identity.normalized]);const items=normalizeInquiries(rows);const active=items.filter(row=>row.status!=='fechado'&&row.status!=='perdido'||row.status==='fechado'&&row.production_status!=='entregue').length;const tomb=await query(sql,`SELECT EXISTS(SELECT 1 FROM privacy_requests WHERE subject_hash=$1 AND identity_type=$2 AND action='anonymized') AS applied`,[identity.hash,identity.type]);return{identity_type:identity.type,matched:items.length,active,terminal:items.length-active,previously_anonymized:Boolean(tomb[0]?.applied),items};
}
export async function exportPrivacySubject(identityType:PrivacyIdentityType,value:string):Promise<PrivacyExport>{
  const result=await lookupPrivacySubject(identityType,value);const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const ids=result.items.map(item=>item.id);let activity:InquiryActivity[]=[];if(ids.length){const rows=await query(sql,`SELECT * FROM inquiry_activity WHERE inquiry_id=ANY($1::uuid[]) ORDER BY created_at,id`,[ids]);activity=rows as InquiryActivity[];}return{generated_at:new Date().toISOString(),identity_type:result.identity_type,inquiries:result.items,activity};
}
export async function getPrivacyTombstones():Promise<PrivacyTombstone[]>{const sql=getSql();if(!sql)return[];const rows=await query(sql,`SELECT subject_hash,identity_type,action,matched_inquiries,created_at,last_applied_at FROM privacy_requests WHERE action='anonymized' ORDER BY identity_type,subject_hash`);return mergePrivacyTombstones(rows);}
export async function getPrivacyTombstoneHashes(){return new Set((await getPrivacyTombstones()).map(row=>row.subject_hash));}
export async function prepareBusinessRestorePayloadForPrivacy(payload:Record<string,unknown>,expectedCounts:Record<string,number>,embeddedTombstones:unknown[]=[]){const current=await getPrivacyTombstones();const merged=mergePrivacyTombstones(current,embeddedTombstones);const hashes=new Set(merged.map(row=>row.subject_hash));const sanitized=sanitizeRestorePayloadPrivacy(payload,hashes);const counts={...expectedCounts,inquiry_activity:Array.isArray(sanitized.payload.inquiry_activity)?sanitized.payload.inquiry_activity.length:Number(expectedCounts.inquiry_activity||0)};return{payload:sanitized.payload,counts,anonymizedCount:sanitized.anonymizedCount,removedActivityCount:sanitized.removedActivityCount,tombstoneCount:merged.length,currentTombstoneCount:current.length,embeddedTombstoneCount:Math.max(0,merged.length-current.length),tombstones:merged};}
export async function anonymizePrivacySubject(identityType:PrivacyIdentityType,value:string):Promise<PrivacyAnonymizeResult>{
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const identity=privacyIdentities(identityType==='phone'?{phone:value}:{email:value})[0];if(!identity)throw new Error('PRIVACY_IDENTITY_INVALID');const phone=identityType==='phone'?identity.normalized:'';const email=identityType==='email'?identity.normalized:'';const phoneHash=identityType==='phone'?identity.hash:'';const emailHash=identityType==='email'?identity.hash:'';
  try{const rows=await query(sql,`SELECT marques_anonymize_privacy_subject($1,$2,$3,$4) AS result`,[phone,email,phoneHash,emailHash]);const raw=rows[0]?.result&&typeof rows[0].result==='object'?rows[0].result as Record<string,unknown>:{};return{matched:Number(raw.matched||0),anonymized:Number(raw.anonymized||0),activity_deleted:Number(raw.activity_deleted||0),snapshots_deleted:Number(raw.snapshots_deleted||0)};}catch(error){const text=errorText(error);const match=text.match(/PRIVACY_ACTIVE_INQUIRIES:(\d+)/);if(match)throw new Error(`PRIVACY_ACTIVE_INQUIRIES:${match[1]}`);throw error;}
}

export const demoProducts: Product[] = [
  {
    id:'00000000-0000-4000-8000-000000000001',slug:'topo-premium-camadas',name:'Topo Premium em Camadas',category:'Topos de bolo',category_id:null,
    description:'Topo personalizado com composição em múltiplas camadas, acabamento 3D e identidade visual exclusiva.',price_cents:null,
    image_urls:['/placeholder-topo.svg'],featured:true,active:true,stock_status:'sob_encomenda',tags:['premium','3D','personalizado'],sort_order:1,
    min_quantity:1,production_time:'Consulte o prazo para a sua data',seo_title:'',seo_description:'',badge:'Destaque',customization_fields:[{id:'nome',label:'Nome',type:'text',required:false,placeholder:'Nome para personalizar',options:[]},{id:'idade',label:'Idade',type:'number',required:false,placeholder:'',options:[]}],publish_at:null,unpublish_at:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()
  },
  {
    id:'00000000-0000-4000-8000-000000000002',slug:'caixinha-milk-premium',name:'Caixinha Milk Premium',category:'Caixinhas Milk',category_id:null,
    description:'Caixinha personalizada com impressão de alta qualidade, corte preciso e acabamento reforçado.',price_cents:null,
    image_urls:['/placeholder-milk.svg'],featured:true,active:true,stock_status:'sob_encomenda',tags:['festa','lembrancinha'],sort_order:2,
    min_quantity:10,production_time:'Consulte o prazo para a sua quantidade',seo_title:'',seo_description:'',badge:'',customization_fields:[],publish_at:null,unpublish_at:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()
  },
  {
    id:'00000000-0000-4000-8000-000000000003',slug:'kit-lembrancinhas',name:'Kit de Lembrancinhas',category:'Lembrancinhas',category_id:null,
    description:'Conjunto personalizado para festas, com peças combinando entre si e acabamento profissional.',price_cents:null,
    image_urls:['/placeholder-kit.svg'],featured:false,active:true,stock_status:'sob_encomenda',tags:['kit','festa'],sort_order:3,
    min_quantity:10,production_time:'Consulte o prazo para a sua quantidade',seo_title:'',seo_description:'',badge:'',customization_fields:[],publish_at:null,unpublish_at:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()
  }
];


export type Faq={id:string;question:string;answer:string;active:boolean;sort_order:number;created_at:string;updated_at:string};
export type AdminAuditEntry={id:string;action:string;entity_type:string;entity_id:string|null;summary:string;metadata?:Record<string,unknown>;severity:'info'|'warning'|'critical';request_id:string;actor_session_id:string|null;actor_device_hash:string;auth_method:string;prev_integrity_hash:string;integrity_hash:string;chain_version:number;created_at:string};
export type OperationalIncident={id:string;fingerprint:string;scope:string;severity:'warning'|'error'|'critical';status_code:number;error_name:string;message:string;last_reference:string;occurrences:number;first_seen_at:string;last_seen_at:string;acknowledged_at:string|null;resolved_at:string|null};
export type AdminSession={id:string;device_hash:string;device_label:string;user_agent:string;created_at:string;last_seen_at:string;expires_at:string;mfa_verified_at:string|null;last_reauth_at:string|null;auth_method:'password'|'totp'|'recovery';revoked_at:string|null};
export type AdminKnownDevice={id:string;device_hash:string;device_label:string;user_agent:string;first_seen_at:string;last_seen_at:string;last_login_at:string;revoked_at:string|null};
export type AdminSecurityEvent={id:number;event_type:'new_device_login'|'recovery_code_login'|'recovery_codes_rotated'|'device_revoked'|'critical_reauth'|'critical_action'|'security_webhook_failed';severity:'info'|'warning'|'critical';device_hash:string;device_label:string;summary:string;created_at:string;acknowledged_at:string|null};
export type VitalBuckets={good:number;needs:number;poor:number};
export type AnalyticsSummary={views:number;product_views:number;quote_starts:number;quote_submits:number;whatsapp_clicks:number;social_clicks:number;top_pages:{path:string;count:number}[];top_products:{path:string;count:number}[];top_social:{path:string;count:number}[];vitals:{lcp:VitalBuckets;cls:VitalBuckets;ttfb:VitalBuckets}};
export type CatalogSort='curadoria'|'novos'|'preco'|'nome';
export type CatalogPage={items:Product[];total:number;page:number;page_size:number;has_more:boolean};
export class CampaignSlugImmutableError extends Error{constructor(){super('O identificador UTM não pode ser alterado depois que a campanha é criada.');this.name='CampaignSlugImmutableError';}}
export class CampaignHasLeadsError extends Error{leadCount:number;constructor(leadCount:number){super(`Esta campanha possui ${leadCount} lead(s) vinculado(s). Encerre a campanha em vez de excluí-la para preservar o histórico.`);this.name='CampaignHasLeadsError';this.leadCount=leadCount;}}
export class StaleWriteError extends Error{constructor(message='Este registro foi alterado em outro lugar. Recarregue os dados antes de tentar novamente.'){super(message);this.name='StaleWriteError';}}

export type PrivacyLookupResult={identity_type:PrivacyIdentityType;matched:number;active:number;terminal:number;previously_anonymized:boolean;items:Inquiry[]};
export type PrivacyExport={generated_at:string;identity_type:PrivacyIdentityType;inquiries:Inquiry[];activity:InquiryActivity[]};
export type PrivacyAnonymizeResult={matched:number;anonymized:number;activity_deleted:number;snapshots_deleted:number};

export async function checkSchema(){
  const sql=getSql(); if(!sql)return{configured:false,version:0,ok:false};
  try{const rows=await query(sql,`SELECT
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='category_id') AS category_id,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='badge') AS badge,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='customization_fields') AS customization_fields,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='publish_at') AS publish_at,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='unpublish_at') AS unpublish_at,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='deleted_at') AS deleted_at,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='announcement_link') AS announcement_link,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='announcement_start_at') AS announcement_start_at,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='announcement_end_at') AS announcement_end_at,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='facebook_url') AS facebook_url,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='tiktok_url') AS tiktok_url,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='pinterest_url') AS pinterest_url,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='youtube_url') AS youtube_url,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='google_business_url') AS google_business_url,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='google_review_url') AS google_review_url,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='site_settings' AND column_name='monthly_sales_goal_cents') AS monthly_sales_goal_cents,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='social_content_plans') AS social_content_plans,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='marketing_campaigns') AS marketing_campaigns,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='marketing_campaigns' AND column_name='spend_cents') AS campaign_spend,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='faqs') AS faqs,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_log' AND column_name='summary') AS audit_summary,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='request_rate_limits' AND column_name='key_hash') AS rate_key,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='request_rate_limits' AND column_name='expires_at') AS rate_expiry,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='inquiries' AND column_name='payment_status') AS payment_status,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='inquiries' AND column_name='paid_cents') AS paid_cents,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='inquiry_activity') AS inquiry_activity,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_sessions') AS admin_sessions,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_sessions' AND column_name='revoked_at') AS session_revocation,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_sessions' AND column_name='expires_at') AS session_expiry,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_sessions' AND column_name='mfa_verified_at') AS session_mfa,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_sessions' AND column_name='device_hash') AS session_device,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_sessions' AND column_name='auth_method') AS session_auth_method,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_sessions' AND column_name='last_reauth_at') AS session_last_reauth,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_mfa_used_steps') AS mfa_replay_guard,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_mfa_recovery_codes') AS mfa_recovery,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_known_devices') AS known_devices,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_security_events') AS security_events,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_log' AND column_name='integrity_hash') AS audit_integrity,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_log' AND column_name='severity') AS audit_severity,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='operational_incidents') AS operational_incidents,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_restore_snapshots') AS restore_snapshots,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='marketing_campaign_slug_immutable' AND NOT tgisinternal) AS campaign_slug_immutable,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_products_public_stock_order') AS perf_product_stock,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_payment_created') AS perf_inquiry_payment,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_production_created') AS perf_inquiry_production,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_source_created') AS perf_inquiry_source,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='inquiries' AND column_name='version') AS inquiry_version,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_inquiries_version_monotonic' AND NOT tgisinternal) AS inquiry_version_guard,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_inquiries_commercial_guard' AND NOT tgisinternal) AS inquiry_commercial_guard,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_terminal_history') AS scalable_history,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_open_attention') AS scalable_open,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_delivered_history') AS production_history,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_post_sale_pending') AS production_aftercare,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_event_agenda') AS agenda_event,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_follow_up_agenda') AS agenda_follow_up,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='inquiries' AND column_name='repurchase_contacted_at') AS repurchase_contacted_at,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='inquiries' AND column_name='repurchase_contact_year') AS repurchase_contact_year,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_repurchase_event') AS reactivation_event,
    EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='idx_inquiries_repurchase_contact') AS reactivation_contact,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_log' AND column_name='prev_integrity_hash') AS audit_prev_hash,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='admin_audit_log' AND column_name='chain_version') AS audit_chain_version,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='admin_audit_chain_state') AS audit_chain_state,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='admin_audit_chain_before_insert' AND NOT tgisinternal) AS audit_chain_before,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='admin_audit_chain_after_insert' AND NOT tgisinternal) AS audit_chain_after,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='inquiries' AND column_name='anonymized_at') AS privacy_anonymized_at,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='privacy_requests') AS privacy_requests,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_anonymize_privacy_subject') AS privacy_anonymize_func,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_inquiries_privacy_email') AS privacy_email_index,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_inquiries_privacy_whatsapp') AS privacy_phone_index,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_restore_business_payload' AND pronargs IN (4,5)) AS privacy_restore_vault,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_restore_business_payload' AND pronargs=5) AS media_restore_mode,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='offsite_backup_receipts') AS offsite_backup_receipts,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='offsite_backup_receipts_append_only' AND NOT tgisinternal) AS offsite_backup_append_only,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_offsite_backup_receipts_verified') AS offsite_backup_index,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='recovery_drill_receipts') AS recovery_drill_receipts,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='recovery_drill_receipts_append_only' AND NOT tgisinternal) AS recovery_drill_append_only,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_recovery_drill_receipts_succeeded') AS recovery_drill_index,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='media_backup_receipts') AS media_backup_receipts,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='media_backup_receipts_append_only' AND NOT tgisinternal) AS media_backup_append_only,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_media_backup_receipts_verified') AS media_backup_index,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='media_recovery_drill_receipts') AS media_recovery_drill_receipts,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='media_recovery_drill_receipts_append_only' AND NOT tgisinternal) AS media_recovery_drill_append_only,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_media_recovery_drill_receipts_succeeded') AS media_recovery_drill_index,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='media_deletion_tombstones') AS media_deletion_tombstones,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_media_deletion_tombstones_deleted_at') AS media_deletion_index,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_reserve_media_delete' AND pronargs=2) AS media_delete_reserve,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_reactivate_media' AND pronargs=2) AS media_reactivate,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_products_media_tombstone_guard' AND NOT tgisinternal) AS media_product_guard,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_categories_media_tombstone_guard' AND NOT tgisinternal) AS media_category_guard,
    EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='trg_site_settings_media_tombstone_guard' AND NOT tgisinternal) AS media_settings_guard,
    EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name='media_lifecycle_leases') AS media_lifecycle_leases,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='media_deletion_tombstones' AND column_name='storage_deleted_at') AS media_storage_deleted_at,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='media_deletion_tombstones' AND column_name='last_operation') AS media_last_operation,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='media_deletion_tombstones' AND column_name='attempt_count') AS media_attempt_count,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='media_deletion_tombstones' AND column_name='last_attempt_at') AS media_last_attempt_at,
    EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name='media_deletion_tombstones' AND column_name='last_error_code') AS media_last_error_code,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_media_lifecycle_leases_expires_at') AS media_lease_expiry_index,
    EXISTS(SELECT 1 FROM pg_indexes WHERE indexname='idx_media_deletion_tombstones_pending') AS media_pending_index,
    EXISTS(SELECT 1 FROM pg_constraint WHERE conname='media_deletion_tombstones_last_operation_check') AS media_operation_constraint,
    EXISTS(SELECT 1 FROM pg_constraint WHERE conname='media_deletion_tombstones_attempt_count_check') AS media_attempt_constraint,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_acquire_media_lease' AND pronargs=3) AS media_acquire_lease,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_cancel_media_lease' AND pronargs=4) AS media_cancel_lease,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_begin_media_delete' AND pronargs=2) AS media_begin_delete,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_complete_media_delete' AND pronargs=3) AS media_complete_delete,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_fail_media_delete' AND pronargs=4) AS media_fail_delete,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_begin_media_upload' AND pronargs=2) AS media_begin_upload,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_complete_media_upload' AND pronargs=3) AS media_complete_upload,
    EXISTS(SELECT 1 FROM pg_proc WHERE proname='marques_fail_media_upload' AND pronargs=4) AS media_fail_upload`);const r=rows[0]||{};const baseOk=Boolean(r.category_id&&r.badge&&r.customization_fields&&r.publish_at&&r.unpublish_at&&r.deleted_at&&r.announcement_link&&r.announcement_start_at&&r.announcement_end_at&&r.facebook_url&&r.tiktok_url&&r.pinterest_url&&r.youtube_url&&r.google_business_url&&r.google_review_url&&r.monthly_sales_goal_cents&&r.social_content_plans&&r.marketing_campaigns&&r.campaign_spend&&r.faqs&&r.audit_summary&&r.rate_key&&r.rate_expiry&&r.payment_status&&r.paid_cents&&r.inquiry_activity&&r.admin_sessions&&r.session_revocation&&r.session_expiry&&r.session_mfa&&r.session_device&&r.session_auth_method&&r.session_last_reauth&&r.mfa_replay_guard&&r.mfa_recovery&&r.known_devices&&r.security_events&&r.audit_integrity&&r.audit_severity&&r.operational_incidents&&r.restore_snapshots);const perfOk=Boolean(r.campaign_slug_immutable&&r.perf_product_stock&&r.perf_inquiry_payment&&r.perf_inquiry_production&&r.perf_inquiry_source);const commercialOk=Boolean(r.inquiry_version&&r.inquiry_version_guard&&r.inquiry_commercial_guard);const scalableOk=Boolean(r.scalable_history&&r.scalable_open);const productionOk=Boolean(r.production_history&&r.production_aftercare);const agendaOk=Boolean(r.agenda_event&&r.agenda_follow_up);const reactivationOk=Boolean(r.repurchase_contacted_at&&r.repurchase_contact_year&&r.reactivation_event&&r.reactivation_contact);const auditChainOk=Boolean(r.audit_prev_hash&&r.audit_chain_version&&r.audit_chain_state&&r.audit_chain_before&&r.audit_chain_after);const privacyOk=Boolean(r.privacy_anonymized_at&&r.privacy_requests&&r.privacy_anonymize_func&&r.privacy_email_index&&r.privacy_phone_index);const privacyDrOk=Boolean(privacyOk&&r.privacy_restore_vault);const backupFreshnessOk=Boolean(r.offsite_backup_receipts&&r.offsite_backup_append_only&&r.offsite_backup_index);const recoveryDrillOk=Boolean(r.recovery_drill_receipts&&r.recovery_drill_append_only&&r.recovery_drill_index);const mediaBackupOk=Boolean(r.media_backup_receipts&&r.media_backup_append_only&&r.media_backup_index);const mediaRecoveryDrillOk=Boolean(r.media_recovery_drill_receipts&&r.media_recovery_drill_append_only&&r.media_recovery_drill_index);const priorOk=baseOk&&perfOk&&commercialOk&&scalableOk&&productionOk&&agendaOk&&reactivationOk&&auditChainOk&&privacyDrOk&&backupFreshnessOk&&recoveryDrillOk&&mediaBackupOk&&mediaRecoveryDrillOk;const mediaDeletionBaseOk=Boolean(r.media_deletion_tombstones&&r.media_deletion_index&&r.media_product_guard&&r.media_category_guard&&r.media_settings_guard&&r.media_restore_mode&&(r.media_delete_reserve&&r.media_reactivate||r.media_begin_delete&&r.media_begin_upload));const mediaLeaseSafetyOk=Boolean(mediaDeletionBaseOk&&r.media_lifecycle_leases&&r.media_storage_deleted_at&&r.media_last_operation&&r.media_attempt_count&&r.media_last_attempt_at&&r.media_last_error_code&&r.media_lease_expiry_index&&r.media_pending_index&&r.media_operation_constraint&&r.media_attempt_constraint&&r.media_acquire_lease&&r.media_cancel_lease&&r.media_begin_delete&&r.media_complete_delete&&r.media_fail_delete&&r.media_begin_upload&&r.media_complete_upload&&r.media_fail_upload);const ok=priorOk&&mediaLeaseSafetyOk;return{configured:true,version:ok?platformContract.schemaVersion:priorOk&&mediaDeletionBaseOk?26:priorOk?25:mediaBackupOk?24:baseOk&&perfOk&&commercialOk&&scalableOk&&productionOk&&agendaOk&&reactivationOk&&auditChainOk&&privacyDrOk&&backupFreshnessOk&&recoveryDrillOk?23:baseOk&&perfOk&&commercialOk&&scalableOk&&productionOk&&agendaOk&&reactivationOk&&auditChainOk&&privacyDrOk&&backupFreshnessOk?22:baseOk&&perfOk&&commercialOk&&scalableOk&&productionOk&&agendaOk&&reactivationOk&&auditChainOk&&privacyDrOk?21:baseOk&&perfOk&&commercialOk&&scalableOk&&productionOk&&agendaOk&&reactivationOk&&auditChainOk&&privacyOk?20:baseOk&&perfOk&&commercialOk&&scalableOk&&productionOk&&agendaOk&&reactivationOk&&auditChainOk?19:baseOk&&perfOk&&commercialOk&&scalableOk&&productionOk&&agendaOk&&reactivationOk?18:baseOk&&perfOk&&commercialOk&&scalableOk&&productionOk&&agendaOk?17:baseOk&&perfOk&&commercialOk&&scalableOk&&productionOk?16:baseOk&&perfOk&&commercialOk&&scalableOk?15:baseOk&&perfOk&&commercialOk?14:baseOk&&perfOk?13:baseOk?12:11,ok};}catch{return{configured:true,version:0,ok:false};}
}
export async function checkDataIntegrity(){
  const sql=getSql(); if(!sql)return{ok:true,issues:[] as string[]};
  const issues:string[]=[];
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.category_id IS NULL OR c.id IS NULL`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} produto(s) sem categoria válida.`);}catch{}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM products p JOIN categories c ON c.id=p.category_id WHERE p.category IS DISTINCT FROM c.name`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} produto(s) com nome de categoria dessincronizado.`);}catch{}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active=true AND c.active=false`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} produto(s) publicados em categoria oculta.`);}catch{}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM products WHERE active=true AND (image_urls IS NULL OR cardinality(image_urls)=0)`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} produto(s) publicados sem imagem.`);}catch{}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM media_deletion_tombstones t WHERE EXISTS(SELECT 1 FROM products p CROSS JOIN LATERAL unnest(p.image_urls) media_url WHERE media_url=t.url OR marques_media_key_from_url(media_url)=t.storage_key) OR EXISTS(SELECT 1 FROM categories c WHERE c.image_url=t.url OR marques_media_key_from_url(c.image_url)=t.storage_key) OR EXISTS(SELECT 1 FROM site_settings s WHERE s.logo_url=t.url OR s.hero_image_url=t.url OR marques_media_key_from_url(s.logo_url)=t.storage_key OR marques_media_key_from_url(s.hero_image_url)=t.storage_key)`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} mídia(s) tombstonada(s) ainda referenciada(s).`);}catch{issues.push('Não foi possível verificar referências contra tombstones de mídia.');}
  try{const rows=await query(sql,`SELECT COUNT(*) FILTER (WHERE storage_deleted_at IS NULL AND last_attempt_at IS NOT NULL AND last_attempt_at<now()-interval '15 minutes')::int stuck,COUNT(*) FILTER (WHERE storage_deleted_at IS NULL AND last_error_code<>'')::int failed FROM media_deletion_tombstones`);const stuck=Number(rows[0]?.stuck||0),failed=Number(rows[0]?.failed||0);if(stuck>0||failed>0)issues.push(`${Math.max(stuck,failed)} operação(ões) de mídia pendentes/falhas aguardando retry seguro.`);}catch{issues.push('Não foi possível verificar operações pendentes do lifecycle de mídia.');}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM media_lifecycle_leases WHERE expires_at<=now()`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} lease(s) de mídia expirada(s) exigem retry/limpeza segura antes de restore.`);}catch{issues.push('Não foi possível verificar leases do lifecycle de mídia.');}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM products WHERE publish_at IS NOT NULL AND unpublish_at IS NOT NULL AND unpublish_at<=publish_at`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} produto(s) com janela de publicação inválida.`);}catch{}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM products WHERE customization_fields IS NULL OR jsonb_typeof(customization_fields)<>'array'`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} produto(s) com personalização corrompida.`);}catch{}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM inquiries WHERE version IS NULL OR version<1`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} atendimento(s) com versão concorrente inválida.`);}catch{}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM inquiries WHERE (payment_status='pendente' AND COALESCE(paid_cents,0)<>0) OR (payment_status='sinal' AND (COALESCE(quoted_value_cents,0)<=0 OR COALESCE(paid_cents,0)<=0 OR paid_cents>=quoted_value_cents)) OR (payment_status='pago' AND (COALESCE(quoted_value_cents,0)<=0 OR COALESCE(paid_cents,0)<quoted_value_cents)) OR (COALESCE(production_status,'nao_iniciado')<>'nao_iniciado' AND status<>'fechado')`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} atendimento(s) com estado comercial incoerente.`);}catch{}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM inquiries WHERE (repurchase_contacted_at IS NULL) IS DISTINCT FROM (repurchase_contact_year IS NULL)`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} atendimento(s) com ciclo de reativação inconsistente.`);}catch{}
  try{const rows=await query(sql,`SELECT COUNT(*)::int n FROM inquiries WHERE anonymized_at IS NOT NULL AND (name<>'Cliente anonimizado' OR whatsapp<>'' OR email IS NOT NULL OR event_date IS NOT NULL OR message<>'' OR admin_notes<>'' OR follow_up_at IS NOT NULL OR event_brief<>'{}'::jsonb OR idempotency_key IS NOT NULL OR production_due_at IS NOT NULL OR review_requested_at IS NOT NULL OR repurchase_contacted_at IS NOT NULL OR repurchase_contact_year IS NOT NULL)`);if(Number(rows[0]?.n)>0)issues.push(`${rows[0].n} atendimento(s) anonimizados ainda contêm dados pessoais.`);}catch{}
  try{const audit=await checkAdminAuditIntegrity();if(audit.configured&&!audit.ok)issues.push(`Cadeia de auditoria administrativa inconsistente (${audit.mismatches} divergência(s)).`);}catch{issues.push('Não foi possível verificar a cadeia de auditoria administrativa.');}
  return{ok:issues.length===0,issues};
}

export type OffsiteBackupReceipt={id:string;envelope_sha256:string;object_key:string;destination_fingerprint:string;bytes:number;retention_days:number;deleted_count:number;verified_at:string};
export async function getLatestOffsiteBackupReceipt():Promise<OffsiteBackupReceipt|null>{const sql=getSql();if(!sql)return null;try{const rows=await query(sql,`SELECT id,envelope_sha256,object_key,destination_fingerprint,bytes,retention_days,deleted_count,verified_at FROM offsite_backup_receipts ORDER BY verified_at DESC,id DESC LIMIT 1`);const row=rows[0];if(!row)return null;return{id:String(row.id),envelope_sha256:String(row.envelope_sha256),object_key:String(row.object_key),destination_fingerprint:String(row.destination_fingerprint),bytes:Number(row.bytes||0),retention_days:Number(row.retention_days||0),deleted_count:Number(row.deleted_count||0),verified_at:new Date(String(row.verified_at)).toISOString()};}catch{return null;}}
export async function getOffsiteBackupFreshness():Promise<BackupFreshness>{const max=normalizeBackupMaxAgeHours(process.env.BACKUP_OFFSITE_MAX_AGE_HOURS);if(!getSql())return{...evaluateBackupFreshness(null,max),state:'unavailable'};try{const receipt=await getLatestOffsiteBackupReceipt();const result=evaluateBackupFreshness(receipt?.verified_at,max);return{...result,object_key:receipt?.object_key||null,bytes:receipt?.bytes||null,envelope_sha256:receipt?.envelope_sha256||null,destination_fingerprint:receipt?.destination_fingerprint||null};}catch{return{...evaluateBackupFreshness(null,max),state:'unavailable'};}}

export type RecoveryDrillReceipt={id:string;backup_object_key:string;backup_sha256:string;drill_target_fingerprint:string;duration_ms:number;succeeded_at:string};
export async function getLatestRecoveryDrillReceipt():Promise<RecoveryDrillReceipt|null>{const sql=getSql();if(!sql)return null;try{const rows=await query(sql,`SELECT id,backup_object_key,backup_sha256,drill_target_fingerprint,duration_ms,succeeded_at FROM recovery_drill_receipts ORDER BY succeeded_at DESC,id DESC LIMIT 1`);const row=rows[0];if(!row)return null;return{id:String(row.id),backup_object_key:String(row.backup_object_key),backup_sha256:String(row.backup_sha256),drill_target_fingerprint:String(row.drill_target_fingerprint),duration_ms:Number(row.duration_ms||0),succeeded_at:new Date(String(row.succeeded_at)).toISOString()};}catch{return null;}}
export async function getRecoveryDrillFreshness():Promise<RecoveryDrillFreshness>{const max=normalizeRecoveryDrillMaxAgeHours(process.env.RECOVERY_DRILL_MAX_AGE_HOURS);if(!getSql())return{...evaluateRecoveryDrillFreshness(null,max),state:'unavailable'};try{const receipt=await getLatestRecoveryDrillReceipt();const result=evaluateRecoveryDrillFreshness(receipt?.succeeded_at,max);return{...result,backup_object_key:receipt?.backup_object_key||null,backup_sha256:receipt?.backup_sha256||null,duration_ms:receipt?.duration_ms||null};}catch{return{...evaluateRecoveryDrillFreshness(null,max),state:'unavailable'};}}

export async function getMediaBackupFreshness(){const required=Boolean(process.env.S3_ENDPOINT&&process.env.S3_BUCKET&&process.env.S3_ACCESS_KEY_ID&&process.env.S3_SECRET_ACCESS_KEY&&process.env.S3_PUBLIC_BASE_URL);const max=normalizeMediaBackupMaxAgeHours(process.env.MEDIA_BACKUP_MAX_AGE_HOURS);if(!required)return evaluateMediaBackupFreshness(null,max,false);const sql=getSql();if(!sql)return{...evaluateMediaBackupFreshness(null,max,true),state:'unavailable'};try{const rows=await query(sql,`SELECT source_count,mirrored_count,skipped_count,verified_bytes,verified_at FROM media_backup_receipts ORDER BY verified_at DESC,id DESC LIMIT 1`);const row=rows[0];const fresh=evaluateMediaBackupFreshness(row?.verified_at?new Date(String(row.verified_at)).toISOString():null,max,true);return{...fresh,source_count:Number(row?.source_count||0),mirrored_count:Number(row?.mirrored_count||0),skipped_count:Number(row?.skipped_count||0),verified_bytes:Number(row?.verified_bytes||0)};}catch{return{...evaluateMediaBackupFreshness(null,max,true),state:'unavailable'};}}

export async function consumeDistributedRateLimit(scope:string,keyHash:string,limit:number,windowMs:number){
  const sql=getSql(); if(!sql)throw new Error('DATABASE_URL não configurada.');
  const windowSeconds=Math.max(1,Math.ceil(windowMs/1000));
  const rows=await query(sql,`INSERT INTO request_rate_limits(scope,subject_hash,key_hash,window_start,count,expires_at) VALUES($1,$2,$2,now(),1,now()+($3||' seconds')::interval) ON CONFLICT(scope,key_hash) WHERE key_hash IS NOT NULL DO UPDATE SET count=CASE WHEN request_rate_limits.expires_at<=now() THEN 1 ELSE request_rate_limits.count+1 END,window_start=CASE WHEN request_rate_limits.expires_at<=now() THEN now() ELSE request_rate_limits.window_start END,expires_at=CASE WHEN request_rate_limits.expires_at<=now() THEN now()+($3||' seconds')::interval ELSE request_rate_limits.expires_at END RETURNING count,expires_at`,[scope,keyHash,windowSeconds]);
  if(Math.random()<0.02) query(sql,`DELETE FROM request_rate_limits WHERE expires_at < now()-interval '1 day'`).catch(()=>{});
  const count=Number(rows[0]?.count||1);return{allowed:count<=limit,remaining:Math.max(0,limit-count)};
}

function cleanSearch(value:string){return (value||'').trim().replace(/[\\%_]+/g,' ').replace(/\s+/g,' ').slice(0,100);}
export async function getPublicCatalogPage(opts:{page?:number;pageSize?:number;category?:string;query?:string;sort?:CatalogSort;ids?:string[];stock?:Product['stock_status'];customizable?:boolean;tag?:string}={}):Promise<CatalogPage>{
  const sql=getSql(); const page=Math.min(250,Math.max(1,opts.page||1));const pageSize=Math.min(36,Math.max(1,opts.pageSize||18));
  if(!sql){let data=[...demoProducts];if(opts.category)data=data.filter(p=>p.category===opts.category);const q=cleanSearch(opts.query||'').toLowerCase();if(q)data=data.filter(p=>`${p.name} ${p.category} ${p.description} ${p.tags.join(' ')}`.toLowerCase().includes(q));if(opts.ids?.length)data=data.filter(p=>opts.ids!.includes(p.id));if(opts.stock)data=data.filter(p=>p.stock_status===opts.stock);if(opts.customizable)data=data.filter(p=>p.customization_fields.length>0);if(opts.tag)data=data.filter(p=>p.tags.some(tag=>tag.toLocaleLowerCase('pt-BR')===opts.tag!.toLocaleLowerCase('pt-BR')));const total=data.length;return{items:data.slice((page-1)*pageSize,page*pageSize),total,page,page_size:pageSize,has_more:page*pageSize<total};}
  const q=cleanSearch(opts.query||''); const conditions=['p.active=true','c.active=true','(p.publish_at IS NULL OR p.publish_at<=now())','(p.unpublish_at IS NULL OR p.unpublish_at>now())'];const params:unknown[]=[];let n=1;
  if(opts.category){conditions.push(`c.slug=$${n++}`);params.push(opts.category);}
  if(q){conditions.push(`(p.name ILIKE $${n} OR p.description ILIKE $${n} OR p.category ILIKE $${n} OR array_to_string(p.tags,' ') ILIKE $${n})`);params.push(`%${q}%`);n++;}
  if(opts.ids?.length){conditions.push(`p.id=ANY($${n++}::uuid[])`);params.push(opts.ids.slice(0,60));}
  if(opts.stock){conditions.push(`p.stock_status=$${n++}`);params.push(opts.stock);}
  if(opts.customizable){conditions.push(`jsonb_array_length(COALESCE(p.customization_fields,'[]'::jsonb))>0`);}
  if(opts.tag){conditions.push(`EXISTS(SELECT 1 FROM unnest(p.tags) tag_value WHERE lower(tag_value)=lower($${n++}))`);params.push(opts.tag.slice(0,40));}
  const order=opts.sort==='novos'?'p.created_at DESC':opts.sort==='preco'?'p.price_cents ASC NULLS LAST,p.name ASC':opts.sort==='nome'?'p.name ASC':'p.featured DESC,p.sort_order ASC,p.created_at DESC';
  const offset=(page-1)*pageSize;
  try{
    const rows=await query(sql,`SELECT p.*,COUNT(*) OVER()::int AS __total FROM products p JOIN categories c ON c.id=p.category_id WHERE ${conditions.join(' AND ')} ORDER BY ${order} LIMIT $${n++} OFFSET $${n++}`,[...params,pageSize,offset]);
    let total=Number(rows[0]?.__total||0);
    // Página fora do fim não traz linha da qual extrair COUNT OVER. Só nesse
    // caso raro fazemos o COUNT adicional; páginas normais usam 1 query.
    if(!rows.length&&page>1){const count=await query(sql,`SELECT COUNT(*)::int total FROM products p JOIN categories c ON c.id=p.category_id WHERE ${conditions.join(' AND ')}`,params);total=Number(count[0]?.total||0);}
    return{items:normalizeProducts(rows),total,page,page_size:pageSize,has_more:offset+rows.length<total};
  }
  catch(error){if(!missingColumn(error,'category_id')&&!missingColumn(error,'publish_at')&&!missingColumn(error,'unpublish_at'))throw error;const legacy=['p.active=true',`EXISTS(SELECT 1 FROM categories c WHERE c.name=p.category AND c.active=true)`];const ps:unknown[]=[];let m=1;if(opts.category){legacy.push(`p.category=(SELECT name FROM categories WHERE slug=$${m++} AND active=true LIMIT 1)`);ps.push(opts.category);}if(q){legacy.push(`(p.name ILIKE $${m} OR p.description ILIKE $${m} OR p.category ILIKE $${m} OR array_to_string(p.tags,' ') ILIKE $${m})`);ps.push(`%${q}%`);m++;}if(opts.ids?.length){legacy.push(`p.id=ANY($${m++}::uuid[])`);ps.push(opts.ids.slice(0,60));}if(opts.stock){legacy.push(`p.stock_status=$${m++}`);ps.push(opts.stock);}if(opts.customizable){legacy.push(`jsonb_array_length(COALESCE(p.customization_fields,'[]'::jsonb))>0`);}if(opts.tag){legacy.push(`EXISTS(SELECT 1 FROM unnest(p.tags) tag_value WHERE lower(tag_value)=lower($${m++}))`);ps.push(opts.tag.slice(0,40));}const rows=await query(sql,`SELECT p.*,COUNT(*) OVER()::int AS __total FROM products p WHERE ${legacy.join(' AND ')} ORDER BY ${order} LIMIT $${m++} OFFSET $${m++}`,[...ps,pageSize,offset]);let total=Number(rows[0]?.__total||0);if(!rows.length&&page>1){const count=await query(sql,`SELECT COUNT(*)::int total FROM products p WHERE ${legacy.join(' AND ')}`,ps);total=Number(count[0]?.total||0);}return{items:normalizeProducts(rows),total,page,page_size:pageSize,has_more:offset+rows.length<total};}
}
export async function getHomeCuratedProducts(limit=18){const page=await getPublicCatalogPage({page:1,pageSize:Math.min(24,limit),sort:'curadoria'});return page.items;}
export async function getPublicProductsByCategory(slug:string,limit=18){return (await getPublicCatalogPage({category:slug,pageSize:limit})).items;}
export async function getPublicProductsByIds(ids:string[]){return (await getPublicCatalogPage({ids:ids.filter(Boolean).slice(0,60),pageSize:60})).items;}
export async function getPublicProductsBySlugs(slugs:string[]){const sql=getSql();if(!sql)return demoProducts.filter(p=>slugs.includes(p.slug));if(!slugs.length)return[];try{const rows=await query(sql,`SELECT p.* FROM products p JOIN categories c ON c.id=p.category_id WHERE p.slug=ANY($1::text[]) AND p.active=true AND c.active=true AND (p.publish_at IS NULL OR p.publish_at<=now()) AND (p.unpublish_at IS NULL OR p.unpublish_at>now())`,[slugs.slice(0,60)]);return normalizeProducts(rows);}catch(error){if(!missingColumn(error,'category_id')&&!missingColumn(error,'publish_at')&&!missingColumn(error,'unpublish_at'))throw error;const rows=await query(sql,`SELECT p.* FROM products p WHERE p.slug=ANY($1::text[]) AND p.active=true AND EXISTS(SELECT 1 FROM categories c WHERE c.name=p.category AND c.active=true)`,[slugs.slice(0,60)]);return normalizeProducts(rows);}}
export async function getRelatedPublicProducts(product:Product,limit=3){
  const safeLimit=Math.min(8,Math.max(1,limit));const tags=product.tags.map(tag=>tag.toLocaleLowerCase('pt-BR')).slice(0,20);const sql=getSql();
  const scoreLocal=(candidate:Product)=>{const shared=candidate.tags.filter(tag=>tags.includes(tag.toLocaleLowerCase('pt-BR'))).length;return (candidate.category===product.category?4:0)+(shared*3)+(candidate.featured?1:0);};
  if(!sql)return demoProducts.filter(p=>p.id!==product.id&&p.active).sort((a,b)=>scoreLocal(b)-scoreLocal(a)||a.sort_order-b.sort_order).slice(0,safeLimit);
  try{const rows=await query(sql,`SELECT p.*,(CASE WHEN p.category=$2 THEN 4 ELSE 0 END)+(SELECT COUNT(*)::int*3 FROM unnest(p.tags) item_tag WHERE lower(item_tag)=ANY($3::text[]))+(CASE WHEN p.featured THEN 1 ELSE 0 END) relevance FROM products p JOIN categories c ON c.id=p.category_id WHERE p.id<>$1 AND p.active=true AND c.active=true AND (p.publish_at IS NULL OR p.publish_at<=now()) AND (p.unpublish_at IS NULL OR p.unpublish_at>now()) ORDER BY relevance DESC,p.sort_order ASC,p.created_at DESC LIMIT $4`,[product.id,product.category,tags,safeLimit]);return normalizeProducts(rows);}catch(error){if(!missingColumn(error,'category_id')&&!missingColumn(error,'publish_at')&&!missingColumn(error,'unpublish_at'))throw error;const rows=await query(sql,`SELECT p.*,(CASE WHEN p.category=$2 THEN 4 ELSE 0 END)+(SELECT COUNT(*)::int*3 FROM unnest(p.tags) item_tag WHERE lower(item_tag)=ANY($3::text[]))+(CASE WHEN p.featured THEN 1 ELSE 0 END) relevance FROM products p WHERE p.id<>$1 AND p.active=true AND EXISTS(SELECT 1 FROM categories c WHERE c.name=p.category AND c.active=true) ORDER BY relevance DESC,p.sort_order ASC,p.created_at DESC LIMIT $4`,[product.id,product.category,tags,safeLimit]);return normalizeProducts(rows);}
}
export async function getConciergeRecommendations(theme:string,categories:string[],limit=6){const q=cleanSearch(theme);const primary=await getPublicCatalogPage({query:q,pageSize:Math.min(12,limit*2),sort:'curadoria'});let items=primary.items;if(categories.length)items=[...items.filter(p=>categories.includes(p.category)),...items.filter(p=>!categories.includes(p.category))];if(items.length<limit){const extra=await getPublicCatalogPage({pageSize:limit,sort:'curadoria'});for(const p of extra.items)if(!items.some(x=>x.id===p.id))items.push(p);}return items.slice(0,limit);}
export async function searchCatalog(term:string,limit=8){const page=await getPublicCatalogPage({query:term,pageSize:Math.min(12,limit),sort:'curadoria'});return page.items;}
export async function getSitemapProducts():Promise<{slug:string;updated_at:string;featured:boolean}[]>{const sql=getSql();if(!sql)return demoProducts.map(p=>({slug:p.slug,updated_at:p.updated_at,featured:Boolean(p.featured)}));try{const rows=await query(sql,`SELECT p.slug,p.updated_at,p.featured FROM products p JOIN categories c ON c.id=p.category_id WHERE p.active=true AND c.active=true AND (p.publish_at IS NULL OR p.publish_at<=now()) AND (p.unpublish_at IS NULL OR p.unpublish_at>now()) ORDER BY p.updated_at DESC`);return rows.map(row=>({slug:String(row.slug||''),updated_at:String(row.updated_at||''),featured:Boolean(row.featured)})).filter(row=>Boolean(row.slug&&row.updated_at));}catch{return demoProducts.map(p=>({slug:p.slug,updated_at:p.updated_at,featured:Boolean(p.featured)}));}}

export async function getFaqs(includeInactive=false):Promise<Faq[]>{const sql=getSql();if(!sql)return[];try{return await query(sql,`SELECT * FROM faqs ${includeInactive?'':'WHERE active=true'} ORDER BY sort_order ASC,created_at ASC`) as Faq[];}catch{return[];}}
export async function createFaq(input:Omit<Faq,'id'|'created_at'|'updated_at'>){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const rows=await query(sql,`INSERT INTO faqs(question,answer,active,sort_order) VALUES($1,$2,$3,$4) RETURNING *`,[input.question,input.answer,input.active,input.sort_order]);return rows[0] as Faq;}
export async function createFaqIdempotent(input:Omit<Faq,'id'|'created_at'|'updated_at'>,idempotencyKey:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const id=adminCreateIdFromKey('faq',idempotencyKey);const rows=await query(sql,`INSERT INTO faqs(id,question,answer,active,sort_order) VALUES($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING RETURNING *`,[id,input.question,input.answer,input.active,input.sort_order]);const requested={question:input.question,answer:input.answer,active:input.active,sort_order:input.sort_order};const normalize=(row:DbRow)=>row as unknown as Faq;const result=await resolveIdempotentCreate('faq',id,rows[0],async()=>{const existing=await query(sql,`SELECT * FROM faqs WHERE id=$1 LIMIT 1`,[id]);return existing[0];},normalize,value=>({question:value.question,answer:value.answer,active:value.active,sort_order:Number(value.sort_order)}),requested);return{faq:result.value,created:result.created};}
export async function updateFaq(id:string,input:Omit<Faq,'id'|'created_at'|'updated_at'>,expectedUpdatedAt:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const params=[input.question,input.answer,input.active,input.sort_order,id,expectedUpdatedAt];const rows=await query(sql,`UPDATE faqs SET question=$1,answer=$2,active=$3,sort_order=$4,updated_at=now() WHERE id=$5 AND updated_at=$6 RETURNING *`,params);if(rows[0])return rows[0] as Faq;const exists=await query(sql,`SELECT 1 FROM faqs WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return undefined;}
export async function deleteFaq(id:string,expectedUpdatedAt:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const rows=await query(sql,`DELETE FROM faqs WHERE id=$1 AND updated_at=$2 RETURNING id`,[id,expectedUpdatedAt]);if(rows[0])return true;const exists=await query(sql,`SELECT 1 FROM faqs WHERE id=$1 LIMIT 1`,[id]);if(exists[0])throw new StaleWriteError();return false;}

type AdminAuditOptions={severity?:'info'|'warning'|'critical';requestId?:string;actorSessionId?:string|null;actorDeviceHash?:string;authMethod?:string;metadata?:Record<string,unknown>};
async function insertAdminAudit(action:string,entityType:string,entityId:string|null,summary:string,options:AdminAuditOptions={}){const sql=getSql();if(!sql)throw new Error('AUDIT_STORAGE_UNAVAILABLE');const metadata=JSON.stringify(options.metadata||{});const rows=await query(sql,`INSERT INTO admin_audit_log(action,entity_type,entity_id,summary,metadata,severity,request_id,actor_session_id,actor_device_hash,auth_method) VALUES($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10) RETURNING id,integrity_hash`,[action.slice(0,80),entityType.slice(0,80),entityId||'',summary.slice(0,500),metadata,options.severity||'info',(options.requestId||'').slice(0,120),options.actorSessionId||null,(options.actorDeviceHash||'').slice(0,128),(options.authMethod||'').slice(0,32)]);if(!rows[0]?.id||!rows[0]?.integrity_hash)throw new Error('AUDIT_PERSISTENCE_FAILED');return{id:String(rows[0].id),integrityHash:String(rows[0].integrity_hash)};}
export async function logAdminAction(action:string,entityType:string,entityId:string|null,summary:string,options:AdminAuditOptions={}){try{return await insertAdminAudit(action,entityType,entityId,summary,options);}catch{return null;}}
export async function requireCriticalAuditIntent(action:string,entityType:string,entityId:string|null,summary:string,metadata:Record<string,unknown>={}){return insertAdminAudit(`intent_${action}`,entityType,entityId,summary,{severity:'critical',metadata:{...metadata,phase:'intent'}});}
export async function getAdminAudit(limit=80):Promise<AdminAuditEntry[]>{const sql=getSql();if(!sql)return[];try{const rows=await query(sql,`SELECT id,action,entity_type,entity_id,summary,metadata,severity,request_id,actor_session_id,actor_device_hash,auth_method,prev_integrity_hash,integrity_hash,chain_version,created_at FROM admin_audit_log ORDER BY id DESC LIMIT $1`,[Math.min(5000,Math.max(1,limit))]);return rows.map(row=>({id:String(row.id),action:String(row.action),entity_type:String(row.entity_type),entity_id:String(row.entity_id||'')||null,summary:String(row.summary||''),metadata:row.metadata&&typeof row.metadata==='object'?row.metadata as Record<string,unknown>:{},severity:(['warning','critical'].includes(String(row.severity))?String(row.severity):'info') as AdminAuditEntry['severity'],request_id:String(row.request_id||''),actor_session_id:row.actor_session_id?String(row.actor_session_id):null,actor_device_hash:String(row.actor_device_hash||''),auth_method:String(row.auth_method||''),prev_integrity_hash:String(row.prev_integrity_hash||''),integrity_hash:String(row.integrity_hash||''),chain_version:Number(row.chain_version||0),created_at:new Date(String(row.created_at)).toISOString()}));}catch{return[];}}

export async function checkAdminAuditIntegrity(){const sql=getSql();if(!sql)return{configured:false,ok:true,mismatches:0,total:0,appendOnly:false,chained:false,stateOk:false,lastAuditId:null as string|null};try{const rows=await query(sql,`WITH ordered AS (SELECT a.*,lag(integrity_hash) OVER(ORDER BY id) expected_prev FROM admin_audit_log a),checked AS (SELECT *,marques_admin_audit_hash(prev_integrity_hash,id,action,entity_type,entity_id,summary,metadata,severity,request_id,actor_session_id,actor_device_hash,auth_method,created_at) expected_hash FROM ordered) SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE chain_version<>1 OR prev_integrity_hash IS DISTINCT FROM COALESCE(expected_prev,'') OR integrity_hash='' OR integrity_hash IS DISTINCT FROM expected_hash)::int mismatches,COALESCE((SELECT id::text FROM admin_audit_log ORDER BY id DESC LIMIT 1),'') last_id,COALESCE((SELECT integrity_hash FROM admin_audit_log ORDER BY id DESC LIMIT 1),'') last_hash FROM checked`);const controls=await query(sql,`SELECT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='admin_audit_append_only' AND NOT tgisinternal) append_only,EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='admin_audit_chain_before_insert' AND NOT tgisinternal) chain_before,EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='admin_audit_chain_after_insert' AND NOT tgisinternal) chain_after,(SELECT last_audit_id::text FROM admin_audit_chain_state WHERE singleton=1) state_id,(SELECT last_hash FROM admin_audit_chain_state WHERE singleton=1) state_hash`);const row=rows[0]||{};const control=controls[0]||{};const mismatches=Number(row.mismatches||0);const total=Number(row.total||0);const lastId=String(row.last_id||'');const lastHash=String(row.last_hash||'');const stateId=String(control.state_id||'');const stateHash=String(control.state_hash||'');const appendOnly=Boolean(control.append_only);const chained=Boolean(control.chain_before&&control.chain_after);const stateOk=lastId===stateId&&lastHash===stateHash;return{configured:true,ok:mismatches===0&&appendOnly&&chained&&stateOk,mismatches,total,appendOnly,chained,stateOk,lastAuditId:lastId||null};}catch{return{configured:true,ok:false,mismatches:-1,total:0,appendOnly:false,chained:false,stateOk:false,lastAuditId:null as string|null};}}


export async function recordOperationalIncident(input:{fingerprint:string;scope:string;severity:'warning'|'error'|'critical';statusCode:number;errorName:string;message:string;reference:string}){const sql=getSql();if(!sql)return null;try{await query(sql,`DELETE FROM operational_incidents WHERE resolved_at IS NOT NULL AND last_seen_at<now()-interval '180 days'`).catch(()=>{});const rows=await query(sql,`INSERT INTO operational_incidents(fingerprint,scope,severity,status_code,error_name,message,last_reference) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(fingerprint) DO UPDATE SET scope=EXCLUDED.scope,severity=EXCLUDED.severity,status_code=EXCLUDED.status_code,error_name=EXCLUDED.error_name,message=EXCLUDED.message,last_reference=EXCLUDED.last_reference,occurrences=operational_incidents.occurrences+1,last_seen_at=now(),resolved_at=NULL RETURNING id`,[input.fingerprint.slice(0,128),input.scope.slice(0,160),input.severity,Math.min(599,Math.max(400,input.statusCode)),input.errorName.slice(0,120),input.message.slice(0,500),input.reference.slice(0,120)]);return typeof rows[0]?.id==='string'?rows[0].id:null;}catch{return null;}}
export async function getOperationalIncidents(limit=80):Promise<OperationalIncident[]>{const sql=getSql();if(!sql)return[];try{const rows=await query(sql,`SELECT id,fingerprint,scope,severity,status_code,error_name,message,last_reference,occurrences,first_seen_at,last_seen_at,acknowledged_at,resolved_at FROM operational_incidents ORDER BY (resolved_at IS NULL) DESC,last_seen_at DESC LIMIT $1`,[Math.min(200,Math.max(1,limit))]);return rows.map(row=>({id:String(row.id),fingerprint:String(row.fingerprint),scope:String(row.scope),severity:(['warning','critical'].includes(String(row.severity))?String(row.severity):'error') as OperationalIncident['severity'],status_code:Number(row.status_code||500),error_name:String(row.error_name||'Error'),message:String(row.message||''),last_reference:String(row.last_reference||''),occurrences:Number(row.occurrences||1),first_seen_at:new Date(String(row.first_seen_at)).toISOString(),last_seen_at:new Date(String(row.last_seen_at)).toISOString(),acknowledged_at:row.acknowledged_at?new Date(String(row.acknowledged_at)).toISOString():null,resolved_at:row.resolved_at?new Date(String(row.resolved_at)).toISOString():null}));}catch{return[];}}
export async function acknowledgeOperationalIncident(id:string){const sql=getSql();if(!sql)return false;try{const rows=await query(sql,`UPDATE operational_incidents SET acknowledged_at=COALESCE(acknowledged_at,now()) WHERE id=$1 RETURNING id`,[id]);return Boolean(rows[0]);}catch{return false;}}
export async function resolveOperationalIncident(id:string){const sql=getSql();if(!sql)return false;try{const rows=await query(sql,`UPDATE operational_incidents SET acknowledged_at=COALESCE(acknowledged_at,now()),resolved_at=COALESCE(resolved_at,now()) WHERE id=$1 RETURNING id`,[id]);return Boolean(rows[0]);}catch{return false;}}
export async function getOperationalIncidentSummary(){const sql=getSql();if(!sql)return{open:0,critical:0,unacknowledged:0};try{const rows=await query(sql,`SELECT COUNT(*) FILTER (WHERE resolved_at IS NULL)::int open,COUNT(*) FILTER (WHERE resolved_at IS NULL AND severity='critical')::int critical,COUNT(*) FILTER (WHERE resolved_at IS NULL AND acknowledged_at IS NULL)::int unacknowledged FROM operational_incidents`);return{open:Number(rows[0]?.open||0),critical:Number(rows[0]?.critical||0),unacknowledged:Number(rows[0]?.unacknowledged||0)};}catch{return{open:0,critical:0,unacknowledged:0};}}

export async function createAdminSessionRecord(input:{sessionHash:string;deviceHash:string;deviceLabel:string;userAgent:string;userAgentHash:string;ipHash:string;expiresAt:string;mfaVerifiedAt:string|null;authMethod:'password'|'totp'|'recovery'}){
  const sql=getSql();if(!sql)return null;
  await query(sql,`DELETE FROM admin_sessions WHERE COALESCE(revoked_at,expires_at) < now()-interval '7 days'`).catch(()=>{});
  const rows=await query(sql,`INSERT INTO admin_sessions(session_hash,device_hash,device_label,user_agent,user_agent_hash,ip_hash,expires_at,mfa_verified_at,auth_method) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[input.sessionHash,input.deviceHash,input.deviceLabel.slice(0,120),input.userAgent.slice(0,500),input.userAgentHash,input.ipHash,input.expiresAt,input.mfaVerifiedAt,input.authMethod]);
  await query(sql,`UPDATE admin_sessions SET revoked_at=now() WHERE id IN (SELECT id FROM admin_sessions WHERE revoked_at IS NULL AND expires_at>now() ORDER BY created_at DESC OFFSET 12)`).catch(()=>{});
  return typeof rows[0]?.id==='string'?rows[0].id:null;
}
export async function verifyAdminSessionRecord(sessionHash:string,userAgentHash='',requireMfa=false){
  const sql=getSql();if(!sql)return true;
  const rows=await query(sql,`SELECT id,last_seen_at FROM admin_sessions WHERE session_hash=$1 AND revoked_at IS NULL AND expires_at>now() AND ($2='' OR user_agent_hash='' OR user_agent_hash=$2) AND ($3=false OR mfa_verified_at IS NOT NULL) LIMIT 1`,[sessionHash,userAgentHash,requireMfa]);
  if(!rows[0])return false;
  const lastSeen=rows[0].last_seen_at?new Date(String(rows[0].last_seen_at)).getTime():0;
  if(!lastSeen||Date.now()-lastSeen>5*60_000)await query(sql,`UPDATE admin_sessions SET last_seen_at=now() WHERE session_hash=$1 AND revoked_at IS NULL AND expires_at>now()`,[sessionHash]).catch(()=>{});
  return true;
}
export async function getAdminSessionContextByHash(sessionHash:string,userAgentHash='',requireMfa=false){const sql=getSql();if(!sql)return null;const rows=await query(sql,`SELECT id,device_hash,auth_method FROM admin_sessions WHERE session_hash=$1 AND revoked_at IS NULL AND expires_at>now() AND ($2='' OR user_agent_hash='' OR user_agent_hash=$2) AND ($3=false OR mfa_verified_at IS NOT NULL) LIMIT 1`,[sessionHash,userAgentHash,requireMfa]);const row=rows[0];return typeof row?.id==='string'?{id:row.id,deviceHash:String(row.device_hash||''),authMethod:String(row.auth_method||'password') as 'password'|'totp'|'recovery'}:null;}
export async function getAdminSessionIdByHash(sessionHash:string,userAgentHash='',requireMfa=false){const context=await getAdminSessionContextByHash(sessionHash,userAgentHash,requireMfa);return context?.id||null;}
export async function getAdminSessions():Promise<AdminSession[]>{const sql=getSql();if(!sql)return[];const rows=await query(sql,`SELECT id,device_hash,device_label,user_agent,created_at,last_seen_at,expires_at,mfa_verified_at,last_reauth_at,auth_method,revoked_at FROM admin_sessions WHERE revoked_at IS NULL AND expires_at>now() ORDER BY last_seen_at DESC,created_at DESC LIMIT 100`);return rows.map(row=>({id:String(row.id),device_hash:String(row.device_hash||''),device_label:String(row.device_label||'Dispositivo'),user_agent:String(row.user_agent||''),created_at:new Date(String(row.created_at)).toISOString(),last_seen_at:new Date(String(row.last_seen_at)).toISOString(),expires_at:new Date(String(row.expires_at)).toISOString(),mfa_verified_at:row.mfa_verified_at?new Date(String(row.mfa_verified_at)).toISOString():null,last_reauth_at:row.last_reauth_at?new Date(String(row.last_reauth_at)).toISOString():null,auth_method:(['totp','recovery'].includes(String(row.auth_method))?String(row.auth_method):'password') as AdminSession['auth_method'],revoked_at:row.revoked_at?new Date(String(row.revoked_at)).toISOString():null}));}
export async function consumeAdminMfaStep(step:number){const sql=getSql();if(!sql)return true;await query(sql,`DELETE FROM admin_mfa_used_steps WHERE used_at<now()-interval '1 day'`).catch(()=>{});const rows=await query(sql,`INSERT INTO admin_mfa_used_steps(step) VALUES($1) ON CONFLICT(step) DO NOTHING RETURNING step`,[step]);return Boolean(rows[0]);}
export async function replaceAdminRecoveryCodes(codeHashes:string[]){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const safe=[...new Set(codeHashes.filter(value=>/^[0-9a-f]{64}$/i.test(value)))].slice(0,20);if(!safe.length)throw new Error('Nenhum código de recuperação válido.');const rows=await query(sql,`WITH cleared AS (DELETE FROM admin_mfa_recovery_codes), inserted AS (INSERT INTO admin_mfa_recovery_codes(code_hash) SELECT unnest($1::text[]) RETURNING id) SELECT COUNT(*)::int count FROM inserted`,[safe]);return Number(rows[0]?.count||0);}
export async function consumeAdminRecoveryCode(codeHash:string){const sql=getSql();if(!sql)return false;const rows=await query(sql,`UPDATE admin_mfa_recovery_codes SET used_at=now() WHERE code_hash=$1 AND used_at IS NULL RETURNING id`,[codeHash]);return Boolean(rows[0]);}
export async function getAdminRecoveryCodeStatus(){const sql=getSql();if(!sql)return{configured:false,total:0,remaining:0};const rows=await query(sql,`SELECT COUNT(*)::int total,COUNT(*) FILTER (WHERE used_at IS NULL)::int remaining FROM admin_mfa_recovery_codes`);return{configured:Number(rows[0]?.total||0)>0,total:Number(rows[0]?.total||0),remaining:Number(rows[0]?.remaining||0)};}
export async function registerAdminKnownDevice(input:{deviceHash:string;deviceLabel:string;userAgent:string;userAgentHash:string}){const sql=getSql();if(!sql)return{isNew:false,id:null as string|null};const rows=await query(sql,`WITH existing AS (SELECT id,revoked_at FROM admin_known_devices WHERE device_hash=$1), upserted AS (INSERT INTO admin_known_devices(device_hash,device_label,user_agent,user_agent_hash) VALUES($1,$2,$3,$4) ON CONFLICT(device_hash) DO UPDATE SET device_label=EXCLUDED.device_label,user_agent=EXCLUDED.user_agent,user_agent_hash=EXCLUDED.user_agent_hash,last_seen_at=now(),last_login_at=now(),revoked_at=NULL RETURNING id) SELECT id,(NOT EXISTS(SELECT 1 FROM existing WHERE revoked_at IS NULL)) AS is_new FROM upserted`,[input.deviceHash,input.deviceLabel.slice(0,120),input.userAgent.slice(0,500),input.userAgentHash]);return{id:typeof rows[0]?.id==='string'?rows[0].id:null,isNew:Boolean(rows[0]?.is_new)};}
export async function getAdminKnownDevices():Promise<AdminKnownDevice[]>{const sql=getSql();if(!sql)return[];const rows=await query(sql,`SELECT id,device_hash,device_label,user_agent,first_seen_at,last_seen_at,last_login_at,revoked_at FROM admin_known_devices ORDER BY last_login_at DESC LIMIT 100`);return rows.map(row=>({id:String(row.id),device_hash:String(row.device_hash||''),device_label:String(row.device_label||'Dispositivo'),user_agent:String(row.user_agent||''),first_seen_at:new Date(String(row.first_seen_at)).toISOString(),last_seen_at:new Date(String(row.last_seen_at)).toISOString(),last_login_at:new Date(String(row.last_login_at)).toISOString(),revoked_at:row.revoked_at?new Date(String(row.revoked_at)).toISOString():null}));}
export async function revokeAdminKnownDeviceById(id:string){const sql=getSql();if(!sql)return null;const rows=await query(sql,`UPDATE admin_known_devices SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 RETURNING device_hash,device_label`,[id]);const row=rows[0];if(!row)return null;const deviceHash=String(row.device_hash||'');if(deviceHash)await query(sql,`UPDATE admin_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE device_hash=$1 AND revoked_at IS NULL`,[deviceHash]);return{deviceHash,deviceLabel:String(row.device_label||'Dispositivo')};}
export async function recordAdminSecurityEvent(input:{eventType:AdminSecurityEvent['event_type'];severity:AdminSecurityEvent['severity'];deviceHash?:string;deviceLabel?:string;summary:string}){const sql=getSql();if(!sql)return null;await query(sql,`DELETE FROM admin_security_events WHERE created_at<now()-interval '180 days'`).catch(()=>{});const rows=await query(sql,`INSERT INTO admin_security_events(event_type,severity,device_hash,device_label,summary,acknowledged_at) VALUES($1,$2,$3,$4,$5,CASE WHEN $2='info' THEN now() ELSE NULL END) RETURNING id`,[input.eventType,input.severity,input.deviceHash||'',(input.deviceLabel||'').slice(0,120),input.summary.slice(0,500)]);return Number(rows[0]?.id||0)||null;}
export async function getAdminSecurityEvents(limit=40):Promise<AdminSecurityEvent[]>{const sql=getSql();if(!sql)return[];const rows=await query(sql,`SELECT id,event_type,severity,device_hash,device_label,summary,created_at,acknowledged_at FROM admin_security_events ORDER BY created_at DESC LIMIT $1`,[Math.min(100,Math.max(1,limit))]);return rows.map(row=>({id:Number(row.id),event_type:String(row.event_type) as AdminSecurityEvent['event_type'],severity:String(row.severity) as AdminSecurityEvent['severity'],device_hash:String(row.device_hash||''),device_label:String(row.device_label||''),summary:String(row.summary||''),created_at:new Date(String(row.created_at)).toISOString(),acknowledged_at:row.acknowledged_at?new Date(String(row.acknowledged_at)).toISOString():null}));}
export async function acknowledgeAdminSecurityEvents(ids:number[]=[]){const sql=getSql();if(!sql)return 0;const safe=[...new Set(ids.filter(Number.isSafeInteger).filter(id=>id>0))].slice(0,100);const rows=safe.length?await query(sql,`UPDATE admin_security_events SET acknowledged_at=COALESCE(acknowledged_at,now()) WHERE id=ANY($1::bigint[]) AND acknowledged_at IS NULL RETURNING id`,[safe]):await query(sql,`UPDATE admin_security_events SET acknowledged_at=COALESCE(acknowledged_at,now()) WHERE acknowledged_at IS NULL RETURNING id`);return rows.length;}
export async function markAdminSessionReauthenticated(sessionHash:string){const sql=getSql();if(!sql)return false;const rows=await query(sql,`UPDATE admin_sessions SET last_reauth_at=now(),last_seen_at=now() WHERE session_hash=$1 AND revoked_at IS NULL AND expires_at>now() RETURNING id`,[sessionHash]);return Boolean(rows[0]);}
export async function hasRecentAdminReauth(sessionHash:string,maxAgeSeconds=300){const sql=getSql();if(!sql)return false;const seconds=Math.min(1800,Math.max(30,Math.floor(maxAgeSeconds)));const rows=await query(sql,`SELECT EXISTS(SELECT 1 FROM admin_sessions WHERE session_hash=$1 AND revoked_at IS NULL AND expires_at>now() AND last_reauth_at>=now()-make_interval(secs=>$2::int)) AS ok`,[sessionHash,seconds]);return Boolean(rows[0]?.ok);}
export async function revokeAdminSessionByHash(sessionHash:string){const sql=getSql();if(!sql)return false;const rows=await query(sql,`UPDATE admin_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE session_hash=$1 AND revoked_at IS NULL RETURNING id`,[sessionHash]);return Boolean(rows[0]);}
export async function revokeAdminSessionById(id:string){const sql=getSql();if(!sql)return false;const rows=await query(sql,`UPDATE admin_sessions SET revoked_at=COALESCE(revoked_at,now()) WHERE id=$1 AND revoked_at IS NULL RETURNING id`,[id]);return Boolean(rows[0]);}
export async function revokeOtherAdminSessions(currentSessionHash:string){const sql=getSql();if(!sql)return 0;const rows=await query(sql,`UPDATE admin_sessions SET revoked_at=now() WHERE session_hash<>$1 AND revoked_at IS NULL AND expires_at>now() RETURNING id`,[currentSessionHash]);return rows.length;}

export async function getSiteEventsDaily(limit=50000){const sql=getSql();if(!sql)return[];try{return await query(sql,`SELECT day,event,path,count FROM site_events_daily ORDER BY day ASC,event ASC,path ASC LIMIT $1`,[Math.min(100000,Math.max(1,limit))]);}catch{return[];}}


// Exportação de backup deliberadamente separada das consultas de tela:
// sem LIMIT e sem catch/fallback silencioso. Um backup parcial nunca é tratado como íntegro.
export async function getBackupExportStrict(options:{includeMediaTombstones?:boolean}={}){
  const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');
  const [rawProducts,categories,inquiries,settingsRows,testimonials,faqs,inquiryActivity,socialPlans,marketingCampaigns,siteEvents,audit,privacyTombstones]=await Promise.all([
    query(sql,`SELECT * FROM products ORDER BY created_at,id`),
    query(sql,`SELECT * FROM categories ORDER BY sort_order,name,id`),
    query(sql,`SELECT * FROM inquiries ORDER BY created_at,id`),
    query(sql,`SELECT * FROM site_settings WHERE id=1`),
    query(sql,`SELECT * FROM testimonials ORDER BY sort_order,created_at,id`),
    query(sql,`SELECT * FROM faqs ORDER BY sort_order,created_at,id`),
    query(sql,`SELECT * FROM inquiry_activity ORDER BY created_at,id`),
    query(sql,`SELECT * FROM social_content_plans ORDER BY planned_at,id`),
    query(sql,`SELECT * FROM marketing_campaigns ORDER BY created_at,id`),
    query(sql,`SELECT day,event,path,count FROM site_events_daily ORDER BY day,event,path`),
    query(sql,`SELECT * FROM admin_audit_log ORDER BY created_at,id`),
    query(sql,`SELECT subject_hash,identity_type,action,matched_inquiries,created_at,last_applied_at FROM privacy_requests WHERE action='anonymized' ORDER BY identity_type,subject_hash`)
  ]);
  if(!settingsRows[0])throw new Error('BACKUP_SETTINGS_MISSING');
  const products=rawProducts.filter(row=>!row.deleted_at),archivedProducts=rawProducts.filter(row=>Boolean(row.deleted_at));
  const content:Record<string,unknown>={products,archived_products:archivedProducts,categories,inquiries,settings:settingsRows[0],testimonials,faqs,inquiry_activity:inquiryActivity,social_content_plans:socialPlans,marketing_campaigns:marketingCampaigns,site_events_daily:siteEvents,audit,privacy_tombstones:mergePrivacyTombstones(privacyTombstones)};
  if(options.includeMediaTombstones){content.media_deletion_tombstones=normalizeMediaDeletionTombstones(await query(sql,`SELECT url,storage_key,deleted_at FROM media_deletion_tombstones ORDER BY storage_key,url`),{strict:true});}
  return content;
}

export async function recordSiteEvent(event:string,path:string){const sql=getSql();if(!sql)return;try{await query(sql,`INSERT INTO site_events_daily(day,event,path,count) VALUES(current_date,$1,$2,1) ON CONFLICT(day,event,path) DO UPDATE SET count=site_events_daily.count+1`,[event,path.slice(0,240)]);}catch{}}
export async function getAnalyticsSummary(days=30):Promise<AnalyticsSummary>{const emptyVitals={lcp:{good:0,needs:0,poor:0},cls:{good:0,needs:0,poor:0},ttfb:{good:0,needs:0,poor:0}};const sql=getSql();if(!sql)return{views:0,product_views:0,quote_starts:0,quote_submits:0,whatsapp_clicks:0,social_clicks:0,top_pages:[],top_products:[],top_social:[],vitals:emptyVitals};try{const rows=await query(sql,`SELECT event,SUM(count)::int count FROM site_events_daily WHERE day>=current_date-$1::int GROUP BY event`,[days]);const map=Object.fromEntries(rows.map(r=>[String(r.event),Number(r.count)]));const pages=await query(sql,`SELECT path,SUM(count)::int count FROM site_events_daily WHERE day>=current_date-$1::int AND event='page_view' GROUP BY path ORDER BY count DESC LIMIT 8`,[days]);const productPages=await query(sql,`SELECT path,SUM(count)::int count FROM site_events_daily WHERE day>=current_date-$1::int AND event='product_view' GROUP BY path ORDER BY count DESC LIMIT 100`,[days]);const social=await query(sql,`SELECT path,SUM(count)::int count FROM site_events_daily WHERE day>=current_date-$1::int AND event='social_click' GROUP BY path ORDER BY count DESC LIMIT 12`,[days]);const b=(metric:string)=>({good:map[`vital_${metric}_good`]||0,needs:map[`vital_${metric}_needs`]||0,poor:map[`vital_${metric}_poor`]||0});return{views:map.page_view||0,product_views:map.product_view||0,quote_starts:map.quote_start||0,quote_submits:map.quote_submit||0,whatsapp_clicks:map.whatsapp_click||0,social_clicks:map.social_click||0,top_pages:pages.map(r=>({path:String(r.path),count:Number(r.count)})),top_products:productPages.map(r=>({path:String(r.path),count:Number(r.count)})),top_social:social.map(r=>({path:String(r.path),count:Number(r.count)})),vitals:{lcp:b('lcp'),cls:b('cls'),ttfb:b('ttfb')}};}catch{return{views:0,product_views:0,quote_starts:0,quote_submits:0,whatsapp_clicks:0,social_clicks:0,top_pages:[],top_products:[],top_social:[],vitals:emptyVitals};}}
export async function isMediaUrlInUse(url:string){const sql=getSql();if(!sql)throw new Error('MEDIA_REFERENCE_CHECK_UNAVAILABLE');const rows=await query(sql,`SELECT EXISTS(SELECT 1 FROM products WHERE $1=ANY(image_urls)) OR EXISTS(SELECT 1 FROM categories WHERE image_url=$1) OR EXISTS(SELECT 1 FROM site_settings WHERE logo_url=$1 OR hero_image_url=$1) AS used`,[url]);return Boolean(rows[0]?.used);}
const DEV_MEDIA_LEASE={state:'acquired',token:'00000000-0000-4000-8000-000000000000',operation:'upload',expires_at:new Date(Date.now()+300_000).toISOString()} as const;
export async function beginMediaDeletion(url:string,storageKey:string):Promise<MediaLifecycleLease>{const sql=getSql();if(!sql)throw new Error('MEDIA_REFERENCE_CHECK_UNAVAILABLE');const rows=await query(sql,`SELECT marques_begin_media_delete($1,$2) AS lease`,[url,storageKey]);return parseMediaLifecycleLease(rows[0]?.lease);}
export async function completeMediaDeletion(url:string,storageKey:string,token:string){const sql=getSql();if(!sql)throw new Error('MEDIA_LIFECYCLE_UNAVAILABLE');const rows=await query(sql,`SELECT marques_complete_media_delete($1,$2,$3::uuid) AS completed`,[url,storageKey,token]);if(!rows[0]?.completed)throw new Error('MEDIA_DELETE_LEASE_LOST');return true;}
export async function failMediaDeletion(url:string,storageKey:string,token:string,errorCode:string){const sql=getSql();if(!sql)return false;const rows=await query(sql,`SELECT marques_fail_media_delete($1,$2,$3::uuid,$4) AS recorded`,[url,storageKey,token,errorCode]);return Boolean(rows[0]?.recorded);}
export async function beginMediaUpload(url:string,storageKey:string):Promise<MediaLifecycleLease>{const sql=getSql();if(!sql){if(process.env.NODE_ENV==='production')throw new Error('MEDIA_LIFECYCLE_UNAVAILABLE');return DEV_MEDIA_LEASE;}const rows=await query(sql,`SELECT marques_begin_media_upload($1,$2) AS lease`,[url,storageKey]);return parseMediaLifecycleLease(rows[0]?.lease);}
export async function completeMediaUpload(url:string,storageKey:string,token:string){const sql=getSql();if(!sql){if(process.env.NODE_ENV==='production')throw new Error('MEDIA_LIFECYCLE_UNAVAILABLE');return 0;}const rows=await query(sql,`SELECT marques_complete_media_upload($1,$2,$3::uuid)::int AS removed`,[url,storageKey,token]);return Number(rows[0]?.removed||0);}
export async function failMediaUpload(url:string,storageKey:string,token:string,errorCode:string){const sql=getSql();if(!sql)return false;const rows=await query(sql,`SELECT marques_fail_media_upload($1,$2,$3::uuid,$4) AS recorded`,[url,storageKey,token,errorCode]);return Boolean(rows[0]?.recorded);}

export async function getPublicTags(limit=500):Promise<{tag:string;count:number}[]>{
  const sql=getSql();const safeLimit=Math.min(5000,Math.max(1,limit));
  if(!sql){const counts=new Map<string,{tag:string;count:number}>();for(const product of demoProducts){for(const tag of product.tags){const key=tag.toLocaleLowerCase('pt-BR');const item=counts.get(key)||{tag,count:0};item.count++;counts.set(key,item);}}return [...counts.values()].sort((a,b)=>b.count-a.count||a.tag.localeCompare(b.tag,'pt-BR')).slice(0,safeLimit);}
  try{const rows=await query(sql,`SELECT tag_value AS tag,COUNT(*)::int count FROM products p JOIN categories c ON c.id=p.category_id CROSS JOIN LATERAL unnest(p.tags) tag_value WHERE p.active=true AND c.active=true AND (p.publish_at IS NULL OR p.publish_at<=now()) AND (p.unpublish_at IS NULL OR p.unpublish_at>now()) AND length(trim(tag_value))>1 GROUP BY tag_value ORDER BY count DESC,tag_value ASC LIMIT $1`,[safeLimit]);return rows.map(row=>({tag:String(row.tag),count:Number(row.count)}));}catch{return [];}
}
export async function getPublicTagBySlug(slug:string){const safe=slugifyText(slug);if(!safe)return null;const tags=await getPublicTags(500);return tags.find(item=>slugifyText(item.tag)===safe)||null;}

export async function getPublicPopularTags(limit=8,categorySlug?:string):Promise<{tag:string;count:number}[]>{
  const sql=getSql();const safeLimit=Math.min(12,Math.max(1,limit));
  if(!sql){const categoryName=categorySlug?fallbackCategories.find(name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')===categorySlug)||'':'';const counts=new Map<string,{tag:string;count:number}>();for(const product of demoProducts){if(categoryName&&product.category!==categoryName)continue;for(const tag of product.tags){const key=tag.toLocaleLowerCase('pt-BR');const item=counts.get(key)||{tag,count:0};item.count++;counts.set(key,item);}}return [...counts.values()].sort((a,b)=>b.count-a.count||a.tag.localeCompare(b.tag,'pt-BR')).slice(0,safeLimit);}
  try{const rows=await query(sql,`SELECT tag_value AS tag,COUNT(*)::int count FROM products p JOIN categories c ON c.id=p.category_id CROSS JOIN LATERAL unnest(p.tags) tag_value WHERE p.active=true AND c.active=true AND (p.publish_at IS NULL OR p.publish_at<=now()) AND (p.unpublish_at IS NULL OR p.unpublish_at>now()) AND length(trim(tag_value))>1 AND ($2::text IS NULL OR c.slug=$2) GROUP BY tag_value ORDER BY count DESC,tag_value ASC LIMIT $1`,[safeLimit,categorySlug||null]);return rows.map(row=>({tag:String(row.tag),count:Number(row.count)}));}catch{return [];}
}

export async function getPublicCategoryCounts():Promise<Record<string,number>>{
  const sql=getSql();
  if(!sql){const out:Record<string,number>={};for(const p of demoProducts){if(!p.active)continue;out[p.category]=(out[p.category]||0)+1;}return out;}
  try{
    const rows=await sql`SELECT c.name,COUNT(p.id)::int AS count FROM categories c LEFT JOIN products p ON p.category_id=c.id AND p.active=true AND (p.publish_at IS NULL OR p.publish_at<=now()) AND (p.unpublish_at IS NULL OR p.unpublish_at>now()) WHERE c.active=true GROUP BY c.id,c.name`;
    return Object.fromEntries(asRows(rows).map(r=>[String(r.name),Number(r.count||0)]));
  }catch(error){
    if(!missingColumn(error,'category_id')&&!missingColumn(error,'publish_at')&&!missingColumn(error,'unpublish_at'))throw error;
    const rows=await sql`SELECT c.name,COUNT(p.id)::int AS count FROM categories c LEFT JOIN products p ON p.category=c.name AND p.active=true WHERE c.active=true GROUP BY c.id,c.name`;
    return Object.fromEntries(asRows(rows).map(r=>[String(r.name),Number(r.count||0)]));
  }
}


export type AdminRestoreSnapshot={id:string;source_backup_sha256:string;snapshot_sha256:string;counts:Record<string,number>;created_at:string;expires_at:string;restored_at:string|null};
function normalizeRestoreCounts(value:unknown){const source=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};return Object.fromEntries(Object.entries(source).map(([key,item])=>[key,Number(item||0)]));}
export async function getBusinessRestoreCounts(){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const rows=await query(sql,`SELECT marques_current_business_restore_counts() AS counts`);return normalizeRestoreCounts(rows[0]?.counts);}
export async function createBusinessRestoreSnapshot(sourceBackupSha256:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const rows=await query(sql,`SELECT * FROM marques_create_restore_snapshot($1)`,[sourceBackupSha256]);const row=rows[0];if(!row)throw new Error('RESTORE_SNAPSHOT_FAILED');return{id:String(row.snapshot_id),snapshot_sha256:String(row.snapshot_sha256),counts:normalizeRestoreCounts(row.counts),created_at:new Date(String(row.created_at)).toISOString(),expires_at:new Date(String(row.expires_at)).toISOString()};}
export async function getMediaDeletionTombstones(){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');return normalizeMediaDeletionTombstones(await query(sql,`SELECT url,storage_key,deleted_at FROM media_deletion_tombstones ORDER BY storage_key,url`),{strict:true});}
export async function prepareBusinessRestorePayloadForSafety(payload:Record<string,unknown>,expectedCounts:Record<string,number>,embeddedPrivacyTombstones:unknown[]=[],options:{mediaMode?:'merge'|'exact'}={}){const prepared=await prepareBusinessRestorePayloadForPrivacy(payload,expectedCounts,embeddedPrivacyTombstones);const hasEmbeddedMedia=Object.prototype.hasOwnProperty.call(payload,'media_deletion_tombstones');const mediaMode=options.mediaMode==='exact'?'exact':'merge';if(!hasEmbeddedMedia){if(mediaMode==='exact')return{...prepared,mediaTombstones:[],mediaMode:'preserved' as const};const current=await getMediaDeletionTombstones();assertNoMediaTombstoneReferences(prepared.payload,current);return{...prepared,mediaTombstones:current,mediaMode:'preserved' as const};}const embeddedMedia=normalizeMediaDeletionTombstones(payload.media_deletion_tombstones,{strict:true});const mediaTombstones=mediaMode==='exact'?embeddedMedia:mergeMediaDeletionTombstones(await getMediaDeletionTombstones(),embeddedMedia);assertNoMediaTombstoneReferences(prepared.payload,mediaTombstones);return{...prepared,payload:{...prepared.payload,media_deletion_tombstones:mediaTombstones},mediaTombstones,mediaMode};}
export async function applyBusinessRestorePayload(payload:Record<string,unknown>,expectedCounts:Record<string,number>,sourceBackupSha256='',embeddedTombstones:unknown[]=[],options:{mediaMode?:'merge'|'exact'}={}){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const prepared=await prepareBusinessRestorePayloadForSafety(payload,expectedCounts,embeddedTombstones,options);const rows=await query(sql,`SELECT marques_restore_business_payload($1::jsonb,$2::jsonb,$3,$4::jsonb,$5) AS result`,[JSON.stringify(prepared.payload),JSON.stringify(prepared.counts),sourceBackupSha256,JSON.stringify(prepared.tombstones),options.mediaMode==='exact'?'exact':'merge']);const raw=rows[0]?.result&&typeof rows[0].result==='object'?rows[0].result as Record<string,unknown>:{};return{counts:normalizeRestoreCounts(raw.counts),privacy:{anonymized:prepared.anonymizedCount,activity_removed:prepared.removedActivityCount,tombstones_merged:prepared.tombstoneCount},media:{tombstones_mode:String(raw.media_tombstones_mode||prepared.mediaMode),tombstones_restored:Number(raw.media_tombstones_restored||0),effective_tombstones:prepared.mediaTombstones.length},snapshot:{id:String(raw.snapshot_id||''),sha256:String(raw.snapshot_sha256||''),expires_at:raw.snapshot_expires_at?new Date(String(raw.snapshot_expires_at)).toISOString():''}};}
export async function listBusinessRestoreSnapshots(limit=10):Promise<AdminRestoreSnapshot[]>{const sql=getSql();if(!sql)return[];try{const rows=await query(sql,`SELECT id,source_backup_sha256,snapshot_sha256,counts,created_at,expires_at,restored_at FROM admin_restore_snapshots WHERE expires_at>now() ORDER BY created_at DESC LIMIT $1`,[Math.min(20,Math.max(1,limit))]);return rows.map(row=>({id:String(row.id),source_backup_sha256:String(row.source_backup_sha256||''),snapshot_sha256:String(row.snapshot_sha256||''),counts:normalizeRestoreCounts(row.counts),created_at:new Date(String(row.created_at)).toISOString(),expires_at:new Date(String(row.expires_at)).toISOString(),restored_at:row.restored_at?new Date(String(row.restored_at)).toISOString():null}));}catch{return[];}}
export async function restoreBusinessSnapshot(snapshotId:string){const sql=getSql();if(!sql)throw new Error('DATABASE_URL não configurada.');const rows=await query(sql,`SELECT payload,counts FROM admin_restore_snapshots WHERE id=$1 AND expires_at>now() LIMIT 1`,[snapshotId]);const row=rows[0];if(!row)throw new Error('RESTORE_SNAPSHOT_NOT_FOUND');const counts=normalizeRestoreCounts(row.counts);const result=await applyBusinessRestorePayload(row.payload as Record<string,unknown>,counts,`rollback:${snapshotId}`,[],{mediaMode:'exact'});await query(sql,`UPDATE admin_restore_snapshots SET restored_at=now() WHERE id=$1`,[snapshotId]);return result;}

export async function getMediaRecoveryDrillFreshness(){const required=Boolean(process.env.S3_ENDPOINT&&process.env.S3_BUCKET&&process.env.BACKUP_S3_ENDPOINT&&process.env.BACKUP_S3_BUCKET);const max=normalizeMediaRecoveryDrillMaxAgeHours(process.env.MEDIA_RECOVERY_DRILL_MAX_AGE_HOURS);if(!required)return evaluateMediaRecoveryDrillFreshness(null,max,false);const sql=getSql();if(!sql)return{...evaluateMediaRecoveryDrillFreshness(null,max,true),state:'unavailable'};try{const rows=await query(sql,`SELECT object_count,verified_bytes,duration_ms,succeeded_at FROM media_recovery_drill_receipts ORDER BY succeeded_at DESC,id DESC LIMIT 1`);const row=rows[0];const fresh=evaluateMediaRecoveryDrillFreshness(row?.succeeded_at?new Date(String(row.succeeded_at)).toISOString():null,max,true);return{...fresh,object_count:row?Number(row.object_count||0):null,verified_bytes:row?Number(row.verified_bytes||0):null,duration_ms:row?Number(row.duration_ms||0):null};}catch{return{...evaluateMediaRecoveryDrillFreshness(null,max,true),state:'unavailable'};}}
