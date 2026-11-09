import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Space } from 'antd'
import PageContainer from '@/components/ProductionPageContainer'

export default function YieldForecast(): JSX.Element {
  const navigate = useNavigate()
  return (
    <PageContainer title="产量预测" subTitle="算法模型接入状态说明">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="产量预测算法模型未接入"
          description="当前部署未接入产量预测模型，不使用样本量或固定数值推算产量。生产排产与产量核算请查阅实际采收台账、在地地块面积与农事计划。"
        />
        <Card title="可用业务替代入口">
          <Space wrap size={16}>
            <Button type="primary" onClick={() => navigate('/production/harvests')}>
              查看采收台账
            </Button>
            <Button onClick={() => navigate('/production/plots')}>查看地块台账</Button>
            <Button onClick={() => navigate('/production/plans')}>查看农事计划</Button>
            <Button onClick={() => navigate('/production/ai/assistant')}>前往农事智能助手</Button>
          </Space>
        </Card>
      </Space>
    </PageContainer>
  )
}
