import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Select, Space, Modal, Form, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { tenantAPI } from '@/api'

function TenantList() {
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: tenantData, refetch } = useQuery<{ data: { list: { id: number; name: string; code: string; status: string; contactName: string; contactPhone: string; createTime: string }[]; total: number } }>({
    queryKey: ['tenants'],
    queryFn: () => tenantAPI.list({ name: searchText, status }),
    initialData: {
      data: {
        list: [
          { id: 1, name: '阳光农场', code: 'T001', status: 'active', contactName: '张三', contactPhone: '13800138001', createTime: '2024-01-10 10:00' },
          { id: 2, name: '绿色生态农场', code: 'T002', status: 'active', contactName: '李四', contactPhone: '13800138002', createTime: '2024-01-08 14:30' },
          { id: 3, name: '丰收农庄', code: 'T003', status: 'inactive', contactName: '王五', contactPhone: '13800138003', createTime: '2024-01-05 09:00' },
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
      await tenantAPI.delete(id)
      message.success('删除成功')
      refetch()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      await tenantAPI.create(values)
      message.success('创建成功')
      setModalVisible(false)
      refetch()
    } catch {
      message.error('操作失败')
    }
  }

  const handleStatusChange = async (id: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      await tenantAPI.updateStatus(id, newStatus)
      message.success('状态更新成功')
      refetch()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: '租户名称', dataIndex: 'name', key: 'name' },
    { title: '租户编码', dataIndex: 'code', key: 'code' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string, record: any) => (
        <Space>
          <span style={{ color: text === 'active' ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
            {text === 'active' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
            {text === 'active' ? '启用' : '停用'}
          </span>
          <Button size="small" onClick={() => handleStatusChange(record.id, text)}>
            {text === 'active' ? '停用' : '启用'}
          </Button>
        </Space>
      ),
    },
    { title: '联系人', dataIndex: 'contactName', key: 'contactName' },
    { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
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
      <div style={styles.pageHeader}>
        <div>
          <h2 style={styles.pageTitle}>租户管理</h2>
          <p style={styles.pageDesc}>管理系统租户信息</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={styles.addBtn}>
          添加租户
        </Button>
      </div>
      <Card style={styles.tableCard}>
        <div style={styles.filterSection}>
          <Input
            placeholder="搜索租户名称"
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
              { value: 'active', label: '启用' },
              { value: 'inactive', label: '停用' },
            ]}
          />
        </div>
        <Table columns={columns} dataSource={tenantData?.data?.list} rowKey="id" />
      </Card>
      <Modal
        title="添加租户"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="租户名称" rules={[{ required: true, message: '请输入租户名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="租户编码" rules={[{ required: true, message: '请输入租户编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contactName" label="联系人">
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
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
}

export default TenantList
