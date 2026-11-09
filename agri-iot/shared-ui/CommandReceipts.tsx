import { useEffect, useState } from 'react'
export type CommandReceipt={commandNo:string|null;status:string;action:string;operator:string;result:string;createdAt:string;sentAt:string|null;receiptAt:string|null;expiresAt:string|null;progress?:number;installedVersion?:string|null}
const labels:Record<string,string>={PENDING:'待接入端领取',SENT:'已领取待回执',RUNNING:'升级执行中',SUCCEEDED:'接入端报告成功',FAILED:'接入端报告失败',TIMEOUT:'超时结果未知',LEGACY:'历史未采集回执'}
export default function CommandReceipts({deviceId,load}:{deviceId:number;load:(id:number,page:number)=>Promise<CommandReceipt[]>}) {
 const [rows,setRows]=useState<CommandReceipt[]>([]),[page,setPage]=useState(1),[busy,setBusy]=useState(false),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 useEffect(()=>{
  let active=true,running=false
  const refresh=async()=>{
   if(running)return;running=true;setBusy(true)
   try{const next=await load(deviceId,page);if(active){setRows(next);setError('')}}
   catch(e){if(active){setRows([]);setError(e instanceof Error?e.message:'回执查询失败')}}
   finally{running=false;if(active)setBusy(false)}
  }
  void refresh();const timer=setInterval(()=>void refresh(),10000)
  return()=>{active=false;clearInterval(timer)}
 },[deviceId,page,load,revision])
 return <div style={{width:'100%'}}>
 <p>申请登记不代表执行；结果来自设备或网关接入端回执。超时须人工核实，不自动重发。接入端须按指令编号幂等执行。</p>
 <button type="button" disabled={busy} onClick={()=>setRevision(v=>v+1)}>{busy?'读取中…':'刷新回执'}</button>
 {error&&<p role="alert" style={{color:'#cf1322'}}>{error}</p>}
 <div style={{overflowX:'auto',marginTop:12}}><table style={{width:'100%',minWidth:1100,borderCollapse:'collapse'}}>
 <thead><tr>{['指令编号','动作','状态','申请人','申请时间','领取时间','回执时间','进度/安装版本','执行结果'].map(label=><th key={label} style={{textAlign:'left',padding:8,borderBottom:'1px solid #ddd'}}>{label}</th>)}</tr></thead>
 <tbody>{rows.map((row,index)=><tr key={row.commandNo||index}>{[row.commandNo||'历史记录',row.action,labels[row.status]||row.status,row.operator,row.createdAt,row.sentAt,row.receiptAt,row.progress===undefined?null:`${row.progress}% · ${row.installedVersion||'未报告版本'}`,row.result].map((value,i)=><td key={i} style={{padding:8,borderBottom:'1px solid #eee',wordBreak:'break-word'}}>{value||'—'}</td>)}</tr>)}</tbody>
 </table>{!busy&&!error&&rows.length===0&&<p>暂无指令记录</p>}</div>
 <div style={{display:'flex',gap:12,marginTop:12}}><button type="button" disabled={page===1||busy} onClick={()=>setPage(page-1)}>上一页</button><span>第 {page} 页</span><button type="button" disabled={rows.length<20||busy} onClick={()=>setPage(page+1)}>下一页</button></div>
 </div>
}
