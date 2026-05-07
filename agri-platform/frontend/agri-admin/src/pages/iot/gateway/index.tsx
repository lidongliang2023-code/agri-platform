import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, HeartOutlined } from '@ant-design/icons';
import { GatewayVO, GatewayPageDTO, GatewaySaveDTO, gatewayApi, plotApi } from '@/api/iot/system';
import { PlotVO } from '@/api/iot/system';
import { useTable } from '@/hooks/useTable';

const GatewayManagement: React.FC = () => {
  const [form] = Form.useForm<GatewaySaveDTO>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState<GatewayVO | null>(null);
  const [searchForm] = Form.useForm<GatewayPageDTO>();
  const [plots, setPlots] = useState<PlotVO[]>([]);

  const { data, loading, fetch, refresh } = useTable<GatewayVO, GatewayPageDTO>({
    fetchData: gatewayApi.page,
    initialParams: { pageNum: 1, pageSize: 10 },
  });

  const loadPlots = async () => {
    try {
      const res = await plotApi.list();
      if (res.code === 200 && res.data) {
        setPlots(res.data as PlotVO[]);
      }
    } catch {
      console.error('加载地块失败');
    }
  };

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
    setSelectedGateway(null);
    form.resetFields();
    loadPlots();
    setModalVisible(true);
  };

  const handleEdit = (record: GatewayVO) => {
    setEditMode(true);
    setSelectedGateway(record);
    form.setFieldsValue(record);
    loadPlots();
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await gatewayApi.delete(id);
      message.success('删除成功');
      refresh();
    } catch {
      message.error('删除失败');
    }
  };

  const handleHeartbeat = async (id: number) => {
    try {
      await gatewayApi.heartbeat(id);
      message.success('心跳已发送');
      refresh();
    } catch {
      message.error('发送失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      if (editMode && selectedGateway?.id) {
        await gatewayApi.update(selectedGateway.id, values);
        message.success('更新成功');
      } else {
        await gatewayApi.save(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      refresh();
    } catch {
      message.error(editMode ? '更新失败' : '创建失败');
    }
  };

  const columns = [
    { title: '网关编码', dataIndex: 'gatewayCode', key: 'gatewayCode' },
    { title: '网关名称', dataIndex: 'gatewayName', key: 'gatewayName' },
    { title: '厂商', dataIndex: 'manufacturer', key: 'manufacturer' },
    { title: '型号', dataIndex: 'model', key: 'model' },
    { title: '固件版本', dataIndex: 'firmwareVersion', key: 'firmwareVersion' },
    { title: 'IP地址', dataIndex: 'ipAddress', key: 'ipAddress' },
    { title: '端口', dataIndex: 'port', key: 'port' },
    { title: '协议', dataIndex: 'protocol', key: 'protocol' },
    { title: '地块', dataIndex: 'plotName', key: 'plotName' },
    { 
      title: '状态', 
      dataIndex: 'onlineStatus', 
      key: 'onlineStatus',
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'red'}>
          {status === 1 ? '在线' : '离线'}
        </Tag>
      ),
    },
    { title: '位置', dataIndex: 'location', key: 'location' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: GatewayVO) => (
        <Space>
          <Button icon={<HeartOutlined />} size="small" onClick={() => handleHeartbeat(record.id!)}>心跳</Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id!)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>网关管理</h2>
        <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>添加网关</Button>
      </div>

      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="gatewayCode">
          <Input placeholder="网关编码" />
        </Form.Item>
        <Form.Item name="gatewayName">
          <Input placeholder="网关名称" />
        </Form.Item>
        <Form.Item name="onlineStatus">
          <Select placeholder="状态" allowClear>
            <Select.Option value={1}>在线</Select.Option>
            <Select.Option value={0}>离线</Select.Option>
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
        title={editMode ? '编辑网关' : '添加网关'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="gatewayCode" label="网关编码" rules={[{ required: true, message: '请输入网关编码' }]}>
            <Input placeholder="请输入网关编码" />
          </Form.Item>
          <Form.Item name="gatewayName" label="网关名称" rules={[{ required: true, message: '请输入网关名称' }]}>
            <Input placeholder="请输入网关名称" />
          </Form.Item>
          <Form.Item name="manufacturer" label="厂商">
            <Input placeholder="请输入厂商" />
          </Form.Item>
          <Form.Item name="model" label="型号">
            <Input placeholder="请输入型号" />
          </Form.Item>
          <Form.Item name="firmwareVersion" label="固件版本">
            <Input placeholder="请输入固件版本" />
          </Form.Item>
          <Form.Item name="ipAddress" label="IP地址">
            <Input placeholder="请输入IP地址" />
          </Form.Item>
          <Form.Item name="port" label="端口">
            <Input type="number" placeholder="请输入端口" />
          </Form.Item>
          <Form.Item name="protocol" label="协议">
            <Select allowClear>
              <Select.Option value="MQTT">MQTT</Select.Option>
              <Select.Option value="CoAP">CoAP</Select.Option>
              <Select.Option value="HTTP">HTTP</Select.Option>
              <Select.Option value="TCP">TCP</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="plotId" label="地块">
            <Select placeholder="请选择地块" allowClear>
              {plots.map(plot => (
                <Select.Option key={plot.id} value={plot.id!}>{plot.plotName}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="heartInterval" label="心跳间隔(秒)">
            <Input type="number" placeholder="请输入心跳间隔" />
          </Form.Item>
          <Form.Item name="location" label="位置">
            <Input placeholder="请输入位置" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GatewayManagement;
