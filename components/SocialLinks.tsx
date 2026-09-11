import { ExternalLink, Facebook, Instagram, MapPinned, Music2, Pin, Youtube } from 'lucide-react';
import type { SiteSettings } from '@/lib/db';

type Props={settings:SiteSettings;compact?:boolean;className?:string;showLabels?:boolean};
const clean=(v?:string)=>String(v||'').trim();
export default function SocialLinks({settings,compact=false,className='',showLabels=!compact}:Props){
  const links=[
    {key:'instagram',label:'Instagram',url:clean(settings.instagram_url),icon:<Instagram size={compact?16:18}/>},
    {key:'facebook',label:'Facebook',url:clean(settings.facebook_url),icon:<Facebook size={compact?16:18}/>},
    {key:'tiktok',label:'TikTok',url:clean(settings.tiktok_url),icon:<Music2 size={compact?16:18}/>},
    {key:'pinterest',label:'Pinterest',url:clean(settings.pinterest_url),icon:<Pin size={compact?16:18}/>},
    {key:'youtube',label:'YouTube',url:clean(settings.youtube_url),icon:<Youtube size={compact?16:18}/>},
    {key:'google',label:'Google',url:clean(settings.google_business_url),icon:<MapPinned size={compact?16:18}/>},
  ].filter(x=>/^https?:\/\//i.test(x.url));
  if(!links.length)return null;
  return <div className={`social-links ${compact?'is-compact':''} ${className}`.trim()} aria-label="Redes sociais">{links.map(link=><a key={link.key} href={link.url} target="_blank" rel="noreferrer" aria-label={link.label}>{link.icon}{showLabels&&<span>{link.label}</span>}{!compact&&<ExternalLink size={12}/>}</a>)}</div>;
}
