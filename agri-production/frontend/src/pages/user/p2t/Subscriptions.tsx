import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Drawer, Tabs, Tag } from 'antd'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import useAuthStore from '@/store/auth'
import ProTable from '@/components/ProductionTable'
import SectionCard from '@/components/SectionCard'
import PageContainer from '@/components/ProductionPageContainer'
import { SCROLL_BY_CONTENT } from '@/components/tableScroll'
import { listP2tSubscriptionFlows, listP2tSubscriptions } from '@/api/p2t'
import type { P2tSubscription, P2tSubscriptionSummary } from '@/api/p2t'
import OfferSubscriptionFlows from './OfferSubscriptionFlows'
import SubscriptionDetail, { SUBSCRIPTION_EVENTS, SUBSCRIPTION_STATUSES, subscriptionEffect } from './SubscriptionDetail'

export default function P2tSubscriptions(): JSX.Element {
  const [tab, setTab] = useState('summary')
  const subjectId = useAuthStore(state => state.userInfo?.tenantId)
  const scope = String(subjectId ?? '')
  const [selected, setSelected] = useState<{ row: P2tSubscription; subject: string } | null>(null)
  const [offer, setOffer] = useState<P2tSubscriptionSummary | null>(null)
  const [failed, setFailed] = useState({ summary: false, flow: false })
  const summaryRef = useRef<ActionType>(null)
  const flowRef = useRef<ActionType>(null)
  useEffect(() => { setSelected(null); setOffer(null); setFailed({ summary: false, flow: false }) }, [subjectId])
  const isCurrent = () => !!scope && String(useAuthStore.getState().userInfo?.tenantId ?? '') === scope
  const summaryColumns: ProColumns<P2tSubscriptionSummary>[] = [
    { title: '供给单号／作物', dataIndex: 'keyword', hideInTable: true },
    { title: '供给单号', dataIndex: 'offerNo', width: 190, search: false, copyable: true },
    { title: '作物', dataIndex: 'cropName', search: false },
    { title: '品种', dataIndex: 'varietyName', search: false },
    { title: '品类', dataIndex: 'categoryName', search: false },
    { title: '供给总量', dataIndex: 'availableQty', search: false, align: 'right', render: (_, row) => `${row.availableQty ?? '—'} ${row.unit || ''}` },
    { title: '净认购量', dataIndex: 'reservedQty', search: false, align: 'right', render: (_, row) => `${row.reservedQty ?? '—'} ${row.unit || ''}` },
    { title: '未认购意向量', dataIndex: 'remainingQty', search: false, align: 'right', render: (_, row) => `${row.remainingQty ?? '—'} ${row.unit || ''}` },
    { title: '认购率', dataIndex: 'subscriptionRate', search: false, render: (_, row) => row.subscriptionRate == null ? '—' : `${row.subscriptionRate}%` },
    { title: '交易状态', dataIndex: 'tradeStatus', search: false, render: (_, row) => ({ PENDING: '待建品', LISTED: '已上架', SOLD: '已售罄', CLOSED: '已关闭' }[row.tradeStatus] || row.tradeStatus || '—') },
    { title: '操作', valueType: 'option', fixed: 'right', width: 120, render: (_, row) => <Button type="link" onClick={() => setOffer(row)}>查看流水</Button> },
  ]
  const flowColumns: ProColumns<P2tSubscription>[] = [
    { title: '订单号／买家', dataIndex: 'keyword', hideInTable: true },
    { title: '订单号', dataIndex: 'orderNo', width: 190, search: false, render: (_, row) => <Button type="link" onClick={() => setSelected({ row, subject: scope })}>{row.orderNo || '查看详情'}</Button> },
    { title: '供给单号', dataIndex: 'offerNo', width: 190, search: false },
    { title: '采收批次号', dataIndex: 'batchNo', width: 180, search: false },
    { title: '买家', dataIndex: 'buyerName', search: false },
    { title: '事件类型', dataIndex: 'eventType', valueType: 'select', valueEnum: SUBSCRIPTION_EVENTS },
    { title: '本次数量', dataIndex: 'qty', search: false, align: 'right' },
    { title: '认购影响', key: 'effect', search: false, render: (_, row) => subscriptionEffect(row) },
    { title: '等级', dataIndex: 'grade', search: false },
    { title: '回写状态', dataIndex: 'writebackStatus', valueType: 'select', valueEnum: Object.fromEntries(Object.entries(SUBSCRIPTION_STATUSES).map(([key, value]) => [key, value.text])), render: (_, row) => <Tag color={SUBSCRIPTION_STATUSES[row.writebackStatus]?.color}>{SUBSCRIPTION_STATUSES[row.writebackStatus]?.text || row.writebackStatus}</Tag> },
    { title: '回写时间', dataIndex: 'createTime', width: 170, search: false },
    { title: '操作', valueType: 'option', fixed: 'right', width: 90, render: (_, row) => <Button type="link" onClick={() => setSelected({ row, subject: scope })}>详情</Button> },
  ]
  return <PageContainer header={{ title: '认购台账' }}>
    <Tabs activeKey={tab} onChange={setTab} items={[{ key: 'summary', label: '按供给汇总' }, { key: 'flow', label: '全部事件流水' }]} />
    {tab === 'summary' && <SectionCard title="供给单认购汇总" style={{ marginBottom: 16 }}>
      {failed.summary && <Alert type="error" showIcon message="认购汇总加载失败" action={<Button onClick={() => summaryRef.current?.reload()}>重试</Button>} />}
      <ProTable<P2tSubscriptionSummary> key={`summary-${scope}`} actionRef={summaryRef} rowKey="offerNo" columns={summaryColumns}
        columnWidthStorageKey="p2t-subscription-summary" scroll={SCROLL_BY_CONTENT} params={{ subjectId }}
        search={{ labelWidth: 'auto' }} pagination={{ defaultPageSize: 10, showSizeChanger: true }}
        options={{ reload: true, density: true, setting: true }} tableAlertRender={false}
        request={async params => {
          if (!isCurrent()) return { data: [], total: 0, success: false }
          setFailed(previous => ({ ...previous, summary: false }))
          const result = await listP2tSubscriptions({ pageNum: params.current ?? 1, pageSize: params.pageSize ?? 10, keyword: params.keyword })
          return isCurrent() ? { data: result.list, total: result.total, success: true } : { data: [], total: 0, success: false }
        }} onRequestError={() => setFailed(previous => ({ ...previous, summary: true }))} />
    </SectionCard>}
    <Drawer title={`供给单流水 ${offer?.offerNo || ''}`} width="85%" open={!!offer} onClose={() => setOffer(null)} destroyOnClose>
      {offer && <OfferSubscriptionFlows key={`${scope}-${offer.offerNo}`} offerNo={offer.offerNo} unit={offer.unit} subjectId={scope} />}
    </Drawer>
    {tab === 'flow' && <SectionCard title="认购回写流水" style={{ marginTop: 16 }}>
      {failed.flow && <Alert type="error" showIcon message="认购流水加载失败" action={<Button onClick={() => flowRef.current?.reload()}>重试</Button>} />}
      <ProTable<P2tSubscription> key={`flow-${scope}`} actionRef={flowRef} rowKey="id" columns={flowColumns}
        columnWidthStorageKey="p2t-subscription-records" scroll={SCROLL_BY_CONTENT} params={{ subjectId }}
        search={{ labelWidth: 'auto' }} pagination={{ defaultPageSize: 20, showSizeChanger: true }}
        options={{ reload: true, density: true, setting: true }} tableAlertRender={false}
        request={async params => {
          if (!isCurrent()) return { data: [], total: 0, success: false }
          setFailed(previous => ({ ...previous, flow: false }))
          const result = await listP2tSubscriptionFlows({ pageNum: params.current ?? 1, pageSize: params.pageSize ?? 20, keyword: params.keyword, eventType: params.eventType, writebackStatus: params.writebackStatus })
          return isCurrent() ? { data: result.list, total: result.total, success: true } : { data: [], total: 0, success: false }
        }} onRequestError={() => setFailed(previous => ({ ...previous, flow: true }))} />
    </SectionCard>}
    {selected && selected.subject === scope && <SubscriptionDetail record={selected.row} subjectId={selected.subject} onClose={() => setSelected(null)} />}
  </PageContainer>
}
