import packageJson from '../package.json' with { type: 'json' };
import platformContract from '../platform-contract.json' with { type: 'json' };

export const APP_VERSION=packageJson.version;
export const EXPECTED_SCHEMA_VERSION=platformContract.schemaVersion;

function clean(value:string|undefined,max:number){
  return String(value||'').trim().replace(/[^A-Za-z0-9._:@/+\-]/g,'').slice(0,max);
}

export function getReleaseInfo(){
  const id=clean(process.env.APP_RELEASE_ID,80)||`v${APP_VERSION}`;
  const commit=clean(process.env.APP_RELEASE_COMMIT,64)||null;
  const raw=String(process.env.APP_DEPLOYED_AT||'').trim();
  const deployed_at=raw&&!Number.isNaN(Date.parse(raw))?new Date(raw).toISOString():null;
  return{version:APP_VERSION,id,commit,deployed_at};
}
