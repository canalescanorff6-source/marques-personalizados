import fs from 'node:fs';import process from 'node:process';
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const platform=JSON.parse(fs.readFileSync('platform-contract.json','utf8'));
const clean=(value,max=80)=>String(value||'').trim().replace(/[^A-Za-z0-9._:@/+\-]/g,'').slice(0,max);
const id=clean(process.env.APP_RELEASE_ID)||`v${pkg.version}`;
const commit=clean(process.env.APP_RELEASE_COMMIT,64)||null;
const raw=String(process.env.APP_DEPLOYED_AT||'').trim();const deployedAt=raw&&!Number.isNaN(Date.parse(raw))?new Date(raw).toISOString():null;
const manifest={service:'marques-catalogo',version:pkg.version,release_id:id,commit,deployed_at:deployedAt,expected_schema:platform.schemaVersion,node:process.versions.node};
const out=process.argv.find(x=>x.startsWith('--out='))?.slice(6);const text=JSON.stringify(manifest,null,2)+'\n';if(out){fs.writeFileSync(out,text);console.log(`Manifesto salvo em ${out}`);}else process.stdout.write(text);
