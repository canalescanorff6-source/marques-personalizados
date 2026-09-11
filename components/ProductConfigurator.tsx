'use client';
import { useMemo, useState } from 'react';
import { Check, SlidersHorizontal } from 'lucide-react';
import type { Product } from '@/lib/db';
import ProductCustomizationFields from './ProductCustomizationFields';
import { useQuoteList } from './QuoteListProvider';

export default function ProductConfigurator({product}:{product:Product}){
  const fields=product.customization_fields||[];const {addProduct,includes,items}=useQuoteList();const existing=items.find(item=>item.product_id===product.id);const [values,setValues]=useState<Record<string,string>>(()=>existing?.customizations||{});const [error,setError]=useState('');
  const complete=useMemo(()=>fields.every(field=>!field.required||Boolean((values[field.id]||'').trim())),[fields,values]);
  function change(id:string,value:string){setValues(current=>({...current,[id]:value}));setError('');}
  function add(){if(!complete){setError('Preencha os campos obrigatórios antes de adicionar esta peça.');return;}const cleaned=Object.fromEntries(Object.entries(values).filter((entry):entry is [string,string]=>typeof entry[1]==='string'&&Boolean(entry[1].trim())).map(([key,value])=>[key,value.trim()]));addProduct(product,cleaned);}
  const added=includes(product.id);
  return <section className="product-configurator" id="personalizacao-produto"><div className="product-configurator-head"><span><SlidersHorizontal size={16}/> PERSONALIZAÇÃO DESTA PEÇA</span><h3>Deixe os detalhes preparados para o orçamento.</h3><p>Você poderá revisar a quantidade e combinar este item com outras peças na Minha Lista.</p></div><ProductCustomizationFields fields={fields} values={values} onChange={change}/>{error&&<div className="error" role="alert">{error}</div>}<button type="button" className={`btn btn-primary ${added?'is-added':''}`} onClick={add}>{added?<Check size={17}/>:<SlidersHorizontal size={17}/>} {added?'Atualizar personalização':'Adicionar configurado à lista'}</button></section>;
}
