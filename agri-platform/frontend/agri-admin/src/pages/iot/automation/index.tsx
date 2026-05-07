import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Switch } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { AutomationRuleVO, AutomationRuleSaveDTO } from '@/models/iot/device';
import { automationApi } from '@/api/iot/device';
import { useTable } from '@/hooks/useTable';

const AutomationManagement: React.FC = () => {
  const [form] = Form.useForm<AutomationRuleSaveDTO>();
  const [modalVisible, setModalVisible] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedRule, setSelectedRule] = useState<AutomationRuleVO | null>(null);

  const { data, loading, fetch, refresh } = useTable<AutomationRuleVO, { pageNum: number; pageSize: number }>({
    fetchData: automationApi.page,
    initialParams: { pageNum: 1, pageSize: 10 },
  });

  const handleAdd = () => {
    setEditMode(false);
    setSelectedRule(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (record: AutomationRuleVO) => {
    setEditMode(true);
    setSelectedRule(record);
    form.setFieldsValue({
      ruleName: record.ruleName,
      ruleDesc: record.ruleDesc,
      triggerType: record.triggerType,
      triggerConfig: record.triggerConfig,
      actionType: record.actionType,
      actionConfig: record.actionConfig,
      status: record.status,
    });
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await automationApi.delete(id);
      message.success('删除成功');
      refresh();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleStatusChange = async (id: number, checked: boolean) => {
    try {
      const record = data.list.find(item => item.id === id);
      if (record) {
        await automationApi.update(id, {
          ruleName: record.ruleName,
          ruleDesc: record.ruleDesc,
          triggerType: record.triggerType,
          triggerConfig: record.triggerConfig,
          actionType: record.actionType,
          actionConfig: record.actionConfig,
          status: checked ? 1 : 0,
        });
        message.success(checked ? '已启用' : '已禁用');
        refresh();
      }
    } catch (error) {
      message.error('操作失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      if (editMode && selectedRule) {
        await automationApi.update(selectedRule.id, values);
        message.success('更新成功');
      } else {
        await automationApi.create(values);
        message.success('创建成功');
      }
      setModalVisible(false);
      refresh();
    } catch (error) {
      message.error(editMode ? '更新失败' : '创建失败');
    }
  };

  const getTriggerTypeName = (type: number) => {
    switch (type) {
      case 1: return '定时触发';
      case 2: return '条件触发';
      case 3: return '设备触发';
      case 4: return '手动触发';
      default: return '未知';
    }
  };

  const getActionTypeName = (type: number) => {
    switch (type) {
      case 1: return '设备控制';
      case 2: return '场景联动';
      case 3: return '发送通知';
      case 4: return '执行脚本';
      default: return '未知';
    }
  };

  const columns = [
    { title: '规则名称', dataIndex: 'ruleName', key: 'ruleName' },
    { title: '规则描述', dataIndex: 'ruleDesc', key: 'ruleDesc' },
    { 
      title: '触发类型', 
      dataIndex: 'triggerType', 
      key: 'triggerType',
      render: (type: number) => getTriggerTypeName(type),
    },
    { 
      title: '动作类型', 
      dataIndex: 'actionType', 
      key: 'actionType',
      render: (type: number) => getActionTypeName(type),
    },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: number, record: AutomationRuleVO) => (
        <Switch 
          checked={status === 1} 
          onChange={(checked) => handleStatusChange(record.id!, checked)}
        />
      ),
    },
    { title: '触发次数', dataIndex: 'triggerCount', key: 'triggerCount' },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    { title: '最后执行时间', dataIndex: 'lastExecuteTime', key: 'lastExecuteTime' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: AutomationRuleVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(record.id!)}>删除</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>自动化规则</h2>
        <Button icon={<PlusOutlined />} type="primary" onClick={handleAdd}>添加规则</Button>
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
        title={editMode ? '编辑规则' : '添加规则'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="ruleName" label="规则名称" rules={[{ required: true, message: '请输入规则名称' }]}>
            <Input placeholder="请输入规则名称" />
          </Form.Item>
          <Form.Item name="ruleDesc" label="规则描述">
            <Input.TextArea rows={2} placeholder="请输入规则描述" />
          </Form.Item>
          <Form.Item name="triggerType" label="触发类型" rules={[{ required: true }]}>
            <Select placeholder="请选择触发类型">
              <Select.Option value={1}>定时触发</Select.Option>
              <Select.Option value={2}>条件触发</Select.Option>
              <Select.Option value={3}>设备触发</Select.Option>
              <Select.Option value={4}>手动触发</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="triggerConfig" label="触发配置">
            <Input.TextArea rows={3} placeholder="请输入触发配置（JSON格式）" />
          </Form.Item>
          <Form.Item name="actionType" label="动作类型" rules={[{ required: true }]}>
            <Select placeholder="请选择动作类型">
              <Select.Option value={1}>设备控制</Select.Option>
              <Select.Option value={2}>场景联动</Select.Option>
              <Select.Option value={3}>发送通知</Select.Option>
              <Select.Option value={4}>执行脚本</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="actionConfig" label="动作配置">
            <Input.TextArea rows={3} placeholder="请输入动作配置（JSON格式）" />
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

export default AutomationManagement;
