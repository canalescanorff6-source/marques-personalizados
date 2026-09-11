import crypto from 'crypto';
import { consumeDistributedRateLimit } from './db';

import { sameOriginBoundary } from './request-origin';
import { isJsonContentType,readTextBodyWithinLimit } from './request-limits';
import { distributedRateBuckets,strictDistributedRateScope } from './rate-limit-policy';

function firstHeaderValue(value:string|null){return value?.split(',')[0]?.trim()||'';}
export function sameOriginRequest(request:Request){return sameOriginBoundary(request);}

type Bucket={count:number;reset:number}; const buckets=new Map<string,Bucket>();
type RateLimitResult={allowed:boolean;remaining:number;degraded?:boolean};
const distributedRateState={failures:0,openUntil:0};
const DISTRIBUTED_RATE_BREAKER_MS=5_000;
const DISTRIBUTED_RATE_FAILURE_THRESHOLD=3;
export function rateLimit(key:string,limit:number,windowMs:number):RateLimitResult{const now=Date.now();if(buckets.size>2000){for(const[k,b]of buckets)if(b.reset<=now)buckets.delete(k);}const b=buckets.get(key);if(!b||b.reset<=now){buckets.set(key,{count:1,reset:now+windowMs});return{allowed:true,remaining:limit-1};}if(b.count>=limit)return{allowed:false,remaining:0};b.count++;return{allowed:true,remaining:Math.max(0,limit-b.count)};}
export function clientIp(request:Request){return firstHeaderValue(request.headers.get('x-forwarded-for'))||firstHeaderValue(request.headers.get('x-real-ip'))||'unknown';}
function pseudonym(value:string){const secret=process.env.SESSION_SECRET||'local-development-only';return crypto.createHmac('sha256',secret).update(value).digest('hex');}
async function consumeDistributedBucket(scope:string,hash:string,limit:number,windowMs:number){return consumeDistributedRateLimit(scope,hash,limit,windowMs);}
export async function protectedRateLimit(request:Request,scope:string,limit:number,windowMs:number):Promise<RateLimitResult>{
  const hash=pseudonym(clientIp(request));const key=`${scope}:${hash}`;const now=Date.now();
  const distributedExpected=Boolean(process.env.DATABASE_URL);const strict=process.env.NODE_ENV==='production'&&strictDistributedRateScope(scope);
  if(!distributedExpected){if(strict)return{allowed:false,remaining:0,degraded:true};return rateLimit(key,limit,windowMs);}
  if(distributedRateState.openUntil>now){if(strict)return{allowed:false,remaining:0,degraded:true};return{...rateLimit(key,limit,windowMs),degraded:true};}
  try{
    let clientResult:RateLimitResult={allowed:true,remaining:Math.max(0,limit-1)};
    for(const bucket of distributedRateBuckets(scope,limit,strict)){
      // O bucket global de Admin independe do IP. Mesmo que X-Forwarded-For seja
      // pulverizado/spoofado por uma borda mal configurada, o brute force total continua limitado.
      const subjectHash=bucket.subject==='client'?hash:pseudonym(`global:${scope}`);
      const result=await consumeDistributedBucket(bucket.scope,subjectHash,bucket.limit,windowMs);
      if(bucket.subject==='client')clientResult=result;
      if(!result.allowed){distributedRateState.failures=0;distributedRateState.openUntil=0;return{allowed:false,remaining:0};}
    }
    distributedRateState.failures=0;distributedRateState.openUntil=0;
    return clientResult;
  }catch{
    distributedRateState.failures++;
    if(distributedRateState.failures>=DISTRIBUTED_RATE_FAILURE_THRESHOLD)distributedRateState.openUntil=now+DISTRIBUTED_RATE_BREAKER_MS;
    if(strict)return{allowed:false,remaining:0,degraded:true};
    return{...rateLimit(key,limit,windowMs),degraded:true};
  }
}
export async function readJsonBody(request:Request,maxBytes=64_000):Promise<Record<string,unknown>>{
  if(!isJsonContentType(request))throw new Error('UNSUPPORTED_MEDIA_TYPE');
  const text=await readTextBodyWithinLimit(request,maxBytes);
  try{
    const parsed:unknown=text?JSON.parse(text):{};
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('INVALID_JSON');
    return parsed as Record<string,unknown>;
  }catch(error){if(error instanceof Error&&error.message==='INVALID_JSON')throw error;throw new Error('INVALID_JSON');}
}

export function isUuid(value:string){return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);}
