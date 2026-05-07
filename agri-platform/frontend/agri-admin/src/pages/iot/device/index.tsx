import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined, EyeOutlined } from '@ant-design/icons';
import { DeviceVO, DeviceSaveDTO, DeviceUpdateDTO, DevicePageDTO } from '@/models/iot/device';
import { deviceApi } from '@/api/iot/device';
import { useTable } from '@/hooks/useTable';
import { PageVO } from '@/models/common';

const DeviceManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'create' | 'edit' | 'view'>('create');
  const [selectedDevice, setSelectedDevice] = useState<DeviceVO | null>(null);
  const [searchForm] = Form.useForm<DevicePageDTO>();

  const { data, loading, fetch, refresh } = useTable<DeviceVO, DevicePageDTO>({
    fetchData: deviceApi.page,
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
    setSelectedDevice(null);
    setModalVisible(true);
  };

  const handleEdit = (record: DeviceVO) => {
    form.setFieldsValue({
      deviceCode: record.deviceCode,
      deviceName: record.deviceName,
      deviceType: record.deviceType,
      deviceModel: record.deviceModel,
      manufacturer: record.manufacturer,
      installationLocation: record.installationLocation,
      latitude: record.latitude,
      longitude: record.longitude,
      orgId: record.orgId,
      status: record.status,
    });
    setModalType('edit');
    setSelectedDevice(record);
    setModalVisible(true);
  };

  const handleView = (record: DeviceVO) => {
    form.setFieldsValue({
      deviceCode: record.deviceCode,
      deviceName: record.deviceName,
      deviceType: record.deviceType,
      deviceModel: record.deviceModel,
      manufacturer: record.manufacturer,
      installationLocation: record.installationLocation,
      latitude: record.latitude,
      longitude: record.longitude,
      orgId: record.orgId,
      status: record.status,
    });
    setModalType('view');
    setSelectedDevice(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deviceApi.delete(id);
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
        await deviceApi.create(values as DeviceSaveDTO);
        message.success('创建成功');
      } else if (modalType === 'edit' && selectedDevice) {
        await deviceApi.update(selectedDevice.id, values as DeviceUpdateDTO);
        message.success('更新成功');
      }
      
      setModalVisible(false);
      refresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case 1:
        return '在线';
      case 2:
        return '离线';
      case 3:
        return '故障';
      default:
        return '未知';
    }
  };

  const columns = [
    { title: '设备编码', dataIndex: 'deviceCode', key: 'deviceCode' },
    { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName' },
    { title: '设备类型', dataIndex: 'deviceType', key: 'deviceType' },
    { title: '设备型号', dataIndex: 'deviceModel', key: 'deviceModel' },
    { title: '所属组织', dataIndex: 'orgName', key: 'orgName' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: number) => getStatusText(status),
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: DeviceVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>查看</Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该设备？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>设备管理</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增设备</Button>
      </div>

      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="deviceCode">
          <Input placeholder="设备编码" />
        </Form.Item>
        <Form.Item name="deviceName">
          <Input placeholder="设备名称" />
        </Form.Item>
        <Form.Item name="deviceType">
          <Input placeholder="设备类型" />
        </Form.Item>
        <Form.Item name="status">
          <Select placeholder="状态">
            <Select.Option value={1}>在线</Select.Option>
            <Select.Option value={2}>离线</Select.Option>
            <Select.Option value={3}>故障</Select.Option>
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
        title={modalType === 'create' ? '新增设备' : modalType === 'edit' ? '编辑设备' : '查看设备'}
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
          <Form.Item name="deviceCode" label="设备编码" rules={modalType === 'create' ? [{ required: true }] : []}>
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="deviceName" label="设备名称" rules={modalType === 'create' ? [{ required: true }] : []}>
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="deviceType" label="设备类型">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="deviceModel" label="设备型号">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="manufacturer" label="制造商">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="installationLocation" label="安装位置">
            <Input disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="latitude" label="纬度">
            <Input type="number" disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="longitude" label="经度">
            <Input type="number" disabled={modalType === 'view'} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select disabled={modalType === 'view'}>
              <Select.Option value={1}>在线</Select.Option>
              <Select.Option value={2}>离线</Select.Option>
              <Select.Option value={3}>故障</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DeviceManagement;
