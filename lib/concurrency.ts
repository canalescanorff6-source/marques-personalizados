export function normalizeExpectedUpdatedAt(value:unknown){
  if(typeof value!=='string')return null;
  const input=value.trim();
  if(!input||input.length>64)return null;
  const timestamp=Date.parse(input);
  if(!Number.isFinite(timestamp))return null;
  return new Date(timestamp).toISOString();
}

export function requireExpectedUpdatedAt(value:unknown){
  const normalized=normalizeExpectedUpdatedAt(value);
  if(!normalized)throw new Error('PRECONDITION_REQUIRED');
  return normalized;
}

export function expectedUpdatedAtFromRequest(request:Request){
  return requireExpectedUpdatedAt(new URL(request.url).searchParams.get('expected_updated_at'));
}

export function requireExpectedVersion(value:unknown){
  const version=typeof value==='number'?value:Number(value);
  if(!Number.isInteger(version)||version<1)throw new Error('PRECONDITION_REQUIRED');
  return version;
}

export function expectedVersionFromRequest(request:Request){
  return requireExpectedVersion(new URL(request.url).searchParams.get('expected_version'));
}
