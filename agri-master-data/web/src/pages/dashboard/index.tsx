import { useQuery } from '@tanstack/react-query'
import { Card, Row, Col, Statistic, Table, Button } from 'antd'
import { BuildOutlined, UserOutlined, TeamOutlined, InboxOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { dashboardAPI } from '@/api'

function Dashboard() {
  const { data: overviewData } = useQuery<{ data: { tenantCount: number; userCount: number; orgCount: number; productCount: number; activityData: number[] } }>({
    queryKey: ['masterdata-dashboard'],
    queryFn: dashboardAPI.overview,
    initialData: {
      data: {
        tenantCount: 128,
        userCount: 3542,
        orgCount: 567,
        productCount: 8934,
        activityData: [65, 78, 82, 71, 85, 45, 38],
      },
    },
  })

  const data = overviewData?.data || {}

  const activityChartOption = {
    title: { text: '主体活跃度趋势', left: 'center', textStyle: { fontSize: 14, fontWeight: 500 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
    yAxis: { type: 'value' },
    series: [{ data: data.activityData, type: 'bar', color: '#10b981' }],
  }

  const pendingAudits = [
    { id: 1, title: '用户张三实名认证审核', icon: '👤', time: '10分钟前' },
    { id: 2, title: '组织XX公司资质审核', icon: '🏠', time: '30分钟前' },
    { id: 3, title: '用户李四企业认证审核', icon: '👤', time: '1小时前' },
    { id: 4, title: '商品有机认证审核', icon: '📦', time: '2小时前' },
  ]

  const alerts = [
    { id: 1, level: 'error', message: '主体T001数据同步失败', time: '5分钟前', module: '数据分发' },
    { id: 2, level: 'warning', message: '数据质量评分低于阈值', time: '15分钟前', module: '数据质量' },
    { id: 3, level: 'info', message: '新主体注册成功', time: '30分钟前', module: '主体管理' },
    { id: 4, level: 'warning', message: 'API调用次数接近上限', time: '1小时前', module: '系统监控' },
  ]

  const statCards = [
    { title: '主体总数', value: data.tenantCount, icon: <BuildOutlined />, color: '#10b981' },
    { title: '用户总数', value: data.userCount, icon: <UserOutlined />, color: '#3b82f6' },
    { title: '组织总数', value: data.orgCount, icon: <TeamOutlined />, color: '#f59e0b' },
    { title: '商品总数', value: data.productCount, icon: <InboxOutlined />, color: '#8b5cf6' },
  ]

  const alertColumns = [
    { title: '级别', dataIndex: 'level', key: 'level', render: (text: string) => (
      <span className={`alert-badge ${text}`}>{text === 'error' ? '错误' : text === 'warning' ? '警告' : '信息'}</span>
    )},
    { title: '消息', dataIndex: 'message', key: 'message' },
    { title: '模块', dataIndex: 'module', key: 'module' },
    { title: '时间', dataIndex: 'time', key: 'time' },
    { title: '操作', key: 'action', render: () => <Button size="small" style={{ background: '#10b981', borderColor: '#10b981' }}>处理</Button> },
  ]

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>运营总览</h2>
        <p style={styles.pageDesc}>数据概览与统计分析</p>
      </div>
      <Row gutter={16}>
        {statCards.map((card) => (
          <Col span={6} key={card.title}>
            <Card style={styles.statCard}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ ...styles.statIcon, background: card.color }}>
                  {card.icon}
                </div>
                <div>
                  <Statistic title={card.title} value={card.value} valueStyle={{ fontSize: 24, fontWeight: 600 }} />
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={14}>
          <Card style={styles.chartCard}>
            <ReactECharts option={activityChartOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col span={10}>
          <Card style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>待审核事项</h3>
              <Button size="small">查看全部</Button>
            </div>
            <div style={styles.auditList}>
              {pendingAudits.map((item) => (
                <div key={item.id} style={styles.auditItem}>
                  <span style={styles.auditIcon}>{item.icon}</span>
                  <div style={styles.auditInfo}>
                    <span style={styles.auditTitle}>{item.title}</span>
                    <span style={styles.auditTime}>{item.time}</span>
                  </div>
                  <Button size="small" style={styles.auditAction}>审核</Button>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card style={styles.card}>
            <div style={styles.cardHeader}>
              <h3 style={styles.cardTitle}>系统告警</h3>
              <Button size="small">查看全部</Button>
            </div>
            <Table columns={alertColumns} dataSource={alerts} rowKey="id" pagination={false} />
          </Card>
        </Col>
      </Row>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: {
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
    marginBottom: 4,
  },
  pageDesc: {
    fontSize: 14,
    color: '#6b7280',
    margin: 0,
  },
  statCard: {
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  statIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#fff',
    fontSize: 20,
  },
  chartCard: {
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  card: {
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
  },
  auditList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  auditItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    background: '#f8fafc',
    borderRadius: 8,
  },
  auditIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: 'rgba(16, 185, 129, 0.1)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
  },
  auditInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
  },
  auditTitle: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: 500,
  },
  auditTime: {
    fontSize: 11,
    color: '#6b7280',
  },
  auditAction: {
    background: '#10b981',
    borderColor: '#10b981',
    borderRadius: 6,
  },
}

export default Dashboard
