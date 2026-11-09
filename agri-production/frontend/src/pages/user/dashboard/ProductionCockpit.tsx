import { Navigate, useLocation } from 'react-router-dom'

/** 兼容原驾驶舱入口，统一进入生产数据看板。 */
export default function ProductionCockpit(): JSX.Element {
  const { search, hash } = useLocation()
  return <Navigate to={`/production/dashboard${search}${hash}`} replace />
}
