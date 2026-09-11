'use client';

import { useEffect } from 'react';

export default function PremiumExperience(){
  useEffect(()=>{
    const root=document.documentElement;
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
    const finePointer=window.matchMedia('(hover: hover) and (pointer: fine)');
    root.classList.add('motion-ready');

    const updateScroll=()=>{
      const max=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);
      root.style.setProperty('--scroll-progress',max>0?String(Math.min(1,Math.max(0,window.scrollY/max))):'0');
    };
    const onPointer=(event:PointerEvent)=>{
      if(!finePointer.matches||reduced.matches)return;
      root.style.setProperty('--pointer-x',`${event.clientX}px`);
      root.style.setProperty('--pointer-y',`${event.clientY}px`);
    };

    let observer:IntersectionObserver|null=null;
    const revealImmediately=(element:HTMLElement)=>{element.dataset.visible='true';};
    const register=(element:HTMLElement)=>{
      if(element.dataset.visible==='true')return;
      if(reduced.matches||!observer){revealImmediately(element);return;}
      observer.observe(element);
    };
    const registerTree=(node:Node)=>{
      if(!(node instanceof HTMLElement))return;
      if(node.matches('[data-reveal]'))register(node);
      node.querySelectorAll<HTMLElement>('[data-reveal]').forEach(register);
    };

    if('IntersectionObserver' in window&&!reduced.matches){
      observer=new IntersectionObserver(entries=>{
        for(const entry of entries){
          if(entry.isIntersecting){
            revealImmediately(entry.target as HTMLElement);
            observer?.unobserve(entry.target);
          }
        }
      },{threshold:.1,rootMargin:'0px 0px -28px'});
    }
    document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(register);

    const mutations=new MutationObserver(records=>{
      for(const record of records)for(const node of record.addedNodes)registerTree(node);
      updateScroll();
    });
    mutations.observe(document.body,{childList:true,subtree:true});

    const onMotionChange=()=>{
      if(reduced.matches){observer?.disconnect();observer=null;document.querySelectorAll<HTMLElement>('[data-reveal]').forEach(revealImmediately);}
      root.classList.toggle('motion-reduced',reduced.matches);
    };
    onMotionChange();updateScroll();
    window.addEventListener('scroll',updateScroll,{passive:true});
    window.addEventListener('resize',updateScroll,{passive:true});
    if(finePointer.matches)window.addEventListener('pointermove',onPointer,{passive:true});
    reduced.addEventListener?.('change',onMotionChange);

    return()=>{
      observer?.disconnect();mutations.disconnect();
      root.classList.remove('motion-ready','motion-reduced');
      window.removeEventListener('scroll',updateScroll);
      window.removeEventListener('resize',updateScroll);
      window.removeEventListener('pointermove',onPointer);
      reduced.removeEventListener?.('change',onMotionChange);
    };
  },[]);
  return <><div className="scroll-progress" aria-hidden="true"/><div className="pointer-aura" aria-hidden="true"/></>;
}
