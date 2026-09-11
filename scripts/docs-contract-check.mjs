import fs from 'node:fs';

const errors=[];
const read=file=>fs.readFileSync(file,'utf8');
const pkg=JSON.parse(read('package.json'));
const platform=JSON.parse(read('platform-contract.json'));
const schema=Number(platform.schemaVersion);
const version=String(pkg.version||'');
const [major,minor]=version.split('.');
const short=`${major}.${minor}`;
const node=read('.nvmrc').trim();
const npm=String(pkg.packageManager||'').replace(/^npm@/,'');
const docs={README:read('README.md'),CHANGELOG:read('CHANGELOG.md'),CHECKLIST:read('RELEASE-CHECKLIST.md'),ROLLBACK:read('ROLLBACK-RUNBOOK.md'),RUNSITE:read('RUNSITE.md')};

function firstSection(text){const start=text.search(/\S/);const next=text.indexOf('\n## ',Math.max(0,start)+4);return next>=0?text.slice(Math.max(0,start),next):text;}

if(!docs.README.slice(0,1800).includes(`V${short}`))errors.push(`README não apresenta V${short} como versão atual`);
if(!docs.README.includes(`Node.js **${node}**`))errors.push(`README não documenta Node ${node}`);
if(!docs.README.includes(`npm \`${npm}\``)&&!docs.README.includes(`npm **${npm}**`))errors.push(`README não documenta npm ${npm}`);
if(!docs.CHANGELOG.startsWith(`### Manutenção V${short}`))errors.push(`CHANGELOG não começa pela V${short}`);
if(!firstSection(docs.CHANGELOG).includes(`app **${version}**`))errors.push(`CHANGELOG atual não registra app ${version}`);
if(!docs.CHECKLIST.slice(0,800).includes(`V${short}`))errors.push(`RELEASE-CHECKLIST não está na V${short}`);
if(!docs.CHECKLIST.includes(`\`${version}\``))errors.push(`RELEASE-CHECKLIST não fixa package version ${version}`);
if(!docs.ROLLBACK.slice(0,900).includes(`V${short}`))errors.push(`ROLLBACK-RUNBOOK não começa pelo contrato da V${short}`);
if(!docs.ROLLBACK.includes(`schema runtime ${schema}`))errors.push(`ROLLBACK-RUNBOOK não documenta schema runtime ${schema} na operação atual`);
if(!docs.RUNSITE.slice(0,1200).includes(`V${short}`))errors.push(`RUNSITE não começa pela V${short}`);
if(!docs.RUNSITE.includes(`Node \`${node}\``))errors.push(`RUNSITE não documenta Node ${node}`);
if(schema>=26){for(const [name,text] of Object.entries({README:firstSection(docs.README),CHECKLIST:firstSection(docs.CHECKLIST),RUNSITE:firstSection(docs.RUNSITE),ROLLBACK:firstSection(docs.ROLLBACK)})){if(!/V9|marques-catalog-v9/.test(text))errors.push(`${name}: seção operacional schema ${schema} não documenta Backup V9`);}}
for(const [name,text] of Object.entries({README:firstSection(docs.README),CHECKLIST:firstSection(docs.CHECKLIST),RUNSITE:firstSection(docs.RUNSITE)})){
  if(/V6\.41/.test(text)&&short!=='6.41')errors.push(`${name}: referência V6.41 ainda aparece na seção operacional atual`);
}
if(errors.length){console.error(`Docs Contract Check: FALHOU (${errors.length})`);for(const e of errors)console.error('- '+e);process.exit(1);}
console.log(`Docs Contract Check: OK — documentação operacional sincronizada com app ${version}, Node ${node}, npm ${npm} e schema ${schema}.`);
