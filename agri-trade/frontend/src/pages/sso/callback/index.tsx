import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Spin, Result } from 'antd'
import { exchangeCode, takeReturnTo, LOGIN_PATH } from '../../../utils/sso'

/**
 * SSO 回跳页：只做一件事 —— 把 URL 上的 code 换成平台令牌写入登录态，再回到来之前的页面。
 *
 * <p>失败时明确报出原因（state 校验、code_verifier 丢失、换票失败），
 * 而不是"转一圈回到登录页" —— 那样排查只能靠猜。</p>
 */
export default function SsoCallback() {
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
      .then(() => {
        navigate(takeReturnTo() ?? '/', { replace: true })
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err))
      })
  }, [navigate])

  if (error) {
    return (
      <Result
        status="warning"
        title="登录未完成"
        subTitle={error}
        extra={<a href={LOGIN_PATH}>重新登录</a>}
      />
    )
  }
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spin size="large" tip="正在完成登录…" />
    </div>
  )
}
