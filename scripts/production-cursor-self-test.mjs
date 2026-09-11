import { decodeProductionCursor, encodeProductionCursor } from '../lib/production-cursor.ts';
const pointer={updated_at:'2026-09-09T12:00:00.000Z',id:'123e4567-e89b-42d3-a456-426614174000'};
const cursor=encodeProductionCursor(pointer);if(!cursor)throw new Error('cursor não gerado');const decoded=decodeProductionCursor(cursor);if(!decoded||decoded.id!==pointer.id||decoded.updated_at!==pointer.updated_at)throw new Error('round-trip do cursor falhou');
for(const invalid of ['x','@@@',Buffer.from(JSON.stringify({u:'bad',id:pointer.id})).toString('base64url'),Buffer.from(JSON.stringify({u:pointer.updated_at,id:'bad'})).toString('base64url')])if(decodeProductionCursor(invalid)!==null)throw new Error('cursor inválido aceito');
console.log('Production cursor self-test: OK — cursor opaco por updated_at/id e entradas inválidas rejeitadas.');
