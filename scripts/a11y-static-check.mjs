import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const ts=require('typescript');

const root=process.cwd();
const errors=[];
const ignoreDirs=new Set(['node_modules','.next','.git','backups']);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{if(ignoreDirs.has(e.name))return[];const p=path.join(dir,e.name);return e.isDirectory()?walk(p):[p]});}
const files=walk(root).filter(f=>f.endsWith('.tsx'));
const attrName=a=>ts.isJsxAttribute(a)?a.name.text:'';
const hasAttr=(attrs,name)=>attrs.properties.some(a=>ts.isJsxAttribute(a)&&a.name.text===name);
const tagName=n=>ts.isIdentifier(n)?n.text:n.getText();
const hasControlDescendant=node=>{let found=false;function visit(n){if(found)return;if(ts.isJsxElement(n)||ts.isJsxSelfClosingElement(n)){const open=ts.isJsxElement(n)?n.openingElement:n;const tag=tagName(open.tagName);if(['input','select','textarea'].includes(tag)){found=true;return;}}ts.forEachChild(n,visit);}ts.forEachChild(node,visit);return found;};
for(const file of files){
  const text=fs.readFileSync(file,'utf8');
  const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const rel=path.relative(root,file).replaceAll('\\','/');
  function report(node,msg){const lc=sf.getLineAndCharacterOfPosition(node.getStart(sf));errors.push(`${rel}:${lc.line+1}:${lc.character+1} ${msg}`);}
  function visit(node){
    if(ts.isJsxElement(node)){
      const open=node.openingElement;const tag=tagName(open.tagName);
      if(tag==='label'&&!hasAttr(open.attributes,'htmlFor')&&!hasControlDescendant(node))report(open,'<label> sem htmlFor e sem controle aninhado');
      if(tag==='dialog'){
        if(!hasAttr(open.attributes,'aria-label')&&!hasAttr(open.attributes,'aria-labelledby'))report(open,'<dialog> sem nome acessível');
      }
      const roleAttr=open.attributes.properties.find(a=>ts.isJsxAttribute(a)&&a.name.text==='role');
      if(roleAttr&&roleAttr.initializer&&ts.isStringLiteral(roleAttr.initializer)&&roleAttr.initializer.text==='dialog'){
        if(!hasAttr(open.attributes,'aria-label')&&!hasAttr(open.attributes,'aria-labelledby'))report(open,'role="dialog" sem aria-label/aria-labelledby');
        if(!hasAttr(open.attributes,'aria-modal'))report(open,'role="dialog" sem aria-modal');
      }
    }
    if(ts.isJsxSelfClosingElement(node)){
      const tag=tagName(node.tagName);
      if(tag==='img'&&!hasAttr(node.attributes,'alt')&&!node.attributes.properties.some(a=>ts.isJsxSpreadAttribute(a)))report(node,'<img> sem alt');
    }
    ts.forEachChild(node,visit);
  }
  visit(sf);
}
if(errors.length){console.error(`A11y Static Check: ${errors.length} problema(s)`);for(const e of errors)console.error(`- ${e}`);process.exit(1);}console.log(`A11y Static Check: OK (${files.length} arquivos TSX).`);
