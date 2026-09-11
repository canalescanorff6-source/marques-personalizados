import fs from 'node:fs';

const checks=[
  ['lib/db.ts',["CampaignSlugImmutableError","AND slug=$2","event_brief->'attribution'->>'campaign'","CampaignHasLeadsError"]],
  ['sql/schema.sql',["marketing_campaign_slug_immutable"],],
  ['app/api/admin/campaigns/[id]/route.ts',["CampaignSlugImmutableError","CampaignHasLeadsError","status:409"]],
  ['components/admin/CampaignManager.tsx',["readOnly={Boolean(editing)}","disabled={s.leads>0}","encerre a campanha em vez de excluir"]],
];
const errors=[];
for(const [file,tokens] of checks){
  if(!fs.existsSync(file)){errors.push(`Arquivo ausente: ${file}`);continue;}
  const text=fs.readFileSync(file,'utf8');
  for(const token of tokens)if(!text.includes(token))errors.push(`${file}: contrato ausente: ${token}`);
}
if(errors.length){
  console.error(`Campaign Integrity Check: ${errors.length} problema(s)`);
  for(const error of errors)console.error(`- ${error}`);
  process.exit(1);
}
console.log('Campaign Integrity Check: OK (slug UTM imutável e histórico de leads protegido).');
