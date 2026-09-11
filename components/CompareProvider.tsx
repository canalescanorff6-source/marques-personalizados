'use client';

import Link from 'next/link';
import { createContext,useContext,useEffect,useMemo,useRef,useState } from 'react';
import { ArrowUpRight,Check,LoaderCircle,Scale,ShoppingBag,Trash2,X } from 'lucide-react';
import type { Product } from '@/lib/db';
import { fetchJson } from '@/lib/client';
import SafeImage from './SafeImage';
import { useDialogA11y } from './useDialogA11y';
import { useQuoteList } from './QuoteListProvider';

type CompareContextValue={
  ids:string[];
  count:number;
  open:boolean;
  setOpen:(open:boolean)=>void;
  includes:(id:string)=>boolean;
  toggle:(product:Product)=>void;
  clear:()=>void;
};
const CompareContext=createContext<CompareContextValue|null>(null);
const STORAGE='marques.compare.v1';
function readIds(){try{const raw=JSON.parse(localStorage.getItem(STORAGE)||'[]');return Array.isArray(raw)?raw.filter(v=>typeof v==='string').slice(0,3):[];}catch{return [];}}
function price(v:number|null){return v===null?'Sob consulta':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);}
function status(v:Product['stock_status']){return v==='disponivel'?'Disponível':v==='indisponivel'?'Indisponível':'Sob encomenda';}

export function CompareProvider({children}:{children:React.ReactNode}){
  const [ids,setIds]=useState<string[]>([]),[open,setOpen]=useState(false),[notice,setNotice]=useState('');
  useEffect(()=>{setIds(readIds());},[]);
  useEffect(()=>{try{localStorage.setItem(STORAGE,JSON.stringify(ids));}catch{}},[ids]);
  function toggle(product:Product){setIds(current=>{if(current.includes(product.id))return current.filter(id=>id!==product.id);if(current.length>=3){setNotice('Você pode comparar até 3 peças por vez.');setTimeout(()=>setNotice(''),2200);return current;}return [...current,product.id];});}
  function clear(){setIds([]);}
  const value=useMemo(()=>({ids,count:ids.length,open,setOpen,includes:(id:string)=>ids.includes(id),toggle,clear}),[ids,open]);
  return <CompareContext.Provider value={value}>{children}{notice&&<div className="compare-toast" role="status">{notice}</div>}<CompareTray/><CompareDialog/></CompareContext.Provider>;
}

export function useCompare(){const ctx=useContext(CompareContext);if(!ctx)throw new Error('useCompare deve ser usado dentro de CompareProvider');return ctx;}

export function CompareButton({product,className='',label=true}:{product:Product;className?:string;label?:boolean}){
  const compare=useCompare();const active=compare.includes(product.id);
  return <button type="button" className={`${className} compare-button ${active?'active':''}`} onClick={()=>compare.toggle(product)} aria-pressed={active} aria-label={active?`Remover ${product.name} da comparação`:`Comparar ${product.name}`}><Scale size={16}/>{label&&<span>{active?'Comparando':'Comparar'}</span>}</button>;
}

function CompareTray(){const compare=useCompare();if(!compare.count||compare.open)return null;return <div className="compare-tray" role="region" aria-label="Produtos para comparar"><div><Scale size={17}/><span><strong>{compare.count}</strong> {compare.count===1?'peça selecionada':'peças selecionadas'}</span></div><div><button type="button" className="compare-clear" onClick={compare.clear}>Limpar</button><button type="button" className="btn btn-primary" onClick={()=>compare.setOpen(true)} disabled={compare.count<2}>Comparar {compare.count<2?'(selecione 2)':''}</button></div></div>;}

