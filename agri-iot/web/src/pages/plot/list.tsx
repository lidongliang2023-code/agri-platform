import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Space, Modal, Form, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { plotAPI } from '@/api'

function PlotList() {
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: plotData, refetch } = useQuery<{ data: { list: { id: number; name: string; location: string; area: string; cropType: string; status: string }[]; total: number } }>({
    queryKey: ['plots'],
    queryFn: () => plotAPI.list({ name: searchText }),
    initialData: {
      data: {
        list: [
          { id: 1, name: 'A区地块', location: '阳光农场', area: '50亩', cropType: '水稻', status: 'active' },
          { id: 2, name: 'B区地块', location: '绿色生态农场', area: '30亩', cropType: '蔬菜', status: 'active' },
          { id: 3, name: 'C区地块', location: '丰收农庄', area: '80亩', cropType: '小麦', status: 'inactive' },
        ],
        total: 3,
      },
    },
  })

  const handleAdd = () => {
    form.resetFields()
    setModalVisible(true)
  }

  const handleEdit = (record: any) => {
    form.setFieldsValue(record)
    setModalVisible(true)
  }

  const handleDelete = async (id: number) => {
    try {
      await plotAPI.delete(id)
      message.success('删除成功')
      refetch()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      await plotAPI.create(values)
      message.success('创建成功')
      setModalVisible(false)
      refetch()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: '地块名称', dataIndex: 'name', key: 'name' },
    { title: '所属农场', dataIndex: 'location', key: 'location' },
    { title: '面积', dataIndex: 'area', key: 'area' },
    { title: '作物类型', dataIndex: 'cropType', key: 'cropType' },
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
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 600, color: '#1f2937' }}>地块管理</h2>
          <p style={{ fontSize: 14, color: '#6b7280' }}>管理地块信息</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
          添加地块
        </Button>
      </div>
      <Card>
        <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
          <Input
            placeholder="搜索地块名称"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 200 }}
          />
        </div>
        <Table columns={columns} dataSource={plotData?.data?.list} rowKey="id" />
      </Card>
      <Modal
        title="添加地块"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="地块名称" rules={[{ required: true, message: '请输入地块名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="location" label="所属农场">
            <Input />
          </Form.Item>
          <Form.Item name="area" label="面积">
            <Input />
          </Form.Item>
          <Form.Item name="cropType" label="作物类型">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default PlotList
