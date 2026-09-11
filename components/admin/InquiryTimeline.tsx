'use client';
import { useRef, useState } from 'react';
import { Clock3,History,X } from 'lucide-react';
import type { InquiryActivity } from '@/lib/db';
import { fetchJson } from '@/lib/client';
import { useDialogA11y } from '@/components/useDialogA11y';
function labelDate(value:string){return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(value));}
export default function InquiryTimeline({inquiryId,name}:{inquiryId:string;name:string}){
  const [open,setOpen]=useState(false);const [rows,setRows]=useState<InquiryActivity[]>([]);const [loading,setLoading]=useState(false);const [error,setError]=useState('');const dialogRef=useRef<HTMLElement>(null);useDialogA11y(open,dialogRef,()=>setOpen(false));
  async function show(){setOpen(true);if(rows.length)return;setLoading(true);setError('');try{const data=await fetchJson<{activity:InquiryActivity[]}>(`/api/admin/inquiries/${inquiryId}/activity`,{},15000);setRows(data.activity);}catch(e){setError(e instanceof Error?e.message:'Não foi possível carregar o histórico.');}finally{setLoading(false);}}
  return <><button type="button" className="btn" onClick={show}><History size={15}/> Histórico</button>{open&&<div className="admin-modal-backdrop" role="presentation"><section ref={dialogRef} className="admin-modal inquiry-timeline-modal" role="dialog" aria-modal="true" aria-labelledby={`timeline-${inquiryId}`} tabIndex={-1}><div className="panel-title"><div><div className="eyebrow">CRM / histórico</div><h2 id={`timeline-${inquiryId}`}>{name}</h2><p className="muted small">Evolução cronológica deste atendimento.</p></div><button type="button" className="icon-btn" onClick={()=>setOpen(false)} aria-label="Fechar histórico"><X size={18}/></button></div>{loading&&<div className="loading-inline">Carregando histórico…</div>}{error&&<div className="error" role="alert">{error}</div>}<div className="inquiry-timeline">{rows.map((row,index)=><article key={row.id}><span className="timeline-node"><Clock3 size={13}/></span><div><small>{labelDate(row.created_at)}</small><strong>{row.kind==='created'?'Solicitação recebida':'Atendimento atualizado'}</strong><p>{row.summary}</p></div>{index<rows.length-1&&<i/>}</article>)}{!loading&&!error&&!rows.length&&<div className="empty compact">Ainda não há eventos registrados neste atendimento.</div>}</div></section></div>}</>;
}
