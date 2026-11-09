import { useSearchParams } from 'react-router-dom'
import PageContainer from '@/components/ProductionPageContainer'
import FarmRectificationPanel from '@/components/FarmRectificationPanel'
export default function ComplianceCheck():JSX.Element {const [params]=useSearchParams();return <PageContainer title="合规检查与整改" subTitle="检查、整改与复核共用生产业务台账"><FarmRectificationPanel farmId={params.get('farmId')||undefined}/></PageContainer>}
