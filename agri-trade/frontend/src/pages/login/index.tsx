import { useState } from 'react'
import { Form, Input, Button, Card, message } from 'antd'
import { UserOutlined, LockOutlined, MessageOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'

function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (values.username === 'admin' && values.password === '123456') {
        localStorage.setItem('token', 'mock-token')
        message.success('登录成功')
        navigate('/order')
      } else {
        message.error('用户名或密码错误')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          borderRadius: '12px'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <MessageOutlined style={{ fontSize: 48, color: '#667eea', marginBottom: 12 }} />
          <h2 style={{ margin: 0, color: '#1f1f1f' }}>交易撮合管理系统</h2>
          <p style={{ color: '#999', marginTop: 8 }}>农业产业互联网平台</p>
        </div>

        <Form
          name="login"
          onFinish={onFinish}
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
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              style={{ width: '100%', height: 44, fontSize: 16 }}
            >
              登 录
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center', color: '#999', fontSize: 13 }}>
            <p>默认账号：admin / 123456</p>
          </div>
        </Form>
      </Card>
    </div>
  )
}

export default Login