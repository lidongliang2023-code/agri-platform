import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Space, Modal, Form, Input, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined } from '@ant-design/icons'

function SceneList() {
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: sceneData } = useQuery<{ data: { list: { id: number; name: string; description: string; status: string }[]; total: number } }>({
    queryKey: ['scenes'],
    queryFn: () => Promise.resolve({ data: { list: [], total: 0 } }),
    initialData: {
      data: {
        list: [
          { id: 1, name: '早晨灌溉场景', description: '每天早上8点自动开启灌溉系统', status: 'active' },
          { id: 2, name: '傍晚通风场景', description: '每天傍晚18点自动开启通风设备', status: 'active' },
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
    { title: '场景名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => (
        <span style={{ color: text === 'active' ? '#10b981' : '#9ca3af' }}>
          {text === 'active' ? '启用' : '停用'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: () => (
        <Space>
          <Button icon={<PlayCircleOutlined />} />
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
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>场景管理</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>管理场景配置</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加场景
        </Button>
      </div>
      <Card>
        <Table columns={columns} dataSource={sceneData?.data?.list} rowKey="id" />
      </Card>
      <Modal
        title="添加场景"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="场景名称" rules={[{ required: true, message: '请输入场景名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default SceneList
