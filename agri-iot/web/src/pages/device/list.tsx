import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Select, Space, Modal, Form, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, EyeOutlined, WifiOutlined, DisconnectOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { deviceAPI } from '@/api'

function DeviceList() {
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()
  const navigate = useNavigate()

  const { data: deviceData, refetch } = useQuery<{ data: { list: { id: number; name: string; type: string; status: string; location: string; lastReport: string }[]; total: number } }>({
    queryKey: ['devices'],
    queryFn: () => deviceAPI.list({ name: searchText, status }),
    initialData: {
      data: {
        list: [
          { id: 1, name: '温湿度传感器-A1', type: '温湿度', status: 'online', location: '阳光农场A区', lastReport: '2024-01-15 14:30' },
          { id: 2, name: '土壤湿度传感器-B1', type: '土壤湿度', status: 'online', location: '绿色生态农场B区', lastReport: '2024-01-15 14:28' },
          { id: 3, name: '光照传感器-C1', type: '光照', status: 'offline', location: '丰收农庄C区', lastReport: '2024-01-15 10:00' },
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
      await deviceAPI.delete(id)
      message.success('删除成功')
      refetch()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      await deviceAPI.create(values)
      message.success('创建成功')
      setModalVisible(false)
      refetch()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: '设备名称', dataIndex: 'name', key: 'name' },
    { title: '设备类型', dataIndex: 'type', key: 'type' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => {
        const icon = text === 'online' ? <WifiOutlined /> : <DisconnectOutlined />
        const color = text === 'online' ? '#10b981' : '#ef4444'
        return <span style={{ color, display: 'flex', alignItems: 'center', gap: 4 }}>{icon} {text === 'online' ? '在线' : '离线'}</span>
      },
    },
    { title: '位置', dataIndex: 'location', key: 'location' },
    { title: '最后上报', dataIndex: 'lastReport', key: 'lastReport' },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: any) => (
        <Space>
          <Button icon={<EyeOutlined />} onClick={() => navigate(`/devices/${record.id}`)} />
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <Button icon={<DeleteOutlined />} danger onClick={() => handleDelete(record.id)} />
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>设备管理</h2>
          <p style={styles.pageDesc}>管理物联网设备</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={styles.addBtn}>
          添加设备
        </Button>
      </div>
      <Card style={styles.tableCard}>
        <div style={styles.filterSection}>
          <Input
            placeholder="搜索设备名称"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={styles.searchInput}
          />
          <Select
            placeholder="状态筛选"
            value={status}
            onChange={setStatus}
            style={styles.selectInput}
            options={[
              { value: '', label: '全部' },
              { value: 'online', label: '在线' },
              { value: 'offline', label: '离线' },
            ]}
          />
        </div>
        <Table columns={columns} dataSource={deviceData?.data?.list} rowKey="id" style={styles.table} />
      </Card>
      <Modal
        title="添加设备"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="设备名称" rules={[{ required: true, message: '请输入设备名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="设备类型">
            <Select options={[{ value: '温湿度', label: '温湿度' }, { value: '土壤湿度', label: '土壤湿度' }, { value: '光照', label: '光照' }]} />
          </Form.Item>
          <Form.Item name="location" label="位置">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  pageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: 600,
    color: '#1f2937',
    margin: 0,
    marginBottom: 4,
  },
  pageDesc: {
    fontSize: 14,
    color: '#6b7280',
    margin: 0,
  },
  addBtn: {
    background: '#10b981',
    borderColor: '#10b981',
    borderRadius: 8,
  },
  tableCard: {
    borderRadius: 10,
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  filterSection: {
    display: 'flex',
    gap: 16,
    marginBottom: 16,
  },
  searchInput: {
    width: 220,
    borderRadius: 8,
  },
  selectInput: {
    width: 150,
    borderRadius: 8,
  },
  table: {
    borderRadius: 8,
  },
}

export default DeviceList
