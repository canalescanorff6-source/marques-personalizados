'use client';
import { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import SafeImage from './SafeImage';
import { useDialogA11y } from './useDialogA11y';

export default function ProductGallery({images,name}:{images:string[];name:string}){
  const list=images.length?images:['/placeholder-topo.svg'];
  const [index,setIndex]=useState(0),[open,setOpen]=useState(false);
  const dialogRef=useRef<HTMLDivElement>(null),touchStart=useRef<number|null>(null);
  useDialogA11y(open,dialogRef,()=>setOpen(false));
  const move=(delta:number)=>setIndex(i=>(i+delta+list.length)%list.length);
  const onTouchStart=(e:React.TouchEvent)=>{touchStart.current=e.touches[0]?.clientX??null};
  const onTouchEnd=(e:React.TouchEvent)=>{if(touchStart.current===null)return;const end=e.changedTouches[0]?.clientX??touchStart.current;const delta=end-touchStart.current;touchStart.current=null;if(Math.abs(delta)>45&&list.length>1)move(delta<0?1:-1)};
  return <div className="product-page-gallery"><button type="button" className="product-main-image premium-image-button" onClick={()=>setOpen(true)} aria-label={`Ampliar imagem de ${name}`}><SafeImage src={list[index]} alt={name}/><span className="image-zoom"><ZoomIn size={17}/> Ampliar</span><span className="image-counter">{String(index+1).padStart(2,'0')} / {String(list.length).padStart(2,'0')}</span></button>{list.length>1&&<div className="product-page-thumbs" aria-label="Miniaturas da galeria">{list.map((src,i)=><button type="button" key={`${src}-${i}`} className={index===i?'active':''} onClick={()=>setIndex(i)} aria-label={`Ver imagem ${i+1} de ${list.length}`} aria-current={index===i?'true':undefined}><SafeImage src={src} alt="" loading="lazy" decoding="async"/></button>)}</div>}{open&&<div ref={dialogRef} className="lightbox" role="dialog" aria-modal="true" aria-label={`Galeria ampliada de ${name}`} tabIndex={-1} onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}} onKeyDown={e=>{if(e.key==='ArrowRight')move(1);if(e.key==='ArrowLeft')move(-1)}} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}><button type="button" className="lightbox-close" onClick={()=>setOpen(false)} aria-label="Fechar galeria"><X/></button>{list.length>1&&<button type="button" className="lightbox-nav prev" onClick={()=>move(-1)} aria-label="Imagem anterior"><ChevronLeft/></button>}<SafeImage src={list[index]} alt={`${name} — imagem ${index+1} de ${list.length}`}/>{list.length>1&&<button type="button" className="lightbox-nav next" onClick={()=>move(1)} aria-label="Próxima imagem"><ChevronRight/></button>}<span className="lightbox-count" aria-live="polite">{index+1} de {list.length}</span></div>}</div>;
}
