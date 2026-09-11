'use client';
import { useEffect,useState } from 'react';
export default function SafeImage({src,fallback='/placeholder-topo.svg',...props}:React.ImgHTMLAttributes<HTMLImageElement>&{fallback?:string}){
  const [failed,setFailed]=useState(false);useEffect(()=>{setFailed(false);},[src]);const effective=!failed&&src?src:fallback;
  return <img {...props} src={effective} onError={e=>{if(effective!==fallback)setFailed(true);props.onError?.(e)}}/>;
}
