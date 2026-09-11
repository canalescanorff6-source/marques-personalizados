import crypto from 'crypto';
import { recordAdminSecurityEvent, type AdminSecurityEvent } from './db';

type SecurityEventInput={eventType:AdminSecurityEvent['event_type'];severity:AdminSecurityEvent['severity'];deviceHash?:string;deviceLabel?:string;summary:string};
type DeliveryResult={enabled:boolean;sent:boolean;skipped?:boolean;status?:number;error?:string};

function safeExternalHostname(hostname:string){
  const host=hostname.toLowerCase().replace(/^\[|\]$/g,'');
  if(host==='localhost'||host==='0.0.0.0'||host==='::1'||host.endsWith('.local'))return false;
  if(/^127\./.test(host)||/^10\./.test(host)||/^192\.168\./.test(host)||/^169\.254\./.test(host))return false;
  const v4=host.match(/^172\.(\d{1,3})\./);if(v4){const second=Number(v4[1]);if(second>=16&&second<=31)return false;}
  return true;
}

function alertConfig(){
  const rawUrl=(process.env.ADMIN_SECURITY_WEBHOOK_URL||'').trim();
  const secret=(process.env.ADMIN_SECURITY_WEBHOOK_SECRET||'').trim();
  if(!rawUrl)return{enabled:false,url:'',secret,valid:true};
  try{
    const url=new URL(rawUrl);
    const production=process.env.NODE_ENV==='production';
    const valid=['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&(!production||(url.protocol==='https:'&&safeExternalHostname(url.hostname)&&secret.length>=32));
    return{enabled:true,url:url.toString(),secret,valid};
  }catch{return{enabled:true,url:rawUrl,secret,valid:false};}
}

function selectedEvent(eventType:AdminSecurityEvent['event_type'],severity:AdminSecurityEvent['severity']){
  const raw=(process.env.ADMIN_SECURITY_WEBHOOK_EVENTS||'').trim();
  if(!raw)return severity==='warning'||severity==='critical';
  const selected=new Set(raw.split(',').map(value=>value.trim()).filter(Boolean));
  return selected.has('*')||selected.has(eventType)||selected.has(severity);
}

export function getAdminSecurityWebhookStatus(){
  const config=alertConfig();
  return{configured:config.enabled,valid:config.valid,signed:Boolean(config.secret)};
}

export async function deliverAdminSecurityAlert(input:SecurityEventInput,eventId:number|null):Promise<DeliveryResult>{
  const config=alertConfig();
  if(!config.enabled)return{enabled:false,sent:false,skipped:true};
  if(!selectedEvent(input.eventType,input.severity))return{enabled:true,sent:false,skipped:true};
  if(!config.valid)return{enabled:true,sent:false,error:'WEBHOOK_URL_INVALID'};
  const timestamp=new Date().toISOString();
  const payload=JSON.stringify({
    version:1,
    event_id:eventId,
    event_type:input.eventType,
    severity:input.severity,
    summary:input.summary.slice(0,500),
    device_label:(input.deviceLabel||'').slice(0,120),
    occurred_at:timestamp,
    site:(process.env.NEXT_PUBLIC_SITE_URL||'').slice(0,240),
  });
  const headers:Record<string,string>={'content-type':'application/json','user-agent':'Marques-Catalog-Security/1.0','x-marques-event':input.eventType,'x-marques-timestamp':timestamp};
  if(config.secret)headers['x-marques-signature']=`sha256=${crypto.createHmac('sha256',config.secret).update(payload).digest('hex')}`;
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),2_500);
  try{
    const response=await fetch(config.url,{method:'POST',headers,body:payload,signal:controller.signal,cache:'no-store'});
    return response.ok?{enabled:true,sent:true,status:response.status}:{enabled:true,sent:false,status:response.status,error:`HTTP_${response.status}`};
  }catch(error){return{enabled:true,sent:false,error:error instanceof Error?error.name:'DELIVERY_ERROR'};}
  finally{clearTimeout(timer);}
}

export async function recordAdminSecurityEventWithAlert(input:SecurityEventInput){
  let eventId:number|null=null;try{eventId=await recordAdminSecurityEvent(input);}catch{}
  const delivery=await deliverAdminSecurityAlert(input,eventId);
  if(delivery.enabled&&!delivery.sent&&!delivery.skipped&&input.eventType!=='security_webhook_failed'){
    await recordAdminSecurityEvent({eventType:'security_webhook_failed',severity:'warning',deviceHash:input.deviceHash,deviceLabel:input.deviceLabel,summary:`Falha ao entregar alerta externo (${delivery.error||delivery.status||'sem resposta'}).`}).catch(()=>null);
  }
  return{eventId,delivery};
}
