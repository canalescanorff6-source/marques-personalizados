import { isAdmin } from '@/lib/auth';
import { createProduct, getCategories, getProducts, logAdminAction } from '@/lib/db';
import { parseDelimitedCsv, csvHeaderKey } from '@/lib/csv';
import { slugifyText } from '@/lib/seo';
import { productSchema } from '@/lib/validation';
import { readJsonBody, sameOriginRequest } from '@/lib/security';
import { serverFailure } from '@/lib/observability';

type ProductInput=Parameters<typeof createProduct>[0];
type Preview={row:number;name:string;slug:string;category:string;ok:boolean;errors:string[];input?:ProductInput};
function splitList(value:string){return value.split(/\s*\|\s*|\s*,\s*/).map(x=>x.trim()).filter(Boolean);}
function intOrNull(value:string){if(!value.trim())return null;const n=Number(value.replace(/[^0-9-]/g,''));return Number.isInteger(n)?n:null;}
function isoOrNull(value:string){if(!value.trim())return null;const d=new Date(value);return Number.isNaN(d.getTime())?null:d.toISOString();}
function truthy(value:string){return /^(sim|yes|true|1)$/i.test(value.trim());}
function normalizeStock(value:string){const v=csvHeaderKey(value);return v==='disponivel'?'disponivel':v==='indisponivel'?'indisponivel':'sob_encomenda';}
function parseCustom(value:string){if(!value.trim())return[];try{const parsed=JSON.parse(value);return Array.isArray(parsed)?parsed:[];}catch{return[];}}

export async function POST(request:Request){
  if(!(await isAdmin()))return Response.json({error:'Não autorizado.'},{status:401,headers:{'cache-control':'no-store'}});
  if(!sameOriginRequest(request))return Response.json({error:'Origem inválida.'},{status:403});
  try{
    const body=await readJsonBody(request,900_000);const csv=String(body.csv||'');const commit=body.commit===true;
    if(!csv.trim())return Response.json({error:'Selecione um CSV válido.'},{status:400});
    const matrix=parseDelimitedCsv(csv,';');if(matrix.length<2)return Response.json({error:'O CSV precisa ter cabeçalho e ao menos uma linha.'},{status:400});
    if(matrix.length-1>100)return Response.json({error:'Importe no máximo 100 produtos por arquivo.'},{status:413});
    const headers=matrix[0].map(csvHeaderKey);const get=(cells:string[],...names:string[])=>{for(const name of names){const idx=headers.indexOf(name);if(idx>=0)return String(cells[idx]||'').trim();}return'';};
    const categories=await getCategories(true);const activeCategories=categories.filter(c=>c.active);const byCategory=new Map<string,string>();for(const c of activeCategories){byCategory.set(csvHeaderKey(c.name),c.name);byCategory.set(csvHeaderKey(c.slug),c.name);}
    const current=await getProducts(true);const usedSlugs=new Set(current.map(p=>p.slug));const seen=new Set<string>();const preview:Preview[]=[];
    for(let i=1;i<matrix.length;i++){
      const cells=matrix[i];const name=get(cells,'nome','name');const rawCategory=get(cells,'categoria','category');const category=byCategory.get(csvHeaderKey(rawCategory))||rawCategory;const slug=get(cells,'slug')||slugifyText(name);const errors:string[]=[];
      if(!name)errors.push('Nome ausente.');if(!slug)errors.push('Slug inválido.');if(!byCategory.has(csvHeaderKey(rawCategory)))errors.push('Categoria ativa não encontrada.');if(usedSlugs.has(slug)||seen.has(slug))errors.push('Slug já existe ou está repetido no arquivo.');seen.add(slug);
      const customRaw=get(cells,'personalizacoes_json','personalizacao_json','customization_fields_json');
      const input={slug,name,category,description:get(cells,'descricao','description')||'Produto importado como rascunho. Revise a descrição antes de publicar.',price_cents:intOrNull(get(cells,'preco_centavos','preco_em_centavos','price_cents')),image_urls:splitList(get(cells,'imagens','image_urls')).slice(0,10),featured:false,active:false,stock_status:normalizeStock(get(cells,'status','stock_status')),tags:splitList(get(cells,'tags')).slice(0,16),sort_order:intOrNull(get(cells,'ordem','sort_order'))??0,min_quantity:intOrNull(get(cells,'pedido_minimo','min_quantity')),production_time:get(cells,'prazo','prazo_de_producao','production_time').slice(0,100),seo_title:get(cells,'seo_titulo','seo_title').slice(0,70),seo_description:get(cells,'seo_descricao','seo_description').slice(0,170),badge:get(cells,'badge').slice(0,30),customization_fields:parseCustom(customRaw),publish_at:isoOrNull(get(cells,'publicar_em','publish_at')),unpublish_at:isoOrNull(get(cells,'retirar_em','unpublish_at'))};
      const parsed=productSchema.safeParse(input);if(!parsed.success)for(const issue of parsed.error.issues.slice(0,4))errors.push(`${issue.path.join('.')||'produto'}: ${issue.message}`);
      preview.push({row:i+1,name,slug,category,ok:errors.length===0,errors,input:errors.length?undefined:parsed.success?parsed.data:undefined});
    }
    if(!commit)return Response.json({rows:preview.map(({input,...row})=>row),valid:preview.filter(r=>r.ok).length,invalid:preview.filter(r=>!r.ok).length,total:preview.length},{headers:{'cache-control':'no-store'}});
    const created=[];const failed=[];
    for(const row of preview){if(!row.ok||!row.input){failed.push({row:row.row,name:row.name,errors:row.errors});continue;}try{created.push(await createProduct(row.input));}catch(error){failed.push({row:row.row,name:row.name,errors:[error instanceof Error?error.message:'Falha ao criar produto.']});}}
    await logAdminAction('import','product','',`CSV importado: ${created.length} rascunho(s) criado(s), ${failed.length} linha(s) ignorada(s).`);
    return Response.json({products:created,created:created.length,failed,total:preview.length},{headers:{'cache-control':'no-store'}});
  }catch(error){const msg=error instanceof Error?error.message:'';if(msg==='PAYLOAD_TOO_LARGE')return Response.json({error:'O arquivo excede o limite de importação.'},{status:413});if(msg==='INVALID_JSON')return Response.json({error:'Requisição inválida.'},{status:400});return await serverFailure('admin.products.import',error);}
}
