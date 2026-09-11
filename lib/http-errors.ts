export type RequestInputFailure={status:400|413|415|428;message:string;code:'INVALID_JSON'|'PAYLOAD_TOO_LARGE'|'UNSUPPORTED_MEDIA_TYPE'|'PRECONDITION_REQUIRED'};

export function classifyRequestInputFailure(error:unknown):RequestInputFailure|null{
  const code=error instanceof Error?error.message:'';
  if(code==='PAYLOAD_TOO_LARGE')return{status:413,message:'Solicitação muito grande.',code};
  if(code==='UNSUPPORTED_MEDIA_TYPE')return{status:415,message:'Formato de dados não suportado.',code};
  if(code==='INVALID_JSON')return{status:400,message:'Dados inválidos.',code};
  if(code==='PRECONDITION_REQUIRED')return{status:428,message:'Os dados exibidos precisam ser atualizados antes desta alteração.',code};
  return null;
}
