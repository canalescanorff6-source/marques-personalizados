import { z } from 'zod';
import { normalizeWhatsapp } from './links';
import { WHATSAPP_TEMPLATE_VARIABLES } from './whatsapp-templates';
import { isSafeExternalHttpsUrl,isSafePublicUrl } from './public-url';

const optionalPublicUrl = z.string().trim().max(500).refine(isSafePublicUrl, 'Use uma URL HTTPS ou um caminho interno iniciado por /.');
const optionalExternalHttpsUrl = z.string().trim().max(500).refine(v=>!v||isSafeExternalHttpsUrl(v), 'Use uma URL HTTPS externa válida.');

const customizationFieldSchema = z.object({
  id: z.string().trim().min(1).max(40).regex(/^[a-z0-9_-]+$/),
  label: z.string().trim().min(2).max(60),
  type: z.enum(['text','number','select']),
  required: z.boolean(),
  placeholder: z.string().trim().max(80).optional().default(''),
  options: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
}).superRefine((value,ctx)=>{if(value.type==='select'&&value.options.length<2)ctx.addIssue({code:z.ZodIssueCode.custom,path:['options'],message:'Campo de seleção precisa de ao menos duas opções.'});});

export const productSchema = z.object({
  slug: z.string().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(120),
  category: z.string().trim().min(2).max(80),
  description: z.string().trim().min(5).max(3000),
  price_cents: z.number().int().nonnegative().nullable(),
  image_urls: z.array(optionalPublicUrl).max(10),
  featured: z.boolean(),
  active: z.boolean(),
  stock_status: z.enum(['disponivel', 'sob_encomenda', 'indisponivel']),
  tags: z.array(z.string().trim().min(1).max(40)).max(16),
  sort_order: z.number().int().min(0).max(9999),
  min_quantity: z.number().int().min(1).max(99999).nullable(),
  production_time: z.string().trim().max(100),
  seo_title: z.string().trim().max(70),
  seo_description: z.string().trim().max(170),
  badge: z.string().trim().max(30),
  customization_fields: z.array(customizationFieldSchema).max(8),
  publish_at: z.string().datetime().nullable(),
  unpublish_at: z.string().datetime().nullable(),
}).superRefine((value,ctx)=>{if(value.publish_at&&value.unpublish_at&&new Date(value.unpublish_at)<=new Date(value.publish_at))ctx.addIssue({code:z.ZodIssueCode.custom,path:['unpublish_at'],message:'A retirada deve acontecer depois da publicação.'});const ids=new Set<string>();for(const [index,field] of value.customization_fields.entries()){if(ids.has(field.id))ctx.addIssue({code:z.ZodIssueCode.custom,path:['customization_fields',index,'id'],message:'Identificador duplicado.'});ids.add(field.id);}});

export const categorySchema = z.object({
  slug: z.string().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500),
  image_url: optionalPublicUrl.nullable(),
  active: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
});

