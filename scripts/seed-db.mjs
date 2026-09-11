import { neon } from '@neondatabase/serverless';
if(!process.env.DATABASE_URL){console.error('Defina DATABASE_URL antes de executar npm run db:seed');process.exit(1);}
const sql=neon(process.env.DATABASE_URL);
const categories=[['topos-de-bolo','Topos de bolo',1],['caixinhas-milk','Caixinhas Milk',2],['lembrancinhas','Lembrancinhas',3],['flores','Flores',4],['kits-personalizados','Kits personalizados',5],['outros','Outros',6]];
for(const [slug,name,sort] of categories){await sql`INSERT INTO categories (slug,name,sort_order) VALUES (${slug},${name},${sort}) ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name,sort_order=EXCLUDED.sort_order`;}
const items=[
  ['topo-premium-camadas','Topo Premium em Camadas','topos-de-bolo','Topos de bolo','Topo personalizado com composição em múltiplas camadas, acabamento 3D e identidade visual exclusiva.','/placeholder-topo.svg',1],
  ['caixinha-milk-premium','Caixinha Milk Premium','caixinhas-milk','Caixinhas Milk','Caixinha personalizada com impressão de alta qualidade, corte preciso e acabamento reforçado.','/placeholder-milk.svg',10],
  ['kit-lembrancinhas','Kit de Lembrancinhas','lembrancinhas','Lembrancinhas','Conjunto personalizado para festas, com peças combinando entre si e acabamento profissional.','/placeholder-kit.svg',10]
];
for(let i=0;i<items.length;i++){
  const [slug,name,categorySlug,category,description,image,minQty]=items[i];
  const badge=i===0?'Destaque':'';const customization=JSON.stringify(i===0?[{id:'nome',label:'Nome',type:'text',required:false,placeholder:'Nome para personalizar',options:[]}]:[]);
  await sql`INSERT INTO products (slug,name,category,category_id,description,image_urls,featured,active,stock_status,tags,sort_order,min_quantity,production_time,badge,customization_fields,publish_at,unpublish_at)
    VALUES (${slug},${name},${category},(SELECT id FROM categories WHERE slug=${categorySlug} LIMIT 1),${description},${[image]},${i<2},true,'sob_encomenda',${['premium','personalizado']},${i+1},${minQty},'Consulte o prazo para a data do evento',${badge},${customization}::jsonb,NULL,NULL)
    ON CONFLICT (slug) DO UPDATE SET category=EXCLUDED.category,category_id=EXCLUDED.category_id`;
}
const brand=process.env.NEXT_PUBLIC_SITE_NAME||'Marques Papelaria';const whatsapp=process.env.NEXT_PUBLIC_WHATSAPP_NUMBER||'';const instagram=process.env.NEXT_PUBLIC_INSTAGRAM_URL||'';const location=process.env.NEXT_PUBLIC_LOCATION||'Santa Inês - MA';const email=process.env.NEXT_PUBLIC_CONTACT_EMAIL||'';
await sql`INSERT INTO site_settings (id,brand_name,whatsapp_number,instagram_url,location,contact_email,seo_title) VALUES (1,${brand},${whatsapp},${instagram},${location},${email},${`${brand} | Papelaria Personalizada Premium`}) ON CONFLICT (id) DO UPDATE SET brand_name=CASE WHEN site_settings.brand_name='Marques Papelaria' THEN EXCLUDED.brand_name ELSE site_settings.brand_name END,whatsapp_number=CASE WHEN site_settings.whatsapp_number='' THEN EXCLUDED.whatsapp_number ELSE site_settings.whatsapp_number END,instagram_url=CASE WHEN site_settings.instagram_url='' THEN EXCLUDED.instagram_url ELSE site_settings.instagram_url END,location=CASE WHEN site_settings.location='Santa Inês - MA' THEN EXCLUDED.location ELSE site_settings.location END,contact_email=CASE WHEN site_settings.contact_email='' THEN EXCLUDED.contact_email ELSE site_settings.contact_email END`;
console.log('Seed V6 preparado: categorias, category_id, configurações e itens de demonstração consistentes.');
