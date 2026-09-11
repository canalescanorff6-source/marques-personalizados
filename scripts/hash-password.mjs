import crypto from 'node:crypto';
import process from 'node:process';
const password=process.argv[2];
if(!password||password.length<12){console.error('Uso: npm run admin:hash-password -- "uma-senha-com-12-ou-mais-caracteres"');process.exit(1);}
const salt=crypto.randomBytes(16);const hash=crypto.scryptSync(password,salt,64);console.log(`ADMIN_PASSWORD_HASH=scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
