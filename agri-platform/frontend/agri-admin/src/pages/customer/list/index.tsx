import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';

interface CustomerVO {
  id: number;
  customerCode: string;
  customerName: string;
  customerType: string;
  customerTypeName: string;
  orgName: string;
  legalPerson: string;
  contactPhone: string;
  level: string;
  status: number;
  createTime: string;
}

const CustomerList: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerVO | null>(null);
  const [loading, setLoading] = useState(false);

  const [data] = useState<{
    list: CustomerVO[];
    total: number;
  }>({
    list: [
      {
        id: 1,
        customerCode: 'CU001',
        customerName: '北京农产贸易有限公司',
        customerType: '1',
        customerTypeName: '采购商',
        orgName: '华北分公司',
        legalPerson: '王总',
        contactPhone: '13800138001',
        level: 'A',
        status: 1,
        createTime: '2025-05-01 09:00:00',
      },
      {
        id: 2,
        customerCode: 'CU002',
        customerName: '上海生鲜电商平台',
        customerType: '2',
        customerTypeName: '经销商',
        orgName: '华东分公司',
        legalPerson: '李总',
        contactPhone: '13900139001',
        level: 'A',
        status: 1,
        createTime: '2025-05-02 10:30:00',
      },
    ],
    total: 2,
  });

  const handleCreate = () => {
    form.resetFields();
    setSelectedCustomer(null);
    setModalVisible(true);
  };

  const handleEdit = (record: CustomerVO) => {
    form.setFieldsValue({
      customerName: record.customerName,
      customerType: record.customerType,
      legalPerson: record.legalPerson,
      contactPhone: record.contactPhone,
      level: record.level,
      status: record.status,
    });
    setSelectedCustomer(record);
    setModalVisible(true);
  };

  const handleDelete = (_: number) => {
    message.success('删除成功');
  };

  const handleSubmit = () => {
    message.success(selectedCustomer ? '更新成功' : '创建成功');
    setModalVisible(false);
  };

  const columns = [
    { title: '客户编码', dataIndex: 'customerCode', key: 'customerCode' },
    { title: '客户名称', dataIndex: 'customerName', key: 'customerName' },
    { title: '客户类型', dataIndex: 'customerTypeName', key: 'customerTypeName' },
    { title: '所属组织', dataIndex: 'orgName', key: 'orgName' },
    { title: '法人代表', dataIndex: 'legalPerson', key: 'legalPerson' },
    { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone' },
    { title: '客户等级', dataIndex: 'level', key: 'level' },
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
      render: (_: unknown, record: CustomerVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该客户？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>客户列表</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增客户</Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<RestOutlined />} onClick={() => setLoading(true)}>刷新</Button>
      </div>

      <Table
        columns={columns}
        dataSource={data.list}
        loading={loading}
        rowKey="id"
        pagination={{
          total: data.total,
          pageSize: 10,
          current: 1,
        }}
      />

      <Modal
        title={selectedCustomer ? '编辑客户' : '新增客户'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          {!selectedCustomer && (
            <Form.Item name="customerCode" label="客户编码" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="customerName" label="客户名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="customerType" label="客户类型">
            <Select>
              <Select.Option value="1">采购商</Select.Option>
              <Select.Option value="2">经销商</Select.Option>
              <Select.Option value="3">消费者</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="legalPerson" label="法人代表">
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input />
          </Form.Item>
          <Form.Item name="level" label="客户等级">
            <Select>
              <Select.Option value="A">A</Select.Option>
              <Select.Option value="B">B</Select.Option>
              <Select.Option value="C">C</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value={1}>正常</Select.Option>
              <Select.Option value={2}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CustomerList;
