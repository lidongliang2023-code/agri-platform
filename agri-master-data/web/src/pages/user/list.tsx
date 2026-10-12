import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Select, Space, Modal, Form, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { userAPI } from '@/api'

function UserList() {
  const [searchText, setSearchText] = useState('')
  const [status, setStatus] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: userData, refetch } = useQuery<{ data: { list: { id: number; username: string; realName: string; role: string; status: string; phone: string; createTime: string }[]; total: number } }>({
    queryKey: ['users'],
    queryFn: () => userAPI.list({ username: searchText, status }),
    initialData: {
      data: {
        list: [
          { id: 1, username: 'zhangsan', realName: '张三', role: 'admin', status: 'active', phone: '13800138001', createTime: '2024-01-10 10:00' },
          { id: 2, username: 'lisi', realName: '李四', role: 'user', status: 'active', phone: '13800138002', createTime: '2024-01-08 14:30' },
          { id: 3, username: 'wangwu', realName: '王五', role: 'user', status: 'inactive', phone: '13800138003', createTime: '2024-01-05 09:00' },
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
      await userAPI.delete(id)
      message.success('删除成功')
      refetch()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      await userAPI.create(values)
      message.success('创建成功')
      setModalVisible(false)
      refetch()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '真实姓名', dataIndex: 'realName', key: 'realName' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (text: string) => (
        <span style={{ color: text === 'admin' ? '#10b981' : '#3b82f6' }}>
          {text === 'admin' ? '管理员' : '普通用户'}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text: string) => (
        <span style={{ color: text === 'active' ? '#10b981' : '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
          {text === 'active' ? <CheckCircleOutlined /> : <ClockCircleOutlined />}
          {text === 'active' ? '启用' : '停用'}
        </span>
      ),
    },
    { title: '手机号', dataIndex: 'phone', key: 'phone' },
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
          <h2 style={styles.pageTitle}>用户管理</h2>
          <p style={styles.pageDesc}>管理系统用户信息</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={styles.addBtn}>
          添加用户
        </Button>
      </div>
      <Card style={styles.tableCard}>
        <div style={styles.filterSection}>
          <Input
            placeholder="搜索用户名"
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
        <Table columns={columns} dataSource={userData?.data?.list} rowKey="id" />
      </Card>
      <Modal
        title="添加用户"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="realName" label="真实姓名">
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select options={[{ value: 'admin', label: '管理员' }, { value: 'user', label: '普通用户' }]} />
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

export default UserList
