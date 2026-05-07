import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { PlotVO, PlotPageDTO, PlotSaveDTO, plotApi } from '@/api/iot/system';
import { useTable } from '@/hooks/useTable';

const PlotManagement: React.FC = () => {
  const [form] = Form.useForm<PlotSaveDTO>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedPlot, setSelectedPlot] = useState<PlotVO | null>(null);
  const [searchForm] = Form.useForm<PlotPageDTO>();

  const { data, loading, fetch, refresh } = useTable<PlotVO, PlotPageDTO>({
    fetchData: plotApi.page,
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
    setSelectedPlot(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: PlotVO) => {
    setEditMode(true);
    setSelectedPlot(record);
    form.setFieldsValue(record);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await plotApi.delete(id);
      message.success('删除成功');
      refresh();
    } catch {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      if (editMode && selectedPlot?.id) {
        await plotApi.update(selectedPlot.id, values);
        message.success('更新成功');
      } else {
        await plotApi.save(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      refresh();
    } catch {
      message.error(editMode ? '更新失败' : '创建失败');
    }
  };

  const columns = [
    { title: '地块编码', dataIndex: 'plotCode', key: 'plotCode' },
    { title: '地块名称', dataIndex: 'plotName', key: 'plotName' },
    { title: '面积(亩)', dataIndex: 'area', key: 'area' },
    { title: '作物类型', dataIndex: 'cropType', key: 'cropType' },
    { title: '土壤类型', dataIndex: 'soilType', key: 'soilType' },
    { title: '灌溉方式', dataIndex: 'irrigationType', key: 'irrigationType' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? '正常' : '停用'}
        </Tag>
      ),
    },
    { title: '设备数量', dataIndex: 'deviceCount', key: 'deviceCount' },
    { title: '在线设备', dataIndex: 'onlineDeviceCount', key: 'onlineDeviceCount' },
    { title: '位置', dataIndex: 'location', key: 'location' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: PlotVO) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id!)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>地块管理</h2>
        <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>添加地块</Button>
      </div>

      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="plotCode">
          <Input placeholder="地块编码" />
        </Form.Item>
        <Form.Item name="plotName">
          <Input placeholder="地块名称" />
        </Form.Item>
        <Form.Item name="cropType">
          <Input placeholder="作物类型" />
        </Form.Item>
        <Form.Item name="status">
          <Select placeholder="状态" allowClear>
            <Select.Option value={1}>正常</Select.Option>
            <Select.Option value={0}>停用</Select.Option>
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
        title={editMode ? '编辑地块' : '添加地块'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="plotCode" label="地块编码" rules={[{ required: true, message: '请输入地块编码' }]}>
            <Input placeholder="请输入地块编码" />
          </Form.Item>
          <Form.Item name="plotName" label="地块名称" rules={[{ required: true, message: '请输入地块名称' }]}>
            <Input placeholder="请输入地块名称" />
          </Form.Item>
          <Form.Item name="area" label="面积(亩)">
            <Input type="number" placeholder="请输入面积" />
          </Form.Item>
          <Form.Item name="cropType" label="作物类型">
            <Input placeholder="请输入作物类型" />
          </Form.Item>
          <Form.Item name="soilType" label="土壤类型">
            <Select allowClear>
              <Select.Option value="沙土">沙土</Select.Option>
              <Select.Option value="壤土">壤土</Select.Option>
              <Select.Option value="黏土">黏土</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="irrigationType" label="灌溉方式">
            <Select allowClear>
              <Select.Option value="滴灌">滴灌</Select.Option>
              <Select.Option value="喷灌">喷灌</Select.Option>
              <Select.Option value="漫灌">漫灌</Select.Option>
              <Select.Option value="微喷">微喷</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select defaultValue={1}>
              <Select.Option value={1}>正常</Select.Option>
              <Select.Option value={0}>停用</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="location" label="位置">
            <Input placeholder="请输入位置" />
          </Form.Item>
          <Form.Item name="longitude" label="经度">
            <Input type="number" placeholder="请输入经度" />
          </Form.Item>
          <Form.Item name="latitude" label="纬度">
            <Input type="number" placeholder="请输入纬度" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default PlotManagement;
