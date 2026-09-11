import { normalizeExpectedUpdatedAt,requireExpectedUpdatedAt,requireExpectedVersion } from '../lib/concurrency.ts';
import { classifyRequestInputFailure } from '../lib/http-errors.ts';
const failures=[];const expect=(condition,label)=>{if(!condition)failures.push(label);};
const iso='2026-09-10T12:00:00.000Z';
expect(normalizeExpectedUpdatedAt(iso)===iso,'timestamp ISO válido deve ser preservado semanticamente');
expect(normalizeExpectedUpdatedAt('2026-09-10T09:00:00-03:00')===iso,'offset válido deve normalizar para UTC');
expect(normalizeExpectedUpdatedAt('')===null,'precondição vazia deve falhar');
expect(normalizeExpectedUpdatedAt('agora')===null,'precondição textual inválida deve falhar');
let required=false;try{requireExpectedUpdatedAt(undefined);}catch(error){required=error instanceof Error&&error.message==='PRECONDITION_REQUIRED';}
expect(required,'precondição ausente precisa falhar fechado');
expect(classifyRequestInputFailure(new Error('PRECONDITION_REQUIRED'))?.status===428,'precondição ausente deve mapear para HTTP 428');
expect(requireExpectedVersion('7')===7,'versão numérica válida deve ser normalizada');
let versionRequired=false;try{requireExpectedVersion(0);}catch(error){versionRequired=error instanceof Error&&error.message==='PRECONDITION_REQUIRED';}
expect(versionRequired,'versão ausente/inválida precisa falhar fechado');
if(failures.length){console.error(`Concurrency Self-Test: FALHOU (${failures.length})`);for(const f of failures)console.error('- '+f);process.exit(1);}
console.log('Concurrency Self-Test: OK — mutações versionadas exigem precondição temporal válida.');
