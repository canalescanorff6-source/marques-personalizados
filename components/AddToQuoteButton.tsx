'use client';
import { Check, ShoppingBag } from 'lucide-react';
import type { Product } from '@/lib/db';
import { useQuoteList } from './QuoteListProvider';
export default function AddToQuoteButton({product,className='btn btn-primary',label='Adicionar ao orçamento'}:{product:Product;className?:string;label?:string}){
  const {addProduct,includes,setOpen}=useQuoteList();const added=includes(product.id);
  return <button type="button" className={`${className} ${added?'is-added':''}`} onClick={()=>added?setOpen(true):addProduct(product)}>{added?<Check size={17}/>:<ShoppingBag size={17}/>} {added?'Na minha lista':label}</button>;
}
