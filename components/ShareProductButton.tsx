'use client';
import { Check, Share2 } from 'lucide-react';
import { useState } from 'react';
export default function ShareProductButton({name}:{name:string}){const [copied,setCopied]=useState(false);async function share(){try{if(navigator.share){await navigator.share({title:name,text:`Veja ${name} no catálogo`,url:location.href});return;}await navigator.clipboard.writeText(location.href);setCopied(true);setTimeout(()=>setCopied(false),1800);}catch{}}return <button type="button" className="btn product-share" onClick={share}>{copied?<Check size={16}/>:<Share2 size={16}/>} {copied?'Link copiado':'Compartilhar'}</button>;}
