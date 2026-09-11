import fs from 'node:fs';

const errors=[];
const read=file=>fs.readFileSync(file,'utf8');
let platform;
try{platform=JSON.parse(read('platform-contract.json'));}catch(error){console.error('Platform Contract Check: platform-contract.json inválido.');process.exit(1);}
const pkg=JSON.parse(read('package.json'));
const semver=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
if(!Number.isInteger(platform.schemaVersion)||platform.schemaVersion<1)errors.push('schemaVersion deve ser inteiro positivo');
if(!semver.test(String(platform.nodeVersion||'')))errors.push('nodeVersion deve ser SemVer exato');
if(!semver.test(String(platform.npmVersion||'')))errors.push('npmVersion deve ser SemVer exato');
if(!/^node:[^@\s]+@sha256:[0-9a-f]{64}$/i.test(String(platform.dockerImage||'')))errors.push('dockerImage deve conter tag + digest SHA-256 imutável');
if(!/^ubuntu-\d{2}\.\d{2}$/.test(String(platform.githubRunner||'')))errors.push('githubRunner deve fixar uma imagem Ubuntu versionada');
if(read('.nvmrc').trim()!==platform.nodeVersion)errors.push('.nvmrc diverge de platform.nodeVersion');
if(pkg.packageManager!==`npm@${platform.npmVersion}`)errors.push('packageManager diverge de platform.npmVersion');
const release=read('lib/release.ts');
if(!release.includes("platformContract from '../platform-contract.json'"))errors.push('lib/release.ts não consome platform-contract.json');
if(!release.includes('EXPECTED_SCHEMA_VERSION=platformContract.schemaVersion'))errors.push('schema runtime não deriva do contrato central');
const db=read('lib/db.ts');
if(!db.includes("platformContract from '../platform-contract.json'")||!db.includes('version:ok?platformContract.schemaVersion:'))errors.push('detector de schema do DB não deriva a versão atual do contrato central');
const docker=read('Dockerfile');
for(const match of docker.matchAll(/^FROM\s+([^\s]+)/gm))if(match[1]!==platform.dockerImage)errors.push(`Dockerfile diverge do contrato: ${match[1]}`);
for(const wf of fs.readdirSync('.github/workflows').filter(x=>/\.ya?ml$/.test(x))){
  const text=read(`.github/workflows/${wf}`);
  for(const match of text.matchAll(/runs-on:\s*([^\s#]+)/g))if(match[1]!==platform.githubRunner)errors.push(`${wf}: runner ${match[1]} diverge de ${platform.githubRunner}`);
}
const ci=read('.github/workflows/ci.yml');for(const token of ['npm run check:platform','npm run check:url-safety','npm run check:http-boundary'])if(!ci.includes(token))errors.push(`CI não executa contrato obrigatório: ${token}`);
const manifest=read('scripts/release-manifest.mjs');if(!manifest.includes("platform-contract.json")||!manifest.includes('expected_schema:platform.schemaVersion'))errors.push('release manifest não deriva schema do contrato central');
const gate=read('scripts/deploy-gate.mjs');if(!gate.includes("platform-contract.json")||!gate.includes('>=expectedSchema'))errors.push('deploy gate não deriva schema do contrato central');
if(errors.length){console.error(`Platform Contract Check: FALHOU (${errors.length})`);for(const e of errors)console.error('- '+e);process.exit(1);}
console.log(`Platform Contract Check: OK — schema ${platform.schemaVersion}, Node ${platform.nodeVersion}, npm ${platform.npmVersion}, ${platform.githubRunner} e imagem Docker imutável sincronizados.`);
