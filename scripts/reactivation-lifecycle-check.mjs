import fs from 'node:fs';
const errors=[];const read=file=>fs.readFileSync(file,'utf8');const platform=JSON.parse(read('platform-contract.json'));const need=(text,token,label)=>{if(!text.includes(token))errors.push(`${label}: ausente ${token}`);};
const db=read('lib/db.ts');const release=read('lib/release.ts');const deploy=read('scripts/deploy-gate.mjs');const manifest=read('scripts/release-manifest.mjs');const schema=read('sql/schema.sql');const route=read('app/api/admin/inquiries/reactivation/route.ts');const ui=read('components/admin/InquiryManager.tsx');const cursor=read('lib/reactivation-cursor.ts');const runtime=read('scripts/db-runtime-contract.mjs');const backup=read('scripts/backup-db.mjs');const ci=read('.github/workflows/ci.yml');const pkg=JSON.parse(read('package.json'));
for(const token of ['getInquiryReactivationWorkspace','markInquiryReactivationContact','inquiryReactivationCte','repurchase_contacted_at','repurchase_contact_year','repurchase_next_anniversary','row_number() OVER(PARTITION BY b.phone_digits'])need(db,token,'DB reativação');
for(const token of ['marques_anniversary_date','idx_inquiries_repurchase_event','idx_inquiries_repurchase_contact','repurchase_contacted_at timestamptz','repurchase_contact_year integer'])need(schema,token,'Schema reativação');
for(const token of ['isAdmin()','sameOriginRequest(request)','protectedRateLimit','admin-reactivation-list','admin-reactivation-mark','decodeReactivationCursor','markInquiryReactivationContact','logAdminAction'])need(route,token,'API reativação');
for(const token of ['reactivationRows','reactivationCount','loadReactivation','markReactivationContact','Oportunidades de recompra','Reativar cliente','repurchase_cycle_year','next_cursor'])need(ui,token,'UI reativação');
for(const token of ['base64url','next_anniversary','uuid'])need(cursor,token,'Cursor reativação');
for(const token of ['repurchase_contacted_at','repurchase_contact_year','idx_inquiries_repurchase_event','idx_inquiries_repurchase_contact'])need(runtime,token,'db:verify reativação');
for(const token of ['repurchase_contact','reactivation_event','?19:','?18:'])need(backup,token,'Backup schema atual + fallback 18');
for(const token of ['EXPECTED_SCHEMA_VERSION=platformContract.schemaVersion'])need(release,token,'Release atual');
need(deploy,'>=expectedSchema','Deploy gate usa schema central');need(manifest,'expected_schema:platform.schemaVersion','Manifesto usa schema central');
for(const token of ['npm run check:reactivation'])need(ci,token,'CI reativação');

if(pkg.scripts?.['check:reactivation']!=='node scripts/reactivation-lifecycle-check.mjs && node --no-warnings --experimental-strip-types scripts/reactivation-self-test.mjs')errors.push('package.json sem check:reactivation completo');
if(errors.length){console.error(`Reactivation Lifecycle Check: ${errors.length} problema(s)`);for(const error of errors)console.error(`- ${error}`);process.exit(1);}console.log('Reactivation Lifecycle Check: OK.');
