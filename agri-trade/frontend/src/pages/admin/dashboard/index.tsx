import { useEffect, useState } from 'react'
import { Alert, Card, Col, Empty, List, Row, Spin, Statistic, Table, Typography, message } from 'antd'
import { getAdminOverview, type AdminOverview } from '@/api/admin'

/**
 * 交易大盘（PRD 10.2 第一组）。
 *
 * <p>所有数字都来自真实表聚合（订单 / 货源 / 纠纷），没有一个写死 ——
 * 用户端那边的 /api/trade/operation/* 返回的是代码里写死的字符串数组，是反面教材。</p>
 */
export default function AdminDashboard() {
  const [data, setData] = useState<AdminOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getAdminOverview()
      .then((res: { code: number; data?: AdminOverview; message?: string }) => {
        if (res?.code === 200) setData(res.data ?? null)
        else message.error(res?.message ?? '加载大盘失败')
      })
      .catch(() => message.error('加载大盘失败（检查后端是否在运行）'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    )
  }
  if (!data) {
    return <Empty description="暂无大盘数据" style={{ padding: 80 }} />
  }

  const { summary, todos, trend, categoryStats, regionStats } = data
  const todoCount = todos.pendingProductCount + todos.openDisputeCount + todos.refundingOrderCount

  return (
    <div style={{ padding: 20 }}>
      <Row gutter={[16, 16]}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="订单总数" value={summary.orderCount} suffix="笔" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="交易总额" value={Number(summary.totalAmount)} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="已收金额" value={Number(summary.paidAmount)} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="客单价" value={Number(summary.avgOrderAmount)} precision={2} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Alert
        style={{ marginTop: 16 }}
        type={todoCount > 0 ? 'warning' : 'success'}
        showIcon
        message={
          <span>
            待办：货源待审核 <b>{todos.pendingProductCount}</b> 条 · 待处理纠纷 <b>{todos.openDisputeCount}</b> 件 ·
            退款中订单 <b>{todos.refundingOrderCount}</b> 笔　　待付款 <b>{summary.pendingPaymentCount}</b> 笔 ·
            已完成 <b>{summary.completedCount}</b> 笔
          </span>
        }
      />

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="近 7 日交易趋势">
            <Table
              rowKey="date"
              size="small"
              dataSource={trend}
              pagination={false}
              columns={[
                { title: '日期', dataIndex: 'date' },
                { title: '订单数', dataIndex: 'count' },
                { title: '交易额', dataIndex: 'amount', render: (val: number) => `¥${val}` }
              ]}
            />
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title="品类分布">
            {categoryStats.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <List
                size="small"
                dataSource={categoryStats}
                renderItem={(item) => (
                  <List.Item>
                    <span>{item.name}</span>
                    <span style={{ color: '#1565C0' }}>
                      {item.count} 笔 / ¥{item.amount}
                    </span>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col xs={24} lg={6}>
          <Card title="区域分布（按收货省份）">
            {regionStats.length === 0 ? (
              <Empty description="暂无数据" />
            ) : (
              <List
                size="small"
                dataSource={regionStats}
                renderItem={(item) => (
                  <List.Item>
                    <span>{item.name}</span>
                    <span style={{ color: '#1565C0' }}>
                      {item.count} 笔 / ¥{item.amount}
                    </span>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
        说明：数据取自订单 / 货源 / 纠纷三张真实表；用户端那三个 operation/* 统计接口返回的是
        代码里写死的数组，运营端不采用。
      </Typography.Paragraph>
    </div>
  )
}
