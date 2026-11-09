import { useState } from 'react'
import { Alert, App, Button, Modal, Space, Table, Typography } from 'antd'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchFailedInspections, recallQualityBatch, type AdminInspectionRow } from '@/api/admin/trace'

export default function RecallManage() {
 const {message}=App.useApp()
 const client=useQueryClient()
 const [selected,setSelected]=useState<AdminInspectionRow>()
 const query=useQuery({queryKey:['admin','quality','failed'],queryFn:fetchFailedInspections,retry:false})
 const recall=useMutation({mutationFn:async(row:AdminInspectionRow)=>{
  if(!row.batchId)throw new Error('检测单未关联采收批次，无法召回')
  const result=await recallQualityBatch(row.batchId)
  if(Number(result.status)!==4 || String(result.batchId)!==String(row.batchId))throw new Error('批次冻结回读未确认，请刷新核对，勿重复提交')
  return result
 },onSuccess:()=>{message.success('服务端已确认批次冻结；同主体分仓库存冻结及溯源码作废已在同一事务执行');setSelected(undefined);void client.invalidateQueries({queryKey:['admin','quality']});void client.invalidateQueries({queryKey:['admin','trace']})},onError:(e:Error)=>message.error(e.message)})
 return <Space direction="vertical" size={16} style={{width:'100%'}}>
 <Space style={{justifyContent:'space-between',width:'100%'}}><Typography.Title level={4} style={{margin:0}}>不合格批次与召回</Typography.Title><Button loading={query.isFetching} onClick={()=>void query.refetch()}>刷新</Button></Space>
 <Alert type="warning" showIcon message="召回阻断流通，实际回收处置需独立凭据" description="本页读取用户端真实不合格检测单。召回将冻结同主体采收批次及分仓库存、作废对应单品码；不代表已通知交易相对方、货品已回收或已销毁。不再将浏览器本地登记显示为结案。"/>
 {query.isError?<Alert type="error" message="不合格检测台账读取失败" action={<Button onClick={()=>void query.refetch()}>重试</Button>}/>:null}
 <Table<AdminInspectionRow> rowKey="inspectionId" loading={query.isFetching} dataSource={query.data??[]} scroll={{x:1100}} pagination={{defaultPageSize:20,showSizeChanger:true}} columns={[
 {title:'检测单号',dataIndex:'inspectionNo',width:200,render:(v,r)=>v??r.inspectionId},{title:'批次号',dataIndex:'batchNo',width:180,render:v=>v??'未关联'},{title:'产品',dataIndex:'cropName',width:150,render:v=>v??'—'},
 {title:'检测机构',dataIndex:'labName',width:200,render:v=>v??'—'},{title:'结论',dataIndex:'result',width:100},{title:'操作',key:'action',width:140,fixed:'right',render:(_,r)=><Button danger disabled={!r.batchId} onClick={()=>setSelected(r)}>核验并召回</Button>}
 ]}/>
 <Modal title="确认监管召回" open={Boolean(selected)} confirmLoading={recall.isPending} onCancel={()=>{if(!recall.isPending)setSelected(undefined)}} onOk={()=>{if(selected)recall.mutate(selected)}} okText="冻结批次并作废码" okButtonProps={{danger:true}}><p>检测单：{selected?.inspectionNo??selected?.inspectionId}</p><p>批次：{selected?.batchNo??selected?.batchId}</p><p>请依据实际不合格事实执行。成功后以服务端返回的批次冻结状态为准，不执行退款或销毁。</p></Modal>
 </Space>
}
