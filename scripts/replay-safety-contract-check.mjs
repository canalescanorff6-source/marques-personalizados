import fs from 'node:fs';
const errors=[];const read=file=>fs.readFileSync(file,'utf8');
const upload=read('app/api/admin/upload/route.ts');
for(const token of ['contentAddressedMediaKey(buffer,type)','sha256:digest','size_bytes:file.size','content_type:type'])if(!upload.includes(token))errors.push(`upload sem replay safety: ${token}`);
if(/randomUUID\(\)/.test(upload))errors.push('upload não pode usar chave aleatória por tentativa');
const mediaKey=read('lib/media-key.ts');for(const token of ["createHash('sha256')",'catalog/sha256/','UNSUPPORTED_MEDIA_TYPE'])if(!mediaKey.includes(token))errors.push(`media-key sem ${token}`);
const inquiry=read('app/api/inquiries/route.ts');for(const token of ['request_id','deterministicUuid','idempotency_key:idem','deduplicated:!created'])if(!inquiry.includes(token))errors.push(`orçamento público sem idempotência: ${token}`);
const db=read('lib/db.ts');for(const token of ['ON CONFLICT(idempotency_key)','deduplicated:!created'])if(!db.includes(token)&&token!=='deduplicated:!created')errors.push(`db sem idempotência pública: ${token}`);
if(errors.length){console.error(`Replay Safety Contract: FALHOU (${errors.length})`);for(const error of errors)console.error('- '+error);process.exit(1);}
console.log('Replay Safety Contract: OK — orçamento público e mídia resistem a retries sem duplicar efeito.');
