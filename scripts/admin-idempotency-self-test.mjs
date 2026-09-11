import { adminCreateIdFromKey,assertIdempotentReplay,IdempotencyConflictError,InvalidIdempotencyKeyError,IdempotencyKeyRequiredError,requireAdminCreateIdempotencyKey } from '../lib/idempotency.ts';
import { fetchJson,registerAdminReauthHandler } from '../lib/client.ts';

const failures=[];const expect=(condition,label)=>{if(!condition)failures.push(label);};
const key='018f8f2e-7d6b-7c00-8000-000000000001';
try{requireAdminCreateIdempotencyKey(new Request('https://example.test/api/admin/products'));failures.push('chave ausente deveria falhar');}catch(error){expect(error instanceof IdempotencyKeyRequiredError,'chave ausente precisa gerar IdempotencyKeyRequiredError');}
try{requireAdminCreateIdempotencyKey(new Request('https://example.test/api/admin/products',{headers:{'idempotency-key':'abc'}}));failures.push('chave inválida deveria falhar');}catch(error){expect(error instanceof InvalidIdempotencyKeyError,'chave inválida precisa gerar InvalidIdempotencyKeyError');}
expect(requireAdminCreateIdempotencyKey(new Request('https://example.test/api/admin/products',{headers:{'idempotency-key':key.toUpperCase()}}))===key,'chave válida deve ser normalizada');
const productId=adminCreateIdFromKey('product',key),productRetryId=adminCreateIdFromKey('product',key),categoryId=adminCreateIdFromKey('category',key);
expect(productId===productRetryId,'mesma tentativa deve gerar o mesmo UUID');expect(productId!==categoryId,'escopos diferentes não podem compartilhar UUID determinístico');expect(/^[0-9a-f-]{36}$/.test(productId),'UUID determinístico deve ter formato canônico');
assertIdempotentReplay('product',{b:2,a:1,when:'2026-09-10T12:00:00Z'},{when:'2026-09-10T12:00:00.000Z',a:1,b:2});
try{assertIdempotentReplay('product',{name:'A'},{name:'B'});failures.push('reuso com payload diferente deveria falhar');}catch(error){expect(error instanceof IdempotencyConflictError,'payload diferente precisa gerar IdempotencyConflictError');}

const originalFetch=globalThis.fetch;let calls=[];
try{
  let mode='fail';
  globalThis.fetch=async(input,init={})=>{const headers=new Headers(init.headers);calls.push({url:String(input),key:headers.get('idempotency-key'),method:String(init.method||'GET')});if(mode==='fail')throw new TypeError('network down');return Response.json({product:{id:'ok'}},{status:201});};
  const createInit={method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({slug:'retry-safe'})};
  try{await fetchJson('/api/admin/products',createInit,50);}catch{}
  expect(calls.length===2,'POST idempotente deve tentar novamente uma vez em falha transitória');expect(Boolean(calls[0]?.key)&&calls[0]?.key===calls[1]?.key,'retries automáticos precisam reutilizar a mesma Idempotency-Key');const uncertainKey=calls[0]?.key;
  mode='success';calls=[];await fetchJson('/api/admin/products',createInit,50);expect(calls.length===1&&calls[0]?.key===uncertainKey,'retry manual após resultado incerto deve reutilizar a mesma chave pendente');
  calls=[];await fetchJson('/api/admin/products',createInit,50);expect(calls.length===1&&Boolean(calls[0]?.key)&&calls[0]?.key!==uncertainKey,'após sucesso confirmado, nova criação igual deve receber chave nova');

  mode='fail';calls=[];try{await fetchJson('/api/admin/restore?action=apply',{method:'POST',body:'{}'},50);}catch{}
  expect(calls.length===1,'POST crítico sem garantia de idempotência não pode receber retry automático');expect(calls[0]?.key===null,'POST crítico não deve receber Idempotency-Key automática');

  let reauthCalls=0;registerAdminReauthHandler(async()=>{reauthCalls++;return true;});
  globalThis.fetch=async()=>Response.json({error:'Precondição ausente.'},{status:428});
  try{await fetchJson('/api/admin/products/00000000-0000-4000-8000-000000000001',{method:'PATCH',headers:{'content-type':'application/json'},body:'{}'},50);}catch{}
  expect(reauthCalls===0,'HTTP 428 sem reauth_required não pode abrir step-up MFA');
  let responses=0;globalThis.fetch=async()=>{responses++;return responses===1?Response.json({error:'Reautenticação necessária.',reauth_required:true},{status:428}):Response.json({ok:true});};
  const result=await fetchJson('/api/admin/security',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'rotate_recovery_codes'})},50);expect(Boolean(result)&&reauthCalls===1,'step-up MFA deve ocorrer somente com reauth_required=true');
}finally{globalThis.fetch=originalFetch;registerAdminReauthHandler(null);}

if(failures.length){console.error(`Admin Idempotency Self-Test: FALHOU (${failures.length})`);for(const failure of failures)console.error('- '+failure);process.exit(1);}
console.log('Admin Idempotency Self-Test: OK — retries incertos convergem e 428 de precondição não dispara MFA indevido.');
