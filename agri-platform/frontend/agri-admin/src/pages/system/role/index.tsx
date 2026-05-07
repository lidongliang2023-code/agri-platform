import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';
import { RoleVO, RoleSaveDTO, RoleUpdateDTO, RolePageDTO } from '@/models/system/role';
import { roleApi } from '@/api/system/role';
import { useTable } from '@/hooks/useTable';
import { PageVO } from '@/models/common';

const RoleManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRole, setSelectedRole] = useState<RoleVO | null>(null);
  const [searchForm] = Form.useForm<RolePageDTO>();

  const { data, loading, fetch, refresh } = useTable<RoleVO, RolePageDTO>({
    fetchData: roleApi.page,
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
    setSelectedRole(null);
    setModalVisible(true);
  };

  const handleEdit = (record: RoleVO) => {
    form.setFieldsValue({
      roleName: record.roleName,
      roleKey: record.roleKey,
      roleSort: record.roleSort,
      dataScope: record.dataScope,
      status: record.status,
      remark: record.remark,
    });
    setSelectedRole(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await roleApi.delete(id);
      message.success('删除成功');
      refresh();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      
      if (!selectedRole) {
        await roleApi.create(values as RoleSaveDTO);
        message.success('创建成功');
      } else {
        await roleApi.update(selectedRole.id, values as RoleUpdateDTO);
        message.success('更新成功');
      }
      
      setModalVisible(false);
      refresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '角色编码', dataIndex: 'roleCode', key: 'roleCode' },
    { title: '角色名称', dataIndex: 'roleName', key: 'roleName' },
    { title: '角色标识', dataIndex: 'roleKey', key: 'roleKey' },
    { 
      title: '数据范围', 
      dataIndex: 'dataScopeName', 
      key: 'dataScopeName',
    },
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
      render: (_: unknown, record: RoleVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该角色？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>角色管理</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增角色</Button>
      </div>

      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="roleName">
          <Input placeholder="角色名称" />
        </Form.Item>
        <Form.Item name="roleKey">
          <Input placeholder="角色标识" />
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
        title={selectedRole ? '编辑角色' : '新增角色'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form form={form} layout="vertical">
          {!selectedRole && (
            <Form.Item name="roleCode" label="角色编码" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="roleName" label="角色名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roleKey" label="角色标识" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="roleSort" label="排序">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="dataScope" label="数据范围">
            <Select>
              <Select.Option value={1}>全部</Select.Option>
              <Select.Option value={2}>本部门</Select.Option>
              <Select.Option value={3}>本部门及以下</Select.Option>
              <Select.Option value={4}>仅本人</Select.Option>
              <Select.Option value={5}>自定义</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value={1}>正常</Select.Option>
              <Select.Option value={2}>禁用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RoleManagement;
