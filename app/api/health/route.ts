import { checkDatabase, checkDataIntegrity, checkSchema, getOffsiteBackupFreshness, getRecoveryDrillFreshness, getMediaBackupFreshness, getMediaRecoveryDrillFreshness } from '@/lib/db';
import { healthDecision, safeErrorCode, timedProbe, type DependencyProbe, type IntegrityProbe, type SchemaProbe } from '@/lib/health-policy';
import { EXPECTED_SCHEMA_VERSION, getReleaseInfo } from '@/lib/release';
import { probeStorage, storageConfig } from '@/lib/storage';
export const dynamic='force-dynamic';
const noStore={'cache-control':'no-store, max-age=0'};

function dbFailure(result:Awaited<ReturnType<typeof timedProbe<Awaited<ReturnType<typeof checkDatabase>>>>>,configured=true):DependencyProbe{
  if(result.ok)return{ok:Boolean(result.value.ok),configured:Boolean(result.value.configured),state:result.value.ok?'ok':'unavailable',latency_ms:result.latency_ms};
  return{ok:false,configured,state:result.timed_out?'timeout':'unavailable',latency_ms:result.latency_ms,timed_out:result.timed_out,error_code:result.timed_out?'PROBE_TIMEOUT':safeErrorCode(result.error)};
}
export async function GET(request:Request){
  const u=new URL(request.url);const mode=u.searchParams.get('mode')||'ready';const release=getReleaseInfo();
  if(mode==='live')return Response.json({ok:true,mode:'live',service:'catalogo',release,time:new Date().toISOString()},{headers:noStore});
  const storageCfg=storageConfig();
  const storageTask=(mode==='deep'||storageCfg.required||storageCfg.invalid)?probeStorage(2200):Promise.resolve(storageCfg.partial?{ok:false,state:'partial-config' as const,configured:false,required:false,latency_ms:0,error_code:'PARTIAL_CONFIG'}:{ok:true,state:storageCfg.configured?'unchecked' as const:'not-configured' as const,configured:storageCfg.configured,required:false,latency_ms:0});
  const backupFreshnessTask=mode==='deep'?timedProbe(()=>getOffsiteBackupFreshness(),1800):Promise.resolve(null);
  const recoveryDrillTask=mode==='deep'?timedProbe(()=>getRecoveryDrillFreshness(),1800):Promise.resolve(null);
  const mediaBackupTask=mode==='deep'?timedProbe(()=>getMediaBackupFreshness(),1800):Promise.resolve(null);
  const mediaRecoveryDrillTask=mode==='deep'?timedProbe(()=>getMediaRecoveryDrillFreshness(),1800):Promise.resolve(null);
  const [dbRaw,schemaRaw,integrityRaw,storage,backupFreshnessRaw,recoveryDrillRaw,mediaBackupRaw,mediaRecoveryDrillRaw]=await Promise.all([
    timedProbe(()=>checkDatabase(),2200),
    timedProbe(()=>checkSchema(),2600),
    timedProbe(()=>checkDataIntegrity(),3200),
    storageTask,
    backupFreshnessTask,
    recoveryDrillTask,
    mediaBackupTask,
    mediaRecoveryDrillTask,
  ]);
  const database=dbFailure(dbRaw,Boolean(process.env.DATABASE_URL));
  const schema:SchemaProbe=schemaRaw.ok?{ok:Boolean(schemaRaw.value.ok&&schemaRaw.value.version>=EXPECTED_SCHEMA_VERSION),state:schemaRaw.value.ok&&schemaRaw.value.version>=EXPECTED_SCHEMA_VERSION?'ok':'stale',version:Number(schemaRaw.value.version||0),expected:EXPECTED_SCHEMA_VERSION,latency_ms:schemaRaw.latency_ms,configured:Boolean(process.env.DATABASE_URL)}:{ok:false,state:schemaRaw.timed_out?'timeout':'unavailable',version:0,expected:EXPECTED_SCHEMA_VERSION,latency_ms:schemaRaw.latency_ms,configured:Boolean(process.env.DATABASE_URL),timed_out:schemaRaw.timed_out,error_code:schemaRaw.timed_out?'PROBE_TIMEOUT':safeErrorCode(schemaRaw.error)};
  const integrity:IntegrityProbe=integrityRaw.ok?{ok:Boolean(integrityRaw.value.ok),state:integrityRaw.value.ok?'ok':'invalid',issues:Array.isArray(integrityRaw.value.issues)?integrityRaw.value.issues.slice(0,20):[],latency_ms:integrityRaw.latency_ms,configured:Boolean(process.env.DATABASE_URL)}:{ok:false,state:integrityRaw.timed_out?'timeout':'unavailable',issues:[],latency_ms:integrityRaw.latency_ms,configured:Boolean(process.env.DATABASE_URL),timed_out:integrityRaw.timed_out,error_code:integrityRaw.timed_out?'PROBE_TIMEOUT':safeErrorCode(integrityRaw.error)};
  const decision=healthDecision({database,schema,integrity,storage});
  const deep=mode==='deep';const backup_freshness=deep?(backupFreshnessRaw&&backupFreshnessRaw.ok?backupFreshnessRaw.value:{ok:false,state:'unavailable',age_hours:null,max_age_hours:Number(process.env.BACKUP_OFFSITE_MAX_AGE_HOURS||36),last_verified_at:null,object_key:null,bytes:null,envelope_sha256:null,destination_fingerprint:null}):undefined;const recovery_drill=deep?(recoveryDrillRaw&&recoveryDrillRaw.ok?recoveryDrillRaw.value:{ok:false,state:'unavailable',age_hours:null,max_age_hours:Number(process.env.RECOVERY_DRILL_MAX_AGE_HOURS||192),last_succeeded_at:null,backup_object_key:null,backup_sha256:null,duration_ms:null}):undefined;const media_backup=deep?(mediaBackupRaw&&mediaBackupRaw.ok?mediaBackupRaw.value:{ok:false,state:'unavailable',age_hours:null,max_age_hours:Number(process.env.MEDIA_BACKUP_MAX_AGE_HOURS||36),last_verified_at:null}):undefined;const media_recovery_drill=deep?(mediaRecoveryDrillRaw&&mediaRecoveryDrillRaw.ok?mediaRecoveryDrillRaw.value:{ok:false,state:'unavailable',age_hours:null,max_age_hours:Number(process.env.MEDIA_RECOVERY_DRILL_MAX_AGE_HOURS||192),last_succeeded_at:null,object_count:null,verified_bytes:null,duration_ms:null}):undefined;const ok=deep?decision.deepOk:decision.readinessOk;
  return Response.json({ok,mode:deep?'deep':'ready',service:'catalogo',release,degraded:decision.degraded||Boolean(deep&&backup_freshness&&!backup_freshness.ok),blockers:deep?decision.deepBlockers:decision.blockers,database,schema,integrity,storage,backup_freshness,recovery_drill,media_backup,media_recovery_drill,time:new Date().toISOString()},{status:ok?200:503,headers:noStore});
}
