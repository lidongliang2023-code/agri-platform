/**
 * 页面名称：撮合订单与回写
 * 路由路径：/admin/trade/p2t/orders
 * 所属模块：订单管理 / 生产直供
 */
import { useCallback, useEffect, useState } from 'react'
import { Button, Input, Select, Tag, message } from 'antd'
import { ListRowActions } from '@agri/shared'
import { getP2tOrders, retryP2tWriteback } from '@/api/p2t'
import type { P2tOrder } from '@/api/p2t'
import { TradeFilters, TradeList } from '@/components/TradeList'

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
  const [pageSize, setPageSize] = useState(20)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<string>('')
  const [draftKeyword, setDraftKeyword] = useState('')
  const [draftStatus, setDraftStatus] = useState<string>('')

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

  const handleQuery = () => {
    setPageNum(1)
    setStatus(draftStatus)
    setKeyword(draftKeyword.trim())
  }

  const handleReset = () => {
    setDraftStatus('')
    setDraftKeyword('')
    setPageNum(1)
    setStatus('')
    setKeyword('')
  }

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
      <TradeList<P2tOrder>
        listId="admin-p2t-orders"
        rowKey="orderNo"
        loading={loading}
        dataSource={rows}
        onRefresh={load}
        toolbarLeft={<span style={{ fontWeight: 600 }}>生产直供订单（共 {total} 条）</span>}
        filterSlot={(
          <TradeFilters
            loading={loading}
            onQuery={handleQuery}
            onReset={handleReset}
            fields={[
              {
                label: '回写状态',
                control: (
                  <Select
                    value={draftStatus}
                    onChange={(v) => {
                      setDraftStatus(v)
                      setPageNum(1)
                      setStatus(v)
                    }}
                    options={[
                      { value: '', label: '全部回写状态' },
                      { value: 'SUCCESS', label: '成功' },
                      { value: 'FAILED', label: '失败待重试' },
                      { value: 'PENDING', label: '待回写' },
                    ]}
                  />
                ),
              },
              {
                label: '关键字',
                control: (
                  <Input
                    allowClear
                    value={draftKeyword}
                    placeholder="订单号 / 买家 / 供给单号"
                    onChange={(e) => setDraftKeyword(e.target.value)}
                    onPressEnter={handleQuery}
                  />
                ),
              },
            ]}
          />
        )}
        pagination={{
          current: pageNum,
          pageSize,
          total,
          onChange: (p, s) => {
            setPageNum(p)
            setPageSize(s)
          },
        }}
        columns={[
          { title: '订单号', dataIndex: 'orderNo', width: 180, ellipsis: true },
          { title: '买家', dataIndex: 'buyerName', width: 160, ellipsis: true },
          { title: '商品', dataIndex: 'productName', width: 180, ellipsis: true },
          { title: '来源供给', dataIndex: 'sourceOfferNo', width: 165, ellipsis: true },
          { title: '数量', dataIndex: 'totalQuantity', width: 96 },
          { title: '金额', dataIndex: 'totalAmount', width: 120, render: (v) => (v == null ? '—' : `¥${v}`) },
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
            key: 'action',
            width: 110,
            render: (_, r) => (
              r.p2tWritebackStatus === 'FAILED' || r.p2tWritebackStatus === 'PENDING' ? (
                <ListRowActions>
                  <Button size="small" type="link" onClick={() => void retry(r.orderNo)}>重试回写</Button>
                </ListRowActions>
              ) : (
                <span style={{ color: '#a0aec0' }}>—</span>
              )
            ),
          },
        ]}
        locale={{ emptyText: '还没有生产直供订单：先在供给池「转商品」，买家下单支付后才会产生' }}
      />
    </div>
  )
}
