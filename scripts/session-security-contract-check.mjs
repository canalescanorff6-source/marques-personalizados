import fs from 'node:fs';
const errors=[];const read=file=>fs.readFileSync(file,'utf8');
const schema=read('sql/schema.sql').replace(/\s+/g,' ').toLowerCase();
for(const token of ['create table if not exists admin_sessions','session_hash text not null unique','device_label text','user_agent_hash text','ip_hash text','last_seen_at timestamptz','expires_at timestamptz','mfa_verified_at timestamptz','revoked_at timestamptz','idx_admin_sessions_active'])if(!schema.includes(token))errors.push(`schema sem contrato de sessão: ${token}`);
const auth=read('lib/auth.ts');
for(const [pattern,label] of [
  [/randomBytes\(24\)/,'ID de sessão deve ter alta entropia'],
  [/digest\('admin-session'/,'ID bruto da sessão não deve ser persistido'],
  [/verifyAdminSessionRecord\(parsed\.sessionHash,await currentUserAgentHash\(\),requireMfa\)/,'isAdmin deve consultar revogação, navegador e evidência MFA no banco'],
  [/headers\(\)/,'sessão deve obter User-Agent do request atual para vínculo de dispositivo'],
  [/createAdminSessionRecord\(/,'login deve registrar sessão no banco'],
  [/mfaVerifiedAt:options\.mfaVerified/,'sessão deve registrar quando o segundo fator foi validado'],
  [/revokeAdminSessionByHash\(parsed\.sessionHash\)/,'logout deve revogar sessão no banco'],
  [/allowCiStatelessAdmin\(\)/,'exceção stateless deve ser limitada ao CI'],
  [/if\(!process\.env\.DATABASE_URL\)return process\.env\.NODE_ENV!=='production'\|\|allowCiStatelessAdmin\(\)/,'fallback stateless deve falhar fechado em produção fora do CI'],
])if(!pattern.test(auth))errors.push(`auth: ${label}`);
const db=read('lib/db.ts');if(!/ORDER BY created_at DESC OFFSET 12/.test(db))errors.push('sessões ativas devem ter limite server-side para reduzir persistência indevida');
if(!/\(\$3=false OR mfa_verified_at IS NOT NULL\)/.test(db))errors.push('sessões antigas sem MFA devem ser rejeitadas quando o segundo fator é obrigatório');
const login=read('app/api/admin/login/route.ts');const mfaVerify=read('app/api/admin/mfa/verify/route.ts');if(!/setAdminMfaChallenge\(\)/.test(login))errors.push('login por senha deve iniciar desafio MFA');if(!/setAdminSession\(request,\{mfaVerified:true,authMethod:'totp'\}\)/.test(mfaVerify))errors.push('conclusão MFA deve registrar fingerprint/contexto e método da sessão');
const route=read('app/api/admin/sessions/route.ts');for(const [pattern,label] of [[/export async function GET/,'GET de sessões ausente'],[/export async function DELETE/,'revogação de sessão ausente'],[/revokeOtherAdminSessions/,'revogação das outras sessões ausente'],[/sameOriginRequest\(request\)/,'revogação precisa validar origem'],[/isAdmin\(\)/,'rota de sessões precisa exigir autenticação']])if(!pattern.test(route))errors.push(`sessions API: ${label}`);
const ui=read('components/admin/SessionManager.tsx');for(const token of ['/api/admin/sessions','Encerrar outras sessões','Sessão atual'])if(!ui.includes(token))errors.push(`SessionManager sem ${token}`);
const env=read('scripts/check-env.mjs');if(!/if\(!process\.env\.DATABASE_URL\)errors\.push\('DATABASE_URL'\)/.test(env))errors.push('preflight de produção deve exigir Neon para revogação server-side');
if(errors.length){console.error(`Session Security Contract: ${errors.length} problema(s)`);for(const e of errors)console.error(`- ${e}`);process.exit(1);}console.log('Session Security Contract: OK (sessões revogáveis e controle de dispositivos protegidos).');
