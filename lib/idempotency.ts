import crypto from 'crypto';

export type AdminCreateScope='product'|'category'|'testimonial'|'faq'|'marketing_campaign'|'social_plan';

const IDEMPOTENCY_KEY_RE=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export class IdempotencyKeyRequiredError extends Error{
  constructor(){super('IDEMPOTENCY_KEY_REQUIRED');this.name='IdempotencyKeyRequiredError';}
}
export class InvalidIdempotencyKeyError extends Error{
  constructor(){super('INVALID_IDEMPOTENCY_KEY');this.name='InvalidIdempotencyKeyError';}
}
export class IdempotencyConflictError extends Error{
  constructor(scope:AdminCreateScope){super(`IDEMPOTENCY_KEY_REUSED:${scope}`);this.name='IdempotencyConflictError';}
}
export class CreateUniqueConflictError extends Error{
  constructor(scope:AdminCreateScope){super(`UNIQUE_CREATE_CONFLICT:${scope}`);this.name='CreateUniqueConflictError';}
}

export function requireAdminCreateIdempotencyKey(request:Request){
  const value=(request.headers.get('idempotency-key')||'').trim().toLowerCase();
  if(!value)throw new IdempotencyKeyRequiredError();
  if(value.length!==36||!IDEMPOTENCY_KEY_RE.test(value))throw new InvalidIdempotencyKeyError();
  return value;
}

export function adminCreateIdFromKey(scope:AdminCreateScope,key:string){
  const digest=crypto.createHash('sha256').update(`marques-admin-create-v1\0${scope}\0${key}`,'utf8').digest('hex').slice(0,32).split('');
  // UUID v5-compatible shape. The namespace is the explicit scope string above; no secret is required.
  digest[12]='5';
  digest[16]=((parseInt(digest[16],16)&3)|8).toString(16);
  const raw=digest.join('');
  return `${raw.slice(0,8)}-${raw.slice(8,12)}-${raw.slice(12,16)}-${raw.slice(16,20)}-${raw.slice(20)}`;
}

function normalizeCanonical(value:unknown):unknown{
  if(value===undefined)return null;
  if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(value)){
    const time=new Date(value).getTime();if(Number.isFinite(time))return new Date(time).toISOString();
  }
  if(Array.isArray(value))return value.map(normalizeCanonical);
  if(value&&typeof value==='object'){
    return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,normalizeCanonical(item)]));
  }
  return value;
}
export function canonicalIdempotencyPayload(value:unknown){return JSON.stringify(normalizeCanonical(value));}
export function assertIdempotentReplay(scope:AdminCreateScope,existing:unknown,requested:unknown){
  if(canonicalIdempotencyPayload(existing)!==canonicalIdempotencyPayload(requested))throw new IdempotencyConflictError(scope);
}

export function idempotencyHttpError(error:unknown):{status:number;message:string}|null{
  if(error instanceof IdempotencyKeyRequiredError)return{status:428,message:'Esta criação precisa de uma chave de idempotência. Atualize a página e tente novamente.'};
  if(error instanceof InvalidIdempotencyKeyError)return{status:400,message:'A chave de idempotência da criação é inválida.'};
  if(error instanceof IdempotencyConflictError)return{status:409,message:'Esta tentativa de criação já foi usada com dados diferentes. Atualize a tela e tente novamente.'};
  if(error instanceof CreateUniqueConflictError)return{status:409,message:'Já existe um cadastro que conflita com estes dados.'};
  return null;
}
