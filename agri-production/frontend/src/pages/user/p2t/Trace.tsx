import { useEffect, useState } from 'react'
import { Alert, Button, Empty, Input, Space, Steps, Tag, Typography } from 'antd'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ProColumns } from '@ant-design/pro-components'
import useAuthStore from '@/store/auth'
import PageContainer from '@/components/ProductionPageContainer'
import SectionCard from '@/components/SectionCard'
import DetailInfoGrid from '@/components/DetailInfoGrid'
import ProTable from '@/components/ProductionTable'
import { SCROLL_BY_CONTENT } from '@/components/tableScroll'
import { fetchP2tTrace } from '@/api/p2t'
import type { P2tOffer } from '@/api/p2t'
import OfferSubscriptionFlows from './OfferSubscriptionFlows'
import BulkLogisticsTrace from './BulkLogisticsTrace'

const TRADE_STATUSES: Record<string, string> = { PENDING: '待建品', LISTED: '已上架', SOLD: '已售罄', CLOSED: '已关闭' }
export default function P2tTrace(): JSX.Element {
  const subjectId = useAuthStore(s => s.userInfo?.tenantId)
  const scope = String(subjectId ?? '')
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const initial = params.get('batchNo')?.trim() || ''
  const [inputNo, setInputNo] = useState(initial)
  const [selectedOffer, setSelectedOffer] = useState<{ offerNo: string; unit?: string } | null>(null)
  useEffect(() => { setInputNo(initial); setSelectedOffer(null) }, [initial, subjectId])
  const query = useQuery({
    queryKey: ['p2t-trace', scope, initial],
    enabled: !!scope && !!initial,
    queryFn: () => fetchP2tTrace(initial, false),
  })
  const onSearch = () => {
    const value = inputNo.trim()
    if (value) params.set('batchNo', value)
    else params.delete('batchNo')
    setParams(params, { replace: true })
  }
  const data = query.data as { batch?: { batchId?: number; batchNo?: string; cropName?: string; farmName?: string; quantity?: number; unit?: string; harvestDate?: string; inspectionNo?: string }; offers?: P2tOffer[] } | undefined
  const offers = data?.offers || []
  const activeOffer = offers.find(o => o.offerNo === selectedOffer?.offerNo) || offers[0] || null
  const columns: ProColumns<P2tOffer>[] = [
    { title: '供给单号', dataIndex: 'offerNo', width: 190, render: (_, r) => <Button type="link" onClick={() => setSelectedOffer({ offerNo: r.offerNo, unit: r.unit })}>{r.offerNo}</Button> },
    { title: '作物', dataIndex: 'cropName', width: 120 },
    { title: '品类', dataIndex: 'categoryName', width: 120 },
    { title: '供给总量', dataIndex: 'availableQty', align: 'right', width: 110, render: (_, r) => `${r.availableQty ?? '—'} ${r.unit || ''}` },
    { title: '净认购量', dataIndex: 'reservedQty', align: 'right', width: 110, render: (_, r) => `${r.reservedQty ?? '—'} ${r.unit || ''}` },
    { title: '商品编码', dataIndex: 'productCode', width: 160, render: (_, r) => r.productCode || '—' },
    { title: '交易状态', dataIndex: 'tradeStatus', width: 110, render: (_, r) => <Tag color={r.tradeStatus === 'LISTED' ? 'green' : 'default'}>{TRADE_STATUSES[r.tradeStatus] || r.tradeStatus}</Tag> },
    { title: '操作', valueType: 'option', fixed: 'right', width: 160, render: (_, r) => <Space><Button type="link" onClick={() => setSelectedOffer({ offerNo: r.offerNo, unit: r.unit })}>查看认购流水</Button><Button type="link" onClick={() => navigate(`/production/p2t/offers?offerNo=${encodeURIComponent(r.offerNo)}&subjectId=${encodeURIComponent(scope)}`)}>供给详情</Button></Space> },
  ]
  return <PageContainer header={{ title: '供给与履约追踪', subTitle: '生产端只读核对供给、成交回写和大宗履约；订单与物流由交易端维护' }}>
    <Space style={{ marginBottom: 16 }}>
      <Input style={{ width: 320 }} placeholder="输入采收批次号，如 H20260601" value={inputNo} onChange={e => setInputNo(e.target.value)} onPressEnter={onSearch} />
      <Button type="primary" onClick={onSearch}>查询链路</Button>
    </Space>
    {!initial && <Empty description="输入批次号后查看「批次 → 供给 → 商品 → 订单 → 回写」链路" />}
    {initial && query.isFetching && <Typography.Text>正在加载链路…</Typography.Text>}
    {initial && !query.isPending && !query.isError && !data?.batch && <Empty description={`未找到批次 ${initial} 的链路数据`} />}
    {initial && query.isError && <Alert type="error" message="链路数据加载失败" action={<Button onClick={() => void query.refetch()}>重试</Button>} />}
    {initial && data?.batch && <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <SectionCard title="链路主键" extra={data.batch.batchId && <Button type="link" onClick={() => navigate(`/production/harvests/${data.batch?.batchId}`)}>查看来源采收</Button>}>
        <DetailInfoGrid items={[
          { label: '批次号', value: <Typography.Text copyable>{data.batch.batchNo}</Typography.Text> },
          { label: '品种', value: data.batch.cropName },
          { label: '农场', value: data.batch.farmName },
          { label: '产量', value: `${data.batch.quantity ?? '—'} ${data.batch.unit || ''}` },
          { label: '采收日期', value: data.batch.harvestDate },
          { label: '关联检测单号', value: data.batch.inspectionNo || '未关联（不代表检测结论）' },
        ]} />
      </SectionCard>
      <SectionCard title="链路阶段">
        <Steps size="small" items={[
          { title: '采收', description: data.batch.harvestDate, status: 'finish' },
          { title: '供给发布', description: activeOffer?.offerNo || '未发布', status: offers.length ? 'finish' : 'wait' },
          { title: '交易建品', description: activeOffer?.productCode || '未建品', status: !!activeOffer?.productCode ? 'finish' : 'wait' },
          { title: '认购核对', description: activeOffer ? `当前净认购 ${activeOffer.reservedQty ?? '—'} ${activeOffer.unit || ''}，历史以流水为准` : '无供给', status: activeOffer ? 'process' : 'wait' },
        ]} />
      </SectionCard>
      <Button onClick={() => navigate(`/production/trace/full-chain?batchId=${encodeURIComponent(String(data.batch?.batchId || ''))}`)}>查看生产与质量链路</Button>
      <SectionCard title={`供给单列表${activeOffer ? ` · 当前查看 ${activeOffer.offerNo}` : ''}`}>
        <ProTable<P2tOffer> key={`trace-offers-${scope}-${initial}`} rowKey="offerNo" columns={columns} dataSource={offers}
          columnWidthStorageKey="p2t-trace-offers" scroll={SCROLL_BY_CONTENT} search={false} pagination={{ defaultPageSize: 10, showSizeChanger: true }}
          toolBarRender={() => [<Button key="reload" loading={query.isFetching} onClick={() => void query.refetch()}>刷新</Button>]}
          options={{ reload: false, density: true, setting: true }} />
      </SectionCard>
      <BulkLogisticsTrace key={`${scope}:${initial}`} batchNo={initial} subject={scope} offerNo={activeOffer?.offerNo || ''} />
      {activeOffer && <OfferSubscriptionFlows key={`${scope}:${activeOffer.offerNo}`} offerNo={activeOffer.offerNo} unit={activeOffer.unit} subjectId={scope} />}
    </Space>}
  </PageContainer>
}
