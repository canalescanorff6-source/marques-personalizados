import Link from 'next/link';
import { Mail, MapPin } from 'lucide-react';
import type { SiteSettings } from '@/lib/db';
import SocialLinks from './SocialLinks';
export default function Footer({settings}:{settings:SiteSettings}){
  return <footer className="footer premium-footer"><div className="container premium-footer-top"><div className="footer-brand-block"><span className="footer-monogram"><b>{settings.brand_initial||'M'}</b></span><div><strong>{settings.brand_name}</strong><p>Papelaria personalizada premium criada sob encomenda.</p><SocialLinks settings={settings} className="footer-social-links"/></div></div><div className="footer-contact-grid"><div><small>LOCAL</small><span><MapPin size={14}/>{settings.location}</span></div>{settings.contact_email&&<div><small>E-MAIL</small><a href={`mailto:${settings.contact_email}`}><Mail size={14}/>{settings.contact_email}</a></div>}<div><small>ACESSO RÁPIDO</small><Link href="/links">Links & redes</Link></div></div></div><div className="container footer-grid"><div><span>© {new Date().getFullYear()} {settings.brand_name}. Todos os direitos reservados.</span></div><div className="footer-links"><Link href="/privacidade">Privacidade</Link><Link href="/termos">Termos</Link><Link href="/#inicio">Voltar ao topo ↑</Link></div></div></footer>;
}
