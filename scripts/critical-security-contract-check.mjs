import fs from 'node:fs';
const errors=[];const read=file=>fs.readFileSync(file,'utf8');

const schema=read('sql/schema.sql').replace(/\s+/g,' ').toLowerCase();
for(const token of ['last_reauth_at timestamptz','critical_reauth','critical_action','security_webhook_failed'])if(!schema.includes(token))errors.push(`schema V6.18 ausente: ${token}`);

const db=read('lib/db.ts');
for(const [pattern,label] of [
  [/markAdminSessionReauthenticated/,'persistência da reautenticação ausente'],
  [/last_reauth_at=now\(\)/,'reautenticação precisa atualizar timestamp server-side'],
  [/hasRecentAdminReauth/,'consulta de reautenticação recente ausente'],
  [/last_reauth_at>=now\(\)-make_interval\(secs=>\$2::int\)/,'janela curta de step-up precisa ser validada no banco'],
])if(!pattern.test(db))errors.push(`db: ${label}`);

const reauth=read('app/api/admin/reauth/route.ts');
for(const [pattern,label] of [
  [/isAdmin\(\)/,'reauth precisa exigir sessão admin'],
  [/sameOriginRequest\(request\)/,'reauth precisa validar origem'],
  [/protectedRateLimit\(request,'admin-reauth'/,'reauth precisa de rate limit'],
  [/verifyAdminTotpCode\(code\)/,'reauth precisa validar TOTP'],
  [/consumeAdminMfaStep\(step\)/,'reauth precisa impedir replay TOTP'],
  [/markAdminSessionReauthenticated\(current\.sessionHash\)/,'reauth precisa ficar vinculada à sessão atual'],
])if(!pattern.test(reauth))errors.push(`reauth API: ${label}`);

const protectedRoutes=[
  'app/api/admin/backup/route.ts',
  'app/api/admin/sessions/route.ts',
  'app/api/admin/security/route.ts',
  'app/api/admin/media/route.ts',
  'app/api/admin/inquiries/[id]/route.ts',
  'app/api/admin/categories/[id]/route.ts',
  'app/api/admin/campaigns/[id]/route.ts',
  'app/api/admin/products/[id]/route.ts',
  'app/api/admin/settings/route.ts',
];
for(const file of protectedRoutes){
  const text=read(file);
  if(!/hasRecentAdminReauthentication\(\)/.test(text))errors.push(`${file}: ação crítica sem step-up`);
  if(!/status:428/.test(text))errors.push(`${file}: resposta de reautenticação necessária deve usar HTTP 428`);
}

const client=read('lib/client.ts');
for(const [pattern,label] of [
  [/registerAdminReauthHandler/,'cliente sem registrador de step-up'],
  [/error\.status===428&&error\.reauthRequired/,'cliente não deve confundir 428 de precondição com step-up MFA'],
  [/reauthRetried=true/,'cliente precisa impedir loop de retry'],
  [/requestOnce<T>\(input,requestInit,timeoutMs\)/,'cliente deve repetir exatamente a requisição preparada após confirmação'],
])if(!pattern.test(client))errors.push(`client: ${label}`);

const provider=read('components/admin/AdminReauthProvider.tsx');
for(const token of ['/api/admin/reauth','Código TOTP','Confirme sua identidade','Ação protegida'])if(!provider.includes(token))errors.push(`AdminReauthProvider sem ${token}`);

const alerts=read('lib/admin-security-alerts.ts');
for(const [pattern,label] of [
  [/ADMIN_SECURITY_WEBHOOK_URL/,'configuração de webhook ausente'],
  [/ADMIN_SECURITY_WEBHOOK_SECRET/,'segredo de assinatura ausente'],
  [/createHmac\('sha256'/,'payload precisa de HMAC-SHA256'],
  [/x-marques-signature/,'header de assinatura ausente'],
  [/x-marques-timestamp/,'timestamp anti-replay ausente'],
  [/delivery\.enabled&&!delivery\.sent&&!delivery\.skipped/,'eventos fora do filtro não podem ser tratados como falha'],
  [/setTimeout\(\(\)=>controller\.abort\(\),2_500\)/,'webhook precisa de timeout curto'],
  [/!url\.username&&!url\.password&&\(!production\|\|\(url\.protocol==='https:'&&safeExternalHostname\(url\.hostname\)&&secret\.length>=32\)\)/,'produção precisa exigir HTTPS, destino externo e segredo forte'],
])if(!pattern.test(alerts))errors.push(`alerts: ${label}`);
if(/ip_hash|x-forwarded-for|x-real-ip/.test(alerts))errors.push('alerts: payload externo não deve conter IP bruto/hash de IP');

const env=read('scripts/check-env.mjs');
if(!/ADMIN_SECURITY_WEBHOOK_SECRET com pelo menos 32 caracteres/.test(env))errors.push('check-env deve exigir segredo forte quando webhook estiver ativo em produção');
if(!/ADMIN_SECURITY_WEBHOOK_URL HTTPS válido/.test(env))errors.push('check-env deve exigir webhook HTTPS em produção');

const dashboard=read('components/AdminDashboard.tsx');
if(!dashboard.includes('AdminReauthProvider'))errors.push('AdminDashboard não está envolvido pelo provider de step-up');

if(errors.length){console.error(`Critical Security Contract: ${errors.length} problema(s)`);for(const error of errors)console.error(`- ${error}`);process.exit(1);}
console.log('Critical Security Contract: OK (step-up + retry seguro + webhook assinado).');
