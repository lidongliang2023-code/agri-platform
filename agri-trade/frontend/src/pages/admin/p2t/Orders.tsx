/**
 * 页面名称：撮合订单与回写
 * 路由路径：/admin/trade/p2t/orders
 * 所属模块：订单管理 / 生产直供
 *
 * 订单主数据归交易端。本页只关心与生产有关的字段回写：成交数量、需求等级、
 * 锁定时段、买家类型 —— 回写不含成交价格，也不反向修改订单。
 */
import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Input, Select, Table, Tag, message } from 'antd'
import { getP2tOrders, retryP2tWriteback } from '@/api/p2t'
import type { P2tOrder } from '@/api/p2t'

const WB: Record<string, { text: string; color: string }> = {
  SUCCESS: { text: '成功', color: 'green' },
  FAILED: { text: '失败待重试', color: 'red' },
  RETRYING: { text: '重试中', color: 'blue' },
  PENDING: { text: '待支付回写', color: 'default' },
}

export default function P2tOrders(): JSX.Element {
  const [rows, setRows] = useState<P2tOrder[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>('')

  const load = useCallback(() => {
    setLoading(true)
    getP2tOrders({ pageNum, pageSize, keyword: keyword || undefined, status: status || undefined })
      .then((res: { code: number; data?: { records?: P2tOrder[]; total?: number }; message?: string }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
          setTotal(res.data?.total ?? 0)
        } else {
          message.error(res?.message ?? '加载订单失败')
        }
      })
      .catch(() => message.error('加载订单失败'))
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, keyword, status])

  useEffect(() => { load() }, [load])

  const retry = async (orderNo: string): Promise<void> => {
    const res = await retryP2tWriteback(orderNo)
    if (res?.code === 200) {
      message.success(res.data?.status === 'SUCCESS' ? '回写成功' : `回写仍失败：${res.data?.message ?? ''}`)
      load()
    } else {
      message.error(res?.message ?? '重试失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Card title="生产直供订单" extra={
        <div style={{ display: 'flex', gap: 8 }}>
          <Select style={{ width: 150 }} value={status} onChange={(v) => { setPageNum(1); setStatus(v) }}
            options={[
              { value: '', label: '全部回写状态' },
              { value: 'SUCCESS', label: '成功' },
              { value: 'FAILED', label: '失败待重试' },
              { value: 'PENDING', label: '待回写' },
            ]} />
          <Input.Search placeholder="订单号 / 买家 / 供给单号" allowClear style={{ width: 280 }}
            onSearch={(v) => { setPageNum(1); setKeyword(v) }} />
        </div>
      }>
        <Table<P2tOrder>
          rowKey="orderNo"
          loading={loading}
          dataSource={rows}
          pagination={{
            current: pageNum, pageSize, total, showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, s) => { setPageNum(p); setPageSize(s) },
          }}
          columns={[
            { title: '订单号', dataIndex: 'orderNo', width: 180 },
            { title: '买家', dataIndex: 'buyerName' },
            { title: '商品', dataIndex: 'productName' },
            { title: '来源供给', dataIndex: 'sourceOfferNo', width: 165 },
            { title: '数量', dataIndex: 'totalQuantity', align: 'right', width: 90 },
            { title: '金额', dataIndex: 'totalAmount', align: 'right', width: 120, render: (v) => (v == null ? '—' : `¥${v}`) },
            {
              title: '订单状态',
              dataIndex: 'paymentStatus',
              width: 110,
              render: (v: string) => <Tag color={v === 'paid' ? 'green' : 'default'}>{v}</Tag>,
            },
            {
              title: '回写',
              dataIndex: 'p2tWritebackStatus',
              width: 120,
              render: (v: string) => (v ? <Tag color={WB[v]?.color}>{WB[v]?.text ?? v}</Tag> : '—'),
            },
            {
              title: '操作',
              width: 110,
              render: (_, r) => (
                r.p2tWritebackStatus === 'FAILED' || r.p2tWritebackStatus === 'PENDING'
                  ? <Button size="small" type="link" onClick={() => void retry(r.orderNo)}>重试回写</Button>
                  : null
              ),
            },
          ]}
          locale={{ emptyText: '还没有生产直供订单：先在供给池「转商品」，买家下单支付后才会产生' }}
        />
      </Card>
    </div>
  )
}
