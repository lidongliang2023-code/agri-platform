import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { login } from '@/api/user'
import type { LoginDTO } from '@/types'

const { Title } = Typography

export default function Login() {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (values: LoginDTO) => {
    setLoading(true)
    setError('')
    try {
      const response = await login(values)
      if (response.code === 200) {
        localStorage.setItem('token', response.data.token)
        navigate('/')
      } else {
        setError(response.message)
      }
    } catch (err) {
      setError('登录失败，请检查用户名或密码')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
      <Card style={{ width: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>农业产业互联网平台</Title>
          <p style={{ color: '#666' }}>请登录您的账号</p>
        </div>
        
        {error && (
          <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
        )}
        
        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="请输入用户名"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="请输入密码"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large" block>
              登录
            </Button>
          </Form.Item>
        </Form>
        
        <p style={{ textAlign: 'center', color: '#999', marginTop: 16 }}>
          默认账号：admin / admin
        </p>
      </Card>
    </div>
  )
}