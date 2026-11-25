import type { ReactNode } from 'react'
import { Alert, Button, Drawer, Empty, Space, Table as AntTable, Tag } from 'antd'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import PageContainer from '@/components/ProductionPageContainer'
import Card from '@/components/SectionCard'
import Table from '@/components/ProductionTable'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import { qualityRecord } from '@/api/admin/quality-workbench'
import './QualityCompact.css'
import '@/components/ProductionListDense.css'
export { Card, Table }
export const tradeOpsUrl=(page:string)=>{const u=new URL(window.location.href);u.port='8086';u.pathname=`/admin/trade/${page}`;u.search='';u.hash='';return u.toString()}

export function QualityPage({title,subTitle,extra,children}:{title:string;subTitle:string;extra?:ReactNode;children:ReactNode}){return <PageContainer className="quality-workbench production-list-dense production-member-list" title={title} subTitle={subTitle} extra={extra}><Space direction="vertical" size={10} style={{width:'100%'}}>{children}</Space></PageContainer>}
export function LoadError({error}:{error:unknown}){return error?<Alert type="error" showIcon message="数据加载失败" description={error instanceof Error?error.message:'请刷新重试'}/>:null}
export const resultName=(v?:string)=>v==='PASS'?'合格':v==='FAIL'?'不合格':'未出结论'
export const stateName=(v?:string)=>({PENDING:'待检',TESTING:'检测中',DONE:'已完成'}[v||'']||v||'—')
export const codeName=(v?:string)=>({generated:'未激活',inactive:'未激活',active:'已激活',scanned:'已扫码',revoked:'已作废',expired:'已过期'}[v?.toLowerCase()||'']||v||'—')

/** 监管详情复用检测事实；交易单据只读关联，处置仍使用既有业务入口。 */
export function InspectionDetail({id,onClose}:{id?:string;onClose:()=>void}) {
  const nav=useNavigate()
  const query=useQuery({queryKey:['quality-inspection',id],queryFn:()=>qualityRecord(id!),enabled:!!id,retry:false})
  const d=query.data, i=d?.inspection
  const go=(path:string)=>{onClose();nav(path)}
  return <Drawer title="检测报告详情" rootClassName="quality-dialog quality-detail" width={880} open={!!id} onClose={onClose} loading={query.isFetching}
    extra={i&&<Space size={4}><Tag color={i.result==='FAIL'?'red':i.result==='PASS'?'green':'default'}>{resultName(i.result)}</Tag><Tag>{stateName(i.status)}</Tag></Space>}>
    <LoadError error={query.error}/>
    {!query.isFetching&&!query.error&&!i&&<Empty description="未找到检测报告"/>}
    {i&&<div className="quality-detail-stack">
      <Card title="检测信息" extra={i.reportUrl&&/^https?:\/\/|^\/(?!\/)/i.test(i.reportUrl)&&<Button size="small" href={i.reportUrl} target="_blank" rel="noopener noreferrer">查看报告原件</Button>}>
        <DetailInfoGrid items={[
          {key:'no',label:'检测单号',value:i.inspectionNo||i.inspectionId,fullWidth:true},
          {key:'farm',label:'农场',value:d?.farmName||i.farmId},{key:'tenant',label:'主体标识',value:i.tenantId},
          {key:'batch',label:'批次号',value:i.batchNo||'未关联'},{key:'crop',label:'产品',value:i.cropName},
          {key:'lab',label:'检测机构',value:i.labName},{key:'type',label:'检测类型',value:({SELF:'自检',SEND:'送检',SAMPLING:'抽检'}[i.inspectionType||'']||i.inspectionType)},
          {key:'person',label:'检测人',value:i.inspectorName},{key:'time',label:'抽样时间',value:i.sampleAt},
          {key:'remark',label:'检测说明',value:i.remark,fullWidth:true},
        ]}/>
      </Card>
      <Card title="批次管控" extra={i.result==='FAIL'&&<Button size="small" danger onClick={()=>go(`/admin/production/quality/recalls?inspectionId=${i.inspectionId}`)}>不合格品处置</Button>}>
        <DetailInfoGrid items={[
          {key:'frozen',label:'管控状态',value:d?.batch?<Tag color={Number(d.batch.status)===4?'red':'default'}>{Number(d.batch.status)===4?'已冻结':'未冻结'}</Tag>:'未关联有效批次'},
          {key:'stock',label:'冻结库存记录',value:d?.batch?`${d.frozenInventoryCount??0} / ${d.inventoryCount??0}`:'—'},
          {key:'control',label:'处置说明',value:d?.batch?.remark,fullWidth:true},
        ]}/>
        <Space className="quality-detail-actions" wrap size={8}>
          <Button size="small" disabled={!i.batchNo} onClick={()=>go(`/admin/production/trace/codes?batchNo=${encodeURIComponent(i.batchNo||'')}`)}>批次溯源码</Button>
          {i.farmId&&<Button size="small" onClick={()=>go(`/admin/production/farms/${i.farmId}`)}>农场监管详情</Button>}
        </Space>
      </Card>
      <Card title="产销与履约关联" extra={<Space wrap size={8}><Button size="small" href={tradeOpsUrl('product')}>交易货源审核</Button><Button size="small" href={tradeOpsUrl('order')}>交易订单监管</Button></Space>}>
        <div className="quality-related-heading">关联供给单 <span>{d?.sales?.offers?.length??0} 条</span></div>
        <AntTable size="small" rowKey={(row,index)=>`${row.offerNo}-${index}`} pagination={false} dataSource={d?.sales?.offers??[]} scroll={{x:480}}
          locale={{emptyText:'暂无关联供给'}} columns={[
            {title:'供给单号',dataIndex:'offerNo',render:(v:string)=>v||'—'},
            {title:'交易状态',dataIndex:'tradeStatus',width:150,render:(v:string)=>({DRAFT:'草稿',PENDING:'待审核',APPROVED:'已审核',REJECTED:'已驳回',LISTED:'已上架',DELISTED:'已下架',CLOSED:'已关闭'}[v]||v||'—')},
          ]}/>
        <div className="quality-related-heading quality-related-heading-next">认购回写 <span>{d?.sales?.subscriptions?.length??0} 条</span></div>
        <AntTable size="small" rowKey={(row,index)=>`${row.id||row.orderNo}-${index}`} pagination={false} dataSource={d?.sales?.subscriptions??[]} scroll={{x:560}}
          locale={{emptyText:'暂无认购回写'}} columns={[
            {title:'认购编号',dataIndex:'id',render:(v:string)=>v||'—'},
            {title:'交易订单号',dataIndex:'orderNo',render:(v:string)=>v||'未关联'},
            {title:'回写状态',dataIndex:'writebackStatus',width:130,render:(v:string)=>({SUCCESS:'回写成功',FAILED:'回写失败',PENDING:'待回写',PROCESSING:'回写中'}[v]||v||'未回写')},
          ]}/>
        <Alert className="quality-detail-note" type="info" showIcon message="按批次关联同主体台账；进入交易模块后按单号核查。冻结不代表已退款或已回收。"/>
      </Card>
      <Card title="关联溯源码" extra={<span className="quality-detail-muted">最多展示 20 条</span>}>
        {d?.traceCodes?.length?<div className="quality-code-list">{d.traceCodes.map(c=><div className="quality-code-row" key={c.code}>
          <Button type="link" onClick={()=>go(`/admin/production/trace/${encodeURIComponent(c.code)}`)}>{c.code}</Button><Tag>{codeName(c.status)}</Tag>
        </div>)}</div>:<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该批次暂无溯源码"/>}
      </Card>
    </div>}
  </Drawer>
}
