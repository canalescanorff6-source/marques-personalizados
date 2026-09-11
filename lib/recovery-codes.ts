import crypto from 'crypto';

const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const RAW_CODE=/^[A-HJ-NP-Z2-9]{16}$/;
const DISPLAY_CODE=/^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/;

function key(){const value=process.env.SESSION_SECRET||'';if(value.length<32)throw new Error('SESSION_SECRET deve ter pelo menos 32 caracteres.');return value;}
function randomGroup(size=4){let out='';while(out.length<size){const bytes=crypto.randomBytes(size);for(const byte of bytes){if(out.length>=size)break;out+=ALPHABET[byte%ALPHABET.length];}}return out;}

export function normalizeAdminRecoveryCode(value:string){return value.trim().toUpperCase().replace(/[\s-]+/g,'');}
export function isAdminRecoveryCode(value:string){const normalized=normalizeAdminRecoveryCode(value);return RAW_CODE.test(normalized);}
export function hashAdminRecoveryCode(value:string){const normalized=normalizeAdminRecoveryCode(value);if(!RAW_CODE.test(normalized))throw new Error('RECOVERY_CODE_INVALID');return crypto.createHmac('sha256',key()).update(`admin-recovery:${normalized}`).digest('hex');}
export function generateAdminRecoveryCodes(count=10){const safe=Math.min(Math.max(Math.trunc(count),1),20);const codes=new Set<string>();while(codes.size<safe){const code=[randomGroup(),randomGroup(),randomGroup(),randomGroup()].join('-');if(DISPLAY_CODE.test(code))codes.add(code);}return [...codes];}
