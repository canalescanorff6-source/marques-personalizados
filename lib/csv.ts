export function parseDelimitedCsv(source:string,delimiter=';'){
  const text=source.replace(/^\uFEFF/,'');const rows:string[][]=[];let row:string[]=[];let cell='';let quoted=false;
  for(let i=0;i<text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch==='"'&&text[i+1]==='"'){cell+='"';i++;continue;}
      if(ch==='"'){quoted=false;continue;}
      cell+=ch;continue;
    }
    if(ch==='"'){quoted=true;continue;}
    if(ch===delimiter){row.push(cell);cell='';continue;}
    if(ch==='\n'||ch==='\r'){
      if(ch==='\r'&&text[i+1]==='\n')i++;
      row.push(cell);cell='';if(row.some(value=>value.trim()!==''))rows.push(row);row=[];continue;
    }
    cell+=ch;
  }
  row.push(cell);if(row.some(value=>value.trim()!==''))rows.push(row);
  return rows;
}
export function csvHeaderKey(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'');}
