import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined, EyeOutlined } from '@ant-design/icons';
import { UserVO, UserSaveDTO, UserUpdateDTO, UserPageDTO } from '@/models/system/user';
import { userApi } from '@/api/system/user';
import { useTable } from '@/hooks/useTable';
import { PageVO } from '@/models/common';

const UserManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedUser, setSelectedUser] = useState<UserVO | null>(null);
  const [searchForm] = Form.useForm<UserPageDTO>();

  const { data, loading, fetch, refresh } = useTable<UserVO, UserPageDTO>({
    fetchData: userApi.page,
    initialParams: { pageNum: 1, pageSize: 10 },
  });

  const handleSearch = () => {
    const values = searchForm.getFieldsValue();
    fetch({ ...values, pageNum: 1, pageSize: 10 });
  };

  const handleReset = () => {
    searchForm.resetFields();
    fetch({ pageNum: 1, pageSize: 10 });
  };

  const handleCreate = () => {
    form.resetFields();
    setModalType('create');
    setSelectedUser(null);
    setModalVisible(true);
  };

  const handleEdit = (record: UserVO) => {
    form.setFieldsValue({
      realName: record.realName,
      phone: record.phone,
      email: record.email,
      avatar: record.avatar,
      orgId: record.orgId,
      status: record.status,
      remark: record.remark,
    });
    setModalType('edit');
    setSelectedUser(record);
    setModalVisible(true);
  };

  const handleView = (record: UserVO) => {
    form.setFieldsValue({
      username: record.username,
      realName: record.realName,
      phone: record.phone,
      email: record.email,
      avatar: record.avatar,
      orgId: record.orgId,
      status: record.status,
      remark: record.remark,
    });
    setModalType('view');
    setSelectedUser(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await userApi.delete(id);
      message.success('删除成功');
      refresh();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      
      if (modalType === 'create') {
        await userApi.create(values as UserSaveDTO);
        message.success('创建成功');
      } else if (modalType === 'edit' && selectedUser) {
        await userApi.update(selectedUser.id, values as UserUpdateDTO);
        message.success('更新成功');
      }
      
      setModalVisible(false);
      refresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '真实姓名', dataIndex: 'realName', key: 'realName' },
    { title: '手机号', dataIndex: 'phone', key: 'phone' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '所属组织', dataIndex: 'orgName', key: 'orgName' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: number) => (status === 1 ? '正常' : '禁用'),
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: UserVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>查看</Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该用户？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>用户管理</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增用户</Button>
      </div>

      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="username">
          <Input placeholder="用户名" />
        </Form.Item>
        <Form.Item name="realName">
          <Input placeholder="真实姓名" />
        </Form.Item>
        <Form.Item name="phone">
          <Input placeholder="手机号" />
        </Form.Item>
        <Form.Item name="status">
          <Select placeholder="状态">
            <Select.Option value={1}>正常</Select.Option>
            <Select.Option value={2}>禁用</Select.Option>
          </Select>
        </Form.Item>
        <Button type="primary" onClick={handleSearch}>查询</Button>
        <Button onClick={handleReset}>重置</Button>
      </Form>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<RestOutlined />} onClick={refresh}>刷新</Button>
      </div>

      <Table
        columns={columns}
        dataSource={data.list}
        loading={loading}
        rowKey="id"
        pagination={{
          total: data.total,
          pageSize: data.pageSize,
          current: data.pageNum,
          onChange: (page: number, pageSize: number) => fetch({ pageNum: page, pageSize } as PageVO),
        }}
      />

      <Modal
        title={modalType === 'create' ? '新增用户' : modalType === 'edit' ? '编辑用户' : '查看用户'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        footer={
          modalType === 'view' ? null : [
            <Button key="back" onClick={() => setModalVisible(false)}>取消</Button>,
            <Button key="submit" type="primary" onClick={handleSubmit}>确定</Button>,
          ]
        }
      >
        <Form form={form} layout="vertical">
          {(modalType === 'create' || modalType === 'view') && (
            <Form.Item name="username" label="用户名" rules={modalType === 'create' ? [{ required: true }] : []}>
              <Input disabled={modalType === 'view'} />
            </Form.Item>
          )}
          {modalType === 'create' && (
            <Form.Item name="password" label="密码" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
          )}
          <Form.Item name="realName" label="真实姓名">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select disabled={modalType === 'view'}>
              <Select.Option value={1}>正常</Select.Option>
              <Select.Option value={2}>禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea disabled={modalType === 'view'} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
