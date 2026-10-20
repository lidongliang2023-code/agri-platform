import { useEffect } from 'react'

/** 已迁到主数据管理的页面：旧地址整页跳转过去，避免两套实现并存。 */
export default function ExternalRedirect({ path }: { path: string }): JSX.Element {
  useEffect(() => {
    const target = `${window.location.protocol}//${window.location.hostname}:8080${path}`
    window.location.replace(target)
  }, [path])
  return <div style={{ padding: 40, color: '#6b7c72' }}>正在跳转到主数据管理…</div>
}
