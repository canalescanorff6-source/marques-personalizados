import fs from 'node:fs';
import path from 'node:path';

const errors=[];
const root=process.cwd();
const apiRoot=path.join(root,'app','api');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{const file=path.join(dir,entry.name);return entry.isDirectory()?walk(file):[file];});}
const routes=walk(apiRoot).filter(file=>file.endsWith('route.ts'));
const methods=text=>['GET','POST','PUT','PATCH','DELETE'].filter(method=>new RegExp(`export\\s+async\\s+function\\s+${method}\\b`).test(text));

for(const file of routes){
  const rel=path.relative(root,file).replaceAll('\\','/');
  const text=fs.readFileSync(file,'utf8');
  const routeMethods=methods(text);
  const admin=rel.startsWith('app/api/admin/');
  if(admin){
    const preAuth=['app/api/admin/login/route.ts','app/api/admin/mfa/verify/route.ts'].includes(rel);
    const login=rel==='app/api/admin/login/route.ts';
    if(!preAuth&&routeMethods.length&&!/\bisAdmin\s*\(/.test(text))errors.push(`${rel}: rota admin sem verificação isAdmin()`);
    if(preAuth&&!/\bprotectedRateLimit\s*\(/.test(text))errors.push(`${rel}: rota pré-auth sem rate limit protegido`);
    const mutating=routeMethods.some(method=>['POST','PUT','PATCH','DELETE'].includes(method));
    if(mutating&&!/\bsameOriginRequest\s*\(/.test(text))errors.push(`${rel}: mutação admin sem sameOriginRequest()`);
    if(login&&!/\bprotectedRateLimit\s*\(/.test(text))errors.push(`${rel}: login sem rate limit protegido`);
  }else{
    const mutating=routeMethods.some(method=>['POST','PUT','PATCH','DELETE'].includes(method));
    if(mutating&&!/\bsameOriginRequest\s*\(/.test(text))errors.push(`${rel}: mutação pública sem validação de origem`);
    if(mutating&&!/\bprotectedRateLimit\s*\(/.test(text))errors.push(`${rel}: mutação pública sem rate limit`);
  }
}

const auth=fs.readFileSync(path.join(root,'lib/auth.ts'),'utf8');
for(const [pattern,label] of [
  [/httpOnly:true/,'cookie admin precisa ser HttpOnly'],
  [/sameSite:'strict'/,'cookie admin precisa usar SameSite=Strict'],
  [/secure:process\.env\.NODE_ENV==='production'/,'cookie admin precisa ser Secure em produção'],
  [/createHmac\('sha256'/,'sessão precisa usar assinatura HMAC'],
  [/timingSafeEqual/,'comparação de credenciais/tokens precisa ser constante'],
])if(!pattern.test(auth))errors.push(`lib/auth.ts: ${label}`);

const security=fs.readFileSync(path.join(root,'lib/security.ts'),'utf8');
if(!/sameOriginBoundary\(request\)/.test(security))errors.push('lib/security.ts: sameOriginRequest precisa delegar ao boundary confiável');
const requestOrigin=fs.readFileSync(path.join(root,'lib/request-origin.ts'),'utf8');
for(const [pattern,label] of [
  [/sec-fetch-site/,'boundary precisa considerar Sec-Fetch-Site'],
  [/process\.env\.NEXT_PUBLIC_SITE_URL/,'produção precisa usar NEXT_PUBLIC_SITE_URL como autoridade'],
  [/new URL\(origin\)\.origin===expected/,'boundary precisa comparar a origem completa'],
  [/new URL\(referer\)\.origin===expected/,'boundary precisa ter fallback seguro por Referer'],
])if(!pattern.test(requestOrigin))errors.push(`lib/request-origin.ts: ${label}`);
if(/x-forwarded-host|x-forwarded-proto/i.test(requestOrigin))errors.push('lib/request-origin.ts: headers forwarded não podem definir autoridade CSRF');

const envCheck=fs.readFileSync(path.join(root,'scripts/check-env.mjs'),'utf8');
if(!/ADMIN_PASSWORD_HASH \(obrigatório em produção/.test(envCheck))errors.push('check-env: produção deve exigir ADMIN_PASSWORD_HASH');
if(!/ADMIN_TOTP_SECRET \(MFA\/TOTP obrigatório em produção/.test(envCheck))errors.push('check-env: produção deve exigir ADMIN_TOTP_SECRET');

if(errors.length){console.error(`Security Contract Check: ${errors.length} problema(s)`);for(const error of errors)console.error(`- ${error}`);process.exit(1);}
console.log(`Security Contract Check: OK (${routes.length} rotas de API auditadas).`);
