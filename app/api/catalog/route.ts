import { getPublicCatalogPage, type CatalogSort, type Product } from '@/lib/db';
import { protectedRateLimit } from '@/lib/security';
import { serverFailure } from '@/lib/observability';
export const dynamic='force-dynamic';
export async function GET(request:Request){
  const limited=await protectedRateLimit(request,'catalog',180,5*60_000);if(!limited.allowed)return Response.json({error:'Muitas consultas. Tente novamente em instantes.'},{status:429});
  const u=new URL(request.url);const page=Math.min(250,Math.max(1,Number(u.searchParams.get('page')||1)||1));const pageSize=Math.min(36,Math.max(1,Number(u.searchParams.get('limit')||18)||18));const category=(u.searchParams.get('category')||'').slice(0,80);const query=(u.searchParams.get('q')||'').slice(0,100);const sort=(['curadoria','novos','preco','nome'].includes(u.searchParams.get('sort')||'')?u.searchParams.get('sort'):'curadoria') as CatalogSort;const ids=(u.searchParams.get('ids')||'').split(',').filter(v=>/^[0-9a-f-]{36}$/i.test(v)).slice(0,60);const stockRaw=u.searchParams.get('stock')||'';const stock=(['disponivel','sob_encomenda','indisponivel'] as const).includes(stockRaw as Product['stock_status'])?stockRaw as Product['stock_status']:undefined;const customizable=u.searchParams.get('customizable')==='1';const tag=(u.searchParams.get('tag')||'').trim().slice(0,40);
  try{const result=await getPublicCatalogPage({page,pageSize,category:category||undefined,query,sort,ids:ids.length?ids:undefined,stock,customizable,tag:tag||undefined});return Response.json(result,{headers:{'cache-control':ids.length?'private, max-age=15':'public, s-maxage=45, stale-while-revalidate=120'}});}catch(e){return await serverFailure('api.catalog',e);}
}
