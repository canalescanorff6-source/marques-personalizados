import crypto from 'crypto';
import { recordOperationalIncident } from './db';
import { classifyRequestInputFailure } from './http-errors';

export function errorReference(prefix='ERR') {
  return `${prefix}-${crypto.randomUUID().slice(0,8)}`;
}

function safeErrorName(error:unknown){return error instanceof Error?(error.name||'Error'):'Error';}
function safeErrorMessage(error:unknown){
  const raw=error instanceof Error?error.message:String(error);
  return raw
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi,'[DATABASE_URL]')
    .replace(/(password|secret|token|authorization|cookie|api[_-]?key)\s*[=:]\s*[^\s,;]+/gi,'$1=[REDACTED]')
    .replace(/bearer\s+[A-Za-z0-9._~+\/-]+/gi,'Bearer [REDACTED]')
    .slice(0,500);
}
function incidentFingerprint(scope:string,error:unknown,status:number){
  const basis=`${scope}|${safeErrorName(error)}|${status}|${safeErrorMessage(error).replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'[id]').replace(/\d+/g,'#')}`;
  return crypto.createHash('sha256').update(basis).digest('hex');
}

export function logServerError(scope:string, error:unknown, reference=errorReference()) {
  const message = safeErrorMessage(error);
  console.error(JSON.stringify({level:'error',scope,reference,error_name:safeErrorName(error),message,timestamp:new Date().toISOString()}));
  return reference;
}

export async function serverFailure(scope:string, error:unknown, status=500, publicMessage='Não foi possível concluir a operação.') {
  const inputFailure=status===500?classifyRequestInputFailure(error):null;
  if(inputFailure)return Response.json({ok:false,error:inputFailure.message,code:inputFailure.code},{status:inputFailure.status,headers:{'cache-control':'no-store'}});
  const reference = logServerError(scope,error);
  const severity=status>=500?'error':'warning';
  await Promise.race([recordOperationalIncident({fingerprint:incidentFingerprint(scope,error,status),scope,severity,statusCode:status,errorName:safeErrorName(error),message:safeErrorMessage(error),reference}).catch(()=>null),new Promise(resolve=>setTimeout(resolve,900))]);
  return Response.json({ok:false,error:publicMessage,reference},{status,headers:{'cache-control':'no-store','x-error-reference':reference}});
}
