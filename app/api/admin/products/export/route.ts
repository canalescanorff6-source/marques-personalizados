import { isAdmin } from '@/lib/auth';
import { getProducts, logAdminAction } from '@/lib/db';
import { serverFailure } from '@/lib/observability';

function csvCell(value:unknown){
  const text=String(value??'').replace(/\r?\n/g,' ');
  return `"${text.replace(/"/g,'""')}"`;
}

export async function GET(){
  if(!(await isAdmin())) return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'no-store'}});
  try{
    const products=await getProducts(true);
    const header=['ID','Nome','Slug','Categoria','Descrição','Status','Publicação','Preço (centavos)','Pedido mínimo','Prazo','Badge','Destaque','Tags','Imagens','Personalizações','Personalizações JSON','Publicar em','Retirar em','SEO título','SEO descrição','Atualizado em'];
    const rows=products.map(p=>[
      p.id,p.name,p.slug,p.category,p.description,p.stock_status,p.active?'habilitada':'oculta',p.price_cents??'',p.min_quantity??'',p.production_time,p.badge,p.featured?'sim':'não',p.tags.join(' | '),p.image_urls.join(' | '),
      p.customization_fields.map(f=>`${f.label}${f.required?'*':''} [${f.type}]`).join(' | '),JSON.stringify(p.customization_fields),p.publish_at??'',p.unpublish_at??'',p.seo_title,p.seo_description,p.updated_at
    ]);
    const csv='\uFEFF'+[header,...rows].map(row=>row.map(csvCell).join(';')).join('\r\n');
    await logAdminAction('export','product','',`Catálogo exportado em CSV: ${products.length} produto(s).`);
    return new Response(csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="catalogo-${new Date().toISOString().slice(0,10)}.csv"`,'cache-control':'no-store'}});
  }catch(error){return await serverFailure('admin.products.export',error);}
}