type PageResult={items:Product[]};
function CompareDialog(){
  const compare=useCompare();const quote=useQuoteList();const [products,setProducts]=useState<Product[]>([]),[loading,setLoading]=useState(false),[error,setError]=useState('');const ref=useRef<HTMLDivElement>(null);useDialogA11y(compare.open,ref,()=>compare.setOpen(false));
  useEffect(()=>{if(!compare.open)return;let cancelled=false;async function load(){setLoading(true);setError('');try{const u=new URL('/api/catalog',location.origin);u.searchParams.set('ids',compare.ids.join(','));u.searchParams.set('limit','3');const data=await fetchJson<PageResult>(u.toString());if(cancelled)return;setProducts(data.items);const valid=new Set(data.items.map(p=>p.id));if(compare.ids.some(id=>!valid.has(id))){for(const id of compare.ids)if(!valid.has(id)){const ghost={id} as Product;compare.toggle(ghost);}}}catch(e){if(!cancelled)setError(e instanceof Error?e.message:'Não foi possível atualizar a comparação.');}finally{if(!cancelled)setLoading(false);}}load();return()=>{cancelled=true};},[compare.open,compare.ids.join(',')]);
  if(!compare.open)return null;
  function addAll(){for(const product of products){if(product.stock_status!=='indisponivel'&&!product.customization_fields.some(field=>field.required))quote.addProduct(product);}quote.setOpen(true);compare.setOpen(false);}
  return <div className="modal-backdrop compare-backdrop" onMouseDown={e=>e.currentTarget===e.target&&compare.setOpen(false)}><div ref={ref} className="compare-dialog" role="dialog" aria-modal="true" aria-label="Comparar produtos" tabIndex={-1}><header><div><span>COMPARADOR</span><h2>Compare antes de escolher.</h2><p>Veja lado a lado o que muda entre as peças e monte uma seleção mais segura.</p></div><button type="button" className="icon-btn" onClick={()=>compare.setOpen(false)} aria-label="Fechar comparação"><X size={18}/></button></header>{loading?<div className="compare-loading"><LoaderCircle className="spin" size={22}/> Atualizando informações…</div>:error?<div className="catalog-error" role="alert"><span>{error}</span><button type="button" className="btn" onClick={()=>{compare.setOpen(false);setTimeout(()=>compare.setOpen(true),0)}}>Tentar novamente</button></div>:<><div className="compare-grid">{products.map(product=><article key={product.id} className="compare-card"><div className="compare-image"><SafeImage src={product.image_urls[0]} alt={product.name} loading="lazy" decoding="async"/>{product.badge&&<span>{product.badge}</span>}</div><div className="compare-card-head"><small>{product.category}</small><h3>{product.name}</h3><strong>{price(product.price_cents)}</strong></div><dl><div><dt>Status</dt><dd>{status(product.stock_status)}</dd></div><div><dt>Pedido mínimo</dt><dd>{Math.max(1,product.min_quantity||1)} un.</dd></div><div><dt>Prazo</dt><dd>{product.production_time||'Sob consulta'}</dd></div><div><dt>Personalização</dt><dd>{product.customization_fields.length?`${product.customization_fields.length} campo(s)`:'Padrão do modelo'}</dd></div><div><dt>Destaque</dt><dd>{product.featured?'Curadoria do ateliê':'Catálogo'}</dd></div></dl><div className="compare-card-actions"><CompareButton product={product} className="btn"/><Link href={`/catalogo/${product.slug}`} className="btn">Ver peça <ArrowUpRight size={15}/></Link>{product.stock_status!=='indisponivel'&&!product.customization_fields.some(field=>field.required)&&<button type="button" className="btn btn-primary" onClick={()=>quote.addProduct(product)}>{quote.includes(product.id)?<Check size={15}/>:<ShoppingBag size={15}/>} {quote.includes(product.id)?'Na lista':'Adicionar'}</button>}{product.stock_status!=='indisponivel'&&product.customization_fields.some(field=>field.required)&&<Link href={`/catalogo/${product.slug}#personalizacao-produto`} className="btn btn-primary">Personalizar primeiro</Link>}</div></article>)}</div>{products.some(p=>p.customization_fields.some(f=>f.required))&&<p className="compare-note">Peças com personalização obrigatória precisam ser configuradas individualmente antes de entrar na lista.</p>}<footer className="compare-footer"><button type="button" className="btn" onClick={compare.clear}><Trash2 size={16}/> Limpar comparação</button><button type="button" className="btn btn-primary" onClick={addAll} disabled={!products.some(p=>p.stock_status!=='indisponivel'&&!p.customization_fields.some(f=>f.required))}><ShoppingBag size={16}/> Adicionar compatíveis à lista</button></footer></>}</div></div>;
}
