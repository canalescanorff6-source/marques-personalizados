'use client';
import { Printer } from 'lucide-react';
export default function PrintProposalButton(){return <button type="button" className="btn btn-primary no-print" onClick={()=>window.print()}><Printer size={16}/> Imprimir / salvar PDF</button>;}
