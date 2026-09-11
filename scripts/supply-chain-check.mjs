import fs from 'node:fs';
import path from 'node:path';

const errors=[];
const platform=JSON.parse(fs.readFileSync('platform-contract.json','utf8'));
const warnings=[];
const workflowRoot='.github/workflows';
const workflowFiles=fs.readdirSync(workflowRoot).filter(name=>/\.ya?ml$/.test(name));
const generator='generate-lockfile.yml';
const critical=new Set(['ci.yml','offsite-backup.yml','recovery-drill.yml','media-backup.yml','media-recovery-drill.yml']);
const approvedActions=new Map([
  ['actions/checkout',{sha:'3d3c42e5aac5ba805825da76410c181273ba90b1',version:'v7.0.1'}],
  ['actions/setup-node',{sha:'820762786026740c76f36085b0efc47a31fe5020',version:'v7.0.0'}],
  ['actions/upload-artifact',{sha:'043fb46d1a93c77aae656e7c1c64a875d1fc6a0a',version:'v7.0.1'}],
]);

for(const name of workflowFiles){
  const text=fs.readFileSync(path.join(workflowRoot,name),'utf8');
  for(const match of text.matchAll(/runs-on:\s*([^\s#]+)/g))if(match[1]!==platform.githubRunner)errors.push(`${name}: runner mutável/inesperado ${match[1]}; esperado ${platform.githubRunner}`);
  if(!/permissions:\s*\n(?:\s+.*\n)*?\s*contents:\s*read/.test(text))errors.push(`${name}: permissions contents: read ausente`);

  for(const match of text.matchAll(/^\s*-?\s*uses:\s*([^\s#]+)(?:\s*#\s*([^\r\n]+))?/gm)){
    const spec=match[1];
    if(spec.startsWith('./')||spec.startsWith('docker://'))continue;
    const at=spec.lastIndexOf('@');
    if(at<1){errors.push(`${name}: action sem ref imutável: ${spec}`);continue;}
    const action=spec.slice(0,at);
    const ref=spec.slice(at+1);
    if(!/^[0-9a-f]{40}$/i.test(ref)){errors.push(`${name}: ${action} deve ser pinada por SHA completo, não ${ref}`);continue;}
    const approved=approvedActions.get(action);
    if(!approved){errors.push(`${name}: action externa não aprovada no allowlist: ${action}@${ref}`);continue;}
    if(ref!==approved.sha)errors.push(`${name}: ${action} SHA inesperado (${ref}); esperado ${approved.sha}`);
    const comment=String(match[2]||'').trim();
    if(comment!==approved.version)errors.push(`${name}: ${action} deve documentar versão humana "# ${approved.version}"`);
  }

  if(text.includes('actions/checkout@')){
    const checkoutBlocks=[...text.matchAll(/uses:\s*actions\/checkout@[0-9a-f]{40}\s*#\s*v7\.0\.1([\s\S]*?)(?=\n\s*-\s+(?:name:|uses:|run:)|\n\s*-[^\n]*$|$)/g)];
    if(!checkoutBlocks.length||checkoutBlocks.some(m=>!m[1].includes('persist-credentials: false')))errors.push(`${name}: checkout deve usar persist-credentials: false`);
  }

  if(critical.has(name)){
    if(!text.includes('package-lock.json'))errors.push(`${name}: não exige package-lock.json`);
    if(!text.includes('::error::package-lock.json obrigatório.'))errors.push(`${name}: falha de lock sem diagnóstico explícito`);
    if(!text.includes('npm ci --ignore-scripts --no-fund --no-audit'))errors.push(`${name}: npm ci deve bloquear lifecycle scripts de dependências`);
    if(/npm install(?!\s+--package-lock-only)/.test(text))errors.push(`${name}: fallback npm install proibido`);
  }
}

const generatorText=fs.readFileSync(path.join(workflowRoot,generator),'utf8');
if(!generatorText.includes('npm install --package-lock-only --ignore-scripts --no-fund --no-audit'))errors.push('generate-lockfile: geração controlada sem scripts ausente');
for(const token of ['npm ci --ignore-scripts --no-fund --no-audit','npm run check:deps','npm audit --audit-level=high','sha256sum package-lock.json > package-lock.sha256'])if(!generatorText.includes(token))errors.push(`generate-lockfile: prova pós-geração ausente: ${token}`);

const dependabot=fs.existsSync('.github/dependabot.yml')?fs.readFileSync('.github/dependabot.yml','utf8'):'';
for(const token of ['package-ecosystem: npm','package-ecosystem: github-actions','package-ecosystem: docker','interval: weekly'])if(!dependabot.includes(token))errors.push(`Dependabot: ${token} ausente`);


const docker=fs.readFileSync('Dockerfile','utf8');
const dockerRef=String(platform.dockerImage);
const dockerFrom=[...docker.matchAll(/^FROM\s+([^\s]+)(?:\s+AS\s+[^\s]+)?$/gmi)].map(m=>m[1]);
if(dockerFrom.length!==3||dockerFrom.some(ref=>ref!==dockerRef))errors.push(`Dockerfile: todos os estágios devem usar base imutável ${dockerRef}`);
if(!docker.includes('COPY package.json package-lock.json .npmrc ./'))errors.push('Dockerfile: package-lock.json deve ser obrigatório no COPY');
if(!docker.includes('RUN npm ci --ignore-scripts --no-fund --no-audit'))errors.push('Dockerfile: instalação deve usar npm ci com lifecycle scripts bloqueados');
if(/npm install(?!\s+--package-lock-only)/.test(docker))errors.push('Dockerfile: fallback npm install proibido');
if(!docker.includes('USER node'))errors.push('Dockerfile: runtime deve executar como usuário não-root');
if(!docker.includes('CMD ["node","server.js"]'))errors.push('Dockerfile: runtime standalone deve iniciar diretamente com node');
const dockerignore=fs.readFileSync('.dockerignore','utf8');
for(const token of ['.env*','*.pem','*.key','backups'])if(!dockerignore.split(/\r?\n/).includes(token))errors.push(`.dockerignore sem proteção: ${token}`);

const npmrc=fs.readFileSync('.npmrc','utf8').split(/\r?\n/).map(x=>x.trim());
if(!npmrc.includes('ignore-scripts=true'))errors.push('.npmrc: ignore-scripts=true obrigatório');

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})){
  if(!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(String(version)))errors.push(`Dependência não exata: ${name}=${version}`);
}

if(fs.existsSync('package-lock.json')){
  const lock=JSON.parse(fs.readFileSync('package-lock.json','utf8'));
  if(Number(lock.lockfileVersion)<3)errors.push('package-lock.json deve usar lockfileVersion >=3');
}else warnings.push('package-lock.json ainda ausente neste pacote; gere-o no workflow dedicado antes do release/deploy.');

if(errors.length){
  console.error(`Supply Chain Check: FALHOU (${errors.length})`);
  for(const error of errors)console.error('- '+error);
  for(const warning of warnings)console.warn('Aviso: '+warning);
  process.exit(1);
}
console.log(`Supply Chain Check: OK — Actions/digest imutáveis, runner ${platform.githubRunner}, installs sem lifecycle scripts, lock comprovado e Dependabot npm/Actions/Docker ativo.`);
for(const warning of warnings)console.warn('Aviso: '+warning);
