import { contentAddressedMediaKey } from '../lib/media-key.ts';
const failures=[];const expect=(condition,label)=>{if(!condition)failures.push(label);};
const bytes=new TextEncoder().encode('mesmo-conteudo');
const a=contentAddressedMediaKey(bytes,'image/png');
const b=contentAddressedMediaKey(bytes,'image/png');
const c=contentAddressedMediaKey(new TextEncoder().encode('outro-conteudo'),'image/png');
expect(a.key===b.key,'retry do mesmo arquivo deve convergir para a mesma chave');
expect(a.digest===b.digest,'digest deve ser determinístico');
expect(a.key!==c.key,'conteúdos diferentes não podem compartilhar a mesma chave');
expect(/^catalog\/sha256\/[0-9a-f]{2}\/[0-9a-f]{64}\.png$/.test(a.key),'chave deve ser content-addressed por SHA-256');
let unsupported='';try{contentAddressedMediaKey(bytes,'image/gif');}catch(error){unsupported=error instanceof Error?error.message:String(error);}expect(unsupported==='UNSUPPORTED_MEDIA_TYPE','tipo fora da allowlist deve falhar fechado');
if(failures.length){console.error(`Replay Safety Self-Test: FALHOU (${failures.length})`);for(const failure of failures)console.error('- '+failure);process.exit(1);}
console.log('Replay Safety Self-Test: OK — upload repetido converge para a mesma chave SHA-256.');
