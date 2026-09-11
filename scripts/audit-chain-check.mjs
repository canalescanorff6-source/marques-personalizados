import fs from 'node:fs';
import process from 'node:process';
const errors=[];
const read=file=>fs.readFileSync(file,'utf8');
const need=(file,token,label)=>{if(!read(file).includes(token))errors.push(`${label}: ${token}`)};
const schema=read('sql/schema.sql');
for(const token of [
  'prev_integrity_hash text NOT NULL',
  'chain_version smallint NOT NULL',
  'CREATE TABLE IF NOT EXISTS admin_audit_chain_state',
  'marques_admin_audit_hash',
  'admin_audit_chain_prepare',
  'admin_audit_chain_advance',
  'pg_advisory_xact_lock(62829001)',
  'admin_audit_chain_before_insert',
  'admin_audit_chain_after_insert',
  'admin_audit_append_only',
  'chain_version=0',
  'idx_admin_audit_chain_version_id'
])if(!schema.includes(token))errors.push(`Schema cadeia: ${token}`);
for(const token of ['prev_integrity_hash','chain_version','admin_audit_chain_state','audit_chain_before','auditChainOk','version:ok?platformContract.schemaVersion'])need('lib/db.ts',token,'Runtime schema');
for(const token of ['lag(integrity_hash)','marques_admin_audit_hash','stateOk','chained'])need('lib/db.ts',token,'Verificação de cadeia');
for(const token of ['admin_audit_chain_state','prev_integrity_hash','chain_version','admin_audit_chain_before_insert','admin_audit_chain_after_insert'])need('scripts/db-runtime-contract.mjs',token,'db:verify');
for(const token of ['cadeia SHA-256','prev_integrity_hash','chain_version'])need('components/admin/OperationsCenter.tsx',token,'Central de Operação');
need('.github/workflows/ci.yml','npm run check:audit-chain','CI');
need('scripts/runtime-contract-check.mjs','npm run check:audit-chain','Runtime contract');
const pkg=JSON.parse(read('package.json'));if(!String(pkg.scripts?.['check:audit-chain']||'').includes('audit-chain-self-test.mjs'))errors.push('Script check:audit-chain ausente/incompleto');
for(const token of ['EXPECTED_SCHEMA_VERSION=platformContract.schemaVersion'])need('lib/release.ts',token,'Release V6.34');
need('scripts/release-manifest.mjs','expected_schema:platform.schemaVersion','Manifesto usa schema central');
need('scripts/deploy-gate.mjs','>=expectedSchema','Deploy gate usa schema central');
if(errors.length){console.error('Audit Chain Check falhou:');for(const e of errors)console.error(`- ${e}`);process.exit(1)}
console.log('Audit Chain Check: OK — cadeia SHA-256, âncora, serialização, migração única e verificação runtime protegidas.');
