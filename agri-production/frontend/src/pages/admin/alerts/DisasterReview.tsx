import { Navigate, useLocation } from 'react-router-dom'

/** 历史复盘复用已处置告警，不再维护第二套列表。 */
export default function DisasterReview() {
  const { search, hash } = useLocation()
  const params = new URLSearchParams(search)
  params.set('status', '3')
  return <Navigate to={`/admin/production/alerts?${params.toString()}${hash}`} replace />
}
