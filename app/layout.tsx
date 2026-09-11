import type { Metadata, Viewport } from 'next';
import './globals.css';
import './premium.css';
import PremiumExperience from '@/components/PremiumExperience';
import { QuoteListProvider } from '@/components/QuoteListProvider';
import { CompareProvider } from '@/components/CompareProvider';
import WebVitalsReporter from '@/components/WebVitalsReporter';
import SiteAnalytics from '@/components/SiteAnalytics';
import NetworkStatus from '@/components/NetworkStatus';
import AttributionCapture from '@/components/AttributionCapture';
import { getSiteSettings } from '@/lib/db';
import { siteUrl } from '@/lib/config';
export const viewport:Viewport={width:'device-width',initialScale:1,themeColor:'#0b0d0f'};
export async function generateMetadata():Promise<Metadata>{const s=await getSiteSettings();return{metadataBase:siteUrl?new URL(siteUrl):undefined,title:{default:s.seo_title,template:`%s | ${s.brand_name}`},description:s.seo_description,applicationName:s.brand_name,robots:{index:true,follow:true},openGraph:{type:'website',locale:'pt_BR',siteName:s.brand_name,title:s.seo_title,description:s.seo_description,url:siteUrl||undefined,images:s.hero_image_url?[s.hero_image_url]:undefined},twitter:{card:'summary_large_image',title:s.seo_title,description:s.seo_description},icons:{icon:'/favicon.svg'}};}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="pt-BR"><body><QuoteListProvider><CompareProvider><PremiumExperience/><WebVitalsReporter/><SiteAnalytics/><AttributionCapture/><NetworkStatus/><a className="skip-link" href="#conteudo">Pular para o conteúdo</a><div id="conteudo">{children}</div></CompareProvider></QuoteListProvider></body></html>;}
