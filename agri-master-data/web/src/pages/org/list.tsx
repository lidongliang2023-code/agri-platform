import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, Table, Button, Input, Select, Space, Modal, Form, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, CheckCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { orgAPI } from '@/api'

function OrgList() {
  const [searchText, setSearchText] = useState('')
  const [modalVisible, setModalVisible] = useState(false)
  const [form] = Form.useForm()

  const { data: orgData, refetch } = useQuery<{ data: { list: { id: number; name: string; code: string; type: string; status: string; parentName: string; createTime: string }[]; total: number } }>({
    queryKey: ['orgs'],
    queryFn: () => orgAPI.list({ name: searchText }),
    initialData: {
      data: {
        list: [
          { id: 1, name: '阳光农场总部', code: 'O001', type: 'company', status: 'active', parentName: '-', createTime: '2024-01-10 10:00' },
          { id: 2, name: '阳光农场A区', code: 'O002', type: 'department', status: 'active', parentName: '阳光农场总部', createTime: '2024-01-08 14:30' },
          { id: 3, name: '阳光农场B区', code: 'O003', type: 'department', status: 'active', parentName: '阳光农场总部', createTime: '2024-01-05 09:00' },
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
      await orgAPI.delete(id)
      message.success('删除成功')
      refetch()
    } catch {
      message.error('删除失败')
    }
  }

  const handleSubmit = async () => {
    const values = await form.validateFields()
    try {
      await orgAPI.create(values)
      message.success('创建成功')
      setModalVisible(false)
      refetch()
    } catch {
      message.error('操作失败')
    }
  }

  const columns = [
    { title: '组织名称', dataIndex: 'name', key: 'name' },
    { title: '组织编码', dataIndex: 'code', key: 'code' },
    {
      title: '组织类型',
      dataIndex: 'type',
      key: 'type',
      render: (text: string) => (
        <span style={{ color: text === 'company' ? '#10b981' : '#3b82f6' }}>
          {text === 'company' ? '公司' : text === 'department' ? '部门' : '小组'}
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
    { title: '上级组织', dataIndex: 'parentName', key: 'parentName' },
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
          <h2 style={styles.pageTitle}>组织管理</h2>
          <p style={styles.pageDesc}>管理系统组织信息</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={styles.addBtn}>
          添加组织
        </Button>
      </div>
      <Card style={styles.tableCard}>
        <div style={styles.filterSection}>
          <Input
            placeholder="搜索组织名称"
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={styles.searchInput}
          />
        </div>
        <Table columns={columns} dataSource={orgData?.data?.list} rowKey="id" />
      </Card>
      <Modal
        title="添加组织"
        visible={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSubmit}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="组织名称" rules={[{ required: true, message: '请输入组织名称' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="code" label="组织编码" rules={[{ required: true, message: '请输入组织编码' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="组织类型">
            <Select options={[{ value: 'company', label: '公司' }, { value: 'department', label: '部门' }, { value: 'group', label: '小组' }]} />
          </Form.Item>
          <Form.Item name="parentId" label="上级组织">
            <Select placeholder="请选择上级组织" />
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

export default OrgList
