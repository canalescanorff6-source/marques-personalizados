import fs from 'node:fs';
import path from 'node:path';

const roots=['app','components','lib'];
const files=[];
const walk=(dir)=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())walk(file);else if(/\.tsx?$/.test(entry.name))files.push(file);}};
for(const root of roots)if(fs.existsSync(root))walk(root);

const forbidden=[
  {label:'anotação explícita any',pattern:/:\s*any\b/g},
  {label:'cast as any',pattern:/\bas\s+any\b/g},
  {label:'array any[]',pattern:/\bany\s*\[\s*\]/g},
  {label:'Array<any>',pattern:/\bArray\s*<\s*any\s*>/g},
  {label:'Record<..., any>',pattern:/\bRecord\s*<[^>]*,\s*any\s*>/g},
];
const errors=[];
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  for(const rule of forbidden){
    rule.pattern.lastIndex=0;
    for(const match of text.matchAll(rule.pattern)){
      const before=text.slice(0,match.index);const line=before.split('\n').length;
      errors.push(`${file}:${line}: ${rule.label}`);
    }
  }
}
if(errors.length){console.error(`Type Safety Check: ${errors.length} problema(s)`);for(const error of errors)console.error(`- ${error}`);process.exit(1);}
console.log(`Type Safety Check: OK (${files.length} arquivos TS/TSX sem escape explícito para any).`);
