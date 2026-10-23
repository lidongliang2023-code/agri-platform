import { useQuery } from '@tanstack/react-query'
import { Card, Row, Col, Statistic } from 'antd'
import { CloudOutlined, WifiOutlined, DisconnectOutlined, AlertOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { dashboardAPI } from '@/api'

function Dashboard() {
  const { data: overviewData } = useQuery<{ data: { deviceCount: number; onlineCount: number; offlineCount: number; alertCount: number; tempData: number[]; humidityData: number[] } }>({
    queryKey: ['iot-dashboard'],
    queryFn: dashboardAPI.overview,
    initialData: {
      data: {
        deviceCount: 15,
        onlineCount: 12,
        offlineCount: 3,
        alertCount: 5,
        tempData: [18, 22, 25, 28, 30, 27, 24],
        humidityData: [65, 62, 58, 55, 52, 56, 60],
      },
    },
  })

  const data = overviewData?.data || {}

  const tempChartOption = {
    title: { text: '温度趋势', left: 'center', textStyle: { fontSize: 14, fontWeight: 500 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
    yAxis: { type: 'value' },
    series: [{ data: data.tempData, type: 'line', smooth: true, color: '#10b981' }],
  }

  const humidityChartOption = {
    title: { text: '湿度趋势', left: 'center', textStyle: { fontSize: 14, fontWeight: 500 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
    yAxis: { type: 'value' },
    series: [{ data: data.humidityData, type: 'line', smooth: true, color: '#3b82f6' }],
  }

  const statCards = [
    { title: '设备总数', value: data.deviceCount, icon: <CloudOutlined />, color: '#10b981' },
    { title: '在线设备', value: data.onlineCount, icon: <WifiOutlined />, color: '#3b82f6' },
    { title: '离线设备', value: data.offlineCount, icon: <DisconnectOutlined />, color: '#ef4444' },
    { title: '待处理告警', value: data.alertCount, icon: <AlertOutlined />, color: '#f59e0b' },
  ]

  return (
    <div>
      <div style={styles.pageHeader}>
        <h2 style={styles.pageTitle}>数据概览</h2>
        <p style={styles.pageDesc}>实时监控物联网设备数据和告警状态</p>
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
        <Col span={12}>
          <Card style={styles.chartCard}>
            <ReactECharts option={tempChartOption} style={{ height: 300 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card style={styles.chartCard}>
            <ReactECharts option={humidityChartOption} style={{ height: 300 }} />
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
}

export default Dashboard
