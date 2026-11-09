import { Navigate, useLocation } from 'react-router-dom'

/** 历史地块采收入口兼容：保留筛选参数，统一进入采收记录。 */
export default function HarvestPlan(): JSX.Element {
  const { search, hash } = useLocation()
  return <Navigate to={`/production/harvests${search}${hash}`} replace />
}
