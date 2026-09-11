export type MarketingAttribution={source?:string;medium?:string;campaign?:string;content?:string;term?:string;landing_path?:string;referrer_host?:string};
const KEY='marques.marketing.attribution.v1';
function clean(value:string|null,max=100){return String(value||'').trim().replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').slice(0,max);}
export function captureAttribution():MarketingAttribution{
  if(typeof window==='undefined')return{};
  try{const existing=JSON.parse(sessionStorage.getItem(KEY)||'null');if(existing&&typeof existing==='object')return existing; }catch{}
  const url=new URL(window.location.href);let referrerHost='';try{if(document.referrer){const ref=new URL(document.referrer);if(ref.host!==window.location.host)referrerHost=clean(ref.host,120);}}catch{}
  const source=clean(url.searchParams.get('utm_source'),80)||referrerHost||'direto';
  const data:MarketingAttribution={source,medium:clean(url.searchParams.get('utm_medium'),80),campaign:clean(url.searchParams.get('utm_campaign'),120),content:clean(url.searchParams.get('utm_content'),120),term:clean(url.searchParams.get('utm_term'),120),landing_path:clean(url.pathname,180),referrer_host:referrerHost};
  try{sessionStorage.setItem(KEY,JSON.stringify(data));}catch{}
  return data;
}
export function getAttribution(){return captureAttribution();}
