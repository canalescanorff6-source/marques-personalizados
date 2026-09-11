export function normalizeWhatsapp(value:string){
  const digits=(value||'').replace(/\D/g,'');
  if(!digits)return '';
  if((digits.length===10||digits.length===11)&&!digits.startsWith('55'))return `55${digits}`;
  if(digits.startsWith('55')&&(digits.length===12||digits.length===13))return digits;
  if(digits.length>=10&&digits.length<=15)return digits;
  return '';
}
export function whatsappUrl(number:string,message?:string){
  const phone=normalizeWhatsapp(number);if(!phone)return '';
  const base=`https://wa.me/${phone}`;return message?`${base}?text=${encodeURIComponent(message)}`:base;
}
