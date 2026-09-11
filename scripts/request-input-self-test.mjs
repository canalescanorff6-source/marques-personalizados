import { classifyRequestInputFailure } from '../lib/http-errors.ts';
import { isJsonContentType,readBytesBodyWithinLimit,readMultipartFormDataWithinLimit,readTextBodyWithinLimit } from '../lib/request-limits.ts';
const failures=[];const expect=(condition,label)=>{if(!condition)failures.push(label);};
const req=contentType=>new Request('https://catalogo.example/api/test',{method:'POST',headers:contentType?{'content-type':contentType}:{},body:'{}'});
expect(isJsonContentType(req('application/json')),'application/json deve ser aceito');
expect(isJsonContentType(req('application/json; charset=utf-8')),'application/json com charset deve ser aceito');
expect(isJsonContentType(req('application/vnd.marques+json')),'media type +json deve ser aceito');
expect(!isJsonContentType(req('text/plain')),'text/plain deve ser rejeitado por endpoints JSON');
expect(!isJsonContentType(req('application/x-www-form-urlencoded')),'form-urlencoded deve ser rejeitado por endpoints JSON');
expect(!isJsonContentType(req('')),'Content-Type ausente deve ser rejeitado por endpoints JSON');

const enc=new TextEncoder();
function chunked(chunks,headers={}){return new Request('https://catalogo.example/api/test',{method:'POST',headers,body:new ReadableStream({start(controller){for(const chunk of chunks)controller.enqueue(enc.encode(chunk));controller.close();}}),duplex:'half'});}
let overflow='';try{await readBytesBodyWithinLimit(chunked(['1234','5678']),6);}catch(error){overflow=error instanceof Error?error.message:String(error);}expect(overflow==='PAYLOAD_TOO_LARGE','stream chunked deve ser interrompido antes de materializar acima do limite');
expect(await readTextBodyWithinLimit(chunked(['abc','def']),6)==='abcdef','texto limitado deve preservar conteúdo dentro do teto');
const form=new FormData();form.append('file',new Blob(['abc'],{type:'text/plain'}),'a.txt');const formRequest=new Request('https://catalogo.example/api/upload',{method:'POST',body:form});const parsedForm=await readMultipartFormDataWithinLimit(formRequest,4096);expect(parsedForm.get('file') instanceof File,'multipart dentro do limite deve ser parseado após bounded read');
let multipartOverflow='';const bigForm=new FormData();bigForm.append('file',new Blob(['x'.repeat(2048)],{type:'text/plain'}),'big.txt');try{await readMultipartFormDataWithinLimit(new Request('https://catalogo.example/api/upload',{method:'POST',body:bigForm}),512);}catch(error){multipartOverflow=error instanceof Error?error.message:String(error);}expect(multipartOverflow==='PAYLOAD_TOO_LARGE','multipart deve falhar fechado antes do parser quando excede o teto');
expect(classifyRequestInputFailure(new Error('INVALID_JSON'))?.status===400,'JSON inválido deve ser 400');
expect(classifyRequestInputFailure(new Error('PAYLOAD_TOO_LARGE'))?.status===413,'payload excedente deve ser 413');
expect(classifyRequestInputFailure(new Error('UNSUPPORTED_MEDIA_TYPE'))?.status===415,'media type incorreto deve ser 415');
expect(classifyRequestInputFailure(new Error('DATABASE_DOWN'))===null,'falha de infraestrutura não pode ser reclassificada como erro do cliente');
if(failures.length){console.error(`Request Input Self-Test: FALHOU (${failures.length})`);for(const failure of failures)console.error('- '+failure);process.exit(1);}
console.log('Request Input Self-Test: OK — JSON/multipart usam bounded ingress real e falhas de entrada ficam fora dos incidentes 5xx.');
