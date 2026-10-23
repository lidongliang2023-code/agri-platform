import { Card, Button, Form, Input, Select, message } from 'antd'
import { ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons'

function RuleConfig() {
  const [form] = Form.useForm()

  const handleSubmit = async () => {
    await form.validateFields()
    message.success('配置成功')
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => window.history.back()}>
          返回
        </Button>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>规则配置</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>配置自动化规则详情</p>
        </div>
      </div>
      <Card>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="规则描述">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="triggerType" label="触发类型">
            <Select options={[{ value: 'threshold', label: '阈值触发' }, { value: 'time', label: '定时触发' }]} />
          </Form.Item>
          <Form.Item name="triggerCondition" label="触发条件">
            <Input />
          </Form.Item>
          <Form.Item name="actionType" label="动作类型">
            <Select options={[{ value: 'device', label: '设备控制' }, { value: 'notification', label: '通知推送' }]} />
          </Form.Item>
          <Form.Item name="actionDetail" label="动作详情">
            <Input />
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

export default RuleConfig
