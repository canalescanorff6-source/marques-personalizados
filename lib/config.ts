import { DEFAULT_WHATSAPP_TEMPLATES } from './whatsapp-templates';
import { normalizeExternalHttpsUrl,normalizeSiteOrigin } from './public-url';
export const fallbackSiteSettings = {
  brand_name: process.env.NEXT_PUBLIC_SITE_NAME || 'Marques Papelaria',
  brand_initial: 'M',
  logo_url: '',
  hero_image_url: '',
  hero_eyebrow: 'Papelaria personalizada • Feita sob encomenda',
  hero_title: 'Detalhes que marcam a festa.',
  hero_highlight: 'marcam',
  hero_description: 'Topos de bolo, caixas, lembrancinhas, flores e kits personalizados com acabamento profissional, composição premium e produção pensada para transformar cada tema em algo realmente único.',
  whatsapp_number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '',
  instagram_url: normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL),
  facebook_url: normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_FACEBOOK_URL),
  tiktok_url: normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_TIKTOK_URL),
  pinterest_url: normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_PINTEREST_URL),
  youtube_url: normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_YOUTUBE_URL),
  google_business_url: normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_GOOGLE_BUSINESS_URL),
  google_review_url: normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL),
  social_default_hashtags: '#papelariapersonalizada #festapersonalizada',
  bio_title: 'Papelaria personalizada para momentos únicos.',
  bio_description: 'Veja o catálogo, conheça as coleções e peça seu orçamento pelo WhatsApp.',
  monthly_sales_goal_cents: 0,
  pricing_hourly_rate_cents: 2000,
  pricing_overhead_percent: 10,
  pricing_waste_percent: 10,
  pricing_target_margin_percent: 45,
  pricing_payment_fee_percent: 0,
  ...DEFAULT_WHATSAPP_TEMPLATES,
  location: process.env.NEXT_PUBLIC_LOCATION || 'Santa Inês - MA',
  contact_email: process.env.NEXT_PUBLIC_CONTACT_EMAIL || '',
  announcement: '',
  announcement_link: '',
  announcement_start_at: '',
  announcement_end_at: '',
  about_title: 'Papelaria feita para impressionar de perto.',
  about_text: 'Cada peça é pensada para o tema, para a montagem e para a experiência final da festa, com atenção à composição, corte e acabamento.',
  seo_title: `${process.env.NEXT_PUBLIC_SITE_NAME || 'Marques Papelaria'} | Papelaria Personalizada Premium`,
  seo_description: 'Catálogo de topos de bolo, caixinhas milk, lembrancinhas, flores e papelaria personalizada premium.'
};

export const fallbackCategories = [
  'Topos de bolo',
  'Caixinhas Milk',
  'Lembrancinhas',
  'Flores',
  'Kits personalizados',
  'Outros'
] as const;

export const siteUrl = normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL);
