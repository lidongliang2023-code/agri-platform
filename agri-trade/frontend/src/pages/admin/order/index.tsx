import { useCallback, useEffect, useState } from 'react'
import { Button, Card, Col, Descriptions, Drawer, Input, Row, Select, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { getAdminOrderDetail, getAdminOrderPage } from '@/api/admin'

interface OrderRow {
  id: number
  orderNo: string
  buyerName: string
  sellerName: string
  categoryName: string
  totalAmount: number
  paidAmount: number
  orderStatus: string
  paymentStatus: string
  logisticsNo: string
  source: string
  createTime: string
}

interface OrderItemRow {
  id: number
  productName: string
  specLevel: string
  unit: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

const ORDER_STATUS: Record<string, { text: string; color: string }> = {
  pending_confirm: { text: '待确认', color: 'warning' },
  pending: { text: '待付款', color: 'warning' },
  paid: { text: '已付款', color: 'processing' },
  shipped: { text: '已发货', color: 'blue' },
  received: { text: '已收货', color: 'cyan' },
  completed: { text: '已完成', color: 'success' },
  cancelled: { text: '已取消', color: 'default' },
  refunding: { text: '退款中', color: 'orange' },
  refunded: { text: '已退款', color: 'default' }
}

/**
 * 订单监管（PRD 10.2 第三组）。
 *
 * <p>运营看的是**全平台**订单（用户端只能看与自己相关的），所以走的是 /admin/trade 下的
 * 独立接口，而不是用户端那个 /api/trade/order/page —— 数据范围不同的两套接口不能共用。</p>
 */
export default function AdminOrderOversight() {
  const [rows, setRows] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [pageNum, setPageNum] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [orderStatus, setOrderStatus] = useState<string | undefined>()
  const [keyword, setKeyword] = useState('')
  const [detail, setDetail] = useState<{ order: OrderRow; items: OrderItemRow[] } | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    getAdminOrderPage({ pageNum, pageSize, orderStatus, keyword: keyword || undefined })
      .then((res: { code: number; data?: { records?: OrderRow[]; total?: number }; message?: string }) => {
        if (res?.code === 200) {
          setRows(res.data?.records ?? [])
          setTotal(res.data?.total ?? 0)
        } else {
          message.error(res?.message ?? '加载订单失败')
        }
      })
      .catch(() => message.error('加载订单失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [pageNum, pageSize, orderStatus, keyword])

  useEffect(() => {
    load()
  }, [load])

  const openDetail = async (id: number) => {
    const res = await getAdminOrderDetail(id)
    if (res?.code === 200) {
      setDetail(res.data)
    } else {
      message.error(res?.message ?? '加载订单详情失败')
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="180px">
            <Select
              allowClear
              placeholder="全部订单状态"
              style={{ width: '100%' }}
              onChange={(value) => {
                setPageNum(1)
                setOrderStatus(value)
              }}
              options={Object.entries(ORDER_STATUS).map(([value, item]) => ({ value, label: item.text }))}
            />
          </Col>
          <Col flex="280px">
            <Input.Search
              allowClear
              placeholder="订单号 / 采购方 / 供货方"
              onSearch={(value) => {
                setPageNum(1)
                setKeyword(value)
              }}
            />
          </Col>
          <Col flex="auto">
            <Button icon={<ReloadOutlined />} onClick={load}>
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      <Card title={`全平台订单 ${total} 条`}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1250 }}
          pagination={{
            current: pageNum,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => {
              setPageNum(page)
              setPageSize(size)
            }
          }}
          columns={[
            { title: '订单号', dataIndex: 'orderNo', width: 170 },
            { title: '采购方', dataIndex: 'buyerName', width: 160 },
            { title: '供货方', dataIndex: 'sellerName', width: 160 },
            { title: '品类', dataIndex: 'categoryName', width: 90 },
            { title: '订单金额', dataIndex: 'totalAmount', width: 130, render: (val: number) => `¥${val}` },
            {
              title: '已付',
              dataIndex: 'paidAmount',
              width: 120,
              render: (val: number) => (val ? `¥${val}` : '—')
            },
            {
              title: '订单状态',
              dataIndex: 'orderStatus',
              width: 110,
              render: (val: string) => {
                const tag = ORDER_STATUS[val] ?? { text: val, color: 'default' }
                return <Tag color={tag.color}>{tag.text}</Tag>
              }
            },
            { title: '来源', dataIndex: 'source', width: 90, render: (val: string) => (val === 'quote' ? '报价' : val === 'product' ? '货源' : val ?? '—') },
            { title: '下单时间', dataIndex: 'createTime', width: 170 },
            {
              title: '操作',
              width: 90,
              fixed: 'right',
              render: (_: unknown, row: OrderRow) => (
                <Button type="link" size="small" onClick={() => openDetail(row.id)}>
                  详情
                </Button>
              )
            }
          ]}
        />
      </Card>

      <Drawer width={720} open={Boolean(detail)} onClose={() => setDetail(null)} title="订单监管详情">
        {detail && (
          <>
            <Descriptions column={2} size="small" bordered>
              <Descriptions.Item label="订单号" span={2}>
                {detail.order.orderNo}
              </Descriptions.Item>
              <Descriptions.Item label="采购方">{detail.order.buyerName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="供货方">{detail.order.sellerName ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="订单金额">¥{detail.order.totalAmount}</Descriptions.Item>
              <Descriptions.Item label="已付金额">
                {detail.order.paidAmount ? `¥${detail.order.paidAmount}` : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="订单状态">{detail.order.orderStatus}</Descriptions.Item>
              <Descriptions.Item label="支付状态">{detail.order.paymentStatus}</Descriptions.Item>
              <Descriptions.Item label="物流单号">{detail.order.logisticsNo ?? '—'}</Descriptions.Item>
              <Descriptions.Item label="来源">
                {detail.order.source === 'quote' ? '报价转单' : detail.order.source === 'product' ? '货源直下单' : detail.order.source ?? '—'}
              </Descriptions.Item>
              <Descriptions.Item label="下单时间" span={2}>
                {detail.order.createTime}
              </Descriptions.Item>
            </Descriptions>
            <Card title="订单明细" size="small" style={{ marginTop: 16 }}>
              <Table
                rowKey="id"
                size="small"
                pagination={false}
                dataSource={detail.items}
                columns={[
                  { title: '商品', dataIndex: 'productName' },
                  { title: '等级', dataIndex: 'specLevel', render: (val: string) => val || '—' },
                  {
                    title: '数量',
                    dataIndex: 'quantity',
                    render: (val: number, row: OrderItemRow) => `${val} ${row.unit ?? ''}`
                  },
                  { title: '单价', dataIndex: 'unitPrice', render: (val: number) => `¥${val}` },
                  { title: '金额', dataIndex: 'totalPrice', render: (val: number) => `¥${val}` }
                ]}
              />
            </Card>
            <Space style={{ marginTop: 16 }}>
              <Button onClick={() => setDetail(null)}>关闭</Button>
            </Space>
          </>
        )}
      </Drawer>
    </div>
  )
}