const attributionSchema=z.object({source:z.string().trim().max(80).optional(),medium:z.string().trim().max(80).optional(),campaign:z.string().trim().max(120).optional(),content:z.string().trim().max(120).optional(),term:z.string().trim().max(120).optional(),landing_path:z.string().trim().max(180).regex(/^\//).optional(),referrer_host:z.string().trim().max(120).regex(/^[a-z0-9.-]+$/i).optional()}).optional();

const inquiryBriefSchema = z.object({
  occasion: z.string().trim().max(80).optional().default(''),
  theme: z.string().trim().max(120).optional().default(''),
  celebrant_name: z.string().trim().max(120).optional().default(''),
  celebrant_age: z.string().trim().max(40).optional().default(''),
  guest_count: z.number().int().min(1).max(10000).nullable().optional(),
  budget_range: z.string().trim().max(60).optional().default(''),
  desired_categories: z.array(z.string().trim().min(1).max(80)).max(12).optional().default([]),
  source: z.enum(['site','concierge','shared_list']).optional(),
  attribution: attributionSchema,
}).optional().default({});

export const inquirySchema = z.object({
  request_id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(120),
  whatsapp: z.string().trim().min(8).max(30),
  email: z.string().trim().email().max(180).or(z.literal('')).optional(),
  event_date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
  product_id: z.string().uuid().or(z.literal('')).optional(),
  product_name: z.string().trim().max(120).optional().default(''),
  category: z.string().trim().max(80).optional().default(''),
  message: z.string().trim().max(2000).optional().default(''),
  items: z.array(z.object({product_id:z.string().uuid(),quantity:z.number().int().min(1).max(99999),customizations:z.record(z.string().trim().max(200)).optional().default({})})).max(30).optional().default([]),
  brief: inquiryBriefSchema,
  website: z.string().max(200).optional().default(''),
}).superRefine((value,ctx)=>{if(!value.message.trim()&&!value.items.length){ctx.addIssue({code:z.ZodIssueCode.custom,path:['message'],message:'Descreva o que você precisa ou adicione itens à lista.'});}});

export const inquiryAdminSchema = z.object({
  status: z.enum(['novo','contatado','orcado','fechado','perdido']),
  admin_notes: z.string().trim().max(4000).default(''),
  quoted_value_cents: z.number().int().nonnegative().nullable(),
  follow_up_at: z.string().datetime().nullable(),
  payment_status: z.enum(['pendente','sinal','pago']).optional(),
  paid_cents: z.number().int().min(0).max(1000000000).optional(),
  production_status: z.enum(['nao_iniciado','arte','aguardando_aprovacao','producao','pronto','entregue']).optional(),
  production_due_at: z.string().datetime().nullable().optional(),
});


export const testimonialSchema = z.object({
  name:z.string().trim().min(2).max(100),
  location:z.string().trim().max(120),
  quote:z.string().trim().min(10).max(1200),
  rating:z.number().int().min(1).max(5),
  active:z.boolean(),
  sort_order:z.number().int().min(0).max(9999),
});

export const settingsSchema = z.object({
  brand_name: z.string().trim().min(2).max(80),
  brand_initial: z.string().trim().min(1).max(3),
  logo_url: optionalPublicUrl,
  hero_image_url: optionalPublicUrl,
  hero_eyebrow: z.string().trim().max(120),
  hero_title: z.string().trim().min(3).max(140),
  hero_highlight: z.string().trim().max(50),
  hero_description: z.string().trim().min(10).max(700),
  whatsapp_number: z.string().trim().max(30).refine(v=>!v||normalizeWhatsapp(v).length>=10,'WhatsApp inválido'),
  instagram_url: optionalExternalHttpsUrl,
  facebook_url: optionalExternalHttpsUrl,
  tiktok_url: optionalExternalHttpsUrl,
  pinterest_url: optionalExternalHttpsUrl,
  youtube_url: optionalExternalHttpsUrl,
  google_business_url: optionalExternalHttpsUrl,
  google_review_url: optionalExternalHttpsUrl,
  social_default_hashtags: z.string().trim().max(500),
  bio_title: z.string().trim().max(140),
  bio_description: z.string().trim().max(500),
  monthly_sales_goal_cents: z.number().int().min(0).max(1000000000),
  pricing_hourly_rate_cents: z.number().int().min(0).max(100000000),
  pricing_overhead_percent: z.number().int().min(0).max(100),
  pricing_waste_percent: z.number().int().min(0).max(100),
  pricing_target_margin_percent: z.number().int().min(0).max(90),
  pricing_payment_fee_percent: z.number().int().min(0).max(30),
  whatsapp_template_first_contact: z.string().trim().min(10).max(1600),
  whatsapp_template_follow_up: z.string().trim().min(10).max(1600),
  whatsapp_template_quote_ready: z.string().trim().min(10).max(1600),
  whatsapp_template_confirmation: z.string().trim().min(10).max(1600),
  whatsapp_template_review_request: z.string().trim().min(10).max(1600),
  whatsapp_template_repurchase: z.string().trim().min(10).max(1600),
  whatsapp_template_approval: z.string().trim().min(10).max(1600),
  whatsapp_template_ready: z.string().trim().min(10).max(1600),
  location: z.string().trim().max(120),
  contact_email: z.string().trim().email().max(180).or(z.literal('')),
  announcement: z.string().trim().max(180),
  announcement_link: optionalPublicUrl,
  announcement_start_at: z.string().datetime().or(z.literal('')),
  announcement_end_at: z.string().datetime().or(z.literal('')),
  about_title: z.string().trim().min(3).max(140),
  about_text: z.string().trim().min(10).max(1200),
  seo_title: z.string().trim().min(3).max(70),
  seo_description: z.string().trim().min(10).max(170),
}).superRefine((value,ctx)=>{
  if(value.announcement_start_at&&value.announcement_end_at&&new Date(value.announcement_end_at)<=new Date(value.announcement_start_at))ctx.addIssue({code:z.ZodIssueCode.custom,path:['announcement_end_at'],message:'O fim da campanha deve acontecer depois do início.'});
  const known=new Set(WHATSAPP_TEMPLATE_VARIABLES.map(item=>item.slice(1,-1)));
  const templateFields=['whatsapp_template_first_contact','whatsapp_template_follow_up','whatsapp_template_quote_ready','whatsapp_template_confirmation','whatsapp_template_review_request','whatsapp_template_repurchase','whatsapp_template_approval','whatsapp_template_ready'] as const;
  for(const field of templateFields){
    const unknown=[...String(value[field]||'').matchAll(/\{([a-z_]+)\}/gi)].map(match=>match[1].toLowerCase()).filter(key=>!known.has(key));
    if(unknown.length)ctx.addIssue({code:z.ZodIssueCode.custom,path:[field],message:`Variável desconhecida: {${unknown[0]}}`});
  }
});


export const faqSchema=z.object({question:z.string().trim().min(5).max(240),answer:z.string().trim().min(10).max(3000),active:z.boolean(),sort_order:z.number().int().min(0).max(9999)});
export const expectedUpdateSchema=z.object({expected_updated_at:z.string().datetime().optional()});

export const socialContentPlanSchema=z.object({
  title:z.string().trim().min(3).max(160),
  channel:z.enum(['instagram','whatsapp','facebook','tiktok','pinterest','youtube']),
  planned_at:z.string().datetime(),
  status:z.enum(['planejado','publicado','cancelado']).default('planejado'),
  product_id:z.string().uuid().nullable().optional().default(null),
  campaign:z.string().trim().max(100).default(''),
  notes:z.string().trim().max(1500).default(''),
});


export const marketingCampaignSchema=z.object({
  name:z.string().trim().min(3).max(140),
  slug:z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/,'Use letras minúsculas, números e hífens.'),
  channel:z.enum(['instagram','whatsapp','facebook','tiktok','pinterest','youtube','google','outro']),
  status:z.enum(['planejada','ativa','encerrada']).default('planejada'),
  starts_at:z.string().datetime().nullable().optional().default(null),
  ends_at:z.string().datetime().nullable().optional().default(null),
  goal_leads:z.number().int().min(0).max(100000).default(0),
  goal_revenue_cents:z.number().int().min(0).max(100000000000).default(0),
  spend_cents:z.number().int().min(0).max(100000000000).default(0),
  notes:z.string().trim().max(2000).default(''),
}).superRefine((value,ctx)=>{if(value.starts_at&&value.ends_at&&new Date(value.ends_at)<=new Date(value.starts_at))ctx.addIssue({code:z.ZodIssueCode.custom,path:['ends_at'],message:'O fim precisa ser posterior ao início.'});});