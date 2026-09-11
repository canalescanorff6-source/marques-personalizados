'use client';
import { useEffect } from 'react';
import { trackSessionEvent } from './SiteAnalytics';
const KEY='marques-vistos-recentemente-v1';
export default function RecentlyViewedTracker({slug}:{slug:string}){useEffect(()=>{try{const current=JSON.parse(localStorage.getItem(KEY)||'[]');const next=[slug,...(Array.isArray(current)?current:[]).filter((x:unknown)=>typeof x==='string'&&x!==slug)].slice(0,8);localStorage.setItem(KEY,JSON.stringify(next));window.dispatchEvent(new CustomEvent('marques:recent-view'));}catch{}trackSessionEvent('product_view',`/catalogo/${slug}`,`marques:product-view:${slug}`);},[slug]);return null;}
