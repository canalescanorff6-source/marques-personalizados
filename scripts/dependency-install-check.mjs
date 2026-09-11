import fs from 'node:fs';
import path from 'node:path';

const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const expected={...(pkg.dependencies||{}),...(pkg.devDependencies||{})};
const errors=[];
for(const [name,version] of Object.entries(expected)){
  const manifest=path.join('node_modules',...name.split('/'),'package.json');
  if(!fs.existsSync(manifest)){errors.push(`${name}@${version} não está instalado`);continue;}
  try{const installed=JSON.parse(fs.readFileSync(manifest,'utf8')).version;if(installed!==version)errors.push(`${name}: esperado ${version}, instalado ${installed||'?'}`);}catch{errors.push(`${name}: package.json instalado inválido`);}
}
if(errors.length){
  console.error(`Dependency Install Check: ${errors.length} problema(s).`);
  for(const error of errors)console.error(`- ${error}`);
  console.error(fs.existsSync('package-lock.json')?'Execute: npm ci':'Execute npm install em ambiente com acesso ao registry; depois gere/commite package-lock.json.');
  process.exit(1);
}
console.log(`Dependency Install Check: OK (${Object.keys(expected).length} dependências diretas na versão exata).`);
