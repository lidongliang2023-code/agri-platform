import { useState } from 'react'
import { Button, Form, Input, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { authAPI } from '@/api'
import useAuthStore from '@/store/auth'
import { LockOutlined, UserOutlined } from '@ant-design/icons'

function Login() {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { setToken, setUser } = useAuthStore()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const res = await authAPI.login(values)
      const data = res as unknown as { code: number; data: { token: string; user: any }; message: string }
      if (data.code === 200) {
        setToken(data.data.token)
        setUser(data.data.user)
        message.success('登录成功')
        navigate('/dashboard')
      } else {
        message.error(data.message || '登录失败')
      }
    } catch {
      message.error('登录失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.loginBox}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>🌐</div>
          <h1>物联网管理系统</h1>
        </div>
        <Form
          name="login"
          onFinish={onFinish}
          initialValues={{ username: 'admin', password: 'admin123' }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              size="large"
              style={styles.input}
            />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              size="large"
              style={styles.input}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block size="large" style={styles.loginBtn}>
              登录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #0d2818 0%, #04471c 50%, #10b981 100%)',
  },
  loginBox: {
    width: 420,
    padding: 48,
    background: '#fff',
    borderRadius: 12,
    boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
  },
  logo: {
    textAlign: 'center',
    marginBottom: 32,
  },
  logoIcon: {
    fontSize: 52,
    marginBottom: 12,
  },
  input: {
    borderRadius: 8,
    height: 44,
  },
  loginBtn: {
    borderRadius: 8,
    height: 44,
    background: '#10b981',
    borderColor: '#10b981',
    fontSize: 16,
    fontWeight: 500,
  },
}

export default Login
