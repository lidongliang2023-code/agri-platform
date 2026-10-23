import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Select, Space, Modal, Form, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

function AlertRule() {
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: ruleData } = useQuery<{ data: { list: { id: number; name: string; level: string; condition: string; enabled: boolean }[]; total: number } }>({
    queryKey: ['alert-rules'],
    queryFn: () => Promise.resolve({ data: { list: [], total: 0 } }),
    initialData: {
      data: {
        list: [
          { id: 1, name: '温度过高告警', level: 'high', condition: '温度 > 35℃', enabled: true },
          { id: 2, name: '湿度过低告警', level: 'medium', condition: '湿度 < 40%', enabled: true },
        ],
        total: 2,
      },
    },
  })

  const handleAdd = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleSubmit = async () => {
    await form.validateFields()
    message.success('创建成功')
    setModalVisible(false)
  }

  const columns = [
    { title: '规则名称', dataIndex: 'name', key: 'name' },
    {
      title: '告警级别',
      dataIndex: 'level',
      key: 'level',
      render: (text: string) => (
        <span style={{ color: text === 'high' ? '#ef4444' : text === 'medium' ? '#f59e0b' : '#10b981' }}>
          {text === 'high' ? '高' : text === 'medium' ? '中' : '低'}
        </span>
      ),
    },
    { title: '触发条件', dataIndex: 'condition', key: 'condition' },
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (text: boolean) => (
        <span style={{ color: text ? '#10b981' : '#9ca3af' }}>
          {text ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button icon={<EditOutlined />} />
          <Button icon={<DeleteOutlined />} danger />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>告警规则</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>管理告警规则配置</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加规则
        </Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={ruleData?.data?.list} rowKey="id" />
      </Card>
      <Modal
        title="添加告警规则"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="level" label="告警级别">
            <Select options={[{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]} />
          </Form.Item>
          <Form.Item name="condition" label="触发条件">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default AlertRule
