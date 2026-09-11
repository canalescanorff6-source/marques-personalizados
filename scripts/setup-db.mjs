import fs from 'node:fs';
import process from 'node:process';
import { neon } from '@neondatabase/serverless';
import { splitSqlStatements } from './sql-splitter.mjs';
import { verifyRuntimeDb } from './db-runtime-contract.mjs';
const url=process.env.DATABASE_URL;if(!url){console.error('DATABASE_URL não configurada.');process.exit(1);}const sql=neon(url);const source=fs.readFileSync(new URL('../sql/schema.sql',import.meta.url),'utf8');const statements=splitSqlStatements(source);for(let i=0;i<statements.length;i++){try{await sql.query(statements[i]);process.stdout.write(`\rAplicando schema: ${i+1}/${statements.length}`);}catch(error){console.error(`\nFalha na instrução ${i+1}:\n${statements[i].slice(0,500)}\n`,error);process.exit(1);}}console.log(`\nSchema V6 aplicado com ${statements.length} instruções.`);const verification=await verifyRuntimeDb(sql);if(!verification.ok){console.error('Verificação pós-migração falhou:');for(const issue of verification.errors)console.error(`- ${issue}`);process.exit(1);}console.log(`Neon Runtime Contract: OK (${verification.tables.length} tabelas críticas).`);
