import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, EyeOutlined } from '@ant-design/icons';
import { DeviceTypeVO, DeviceTypeSaveDTO, DeviceTypeUpdateDTO, DeviceTypePageDTO } from '@/models/iot/device';
import { deviceTypeApi } from '@/api/iot/device';
import { useTable } from '@/hooks/useTable';

const DeviceTypeManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedType, setSelectedType] = useState<DeviceTypeVO | null>(null);
  const [searchForm] = Form.useForm<DeviceTypePageDTO>();

  const { data, loading, fetch, refresh } = useTable<DeviceTypeVO, DeviceTypePageDTO>({
    fetchData: deviceTypeApi.page,
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
    setSelectedType(null);
    setModalVisible(true);
  };

  const handleEdit = (record: DeviceTypeVO) => {
    form.setFieldsValue({
      typeCode: record.typeCode,
      typeName: record.typeName,
      typeCategory: record.typeCategory,
      icon: record.icon,
      protocol: record.protocol,
      manufacturer: record.manufacturer,
      model: record.model,
      specJson: record.specJson,
      status: record.status,
    });
    setModalType('edit');
    setSelectedType(record);
    setModalVisible(true);
  };

  const handleView = (record: DeviceTypeVO) => {
    form.setFieldsValue({
      typeCode: record.typeCode,
      typeName: record.typeName,
      typeCategory: record.typeCategory,
      icon: record.icon,
      protocol: record.protocol,
      manufacturer: record.manufacturer,
      model: record.model,
      specJson: record.specJson,
      status: record.status,
    });
    setModalType('view');
    setSelectedType(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deviceTypeApi.delete(id);
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
        await deviceTypeApi.create(values as DeviceTypeSaveDTO);
        message.success('创建成功');
      } else if (modalType === 'edit' && selectedType) {
        await deviceTypeApi.update(selectedType.id, values as DeviceTypeUpdateDTO);
        message.success('更新成功');
      }

      setModalVisible(false);
      refresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const columns = [
    { title: '类型编码', dataIndex: 'typeCode', key: 'typeCode' },
    { title: '类型名称', dataIndex: 'typeName', key: 'typeName' },
    { title: '分类', dataIndex: 'typeCategoryText', key: 'typeCategoryText' },
    { title: '通信协议', dataIndex: 'protocol', key: 'protocol' },
    { title: '生产厂商', dataIndex: 'manufacturer', key: 'manufacturer' },
    { title: '状态', dataIndex: 'statusText', key: 'statusText' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: DeviceTypeVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>查看</Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该设备类型？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>设备类型管理</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增类型</Button>
      </div>

      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="typeCode">
          <Input placeholder="类型编码" />
        </Form.Item>
        <Form.Item name="typeName">
          <Input placeholder="类型名称" />
        </Form.Item>
        <Form.Item name="typeCategory">
          <Select placeholder="分类">
            <Select.Option value="sensor">传感器</Select.Option>
            <Select.Option value="controller">控制器</Select.Option>
            <Select.Option value="gateway">网关</Select.Option>
          </Select>
        </Form.Item>
        <Button type="primary" onClick={handleSearch}>查询</Button>
        <Button onClick={handleReset}>重置</Button>
      </Form>

      <Table
        columns={columns}
        dataSource={data.list}
        loading={loading}
        rowKey="id"
        pagination={{
          total: data.total,
          pageSize: data.pageSize,
          current: data.pageNum,
          onChange: (page: number, pageSize: number) => fetch({ pageNum: page, pageSize }),
        }}
      />

      <Modal
        title={modalType === 'create' ? '新增设备类型' : modalType === 'edit' ? '编辑设备类型' : '查看设备类型'}
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
          <Form.Item name="typeCode" label="类型编码" rules={modalType === 'create' ? [{ required: true }] : []}>
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="typeName" label="类型名称" rules={modalType === 'create' ? [{ required: true }] : []}>
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="typeCategory" label="分类">
            <Select disabled={modalType === 'view'}>
              <Select.Option value="sensor">传感器</Select.Option>
              <Select.Option value="controller">控制器</Select.Option>
              <Select.Option value="gateway">网关</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="protocol" label="通信协议">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="manufacturer" label="生产厂商">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="specJson" label="规格参数(JSON)">
            <Input.TextArea disabled={modalType === 'view'} rows={3} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select disabled={modalType === 'view'}>
              <Select.Option value={1}>正常</Select.Option>
              <Select.Option value={2}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeviceTypeManagement;
