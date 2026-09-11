import { advertisedContentLength,exceedsAdvertisedBodyLimit,isMultipartFormData,readTextBodyWithinLimit } from '../lib/request-limits.ts';
const failures=[];const expect=(condition,label)=>{if(!condition)failures.push(label);};
const request=headers=>new Request('https://catalogo.example/api/admin/upload',{method:'POST',headers,body:'x'});
expect(advertisedContentLength(request({}))===1||advertisedContentLength(request({}))===null,'Request pode calcular Content-Length internamente ou deixá-lo ausente');
const explicit=new Request('https://catalogo.example/api/admin/upload',{method:'POST',headers:{'content-length':'9000000'},body:'x'});
expect(exceedsAdvertisedBodyLimit(explicit,8_912_896),'Content-Length acima do teto deve ser rejeitado antes do parser multipart');
const malformed=new Request('https://catalogo.example/api/admin/upload',{method:'POST',headers:{'content-length':'NaN'},body:'x'});
expect(exceedsAdvertisedBodyLimit(malformed,8_912_896),'Content-Length malformado deve falhar fechado');
const multipart=new Request('https://catalogo.example/api/admin/upload',{method:'POST',headers:{'content-type':'multipart/form-data; boundary=----MarquesBoundary'},body:'x'});
expect(isMultipartFormData(multipart),'multipart com boundary deve ser aceito');
const noBoundary=new Request('https://catalogo.example/api/admin/upload',{method:'POST',headers:{'content-type':'multipart/form-data'},body:'x'});
expect(!isMultipartFormData(noBoundary),'multipart sem boundary deve ser rejeitado');
const json=new Request('https://catalogo.example/api/admin/upload',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
expect(!isMultipartFormData(json),'content-type diferente deve ser rejeitado');

const exact=new Request('https://catalogo.example/api/test',{method:'POST',body:'ábc'});
expect(await readTextBodyWithinLimit(exact,4)==='ábc','limite streaming deve contar bytes UTF-8, não apenas caracteres');
let produced=0,cancelled=false;
const oversizedStream=new ReadableStream({
  pull(controller){produced++;controller.enqueue(new Uint8Array(1024));if(produced>=20)controller.close();},
  cancel(){cancelled=true;}
});
const chunked=new Request('https://catalogo.example/api/test',{method:'POST',body:oversizedStream,duplex:'half'});
let oversized=false;try{await readTextBodyWithinLimit(chunked,4096);}catch(error){oversized=error instanceof Error&&error.message==='PAYLOAD_TOO_LARGE';}
expect(oversized,'corpo chunked sem Content-Length deve ser interrompido assim que ultrapassa o teto');
expect(produced<20,'leitor não pode materializar o restante do stream após exceder o teto');
expect(cancelled,'stream excedente deve ser cancelado para interromper ingestão adicional');

if(failures.length){console.error(`Request Limits Self-Test: FALHOU (${failures.length})`);for(const f of failures)console.error('- '+f);process.exit(1);}
console.log('Request Limits Self-Test: OK — multipart e JSON streaming falham fechado antes de materializar payload excedente.');
