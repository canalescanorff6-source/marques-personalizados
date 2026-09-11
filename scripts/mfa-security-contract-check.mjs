import fs from 'node:fs';

const errors=[];
const read=file=>fs.readFileSync(file,'utf8');
const mfa=read('lib/mfa.ts');
for(const [pattern,label] of [
  [/createHmac\('sha1'/,'TOTP deve usar HMAC-SHA1 compatível com RFC 6238'],
  [/Math\.floor\(now\/1000\/STEP_SECONDS\)/,'TOTP deve usar janela temporal de 30 segundos'],
  [/\[step,step-1,step\+1\]/,'TOTP deve tolerar somente uma janela adjacente de relógio'],
  [/timingSafeEqual/,'comparação do código TOTP deve ser constante'],
  [/ADMIN_TOTP_SECRET/,'segredo TOTP deve vir exclusivamente de variável server-side'],
])if(!pattern.test(mfa))errors.push(`lib/mfa.ts: ${label}`);

const auth=read('lib/auth.ts');
for(const [pattern,label] of [
  [/catalog_admin_mfa_challenge/,'cookie de desafio MFA ausente'],
  [/MFA_MAX_AGE=5\*60/,'desafio MFA deve expirar em 5 minutos'],
  [/httpOnly:true/,'desafio MFA precisa ser HttpOnly'],
  [/sameSite:'strict'/,'desafio MFA precisa usar SameSite=Strict'],
  [/mfa\.required&&!options\.mfaVerified/,'sessão não pode ser criada sem MFA quando ele é obrigatório'],
  [/mfaVerifiedAt:options\.mfaVerified/,'sessão deve registrar evidência do segundo fator'],
  [/process\.env\.NODE_ENV==='production'&&!process\.env\.DATABASE_URL&&!allowCiStatelessAdmin\(\)/,'produção sem Neon deve falhar fechado'],
])if(!pattern.test(auth))errors.push(`lib/auth.ts: ${label}`);

const verify=read('app/api/admin/mfa/verify/route.ts');
for(const [pattern,label] of [
  [/sameOriginRequest\(request\)/,'verificação MFA precisa validar origem'],
  [/protectedRateLimit\(request,'admin-mfa',6,5\*60_000\)/,'verificação MFA precisa de rate limit dedicado'],
  [/hasValidAdminMfaChallenge\(\)/,'verificação MFA deve exigir desafio pós-senha'],
  [/verifyAdminTotpCode\(code\)/,'verificação MFA deve validar TOTP'],
  [/consumeAdminMfaStep\(step\)/,'verificação MFA deve impedir replay no Neon'],
  [/setAdminSession\(request,\{mfaVerified:true,authMethod:'totp'\}\)/,'sessão deve nascer apenas depois do segundo fator TOTP'],
])if(!pattern.test(verify))errors.push(`MFA verify route: ${label}`);

const login=read('app/api/admin/login/route.ts');
if(!/setAdminMfaChallenge\(\)/.test(login)||!/mfa_required:true/.test(login))errors.push('login deve emitir desafio e responder que MFA é necessário');
if(/setAdminSession\(request\)\s*;/.test(login))errors.push('login por senha não pode criar sessão produtiva diretamente');

const schema=read('sql/schema.sql').replace(/\s+/g,' ').toLowerCase();
for(const token of ['mfa_verified_at timestamptz','create table if not exists admin_mfa_used_steps','step bigint primary key','idx_admin_mfa_used_steps_cleanup'])if(!schema.includes(token))errors.push(`schema sem contrato MFA: ${token}`);
const db=read('lib/db.ts');
if(!/ON CONFLICT\(step\) DO NOTHING RETURNING step/.test(db))errors.push('replay TOTP precisa ser bloqueado atomicamente por chave única');
if(!/\(\$3=false OR mfa_verified_at IS NOT NULL\)/.test(db))errors.push('sessões sem evidência MFA devem ser rejeitadas quando requerido');

const env=read('scripts/check-env.mjs');
if(!/ADMIN_TOTP_SECRET \(MFA\/TOTP obrigatório em produção/.test(env))errors.push('preflight de produção deve exigir TOTP');
if(!/MARQUES_CI_STATELESS_AUTH deve permanecer vazio em produção/.test(env))errors.push('preflight deve rejeitar bypass de CI em produção');
if(!/GITHUB_ACTIONS==='true'&&process\.env\.MARQUES_CI_STATELESS_AUTH==='1'/.test(auth))errors.push('bypass stateless de E2E precisa ficar restrito ao GitHub Actions');
const ui=read('components/admin/SessionManager.tsx');if(!ui.includes("session.auth_method==='recovery'?'Recuperação':'2FA'"))errors.push('painel de sessões deve indicar evidência e método MFA');
const ci=read('.github/workflows/ci.yml');
for(const token of ['ADMIN_TOTP_SECRET','E2E_ADMIN_TOTP_SECRET','npm run check:mfa'])if(!ci.includes(token))errors.push(`CI sem cobertura MFA: ${token}`);

if(errors.length){console.error(`MFA Security Contract: ${errors.length} problema(s)`);for(const error of errors)console.error(`- ${error}`);process.exit(1);}
console.log('MFA Security Contract: OK (senha + TOTP + anti-replay protegidos).');
