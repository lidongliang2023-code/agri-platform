import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Card, Col, Popconfirm, Row, Statistic, Table, Tag, Typography, message } from 'antd'
import { ReloadOutlined, TransactionOutlined } from '@ant-design/icons'
import {
  getPendingSettlements, getSettledSettlements, getSettlementSummary, settleOrder,
  type PendingSettlementRow, type SettlementRow, type SettlementSummary
} from '@/api/settlement'

const ORDER_STATUS: Record<string, string> = {
  received: '已收货',
  completed: '已完成'
}

/**
 * 结算与分账（运营端）。
 *
 * <p>口径（由后端确定，页面只呈现）：订单**确认收货之后**才可结算；
 * 平台服务费按**货款**计（不含运费），卖家应收 = 订单总额 − 平台服务费；
 * 金额一律服务端重算，页面不传金额。</p>
 *
 * <p>结算是显式动作，没有定时自动打款 —— 涉及钱的动作不该在没人看着的时候自己跑。</p>
 */
export default function AdminSettlement() {
  const [summary, setSummary] = useState<SettlementSummary | null>(null)
  const [pending, setPending] = useState<PendingSettlementRow[]>([])
  const [pendingTotal, setPendingTotal] = useState(0)
  const [pendingPage, setPendingPage] = useState(1)
  const [settled, setSettled] = useState<SettlementRow[]>([])
  const [settledTotal, setSettledTotal] = useState(0)
  const [settledPage, setSettledPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [acting, setActing] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [s, p, d] = await Promise.all([
        getSettlementSummary(),
        getPendingSettlements({ pageNum: pendingPage, pageSize: 10 }),
        getSettledSettlements({ pageNum: settledPage, pageSize: 10 })
      ])
      if (s?.code === 200) setSummary(s.data)
      if (p?.code === 200) {
        setPending(p.data?.records ?? [])
        setPendingTotal(Number(p.data?.total ?? 0))
      }
      if (d?.code === 200) {
        setSettled(d.data?.records ?? [])
        setSettledTotal(Number(d.data?.total ?? 0))
      }
    } catch {
      message.error('加载结算数据失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [pendingPage, settledPage])

  useEffect(() => {
    load()
  }, [load])

  const handleSettle = async (row: PendingSettlementRow) => {
    setActing(row.orderId)
    try {
      const res = await settleOrder(row.orderId)
      if (res?.code === 200) {
        message.success(`已结算：卖家应收 ¥${res.data?.sellerReceivable ?? ''}`)
        load()
      } else {
        message.error(res?.message ?? '结算失败')
      }
    } catch {
      message.error('结算失败（请检查后端是否在运行）')
    } finally {
      setActing(null)
    }
  }

  const money = (v: number | undefined | null) => (v == null ? '—' : `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`)
  const feePercent = summary ? `${(Number(summary.platformFeeRate) * 100).toFixed(2)}%` : '—'

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="待结算订单" value={summary?.pendingCount ?? 0} suffix="笔" /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="待结算金额" value={summary?.pendingAmount ?? 0} prefix="¥" precision={2} /></Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title={`预估平台服务费（费率 ${feePercent}，按货款）`}
              value={summary?.pendingPlatformFee ?? 0} prefix="¥" precision={2} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="预估卖家应收合计" value={summary?.pendingSellerReceivable ?? 0} prefix="¥" precision={2} />
          </Card>
        </Col>
      </Row>

      <Card
        title={`待结算订单 ${pendingTotal} 笔`}
        style={{ marginBottom: 16 }}
        extra={<Button icon={<ReloadOutlined />} loading={loading} onClick={load}>刷新</Button>}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="结算条件：已确认收货（或已完成）且已付款"
          description={`平台服务费按货款计，费率 ${feePercent}；卖家应收 = 订单总额 − 平台服务费。金额由服务端按订单真实数据重算，一笔订单只能结算一次。`}
        />
        <Table
          rowKey="orderId"
          loading={loading}
          dataSource={pending}
          scroll={{ x: 1300 }}
          locale={{ emptyText: '暂无待结算订单（订单需先走到「已收货」）' }}
          pagination={{ current: pendingPage, pageSize: 10, total: pendingTotal, onChange: setPendingPage }}
          columns={[
            { title: '订单号', dataIndex: 'orderNo', width: 170 },
            { title: '采购方', dataIndex: 'buyerName', width: 160 },
            { title: '供应方', dataIndex: 'sellerName', width: 160 },
            { title: '订单状态', dataIndex: 'orderStatus', width: 100,
              render: (v: string) => <Tag color="success">{ORDER_STATUS[v] ?? v}</Tag> },
            { title: '货款', dataIndex: 'goodsAmount', width: 130, align: 'right' as const,
              render: money },
            { title: '运费', dataIndex: 'freightAmount', width: 110, align: 'right' as const,
              render: money },
            { title: '订单总额', dataIndex: 'totalAmount', width: 130, align: 'right' as const,
              render: money },
            { title: '平台服务费', dataIndex: 'platformFee', width: 120, align: 'right' as const,
              render: money },
            { title: '卖家应收', dataIndex: 'sellerReceivable', width: 130, align: 'right' as const,
              render: (v: number) => <strong>{money(v)}</strong> },
            {
              title: '操作',
              width: 100,
              fixed: 'right' as const,
              render: (_: unknown, row: PendingSettlementRow) => (
                <Popconfirm
                  title="确认结算这笔订单？"
                  description={`结算后卖家应收 ¥${row.sellerReceivable}，不可撤销。`}
                  okText="确 定"
                  cancelText="取 消"
                  onConfirm={() => handleSettle(row)}
                >
                  <Button type="link" icon={<TransactionOutlined />} loading={acting === row.orderId}>
                    结算
                  </Button>
                </Popconfirm>
              )
            }
          ]}
        />
      </Card>

      <Card title={`已结算记录 ${settledTotal} 笔`}>
        <Row gutter={16} style={{ marginBottom: 12 }}>
          <Col span={8}>
            <Statistic title="已结算金额" value={summary?.settledAmount ?? 0} prefix="¥" precision={2} />
          </Col>
          <Col span={8}>
            <Statistic title="累计平台服务费" value={summary?.settledPlatformFee ?? 0} prefix="¥" precision={2} />
          </Col>
          <Col span={8}>
            <Statistic title="累计卖家应收" value={summary?.settledSellerReceivable ?? 0} prefix="¥" precision={2} />
          </Col>
        </Row>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={settled}
          scroll={{ x: 1200 }}
          locale={{ emptyText: '还没有结算记录' }}
          pagination={{ current: settledPage, pageSize: 10, total: settledTotal, onChange: setSettledPage }}
          columns={[
            { title: '结算单号', dataIndex: 'settlementNo', width: 170 },
            { title: '订单号', dataIndex: 'orderNo', width: 170 },
            { title: '供应方', dataIndex: 'sellerName', width: 160 },
            { title: '订单总额', dataIndex: 'totalAmount', width: 130, align: 'right' as const, render: money },
            { title: '平台服务费', dataIndex: 'platformFee', width: 120, align: 'right' as const, render: money },
            { title: '卖家应收', dataIndex: 'sellerReceivable', width: 130, align: 'right' as const, render: money },
            { title: '结算时间', dataIndex: 'settleTime', width: 170 },
            { title: '操作人', dataIndex: 'settleBy', width: 110, render: (v: string) => v ?? '—' }
          ]}
        />
        <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
          说明：分账口径（费率、卖家应收）在结算那一刻由服务端重算并落库留痕，
          订单上的"已结算"标记与这里一一对应。
        </Typography.Paragraph>
      </Card>
    </div>
  )
}
