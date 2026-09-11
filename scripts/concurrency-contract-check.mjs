import fs from 'node:fs';
const errors=[];const read=file=>fs.readFileSync(file,'utf8');
const db=read('lib/db.ts');
const requiredFns=['updateProduct','deleteProduct','restoreProduct','permanentlyDeleteProduct','updateCategory','deleteCategory','updateTestimonial','deleteTestimonial','updateSocialContentPlan','deleteSocialContentPlan','updateMarketingCampaign','deleteMarketingCampaign','updateFaq','deleteFaq','updateSiteSettings'];
for(const fn of requiredFns){
  const signature=new RegExp(`export async function ${fn}\\([^)]*expectedUpdatedAt:string`);
  if(!signature.test(db))errors.push(`db.${fn}: expectedUpdatedAt deve ser obrigatório`);
}
for(const token of [
  'WHERE id=$20 AND updated_at=$21',
  'deleted_at IS NULL AND updated_at=$2',
  'deleted_at IS NOT NULL AND updated_at=$2',
  'c.updated_at=$2',
  'WHERE id=$7 AND updated_at=$8',
  'WHERE id=$8 AND updated_at=$9',
  'slug=$2 AND updated_at=$12',
  'WHERE id=$5 AND updated_at=$6',
  'DELETE FROM inquiries WHERE id=$1 AND version=$2 RETURNING id',
])if(!db.includes(token))errors.push(`db: CAS temporal ausente (${token})`);
if(!db.includes('throw new StaleWriteError()'))errors.push('db: conflitos concorrentes precisam lançar StaleWriteError');

const routes=[
  ['app/api/admin/products/[id]/route.ts',true,true],
  ['app/api/admin/products/[id]/restore/route.ts',false,true],
  ['app/api/admin/categories/[id]/route.ts',true,true],
  ['app/api/admin/testimonials/[id]/route.ts',true,true],
  ['app/api/admin/social-plan/[id]/route.ts',true,true],
  ['app/api/admin/campaigns/[id]/route.ts',true,true],
  ['app/api/admin/faqs/[id]/route.ts',true,true],
  ['app/api/admin/settings/route.ts',true,false],
];
for(const [file,patch,mutation] of routes){
  const text=read(file);
  if(patch&&!text.includes('requireExpectedUpdatedAt(body.expected_updated_at)'))errors.push(`${file}: PATCH deve exigir expected_updated_at`);
  if(mutation&&!text.includes('expectedUpdatedAtFromRequest(request)'))errors.push(`${file}: DELETE/restore deve exigir expected_updated_at na URL`);
  if(!text.includes('e instanceof StaleWriteError'))errors.push(`${file}: conflito stale deve responder 409`);
}


const productBulk=read('app/api/admin/products/bulk/route.ts');
for(const token of ['type ProductVersionRef','rawItems','updated_at','bulkUpdateProducts(items,action,categoryId)','e instanceof StaleWriteError','status:409','atomic:true'])if(!productBulk.includes(token))errors.push(`products bulk: proteção all-or-none ausente (${token})`);
for(const token of ['export type ProductVersionRef','jsonb_to_recordset($1::jsonb)','e.updated_at=p.updated_at','(SELECT n FROM matched)=(SELECT count(*) FROM expected)',"rows.length!==safe.length","throw new StaleWriteError('A ação em lote foi cancelada"])if(!db.includes(token))errors.push(`db bulk products: CAS all-or-none ausente (${token})`);
if(!read('components/admin/ProductManager.tsx').includes("map(p=>({id:p.id,updated_at:p.updated_at}))"))errors.push('ProductManager: bulk deve enviar versão observada de cada produto');

const inquiryRoute=read('app/api/admin/inquiries/[id]/route.ts');
if(!inquiryRoute.includes('expectedVersionFromRequest(request)'))errors.push('inquiries DELETE deve exigir expected_version');
if(!inquiryRoute.includes('deleteInquiry(id,expectedVersion)'))errors.push('inquiries DELETE deve repassar expected_version ao banco');
if(!inquiryRoute.includes('e instanceof StaleWriteError'))errors.push('inquiries DELETE/PATCH devem tratar stale como 409');
if(!/export async function deleteInquiry\(id:string,expectedVersion:number\)/.test(db))errors.push('db.deleteInquiry: expectedVersion deve ser obrigatório');

const uiChecks=[
  ['components/admin/ProductManager.tsx','expected_updated_at=${encodeURIComponent(p.updated_at)}'],
  ['components/admin/TrashManager.tsx','restore?expected_updated_at=${encodeURIComponent(p.updated_at)}'],
  ['components/admin/TrashManager.tsx','permanent=1&expected_updated_at=${encodeURIComponent(p.updated_at)}'],
  ['components/admin/CategoryManager.tsx','expected_updated_at=${encodeURIComponent(c.updated_at)}'],
  ['components/admin/TestimonialManager.tsx','expected_updated_at=${encodeURIComponent(t.updated_at)}'],
  ['components/admin/PromotionStudio.tsx','expected_updated_at=${encodeURIComponent(plan.updated_at)}'],
  ['components/admin/CampaignManager.tsx','expected_updated_at=${encodeURIComponent(c.updated_at)}'],
  ['components/admin/FaqManager.tsx','expected_updated_at=${encodeURIComponent(f.updated_at)}'],
  ['components/admin/InquiryManager.tsx','expected_version=${encodeURIComponent(String(i.version))}'],
  ['components/admin/SettingsManager.tsx','expected_updated_at:settings.updated_at'],
];
for(const [file,token] of uiChecks)if(!read(file).includes(token))errors.push(`${file}: UI não envia precondição (${token})`);
const concurrency=read('lib/concurrency.ts');for(const token of ['normalizeExpectedUpdatedAt','requireExpectedUpdatedAt','expectedUpdatedAtFromRequest','requireExpectedVersion','expectedVersionFromRequest'])if(!concurrency.includes(token))errors.push(`concurrency helper sem ${token}`);
const httpErrors=read('lib/http-errors.ts');if(!httpErrors.includes("'PRECONDITION_REQUIRED'" )||!httpErrors.includes('status:428'))errors.push('http-errors precisa mapear PRECONDITION_REQUIRED para 428');

if(errors.length){console.error(`Concurrency Contract: FALHOU (${errors.length})`);for(const error of errors)console.error('- '+error);process.exit(1);}
console.log('Concurrency Contract: OK — mutações individuais e lotes de produto usam CAS temporal all-or-none.');
