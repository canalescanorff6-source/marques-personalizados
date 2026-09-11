'use client';
import { useId } from 'react';
import type { ProductCustomizationField } from '@/lib/db';
export default function ProductCustomizationFields({fields,values,onChange,disabled=false}:{fields:ProductCustomizationField[];values:Record<string,string>;onChange:(id:string,value:string)=>void;disabled?:boolean}){
  const uid=useId().replace(/:/g,'');
  return <div className="product-custom-fields">{fields.map(field=>{const inputId=`${uid}-${field.id}`;return <div className="field" key={field.id}><label htmlFor={inputId}>{field.label}{field.required&&<span className="required-mark" aria-hidden="true"> *</span>}</label>{field.type==='select'?<select id={inputId} value={values[field.id]||''} onChange={e=>onChange(field.id,e.target.value)} required={field.required} disabled={disabled}><option value="">Selecione</option>{field.options.map(option=><option key={option} value={option}>{option}</option>)}</select>:<input id={inputId} type={field.type==='number'?'number':'text'} inputMode={field.type==='number'?'numeric':undefined} maxLength={field.type==='text'?200:undefined} placeholder={field.placeholder||undefined} value={values[field.id]||''} onChange={e=>onChange(field.id,e.target.value)} required={field.required} disabled={disabled}/>}</div>})}</div>;
}
