import { GreenSupplyWorkspace, type GreenRequest } from '../../../../agri-portal/frontend/src/components/GreenSupplyWorkspace'
import { cloudFactoryRequest } from '../api'
const opsRequest:GreenRequest=async<T,>(path:string,body?:unknown):Promise<T>=>{
 if(path==='public/green/factor'){
  const rows=await cloudFactoryRequest<{status:string}[]>('/green/factor');
  return rows.filter(r=>r.status==='published') as T
 }
 return cloudFactoryRequest<T>('/'+path.replace(/^ops\//,''),body)
}
export function GreenSupplyOpsPage():JSX.Element{
 return <GreenSupplyWorkspace request={opsRequest} ops/>
}
