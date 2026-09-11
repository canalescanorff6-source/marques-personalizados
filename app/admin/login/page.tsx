'use client';

import { useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound,LockKeyhole,ShieldCheck } from 'lucide-react';
import { fetchJson } from '@/lib/client';

type LoginResponse={ok:boolean;mfa_required:boolean};

export default function LoginPage(){
  const router=useRouter();
  const [password,setPassword]=useState('');
  const [code,setCode]=useState('');
  const [useRecovery,setUseRecovery]=useState(false);
  const [stage,setStage]=useState<'password'|'mfa'>('password');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const [expired,setExpired]=useState(false);
  const nextRef=useRef('/admin');
  const codeRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{const params=new URLSearchParams(window.location.search);setExpired(params.get('reason')==='expired');const next=params.get('next')||'/admin';nextRef.current=next.startsWith('/admin')&&!next.startsWith('/admin/login')?next:'/admin';},[]);
  useEffect(()=>{if(stage==='mfa')codeRef.current?.focus();},[stage]);

  function finishLogin(){router.push(nextRef.current);router.refresh();}

  async function submitPassword(e:React.FormEvent){
    e.preventDefault();setLoading(true);setError('');
    try{
      const result=await fetchJson<LoginResponse>('/api/admin/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({password})},12000);
      if(result.mfa_required){setPassword('');setStage('mfa');return;}
      finishLogin();
    }catch(e){setError(e instanceof Error?e.message:'Não foi possível entrar.');}
    finally{setLoading(false);}
  }

  async function submitMfa(e:React.FormEvent){
    e.preventDefault();setLoading(true);setError('');
    try{await fetchJson<{ok:boolean;method?:'totp'|'recovery'}>('/api/admin/mfa/verify',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(useRecovery?{recovery_code:code}:{code})},12000);finishLogin();}
    catch(e){setError(e instanceof Error?e.message:'Não foi possível validar o código.');}
    finally{setLoading(false);}
  }

  return <main className="login-wrap"><form className="login-card" onSubmit={stage==='password'?submitPassword:submitMfa}>
    <span className="brand-mark">{stage==='password'?<LockKeyhole size={19}/>:<ShieldCheck size={19}/>}</span>
    <h1>{stage==='password'?'Painel do catálogo':'Verificação em duas etapas'}</h1>
    <p>{stage==='password'?'Acesso restrito para cadastrar, editar e organizar os produtos publicados no site.':useRecovery?'Digite um dos códigos de recuperação de uso único que você salvou anteriormente.':'Digite o código de 6 dígitos exibido no seu aplicativo autenticador.'}</p>
    {expired&&stage==='password'&&<div className="login-session-notice" role="status">Sua sessão expirou por segurança. Entre novamente para continuar de onde parou.</div>}
    {stage==='password'?<div className="field" style={{margin:'22px 0 12px'}}><label htmlFor="admin-password">Senha administrativa</label><input id="admin-password" type="password" autoComplete="current-password" aria-describedby={error?'login-error':undefined} value={password} onChange={e=>setPassword(e.target.value)} autoFocus required/></div>:<div className="field" style={{margin:'22px 0 12px'}}><label htmlFor="admin-second-factor">{useRecovery?'Código de recuperação':'Código do autenticador'}</label><div className="login-code-field"><KeyRound size={18}/><input ref={codeRef} id="admin-second-factor" type="text" inputMode={useRecovery?'text':'numeric'} autoComplete={useRecovery?'off':'one-time-code'} pattern={useRecovery?'[A-Za-z2-9-]{16,19}':'[0-9]{6}'} maxLength={useRecovery?19:6} aria-describedby={error?'login-error':undefined} value={code} onChange={e=>setCode(useRecovery?e.target.value.toUpperCase().replace(/[^A-Z2-9-]/g,'').slice(0,19):e.target.value.replace(/\D/g,'').slice(0,6))} placeholder={useRecovery?'ABCD-EFGH-JKLM-NPQR':'000000'} required/></div><button type="button" className="login-recovery-toggle" disabled={loading} onClick={()=>{setUseRecovery(value=>!value);setCode('');setError('');}}>{useRecovery?'Usar código do autenticador':'Perdi acesso ao autenticador — usar código de recuperação'}</button></div>}
    {error&&<div id="login-error" className="error" role="alert">{error}</div>}
    <button type="submit" className="btn btn-primary" style={{width:'100%',marginTop:14}} disabled={loading||Boolean(stage==='mfa'&&(useRecovery?code.replace(/-/g,'').length!==16:code.length!==6))}>{loading?(stage==='password'?'Entrando...':'Verificando...'):(stage==='password'?'Continuar':useRecovery?'Usar código e entrar':'Verificar e entrar')}</button>
    {stage==='mfa'&&<button type="button" className="btn" style={{width:'100%',marginTop:10}} disabled={loading} onClick={()=>{setStage('password');setCode('');setUseRecovery(false);setError('');}}>Voltar e digitar a senha novamente</button>}
    <a href="/" className="muted" style={{display:'block',textAlign:'center',marginTop:18,fontSize:'.82rem'}}>← Voltar ao catálogo</a>
  </form></main>;
}
