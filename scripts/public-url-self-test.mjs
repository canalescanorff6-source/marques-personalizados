import fs from 'node:fs';
import { isSafeExternalHttpsUrl,isSafePublicUrl,isSafeRootRelativeUrl,normalizeExternalHttpsUrl,normalizePublicUrl,normalizeSiteOrigin } from '../lib/public-url.ts';

const failures=[];
const expect=(condition,label)=>{if(!condition)failures.push(label);};
expect(isSafeRootRelativeUrl('/catalogo'),'caminho interno deve ser aceito');
expect(!isSafeRootRelativeUrl('//evil.example/path'),'URL protocol-relative deve ser rejeitada');
expect(!isSafeRootRelativeUrl('/\\evil.example'),'backslash em caminho deve ser rejeitada');
expect(isSafeExternalHttpsUrl('https://example.com/path'),'HTTPS externo deve ser aceito');
expect(!isSafeExternalHttpsUrl('http://example.com'),'HTTP externo deve ser rejeitado');
expect(!isSafeExternalHttpsUrl('https://user:pass@example.com'),'credenciais embutidas devem ser rejeitadas');
expect(!isSafeExternalHttpsUrl('javascript:alert(1)'),'javascript: deve ser rejeitado');
expect(isSafePublicUrl(''),'vazio deve ser aceito para campo opcional');
expect(isSafePublicUrl('/tema/festa'),'navegação interna deve ser aceita');
expect(normalizePublicUrl('//evil.example')==='','normalização pública deve apagar protocol-relative');
expect(normalizeExternalHttpsUrl('http://example.com')==='','normalização externa deve apagar HTTP inseguro');
expect(normalizeSiteOrigin('https://example.com/')==='https://example.com','origem HTTPS deve normalizar slash final');
expect(normalizeSiteOrigin('https://example.com/path')==='','site URL com path deve ser rejeitada');
expect(normalizeSiteOrigin('http://example.com')==='','site URL HTTP deve ser rejeitada');

const validation=fs.readFileSync('lib/validation.ts','utf8');
for(const token of ['z.array(optionalPublicUrl)','image_url: optionalPublicUrl.nullable()','logo_url: optionalPublicUrl','instagram_url: optionalExternalHttpsUrl','announcement_link: optionalPublicUrl'])expect(validation.includes(token),`validation sem integração: ${token}`);
const config=fs.readFileSync('lib/config.ts','utf8');
for(const token of ['normalizeExternalHttpsUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL)','normalizeSiteOrigin(process.env.NEXT_PUBLIC_SITE_URL)'])expect(config.includes(token),`config sem normalização: ${token}`);
const db=fs.readFileSync('lib/db.ts','utf8');
for(const token of ['map(value=>normalizePublicUrl(value)).filter(Boolean)','function normalizeCategory','logo_url: normalizePublicUrl','instagram_url: normalizeExternalHttpsUrl','announcement_link: normalizePublicUrl'])expect(db.includes(token),`DB read boundary sem normalização: ${token}`);

if(failures.length){console.error(`Public URL Safety Self-Test: FALHOU (${failures.length})`);for(const f of failures)console.error('- '+f);process.exit(1);}
console.log('Public URL Safety Self-Test: OK — entrada, env e leitura de dados legados normalizam URLs públicas antes de renderizar.');
