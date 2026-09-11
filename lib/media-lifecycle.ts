export const MEDIA_LIFECYCLE_LEASE_SECONDS=300;
export const MEDIA_DELETE_STUCK_MINUTES=15;

export type MediaLifecycleOperation='delete'|'upload';
export type MediaLifecycleLease=
  |{state:'acquired';token:string;operation:MediaLifecycleOperation;expires_at:string}
  |{state:'busy';operation:MediaLifecycleOperation;expires_at:string}
  |{state:'in_use'};

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseMediaLifecycleLease(value:unknown):MediaLifecycleLease{
  const row=value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
  const state=String(row.state||'');
  if(state==='in_use')return{state:'in_use'};
  const operation=String(row.operation||'') as MediaLifecycleOperation;
  const expiresAt=String(row.expires_at||'');
  if(!['delete','upload'].includes(operation)||!expiresAt||Number.isNaN(Date.parse(expiresAt)))throw new Error('MEDIA_LIFECYCLE_RESULT_INVALID');
  if(state==='busy')return{state:'busy',operation,expires_at:new Date(expiresAt).toISOString()};
  const token=String(row.token||'');
  if(state==='acquired'&&uuid.test(token))return{state:'acquired',token,operation,expires_at:new Date(expiresAt).toISOString()};
  throw new Error('MEDIA_LIFECYCLE_RESULT_INVALID');
}

export function mediaLifecycleRetryAfterSeconds(expiresAt:string,now=Date.now()){
  const expiry=Date.parse(expiresAt);if(!Number.isFinite(expiry))return 5;
  return Math.max(1,Math.min(300,Math.ceil((expiry-now)/1000)));
}

export function mediaLifecycleErrorCode(error:unknown){
  // Nunca persista a mensagem arbitrária de uma exceção externa: ela pode conter bucket,
  // URL ou outro contexto operacional. Só nomes/códigos já estruturados atravessam o boundary.
  if(error instanceof Error){
    const name=String(error.name||'').trim();
    if(name&&name!=='Error'){
      const code=name.toUpperCase().replace(/[^A-Z0-9_:-]+/g,'_').slice(0,80);
      if(code)return code;
    }
    const message=String(error.message||'').trim();
    if(/^[A-Z][A-Z0-9_:-]{0,79}$/.test(message))return message;
    return 'MEDIA_LIFECYCLE_FAILURE';
  }
  const raw=String(error||'').trim();
  if(/^[A-Z][A-Z0-9_:-]{0,79}$/.test(raw))return raw;
  return 'MEDIA_LIFECYCLE_FAILURE';
}
