import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, DatePicker, Select, Tabs, Typography, message } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
  exportReport, getCategoryReport, getTradeReport,
  type CategoryReportRow, type TradeReportRow
} from '@/api/report'
import { TradeFilters, TradeList } from '@/components/TradeList'

const GRANULARITY = [
  { value: 'day', label: '按日' },
  { value: 'week', label: '按周' },
  { value: 'month', label: '按月' }
]

const defaultRange = (): [Dayjs, Dayjs] => [dayjs().subtract(6, 'day'), dayjs()]

export default function AdminReport() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>(defaultRange)
  const [granularity, setGranularity] = useState('day')
  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs]>(defaultRange)
  const [draftGranularity, setDraftGranularity] = useState('day')
  const [tradeRows, setTradeRows] = useState<TradeReportRow[]>([])
  const [categoryRows, setCategoryRows] = useState<CategoryReportRow[]>([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)

  const startDate = range[0].format('YYYY-MM-DD')
  const endDate = range[1].format('YYYY-MM-DD')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [t, c] = await Promise.all([
        getTradeReport({ startDate, endDate, granularity }),
        getCategoryReport({ startDate, endDate })
      ])
      if (t?.code === 200) setTradeRows(t.data ?? [])
      if (c?.code === 200) setCategoryRows(c.data ?? [])
    } catch {
      message.error('加载报表失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, granularity])

  useEffect(() => {
    load()
  }, [load])

  const handleQuery = () => {
    setRange(draftRange)
    setGranularity(draftGranularity)
  }

  const handleReset = () => {
    const next = defaultRange()
    setDraftRange(next)
    setDraftGranularity('day')
    setRange(next)
    setGranularity('day')
  }

  const doExport = async (type: 'trade' | 'category') => {
    setExporting(true)
    try {
      await exportReport({ startDate, endDate, granularity, type })
      message.success('已开始下载')
    } catch {
      message.error('导出失败')
    } finally {
      setExporting(false)
    }
  }

  const money = (v: number | undefined | null) =>
    v == null ? '—' : `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`

  const filterBar = (
    <TradeFilters
      loading={loading}
      onQuery={handleQuery}
      onReset={handleReset}
      fields={[
        {
          label: '统计期间',
          wide: true,
          control: (
            <DatePicker.RangePicker
              value={draftRange}
              allowClear={false}
              onChange={(v) => { if (v && v[0] && v[1]) setDraftRange([v[0], v[1]]) }}
            />
          ),
        },
        {
          label: '统计粒度',
          control: (
            <Select value={draftGranularity} onChange={setDraftGranularity} options={GRANULARITY} />
          ),
        },
      ]}
    />
  )

  const tradeTab = (
    <>
      <TradeList<TradeReportRow>
        listId="admin-report-trade"
        rowKey="period"
        size="small"
        loading={loading}
        dataSource={tradeRows}
        onRefresh={load}
        filterSlot={filterBar}
        toolbarLeft={(
          <>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => doExport('trade')}>
              导出 CSV
            </Button>
            <span style={{ color: '#595959', fontSize: 13 }}>交易报表 {startDate} ~ {endDate}</span>
          </>
        )}
        columns={[
          { title: '期间', dataIndex: 'period', width: 130, fixed: 'left' as const },
          { title: '订单笔数', dataIndex: 'orderCount', width: 100 },
          { title: '订单金额', dataIndex: 'orderAmount', width: 140, render: money },
          { title: '成交笔数', dataIndex: 'dealCount', width: 100 },
          { title: '成交额', dataIndex: 'dealAmount', width: 140, render: money },
          { title: '退款额', dataIndex: 'refundAmount', width: 130, render: money },
          { title: '结算笔数', dataIndex: 'settleCount', width: 100 },
          { title: '结算金额', dataIndex: 'settleAmount', width: 140, render: money },
          { title: '平台服务费', dataIndex: 'platformFee', width: 130, render: money },
          { title: '客单价', dataIndex: 'avgOrderAmount', width: 130, render: money }
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        口径：成交排除已取消订单；退款额取订单上的已退金额；结算额取结算表里已结算记录（按结算时间落入期间）。空档期会补 0 行，便于对齐。
      </Typography.Paragraph>
    </>
  )

  const categoryTab = (
    <>
      <TradeList<CategoryReportRow>
        listId="admin-report-category"
        rowKey="categoryName"
        size="small"
        loading={loading}
        dataSource={categoryRows}
        onRefresh={load}
        filterSlot={filterBar}
        toolbarLeft={(
          <>
            <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => doExport('category')}>
              导出 CSV
            </Button>
            <span style={{ color: '#595959', fontSize: 13 }}>品类报表 {startDate} ~ {endDate}</span>
          </>
        )}
        locale={{ emptyText: '期间内没有成交' }}
        columns={[
          { title: '品类', dataIndex: 'categoryName', width: 220, ellipsis: true },
          { title: '成交笔数', dataIndex: 'orderCount', width: 120 },
          { title: '成交额', dataIndex: 'dealAmount', width: 160, render: money },
          { title: '占比', dataIndex: 'share', width: 120, render: (v: number) => `${v}%` }
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        口径：按订单上的品类聚合，排除已取消订单；占比 = 该品类成交额 ÷ 期间成交总额。
      </Typography.Paragraph>
    </>
  )

  return (
    <div style={{ padding: 20 }}>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 12 }}
        message="报表里的每个数字都能在明细里对上"
        description="交易报表按所选粒度聚合；品类报表按订单品类聚合。两者都可以导出 CSV（带 BOM，Excel 直接打开不乱码）。"
      />
      <Tabs items={[
        { key: 'trade', label: '交易报表', children: tradeTab },
        { key: 'category', label: '品类报表', children: categoryTab }
      ]} />
    </div>
  )
}
