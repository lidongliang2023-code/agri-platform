import { useCallback, useEffect, useState } from 'react'
import { Alert, Card, Col, Row, Statistic, Table, Tabs, Tag, Typography, message } from 'antd'
import { getMineDashboard, type BuyerDashboard, type MineDashboard, type SellerDashboard } from '@/api/mine-dashboard'

/**
 * 我的看板（用户端）。
 *
 * 这一页此前没有入口 —— 后端那组 dashboard 接口一个都没被前端调用过，
 * 而且里面相当一部分数字是**编出来的**（7 日趋势用随机数生成、
 * "TOP 采购商"干脆是凭空造的人、平均评分是 4.5+随机数、商家名是"商家"+id）。
 * 现在数字全部来自真实表，没有数据来源的指标（收藏/关注）已从接口里删掉。
 *
 * 口径：收入/支出排除已取消订单；"进行中"= 未完成、未取消、未退款；
 * 平均评分只算已展示的评价，没有评价时显示"—"而不是给个分。
 */
export default function MineDashboardPage() {
  const [data, setData] = useState<MineDashboard | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getMineDashboard()
      if (res?.code === 200) {
        setData(res.data)
      } else {
        message.error(res?.message ?? '加载看板失败')
      }
    } catch {
      message.error('加载看板失败（请检查后端是否在运行）')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const money = (v: number | undefined | null) =>
    v == null ? '—' : `¥${Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}`

  const trendTable = (rows: { date: string; amount: number; orderCount: number }[] | undefined, title: string) => (
    <Table
      rowKey="date"
      size="small"
      title={() => title}
      dataSource={rows ?? []}
      pagination={false}
      columns={[
        { title: '日期', dataIndex: 'date', width: 130 },
        { title: '订单笔数', dataIndex: 'orderCount', width: 110, align: 'right' as const },
        { title: '金额', dataIndex: 'amount', width: 160, align: 'right' as const, render: money }
      ]}
    />
  )

  const statusTable = (rows: { statusName: string; count: number; amount: number }[] | undefined) => (
    <Table
      rowKey="statusName"
      size="small"
      title={() => '订单状态分布'}
      dataSource={rows ?? []}
      pagination={false}
      locale={{ emptyText: '暂无订单' }}
      columns={[
        { title: '状态', dataIndex: 'statusName', width: 120 },
        { title: '笔数', dataIndex: 'count', width: 90, align: 'right' as const },
        { title: '金额', dataIndex: 'amount', width: 160, align: 'right' as const, render: money }
      ]}
    />
  )

  const sellerTab = (seller: SellerDashboard | null) =>
    !seller ? (
      <Alert type="warning" showIcon message="看不到供方数据" description="当前主体还没有作为供应方的记录。" />
    ) : (
      <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card><Statistic title="累计收入（不含取消）" value={seller.totalRevenue} prefix="¥" precision={2} /></Card></Col>
          <Col span={6}><Card><Statistic title="今日收入" value={seller.todayRevenue} prefix="¥" precision={2} /></Card></Col>
          <Col span={6}><Card><Statistic title="订单笔数" value={seller.totalOrders} suffix="笔" /></Card></Col>
          <Col span={6}>
            <Card>
              <Statistic title="平均评分" value={seller.avgRating ?? '—'} suffix={seller.avgRating == null ? '' : '分'} />
            </Card>
          </Col>
        </Row>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card><Statistic title="进行中订单" value={seller.pendingOrders} suffix="笔" /></Card></Col>
          <Col span={6}><Card><Statistic title="已完成订单" value={seller.completedOrders} suffix="笔" /></Card></Col>
          <Col span={6}><Card><Statistic title="客单价" value={seller.avgOrderValue} prefix="¥" precision={2} /></Card></Col>
          <Col span={6}><Card><Statistic title="货源数（在架）" value={seller.productCount} suffix={`个（${seller.activeProducts}）`} /></Card></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>{trendTable(seller.revenueTrend, '近 7 日收入趋势')}</Col>
          <Col span={12}>{statusTable(seller.orderStatusDistribution)}</Col>
        </Row>
        <Card title="热销货源（按订单明细聚合）" style={{ marginTop: 16 }}>
          <Table
            rowKey="productName"
            size="small"
            dataSource={seller.topProducts ?? []}
            pagination={false}
            locale={{ emptyText: '还没有成交的货源' }}
            columns={[
              { title: '货源', dataIndex: 'productName' },
              { title: '成交数量', dataIndex: 'salesCount', width: 110, align: 'right' as const },
              { title: '成交额', dataIndex: 'totalSales', width: 160, align: 'right' as const, render: money },
              { title: '成交均价', dataIndex: 'avgPrice', width: 140, align: 'right' as const, render: money }
            ]}
          />
        </Card>
      </>
    )

  const buyerTab = (buyer: BuyerDashboard | null) =>
    !buyer ? (
      <Alert type="warning" showIcon message="看不到采方数据" description="当前主体还没有作为采购方的记录。" />
    ) : (
      <>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}><Card><Statistic title="累计支出（不含取消）" value={buyer.totalSpent} prefix="¥" precision={2} /></Card></Col>
          <Col span={6}><Card><Statistic title="今日支出" value={buyer.todaySpent} prefix="¥" precision={2} /></Card></Col>
          <Col span={6}><Card><Statistic title="订单笔数" value={buyer.totalOrders} suffix="笔" /></Card></Col>
          <Col span={6}><Card><Statistic title="客单价" value={buyer.avgOrderValue} prefix="¥" precision={2} /></Card></Col>
        </Row>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}><Card><Statistic title="进行中订单" value={buyer.pendingOrders} suffix="笔" /></Card></Col>
          <Col span={8}><Card><Statistic title="已完成订单" value={buyer.completedOrders} suffix="笔" /></Card></Col>
          <Col span={8}><Card><Statistic title="今日订单" value={buyer.todayOrders} suffix="笔" /></Card></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>{trendTable(buyer.spendingTrend, '近 7 日支出趋势')}</Col>
          <Col span={12}>{statusTable(buyer.orderStatusDistribution)}</Col>
        </Row>
        <Card title="采购品类分布" style={{ marginTop: 16 }}>
          <Table
            rowKey="categoryName"
            size="small"
            dataSource={buyer.purchaseCategories ?? []}
            pagination={false}
            locale={{ emptyText: '还没有采购记录' }}
            columns={[
              { title: '品类', dataIndex: 'categoryName' },
              { title: '订单笔数', dataIndex: 'orderCount', width: 110, align: 'right' as const },
              { title: '金额', dataIndex: 'totalAmount', width: 160, align: 'right' as const, render: money }
            ]}
          />
        </Card>
      </>
    )

  return (
    <div style={{ padding: 20 }}>
      <Card
        title={`我的经营看板${data?.merchantName ? ' · ' + data.merchantName : ''}`}
        style={{ marginBottom: 16 }}
      >
        <Alert
          type="info"
          showIcon
          message="数字全部取自真实单据"
          description="收入/支出排除已取消订单；平均评分取自已展示的评价（没有评价时显示 —，不会给一个编出来的分）；热销货源按订单明细聚合，TOP 采购商按订单里的买方聚合。"
        />
        {data?.message && (
          <Alert type="warning" showIcon style={{ marginTop: 12 }} message={data.message} />
        )}
      </Card>

      <Tabs
        items={[
          { key: 'seller', label: '作为供应方', children: sellerTab(data?.seller ?? null) },
          { key: 'buyer', label: '作为采购方', children: buyerTab(data?.buyer ?? null) }
        ]}
      />

      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
        说明：看板范围由服务端按登录账号绑定的经营主体推导，不接受前端指定"看谁的"。
        绑定了多家主体时以第一家的视角展示。
      </Typography.Paragraph>
      {loading && <Tag>加载中…</Tag>}
    </div>
  )
}
