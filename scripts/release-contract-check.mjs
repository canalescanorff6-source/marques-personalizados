import fs from 'node:fs';

const errors=[];
const read=file=>fs.readFileSync(file,'utf8');
const pkg=JSON.parse(read('package.json'));
const platform=JSON.parse(read('platform-contract.json'));
const expectedSchema=Number(platform.schemaVersion);
const semver=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

let runtimeRelease=null;
try{
  const mod=await import(new URL('../lib/release.ts',import.meta.url));
  runtimeRelease=mod.getReleaseInfo();
  if(mod.APP_VERSION!==pkg.version)errors.push(`APP_VERSION runtime diverge do package.json: ${mod.APP_VERSION} != ${pkg.version}`);
  if(Number(mod.EXPECTED_SCHEMA_VERSION)!==expectedSchema)errors.push(`EXPECTED_SCHEMA_VERSION runtime divergente: ${mod.EXPECTED_SCHEMA_VERSION}`);
  if(runtimeRelease?.version!==pkg.version)errors.push(`getReleaseInfo().version diverge do package.json: ${runtimeRelease?.version}`);
  if(runtimeRelease?.id!==`v${pkg.version}`)errors.push(`getReleaseInfo().id padrão divergente: ${runtimeRelease?.id}`);
}catch(error){errors.push(`lib/release.ts não executa corretamente: ${error instanceof Error?error.message:String(error)}`);}
if(!semver.test(String(pkg.version||'')))errors.push(`package.json.version inválida: ${pkg.version||'ausente'}`);

const release=read('lib/release.ts');
for(const token of ["import packageJson from '../package.json' with { type: 'json' }",'APP_VERSION=packageJson.version','platform-contract.json','EXPECTED_SCHEMA_VERSION=platformContract.schemaVersion','export function getReleaseInfo()']){
  if(!release.includes(token))errors.push(`lib/release.ts sem contrato: ${token}`);
}
for(const field of ['APP_RELEASE_ID','APP_RELEASE_COMMIT','APP_DEPLOYED_AT'])if(!release.includes(field))errors.push(`getReleaseInfo não considera ${field}`);

const health=read('app/api/health/route.ts');
if(!health.includes('getReleaseInfo()'))errors.push('health endpoint não publica identidade de release');
const operations=read('app/api/admin/operations/route.ts');
if(!operations.includes('getReleaseInfo()'))errors.push('operations endpoint não publica identidade de release');

const manifest=read('scripts/release-manifest.mjs');
if(!manifest.includes('version:pkg.version'))errors.push('release manifest não deriva versão do package.json');
if(!manifest.includes('expected_schema:platform.schemaVersion'))errors.push('release manifest não deriva schema do contrato central');

const gate=read('scripts/deploy-gate.mjs');
if(!gate.includes('`v${pkg.version}`'))errors.push('deploy gate não detecta fallback da versão dinamicamente');
if(!gate.includes('Marques-Deploy-Gate/${pkg.version}'))errors.push('deploy gate user-agent não deriva da versão atual');

if(errors.length){
  console.error(`Release Contract Check: FALHOU (${errors.length})`);
  for(const error of errors)console.error('- '+error);
  process.exit(1);
}
console.log(`Release Contract Check: OK — package.json é a autoridade da versão (${pkg.version}) e APIs/manifest/gate permanecem sincronizados.`);
