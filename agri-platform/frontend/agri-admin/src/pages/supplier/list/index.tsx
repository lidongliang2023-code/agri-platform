import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';

interface SupplierVO {
  id: number;
  supplierCode: string;
  supplierName: string;
  supplierType: string;
  supplierTypeName: string;
  orgName: string;
  legalPerson: string;
  contactPhone: string;
  address: string;
  status: number;
  createTime: string;
}

const SupplierList: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierVO | null>(null);
  const [loading, setLoading] = useState(false);

  const [data] = useState<{
    list: SupplierVO[];
    total: number;
  }>({
    list: [
      {
        id: 1,
        supplierCode: 'SU001',
        supplierName: '黑龙江五常大米合作社',
        supplierType: '1',
        supplierTypeName: '生产商',
        orgName: '华北分公司',
        legalPerson: '张经理',
        contactPhone: '13800138002',
        address: '黑龙江省哈尔滨市',
        status: 1,
        createTime: '2025-05-01 08:00:00',
      },
      {
        id: 2,
        supplierCode: 'SU002',
        supplierName: '山东寿光蔬菜基地',
        supplierType: '2',
        supplierTypeName: '批发商',
        orgName: '华东分公司',
        legalPerson: '刘主任',
        contactPhone: '13900139002',
        address: '山东省寿光市',
        status: 1,
        createTime: '2025-05-03 11:00:00',
      },
    ],
    total: 2,
  });

  const handleCreate = () => {
    form.resetFields();
    setSelectedSupplier(null);
    setModalVisible(true);
  };

  const handleEdit = (record: SupplierVO) => {
    form.setFieldsValue({
      supplierName: record.supplierName,
      supplierType: record.supplierType,
      legalPerson: record.legalPerson,
      contactPhone: record.contactPhone,
      address: record.address,
      status: record.status,
    });
    setSelectedSupplier(record);
    setModalVisible(true);
  };

  const handleDelete = (_: number) => {
    message.success('删除成功');
  };

  const handleSubmit = () => {
    message.success(selectedSupplier ? '更新成功' : '创建成功');
    setModalVisible(false);
  };

  const columns = [
    { title: '供应商编码', dataIndex: 'supplierCode', key: 'supplierCode' },
    { title: '供应商名称', dataIndex: 'supplierName', key: 'supplierName' },
    { title: '供应商类型', dataIndex: 'supplierTypeName', key: 'supplierTypeName' },
    { title: '所属组织', dataIndex: 'orgName', key: 'orgName' },
    { title: '负责人', dataIndex: 'legalPerson', key: 'legalPerson' },
    { title: '联系电话', dataIndex: 'contactPhone', key: 'contactPhone' },
    { title: '地址', dataIndex: 'address', key: 'address' },
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
      render: (_: unknown, record: SupplierVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该供应商？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>供应商列表</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增供应商</Button>
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
        title={selectedSupplier ? '编辑供应商' : '新增供应商'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          {!selectedSupplier && (
            <Form.Item name="supplierCode" label="供应商编码" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="supplierName" label="供应商名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="supplierType" label="供应商类型">
            <Select>
              <Select.Option value="1">生产商</Select.Option>
              <Select.Option value="2">批发商</Select.Option>
              <Select.Option value="3">代理商</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="legalPerson" label="负责人">
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input />
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

export default SupplierList;
