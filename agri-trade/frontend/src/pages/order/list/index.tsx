import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Col, Input, Row, Select, Space, Table, Tag, message } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { getOrderList, type OrderQuery } from '@/api/order'
import { getMyMerchants, type MyMerchant } from '@/api/identity'

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
  createTime: string
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

const PAY_STATUS: Record<string, { text: string; color: string }> = {
  unpaid: { text: '未支付', color: 'warning' },
  partial: { text: '部分支付', color: 'orange' },
  paid: { text: '已支付', color: 'success' },
  refunded: { text: '已退款', color: 'default' }
}

/**
 * 订单列表（原型"订单管理 → 订单列表"）。
 *
 * <p>身份不再自报：范围由后端按登录令牌推导（后端调 core-platform 的
 * /api/v1/platform/merchants/mine）。前端此前把登录用户 id 当 participantId 传上来，
 * 与交易表里的经营主体号不是一个域，所以"永远查不到"；而只要改这个参数又能看别人的单据。
 * 现在前端连这个参数都不再传。</p>
 */
export default function OrderList() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<OrderRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  // 只查"与我有关"的订单（我是买家或卖家）。范围由后端推导，这里不传参与方。
  const [query, setQuery] = useState<OrderQuery>({
    pageNum: 1,
    pageSize: 10
  })
  // 我的主体：用来把"没有单据"和"没绑主体"区分开（否则就是一张说不清的空表）
  const [merchants, setMerchants] = useState<MyMerchant[] | null>(null)
  const [identityError, setIdentityError] = useState<string | null>(null)

  useEffect(() => {
    getMyMerchants()
      .then((res) => {
        if (res?.code === 200) {
          setMerchants(res.data ?? [])
          setIdentityError(null)
        } else {
          setMerchants([])
          setIdentityError(res?.message ?? '无法解析你的经营主体')
        }
      })
      .catch(() => {
        setMerchants([])
        setIdentityError('无法解析你的经营主体（请检查 core-platform 是否在运行）')
      })
  }, [])

  const load = useCallback((next: OrderQuery) => {
    setLoading(true)
    getOrderList(next)
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
  }, [])

  useEffect(() => {
    load(query)
  }, [query, load])

  return (
    <div style={{ padding: 20 }}>
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]} align="middle">
          <Col flex="260px">
            <Input.Search
              allowClear
              placeholder="按订单号搜索"
              onSearch={(value) => setQuery((prev) => ({ ...prev, pageNum: 1, orderNo: value || undefined }))}
            />
          </Col>
          <Col flex="180px">
            <Select
              allowClear
              placeholder="全部订单状态"
              style={{ width: '100%' }}
              onChange={(value) => setQuery((prev) => ({ ...prev, pageNum: 1, orderStatus: value }))}
              options={Object.entries(ORDER_STATUS).map(([value, item]) => ({ value, label: item.text }))}
            />
          </Col>
          <Col flex="160px">
            <Select
              allowClear
              placeholder="全部支付状态"
              style={{ width: '100%' }}
              onChange={(value) => setQuery((prev) => ({ ...prev, pageNum: 1, paymentStatus: value }))}
              options={Object.entries(PAY_STATUS).map(([value, item]) => ({ value, label: item.text }))}
            />
          </Col>
          <Col flex="auto">
            <Space>
              <Button icon={<ReloadOutlined />} onClick={() => load(query)}>
                刷新
              </Button>
              <Button type="primary" onClick={() => navigate('/order/create')}>
                创建订单
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card title={`订单 ${total} 条`}>
        {identityError && (
          <Alert type="error" showIcon style={{ marginBottom: 12 }} message="身份解析失败" description={identityError} />
        )}
        {!identityError && merchants?.length === 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            message="当前账号还没有绑定经营主体"
            description="因此查询不到任何订单。这不是权限故障，也不能靠放开查询范围来解决（那会让买家看到别人的订单）。请运营在「用户-主体绑定」里为你绑定经营主体后重试。"
          />
        )}
        {!identityError && merchants && merchants.length > 0 && (
          <div style={{ marginBottom: 12, color: '#666' }}>
            当前身份：{merchants.map((item) => `${item.merchantName}（${item.roleInMerchant}）`).join('、')}
          </div>
        )}
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          scroll={{ x: 1200 }}
          pagination={{
            current: query.pageNum,
            pageSize: query.pageSize,
            total,
            showSizeChanger: true,
            onChange: (page, size) => setQuery((prev) => ({ ...prev, pageNum: page, pageSize: size }))
          }}
          columns={[
            {
              title: '订单号',
              dataIndex: 'orderNo',
              width: 170,
              render: (text: string, row: OrderRow) => (
                <a onClick={() => navigate(`/order/detail/${row.id}`)}>{text}</a>
              )
            },
            { title: '采购方', dataIndex: 'buyerName', width: 160 },
            { title: '供货方', dataIndex: 'sellerName', width: 160 },
            { title: '品类', dataIndex: 'categoryName', width: 100 },
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
            {
              title: '支付状态',
              dataIndex: 'paymentStatus',
              width: 110,
              render: (val: string) => {
                const tag = PAY_STATUS[val] ?? { text: val, color: 'default' }
                return <Tag color={tag.color}>{tag.text}</Tag>
              }
            },
            { title: '下单时间', dataIndex: 'createTime', width: 170 },
            {
              title: '操作',
              width: 90,
              fixed: 'right',
              render: (_: unknown, row: OrderRow) => (
                <Button type="link" size="small" onClick={() => navigate(`/order/detail/${row.id}`)}>
                  详情
                </Button>
              )
            }
          ]}
        />
      </Card>
    </div>
  )
}
