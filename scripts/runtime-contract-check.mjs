import fs from 'node:fs';

const errors=[];const warnings=[];
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const platform=JSON.parse(fs.readFileSync('platform-contract.json','utf8'));
const exactSemver=/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const expectedNode=String(platform.nodeVersion);
const expectedNpm=String(platform.npmVersion);

if(pkg.packageManager!==`npm@${expectedNpm}`)errors.push(`packageManager deve ser npm@${expectedNpm}`);
if(pkg.engines?.node!=='22.x')errors.push('engines.node deve ser 22.x');
if(pkg.engines?.npm!=='10.x')errors.push('engines.npm deve ser 10.x');
const nvm=fs.readFileSync('.nvmrc','utf8').trim();if(nvm!==expectedNode)errors.push(`.nvmrc deve fixar ${expectedNode}`);
const npmrc=fs.existsSync('.npmrc')?fs.readFileSync('.npmrc','utf8'):'';
for(const line of ['save-exact=true','package-lock=true','ignore-scripts=true'])if(!npmrc.split(/\r?\n/).map(x=>x.trim()).includes(line))errors.push(`.npmrc sem ${line}`);
for(const group of ['dependencies','devDependencies'])for(const [name,version] of Object.entries(pkg[group]||{}))if(!exactSemver.test(String(version)))errors.push(`${group}.${name} precisa de versão exata (atual: ${version})`);


const docker=fs.readFileSync('Dockerfile','utf8');
const expectedDocker=String(platform.dockerImage).replace(/^node:/,'');
const imageMatches=[...docker.matchAll(/^FROM\s+node:([^\s]+).*$/gm)].map(match=>match[1]);
if(imageMatches.length<3||imageMatches.some(image=>image!==expectedDocker))errors.push(`Dockerfile deve fixar node:${expectedDocker} em todos os estágios`);
for(const token of ['COPY package.json package-lock.json .npmrc ./','RUN npm ci --ignore-scripts --no-fund --no-audit','/app/.next/standalone','USER node','CMD ["node","server.js"]'])if(!docker.includes(token))errors.push(`Dockerfile sem hardening reproduzível: ${token}`);
if(/npm install(?!\s+--package-lock-only)/.test(docker))errors.push('Dockerfile não pode usar fallback npm install');
if(docker.includes('package-lock.json*'))errors.push('Dockerfile não pode tratar package-lock.json como opcional');
const nextConfig=fs.readFileSync('next.config.ts','utf8');if(!nextConfig.includes("output: 'standalone'"))errors.push('Next deve gerar output standalone para o runtime do container');
const ci=fs.readFileSync('.github/workflows/ci.yml','utf8');
if(!ci.includes(`runs-on: ${platform.githubRunner}`))errors.push(`CI deve fixar runner ${platform.githubRunner}`);
if(!ci.includes('node-version-file: .nvmrc'))errors.push('CI deve usar node-version-file: .nvmrc');
if(!ci.includes('npm ci --ignore-scripts --no-fund --no-audit'))errors.push('CI deve usar npm ci quando package-lock.json existir');
if(!fs.existsSync('.github/workflows/generate-lockfile.yml'))errors.push('workflow manual de geração do lockfile ausente');
if(!fs.existsSync('.github/workflows/deploy-gate.yml'))errors.push('workflow manual de verificação pós-deploy/rollback ausente');
if(!fs.existsSync('.github/workflows/offsite-backup.yml'))errors.push('workflow de backup offsite automático ausente');
if(!fs.existsSync('.github/workflows/recovery-drill.yml'))errors.push('workflow de recovery drill ausente');
if(!fs.existsSync('.github/workflows/media-backup.yml'))errors.push('workflow de backup de mídia ausente');
for(const token of ['npm run check:http-boundary','npm run check:concurrency','npm run check:sessions','npm run check:mfa','npm run check:recovery','npm run check:critical','npm run check:observability','npm run check:backup-auth','npm run check:backup-encryption','npm run check:restore','npm run check:resilience','npm run check:performance','npm run check:commercial','npm run check:scalable-crm','npm run check:crm-search','npm run check:production-scale','npm run check:agenda-scale','npm run check:reactivation','npm run check:audit-chain','npm run check:privacy','npm run check:privacy-dr','npm run check:offsite-backup','npm run check:backup-freshness','npm run check:recovery-drill','npm run check:media-dr','npm run check:media-recovery-drill','npm run check:critical-audit','npm run check:supply-chain','npm run check:public-flow','npm run check:load -- http://127.0.0.1:3100','npm run check:e2e -- http://127.0.0.1:3100','Start production server for E2E'])if(!ci.includes(token))errors.push(`CI sem contrato funcional: ${token}`);

const nodeVersion=process.versions.node;if(nodeVersion!==expectedNode){const msg=`runtime atual é Node ${nodeVersion}; alvo reproduzível é ${expectedNode}`;if(process.env.GITHUB_ACTIONS==='true')errors.push(msg);else warnings.push(msg);}
const npmUserAgent=String(process.env.npm_config_user_agent||'');const npmMatch=npmUserAgent.match(/(?:^|\s)npm\/([^\s]+)/);if(npmMatch&&npmMatch[1]!==expectedNpm){const msg=`runtime atual usa npm ${npmMatch[1]}; alvo reproduzível é ${expectedNpm}`;if(process.env.GITHUB_ACTIONS==='true')errors.push(msg);else warnings.push(msg);}
const lockRequired=process.argv.includes('--require-lock');
if(fs.existsSync('package-lock.json')){
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  if(Number(lock.lockfileVersion)<3)errors.push('package-lock.json precisa usar lockfileVersion >= 3');
  const root=lock.packages?.[''];
  if(!root)errors.push('package-lock.json sem pacote raiz');
  else for(const group of ['dependencies','devDependencies'])for(const [name,version] of Object.entries(pkg[group]||{}))if(root[group]?.[name]!==version)errors.push(`lockfile divergente em ${group}.${name}`);
}else if(lockRequired)errors.push('package-lock.json ausente; gere com npm install real e faça commit antes do release final');
else warnings.push('package-lock.json ainda ausente; use check:runtime -- --require-lock antes do release final');

if(errors.length){console.error(`Runtime Contract Check: ${errors.length} problema(s)`);for(const error of errors)console.error(`- ${error}`);for(const warning of warnings)console.warn(`Aviso: ${warning}`);process.exit(1);}
console.log('Runtime Contract Check: OK.');for(const warning of warnings)console.warn(`Aviso: ${warning}`);
