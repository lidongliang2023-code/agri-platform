import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, message, Tag, Card } from 'antd';
import { PoweroffOutlined, ReloadOutlined, SettingOutlined } from '@ant-design/icons';
import { DeviceVO } from '@/models/iot/device';
import { deviceApi, controlApi } from '@/api/iot/device';

const ControlManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [devices, setDevices] = useState<DeviceVO[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<DeviceVO | null>(null);
  const [controlValue, setControlValue] = useState('');

  const loadDevices = async () => {
    setLoading(true);
    try {
      const res = await deviceApi.page({ pageNum: 1, pageSize: 100 });
      if (res.code === 200) {
        setDevices(res.data.list || []);
      }
    } catch (error) {
      console.error('加载设备失败:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    loadDevices();
  }, []);

  const handleControl = async (device: DeviceVO, command: string, value?: string) => {
    try {
      await controlApi.send(device.id, { command, value });
      message.success('控制指令发送成功');
      loadDevices();
    } catch (error) {
      message.error('控制指令发送失败');
    }
  };

  const handleOpenModal = (device: DeviceVO) => {
    setSelectedDevice(device);
    setControlValue('');
    setModalVisible(true);
  };

  const handleSubmit = () => {
    if (!selectedDevice || !controlValue) {
      message.warning('请输入控制值');
      return;
    }
    handleControl(selectedDevice, 'SET_VALUE', controlValue);
    setModalVisible(false);
  };

  const columns = [
    { title: '设备编码', dataIndex: 'deviceCode', key: 'deviceCode' },
    { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName' },
    { title: '设备类型', dataIndex: 'deviceTypeName', key: 'deviceTypeName' },
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
    { title: '当前状态', dataIndex: 'currentValue', key: 'currentValue' },
    { title: '位置', dataIndex: 'installationLocation', key: 'installationLocation' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: DeviceVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button 
            icon={<ReloadOutlined />} 
            size="small" 
            type="primary"
            disabled={record.onlineStatus !== 1}
            onClick={() => handleControl(record, 'ON')}
          >
            开启
          </Button>
          <Button 
            icon={<PoweroffOutlined />} 
            size="small"
            disabled={record.onlineStatus !== 1}
            onClick={() => handleControl(record, 'OFF')}
          >
            关闭
          </Button>
          <Button 
            icon={<SettingOutlined />} 
            size="small"
            disabled={record.onlineStatus !== 1}
            onClick={() => handleOpenModal(record)}
          >
            设置
          </Button>
          <Button 
            icon={<ReloadOutlined />} 
            size="small"
            disabled={record.onlineStatus !== 1}
            onClick={() => handleControl(record, 'RESET')}
          >
            重置
          </Button>
        </div>
      ),
    },
  ];

  const onlineDevices = devices.filter(d => d.onlineStatus === 1);
  const offlineDevices = devices.filter(d => d.onlineStatus !== 1);

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>远程控制</h2>
        <Button onClick={loadDevices} loading={loading}>刷新设备</Button>
      </div>

      <Card title={`在线设备 (${onlineDevices.length})`} style={{ marginBottom: 16 }}>
        <Table
          columns={columns}
          dataSource={onlineDevices}
          loading={loading}
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Card title={`离线设备 (${offlineDevices.length})`}>
        <Table
          columns={columns}
          dataSource={offlineDevices}
          loading={loading}
          rowKey="id"
          pagination={false}
        />
      </Card>

      <Modal
        title={`设置 ${selectedDevice?.deviceName}`}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
      >
        <Form layout="vertical">
          <Form.Item label="控制值">
            <Input 
              value={controlValue} 
              onChange={(e) => setControlValue(e.target.value)}
              placeholder="请输入控制值，如：50%"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ControlManagement;
