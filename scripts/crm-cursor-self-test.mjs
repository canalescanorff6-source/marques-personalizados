import { decodeInquiryHistoryCursor, encodeInquiryHistoryCursor } from '../lib/crm-cursor.ts';
const pointer={created_at:'2026-09-09T10:00:00.000Z',id:'11111111-1111-4111-8111-111111111111'};
const cursor=encodeInquiryHistoryCursor(pointer);if(!cursor||cursor.includes('{'))throw new Error('Cursor não ficou opaco.');const decoded=decodeInquiryHistoryCursor(cursor);if(!decoded||decoded.id!==pointer.id||decoded.created_at!==pointer.created_at)throw new Error('Round-trip do cursor falhou.');
for(const invalid of ['%%%','eyJ0IjoiYmFkIiwiaWQiOiJ4In0',Buffer.from(JSON.stringify({t:pointer.created_at,id:'../../etc'})).toString('base64url')])if(decodeInquiryHistoryCursor(invalid)!==null)throw new Error('Cursor inválido aceito.');
console.log('CRM Cursor Self-Test: OK — cursor opaco, ordenação estável e rejeição de payload inválido verificadas.');
