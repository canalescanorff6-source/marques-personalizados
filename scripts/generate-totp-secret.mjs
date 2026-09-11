import crypto from 'node:crypto';

const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
function base32(buffer){let bits='';for(const byte of buffer)bits+=byte.toString(2).padStart(8,'0');let out='';for(let i=0;i<bits.length;i+=5){const chunk=bits.slice(i,i+5).padEnd(5,'0');out+=alphabet[Number.parseInt(chunk,2)];}return out;}
const secret=base32(crypto.randomBytes(20));
const issuer=(process.env.NEXT_PUBLIC_SITE_NAME||'Marques Papelaria').trim()||'Marques Papelaria';
const account=(process.argv[2]||'admin').trim()||'admin';
const label=encodeURIComponent(`${issuer}:${account}`);
const uri=`otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
console.log('# Guarde este segredo fora do repositório e configure-o no ambiente de produção.');
console.log(`ADMIN_TOTP_SECRET=${secret}`);
console.log('\n# URI para adicionar em um autenticador compatível com TOTP:');
console.log(uri);
