'use client';

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CheckCircle2, Copy, Minus, Plus, Send, Share2, ShoppingBag, Trash2, X } from 'lucide-react';
import type { InquiryEventBrief, Product } from '@/lib/db';
import { fetchJson } from '@/lib/client';
import { getAttribution } from '@/lib/attribution-client';
import SafeImage from './SafeImage';
import { useDialogA11y } from './useDialogA11y';
import { trackSessionEvent } from './SiteAnalytics';

export type QuoteListItem = {
  product_id: string;
  slug: string;
  name: string;
  category: string;
  image_url: string;
  quantity: number;
  min_quantity: number;
  price_cents: number | null;
  customizations: Record<string,string>;
  customization_labels: Record<string,string>;
};

export type QuoteBrief = InquiryEventBrief & { event_date?: string };

type QuoteContextValue = {
  items: QuoteListItem[];
  count: number;
  open: boolean;
  brief: QuoteBrief;
  setOpen: (value:boolean)=>void;
  setBrief: (value:QuoteBrief)=>void;
  addProduct: (product:Product,customizations?:Record<string,string>)=>void;
  addProducts: (products:Product[])=>void;
  removeProduct: (id:string)=>void;
  setQuantity: (id:string,quantity:number)=>void;
  clear: ()=>void;
  includes: (id:string)=>boolean;
  shareList: ()=>Promise<'shared'|'copied'|'empty'>;
};

const QuoteContext=createContext<QuoteContextValue|null>(null);
const STORAGE_KEY='marques-lista-orcamento-v3';
const BRIEF_KEY='marques-brief-evento-v1';
function clampQuantity(value:number,min:number){return Math.min(99999,Math.max(min,Math.floor(Number.isFinite(value)?value:min)));}
function todayLocal(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function makeRequestId(){if(globalThis.crypto?.randomUUID)return globalThis.crypto.randomUUID();const b=new Uint8Array(16);globalThis.crypto.getRandomValues(b);b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=[...b].map(x=>x.toString(16).padStart(2,'0')).join('');return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;}
async function copyText(value:string){if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;}const area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();const ok=document.execCommand('copy');area.remove();if(!ok)throw new Error('COPY_FAILED');}

