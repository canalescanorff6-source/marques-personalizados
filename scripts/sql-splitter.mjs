export function splitSqlStatements(sql){
  const out=[];let current='';let single=false,double=false;let lineComment=false,blockComment=false;let dollar='';
  for(let i=0;i<sql.length;i++){
    const ch=sql[i],next=sql[i+1]||'';
    if(lineComment){current+=ch;if(ch==='\n')lineComment=false;continue;}
    if(blockComment){current+=ch;if(ch==='*'&&next==='/'){current+=next;i++;blockComment=false;}continue;}
    if(!single&&!double&&!dollar&&ch==='-'&&next==='-'){current+=ch+next;i++;lineComment=true;continue;}
    if(!single&&!double&&!dollar&&ch==='/'&&next==='*'){current+=ch+next;i++;blockComment=true;continue;}
    if(!single&&!double){
      if(dollar){if(sql.startsWith(dollar,i)){current+=dollar;i+=dollar.length-1;dollar='';continue;}current+=ch;continue;}
      if(ch==='$'){const m=sql.slice(i).match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);if(m){dollar=m[0];current+=dollar;i+=dollar.length-1;continue;}}
    }
    if(!double&&ch==="'"&&!dollar){current+=ch;if(single&&next==="'"){current+=next;i++;continue;}single=!single;continue;}
    if(!single&&ch==='"'&&!dollar){current+=ch;double=!double;continue;}
    if(ch===';'&&!single&&!double&&!dollar){const stmt=current.trim();if(stmt)out.push(stmt);current='';continue;}
    current+=ch;
  }
  const tail=current.trim();if(tail)out.push(tail);return out;
}
