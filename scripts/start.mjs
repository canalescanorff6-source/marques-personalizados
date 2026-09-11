import { spawn } from 'node:child_process';
import process from 'node:process';
const port=process.env.PORT||'8080';
const child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','0.0.0.0','-p',port],{stdio:'inherit',env:process.env});
let stopping=false;let killTimer;
function shutdown(signal){
  if(stopping)return;stopping=true;
  console.log(`[runtime] ${signal} recebido; encerrando Next.js com tolerância de 8s.`);
  if(!child.killed)child.kill(signal);
  killTimer=setTimeout(()=>{if(child.exitCode===null)child.kill('SIGKILL');},8000);killTimer.unref?.();
}
process.on('SIGTERM',()=>shutdown('SIGTERM'));process.on('SIGINT',()=>shutdown('SIGINT'));
child.on('exit',code=>{if(killTimer)clearTimeout(killTimer);process.exit(code??(stopping?0:1));});
child.on('error',err=>{console.error(err);process.exit(1);});
