import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag, Space, Progress } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons';
import { OtaTaskVO, OtaTaskPageDTO, OtaTaskSaveDTO, otaApi, firmwareApi } from '@/api/iot/system';
import { FirmwareVO } from '@/api/iot/system';
import { useTable } from '@/hooks/useTable';

const OtaManagement: React.FC = () => {
  const [form] = Form.useForm<OtaTaskSaveDTO>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedTask, setSelectedTask] = useState<OtaTaskVO | null>(null);
  const [searchForm] = Form.useForm<OtaTaskPageDTO>();
  const [firmwares, setFirmwares] = useState<FirmwareVO[]>([]);

  const { data, loading, fetch, refresh } = useTable<OtaTaskVO, OtaTaskPageDTO>({
    fetchData: otaApi.page,
    initialParams: { pageNum: 1, pageSize: 10 },
  });

  const loadFirmwares = async () => {
    try {
      const res = await firmwareApi.page({ pageNum: 1, pageSize: 100 });
      if (res.code === 200 && res.data) {
        setFirmwares(res.data.list || []);
      }
    } catch {
      console.error('加载固件列表失败');
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
    setSelectedTask(null);
    form.resetFields();
    loadFirmwares();
    setModalVisible(true);
  };

  const handleEdit = (record: OtaTaskVO) => {
    setEditMode(true);
    setSelectedTask(record);
    form.setFieldsValue(record);
    loadFirmwares();
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await otaApi.delete(id);
      message.success('删除成功');
      refresh();
    } catch {
      message.error('删除失败');
    }
  };

  const handleExecute = async (id: number) => {
    try {
      await otaApi.execute(id);
      message.success('任务已开始执行');
      refresh();
    } catch {
      message.error('执行失败');
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await otaApi.cancel(id);
      message.success('任务已取消');
      refresh();
    } catch {
      message.error('取消失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      if (editMode && selectedTask?.id) {
        await otaApi.update(selectedTask.id, values);
        message.success('更新成功');
      } else {
        await otaApi.save(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      refresh();
    } catch {
      message.error(editMode ? '更新失败' : '创建失败');
    }
  };

  const getTaskStatusTag = (status: number) => {
    switch (status) {
      case 0: return <Tag color="default">待执行</Tag>;
      case 1: return <Tag color="processing">执行中</Tag>;
      case 2: return <Tag color="success">已完成</Tag>;
      case 3: return <Tag color="error">已取消</Tag>;
      default: return <Tag>未知</Tag>;
    }
  };

  const columns = [
    { title: '任务编号', dataIndex: 'taskCode', key: 'taskCode' },
    { title: '任务名称', dataIndex: 'taskName', key: 'taskName' },
    { title: '固件版本', dataIndex: 'firmwareVersion', key: 'firmwareVersion' },
    { 
      title: '任务类型', 
      dataIndex: 'taskType', 
      key: 'taskType',
      render: (type: number) => (
        <Tag>{type === 1 ? '立即升级' : type === 2 ? '定时升级' : '批量升级'}</Tag>
      ),
    },
    { 
      title: '状态', 
      dataIndex: 'taskStatus', 
      key: 'taskStatus',
      render: (status: number) => getTaskStatusTag(status),
    },
    { 
      title: '升级进度', 
      key: 'progress',
      render: (_: unknown, record: OtaTaskVO) => {
        if (record.taskStatus === 1 && record.totalDevices && record.totalDevices > 0) {
          const progress = Math.round(((record.successDevices || 0) / record.totalDevices) * 100);
          return <Progress percent={progress} size="small" />;
        }
        return '-';
      },
    },
    { title: '总设备数', dataIndex: 'totalDevices', key: 'totalDevices' },
    { title: '成功数', dataIndex: 'successDevices', key: 'successDevices' },
    { title: '失败数', dataIndex: 'failDevices', key: 'failDevices' },
    { title: '创建人', dataIndex: 'creator', key: 'creator' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: OtaTaskVO) => (
        <Space>
          {record.taskStatus === 0 && (
            <>
              <Button icon={<PlayCircleOutlined />} size="small" type="primary" onClick={() => handleExecute(record.id!)}>执行</Button>
              <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
            </>
          )}
          {record.taskStatus === 1 && (
            <Button icon={<StopOutlined />} size="small" danger onClick={() => handleCancel(record.id!)}>取消</Button>
          )}
          {record.taskStatus !== 1 && (
            <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id!)}>删除</Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>OTA升级</h2>
        <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>创建升级任务</Button>
      </div>

      <Form form={searchForm} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="taskCode">
          <Input placeholder="任务编号" />
        </Form.Item>
        <Form.Item name="taskName">
          <Input placeholder="任务名称" />
        </Form.Item>
        <Form.Item name="taskStatus">
          <Select placeholder="任务状态" allowClear>
            <Select.Option value={0}>待执行</Select.Option>
            <Select.Option value={1}>执行中</Select.Option>
            <Select.Option value={2}>已完成</Select.Option>
            <Select.Option value={3}>已取消</Select.Option>
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
        title={editMode ? '编辑升级任务' : '创建升级任务'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="taskName" label="任务名称" rules={[{ required: true, message: '请输入任务名称' }]}>
            <Input placeholder="请输入任务名称" />
          </Form.Item>
          <Form.Item name="firmwareId" label="选择固件" rules={[{ required: true, message: '请选择固件' }]}>
            <Select placeholder="请选择固件">
              {firmwares.map(fw => (
                <Select.Option key={fw.id} value={fw.id!}>
                  {fw.firmwareName} - {fw.version}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请选择任务类型' }]}>
            <Select placeholder="请选择任务类型">
              <Select.Option value={1}>立即升级</Select.Option>
              <Select.Option value={2}>定时升级</Select.Option>
              <Select.Option value={3}>批量升级</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="targetDevices" label="目标设备">
            <Input.TextArea rows={2} placeholder="请输入目标设备ID，多个用逗号分隔" />
          </Form.Item>
          <Form.Item name="scheduleTime" label="计划执行时间">
            <Input placeholder="请输入计划执行时间" />
          </Form.Item>
          <Form.Item name="remark" label="备注">
            <Input.TextArea rows={3} placeholder="请输入备注" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default OtaManagement;
