import crypto from 'node:crypto';
function canonical(value){if(Array.isArray(value))return `[${value.map(canonical).join(',')}]`;if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;return JSON.stringify(value)}
function hash(prev,row){return crypto.createHash('sha256').update(canonical({v:1,prev,id:row.id,action:row.action,summary:row.summary,created_at_us:row.created_at_us})).digest('hex')}
function chain(rows){let prev='';return rows.map(row=>{const integrity_hash=hash(prev,row);const item={...row,prev_integrity_hash:prev,integrity_hash,chain_version:1};prev=integrity_hash;return item})}
function verify(rows,anchor){let previous='';for(const row of rows){if(row.chain_version!==1||row.prev_integrity_hash!==previous||row.integrity_hash!==hash(previous,row))return false;previous=row.integrity_hash}const last=rows.at(-1);return String(anchor.id??'')===String(last?.id??'')&&anchor.hash===(last?.integrity_hash||'')}
const source=[1,2,3,4].map(id=>({id,action:`action-${id}`,summary:`evento ${id}`,created_at_us:1700000000000000+id}));
const intact=chain(source);const anchor={id:intact.at(-1).id,hash:intact.at(-1).integrity_hash};
if(!verify(intact,anchor))throw new Error('cadeia íntegra deveria passar');
const altered=structuredClone(intact);altered[1].summary='alterado';if(verify(altered,anchor))throw new Error('alteração deveria quebrar cadeia');
const deleted=[intact[0],intact[2],intact[3]];if(verify(deleted,anchor))throw new Error('remoção intermediária deveria quebrar cadeia');
const reordered=[intact[1],intact[0],intact[2],intact[3]];if(verify(reordered,anchor))throw new Error('reordenação deveria quebrar cadeia');
const truncated=intact.slice(0,-1);if(verify(truncated,anchor))throw new Error('remoção do último registro deveria quebrar âncora');
console.log('Audit Chain Self-test: OK (íntegra aceita; alteração, remoção, reordenação e truncamento rejeitados).');
