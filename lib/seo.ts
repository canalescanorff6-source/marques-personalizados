export function jsonLd(value:unknown){return JSON.stringify(value).replace(/</g,'\\u003c');}

export function slugifyText(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);}
