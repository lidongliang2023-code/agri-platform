import { useState } from 'react'
import { Alert, Button, DatePicker, Input, Select, Tag, Typography } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { ProColumns } from '@ant-design/pro-components'
import type { RawTraceCode } from '@/types'
import { fetchAdminTraceCodes } from '@/api/admin/trace'
import ListRowActions from '@/components/ListRowActions'
import { CollapsibleFilterDiv } from '@/components/CollapsibleFilterGrid'
import { Card, Table, QualityPage, LoadError, codeName } from '../quality/QualityShared'
export default function AdminTraceCodeManage(){
 const nav=useNavigate(),[params]=useSearchParams();const [code,setCode]=useState(''),[batchNo,setBatchNo]=useState(params.get('batchNo')||''),[status,setStatus]=useState<string>(),[chain,setChain]=useState<'onChain'|'unconfirmed'|'none'>(),[dates,setDates]=useState<string[]>(),[page,setPage]=useState(1),[size,setSize]=useState(20)
 const query=useQuery({queryKey:['admin','trace','codes',page,size,code,batchNo,status,chain,dates],queryFn:()=>fetchAdminTraceCodes({pageNum:page,pageSize:size,code,batchNo,status,chain,from:dates?.[0],to:dates?.[1]}),retry:false})
 const cols:ProColumns<RawTraceCode>[]=[{title:'溯源码',dataIndex:'code',width:220,render:(_,r)=><Button type="link" onClick={()=>nav(`/admin/production/trace/${encodeURIComponent(r.code||'')}`)}>{r.code}</Button>},{title:'批次号',dataIndex:'batchNo',width:190},{title:'状态',width:110,render:(_,r)=><Tag color={r.status==='revoked'?'red':r.status==='active'?'green':'default'}>{codeName(r.status)}</Tag>},{title:'扫码次数',dataIndex:'scanCount',width:100,render:(_,r)=>r.scanCount??'—'},{title:'生成时间',dataIndex:'createdAt',width:175},{title:'有效期至',dataIndex:'expireDate',width:135},{title:'链上凭证',width:150,render:(_,r)=><Tag color={r.onChain?'green':r.attested?'orange':'default'}>{r.onChain?'已上链':r.attested?'有存证待确认':'无存证记录'}</Tag>},{title:'操作',valueType:'option',width:120,fixed:'right',render:(_,r)=><ListRowActions items={[<Button key="detail" type="link" size="small" onClick={()=>nav(`/admin/production/trace/${encodeURIComponent(r.code||'')}`)}>溯源详情</Button>]}/>}]
 return <QualityPage title="单品溯源码管理" subTitle="跨主体溯源码监管与生产链路核验"><Alert type="info" showIcon message="生成、激活由生产用户端按所属批次维护；运营通过不合格品处置统一冻结批次和作废关联码。"/><LoadError error={query.error}/><Card className="production-dense-filter-card"><CollapsibleFilterDiv fieldCount={5} className="production-filter-grid">{({toggleButton})=><>
  <div className="production-filter-field"><label>溯源码</label><Input allowClear value={code} placeholder="请输入溯源码" onChange={e=>{setCode(e.target.value);setPage(1)}}/></div>
  <div className="production-filter-field"><label>批次号</label><Input allowClear value={batchNo} placeholder="请输入批次号" onChange={e=>{setBatchNo(e.target.value);setPage(1)}}/></div>
  <div className="production-filter-field"><label>码状态</label><Select allowClear value={status} placeholder="全部" options={['generated','active','scanned','revoked','expired'].map(value=>({value,label:codeName(value)}))} onChange={v=>{setStatus(v);setPage(1)}}/></div>
  <div className="production-filter-field"><label>链上凭证</label><Select allowClear value={chain} placeholder="全部" options={[{value:'onChain',label:'已上链'},{value:'unconfirmed',label:'有存证待确认'},{value:'none',label:'无存证记录'}]} onChange={v=>{setChain(v);setPage(1)}}/></div>
  <div className="production-filter-field"><label>生成日期</label><DatePicker.RangePicker key={dates?.join()||'none'} onChange={(_,v)=>{setDates(v[0]?v:undefined);setPage(1)}}/></div>
  <div className="production-filter-actions"><Button onClick={()=>{setCode('');setBatchNo('');setStatus(undefined);setChain(undefined);setDates(undefined);setPage(1)}}>重置</Button><Button type="primary" loading={query.isFetching} onClick={()=>{setPage(1);void query.refetch()}}>查询</Button>{toggleButton}</div>
 </>}</CollapsibleFilterDiv></Card><Card><Table<RawTraceCode> rowKey="code" memberListToolbar rowSelection={{}} cardProps={false} headerTitle={<Typography.Text type="secondary">扫码、存证状态不替代质量合格判定；批次被冻结后不得继续供给。</Typography.Text>} columns={cols} dataSource={query.data?.list??[]} loading={query.isFetching} search={false} columnWidthStorageKey="quality-trace-codes" columnsState={{persistenceKey:'quality-trace-codes-columns',persistenceType:'localStorage'}} options={{reload:()=>void query.refetch()}} pagination={{current:page,pageSize:size,total:query.data?.total??0,showSizeChanger:true,onChange:(p,s)=>{setPage(s===size?p:1);setSize(s)}}}/></Card></QualityPage>
}
