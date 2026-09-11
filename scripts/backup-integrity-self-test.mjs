import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const dir=fs.mkdtempSync(path.join(os.tmpdir(),'marques-backup-test-'));
try{
  const content={products:[],archived_products:[],categories:[],inquiries:[],settings:{brand_name:'Teste'},testimonials:[],faqs:[],audit:[],inquiry_activity:[],social_content_plans:[],marketing_campaigns:[],site_events_daily:[]};
  const hash=crypto.createHash('sha256').update(JSON.stringify(content)).digest('hex');
  const counts=Object.fromEntries(Object.entries(content).filter(([,value])=>Array.isArray(value)).map(([key,value])=>[key,value.length]));
  const good={version:7,backup_format:'marques-catalog-v7',created_at:new Date().toISOString(),manifest:{algorithm:'sha256',content_sha256:hash,counts},...content};
  const goodFile=path.join(dir,'good.json');const badFile=path.join(dir,'bad.json');fs.writeFileSync(goodFile,JSON.stringify(good));
  const bad=structuredClone(good);bad.products.push({id:'alterado'});fs.writeFileSync(badFile,JSON.stringify(bad));
  const accepted=spawnSync(process.execPath,['--no-warnings','--experimental-strip-types','scripts/verify-backup.mjs',goodFile],{encoding:'utf8'});if(accepted.status!==0)throw new Error(`backup íntegro foi rejeitado: ${accepted.stderr||accepted.stdout}`);
  const rejected=spawnSync(process.execPath,['--no-warnings','--experimental-strip-types','scripts/verify-backup.mjs',badFile],{encoding:'utf8'});if(rejected.status===0)throw new Error('backup adulterado foi aceito');
  console.log('Backup Integrity Self-test: OK (íntegro aceito, adulterado rejeitado).');
}finally{fs.rmSync(dir,{recursive:true,force:true});}
