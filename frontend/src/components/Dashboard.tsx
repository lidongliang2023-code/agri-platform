import { Card, Row, Col, Statistic } from 'antd'
import { UsersOutlined, ShoppingCartOutlined, TruckOutlined, BarChartOutlined } from '@ant-design/icons'

const stats = [
  { title: '用户总数', value: 128, icon: UsersOutlined, color: '#1890ff' },
  { title: '交易订单', value: 356, icon: ShoppingCartOutlined, color: '#52c41a' },
  { title: '物流配送', value: 89, icon: TruckOutlined, color: '#faad14' },
  { title: '数据分析', value: '98%', icon: BarChartOutlined, color: '#f5222d' },
]

export default function Dashboard() {
  return (
    <div>
      <h2>数据概览</h2>
      <Row gutter={16} style={{ marginTop: 24 }}>
        {stats.map((stat, index) => (
          <Col span={6} key={index}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={<stat.icon style={{ color: stat.color }} />}
              />
            </Card>
          </Col>
        ))}
      </Row>
      
      <div style={{ marginTop: 24 }}>
        <Card title="系统公告" style={{ minHeight: 300 }}>
          <p style={{ color: '#666' }}>欢迎使用农业产业互联网平台！</p>
          <ul style={{ marginTop: 16, color: '#888' }}>
            <li>平台已成功上线，支持九大业务模块</li>
            <li>主数据管理模块已完成开发</li>
            <li>更多功能正在持续开发中...</li>
          </ul>
        </Card>
      </div>
    </div>
  )
}