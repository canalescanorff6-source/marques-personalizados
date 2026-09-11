import type { ProductionHistoryPointer } from './db';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function encodeProductionCursor(pointer:ProductionHistoryPointer|null){
  if(!pointer)return null;
  return Buffer.from(JSON.stringify({u:pointer.updated_at,id:pointer.id}),'utf8').toString('base64url');
}

export function decodeProductionCursor(value:string|null):ProductionHistoryPointer|null{
  if(!value)return null;
  try{
    if(value.length>300)return null;
    const parsed=JSON.parse(Buffer.from(value,'base64url').toString('utf8')) as {u?:unknown;id?:unknown};
    const updatedAt=typeof parsed.u==='string'?parsed.u:'';const id=typeof parsed.id==='string'?parsed.id:'';
    if(!uuid.test(id)||!updatedAt||Number.isNaN(new Date(updatedAt).getTime()))return null;
    return{updated_at:new Date(updatedAt).toISOString(),id};
  }catch{return null;}
}
