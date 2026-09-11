import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const errors=[];
const sourceRoots=['app','components','lib'];

function walk(dir){
  if(!fs.existsSync(dir))return[];
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>{
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())return walk(full);
    return /\.(?:ts|tsx)$/.test(entry.name)&&!entry.name.endsWith('.d.ts')?[full]:[];
  });
}

function resolveLocal(fromFile,spec){
  let base;
  if(spec.startsWith('@/'))base=path.join(root,spec.slice(2));
  else if(spec.startsWith('./')||spec.startsWith('../'))base=path.resolve(path.dirname(fromFile),spec);
  else return null;
  const candidates=[base,`${base}.ts`,`${base}.tsx`,path.join(base,'index.ts'),path.join(base,'index.tsx')];
  return candidates.find(candidate=>fs.existsSync(candidate)&&fs.statSync(candidate).isFile())||null;
}

const exportCache=new Map();
function exportsOf(file){
  if(exportCache.has(file))return exportCache.get(file);
  const text=fs.readFileSync(file,'utf8');
  const names=new Set();
  for(const match of text.matchAll(/\bexport\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g))names.add(match[1]);
  for(const match of text.matchAll(/\bexport\s*\{([^}]+)\}/g)){
    for(const raw of match[1].split(',')){
      const item=raw.trim().replace(/^type\s+/,'');
      if(!item)continue;
      const parts=item.split(/\s+as\s+/);
      names.add((parts[1]||parts[0]).trim());
    }
  }
  const result={names,hasDefault:/\bexport\s+default\b/.test(text)};
  exportCache.set(file,result);
  return result;
}


function localBindings(clause){
  const bindings=[];
  const beforeNamed=clause.split('{')[0].trim().replace(/,$/,'').trim();
  if(beforeNamed){
    if(/^type(?:\s|$)/.test(beforeNamed)){
      const rest=beforeNamed==='type'?'':beforeNamed.replace(/^type\s+/,'').trim();
      if(rest&&rest!=='*'&&!/^\*/.test(rest))bindings.push(rest.split(',')[0].trim());
    }else if(/^\*\s+as\s+/.test(beforeNamed)){
      const match=beforeNamed.match(/^\*\s+as\s+([A-Za-z_$][\w$]*)/);
      if(match)bindings.push(match[1]);
    }else{
      const def=beforeNamed.split(',')[0].trim();
      if(def)bindings.push(def);
    }
  }
  const match=clause.match(/\{([\s\S]*?)\}/);
  if(match){
    for(let item of match[1].split(',').map(x=>x.trim()).filter(Boolean)){
      item=item.replace(/^type\s+/,'').trim();
      const parts=item.split(/\s+as\s+/);
      const local=(parts[1]||parts[0]).trim();
      if(local)bindings.push(local);
    }
  }
  return bindings;
}

function namedImports(block){
  const match=block.match(/\{([\s\S]*?)\}/);
  if(!match)return[];
  return match[1].split(',').map(raw=>raw.trim()).filter(Boolean).map(item=>{
    item=item.replace(/^type\s+/,'').trim();
    return item.split(/\s+as\s+/)[0].trim();
  }).filter(Boolean);
}

const files=sourceRoots.flatMap(walk);
let localImports=0;
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const bindings=new Map();
  for(const match of text.matchAll(/\bimport\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g)){
    const clause=match[1].trim();
    for(const binding of localBindings(clause)){
      const previous=bindings.get(binding);
      if(previous)errors.push(`${path.relative(root,file)}: binding importado duplicado ${binding} (${previous} e ${match[2]})`);
      else bindings.set(binding,match[2]);
    }
    const spec=match[2];
    if(spec.endsWith('.json'))continue;
    const target=resolveLocal(file,spec);
    if(!target){
      if(spec.startsWith('@/')||spec.startsWith('./')||spec.startsWith('../'))errors.push(`${path.relative(root,file)}: módulo local não encontrado: ${spec}`);
      continue;
    }
    localImports++;
    const surface=exportsOf(target);
    const named=namedImports(clause);
    for(const imported of named){
      if(!surface.names.has(imported))errors.push(`${path.relative(root,file)}: importa ${imported} de ${spec}, mas ${path.relative(root,target)} não exporta esse símbolo`);
    }
    const beforeNamed=clause.split('{')[0].trim().replace(/,$/,'').trim();
    const isNamespace=/^\*\s+as\s+/.test(beforeNamed);
    const isTypeOnly=/^type(?:\s|$)/.test(beforeNamed);
    const defaultPart=beforeNamed&&!isNamespace&&!isTypeOnly?beforeNamed.split(',')[0].trim():'';
    if(defaultPart&&!surface.hasDefault)errors.push(`${path.relative(root,file)}: importa default de ${spec}, mas ${path.relative(root,target)} não possui export default`);
  }
}

if(errors.length){
  console.error(`Module Surface Check: FALHOU (${errors.length})`);
  for(const error of errors)console.error('- '+error);
  process.exit(1);
}
console.log(`Module Surface Check: OK — ${localImports} imports locais cruzados contra exports reais em ${files.length} módulos.`);
