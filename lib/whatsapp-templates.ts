export const DEFAULT_WHATSAPP_TEMPLATES = {
  whatsapp_template_first_contact: 'Olá, {nome}! Tudo bem? Aqui é da {marca}. Recebi sua solicitação sobre {interesse}{data}. Vou te ajudar a montar a melhor opção para o seu evento.',
  whatsapp_template_follow_up: 'Oi, {nome}! Passando para acompanhar seu pedido de {interesse}{data}. Ficou alguma dúvida ou quer que eu ajuste alguma opção para você?',
  whatsapp_template_quote_ready: 'Oi, {nome}! Seu orçamento de {interesse} está pronto{valor}. Posso te explicar os detalhes e próximos passos por aqui.',
  whatsapp_template_confirmation: 'Oi, {nome}! Estou passando para confirmar os detalhes do seu pedido de {interesse}{data}. Assim garantimos que produção, personalização e prazo fiquem certinhos.',
  whatsapp_template_review_request: 'Oi, {nome}! Foi um prazer preparar seu pedido com a {marca}. Se você gostou do resultado, sua avaliação ajuda muito nosso trabalho a chegar a mais pessoas. Você pode avaliar aqui: {link_avaliacao}',
  whatsapp_template_repurchase: 'Oi, {nome}! Tudo bem? Aqui é da {marca}. A data do seu evento do ano passado está se aproximando e eu queria saber se este ano você vai comemorar novamente ou preparar algum outro evento. Se quiser, posso te enviar novas ideias de papelaria personalizada sem compromisso.',
  whatsapp_template_approval: 'Oi, {nome}! A arte do seu pedido de {interesse} está pronta para aprovação. Quando puder, confira os detalhes para seguirmos com a produção.',
  whatsapp_template_ready: 'Oi, {nome}! Seu pedido de {interesse} está pronto. Podemos combinar a entrega ou retirada{data}. Obrigado por escolher a {marca}!',
} as const;

export type WhatsappTemplateField = keyof typeof DEFAULT_WHATSAPP_TEMPLATES;

export const WHATSAPP_TEMPLATE_VARIABLES = [
  '{nome}', '{marca}', '{interesse}', '{data}', '{valor}', '{saldo}', '{link_avaliacao}', '{localizacao}'
] as const;

export type WhatsappTemplateVariables = {
  nome?: string;
  marca?: string;
  interesse?: string;
  data?: string;
  valor?: string;
  saldo?: string;
  link_avaliacao?: string;
  localizacao?: string;
};

export function renderWhatsappTemplate(template:string, variables:WhatsappTemplateVariables){
  return String(template||'').replace(/\{([a-z_]+)\}/gi,(full,key)=>{
    const value=variables[key as keyof WhatsappTemplateVariables];
    return value==null?full:String(value);
  }).replace(/\s{2,}/g,' ').trim();
}


export function findUnknownWhatsappTemplateVariables(template:string){
  const known=new Set(WHATSAPP_TEMPLATE_VARIABLES.map(item=>item.slice(1,-1)));
  const found=[...String(template||'').matchAll(/\{([a-z_]+)\}/gi)].map(match=>match[1].toLowerCase());
  return [...new Set(found.filter(key=>!known.has(key)))];
}
