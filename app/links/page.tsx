import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, MessageCircle, Sparkles } from 'lucide-react';
import { getCategories, getHomeCuratedProducts, getSiteSettings } from '@/lib/db';
import { normalizeWhatsapp } from '@/lib/links';
import SafeImage from '@/components/SafeImage';
import SocialLinks from '@/components/SocialLinks';
import { siteUrl } from '@/lib/config';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Links & catálogo',description:'Catálogo, redes sociais e orçamento.',robots:{index:false,follow:true}};
function money(cents:number|null){return cents==null?'Sob consulta':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);}
export default async function LinksPage(){
  const [settings,products,categories]=await Promise.all([getSiteSettings(),getHomeCuratedProducts(6),getCategories()]);
  const phone=normalizeWhatsapp(settings.whatsapp_number);const wa=phone?`https://wa.me/${phone}?text=${encodeURIComponent(`Olá! Vim pelo link da ${settings.brand_name} e gostaria de um orçamento.`)}`:'';
  const now=Date.now();const start=settings.announcement_start_at?new Date(settings.announcement_start_at).getTime():null;const end=settings.announcement_end_at?new Date(settings.announcement_end_at).getTime():null;const campaign=Boolean(settings.announcement&&(!start||start<=now)&&(!end||end>now));
  return <main className="bio-page"><section className="bio-shell"><div className="bio-brand">{settings.logo_url?<SafeImage src={settings.logo_url} alt={settings.brand_name}/>:<span className="bio-monogram">{settings.brand_initial||'M'}</span>}<div className="eyebrow">PAPELARIA PERSONALIZADA</div><h1>{settings.bio_title||settings.brand_name}</h1><p>{settings.bio_description||settings.hero_description}</p><SocialLinks settings={settings} showLabels/></div>
    {campaign&&<a className="bio-campaign" href={settings.announcement_link||'/catalogo'}><Sparkles size={17}/><span><small>AGORA</small><strong>{settings.announcement}</strong></span><ArrowUpRight size={17}/></a>}
    <div className="bio-actions">{wa&&<a className="btn btn-primary" href={wa} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Pedir orçamento</a>}<Link className="btn" href="/catalogo">Ver catálogo completo <ArrowUpRight size={16}/></Link></div>
    {products.length>0&&<section className="bio-products"><div className="bio-section-title"><small>CURADORIA</small><h2>Peças em destaque</h2></div><div className="bio-product-grid">{products.slice(0,4).map(p=><Link key={p.id} href={`/catalogo/${p.slug}`} className="bio-product"><div>{p.image_urls[0]?<SafeImage src={p.image_urls[0]} alt={p.name}/>:<span/>}{p.badge&&<em>{p.badge}</em>}</div><strong>{p.name}</strong><small>{money(p.price_cents)}</small></Link>)}</div></section>}
    {categories.length>0&&<section className="bio-collections"><div className="bio-section-title"><small>COLEÇÕES</small><h2>Explore por tipo</h2></div><div>{categories.slice(0,8).map(c=><Link key={c.id} href={`/categorias/${c.slug}`}>{c.name}<ArrowUpRight size={14}/></Link>)}</div></section>}
    <footer className="bio-footer"><span>{settings.brand_name}</span><small>{settings.location}</small>{siteUrl&&<a href={siteUrl}>Site oficial</a>}</footer>
  </section></main>;
}