export function QuoteListProvider({children}:{children:React.ReactNode}){
  const [items,setItems]=useState<QuoteListItem[]>([]);
  const [brief,setBriefState]=useState<QuoteBrief>({source:'site'});
  const [open,setOpen]=useState(false);
  const [hydrated,setHydrated]=useState(false);

  useEffect(()=>{
    try{
      const raw=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      if(Array.isArray(raw))setItems(raw.filter((item):item is QuoteListItem=>Boolean(item&&typeof item.product_id==='string'&&typeof item.slug==='string'&&typeof item.name==='string')).slice(0,30).map(item=>({
        ...item,min_quantity:Math.max(1,Number(item.min_quantity)||1),price_cents:typeof item.price_cents==='number'?item.price_cents:null,quantity:clampQuantity(Number(item.quantity)||1,Math.max(1,Number(item.min_quantity)||1)),customizations:item.customizations&&typeof item.customizations==='object'?item.customizations:{},customization_labels:item.customization_labels&&typeof item.customization_labels==='object'?item.customization_labels:{}
      })));
      const briefRaw=JSON.parse(localStorage.getItem(BRIEF_KEY)||'{}');
      if(briefRaw&&typeof briefRaw==='object')setBriefState({...briefRaw,source:briefRaw.source||'site'});
    }catch{}
    setHydrated(true);
  },[]);

  useEffect(()=>{if(!hydrated)return;try{localStorage.setItem(STORAGE_KEY,JSON.stringify(items));localStorage.setItem(BRIEF_KEY,JSON.stringify(brief));}catch{}},[items,brief,hydrated]);
  useEffect(()=>{
    if(!hydrated)return;
    const url=new URL(window.location.href);const encoded=url.searchParams.get('lista');if(!encoded)return;
    let active=true;
    void fetchJson<{items:QuoteListItem[]}>(`/api/quote-list?items=${encodeURIComponent(encoded)}`,{},8000).then(data=>{
      if(!active)return;if(Array.isArray(data.items)&&data.items.length){setItems(data.items.slice(0,30).map(item=>({...item,customizations:{},customization_labels:item.customization_labels||{}})));setBriefState({source:'shared_list'});setOpen(true);}
    }).catch(()=>{}).finally(()=>{if(!active)return;url.searchParams.delete('lista');window.history.replaceState({},'',`${url.pathname}${url.search}${url.hash}`);});
    return()=>{active=false};
  },[hydrated]);

  useEffect(()=>{
    if(!hydrated||!items.length)return;
    const snapshot=items.map(item=>`${item.slug}:${item.quantity}`).join(',');let active=true;
    void fetchJson<{items:QuoteListItem[]}>(`/api/quote-list?items=${encodeURIComponent(snapshot)}`,{},8000).then(data=>{if(active&&Array.isArray(data.items))setItems(current=>{const customById=new Map(current.map(item=>[item.product_id,item.customizations||{}]));const labelsById=new Map(current.map(item=>[item.product_id,item.customization_labels||{}]));const next=data.items.slice(0,30).map(item=>({...item,customizations:customById.get(item.product_id)||{},customization_labels:item.customization_labels||labelsById.get(item.product_id)||{}}));return JSON.stringify(current)===JSON.stringify(next)?current:next;});}).catch(()=>{});
    return()=>{active=false};
  },[hydrated]);

  function normalize(product:Product,customizations:Record<string,string>={}):QuoteListItem{const min=Math.max(1,product.min_quantity||1);return{product_id:product.id,slug:product.slug,name:product.name,category:product.category,image_url:product.image_urls[0]||'/placeholder-topo.svg',quantity:min,min_quantity:min,price_cents:product.price_cents,customizations,customization_labels:Object.fromEntries((product.customization_fields||[]).map(field=>[field.id,field.label]))};}
  function addProduct(product:Product,customizations:Record<string,string>={}){setItems(current=>{const found=current.find(item=>item.product_id===product.id);if(found)return current.map(item=>item.product_id===product.id?{...item,customizations:Object.keys(customizations).length?customizations:item.customizations}:item);return[...current,normalize(product,customizations)].slice(-30);});setOpen(true);}
  function addProducts(products:Product[]){setItems(current=>{const ids=new Set(current.map(i=>i.product_id));const added=products.filter(p=>!ids.has(p.id)).map(product=>normalize(product));return [...current,...added].slice(-30);});setOpen(true);}
  function removeProduct(id:string){setItems(current=>current.filter(item=>item.product_id!==id));}
  function setQuantity(id:string,quantity:number){setItems(current=>current.map(item=>item.product_id===id?{...item,quantity:clampQuantity(quantity,item.min_quantity)}:item));}
  function setBrief(value:QuoteBrief){setBriefState(current=>({...current,...value}));}
  function clear(){setItems([]);}
  async function shareList(){
    if(!items.length)return 'empty';
    const compact=items.map(item=>`${item.slug}:${item.quantity}`).join(',');
    const url=new URL(window.location.origin+window.location.pathname);url.searchParams.set('lista',compact);
    const shareData={title:'Minha seleção de papelaria',text:'Veja os produtos que selecionei para orçamento:',url:url.toString()};
    if(navigator.share){try{await navigator.share(shareData);return 'shared';}catch(error){if(error instanceof DOMException&&error.name==='AbortError')return 'shared';}}
    await copyText(url.toString());return 'copied';
  }
  const value=useMemo<QuoteContextValue>(()=>({items,count:items.length,open,brief,setOpen,setBrief,addProduct,addProducts,removeProduct,setQuantity,clear,includes:(id)=>items.some(item=>item.product_id===id),shareList}),[items,open,brief]);
  return <QuoteContext.Provider value={value}>{children}<QuoteDrawer/></QuoteContext.Provider>;
}

