import { useNavigate } from 'react-router-dom'
import { Alert, Button, Card, Space } from 'antd'
import PageContainer from '@/components/ProductionPageContainer'

export default function PestDetection(): JSX.Element {
  const navigate = useNavigate()
  return <PageContainer title="病虫害识别" subTitle="算法模型接入状态说明">
    <Space direction="vertical" size={16} style={{ width: '100%' }}>
      <Alert type="info" showIcon message="图像识别模型未接入" description="当前不能根据照片输出病虫害结论或识别置信度。请通过生长记录登记现场事实，由农技人员确认；农事智能助手为规则式咨询，不代替现场诊断。" />
      <Card title="业务处理入口"><Space wrap><Button type="primary" onClick={() => navigate('/production/growth/records')}>登记生长记录</Button><Button onClick={() => navigate('/production/tasks')}>查看农事任务</Button><Button onClick={() => navigate('/production/ai/assistant')}>农事智能助手</Button></Space></Card>
    </Space>
  </PageContainer>
}
