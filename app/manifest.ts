import type { MetadataRoute } from 'next';
import { getSiteSettings } from '@/lib/db';

export default async function manifest():Promise<MetadataRoute.Manifest>{
  const settings=await getSiteSettings();
  return {
    name:settings.brand_name,
    short_name:settings.brand_name.slice(0,24),
    description:settings.seo_description,
    start_url:'/',
    display:'standalone',
    background_color:'#0b0d0f',
    theme_color:'#0b0d0f',
    lang:'pt-BR',
    icons:[{src:'/favicon.svg',sizes:'any',type:'image/svg+xml'}]
  };
}
