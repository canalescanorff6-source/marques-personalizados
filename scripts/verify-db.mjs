import process from 'node:process';
import { neon } from '@neondatabase/serverless';
import { verifyRuntimeDb } from './db-runtime-contract.mjs';
const url=process.env.DATABASE_URL;
if(!url){console.error('DATABASE_URL não configurada.');process.exit(1);}
const sql=neon(url);
try{
  const result=await verifyRuntimeDb(sql);
  if(!result.ok){console.error(`Neon Runtime Contract: ${result.errors.length} problema(s)`);for(const error of result.errors)console.error(`- ${error}`);process.exit(1);}
  console.log(`Neon Runtime Contract: OK (${result.tables.length} tabelas críticas verificadas).`);
}catch(error){console.error('Não foi possível verificar o Neon:',error);process.exit(1);}
