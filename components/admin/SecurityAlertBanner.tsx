'use client';
import { useEffect,useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { fetchJson } from '@/lib/client';

export default function SecurityAlertBanner({onOpen}:{onOpen:()=>void}){
  const [count,setCount]=useState(0);
  useEffect(()=>{let active=true;fetchJson<{unread_count?:number}>('/api/admin/security').then(data=>{if(active)setCount(Math.max(0,Number(data.unread_count||0)));}).catch(()=>{});return()=>{active=false;};},[]);
  if(!count)return null;
  return <button type="button" className="security-alert-banner" onClick={onOpen}><ShieldAlert size={18}/><span><strong>{count} alerta(s) de segurança</strong><small>Há atividade administrativa nova para revisar.</small></span><b>Revisar</b></button>;
}
