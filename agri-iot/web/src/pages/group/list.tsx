import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Space, Modal, Form, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { groupAPI } from '@/api'

function GroupList() {
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: groupData, refetch } = useQuery<{ data: { list: { id: number; name: string; description: string; deviceCount: number }[]; total: number } }>({
    queryKey: ['groups'],
    queryFn: groupAPI.list,
    initialData: {
      data: {
        list: [
          { id: 1, name: '温湿度传感器组', description: '所有温湿度传感器', deviceCount: 5 },
          { id: 2, name: '土壤传感器组', description: '所有土壤传感器', deviceCount: 3 },
        ],
        total: 2,
      },
    },
  })

  const handleAdd = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await groupAPI.delete(id)
      message.success('删除成功')
      refetch()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      await groupAPI.create(values)
      message.success('创建成功')
      setModalVisible(false)
      refetch()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: '分组名称', dataIndex: 'name', key: 'name' },
    { title: '描述', dataIndex: 'description', key: 'description' },
    { title: '设备数量', dataIndex: 'deviceCount', key: 'deviceCount' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>设备分组</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>管理设备分组</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加分组
        </Button>
      </div>
      <Card>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Input
            placeholder="搜索分组名称"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
          />
        </div>
        <Table columns={columns} dataSource={groupData?.data?.list} rowKey="id" />
      </Card>
      <Modal
        title="添加分组"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="分组名称" rules={[{ required: true, message: '请输入分组名称' }]}>
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

export default GroupList
