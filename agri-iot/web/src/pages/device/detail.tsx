import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Card, Button, Row, Col, Statistic } from 'antd'
import { ArrowLeftOutlined, CloudOutlined, WifiOutlined, DisconnectOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import { deviceAPI } from '@/api'

function DeviceDetail() {
  const { id } = useParams<{ id: string }>()

  const { data: deviceData } = useQuery<{ data: { id: number; name: string; type: string; status: string; location: string; deviceNo: string; temp: number; humidity: number } }>({
    queryKey: ['device-detail', id],
    queryFn: () => deviceAPI.get(Number(id)),
    initialData: {
      data: {
        id: Number(id),
        name: '温湿度传感器-A1',
        type: '温湿度',
        status: 'online',
        location: '阳光农场A区',
        deviceNo: 'DEV-0001',
        temp: 28,
        humidity: 55,
      },
    },
  })

  const device = deviceData?.data || {}

  const dataChartOption = {
    title: { text: '数据趋势', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category', data: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00'] },
    yAxis: { type: 'value' },
    series: [
      { name: '温度', data: [22, 25, 28, 30, 27, 24], type: 'line', smooth: true, color: '#ef4444' },
      { name: '湿度', data: [65, 62, 58, 55, 56, 60], type: 'line', smooth: true, color: '#3b82f6' },
    ],
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => window.history.back()}>
          返回
        </Button>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>{device.name}</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>设备详情</p>
        </div>
      </div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>
                <CloudOutlined />
              </div>
              <div>
                <Statistic title="设备编号" value={device.deviceNo} />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: device.status === 'online' ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 20 }}>
                {device.status === 'online' ? <WifiOutlined /> : <DisconnectOutlined />}
              </div>
              <div>
                <Statistic title="设备状态" value={device.status === 'online' ? '在线' : '离线'} />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="当前温度" value={device.temp} suffix="℃" valueStyle={{ color: '#ef4444' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="当前湿度" value={device.humidity} suffix="%" valueStyle={{ color: '#3b82f6' }} />
          </Card>
        </Col>
      </Row>
      <Card title="实时数据">
        <ReactECharts option={dataChartOption} style={{ height: 300 }} />
      </Card>
    </div>
  )
}

export default DeviceDetail
