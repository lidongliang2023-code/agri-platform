import { useState, useEffect } from 'react'
import { Table, Button, Modal, Form, Input, Select, message } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, UserOutlined } from '@ant-design/icons'
import { getUserList, createUser, updateUser, deleteUser } from '@/api/user'
import type { User, UserCreateDTO } from '@/types'

const { Option } = Select

const columns = [
  { title: '用户名', dataIndex: 'username', key: 'username' },
  { title: '真实姓名', dataIndex: 'realName', key: 'realName' },
  { title: '手机号', dataIndex: 'phone', key: 'phone' },
  { title: '邮箱', dataIndex: 'email', key: 'email' },
  { title: '角色', dataIndex: 'roleName', key: 'roleName' },
  { 
    title: '状态', 
    dataIndex: 'status', 
    key: 'status',
    render: (status: number) => status === 1 ? '启用' : '禁用'
  },
  { 
    title: '创建时间', 
    dataIndex: 'createdAt', 
    key: 'createdAt',
    render: (date: string) => new Date(date).toLocaleString()
  },
  {
    title: '操作',
    key: 'actions',
    render: (_, record: User) => (
      <div style={{ display: 'flex', gap: 8 }}>
        <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
        <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
      </div>
    ),
  },
]

let editModal: Modal | null = null
let createModal: Modal | null = null

const handleEdit = (record: User) => {
  const [form] = Form.useForm()
  form.setFieldsValue({
    username: record.username,
    realName: record.realName,
    phone: record.phone,
    email: record.email,
    roleId: record.roleId,
    status: record.status,
  })
  
  editModal = Modal.info({
    title: '编辑用户',
    content: (
      <Form form={form} layout="vertical">
        <Form.Item name="username" label="用户名">
          <Input disabled />
        </Form.Item>
        <Form.Item name="realName" label="真实姓名">
          <Input />
        </Form.Item>
        <Form.Item name="phone" label="手机号">
          <Input />
        </Form.Item>
        <Form.Item name="email" label="邮箱">
          <Input />
        </Form.Item>
        <Form.Item name="roleId" label="角色">
          <Select>
            <Option value={1}>超级管理员</Option>
            <Option value={2}>普通用户</Option>
          </Select>
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select>
            <Option value={1}>启用</Option>
            <Option value={0}>禁用</Option>
          </Select>
        </Form.Item>
      </Form>
    ),
    icon: <EditOutlined />,
    okText: '保存',
    onOk: async () => {
      const values = form.getFieldsValue()
      try {
        const data: UserCreateDTO = {
          username: values.username,
          password: '',
          realName: values.realName,
          phone: values.phone,
          email: values.email,
          roleId: values.roleId,
          status: values.status,
        }
        await updateUser(record.id, data)
        message.success('编辑成功')
        window.location.reload()
      } catch (err) {
        message.error('编辑失败')
      }
    },
  })
}

const handleDelete = async (id: number) => {
  try {
    await deleteUser(id)
    message.success('删除成功')
    window.location.reload()
  } catch (err) {
    message.error('删除失败')
  }
}

const handleCreate = () => {
  const [form] = Form.useForm()
  
  createModal = Modal.info({
    title: '创建用户',
    content: (
      <Form form={form} layout="vertical">
        <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
          <Input placeholder="请输入用户名" />
        </Form.Item>
        <Form.Item name="password" label="密码" rules={[{ required: true }]}>
          <Input.Password placeholder="请输入密码" />
        </Form.Item>
        <Form.Item name="realName" label="真实姓名">
          <Input placeholder="请输入真实姓名" />
        </Form.Item>
        <Form.Item name="phone" label="手机号">
          <Input placeholder="请输入手机号" />
        </Form.Item>
        <Form.Item name="email" label="邮箱">
          <Input placeholder="请输入邮箱" />
        </Form.Item>
        <Form.Item name="roleId" label="角色" rules={[{ required: true }]}>
          <Select>
            <Option value={1}>超级管理员</Option>
            <Option value={2}>普通用户</Option>
          </Select>
        </Form.Item>
        <Form.Item name="status" label="状态">
          <Select defaultValue={1}>
            <Option value={1}>启用</Option>
            <Option value={0}>禁用</Option>
          </Select>
        </Form.Item>
      </Form>
    ),
    icon: <PlusOutlined />,
    okText: '创建',
    onOk: async () => {
      const values = form.getFieldsValue()
      try {
        const data: UserCreateDTO = {
          username: values.username,
          password: values.password,
          realName: values.realName,
          phone: values.phone,
          email: values.email,
          roleId: values.roleId,
          status: values.status,
        }
        await createUser(data)
        message.success('创建成功')
        window.location.reload()
      } catch (err) {
        message.error('创建失败')
      }
    },
  })
}

export default function UserList() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const response = await getUserList()
      if (response.code === 200) {
        setUsers(response.data)
      }
    } catch (err) {
      message.error('获取用户列表失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <UserOutlined /> 用户管理
        </h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          新建用户
        </Button>
      </div>
      
      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
    </div>
  )
}