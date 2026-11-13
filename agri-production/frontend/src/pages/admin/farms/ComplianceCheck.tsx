import './FarmSupervisionCompact.css'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Button, Space, Typography } from 'antd'
import PageContainer from '@/components/ProductionPageContainer'
import FarmRectificationPanel from '@/components/FarmRectificationPanel'
import { supervisionDetail } from '@/api/admin/farm-supervision'
export default function ComplianceCheck(): JSX.Element {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const farmId = params.get('farmId') || undefined
  const query = useQuery({ queryKey: ['supervision-detail', farmId], queryFn: () => supervisionDetail(farmId!), enabled: !!farmId, retry: false })
  return <PageContainer className="farm-supervision-compact" title="合规检查与整改" subTitle={query.data?.farm.farmName || '检查、整改与复核共用生产业务台账'} onBack={farmId ? () => navigate(`/admin/production/farms/${farmId}`) : undefined} extra={farmId ? <Button onClick={() => navigate(`/admin/production/farms/${farmId}`)}>返回监管详情</Button> : undefined}>
    {farmId && <Space wrap style={{marginBottom:12}}><Typography.Text type="secondary">当前农场：{query.data?.farm.farmName || farmId}</Typography.Text><Button type="link" onClick={() => navigate('/admin/production/farms/compliance')}>查看全部检查</Button></Space>}
    <FarmRectificationPanel farmId={farmId}/>
  </PageContainer>
}
