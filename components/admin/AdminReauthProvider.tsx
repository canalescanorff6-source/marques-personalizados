'use client';
import { useEffect,useRef,useState,type ReactNode } from 'react';
import { KeyRound,ShieldCheck,X } from 'lucide-react';
import { registerAdminReauthHandler } from '@/lib/client';
import { useDialogA11y } from '@/components/useDialogA11y';

type PendingReauth={promise:Promise<boolean>;resolve:(value:boolean)=>void};

export default function AdminReauthProvider({children}:{children:ReactNode}){
  const [open,setOpen]=useState(false);const [code,setCode]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');const pending=useRef<PendingReauth|null>(null);const dialogRef=useRef<HTMLElement|null>(null);
  useEffect(()=>{
    registerAdminReauthHandler(()=>{
      if(pending.current)return pending.current.promise;
      let resolvePromise:(value:boolean)=>void=()=>{};
      const promise=new Promise<boolean>(resolve=>{resolvePromise=resolve;});
      pending.current={promise,resolve:resolvePromise};setCode('');setError('');setOpen(true);return promise;
    });
    return()=>{registerAdminReauthHandler(null);pending.current?.resolve(false);pending.current=null;};
  },[]);
  function finish(value:boolean){const item=pending.current;pending.current=null;setOpen(false);setBusy(false);setCode('');setError('');item?.resolve(value);}
  useDialogA11y(open,dialogRef,()=>finish(false));
  async function confirm(){
    if(code.length!==6||busy)return;setBusy(true);setError('');
    try{
      const response=await fetch('/api/admin/reauth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});
      const text=await response.text();let data:Record<string,unknown>={};try{const parsed:unknown=text?JSON.parse(text):{};if(parsed&&typeof parsed==='object'&&!Array.isArray(parsed))data=parsed as Record<string,unknown>;}catch{}
      if(!response.ok){setError(typeof data.error==='string'?data.error:'Não foi possível confirmar sua identidade.');setBusy(false);return;}
      finish(true);
    }catch{setError('Não foi possível conectar ao servidor. Tente novamente.');setBusy(false);}
  }
  return <>{children}{open&&<div className="reauth-backdrop" role="presentation"><section ref={dialogRef} className="reauth-dialog" role="dialog" aria-modal="true" aria-labelledby="reauth-title"><button type="button" className="reauth-close" aria-label="Cancelar confirmação" onClick={()=>finish(false)}><X size={18}/></button><div className="reauth-icon"><ShieldCheck size={25}/></div><div><div className="eyebrow">Ação protegida</div><h2 id="reauth-title">Confirme sua identidade</h2><p>Esta operação é sensível. Digite um novo código de 6 dígitos do seu autenticador para continuar.</p></div><label htmlFor="admin-reauth-code">Código TOTP</label><div className="reauth-code-row"><KeyRound size={18}/><input id="admin-reauth-code" autoFocus inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,'').slice(0,6))} onKeyDown={e=>{if(e.key==='Enter')void confirm();}} placeholder="000000"/></div>{error&&<div className="error" role="alert">{error}</div>}<div className="reauth-actions"><button type="button" className="btn" onClick={()=>finish(false)} disabled={busy}>Cancelar</button><button type="button" className="btn btn-primary" onClick={()=>void confirm()} disabled={busy||code.length!==6}>{busy?'Confirmando…':'Confirmar e continuar'}</button></div><small>A confirmação vale por poucos minutos apenas nesta sessão administrativa.</small></section></div>}</>;
}
