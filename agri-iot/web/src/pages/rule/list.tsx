import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Space, Modal, Form, Input, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons'

function RuleList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: ruleData } = useQuery<{ data: { list: { id: number; name: string; triggerType: string; actionType: string; enabled: boolean }[]; total: number } }>({
    queryKey: ['rules'],
    queryFn: () => Promise.resolve({ data: { list: [], total: 0 } }),
    initialData: {
      data: {
        list: [
          { id: 1, name: '温度过高自动浇水', triggerType: '温度 > 35℃', actionType: '开启水泵', enabled: true },
          { id: 2, name: '湿度过低自动灌溉', triggerType: '湿度 < 40%', actionType: '开启灌溉系统', enabled: true },
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
    { title: '触发条件', dataIndex: 'triggerType', key: 'triggerType' },
    { title: '执行动作', dataIndex: 'actionType', key: 'actionType' },
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
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>自动化规则</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>管理自动化规则配置</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加规则
        </Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={ruleData?.data?.list} rowKey="id" />
      </Card>
      <Modal
        title="添加自动化规则"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="triggerType" label="触发条件">
            <Input />
          </Form.Item>
          <Form.Item name="actionType" label="执行动作">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default RuleList
