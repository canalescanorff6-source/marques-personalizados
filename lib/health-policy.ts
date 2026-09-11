export type ProbeState='ok'|'unavailable'|'not-configured'|'partial-config'|'timeout'|'stale'|'invalid'|'unchecked';
export type DependencyProbe={
  ok:boolean;
  state:ProbeState;
  latency_ms:number;
  configured?:boolean;
  required?:boolean;
  timed_out?:boolean;
  error_code?:string;
};
export type SchemaProbe=DependencyProbe&{version:number;expected:number};
export type IntegrityProbe=DependencyProbe&{issues:string[]};
export type HealthInputs={database:DependencyProbe;schema:SchemaProbe;integrity:IntegrityProbe;storage:DependencyProbe};

export function healthDecision(input:HealthInputs){
  const blockers:string[]=[];
  if(!input.database.configured||!input.database.ok)blockers.push('database');
  if(!input.schema.ok||input.schema.version<input.schema.expected)blockers.push('schema');
  if(!input.integrity.ok)blockers.push('integrity');
  if(input.storage.required&&!input.storage.ok)blockers.push('storage');
  const readinessOk=blockers.length===0;
  const deepBlockers=[...blockers];
  if((input.storage.configured||input.storage.state==='partial-config'||input.storage.state==='invalid')&&!input.storage.ok&&!deepBlockers.includes('storage'))deepBlockers.push('storage');
  return {readinessOk,deepOk:deepBlockers.length===0,blockers,deepBlockers,degraded:readinessOk&&deepBlockers.length>0};
}

export async function timedProbe<T>(factory:()=>Promise<T>,timeoutMs:number):Promise<{ok:true;value:T;latency_ms:number;timed_out:false}|{ok:false;error:unknown;latency_ms:number;timed_out:boolean}>{
  const started=Date.now();let timer:ReturnType<typeof setTimeout>|undefined;
  try{
    const value=await Promise.race([
      factory(),
      new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Object.assign(new Error('PROBE_TIMEOUT'),{code:'PROBE_TIMEOUT'})),timeoutMs);}),
    ]);
    return {ok:true,value,latency_ms:Date.now()-started,timed_out:false};
  }catch(error){
    const code=error&&typeof error==='object'&&'code' in error?String((error as {code?:unknown}).code||''):'';
    return {ok:false,error,latency_ms:Date.now()-started,timed_out:code==='PROBE_TIMEOUT'};
  }finally{if(timer)clearTimeout(timer);}
}

export function safeErrorCode(error:unknown){
  if(!error||typeof error!=='object')return'UNKNOWN';
  const raw='name' in error?String((error as {name?:unknown}).name||''):'code' in error?String((error as {code?:unknown}).code||''):'';
  return raw.replace(/[^A-Za-z0-9_.-]/g,'').slice(0,64)||'UNKNOWN';
}
