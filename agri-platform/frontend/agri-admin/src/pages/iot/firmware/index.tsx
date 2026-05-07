import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { FirmwareVO, FirmwarePageDTO, FirmwareSaveDTO, firmwareApi } from '@/api/iot/system';
import { useTable } from '@/hooks/useTable';

const FirmwareManagement: React.FC = () => {
  const [form] = Form.useForm<FirmwareSaveDTO>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedFirmware, setSelectedFirmware] = useState<FirmwareVO | null>(null);
  const [searchForm] = Form.useForm<FirmwarePageDTO>();

  const { data, loading, fetch, refresh } = useTable<FirmwareVO, FirmwarePageDTO>({
    fetchData: firmwareApi.page,
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

  const handleAdd = () => {
    setEditMode(false);
    setSelectedFirmware(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: FirmwareVO) => {
    setEditMode(true);
    setSelectedFirmware(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await firmwareApi.delete(id);
      message.success('删除成功');
      refresh();
    } catch {
      message.error('删除失败');
    }
  };

  const handleActivate = async (id: number) => {
    try {
      await firmwareApi.activate(id);
      message.success('激活成功');
      refresh();
    } catch {
      message.error('激活失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      if (editMode && selectedFirmware?.id) {
        await firmwareApi.update(selectedFirmware.id, values);
        message.success('更新成功');
      } else {
        await firmwareApi.save(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      refresh();
    } catch {
      message.error(editMode ? '更新失败' : '创建失败');
    }
  };

  const columns = [
    { title: '固件编码', dataIndex: 'firmwareCode', key: 'firmwareCode' },
    { title: '固件名称', dataIndex: 'firmwareName', key: 'firmwareName' },
    { title: '设备类型', dataIndex: 'deviceType', key: 'deviceType' },
    { title: '版本', dataIndex: 'version', key: 'version' },
    { title: '厂商', dataIndex: 'manufacturer', key: 'manufacturer' },
    { title: '文件大小', dataIndex: 'fileSize', key: 'fileSize' },
    { 
      title: '强制升级', 
      dataIndex: 'isForce', 
      key: 'isForce',
      render: (isForce: number) => (
        <Tag color={isForce === 1 ? 'red' : 'green'}>
          {isForce === 1 ? '是' : '否'}
        </Tag>
      ),
    },
    { 
      title: '激活状态', 
      dataIndex: 'isActive', 
      key: 'isActive',
      render: (isActive: number) => (
        <Tag color={isActive === 1 ? 'blue' : 'default'}>
          {isActive === 1 ? '已激活' : '未激活'}
        </Tag>
      ),
    },
    { title: '下载次数', dataIndex: 'downloadCount', key: 'downloadCount' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: FirmwareVO) => (
        <Space>
          {record.isActive !== 1 && (
            <Button icon={<CheckCircleOutlined />} size="small" type="primary" onClick={() => handleActivate(record.id!)}>激活</Button>
          )}
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id!)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>固件管理</h2>
        <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>添加固件</Button>
      </div>

      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="firmwareCode">
          <Input placeholder="固件编码" />
        </Form.Item>
        <Form.Item name="firmwareName">
          <Input placeholder="固件名称" />
        </Form.Item>
        <Form.Item name="isActive">
          <Select placeholder="激活状态" allowClear>
            <Select.Option value={1}>已激活</Select.Option>
            <Select.Option value={0}>未激活</Select.Option>
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
        title={editMode ? '编辑固件' : '添加固件'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="firmwareCode" label="固件编码" rules={[{ required: true, message: '请输入固件编码' }]}>
            <Input placeholder="请输入固件编码" />
          </Form.Item>
          <Form.Item name="firmwareName" label="固件名称" rules={[{ required: true, message: '请输入固件名称' }]}>
            <Input placeholder="请输入固件名称" />
          </Form.Item>
          <Form.Item name="deviceType" label="设备类型" rules={[{ required: true, message: '请输入设备类型' }]}>
            <Input placeholder="请输入设备类型" />
          </Form.Item>
          <Form.Item name="version" label="版本号" rules={[{ required: true, message: '请输入版本号' }]}>
            <Input placeholder="请输入版本号，如：v1.0.0" />
          </Form.Item>
          <Form.Item name="manufacturer" label="厂商">
            <Input placeholder="请输入厂商" />
          </Form.Item>
          <Form.Item name="filePath" label="文件路径">
            <Input placeholder="请输入固件文件路径" />
          </Form.Item>
          <Form.Item name="fileSize" label="文件大小">
            <Input placeholder="请输入文件大小，如：10MB" />
          </Form.Item>
          <Form.Item name="checkSum" label="校验码">
            <Input placeholder="请输入MD5校验码" />
          </Form.Item>
          <Form.Item name="isForce" label="是否强制升级">
            <Select defaultValue={0}>
              <Select.Option value={1}>是</Select.Option>
              <Select.Option value={0}>否</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="isActive" label="激活状态">
            <Select defaultValue={0}>
              <Select.Option value={1}>已激活</Select.Option>
              <Select.Option value={0}>未激活</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="upgradeDesc" label="升级说明">
            <Input.TextArea rows={3} placeholder="请输入升级说明" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={2} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default FirmwareManagement;
