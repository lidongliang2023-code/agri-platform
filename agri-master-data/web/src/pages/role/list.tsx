import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Space, Modal, Form, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { roleAPI } from '@/api'

function RoleList() {
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: roleData, refetch } = useQuery<{ data: { list: { id: number; name: string; code: string; description: string; status: string; createTime: string }[]; total: number } }>({
    queryKey: ['roles'],
    queryFn: () => roleAPI.list({ name: searchText }),
    initialData: {
      data: {
        list: [
          { id: 1, name: '系统管理员', code: 'ADMIN', description: '系统最高权限', status: 'active', createTime: '2024-01-10 10:00' },
          { id: 2, name: '主体管理员', code: 'TENANT_ADMIN', description: '主体管理权限', status: 'active', createTime: '2024-01-08 14:30' },
          { id: 3, name: '普通用户', code: 'USER', description: '基础操作权限', status: 'active', createTime: '2024-01-05 09:00' },
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
      await roleAPI.delete(id)
      message.success('删除成功')
      refetch()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      await roleAPI.create(values)
      message.success('创建成功')
      setModalVisible(false)
      refetch()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '角色编码', dataIndex: 'code', key: 'code' },
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
          <h2 style={styles.pageTitle}>角色管理</h2>
          <p style={styles.pageDesc}>管理系统角色信息</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={styles.addBtn}>
          添加角色
        </Button>
      </div>
      <Card style={styles.tableCard}>
        <div style={styles.filterSection}>
          <Input
            placeholder="搜索角色名称"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <Table columns={columns} dataSource={roleData?.data?.list} rowKey="id" />
      </Card>
      <Modal
        title="添加角色"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="角色名称" rules={[{ required: true, message: '请输入角色名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="角色编码" rules={[{ required: true, message: '请输入角色编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea />
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
}

export default RoleList
