import crypto from 'node:crypto';

const extensions:Record<string,string>={'image/png':'png','image/webp':'webp','image/jpeg':'jpg'};

export function mediaDigest(buffer:Uint8Array){return crypto.createHash('sha256').update(buffer).digest('hex');}

export function contentAddressedMediaKey(buffer:Uint8Array,contentType:string){
  const ext=extensions[contentType];if(!ext)throw new Error('UNSUPPORTED_MEDIA_TYPE');
  const digest=mediaDigest(buffer);
  return{digest,key:`catalog/sha256/${digest.slice(0,2)}/${digest}.${ext}`};
}
