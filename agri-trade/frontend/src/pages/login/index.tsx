import { useEffect, useRef, useState } from 'react'
import { Button, Card } from 'antd'
import { MessageOutlined } from '@ant-design/icons'
import { useSearchParams } from 'react-router-dom'
import { redirectToSso } from '../../utils/sso'

/**
 * 登录页 —— 只负责把用户送到平台统一认证中心。
 *
 * <p>这里原先是一个假登录：表单校验 `admin / 123456`，通过后往 localStorage 写一个
 * `mock-token`。那既不是认证（绕过表单直接写 localStorage 就能进系统），
 * 也违反架构文档 V2.0 第 5.1 节"子系统不接触用户密码"。现在整页只有一件事：
 * 跳转到认证中心走授权码 + PKCE 流程。</p>
 */
export default function Login() {
  const [params] = useSearchParams()
  const [redirecting, setRedirecting] = useState(false)
  const [error, setError] = useState('')
  const started = useRef(false)

  const handleLogin = async () => {
    setRedirecting(true)
    setError('')
    try {
      await redirectToSso(params.get('redirect') ?? undefined)
    } catch {
      setRedirecting(false)
      setError('无法连接统一认证中心，请稍后重试')
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void handleLogin()
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #1565C0 0%, #7B1FA2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Card style={{ width: 420, textAlign: 'center', borderRadius: 12 }}>
        <MessageOutlined style={{ fontSize: 48, color: '#1565C0' }} />
        <h2 style={{ margin: '16px 0 4px' }}>交易撮合平台</h2>
        <p style={{ color: '#999', margin: 0 }}>农业产业互联网平台</p>
        <p style={{ color: '#999', fontSize: 13, marginTop: 24 }}>
          {error || '正在前往平台统一认证中心，本系统不保存你的密码'}
        </p>
        <Button
          type="primary"
          size="large"
          block
          loading={redirecting}
          onClick={handleLogin}
          style={{ height: 44, fontSize: 16, marginTop: 8 }}
        >
          {redirecting ? '正在前往认证中心…' : '重新前往平台认证中心'}
        </Button>
      </Card>
    </div>
  )
}
