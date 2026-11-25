import { useState } from 'react'
import { Alert, Button, Empty, Space, Tag, Timeline } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import type { ProColumns } from '@ant-design/pro-components'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import ListRowActions from '@/components/ListRowActions'
import { fetchAdminTraceChain, type AdminInspectionRow } from '@/api/admin/trace'
import { Card, Table, QualityPage, LoadError, codeName, resultName, InspectionDetail } from '../quality/QualityShared'

export default function Detail(){
  const {code=''}=useParams(),nav=useNavigate()
  const [active,setActive]=useState<string>()
  const query=useQuery({queryKey:['admin','trace','chain',code],queryFn:()=>fetchAdminTraceChain(code),enabled:!!code,retry:false})
  const d=query.data,c=d?.traceCode,b=d?.batch
  const cols:ProColumns<AdminInspectionRow>[]=[
    {title:'检测单号',dataIndex:'inspectionNo',width:210,render:(_,r)=><Button type="link" onClick={()=>setActive(r.inspectionId)}>{r.inspectionNo||r.inspectionId}</Button>},
    {title:'机构',dataIndex:'labName',width:200},{title:'抽样时间',dataIndex:'sampleAt',width:180},
    {title:'结论',width:110,render:(_,r)=><Tag color={r.result==='FAIL'?'red':r.result==='PASS'?'green':'default'}>{resultName(r.result)}</Tag>},
    {title:'操作',valueType:'option',width:120,render:(_,r)=><ListRowActions items={[<Button key="detail" type="link" size="small" onClick={()=>setActive(r.inspectionId)}>报告详情</Button>]}/>},
  ]
  return <QualityPage title="溯源监管详情" subTitle={code} extra={<Button onClick={()=>nav('/admin/production/trace/codes')}>返回台账</Button>}>
    <LoadError error={query.error}/>
    {query.isFetching&&<Card loading/>}
    {d&&!d.found&&<Empty description="未找到该溯源码"/>}
    {c&&<div className="quality-detail quality-detail-stack">
      <Card title="单品码档案" extra={<Space size={4}><Tag>{codeName(c.status)}</Tag><Tag color={c.onChain?'green':'default'}>{c.onChain?'已上链':'未确认上链'}</Tag></Space>}>
        <DetailInfoGrid columns={3} items={[
          {key:'code',label:'溯源码',value:c.code,fullWidth:true},{key:'batch',label:'批次号',value:c.batchNo},
          {key:'scan',label:'扫码次数',value:c.scanCount},{key:'expire',label:'有效期',value:c.expireDate||'未设置'},
          {key:'activate',label:'激活时间',value:c.activateTime||'未激活'},{key:'create',label:'生成时间',value:c.createdAt},
        ]}/>
      </Card>
      <Card title="批次来源" extra={b?.batchNo&&<Button size="small" onClick={()=>nav(`/admin/production/quality/inspections?batchNo=${encodeURIComponent(b.batchNo!)}`)}>批次检测台账</Button>}>
        {b?<DetailInfoGrid columns={3} items={[
          {key:'no',label:'批次号',value:b.batchNo},{key:'crop',label:'产品',value:b.cropName},{key:'farm',label:'农场',value:b.farmName},
          {key:'harvest',label:'采收日期',value:b.harvestDate},{key:'qty',label:'数量',value:b.quantity},
          {key:'state',label:'管控状态',value:<Tag color={Number(b.status)===4?'red':'default'}>{Number(b.status)===4?'已冻结':'未冻结'}</Tag>},
        ]}/>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未关联有效批次"/>}
      </Card>
      <Card title="检测与风险记录"><Table<AdminInspectionRow> rowKey="inspectionId" memberListToolbar rowSelection={{}} cardProps={false} columns={cols} dataSource={d?.inspections??[]} search={false} pagination={{defaultPageSize:20,showSizeChanger:true}} scroll={{x:820}} options={{reload:()=>void query.refetch()}}/></Card>
      <Card title="真实生产链路" extra={<span className="quality-detail-muted">{d?.nodes?.length??0} 个关联节点</span>}>
        {d?.nodes?.length?<Timeline className="quality-trace-timeline" items={d.nodes.map((n,index)=>({key:`${n.nodeType}-${n.refId}-${index}`,color:n.onChain?'green':'blue',children:<div className="quality-trace-node">
          <div className="quality-trace-node-heading"><strong>{n.nodeName||n.nodeType}</strong><span className="quality-detail-muted">{n.occurredAt?.replace('T',' ')||'未登记时间'}</span><Tag color={n.onChain?'green':'default'}>{n.onChain?'已上链':n.chainStatus||'无成功存证'}</Tag></div>
          {n.description&&<div className="quality-trace-description">{n.description}</div>}
          <DetailInfoGrid items={[{key:'ref',label:'关联单据',value:n.refNo||n.refId},{key:'operator',label:'操作人',value:n.operatorName||'未登记'}]}/>
        </div>}))}/>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无关联生产节点"/>}
      </Card>
      <Alert type="info" showIcon message="生产节点复用用户端真实事实。交易订单、物流与售后由交易履约域维护，生产链路与存证不代表已交付或质量合格。"/>
    </div>}
    <InspectionDetail id={active} onClose={()=>setActive(undefined)}/>
  </QualityPage>
}
