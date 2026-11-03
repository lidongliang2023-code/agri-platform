import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Result } from 'antd'
import { exchangeCode, takeReturnTo } from '@/utils/sso'

/** 独立交易移动端的 SSO 回跳页。 */
export default function SsoCallback(): JSX.Element {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (!code) {
      setError(params.get('error_description') ?? '认证中心没有返回授权码')
      return
    }
    exchangeCode(code, params.get('state'))
      .then(() => navigate(takeReturnTo() ?? '/', { replace: true }))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : String(reason)))
  }, [navigate])

  if (error) {
    return (
      <Result
        status="warning"
        title="登录未完成"
        subTitle={error}
        extra={<a href="/">重新登录</a>}
      />
    )
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" tip="正在完成登录…" />
    </div>
  )
}
