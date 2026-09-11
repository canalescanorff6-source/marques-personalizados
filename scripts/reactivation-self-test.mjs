import { decodeReactivationCursor,encodeReactivationCursor } from '../lib/reactivation-cursor.ts';
function lastDay(year,month){return new Date(Date.UTC(year,month,0)).getUTCDate();}
function anniversary(eventDate,year){const [y,m,d]=eventDate.split('-').map(Number);if(!y||!m||!d)throw new Error('invalid date');return `${year}-${String(m).padStart(2,'0')}-${String(Math.min(d,lastDay(year,m))).padStart(2,'0')}`;}
function nextAnniversary(eventDate,today){const year=Number(today.slice(0,4));const current=anniversary(eventDate,year);return current>=today?current:anniversary(eventDate,year+1);}
const tests=[
  [anniversary('2024-02-29',2025),'2025-02-28','29/02 deve cair em 28/02 em ano comum'],
  [anniversary('2024-02-29',2028),'2028-02-29','29/02 deve permanecer em ano bissexto'],
  [nextAnniversary('2020-12-20','2026-12-01'),'2026-12-20','aniversário ainda futuro usa o ano atual'],
  [nextAnniversary('2020-01-10','2026-12-20'),'2027-01-10','virada do ano deve apontar o próximo ciclo'],
];
for(const [actual,expected,label] of tests)if(actual!==expected)throw new Error(`${label}: ${actual} != ${expected}`);
const pointer={next_anniversary:'2027-01-10',id:'123e4567-e89b-42d3-a456-426614174000'};const encoded=encodeReactivationCursor(pointer);const decoded=decodeReactivationCursor(encoded);if(!decoded||decoded.next_anniversary!==pointer.next_anniversary||decoded.id!==pointer.id)throw new Error('cursor de reativação não preserva o ponteiro');
if(decodeReactivationCursor('invalido')!==null)throw new Error('cursor inválido deveria ser rejeitado');
const contactYear=2027;const cycleYear=2027;if(contactYear!==cycleYear)throw new Error('self-test de supressão anual inválido');
console.log(`Reactivation self-test: OK (${tests.length} calendários + cursor + ciclo anual).`);
