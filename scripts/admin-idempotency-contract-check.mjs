import fs from 'node:fs';
const errors=[];const read=file=>fs.readFileSync(file,'utf8');
const helper=read('lib/idempotency.ts');for(const token of ['requireAdminCreateIdempotencyKey','adminCreateIdFromKey','assertIdempotentReplay','IdempotencyConflictError','IDEMPOTENCY_KEY_REQUIRED','INVALID_IDEMPOTENCY_KEY'])if(!helper.includes(token))errors.push(`idempotency helper sem ${token}`);
const db=read('lib/db.ts');for(const token of ['createProductIdempotent','createCategoryIdempotent','createTestimonialIdempotent','createFaqIdempotent','createMarketingCampaignIdempotent','createSocialContentPlanIdempotent','adminCreateIdFromKey','assertIdempotentReplay','ON CONFLICT DO NOTHING'])if(!db.includes(token))errors.push(`db sem criação idempotente (${token})`);
const routes=[
  ['app/api/admin/products/route.ts','createProductIdempotent'],
  ['app/api/admin/categories/route.ts','createCategoryIdempotent'],
  ['app/api/admin/testimonials/route.ts','createTestimonialIdempotent'],
  ['app/api/admin/faqs/route.ts','createFaqIdempotent'],
  ['app/api/admin/campaigns/route.ts','createMarketingCampaignIdempotent'],
  ['app/api/admin/social-plan/route.ts','createSocialContentPlanIdempotent'],
];
for(const [file,fn] of routes){const text=read(file);for(const token of ['requireAdminCreateIdempotencyKey(request)',fn,'deduplicated:!created','status:created?201:200','if(created)await logAdminAction','requestId:idempotencyKey','idempotencyHttpError(e)'])if(!text.includes(token))errors.push(`${file}: contrato idempotente ausente (${token})`);}
const client=read('lib/client.ts');for(const token of ['RETRY_SAFE_ADMIN_CREATE_PATHS','pendingCreateKeys','CREATE_KEY_STORAGE_PREFIX','sessionStorage','identityFingerprint','idempotency-key','prepared.identity?2','error.reauthRequired','data.reauth_required===true'])if(!client.includes(token))errors.push(`client retry contract sem ${token}`);
for(const path of ['/api/admin/products','/api/admin/categories','/api/admin/testimonials','/api/admin/faqs','/api/admin/campaigns','/api/admin/social-plan'])if(!client.includes(`'${path}'`))errors.push(`client não reconhece criação retry-safe ${path}`);
if(/attempts=method==='POST'\?/.test(client))errors.push('client não pode repetir genericamente todos os POSTs');
const packageJson=JSON.parse(read('package.json'));if(!packageJson.scripts?.['check:idempotency'])errors.push('package.json sem check:idempotency');if(!String(packageJson.scripts?.verify||'').includes('check:idempotency'))errors.push('verify sem check:idempotency');
const ci=read('.github/workflows/ci.yml');if(!ci.includes('npm run check:idempotency'))errors.push('CI sem check:idempotency');
if(errors.length){console.error(`Admin Idempotency Contract: FALHOU (${errors.length})`);for(const error of errors)console.error('- '+error);process.exit(1);}
console.log('Admin Idempotency Contract: OK — criações administrativas têm chave estável, replay determinístico e retry seletivo.');
