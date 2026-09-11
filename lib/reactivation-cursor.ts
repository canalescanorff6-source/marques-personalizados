import type { InquiryReactivationPointer } from './db';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDate=/^\d{4}-\d{2}-\d{2}$/;

export function encodeReactivationCursor(pointer:InquiryReactivationPointer|null){
  if(!pointer)return null;
  return Buffer.from(JSON.stringify({d:pointer.next_anniversary,id:pointer.id}),'utf8').toString('base64url');
}

export function decodeReactivationCursor(value:string|null){
  if(!value)return null;
  try{
    if(value.length>300)return null;
    const parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8')) as {d?:unknown;id?:unknown};
    const date=typeof parsed.d==='string'?parsed.d:'';const id=typeof parsed.id==='string'?parsed.id:'';
    if(!uuid.test(id)||!isoDate.test(date)||Number.isNaN(new Date(`${date}T12:00:00Z`).getTime()))return null;
    return{next_anniversary:date,id};
  }catch{return null;}
}
