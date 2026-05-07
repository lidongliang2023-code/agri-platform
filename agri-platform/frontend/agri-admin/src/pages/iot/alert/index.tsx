import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Tag } from 'antd';
import { AlertTriangleOutlined, CheckOutlined, ClockCircleOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { AlertRecordVO, AlertRecordPageDTO, AlertHandleDTO } from '@/models/iot/device';
import { alertRecordApi } from '@/api/iot/device';
import { useTable } from '@/hooks/useTable';

const AlertManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<AlertRecordVO | null>(null);
  const [searchForm] = Form.useForm<AlertRecordPageDTO>();

  const { data, loading, fetch, refresh } = useTable<AlertRecordVO, AlertRecordPageDTO>({
    fetchData: alertRecordApi.page,
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

  const handleView = (record: AlertRecordVO) => {
    form.setFieldsValue({
      alertContent: record.alertContent,
      handleStatus: record.handleStatus,
      handleResult: record.handleResult,
    });
    setSelectedAlert(record);
    setModalVisible(true);
  };

  const handleHandle = async (record: AlertRecordVO) => {
    try {
      await alertRecordApi.handle(record.id, { handleStatus: 3, handleResult: '已处理' });
      message.success('处理成功');
      refresh();
    } catch (error) {
      message.error('处理失败');
    }
  };

  const handleSubmit = async () => {
    try {
      if (!selectedAlert) return;
      const values = form.getFieldsValue();
      await alertRecordApi.handle(selectedAlert.id, {
        handleStatus: values.handleStatus,
        handleResult: values.handleResult,
      });
      message.success('处理成功');
      setModalVisible(false);
      refresh();
    } catch (error) {
      message.error('处理失败');
    }
  };

  const getAlertLevelColor = (level: number) => {
    switch (level) {
      case 1: return 'red';
      case 2: return 'orange';
      case 3: return 'yellow';
      case 4: return 'blue';
      default: return 'gray';
    }
  };

  const getAlertLevelIcon = (level: number) => {
    switch (level) {
      case 1: return <AlertTriangleOutlined style={{ color: '#f5222d' }} />;
      case 2: return <AlertTriangleOutlined style={{ color: '#fa8c16' }} />;
      case 3: return <ClockCircleOutlined style={{ color: '#faad14' }} />;
      case 4: return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
      default: return <ClockCircleOutlined />;
    }
  };

  const columns = [
    { title: '预警编号', dataIndex: 'alertNo', key: 'alertNo' },
    { 
      title: '级别', 
      dataIndex: 'alertLevel', 
      key: 'alertLevel',
      render: (level: number) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {getAlertLevelIcon(level)}
          <Tag color={getAlertLevelColor(level)}>
            {level === 1 ? '紧急' : level === 2 ? '重要' : level === 3 ? '一般' : '提醒'}
          </Tag>
        </span>
      ),
    },
    { title: '规则名称', dataIndex: 'ruleName', key: 'ruleName' },
    { title: '设备名称', dataIndex: 'deviceName', key: 'deviceName' },
    { title: '地块', dataIndex: 'plotName', key: 'plotName' },
    { title: '触发属性', dataIndex: 'propertyName', key: 'propertyName' },
    { 
      title: '触发值/阈值', 
      key: 'trigger',
      render: (_, record: AlertRecordVO) => `${record.triggerValue} ${record.operator} ${record.thresholdValue}`,
    },
    { 
      title: '状态', 
      dataIndex: 'handleStatus', 
      key: 'handleStatus',
      render: (status: number) => (
        <Tag color={status === 1 ? 'red' : status === 2 ? 'orange' : status === 3 ? 'green' : 'gray'}>
          {status === 1 ? '待处理' : status === 2 ? '处理中' : status === 3 ? '已处理' : '已忽略'}
        </Tag>
      ),
    },
    { title: '预警时间', dataIndex: 'alertTime', key: 'alertTime' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: AlertRecordVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EyeOutlined />} size="small" onClick={() => handleView(record)}>查看</Button>
          {record.handleStatus === 1 && (
            <Button icon={<CheckOutlined />} size="small" type="primary" onClick={() => handleHandle(record)}>处理</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>预警管理</h2>
      </div>

      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="alertNo">
          <Input placeholder="预警编号" />
        </Form.Item>
        <Form.Item name="ruleName">
          <Input placeholder="规则名称" />
        </Form.Item>
        <Form.Item name="alertLevel">
          <Select placeholder="预警级别">
            <Select.Option value={1}>紧急</Select.Option>
            <Select.Option value={2}>重要</Select.Option>
            <Select.Option value={3}>一般</Select.Option>
            <Select.Option value={4}>提醒</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="handleStatus">
          <Select placeholder="处理状态">
            <Select.Option value={1}>待处理</Select.Option>
            <Select.Option value={2}>处理中</Select.Option>
            <Select.Option value={3}>已处理</Select.Option>
            <Select.Option value={4}>已忽略</Select.Option>
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
        title="预警详情"
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        {selectedAlert && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <span><strong>预警编号：</strong>{selectedAlert.alertNo}</span>
              <span><strong>规则名称：</strong>{selectedAlert.ruleName}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <span><strong>设备：</strong>{selectedAlert.deviceName}</span>
              <span><strong>地块：</strong>{selectedAlert.plotName}</span>
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
              <span><strong>触发属性：</strong>{selectedAlert.propertyName}</span>
              <span><strong>触发值/阈值：</strong>{selectedAlert.triggerValue} {selectedAlert.operator} {selectedAlert.thresholdValue}</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span><strong>预警内容：</strong>{selectedAlert.alertContent}</span>
            </div>
            <div style={{ marginBottom: 12 }}>
              <span><strong>预警时间：</strong>{selectedAlert.alertTime}</span>
            </div>
          </div>
        )}
        <Form form={form} layout="vertical">
          <Form.Item name="handleStatus" label="处理状态">
            <Select>
              <Select.Option value={2}>处理中</Select.Option>
              <Select.Option value={3}>已处理</Select.Option>
              <Select.Option value={4}>已忽略</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="handleResult" label="处理结果">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AlertManagement;
