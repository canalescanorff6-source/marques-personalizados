'use client';
import { useEffect, useRef, type RefObject } from 'react';

export function useDialogA11y(open:boolean,ref:RefObject<HTMLElement|null>,onClose:()=>void){
  const closeRef=useRef(onClose);
  useEffect(()=>{closeRef.current=onClose},[onClose]);
  useEffect(()=>{
    if(!open)return;
    const el=ref.current;if(!el)return;const dialog=el;
    const previous=document.activeElement as HTMLElement|null;
    const bodyOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const focusable=():HTMLElement[]=>(Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')) as HTMLElement[]).filter((x:HTMLElement)=>!x.hasAttribute('hidden')&&x.getAttribute('aria-hidden')!=='true');
    requestAnimationFrame(()=>focusable()[0]?.focus());
    function key(e:KeyboardEvent){
      if(e.key==='Escape'){e.preventDefault();closeRef.current();return;}
      if(e.key!=='Tab')return;
      const f=focusable();if(!f.length){e.preventDefault();dialog.focus();return;}
      const first=f[0],last=f[f.length-1];
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
    }
    document.addEventListener('keydown',key);
    return()=>{document.body.style.overflow=bodyOverflow;document.removeEventListener('keydown',key);previous?.focus?.();};
  },[open,ref]);
}
