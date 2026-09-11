export function advertisedContentLength(request:Request){
  const raw=request.headers.get('content-length');
  if(raw===null||raw.trim()==='')return null;
  const value=raw.trim();
  if(!/^\d+$/.test(value))return Number.POSITIVE_INFINITY;
  const parsed=Number(value);
  return Number.isSafeInteger(parsed)?parsed:Number.POSITIVE_INFINITY;
}

export function exceedsAdvertisedBodyLimit(request:Request,maxBytes:number){
  const length=advertisedContentLength(request);
  return length!==null&&length>maxBytes;
}


export function isJsonContentType(request:Request){
  const raw=String(request.headers.get('content-type')||'').trim();
  if(!raw)return false;
  const mediaType=raw.split(';',1)[0]?.trim()||'';
  return /^application\/(?:[a-z0-9!#$&^_.+\-]+\+)?json$/i.test(mediaType);
}

export function isMultipartFormData(request:Request){
  const value=String(request.headers.get('content-type')||'').trim();
  return /^multipart\/form-data\s*;.*\bboundary=(?:"[^"]+"|[^;\s]+)(?:;|$)/i.test(value);
}

export async function readBytesBodyWithinLimit(request:Request,maxBytes:number){
  if(!Number.isSafeInteger(maxBytes)||maxBytes<0)throw new Error('INVALID_BODY_LIMIT');
  if(exceedsAdvertisedBodyLimit(request,maxBytes))throw new Error('PAYLOAD_TOO_LARGE');
  if(!request.body)return new Uint8Array();

  const reader=request.body.getReader();
  const chunks:Uint8Array[]=[];
  let total=0;
  try{
    while(true){
      const {done,value}=await reader.read();
      if(done)break;
      if(!value)continue;
      total+=value.byteLength;
      if(total>maxBytes){
        try{await reader.cancel('PAYLOAD_TOO_LARGE');}catch{}
        throw new Error('PAYLOAD_TOO_LARGE');
      }
      chunks.push(value);
    }
    const body=new Uint8Array(total);
    let offset=0;
    for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
    return body;
  }finally{
    try{reader.releaseLock();}catch{}
  }
}

export async function readTextBodyWithinLimit(request:Request,maxBytes:number){
  const bytes=await readBytesBodyWithinLimit(request,maxBytes);
  return new TextDecoder().decode(bytes);
}

export async function readMultipartFormDataWithinLimit(request:Request,maxBytes:number){
  if(!isMultipartFormData(request))throw new Error('INVALID_MULTIPART_CONTENT_TYPE');
  const bytes=await readBytesBodyWithinLimit(request,maxBytes);
  const contentType=request.headers.get('content-type');
  if(!contentType)throw new Error('INVALID_MULTIPART_CONTENT_TYPE');
  const bounded=new Request(request.url,{method:'POST',headers:{'content-type':contentType},body:bytes});
  try{return await bounded.formData();}catch{throw new Error('INVALID_MULTIPART_BODY');}
}
