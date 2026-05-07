import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons';
import { SceneVO, SceneSaveDTO } from '@/models/iot/device';
import { sceneApi } from '@/api/iot/device';
import { useTable } from '@/hooks/useTable';

const SceneManagement: React.FC = () => {
  const [form] = Form.useForm<SceneSaveDTO>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedScene, setSelectedScene] = useState<SceneVO | null>(null);

  const { data, loading, fetch, refresh } = useTable<SceneVO, { pageNum: number; pageSize: number }>({
    fetchData: sceneApi.page,
    initialParams: { pageNum: 1, pageSize: 10 },
  });

  const handleAdd = () => {
    setEditMode(false);
    setSelectedScene(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: SceneVO) => {
    setEditMode(true);
    setSelectedScene(record);
    form.setFieldsValue({
      sceneName: record.sceneName,
      sceneDesc: record.sceneDesc,
      status: record.status,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await sceneApi.delete(id);
      message.success('删除成功');
      refresh();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleActivate = async (id: number, active: boolean) => {
    try {
      await sceneApi.activate(id, { active });
      message.success(active ? '场景已激活' : '场景已停用');
      refresh();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      if (editMode && selectedScene) {
        await sceneApi.update(selectedScene.id, values);
        message.success('更新成功');
      } else {
        await sceneApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      refresh();
    } catch (error) {
      message.error(editMode ? '更新失败' : '创建失败');
    }
  };

  const columns = [
    { title: '场景名称', dataIndex: 'sceneName', key: 'sceneName' },
    { title: '场景描述', dataIndex: 'sceneDesc', key: 'sceneDesc' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: number) => (
        <Tag color={status === 1 ? 'green' : 'gray'}>
          {status === 1 ? '启用' : '禁用'}
        </Tag>
      ),
    },
    { 
      title: '激活状态', 
      dataIndex: 'active', 
      key: 'active',
      render: (active: boolean) => (
        <Tag color={active ? 'blue' : 'gray'}>
          {active ? '已激活' : '未激活'}
        </Tag>
      ),
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: SceneVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button 
            icon={record.active ? <PauseCircleOutlined /> : <PlayCircleOutlined />} 
            size="small" 
            type={record.active ? 'default' : 'primary'}
            onClick={() => handleActivate(record.id, !record.active)}
          >
            {record.active ? '停用' : '激活'}
          </Button>
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>场景模式</h2>
        <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>添加场景</Button>
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
          onChange: (page: number, pageSize: number) => fetch({ pageNum: page, pageSize }),
        }}
      />

      <Modal
        title={editMode ? '编辑场景' : '添加场景'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="sceneName" label="场景名称" rules={[{ required: true, message: '请输入场景名称' }]}>
            <Input placeholder="请输入场景名称" />
          </Form.Item>
          <Form.Item name="sceneDesc" label="场景描述">
            <Input.TextArea rows={3} placeholder="请输入场景描述" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select defaultValue={1}>
              <Select.Option value={1}>启用</Select.Option>
              <Select.Option value={0}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SceneManagement;
