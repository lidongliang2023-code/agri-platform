import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, DatePicker, Select, Space, Table, Tabs, Typography, message } from 'antd'
import { DownloadOutlined, ReloadOutlined } from '@ant-design/icons'
import dayjs, { type Dayjs } from 'dayjs'
import {
  exportReport, getCategoryReport, getTradeReport,
  type CategoryReportRow, type TradeReportRow
} from '@/api/report'

const GRANULARITY = [
  { value: 'day', label: '按日' },
  { value: 'week', label: '按周' },
  { value: 'month', label: '按月' }
]

// 报表（运营端）。
//
// 数字全部来自真实表，口径写在服务端：成交排除已取消订单，退款额取订单上的已退金额，
// 结算额取结算表里已结算记录（按结算时间落入期间）。
//
// 刻意不做环比/同比：库里只有最近几天的数据，硬算出来的环比没有意义；
// 与其放一个会被误读的数字，不如先不放。
export default function AdminReport() {
  const [range, setRange] = useState<[Dayjs, Dayjs]>([dayjs().subtract(6, 'day'), dayjs()])
  const [granularity, setGranularity] = useState('day')
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

  const tradeTab = (
    <Card
      title={`交易报表 ${startDate} ~ ${endDate}`}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => doExport('trade')}>导出 CSV</Button>
        </Space>
      }
    >
      <Table
        rowKey="period"
        size="small"
        loading={loading}
        dataSource={tradeRows}
        pagination={false}
        scroll={{ x: 1200 }}
        columns={[
          { title: '期间', dataIndex: 'period', width: 130, fixed: 'left' as const },
          { title: '订单笔数', dataIndex: 'orderCount', width: 100, align: 'right' as const },
          { title: '订单金额', dataIndex: 'orderAmount', width: 140, align: 'right' as const, render: money },
          { title: '成交笔数', dataIndex: 'dealCount', width: 100, align: 'right' as const },
          { title: '成交额', dataIndex: 'dealAmount', width: 140, align: 'right' as const, render: money },
          { title: '退款额', dataIndex: 'refundAmount', width: 130, align: 'right' as const, render: money },
          { title: '结算笔数', dataIndex: 'settleCount', width: 100, align: 'right' as const },
          { title: '结算金额', dataIndex: 'settleAmount', width: 140, align: 'right' as const, render: money },
          { title: '平台服务费', dataIndex: 'platformFee', width: 130, align: 'right' as const, render: money },
          { title: '客单价', dataIndex: 'avgOrderAmount', width: 130, align: 'right' as const, render: money }
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        口径：成交排除已取消订单；退款额取订单上的已退金额；结算额取结算表里已结算记录（按结算时间落入期间）。
        空档期会补 0 行，便于对齐。不做环比/同比 —— 库里没有足够历史，硬算出来的环比没有意义。
      </Typography.Paragraph>
    </Card>
  )

  const categoryTab = (
    <Card
      title={`品类报表 ${startDate} ~ ${endDate}`}
      extra={
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>
          <Button icon={<DownloadOutlined />} loading={exporting} onClick={() => doExport('category')}>导出 CSV</Button>
        </Space>
      }
    >
      <Table
        rowKey="categoryName"
        size="small"
        loading={loading}
        dataSource={categoryRows}
        pagination={false}
        locale={{ emptyText: '期间内没有成交' }}
        columns={[
          { title: '品类', dataIndex: 'categoryName', width: 200 },
          { title: '成交笔数', dataIndex: 'orderCount', width: 120, align: 'right' as const },
          { title: '成交额', dataIndex: 'dealAmount', width: 160, align: 'right' as const, render: money },
          { title: '占比', dataIndex: 'share', width: 120, align: 'right' as const,
            render: (v: number) => `${v}%` }
        ]}
      />
      <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
        口径：按订单上的品类聚合，排除已取消订单；占比 = 该品类成交额 ÷ 期间成交总额。
      </Typography.Paragraph>
    </Card>
  )

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <span>统计期间：</span>
          <DatePicker.RangePicker
            value={range}
            allowClear={false}
            onChange={(v) => { if (v && v[0] && v[1]) setRange([v[0], v[1]]) }}
          />
          <span>粒度：</span>
          <Select style={{ width: 120 }} value={granularity} onChange={setGranularity} options={GRANULARITY} />
        </Space>
        <Alert
          type="info"
          showIcon
          style={{ marginTop: 12, marginBottom: 0 }}
          message="报表里的每个数字都能在明细里对上"
          description="交易报表按所选粒度聚合；品类报表按订单品类聚合。两者都可以导出 CSV（带 BOM，Excel 直接打开不乱码）。"
        />
      </Card>

      <Tabs items={[
        { key: 'trade', label: '交易报表', children: tradeTab },
        { key: 'category', label: '品类报表', children: categoryTab }
      ]} />
    </div>
  )
}
