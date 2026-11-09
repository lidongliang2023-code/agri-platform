import '@/pages/user/quality/quality-trace.css'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Alert, Button, Empty, Input, Space, Steps, Tag, Timeline, Typography } from 'antd'
import PageContainer from '@/components/ProductionPageContainer'
import SectionCard from '@/components/SectionCard'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import { fetchFullChainNodes, fetchTraceCodeDetail } from '@/api/trace'
import { getHarvest } from '@/api/harvests'
import useAuthStore from '@/store/auth'

const STAGES = [
  { key: 'planting', title: '种植与农事' }, { key: 'input', title: '投入品' },
  { key: 'harvest', title: '采收' }, { key: 'process', title: '加工包装' },
  { key: 'inspect', title: '质量检测' }, { key: 'storage', title: '仓储出入库' },
  { key: 'trace', title: '单品赋码' },
]
function stageOf(node: any): string {
  const value = node.stage || node.nodeType
  return value === 'plant' || value === 'growth' ? 'planting' : value === 'inspection' ? 'inspect' : value
}
function evidence(node: any): string {
  if (node.chainType === 'SIMULATED' && node.onChain) return '模拟存证成功'
  if (node.onChain) return '存证成功'
  if (node.chainStatus === 'FAILED') return '存证失败'
  if (node.chainStatus === 'PENDING') return '存证处理中'
  return '无存证记录'
}
export default function FullChainTrace(): JSX.Element {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const subject = String(useAuthStore(s => s.userInfo?.tenantId) || '')
  const [code, setCode] = useState(params.get('code') || '')
  const [batch, setBatch] = useState(params.get('batchId') || '')
  const activeCode = params.get('code') || ''
  const requestedBatch = params.get('batchId') || ''
  const codeQuery = useQuery({ queryKey: ['quality-trace-code', subject, activeCode], enabled: !!subject && !!activeCode,
    retry: false, queryFn: () => fetchTraceCodeDetail(activeCode) })
  const batchId = activeCode ? String(codeQuery.data?.batchId || '') : requestedBatch
  const batchQuery = useQuery({ queryKey: ['quality-trace-batch', subject, batchId], enabled: !!subject && !!batchId,
    retry: false, queryFn: () => getHarvest(batchId) })
  const chainQuery = useQuery({ queryKey: ['quality-trace-nodes', subject, batchId], enabled: !!subject && !!batchId,
    retry: false, queryFn: () => fetchFullChainNodes(batchId) })
  const nodes = chainQuery.data || []
  const failure = codeQuery.error || batchQuery.error || chainQuery.error
  const loading = codeQuery.isFetching || batchQuery.isFetching || chainQuery.isFetching
  const search = () => { const next = new URLSearchParams(); if (code.trim()) next.set('code', code.trim());
    else if (batch.trim()) next.set('batchId', batch.trim()); setParams(next) }
  const exportNodes = () => {
    const csv = [['环节', '业务编号', '发生时间', '记录', '存证状态'], ...nodes.map((n: any) =>
      [n.nodeName, n.refNo, n.occurredAt, n.description, evidence(n)])]
      .map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a'); link.href = url; link.download = '质量溯源记录.csv'; link.click(); URL.revokeObjectURL(url)
  }
  return <PageContainer className="quality-trace-page" header={{ title: '质量溯源 · 全链路',
    subTitle: '按批次追查生产事实，按单品码核验身份与状态',
    extra: [<Button key="codes" onClick={() => navigate('/production/trace')}>单品码管理</Button>,
      <Button key="export" disabled={!nodes.length || !!failure} onClick={exportNodes}>导出链路记录</Button>] }}>
    <SectionCard title="溯源查询">
      <Space wrap className="trace-query-row">
        <Input aria-label="单品溯源码" placeholder="输入单品溯源码（优先查询）" value={code} onChange={e => setCode(e.target.value)} onPressEnter={search} />
        <Input aria-label="采收批次ID" placeholder="或输入采收批次 ID" value={batch} onChange={e => setBatch(e.target.value)} onPressEnter={search} />
        <Button type="primary" loading={loading} onClick={search}>查询链路</Button>
      </Space>
    </SectionCard>
    <Alert className="trace-domain-note" type="info" showIcon message="一物一码，批次共享生产事实，单品独立核验"
      description="生产管理维护种植、农事、采收、加工、质检与赋码；交易撮合维护供给、合同与大宗物流；商城维护零售订单和履约。缺失记录不视为已完成，出库记录不代表物流已签收，存证成功不替代质量合格判定。" />
    {failure && <Alert type="error" showIcon message="溯源数据加载失败" description={failure instanceof Error ? failure.message : '请重试，不能将接口失败视为无记录'}
      action={<Button onClick={() => { void codeQuery.refetch(); if (batchId) { void batchQuery.refetch(); void chainQuery.refetch() } }}>重新加载</Button>} />}
    {!activeCode && !requestedBatch && <Empty description="输入单品码或采收批次 ID，查看真实链路记录" />}
    {!failure && batchQuery.data && <>
      <SectionCard title="批次来源" extra={<Button onClick={() => navigate(`/production/harvests/${batchId}`)}>采收详情</Button>}>
        <DetailInfoGrid items={[
          { label: '批次号', value: batchQuery.data.batchNo }, { label: '作物', value: batchQuery.data.cropName },
          { label: '农场', value: batchQuery.data.farmName }, { label: '地块', value: batchQuery.data.plotName },
          { label: '采收日期', value: batchQuery.data.harvestDate || '未记录' },
          { label: '本次单品码', value: activeCode || '按批次查看，未指定单品' },
        ]} />
        <Space wrap style={{ marginTop: 16 }}>
          <Button onClick={() => navigate(`/production/p2t/trace?batchNo=${encodeURIComponent(batchQuery.data?.batchNo || '')}`)}>查看供给与交易追踪</Button>
          <Typography.Text type="secondary">交易与零售履约仅以各自业务系统的真实单据为准</Typography.Text>
        </Space>
      </SectionCard>
      <SectionCard title="生产链路覆盖">
        <Steps size="small" responsive items={STAGES.map(stage => { const count = nodes.filter(n => stageOf(n) === stage.key).length;
          return { title: stage.title, description: count ? `${count} 条真实记录` : '暂无记录', status: count ? 'finish' as const : 'wait' as const } })} />
      </SectionCard>
      <SectionCard title="全链路事实记录">
        {!nodes.length ? <Empty description={loading ? '正在查询…' : '该批次暂无链路记录'} /> : <Timeline items={nodes.map((node: any, index) => ({
          key: `${node.nodeType}-${node.refId || index}`, color: node.chainStatus === 'FAILED' ? 'red' : 'green',
          children: <div className="trace-event-row"><Space wrap><Typography.Text strong>{node.nodeName}</Typography.Text><Tag>{node.refNo || '未记录编号'}</Tag><Tag>{evidence(node)}</Tag></Space>
            <p>{node.description || '未记录详情'}</p><Typography.Text type="secondary">{node.occurredAt || '未记录时间'}{node.operatorName ? ` · ${node.operatorName}` : ''}</Typography.Text>
            {node.failedReason && <Alert type="warning" message={node.failedReason} />}</div>,
        }))} />}
      </SectionCard>
    </>}
  </PageContainer>
}
