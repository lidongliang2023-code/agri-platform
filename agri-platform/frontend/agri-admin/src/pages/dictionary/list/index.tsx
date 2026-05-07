import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined, SettingOutlined } from '@ant-design/icons';

interface DictVO {
  id: number;
  dictCode: string;
  dictName: string;
  dictType: string;
  status: number;
  createTime: string;
}

interface DictItemVO {
  id: number;
  dictId: number;
  itemText: string;
  itemValue: string;
  itemSort: number;
  status: number;
}

const DictManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [itemForm] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [itemModalVisible, setItemModalVisible] = useState(false);
  const [selectedDict, setSelectedDict] = useState<DictVO | null>(null);
  const [selectedItem, setSelectedItem] = useState<DictItemVO | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeDictId, setActiveDictId] = useState<number | null>(null);

  const [dictData] = useState<{
    list: DictVO[];
    total: number;
  }>({
    list: [
      {
        id: 1,
        dictCode: 'user_status',
        dictName: '用户状态',
        dictType: '1',
        status: 1,
        createTime: '2025-05-01 09:00:00',
      },
      {
        id: 2,
        dictCode: 'product_status',
        dictName: '商品状态',
        dictType: '1',
        status: 1,
        createTime: '2025-05-02 10:00:00',
      },
    ],
    total: 2,
  });

  const [itemData] = useState<{ [key: number]: { list: DictItemVO[] } }>({
    1: {
      list: [
        { id: 101, dictId: 1, itemText: '正常', itemValue: '1', itemSort: 1, status: 1 },
        { id: 102, dictId: 1, itemText: '禁用', itemValue: '2', itemSort: 2, status: 1 },
      ],
    },
    2: {
      list: [
        { id: 201, dictId: 2, itemText: '上架', itemValue: '1', itemSort: 1, status: 1 },
        { id: 202, dictId: 2, itemText: '下架', itemValue: '2', itemSort: 2, status: 1 },
      ],
    },
  });

  const handleCreate = () => {
    form.resetFields();
    setSelectedDict(null);
    setModalVisible(true);
  };

  const handleEdit = (record: DictVO) => {
    form.setFieldsValue({
      dictName: record.dictName,
      dictType: record.dictType,
      status: record.status,
    });
    setSelectedDict(record);
    setModalVisible(true);
  };

  const handleDelete = (_: number) => {
    message.success('删除成功');
  };

  const handleSubmit = () => {
    message.success(selectedDict ? '更新成功' : '创建成功');
    setModalVisible(false);
  };

  const handleItemCreate = () => {
    itemForm.resetFields();
    setSelectedItem(null);
    setItemModalVisible(true);
  };

  const handleItemEdit = (record: DictItemVO) => {
    itemForm.setFieldsValue({
      itemText: record.itemText,
      itemValue: record.itemValue,
      itemSort: record.itemSort,
      status: record.status,
    });
    setSelectedItem(record);
    setItemModalVisible(true);
  };

  const handleItemDelete = (_: number) => {
    message.success('删除成功');
  };

  const handleItemSubmit = () => {
    message.success(selectedItem ? '更新成功' : '创建成功');
    setItemModalVisible(false);
  };

  const dictColumns = [
    { title: '字典编码', dataIndex: 'dictCode', key: 'dictCode' },
    { title: '字典名称', dataIndex: 'dictName', key: 'dictName' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: number) => (status === 1 ? '正常' : '禁用'),
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: DictVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<SettingOutlined />} size="small" onClick={() => setActiveDictId(record.id)}>配置项</Button>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该字典？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  const itemColumns = [
    { title: '字典值', dataIndex: 'itemValue', key: 'itemValue' },
    { title: '字典标签', dataIndex: 'itemText', key: 'itemText' },
    { title: '排序', dataIndex: 'itemSort', key: 'itemSort' },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: number) => (status === 1 ? '正常' : '禁用'),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: DictItemVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleItemEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该项？" onConfirm={() => handleItemDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>数据字典</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增字典</Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<RestOutlined />} onClick={() => setLoading(true)}>刷新</Button>
      </div>

      <Row gutter={16}>
        <Col span={12}>
          <h3>字典列表</h3>
          <Table
            columns={dictColumns}
            dataSource={dictData.list}
            loading={loading}
            rowKey="id"
            pagination={{
              total: dictData.total,
              pageSize: 10,
              current: 1,
            }}
          />
        </Col>
        <Col span={12}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3>字典项配置</h3>
            {activeDictId && <Button icon={<PlusOutlined />} onClick={handleItemCreate}>新增字典项</Button>}
          </div>
          {activeDictId ? (
            <Table
              columns={itemColumns}
              dataSource={itemData[activeDictId]?.list || []}
              rowKey="id"
              pagination={false}
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
              请选择一个字典查看配置项
            </div>
          )}
        </Col>
      </Row>

      <Modal
        title={selectedDict ? '编辑字典' : '新增字典'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          {!selectedDict && (
            <Form.Item name="dictCode" label="字典编码" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="dictName" label="字典名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="dictType" label="字典类型">
            <Select>
              <Select.Option value="1">系统字典</Select.Option>
              <Select.Option value="2">业务字典</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value={1}>正常</Select.Option>
              <Select.Option value={2}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={selectedItem ? '编辑字典项' : '新增字典项'}
        visible={itemModalVisible}
        onOk={handleItemSubmit}
        onCancel={() => setItemModalVisible(false)}
        width={500}
      >
        <Form form={itemForm} layout="vertical">
          <Form.Item name="itemValue" label="字典值" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="itemText" label="字典标签" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="itemSort" label="排序">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value={1}>正常</Select.Option>
              <Select.Option value={2}>禁用</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DictManagement;
