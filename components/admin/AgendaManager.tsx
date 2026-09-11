'use client';
import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CalendarPlus, Clock3, Download, ExternalLink, LoaderCircle, PackageCheck, PhoneCall, RefreshCw } from 'lucide-react';
import type { AdminAgendaItem, AdminAgendaKind, AdminAgendaWorkspace } from '@/lib/db';
import { fetchJson } from '@/lib/client';

const kindLabel:Record<AdminAgendaKind,string>={evento:'Evento',retorno:'Retorno',producao:'Prazo de produção',publicacao:'Publicação',retirada:'Fim da publicação',divulgacao:'Conteúdo'};
function agendaKindLabel(kind:AdminAgendaKind){return kindLabel[kind];}
function itemDate(item:AdminAgendaItem){return item.all_day?new Date(`${item.date}T12:00:00`):new Date(item.date);}
function dayKey(d:Date){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
function labelDate(d:Date){return new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long',year:'numeric'}).format(d);}
function icsEscape(v:string){return v.replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
function icsDate(d:Date){return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;}
function icsUtc(d:Date){return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');}
const emptySummary={total:0,next_7:0,events:0,follow_ups:0,production:0,publications:0};

export default function AgendaManager(){
  const [days,setDays]=useState<30|60|90|180>(60);
  const [filter,setFilter]=useState<'todos'|AdminAgendaKind>('todos');
  const [workspace,setWorkspace]=useState<AdminAgendaWorkspace|null>(null);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [reloadKey,setReloadKey]=useState(0);

  useEffect(()=>{
    let active=true;setLoading(true);setError('');
    fetchJson<AdminAgendaWorkspace>(`/api/admin/agenda?days=${days}`,{},15000)
      .then(data=>{if(active)setWorkspace(data);})
      .catch(err=>{if(active)setError(err instanceof Error?err.message:'Não foi possível carregar a agenda.');})
      .finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[days,reloadKey]);

  const visible=useMemo(()=>{
    const items=workspace?.items||[];
    return items.filter(item=>filter==='todos'||item.kind===filter);
  },[workspace,filter]);
  const groupedEntries=useMemo(()=>{
    const grouped=visible.reduce<Record<string,AdminAgendaItem[]>>((acc,item)=>{const key=dayKey(itemDate(item));(acc[key]??=[]).push(item);return acc;},{});
    return Object.entries(grouped) as [string,AdminAgendaItem[]][];
  },[visible]);
  const summary=workspace?.summary||emptySummary;

  function downloadIcs(){
    const stamp=icsUtc(new Date());
    const blocks=visible.map(item=>{const date=itemDate(item);const start=item.all_day?`DTSTART;VALUE=DATE:${icsDate(date)}`:`DTSTART:${icsUtc(date)}`;const endLine=item.all_day?`DTEND;VALUE=DATE:${icsDate(new Date(date.getTime()+86400000))}`:'';return ['BEGIN:VEVENT',`UID:${item.id}@marques-catalogo`,`DTSTAMP:${stamp}`,start,endLine,`SUMMARY:${icsEscape(`${agendaKindLabel(item.kind)} — ${item.title}`)}`,`DESCRIPTION:${icsEscape(item.subtitle)}`,'END:VEVENT'].filter(Boolean).join('\r\n');});
    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Marques Catalogo//Agenda V6//PT-BR','CALSCALE:GREGORIAN',...blocks,'END:VCALENDAR'].join('\r\n');
    const url=URL.createObjectURL(new Blob([ics],{type:'text/calendar;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=`agenda-marques-${new Date().toISOString().slice(0,10)}.ics`;a.click();URL.revokeObjectURL(url);
  }

  return <section className="agenda-admin">
    <div className="agenda-kpis">
      <article><CalendarDays size={18}/><span>Próximos 7 dias</span><strong>{summary.next_7}</strong></article>
      <article><PackageCheck size={18}/><span>Eventos no período</span><strong>{summary.events}</strong></article>
      <article><PhoneCall size={18}/><span>Retornos</span><strong>{summary.follow_ups}</strong></article>
      <article><PackageCheck size={18}/><span>Prazos de produção</span><strong>{summary.production}</strong></article>
      <article><Clock3 size={18}/><span>Publicações</span><strong>{summary.publications}</strong></article>
    </div>
    <section className="admin-panel">
      <div className="panel-title"><div><div className="eyebrow">Operação / calendário</div><h2>Agenda de produção e atendimento</h2><p className="muted">Calendário global do Neon: eventos, retornos, produção e publicações não dependem mais do histórico carregado no CRM.</p></div><button type="button" className="btn" onClick={downloadIcs} disabled={!visible.length||loading}><Download size={16}/> Baixar .ics</button></div>
      <div className="agenda-toolbar">
        <div className="field"><label htmlFor="adm-agendamanager-1">Período</label><select id="adm-agendamanager-1" value={days} onChange={e=>setDays(Number(e.target.value) as 30|60|90|180)}><option value={30}>Próximos 30 dias</option><option value={60}>Próximos 60 dias</option><option value={90}>Próximos 90 dias</option><option value={180}>Próximos 180 dias</option></select></div>
        <div className="field"><label htmlFor="adm-agendamanager-2">Tipo</label><select id="adm-agendamanager-2" value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}><option value="todos">Tudo</option><option value="evento">Eventos</option><option value="retorno">Retornos</option><option value="producao">Prazos de produção</option><option value="publicacao">Publicações</option><option value="retirada">Fim de publicação</option><option value="divulgacao">Conteúdo / redes</option></select></div>
        <button type="button" className="icon-btn" onClick={()=>setReloadKey(value=>value+1)} disabled={loading} aria-label="Atualizar agenda" title="Atualizar agenda">{loading?<LoaderCircle size={16} className="spin"/>:<RefreshCw size={16}/>}</button>
      </div>
      {error&&<div className="admin-inline-error"><strong>Agenda indisponível.</strong><span>{error}</span><button type="button" className="btn btn-small" onClick={()=>setReloadKey(value=>value+1)}>Tentar novamente</button></div>}
      <div className="agenda-timeline">
        {loading&&!workspace&&<div className="empty"><LoaderCircle className="spin" size={28}/><strong>Carregando calendário operacional…</strong><span>Consultando apenas o período selecionado.</span></div>}
        {!loading&&groupedEntries.map(([key,rows])=><section className="agenda-day" key={key}><header><time dateTime={key}>{labelDate(itemDate(rows[0]))}</time><span>{rows.length} item(ns)</span></header><div>{rows.map(item=><article className={`agenda-row kind-${item.kind}`} key={item.id}><span className="agenda-dot"/><div className="agenda-time">{item.all_day?'Dia todo':itemDate(item).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</div><div className="agenda-copy"><small>{agendaKindLabel(item.kind)}</small><strong>{item.title}</strong><span>{item.subtitle}</span></div>{item.href&&<a className="icon-btn" href={item.href} target="_blank" rel="noreferrer" aria-label={`Abrir ${item.title}`}><ExternalLink size={15}/></a>}</article>)}</div></section>)}
        {!loading&&!error&&!visible.length&&<div className="empty"><CalendarPlus size={28}/><strong>Nada programado nesse período.</strong><span>Datas de evento, follow-ups, produção, produtos e conteúdos de redes aparecerão automaticamente aqui.</span></div>}
      </div>
    </section>
  </section>;
}
