import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Button, Form, Input, Switch, message } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import { pushAPI } from '@/api'

function PushConfig() {
  const [form] = Form.useForm()
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [smsEnabled, setSmsEnabled] = useState(true)

  const { data: configData } = useQuery<{ data: { emailEnabled: boolean; smsEnabled: boolean } }>({
    queryKey: ['push-config'],
    queryFn: pushAPI.config,
    initialData: {
      data: { emailEnabled: true, smsEnabled: true },
    },
  })

  useEffect(() => {
    if (configData?.data) {
      setEmailEnabled(configData.data.emailEnabled)
      setSmsEnabled(configData.data.smsEnabled)
    }
  }, [configData])

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      await pushAPI.saveConfig({ ...values, emailEnabled, smsEnabled })
      message.success('配置成功')
    } catch {
      message.error('配置失败')
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>推送配置</h2>
        <p style={{ fontSize: 14, color: '#6b7280' }}>配置告警推送方式</p>
      </div>
      <Card>
        <Form form={form} layout="vertical">
          <Form.Item label="邮件推送">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Switch checked={emailEnabled} onChange={setEmailEnabled} />
              <span>{emailEnabled ? '已启用' : '已禁用'}</span>
            </div>
          </Form.Item>
          <Form.Item name="smtpHost" label="SMTP服务器" rules={emailEnabled ? [{ required: true, message: '请输入SMTP服务器' }] : []}>
            <Input disabled={!emailEnabled} />
          </Form.Item>
          <Form.Item name="smtpPort" label="SMTP端口" rules={emailEnabled ? [{ required: true, message: '请输入SMTP端口' }] : []}>
            <Input disabled={!emailEnabled} />
          </Form.Item>
          <Form.Item name="smtpUser" label="邮箱账号" rules={emailEnabled ? [{ required: true, message: '请输入邮箱账号' }] : []}>
            <Input disabled={!emailEnabled} />
          </Form.Item>
          <Form.Item name="smtpPassword" label="邮箱密码" rules={emailEnabled ? [{ required: true, message: '请输入邮箱密码' }] : []}>
            <Input.Password disabled={!emailEnabled} />
          </Form.Item>
          <Form.Item label="短信推送">
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Switch checked={smsEnabled} onChange={setSmsEnabled} />
              <span>{smsEnabled ? '已启用' : '已禁用'}</span>
            </div>
          </Form.Item>
          <Form.Item name="smsApiKey" label="短信API Key" rules={smsEnabled ? [{ required: true, message: '请输入短信API Key' }] : []}>
            <Input disabled={!smsEnabled} />
          </Form.Item>
          <Form.Item name="smsSecret" label="短信Secret" rules={smsEnabled ? [{ required: true, message: '请输入短信Secret' }] : []}>
            <Input.Password disabled={!smsEnabled} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" icon={<SaveOutlined />} onClick={handleSubmit}>
              保存配置
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default PushConfig
