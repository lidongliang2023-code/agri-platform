import { Navigate, useLocation } from 'react-router-dom'

/** 生产告警列表归并到唯一处置入口，保留旧书签的筛选条件。 */
export default function MonitorCenter() {
  const { search, hash } = useLocation()
  return <Navigate to={`/admin/production/alerts${search}${hash}`} replace />
}
