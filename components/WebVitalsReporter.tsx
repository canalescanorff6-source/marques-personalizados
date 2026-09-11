'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

type Bucket='good'|'needs'|'poor';
type LayoutShiftEntry=PerformanceEntry&{hadRecentInput?:boolean;value?:number};
function bucket(metric:'lcp'|'cls'|'ttfb',value:number):Bucket{
  if(metric==='lcp')return value<=2500?'good':value<=4000?'needs':'poor';
  if(metric==='cls')return value<=0.1?'good':value<=0.25?'needs':'poor';
  return value<=800?'good':value<=1800?'needs':'poor';
}
function send(metric:'lcp'|'cls'|'ttfb',value:number,path:string){
  const body=JSON.stringify({event:`vital_${metric}_${bucket(metric,value)}`,path});
  try{if(navigator.sendBeacon){navigator.sendBeacon('/api/events',new Blob([body],{type:'application/json'}));return;}}catch{}
  fetch('/api/events',{method:'POST',headers:{'content-type':'application/json'},body,keepalive:true}).catch(()=>{});
}
export default function WebVitalsReporter(){
  const pathname=usePathname();
  useEffect(()=>{
    if(typeof PerformanceObserver==='undefined')return;
    const path=pathname||'/';if(path.startsWith('/admin'))return;let lcp=0,cls=0,sent=false;const observers:PerformanceObserver[]=[];
    try{const nav=performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming|undefined;if(nav&&nav.responseStart>0)send('ttfb',nav.responseStart,path);}catch{}
    try{const obs=new PerformanceObserver(list=>{for(const entry of list.getEntries())lcp=Math.max(lcp,entry.startTime);});obs.observe({type:'largest-contentful-paint',buffered:true} as PerformanceObserverInit);observers.push(obs);}catch{}
    try{const obs=new PerformanceObserver(list=>{for(const entry of list.getEntries() as LayoutShiftEntry[]){if(!entry.hadRecentInput)cls+=Number(entry.value||0);}});obs.observe({type:'layout-shift',buffered:true} as PerformanceObserverInit);observers.push(obs);}catch{}
    const flush=()=>{if(sent)return;sent=true;if(lcp>0)send('lcp',lcp,path);send('cls',cls,path);};
    const timer=setTimeout(flush,5000);const onVisibility=()=>{if(document.visibilityState==='hidden')flush();};
    document.addEventListener('visibilitychange',onVisibility);window.addEventListener('pagehide',flush,{once:true});
    return()=>{clearTimeout(timer);flush();observers.forEach(o=>o.disconnect());document.removeEventListener('visibilitychange',onVisibility);window.removeEventListener('pagehide',flush);};
  },[pathname]);
  return null;
}