export function useQuoteList(){const context=useContext(QuoteContext);if(!context)throw new Error('useQuoteList deve ser usado dentro de QuoteListProvider');return context;}
export function QuoteListTrigger({compact=false}:{compact?:boolean}){const {count,setOpen}=useQuoteList();return <button type="button" className={`quote-list-trigger ${compact?'compact':''}`} onClick={()=>setOpen(true)} aria-label={`Abrir lista de orçamento com ${count} ${count===1?'item':'itens'}`}><ShoppingBag size={17}/><span className="quote-trigger-label">Minha lista</span>{count>0&&<b>{count}</b>}</button>;}

const occasions=['Aniversário infantil','Aniversário adulto','Chá / Revelação','Batizado','Casamento','Evento corporativo','Outro'];
const budgets=['Até R$ 150','R$ 150–300','R$ 300–500','R$ 500–800','Acima de R$ 800','Quero orientação'];
function QuoteDrawer(){
  const {items,open,setOpen,removeProduct,setQuantity,clear,brief,setBrief,shareList}=useQuoteList();
  const uid=useId().replace(/:/g,'');const fid=(name:string)=>`${uid}-${name}`;
  const drawerRef=useRef<HTMLElement>(null),requestIdRef=useRef(makeRequestId()),errorRef=useRef<HTMLDivElement>(null);useDialogA11y(open,drawerRef,()=>setOpen(false));
  const [form,setForm]=useState({name:'',whatsapp:'',email:'',event_date:'',message:'',website:''});
  const knownTotal=items.reduce((sum,item)=>sum+(typeof item.price_cents==='number'?item.price_cents*item.quantity:0),0);const pricedCount=items.filter(item=>typeof item.price_cents==='number').length;const estimateLabel=pricedCount===items.length?'Estimativa mínima da seleção':'Subtotal conhecido';const estimateValue=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(knownTotal/100);
  const [loading,setLoading]=useState(false);const [error,setError]=useState('');const [done,setDone]=useState(false);const [persisted,setPersisted]=useState(true);const [whatsappOpened,setWhatsappOpened]=useState(false);const [shareStatus,setShareStatus]=useState('');
  useEffect(()=>{if(open){setError('');setDone(false);setPersisted(true);setShareStatus('');if(brief.event_date)setForm(current=>({...current,event_date:current.event_date||brief.event_date||''}));}},[open,brief.event_date]);
  useEffect(()=>{if(open&&items.length)trackSessionEvent('quote_start','/orcamento','marques:quote-start');},[open,items.length]);useEffect(()=>{if(error)requestAnimationFrame(()=>errorRef.current?.focus());},[error]);
  function set<K extends keyof typeof form>(key:K,value:string){setForm(current=>({...current,[key]:value}));}
  async function handleShare(){try{const result=await shareList();if(result==='copied'){setShareStatus('Link copiado');setTimeout(()=>setShareStatus(''),2200);}}catch{setShareStatus('Não foi possível compartilhar');}}
  async function submit(e:React.FormEvent){
    e.preventDefault();if(!items.length||loading)return;setLoading(true);setError('');
    try{const data=await fetchJson<{ok:boolean;id?:string;persisted?:boolean;contingency?:boolean;whatsapp_url?:string}>('/api/inquiries',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...form,request_id:requestIdRef.current,items:items.map((item:QuoteListItem)=>({product_id:item.product_id,quantity:item.quantity,customizations:item.customizations})),category:'',product_id:'',product_name:'',brief:{...brief,attribution:getAttribution()}})},18000);const wasPersisted=data.persisted!==false;setDone(true);setPersisted(wasPersisted);setWhatsappOpened(Boolean(data.whatsapp_url));if(wasPersisted){requestIdRef.current=makeRequestId();clear();setBrief({occasion:'',theme:'',celebrant_name:'',celebrant_age:'',guest_count:null,budget_range:'',desired_categories:[],source:'site',event_date:''});}if(data.whatsapp_url)window.location.assign(data.whatsapp_url);}catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar sua lista.');}finally{setLoading(false);}
  }
  if(!open)return null;
  return <div className="quote-drawer-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setOpen(false)}}><aside ref={drawerRef} className="quote-drawer" role="dialog" aria-modal="true" aria-label="Lista de orçamento" tabIndex={-1}>
    <header className="quote-drawer-head"><div><span>SELEÇÃO / ORÇAMENTO</span><h2>Minha lista</h2><p>{items.length?`${items.length} ${items.length===1?'peça selecionada':'peças selecionadas'}`:'Sua seleção está vazia'}</p></div><div className="quote-head-actions">{items.length>0&&<button type="button" className="icon-btn" onClick={handleShare} aria-label="Compartilhar lista" title="Compartilhar lista"><Share2 size={18}/></button>}<button type="button" className="icon-btn" onClick={()=>setOpen(false)} aria-label="Fechar lista"><X size={19}/></button></div></header>
    {items.length>0&&pricedCount>0&&<div className="quote-estimate"><div><span>{estimateLabel}</span><strong>{estimateValue}</strong></div><small>{pricedCount<items.length?`${items.length-pricedCount} item(ns) continuam sob consulta. `:''}Valor indicativo a partir dos preços cadastrados; personalização, acabamento e condições do pedido podem alterar o orçamento final.</small></div>}{shareStatus&&<div className="quote-share-status" role="status"><Copy size={14}/>{shareStatus}</div>}{items.some(item=>Object.keys(item.customizations||{}).length>0)&&<div className="quote-share-note">O link compartilhado leva produtos e quantidades. Dados de personalização ficam somente neste aparelho por privacidade.</div>}
    {done?<div className="quote-drawer-success"><CheckCircle2 size={34}/><h3>{persisted?'Pedido registrado.':'Atendimento em contingência.'}</h3><p>{persisted?(whatsappOpened?'Sua seleção foi salva e o WhatsApp será aberto para continuar o atendimento.':'Sua seleção foi salva. O atendimento poderá continuar pelos dados informados.'):'O banco está temporariamente indisponível. Sua lista e personalizações continuam salvas neste aparelho; o WhatsApp será aberto para você não perder o atendimento.'}</p><button type="button" className="btn" onClick={()=>setOpen(false)}>Fechar</button></div>:items.length?<><div className="quote-drawer-items">{items.map((item,index)=><article className="quote-line" key={item.product_id}><div className="quote-line-index">{String(index+1).padStart(2,'0')}</div><SafeImage src={item.image_url} alt="" loading="lazy" decoding="async"/><div className="quote-line-copy"><small>{item.category}</small><strong>{item.name}</strong>{Object.keys(item.customizations||{}).length>0&&<div className="quote-customizations">{Object.entries(item.customizations).map(([key,value])=><span key={key}><b>{item.customization_labels?.[key]||key}</b>: {value}</span>)}</div>}<div className="quote-qty" aria-label={`Quantidade de ${item.name}`}><button type="button" onClick={()=>setQuantity(item.product_id,item.quantity-1)} disabled={item.quantity<=item.min_quantity} aria-label="Diminuir quantidade"><Minus size={14}/></button><input inputMode="numeric" value={item.quantity} onChange={e=>setQuantity(item.product_id,Number(e.target.value)||item.min_quantity)} aria-label="Quantidade"/><button type="button" onClick={()=>setQuantity(item.product_id,item.quantity+1)} aria-label="Aumentar quantidade"><Plus size={14}/></button><span>un.</span></div>{item.min_quantity>1&&<em>mín. {item.min_quantity}</em>}</div><button type="button" className="quote-remove" onClick={()=>removeProduct(item.product_id)} aria-label={`Remover ${item.name}`}><Trash2 size={16}/></button></article>)}</div><form className="quote-drawer-form" onSubmit={submit}><div className="drawer-form-title"><span>FINALIZAR SELEÇÃO</span><strong>Conte o essencial do evento.</strong></div>
      <div className="quote-brief-grid"><div className="field"><label htmlFor={fid('occasion')}>Ocasião</label><select id={fid('occasion')} value={brief.occasion||''} onChange={e=>setBrief({occasion:e.target.value})}><option value="">Selecione</option>{occasions.map(x=><option key={x}>{x}</option>)}</select></div><div className="field"><label htmlFor={fid('theme')}>Tema</label><input id={fid('theme')} maxLength={120} placeholder="Ex.: Harry Potter" value={brief.theme||''} onChange={e=>setBrief({theme:e.target.value})}/></div><div className="field"><label htmlFor={fid('celebrant')}>Nome / homenageado</label><input id={fid('celebrant')} maxLength={120} value={brief.celebrant_name||''} onChange={e=>setBrief({celebrant_name:e.target.value})}/></div><div className="field"><label htmlFor={fid('age')}>Idade</label><input id={fid('age')} maxLength={40} placeholder="Ex.: 29 anos" value={brief.celebrant_age||''} onChange={e=>setBrief({celebrant_age:e.target.value})}/></div><div className="field"><label htmlFor={fid('guests')}>Convidados</label><input id={fid('guests')} type="number" min="1" max="10000" placeholder="Ex.: 40" value={brief.guest_count||''} onChange={e=>setBrief({guest_count:e.target.value?Math.max(1,Number(e.target.value)):null})}/></div><div className="field"><label htmlFor={fid('budget')}>Faixa de investimento</label><select id={fid('budget')} value={brief.budget_range||''} onChange={e=>setBrief({budget_range:e.target.value})}><option value="">Não definido</option>{budgets.map(x=><option key={x}>{x}</option>)}</select></div></div>
      <div className="row-2"><div className="field"><label htmlFor={fid('name')}>Seu nome</label><input id={fid('name')} autoComplete="name" minLength={2} maxLength={120} value={form.name} onChange={e=>set('name',e.target.value)} required/></div><div className="field"><label htmlFor={fid('whatsapp')}>WhatsApp</label><input id={fid('whatsapp')} autoComplete="tel" inputMode="tel" minLength={8} maxLength={30} placeholder="(98) 99999-9999" value={form.whatsapp} onChange={e=>set('whatsapp',e.target.value)} required/></div></div><div className="row-2"><div className="field"><label htmlFor={fid('email')}>E-mail (opcional)</label><input id={fid('email')} type="email" autoComplete="email" maxLength={180} value={form.email} onChange={e=>set('email',e.target.value)}/></div><div className="field"><label htmlFor={fid('date')}>Data do evento</label><input id={fid('date')} type="date" min={todayLocal()} value={form.event_date} onChange={e=>set('event_date',e.target.value)}/></div></div><div className="field"><label htmlFor={fid('message')}>Observações (opcional)</label><textarea id={fid('message')} maxLength={2000} placeholder="Cores, acabamento, referências ou algum detalhe importante..." value={form.message} onChange={e=>set('message',e.target.value)}/></div><input className="hp-field" tabIndex={-1} autoComplete="off" aria-hidden="true" value={form.website} onChange={e=>set('website',e.target.value)}/>{error&&<div ref={errorRef} id={fid('error')} className="error" role="alert" tabIndex={-1}>{error}</div>}<button type="submit" className="btn btn-primary quote-submit" disabled={loading} aria-busy={loading}><Send size={16}/>{loading?'Registrando...':'Enviar lista para orçamento'}</button><div className="quote-secondary-actions"><button type="button" className="quote-share-link" onClick={handleShare}><Share2 size={14}/> Compartilhar seleção</button><button type="button" className="quote-clear" onClick={clear}>Limpar seleção</button></div></form></>:<div className="quote-drawer-empty"><ShoppingBag size={32}/><h3>Monte seu pedido.</h3><p>Adicione topos, caixas, lembrancinhas e outras peças. Você poderá informar a quantidade de cada item antes de solicitar o orçamento.</p><button type="button" className="btn btn-primary" onClick={()=>{setOpen(false);location.href='/#catalogo'}}>Explorar catálogo</button></div>}
  </aside></div>;
}
