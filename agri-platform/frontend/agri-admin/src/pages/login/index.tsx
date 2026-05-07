import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';
import { authApi } from '@/api/system/auth';

const Login: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { setToken, setUserInfo } = useAuthStore();

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      setLoading(true);
      
      const response = await authApi.login(values);
      const { token, userInfo } = response.data;
      
      setToken(token);
      setUserInfo(userInfo);
      localStorage.setItem('token', token);
      
      message.success('登录成功');
      window.location.href = '/dashboard/index';
    } catch (error) {
      message.error('登录失败，请检查用户名或密码');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          borderRadius: '8px'
        }}
        title={
          <div style={{ textAlign: 'center', fontSize: '20px', fontWeight: 'bold' }}>
            农业产业互联网平台
          </div>
        }
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item 
            name="username" 
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="请输入用户名"
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
            />
          </Form.Item>
          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              block 
              loading={loading}
            >
              登录
            </Button>
          </Form.Item>
          <div style={{ textAlign: 'center', color: '#999', fontSize: '12px' }}>
            默认账号：admin / admin123
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
