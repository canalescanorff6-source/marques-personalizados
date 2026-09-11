export type PublishableProductShape={
  name:string;slug:string;category:string;description:string;image_urls:string[];production_time:string;
};

export function productPublishIssues(product:PublishableProductShape){
  const issues:string[]=[];
  if(product.name.trim().length<2)issues.push('nome');
  if(product.slug.trim().length<2)issues.push('slug');
  if(product.category.trim().length<2)issues.push('categoria');
  if(product.description.trim().length<20)issues.push('descrição com pelo menos 20 caracteres');
  if(!product.image_urls.some(url=>url.trim().length>0))issues.push('imagem principal');
  if(!product.production_time.trim())issues.push('prazo de produção');
  return issues;
}
export function publishIssuesMessage(issues:string[]){return `Antes de publicar, complete: ${issues.join(', ')}.`;}
