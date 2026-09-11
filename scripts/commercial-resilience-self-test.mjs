import crypto from 'node:crypto';
import {verifyBackupText} from '../lib/backup-restore.ts';

const canonicalKeys=['products','archived_products','categories','inquiries','settings','testimonials','faqs','inquiry_activity','social_content_plans','marketing_campaigns','site_events_daily','audit'];
const legacyKeys=['products','archived_products','categories','inquiries','settings','testimonials','faqs','audit','inquiry_activity','social_content_plans','marketing_campaigns','site_events_daily'];
const hash=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const baseSections=()=>({products:[],archived_products:[],categories:[],inquiries:[],settings:{id:1,brand_name:'Teste'},testimonials:[],faqs:[],inquiry_activity:[],social_content_plans:[],marketing_campaigns:[],site_events_daily:[],audit:[]});
function backup(schemaVersion,order,mutate){const sections=baseSections();mutate?.(sections);const content=Object.fromEntries(order.map(key=>[key,sections[key]]));const counts=Object.fromEntries([...canonicalKeys].filter(k=>k!=='settings').map(k=>[k,Array.isArray(sections[k])?sections[k].length:0]));return JSON.stringify({version:7,backup_format:'marques-catalog-v7',schema_version:schemaVersion,created_at:new Date().toISOString(),manifest:{algorithm:'sha256',content_sha256:hash(content),counts},...sections});}

const canonical=verifyBackupText(backup(14,canonicalKeys));
if(canonical.schemaVersion!==14||canonical.warnings.some(w=>w.includes('ordem SHA-256 histórica')))throw new Error('backup canônico V6.23 não validou corretamente');

const legacy=verifyBackupText(backup(13,legacyKeys));
if(!legacy.warnings.some(w=>w.includes('ordem SHA-256 histórica')))throw new Error('backup legado não foi reconhecido pela ordem SHA histórica');

let rejected=false;
try{verifyBackupText(backup(14,canonicalKeys,s=>{s.inquiries=[{id:'11111111-1111-4111-8111-111111111111',version:1,status:'novo',payment_status:'sinal',quoted_value_cents:10000,paid_cents:10000,production_status:'nao_iniciado'}];}));}catch(error){rejected=error instanceof Error&&error.message==='BACKUP_COMMERCIAL_INTEGRITY';}
if(!rejected)throw new Error('backup com estado comercial inválido não foi rejeitado');

console.log('Commercial Resilience Self-test: OK (SHA canônico, SHA legado e integridade comercial).');
