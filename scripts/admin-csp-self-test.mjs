import { buildAdminContentSecurityPolicy } from '../lib/admin-csp.ts';
const failures=[];const expect=(condition,label)=>{if(!condition)failures.push(label);};
const nonce='abcDEF0123+/=';
const prod=buildAdminContentSecurityPolicy(nonce,false);
const dev=buildAdminContentSecurityPolicy(nonce,true);
const scriptDirective=prod.split('; ').find(x=>x.startsWith('script-src '))||'';
expect(scriptDirective.includes(`'nonce-${nonce}'`),'script-src administrativo deve conter nonce por requisição');
expect(scriptDirective.includes("'strict-dynamic'"),'script-src administrativo deve usar strict-dynamic');
expect(!scriptDirective.includes("'unsafe-inline'"),'script-src administrativo não pode permitir unsafe-inline');
expect(!scriptDirective.includes("'unsafe-eval'"),'produção não pode permitir unsafe-eval');
expect((dev.split('; ').find(x=>x.startsWith('script-src '))||'').includes("'unsafe-eval'"),'desenvolvimento pode habilitar unsafe-eval para diagnóstico React');
for(const directive of ["object-src 'none'","base-uri 'self'","form-action 'self'","frame-src 'none'","frame-ancestors 'none'","connect-src 'self'"])expect(prod.includes(directive),`CSP admin sem ${directive}`);
let threw=false;try{buildAdminContentSecurityPolicy('');}catch{threw=true;}expect(threw,'CSP não deve ser criada sem nonce');
if(failures.length){console.error(`Admin CSP Self-Test: FALHOU (${failures.length})`);for(const f of failures)console.error('- '+f);process.exit(1);}
console.log('Admin CSP Self-Test: OK — scripts do painel exigem nonce e strict-dynamic em produção.');
