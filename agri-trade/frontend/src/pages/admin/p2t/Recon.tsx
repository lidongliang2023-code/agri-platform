/**
 * 页面名称：产销对账
 * 路由路径：/admin/trade/p2t/recon
 * 所属模块：数据 / 产销对账
 *
 * 三方口径：供给量（生产端说了能卖多少）· 成交量（交易端卖出去多少）· 入仓量（仓储管理）。
 * 本页只汇聚展示，不产生也不修改任何单据；入仓量归仓储管理，不在这里改。
 */
import { Card, Col, Row, Statistic, Table, Tag, Typography } from 'antd'
import { useEffect, useState } from 'react'
import { getP2tRecon } from '@/api/p2t'

interface ReconRow {
  offerNo: string
  cropName?: string
  unit: string
  supplyQty: number
  tradedQty: number
  remainingQty: number
  tradeRate: number
  auditStatus: string
  tradeStatus: string
  productCode?: string
  batchNo?: string
}

export default function P2tRecon(): JSX.Element {
  const [rows, setRows] = useState<ReconRow[]>([])

  useEffect(() => {
    getP2tRecon().then((res: { code: number; data?: ReconRow[] }) => {
      if (res?.code === 200) setRows(res.data ?? [])
    }).catch(() => setRows([]))
  }, [])

  const supply = rows.reduce((sum, r) => sum + Number(r.supplyQty ?? 0), 0)
  const traded = rows.reduce((sum, r) => sum + Number(r.tradedQty ?? 0), 0)
  const remaining = rows.reduce((sum, r) => sum + Number(r.remainingQty ?? 0), 0)

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}><Card><Statistic title="供给量合计" value={supply} precision={1} /></Card></Col>
        <Col span={8}><Card><Statistic title="成交量合计" value={traded} precision={1} /></Card></Col>
        <Col span={8}><Card><Statistic title="剩余可售" value={remaining} precision={1} /></Card></Col>
      </Row>

      <Card title="供给单三维对账">
        <Table<ReconRow>
          rowKey="offerNo"
          dataSource={rows}
          pagination={false}
          columns={[
            { title: '供给单', dataIndex: 'offerNo', width: 170 },
            { title: '品种', dataIndex: 'cropName' },
            { title: '批次', dataIndex: 'batchNo', width: 150 },
            { title: '供给量', dataIndex: 'supplyQty', align: 'right', render: (v, r) => `${v} ${r.unit}` },
            { title: '成交量', dataIndex: 'tradedQty', align: 'right', render: (v, r) => `${v} ${r.unit}` },
            { title: '剩余', dataIndex: 'remainingQty', align: 'right', render: (v, r) => `${v} ${r.unit}` },
            { title: '成交率', dataIndex: 'tradeRate', align: 'right', render: (v) => `${v}%` },
            { title: '入仓量', width: 120, render: () => <Typography.Text type="secondary">仓储管理只读</Typography.Text> },
            {
              title: '状态',
              width: 100,
              render: (_, r) => <Tag color={r.tradeStatus === 'LISTED' ? 'green' : 'default'}>{r.tradeStatus}</Tag>,
            },
            { title: '商品', dataIndex: 'productCode', width: 160, render: (v) => v ?? '—' },
          ]}
          locale={{ emptyText: '还没有供给数据' }}
        />
      </Card>
    </div>
  )
}
