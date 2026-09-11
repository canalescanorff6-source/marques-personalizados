'use client';
import { useEffect,useState } from 'react';
import { Activity,ChevronRight } from 'lucide-react';
import { fetchJson } from '@/lib/client';

type Summary={database:{ok:boolean};schema:{ok:boolean;version:number};integrity:{ok:boolean};audit_integrity:{ok:boolean};storage:{ok:boolean;state:string;configured:boolean;required:boolean};backup_freshness:{ok:boolean;state:string;age_hours:number|null;max_age_hours:number};recovery_drill:{ok:boolean;state:string;age_hours:number|null;max_age_hours:number};media_backup:{ok:boolean;state:string;age_hours:number|null;max_age_hours:number};media_recovery_drill:{ok:boolean;state:string;age_hours:number|null;max_age_hours:number};release:{id:string};incident_summary:{open:number;critical:number;unacknowledged:number}};
export default function OperationsAlertBanner({onOpen}:{onOpen:()=>void}){
  const [data,setData]=useState<Summary|null>(null);
  useEffect(()=>{let active=true;fetchJson<Summary>('/api/admin/operations?summary=1',{},8000).then(result=>{if(active)setData(result);}).catch(()=>{});return()=>{active=false;};},[]);
  if(!data)return null;const storageUnhealthy=(!data.storage.ok)&&(data.storage.configured||data.storage.required||data.storage.state==='partial-config');const backupUnhealthy=!data.backup_freshness.ok;const recoveryDrillUnhealthy=!data.recovery_drill.ok;const mediaBackupUnhealthy=!data.media_backup.ok;const mediaRecoveryDrillUnhealthy=!data.media_recovery_drill.ok;const unhealthy=!data.database.ok||!data.schema.ok||!data.integrity.ok||!data.audit_integrity.ok||storageUnhealthy||backupUnhealthy||recoveryDrillUnhealthy||mediaBackupUnhealthy||mediaRecoveryDrillUnhealthy;const count=data.incident_summary.unacknowledged;
  if(!unhealthy&&!count)return null;
  return <button type="button" className={`operations-alert-banner ${data.incident_summary.critical||unhealthy?'critical':''}`} onClick={onOpen}><Activity size={18}/><span><strong>{unhealthy?'Operação requer atenção':`${count} incidente(s) operacional(is) novo(s)`}</strong><small>{unhealthy?`Banco/schema/storage/backups/recovery drill precisam de revisão • schema ${data.schema.version} • ${data.release.id}`:`${data.incident_summary.open} incidente(s) aberto(s) na central operacional`}</small></span><ChevronRight size={18}/></button>;
}
