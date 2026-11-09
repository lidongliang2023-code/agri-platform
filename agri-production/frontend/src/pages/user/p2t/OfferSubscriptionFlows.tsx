import { useEffect, useRef, useState } from 'react'
import { Alert, Button, Tag, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { downloadImportCsv } from '@/utils/import-csv'
import type { ActionType, ProColumns } from '@ant-design/pro-components'
import ProTable from '@/components/ProductionTable'
import SectionCard from '@/components/SectionCard'
import { SCROLL_BY_CONTENT } from '@/components/tableScroll'
import { listP2tSubscriptionFlows } from '@/api/p2t'
import type { P2tSubscription } from '@/api/p2t'
import useAuthStore from '@/store/auth'

import SubscriptionDetail, { SUBSCRIPTION_EVENTS as EVENTS, SUBSCRIPTION_STATUSES as STATUSES } from './SubscriptionDetail'

export default function OfferSubscriptionFlows({ offerNo, unit, subjectId }: {
  offerNo: string; unit?: string; subjectId: string
}): JSX.Element {
  const [selected, setSelected] = useState<P2tSubscription | null>(null)
  const actionRef = useRef<ActionType>(null)
  const [failed, setFailed] = useState(false)
  const filters = useRef<{ keyword?: string; eventType?: string; writebackStatus?: string }>({})
  const scopeVersion = useRef(0)
  const exportingRef = useRef(false)
  const [exporting, setExporting] = useState(false)
  const [exportedCount, setExportedCount] = useState(0)
  useEffect(() => {
    scopeVersion.current++
    setSelected(null)
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.userInfo?.tenantId !== previous.userInfo?.tenantId) scopeVersion.current++
    })
    return () => { scopeVersion.current++; unsubscribe() }
  }, [offerNo, subjectId])
  const exportFlows = async () => {
    if (exportingRef.current) return
    const version = scopeVersion.current
    const query = { ...filters.current, offerNo }
    const assertScope = () => {
      if (scopeVersion.current !== version || String(useAuthStore.getState().userInfo?.tenantId) !== subjectId) {
        throw new Error('主体或供给范围已变化，导出已取消')
      }
    }
    exportingRef.current = true
    setExporting(true)
    setExportedCount(0)
    try {
      assertScope()
      const records: P2tSubscription[] = []
      const ids = new Set<string>()
      let expectedTotal: number | undefined
      for (let pageNum = 1; ; pageNum++) {
        assertScope()
        const result = await listP2tSubscriptionFlows({ ...query, pageNum, pageSize: 100 })
        assertScope()
        if (expectedTotal === undefined) expectedTotal = Number(result.total)
        if (!Number.isFinite(expectedTotal) || expectedTotal > 50000) throw new Error('单次最多导出 50000 条，请缩小筛选范围')
        if (Number(result.total) !== expectedTotal) throw new Error('导出期间流水发生变化，请重新导出')
        for (const row of result.list) {
          if (row.offerNo !== offerNo || ids.has(String(row.id))) throw new Error('流水范围或分页数据发生变化，请重新导出')
          ids.add(String(row.id))
          records.push(row)
        }
        setExportedCount(records.length)
        if (records.length >= expectedTotal) break
        if (!result.list.length) throw new Error('流水分页不完整，请重试')
      }
      if (records.length !== expectedTotal) throw new Error('流水分页不完整，请重试')
      if (!records.length) { message.info('暂无匹配的认购流水可导出'); return }
      const text = (value: unknown) => value == null ? '' : String(value)
      const identifier = (value: unknown) => value == null || value === '' ? '' : `'${value}`
      const rows = records.map(row => [
        identifier(row.id), identifier(row.offerNo), identifier(row.batchNo), identifier(row.orderNo),
        text(row.buyerName), text(row.buyerType), EVENTS[row.eventType] || text(row.eventType), text(row.qty), unit || '',
        row.writebackStatus !== 'SUCCESS' ? '未计入' : row.eventType === 'ORDER_PAID' ? '增加'
          : ['ORDER_CANCELLED', 'RELEASED'].includes(row.eventType) ? '减少' : '—',
        text(row.grade), STATUSES[row.writebackStatus]?.text || text(row.writebackStatus),
        text(row.writebackMessage), text(row.lockFrom), text(row.lockTo), text(row.paidAt), text(row.createTime),
      ].map(value => /^\s*[=+\-@\t\r\n]/.test(value) ? `'${value}` : value))
      assertScope()
      downloadImportCsv(`认购流水_${offerNo.replace(/[\\/:*?"<>|]/g, '_')}_${Date.now()}.csv`,
        ['流水ID', '供给单号', '采收批次号', '订单号', '买家', '买家类型', '事件类型', '数量', '单位', '认购影响',
          '等级', '回写状态', '回写说明', '锁定开始', '锁定结束', '支付时间', '回写时间'], rows)
      message.success(`已导出 ${records.length} 条认购流水`)
    } catch (error) {
      message.error(error instanceof Error ? error.message : '认购流水导出失败，请重试')
    } finally {
      exportingRef.current = false
      setExporting(false)
      setExportedCount(0)
    }
  }
  const columns: ProColumns<P2tSubscription>[] = [
    { title: '订单号／买家', dataIndex: 'keyword', hideInTable: true },
    { title: '订单号', dataIndex: 'orderNo', width: 185, search: false, copyable: true },
    { title: '买家', dataIndex: 'buyerName', width: 140, search: false },
    { title: '买家类型', dataIndex: 'buyerType', width: 110, search: false },
    { title: '事件类型', dataIndex: 'eventType', width: 125, valueType: 'select',
      valueEnum: EVENTS, render: (_, row) => EVENTS[row.eventType] || row.eventType || '—' },
    { title: '数量', dataIndex: 'qty', width: 135, align: 'right', search: false,
      render: (_, row) => `${row.qty ?? '—'} ${unit || ''}`.trim() },
    { title: '认购影响', key: 'effect', width: 120, search: false, render: (_, row) => {
      if (row.writebackStatus !== 'SUCCESS') return <Tag>未计入</Tag>
      if (row.eventType === 'ORDER_PAID') return <Tag color="green">增加</Tag>
      if (row.eventType === 'ORDER_CANCELLED' || row.eventType === 'RELEASED') return <Tag color="orange">减少</Tag>
      return '—'
    } },
    { title: '等级', dataIndex: 'grade', width: 85, search: false },
    { title: '回写状态', dataIndex: 'writebackStatus', width: 110, valueType: 'select',
      valueEnum: Object.fromEntries(Object.entries(STATUSES).map(([key, value]) => [key, value.text])),
      render: (_, row) => <Tag color={STATUSES[row.writebackStatus]?.color}>{STATUSES[row.writebackStatus]?.text || row.writebackStatus || '—'}</Tag> },
    { title: '回写说明', dataIndex: 'writebackMessage', width: 240, search: false },
    { title: '锁定开始', dataIndex: 'lockFrom', width: 170, search: false },
    { title: '锁定结束', dataIndex: 'lockTo', width: 170, search: false },
    { title: '支付时间', dataIndex: 'paidAt', width: 170, search: false },
    { title: '回写时间', dataIndex: 'createTime', width: 170, search: false },
    { title: '操作', valueType: 'option', width: 90, fixed: 'right', render: (_, row) => <Button type="link" onClick={() => setSelected(row)}>详情</Button> },
  ]
  return (
    <SectionCard title="关联认购流水">
      {selected && <SubscriptionDetail record={selected} subjectId={subjectId} onClose={() => setSelected(null)} />}
      {failed && <Alert type="error" showIcon message="认购流水加载失败" action={<Button size="small" onClick={() => actionRef.current?.reload()}>重试</Button>} />}
      <ProTable<P2tSubscription>
        actionRef={actionRef}
        columnWidthStorageKey="p2t-offer-subscription-flows"
        rowKey="id"
        columns={columns}
        params={{ offerNo, subjectId }}
        scroll={SCROLL_BY_CONTENT}
        search={{ labelWidth: 'auto' }}
        pagination={{ defaultPageSize: 10, showSizeChanger: true }}
        options={{ reload: true, density: true, setting: true }}
        toolBarRender={() => [
          <Button key="export" icon={<DownloadOutlined />} loading={exporting} onClick={exportFlows}>
            {exporting ? `正在读取 ${exportedCount} 条` : '导出筛选结果（CSV）'}
          </Button>,
        ]}
        request={async (params) => {
          if (String(useAuthStore.getState().userInfo?.tenantId) !== subjectId) {
            return { data: [], total: 0, success: false }
          }
          filters.current = {
            keyword: params.keyword as string | undefined,
            eventType: params.eventType as string | undefined,
            writebackStatus: params.writebackStatus as string | undefined,
          }
          setFailed(false)
          const result = await listP2tSubscriptionFlows({
            offerNo, pageNum: params.current ?? 1, pageSize: params.pageSize ?? 10,
            keyword: params.keyword as string | undefined,
            eventType: params.eventType as string | undefined,
            writebackStatus: params.writebackStatus as string | undefined,
          })
          if (String(useAuthStore.getState().userInfo?.tenantId) !== subjectId) {
            return { data: [], total: 0, success: false }
          }
          return { data: result.list, total: result.total, success: true }
        }}
        onRequestError={() => setFailed(true)}
        tableAlertRender={false}
        locale={{ emptyText: '暂无匹配的认购流水' }}
      />
    </SectionCard>
  )
}
