export type BackupFreshnessState='ok'|'missing'|'stale'|'unavailable';
export type BackupFreshness={ok:boolean;state:BackupFreshnessState;age_hours:number|null;max_age_hours:number;last_verified_at:string|null;object_key:string|null;bytes:number|null;envelope_sha256:string|null;destination_fingerprint:string|null};
export function normalizeBackupMaxAgeHours(value:unknown){const n=Number(value||36);if(!Number.isInteger(n)||n<24||n>720)return 36;return n;}
export function evaluateBackupFreshness(lastVerifiedAt:string|null|undefined,maxAgeHours=36,now=new Date()):BackupFreshness{
  const max=normalizeBackupMaxAgeHours(maxAgeHours);if(!lastVerifiedAt)return{ok:false,state:'missing',age_hours:null,max_age_hours:max,last_verified_at:null,object_key:null,bytes:null,envelope_sha256:null,destination_fingerprint:null};
  const ts=Date.parse(lastVerifiedAt);if(!Number.isFinite(ts))return{ok:false,state:'unavailable',age_hours:null,max_age_hours:max,last_verified_at:null,object_key:null,bytes:null,envelope_sha256:null,destination_fingerprint:null};
  const age=Math.max(0,(now.getTime()-ts)/3_600_000);return{ok:age<=max,state:age<=max?'ok':'stale',age_hours:Math.round(age*10)/10,max_age_hours:max,last_verified_at:new Date(ts).toISOString(),object_key:null,bytes:null,envelope_sha256:null,destination_fingerprint:null};
}
