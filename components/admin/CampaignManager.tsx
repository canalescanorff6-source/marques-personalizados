'use client';
import { useMemo, useState } from 'react';
import { BarChart3, CalendarClock, CheckCircle2, Copy, Edit3, Megaphone, Plus, Target, Trash2, TrendingUp, WalletCards } from 'lucide-react';
import type { InquiryMarketingCampaignRow, MarketingCampaign } from '@/lib/db';
import { fetchJson } from '@/lib/client';

type Props={
  campaigns:MarketingCampaign[];
  setCampaigns:React.Dispatch<React.SetStateAction<MarketingCampaign[]>>;
  statsBySlug:Record<string,InquiryMarketingCampaignRow>;
  onUse?:(slug:string)=>void;
};

type FormState={name:string;slug:string;channel:MarketingCampaign['channel'];status:MarketingCampaign['status'];starts_at:string;ends_at:string;goal_leads:string;goal_revenue:string;spend:string;notes:string};
const emptyForm:FormState={name:'',slug:'',channel:'instagram',status:'planejada',starts_at:'',ends_at:'',goal_leads:'',goal_revenue:'',spend:'',notes:''};
const labels:Record<MarketingCampaign['channel'],string>={instagram:'Instagram',whatsapp:'WhatsApp',facebook:'Facebook',tiktok:'TikTok',pinterest:'Pinterest',youtube:'YouTube',google:'Google',outro:'Outro'};
const statusLabels:Record<MarketingCampaign['status'],string>={planejada:'Planejada',ativa:'Ativa',encerrada:'Encerrada'};
const money=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const slugify=(value:string)=>value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80);
function toLocal(value:string|null){if(!value)return'';const d=new Date(value);if(Number.isNaN(d.getTime()))return'';const local=new Date(d.getTime()-d.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);}
function toIso(value:string){if(!value)return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString();}
export default function CampaignManager({campaigns,setCampaigns,statsBySlug,onUse}:Props){
  const [editing,setEditing]=useState<MarketingCampaign|null>(null);
  const [form,setForm]=useState<FormState>(emptyForm);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [message,setMessage]=useState('');
  const [filter,setFilter]=useState<'todas'|MarketingCampaign['status']>('todas');

  const stats=useMemo(()=>Object.fromEntries(campaigns.map(c=>{
    const row=statsBySlug[c.slug.toLowerCase()];const leads=row?.leads||0;const closed=row?.closed||0;const revenue=row?.revenue||0;const received=row?.received||0;
    return [c.id,{leads,closed,revenue,received,conversion:leads?Math.round(closed/leads*100):0}];
  })),[campaigns,statsBySlug]);

  const visible=campaigns.filter(c=>filter==='todas'||c.status===filter);
  const active=campaigns.filter(c=>c.status==='ativa').length;
  const totalRevenue=campaigns.reduce((sum,c)=>sum+(stats[c.id]?.revenue||0),0);
  const totalReceived=campaigns.reduce((sum,c)=>sum+(stats[c.id]?.received||0),0);
  const totalSpend=campaigns.reduce((sum,c)=>sum+Number(c.spend_cents||0),0);

  function startCreate(){setEditing(null);setForm(emptyForm);setError('');setMessage('');}
  function startEdit(c:MarketingCampaign){setEditing(c);setForm({name:c.name,slug:c.slug,channel:c.channel,status:c.status,starts_at:toLocal(c.starts_at),ends_at:toLocal(c.ends_at),goal_leads:c.goal_leads?String(c.goal_leads):'',goal_revenue:c.goal_revenue_cents?String((c.goal_revenue_cents/100).toFixed(2).replace('.',',')):'',spend:c.spend_cents?String((c.spend_cents/100).toFixed(2).replace('.',',')):'',notes:c.notes||''});setError('');setMessage('');}
  function setName(value:string){setForm(prev=>({...prev,name:value,slug:editing?prev.slug:slugify(value)}));}
  async function save(e:React.FormEvent){e.preventDefault();if(busy)return;setBusy(true);setError('');setMessage('');try{
    const goalRevenue=Math.max(0,Math.round(Number(form.goal_revenue.replace(/\./g,'').replace(',','.'))*100)||0);
    const spend=Math.max(0,Math.round(Number(form.spend.replace(/\./g,'').replace(',','.'))*100)||0);
    const payload={name:form.name.trim(),slug:slugify(form.slug),channel:form.channel,status:form.status,starts_at:toIso(form.starts_at),ends_at:toIso(form.ends_at),goal_leads:Math.max(0,Number.parseInt(form.goal_leads||'0',10)||0),goal_revenue_cents:goalRevenue,spend_cents:spend,notes:form.notes.trim(),...(editing?{expected_updated_at:editing.updated_at}:{})};
    if(editing){const data=await fetchJson<{campaign:MarketingCampaign}>(`/api/admin/campaigns/${editing.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify(payload)},12000);setCampaigns(prev=>prev.map(x=>x.id===editing.id?data.campaign:x));setEditing(data.campaign);setMessage('Campanha atualizada.');}
    else{const data=await fetchJson<{campaign:MarketingCampaign}>('/api/admin/campaigns',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)},12000);setCampaigns(prev=>[data.campaign,...prev]);setEditing(data.campaign);setMessage('Campanha criada.');}
  }catch(e){setError(e instanceof Error?e.message:'Não foi possível salvar a campanha.');}finally{setBusy(false);}}
  async function remove(c:MarketingCampaign){if(!confirm(`Excluir a campanha “${c.name}”? Apenas campanhas sem leads vinculados podem ser excluídas.`))return;setBusy(true);setError('');try{await fetchJson(`/api/admin/campaigns/${c.id}?expected_updated_at=${encodeURIComponent(c.updated_at)}`,{method:'DELETE'},12000);setCampaigns(prev=>prev.filter(x=>x.id!==c.id));if(editing?.id===c.id)startCreate();}catch(e){setError(e instanceof Error?e.message:'Não foi possível excluir.');}finally{setBusy(false);}}
  async function copySlug(slug:string){try{await navigator.clipboard.writeText(slug);setMessage('Identificador copiado.');}catch{setMessage(slug);}}

  return <section className="campaign-manager">
    <div className="panel-subhead"><div><div className="eyebrow">Campanhas rastreáveis</div><h3>Campanhas de marketing</h3><p className="muted">Crie uma campanha, use o identificador nos links UTM e acompanhe leads, vendas e valor recebido no mesmo painel.</p></div><button type="button" className="btn" onClick={startCreate}><Plus size={15}/> Nova campanha</button></div>
    <div className="campaign-summary">
      <article><Megaphone size={18}/><div><span>Campanhas ativas</span><strong>{active}</strong></div></article>
      <article><TrendingUp size={18}/><div><span>Valor fechado</span><strong>{money(totalRevenue)}</strong></div></article>
      <article><WalletCards size={18}/><div><span>Valor recebido</span><strong>{money(totalReceived)}</strong></div></article><article><Target size={18}/><div><span>Investimento</span><strong>{money(totalSpend)}</strong><small>{totalSpend?`ROAS vendido ${(totalRevenue/totalSpend).toFixed(1)}x`:'orgânico/sem custo'}</small></div></article>
    </div>
    <div className="campaign-layout">
      <form className="campaign-form" onSubmit={save}>
        <div className="panel-subhead compact"><div><strong>{editing?'Editar campanha':'Nova campanha'}</strong><small>{editing?'Atualize metas, período e canal sem perder os resultados vinculados.':'Tudo começa como planejado até você ativar.'}</small></div></div>
        <div className="field"><label htmlFor="campaign-name">Nome</label><input id="campaign-name" required maxLength={140} value={form.name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Dia das Mães 2027"/></div>
        <div className="field"><label htmlFor="campaign-slug">Identificador UTM</label><input id="campaign-slug" required maxLength={80} value={form.slug} readOnly={Boolean(editing)} aria-readonly={Boolean(editing)} onChange={e=>setForm(p=>({...p,slug:slugify(e.target.value)}))} placeholder="dia-das-maes-2027"/><small>{editing?<>Identificador permanente para preservar os leads e resultados já atribuídos.</>:<>Use este valor em <code>utm_campaign</code>. Depois de criar, ele fica bloqueado para manter o histórico.</>}</small></div>
        <div className="row-2"><div className="field"><label htmlFor="campaign-channel">Canal principal</label><select id="campaign-channel" value={form.channel} onChange={e=>setForm(p=>({...p,channel:e.target.value as MarketingCampaign['channel']}))}>{Object.entries(labels).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></div><div className="field"><label htmlFor="campaign-status">Status</label><select id="campaign-status" value={form.status} onChange={e=>setForm(p=>({...p,status:e.target.value as MarketingCampaign['status']}))}><option value="planejada">Planejada</option><option value="ativa">Ativa</option><option value="encerrada">Encerrada</option></select></div></div>
        <div className="row-2"><div className="field"><label htmlFor="campaign-start">Início</label><input id="campaign-start" type="datetime-local" value={form.starts_at} onChange={e=>setForm(p=>({...p,starts_at:e.target.value}))}/></div><div className="field"><label htmlFor="campaign-end">Fim</label><input id="campaign-end" type="datetime-local" value={form.ends_at} onChange={e=>setForm(p=>({...p,ends_at:e.target.value}))}/></div></div>
        <div className="row-2"><div className="field"><label htmlFor="campaign-goal-leads">Meta de leads</label><input id="campaign-goal-leads" type="number" min="0" max="100000" value={form.goal_leads} onChange={e=>setForm(p=>({...p,goal_leads:e.target.value}))} placeholder="30"/></div><div className="field"><label htmlFor="campaign-goal-revenue">Meta de vendas (R$)</label><input id="campaign-goal-revenue" inputMode="decimal" value={form.goal_revenue} onChange={e=>setForm(p=>({...p,goal_revenue:e.target.value}))} placeholder="3000,00"/></div></div><div className="field"><label htmlFor="campaign-spend">Investimento em divulgação (R$)</label><input id="campaign-spend" inputMode="decimal" value={form.spend} onChange={e=>setForm(p=>({...p,spend:e.target.value}))} placeholder="0,00"/><small>Deixe zerado para divulgação orgânica. Quando houver impulsionamento/anúncios, informe o custo total para calcular retorno.</small></div>
        <div className="field"><label htmlFor="campaign-notes">Observações</label><textarea id="campaign-notes" rows={4} maxLength={2000} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="Oferta, criativo, público, observações sobre a campanha…"/></div>
        {error&&<div className="error" role="alert">{error}</div>}{message&&<div className="success" role="status">{message}</div>}
        <div className="inline-actions"><button type="submit" className="btn btn-primary" disabled={busy}>{editing?<><CheckCircle2 size={15}/> Salvar campanha</>:<><Plus size={15}/> Criar campanha</>}</button>{editing&&<button type="button" className="btn" onClick={startCreate}>Cancelar edição</button>}</div>
      </form>
      <div className="campaign-list-wrap">
        <div className="campaign-filters" role="group" aria-label="Filtrar campanhas">{(['todas','planejada','ativa','encerrada'] as const).map(x=><button type="button" key={x} className={filter===x?'active':''} onClick={()=>setFilter(x)}>{x==='todas'?'Todas':statusLabels[x]}</button>)}</div>
        <div className="campaign-list">{visible.map(c=>{const s=stats[c.id]||{leads:0,closed:0,revenue:0,received:0,conversion:0};const leadPct=c.goal_leads?Math.min(100,Math.round(s.leads/c.goal_leads*100)):0;const revenuePct=c.goal_revenue_cents?Math.min(100,Math.round(s.revenue/c.goal_revenue_cents*100)):0;const now=Date.now();const start=c.starts_at?new Date(c.starts_at).getTime():null;const end=c.ends_at?new Date(c.ends_at).getTime():null;const period=start&&start>now?'Ainda não iniciou':end&&end<now?'Período encerrado':c.status==='ativa'?'Em andamento':'Sem execução ativa';return <article className={`campaign-card is-${c.status}`} key={c.id}>
          <div className="campaign-card-head"><div><span>{labels[c.channel]} • {statusLabels[c.status]}</span><strong>{c.name}</strong><small>{period}</small></div><div className="inline-actions"><button type="button" className="icon-btn" onClick={()=>startEdit(c)} aria-label={`Editar ${c.name}`}><Edit3 size={15}/></button><button type="button" className="icon-btn danger" disabled={s.leads>0} title={s.leads>0?`Preserve os ${s.leads} lead(s): encerre a campanha em vez de excluir.`:"Excluir campanha"} onClick={()=>remove(c)} aria-label={s.leads>0?`Campanha ${c.name} possui leads e não pode ser excluída`:`Excluir ${c.name}`}><Trash2 size={15}/></button></div></div>
          <button type="button" className="campaign-slug" onClick={()=>copySlug(c.slug)} title="Copiar identificador"><code>{c.slug}</code><Copy size={13}/></button>
          <div className="campaign-metrics"><div><span>Leads</span><strong>{s.leads}</strong><small>{c.goal_leads?`meta ${c.goal_leads}`:'sem meta'}</small></div><div><span>Fechados</span><strong>{s.closed}</strong><small>{s.conversion}% conversão</small></div><div><span>Vendido</span><strong>{money(s.revenue)}</strong><small>{c.goal_revenue_cents?`meta ${money(c.goal_revenue_cents)}`:'sem meta'}</small></div><div><span>Recebido</span><strong>{money(s.received)}</strong><small>{s.revenue?`${Math.round(s.received/s.revenue*100)}% do vendido`:'sem venda'}</small></div><div><span>Investimento</span><strong>{money(c.spend_cents||0)}</strong><small>{c.spend_cents?`ROAS ${(s.revenue/c.spend_cents).toFixed(1)}x`:'orgânico'}</small></div></div>
          {(c.goal_leads>0||c.goal_revenue_cents>0)&&<div className="campaign-progresses">{c.goal_leads>0&&<div><span><Target size={13}/> Meta de leads <b>{leadPct}%</b></span><i><b style={{width:`${leadPct}%`}}/></i></div>}{c.goal_revenue_cents>0&&<div><span><BarChart3 size={13}/> Meta de vendas <b>{revenuePct}%</b></span><i><b style={{width:`${revenuePct}%`}}/></i></div>}</div>}
          <div className="campaign-card-foot"><span><CalendarClock size={13}/>{c.starts_at?new Date(c.starts_at).toLocaleDateString('pt-BR'):'Sem início'} → {c.ends_at?new Date(c.ends_at).toLocaleDateString('pt-BR'):'Sem fim'}</span>{onUse&&<button type="button" className="btn btn-small" onClick={()=>onUse(c.slug)}>Usar no Estúdio</button>}</div>{c.notes&&<p>{c.notes}</p>}
        </article>})}{!visible.length&&<div className="empty">Nenhuma campanha neste filtro.</div>}</div>
      </div>
    </div>
  </section>;
}
