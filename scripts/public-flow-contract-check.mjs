import fs from 'node:fs';

const errors=[];
const inquiry=fs.readFileSync('app/api/inquiries/route.ts','utf8');
const db=fs.readFileSync('lib/db.ts','utf8');
const quote=fs.readFileSync('app/api/quote-list/route.ts','utf8');
const productPage=fs.readFileSync('app/catalogo/[slug]/page.tsx','utf8');

if(/getProductById\s*\(/.test(inquiry))errors.push('API de orçamento não pode consultar produto administrativo diretamente.');
if(!inquiry.includes('getPublicProductsByIds([productId])'))errors.push('Produto único precisa ser revalidado pela consulta pública.');
if(!inquiry.includes('getPublicProductsByIds(parsed.data.items.map'))errors.push('Lista de orçamento precisa revalidar todos os produtos pela consulta pública.');
if(!db.includes("'(p.publish_at IS NULL OR p.publish_at<=now())'")||!db.includes("'(p.unpublish_at IS NULL OR p.unpublish_at>now())'"))errors.push('Catálogo público perdeu a janela de publicação.');
if(!db.includes('p.active=true')||!db.includes('c.active=true'))errors.push('Catálogo público perdeu filtro de produto/categoria ativos.');
if(!quote.includes("p.stock_status==='indisponivel'"))errors.push('Lista compartilhável precisa remover item indisponível.');
if(!productPage.includes('getProductBySlug(slug,Boolean(canPreview))'))errors.push('Página de produto precisa separar publicação pública de preview admin.');
if(!productPage.includes("preview==='1'")||!productPage.includes('isAdmin()'))errors.push('Preview de produto oculto precisa exigir sessão administrativa.');
if(!db.includes("export async function getSitemapProducts():Promise<{slug:string;updated_at:string;featured:boolean}[]>"))errors.push('Sitemap precisa de boundary tipado para não propagar DbRow/unknown.');
if(!db.includes("slug:String(row.slug||''),updated_at:String(row.updated_at||''),featured:Boolean(row.featured)"))errors.push('Sitemap precisa normalizar o retorno SQL antes de gerar MetadataRoute.');

if(errors.length){console.error(`Public Flow Contract Check: ${errors.length} problema(s)`);for(const error of errors)console.error(`- ${error}`);process.exit(1);}
console.log('Public Flow Contract Check: OK (visibilidade pública e orçamento usam a mesma autoridade).');
