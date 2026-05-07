import React, { useState, useEffect } from 'react';
import { Card, Typography, Table, Button, Tag } from 'antd';
import { RefreshOutlined, ThermometerOutlined, DropletOutlined, SunOutlined, CloudOutlined } from '@ant-design/icons';
import { RealtimeDataVO } from '@/models/iot/device';
import { dataApi } from '@/api/iot/device';

const { Title, Paragraph } = Typography;

const DataMonitor: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [dataList, setDataList] = useState<RealtimeDataVO[]>([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await dataApi.plotRealtime(1);
      if (res.code === 200) {
        setDataList(res.data || []);
      }
    } catch (error) {
      console.error('加载数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  const columns = [
    { title: '设备编码', dataIndex: 'deviceCode', key: 'deviceCode' },
    { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName' },
    { title: '设备类型', dataIndex: 'deviceTypeName', key: 'deviceTypeName' },
    { title: '地块', dataIndex: 'plotName', key: 'plotName' },
    { 
      title: '温度(℃)', 
      dataIndex: 'temperature', 
      key: 'temperature',
      render: (temp: number) => temp ? `${temp.toFixed(1)}` : '-',
    },
    { 
      title: '湿度(%)', 
      dataIndex: 'humidity', 
      key: 'humidity',
      render: (humidity: number) => humidity ? `${humidity.toFixed(1)}` : '-',
    },
    { 
      title: '土壤湿度(%)', 
      dataIndex: 'soilMoisture', 
      key: 'soilMoisture',
      render: (val: number) => val ? `${val.toFixed(1)}` : '-',
    },
    { 
      title: 'pH值', 
      dataIndex: 'ph', 
      key: 'ph',
      render: (val: number) => val ? `${val.toFixed(2)}` : '-',
    },
    { 
      title: '光照(lux)', 
      dataIndex: 'lightIntensity', 
      key: 'lightIntensity',
      render: (val: number) => val ? `${val.toFixed(0)}` : '-',
    },
    { 
      title: 'CO2(ppm)', 
      dataIndex: 'co2', 
      key: 'co2',
      render: (val: number) => val ? `${val.toFixed(0)}` : '-',
    },
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
    { title: '上报时间', dataIndex: 'reportTime', key: 'reportTime' },
  ];

  const stats = [
    { icon: ThermometerOutlined, label: '平均温度', value: dataList.length ? (dataList.reduce((sum, d) => sum + (d.temperature || 0), 0) / dataList.length).toFixed(1) : '-', unit: '℃' },
    { icon: DropletOutlined, label: '平均湿度', value: dataList.length ? (dataList.reduce((sum, d) => sum + (d.humidity || 0), 0) / dataList.length).toFixed(1) : '-', unit: '%' },
    { icon: SunOutlined, label: '平均光照', value: dataList.length ? (dataList.reduce((sum, d) => sum + (d.lightIntensity || 0), 0) / dataList.length).toFixed(0) : '-', unit: 'lux' },
    { icon: CloudOutlined, label: '平均CO2', value: dataList.length ? (dataList.reduce((sum, d) => sum + (d.co2 || 0), 0) / dataList.length).toFixed(0) : '-', unit: 'ppm' },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>数据监测</h2>
        <Button icon={<RefreshOutlined />} onClick={loadData} loading={loading}>刷新</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 16 }}>
        {stats.map((stat, index) => (
          <Card key={index} style={{ textAlign: 'center' }}>
            <stat.icon style={{ fontSize: 24, color: '#1890ff', marginBottom: 8 }} />
            <div style={{ fontSize: 24, fontWeight: 'bold', color: '#1f1f1f' }}>
              {stat.value}
              <span style={{ fontSize: 14, fontWeight: 'normal', color: '#8c8c8c', marginLeft: 4 }}>{stat.unit}</span>
            </div>
            <div style={{ fontSize: 14, color: '#8c8c8c', marginTop: 8 }}>{stat.label}</div>
          </Card>
        ))}
      </div>

      <Card title="实时数据">
        <Table
          columns={columns}
          dataSource={dataList}
          loading={loading}
          rowKey="deviceId"
          pagination={false}
        />
      </Card>
    </div>
  );
};

export default DataMonitor;
