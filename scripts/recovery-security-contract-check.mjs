import fs from 'node:fs';
const errors=[];const read=file=>fs.readFileSync(file,'utf8');
const recovery=read('lib/recovery-codes.ts');
for(const [pattern,label] of [
  [/randomBytes\(/,'códigos precisam de entropia criptográfica'],
  [/createHmac\('sha256'/,'códigos precisam ser persistidos como HMAC-SHA256'],
  [/SESSION_SECRET/,'hash precisa usar segredo exclusivamente server-side'],
  [/generateAdminRecoveryCodes/,'gerador de códigos ausente'],
])if(!pattern.test(recovery))errors.push(`recovery-codes: ${label}`);
const schema=read('sql/schema.sql').replace(/\s+/g,' ').toLowerCase();
for(const token of ['create table if not exists admin_mfa_recovery_codes','code_hash text not null unique','used_at timestamptz','create table if not exists admin_known_devices','device_hash text not null unique','create table if not exists admin_security_events','acknowledged_at timestamptz','auth_method text not null default \'password\''])if(!schema.includes(token))errors.push(`schema sem contrato de recuperação/dispositivo: ${token}`);
const db=read('lib/db.ts');
for(const [pattern,label] of [
  [/UPDATE admin_mfa_recovery_codes SET used_at=now\(\) WHERE code_hash=\$1 AND used_at IS NULL RETURNING id/,'consumo do código precisa ser atômico e de uso único'],
  [/DELETE FROM admin_mfa_recovery_codes/,'rotação deve invalidar conjunto anterior'],
  [/registerAdminKnownDevice/,'registro persistente de dispositivo ausente'],
  [/UPDATE admin_sessions SET revoked_at=COALESCE\(revoked_at,now\(\)\) WHERE device_hash=\$1/,'remoção de dispositivo deve encerrar sessões vinculadas'],
  [/admin_security_events/,'histórico de eventos de segurança ausente'],
])if(!pattern.test(db))errors.push(`db: ${label}`);
const auth=read('lib/auth.ts');
for(const [pattern,label] of [
  [/catalog_admin_device/,'cookie persistente de dispositivo ausente'],
  [/DEVICE_MAX_AGE=60\*60\*24\*180/,'identificador de dispositivo deve ter expiração definida'],
  [/httpOnly:true/,'cookie de dispositivo precisa ser HttpOnly'],
  [/digest\('admin-device'/,'ID bruto do dispositivo não deve ser persistido'],
  [/registerAdminKnownDevice/,'login deve registrar/reconhecer dispositivo'],
  [/eventType:'new_device_login'/,'novo dispositivo precisa gerar alerta'],
  [/authMethod:options\.authMethod/,'sessão deve registrar método de autenticação'],
])if(!pattern.test(auth))errors.push(`auth: ${label}`);
const verify=read('app/api/admin/mfa/verify/route.ts');
for(const [pattern,label] of [
  [/recovery_code/,'login precisa aceitar código de recuperação'],
  [/consumeAdminRecoveryCode\(hashAdminRecoveryCode\(recoveryCode\)\)/,'código precisa ser consumido antes da sessão'],
  [/authMethod:'recovery'/,'sessão por recuperação precisa ser identificada'],
])if(!pattern.test(verify))errors.push(`mfa verify: ${label}`);
const route=read('app/api/admin/security/route.ts');
for(const [pattern,label] of [
  [/export async function GET/,'central precisa expor visão de segurança'],
  [/rotate_recovery_codes/,'rotação de códigos ausente'],
  [/verifyAdminTotpCode\(code\)/,'rotação precisa revalidar TOTP atual'],
  [/consumeAdminMfaStep\(step\)/,'revalidação TOTP precisa impedir replay'],
  [/acknowledge_events/,'alertas precisam poder ser reconhecidos'],
  [/export async function DELETE/,'dispositivo conhecido precisa poder ser removido'],
  [/sameOriginRequest\(request\)/,'mutações da central precisam validar origem'],
])if(!pattern.test(route))errors.push(`security API: ${label}`);
const ui=read('components/admin/SecurityCenter.tsx');for(const token of ['Códigos de recuperação','Dispositivos reconhecidos','Alertas de segurança','Salve estes códigos agora'])if(!ui.includes(token))errors.push(`SecurityCenter sem ${token}`);
const login=read('app/admin/login/page.tsx');if(!login.includes('usar código de recuperação')||!login.includes('recovery_code'))errors.push('login não oferece recuperação MFA ao administrador');
const banner=read('components/admin/SecurityAlertBanner.tsx');if(!banner.includes('alerta(s) de segurança'))errors.push('painel principal não sinaliza alertas de segurança');
if(errors.length){console.error(`Recovery Security Contract: ${errors.length} problema(s)`);for(const error of errors)console.error(`- ${error}`);process.exit(1);}console.log('Recovery Security Contract: OK (uso único + dispositivos reconhecidos + alertas protegidos).');
