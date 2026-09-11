import type { InquiryHistoryPointer } from './db';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeInquiryHistoryCursor(pointer:InquiryHistoryPointer|null){
  if(!pointer)return null;
  return Buffer.from(JSON.stringify({t:pointer.created_at,id:pointer.id}),'utf8').toString('base64url');
}

export function decodeInquiryHistoryCursor(value:string|null):InquiryHistoryPointer|null{
  if(!value)return null;
  try{
    if(value.length>300)return null;
    const parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8')) as {t?:unknown;id?:unknown};
    const createdAt=typeof parsed.t==='string'?parsed.t:'';const id=typeof parsed.id==='string'?parsed.id:'';
    if(!uuid.test(id)||!createdAt||Number.isNaN(new Date(createdAt).getTime()))return null;
    return{created_at:new Date(createdAt).toISOString(),id};
  }catch{return null;}
}
