import React, { useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, InputNumber } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';

interface ProductVO {
  id: number;
  productCode: string;
  productName: string;
  categoryId: number;
  categoryName: string;
  brand: string;
  unit: string;
  origin: string;
  price: number;
  status: number;
  createTime: string;
}

const ProductList: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductVO | null>(null);
  const [loading, setLoading] = useState(false);

  const [data] = useState<{
    list: ProductVO[];
    total: number;
    pageNum: number;
    pageSize: number;
  }>({
    list: [
      {
        id: 1,
        productCode: 'PD001',
        productName: '有机大米 5kg',
        categoryId: 1,
        categoryName: '粮油类',
        brand: '稻香村',
        unit: '袋',
        origin: '黑龙江五常',
        price: 68.0,
        status: 1,
        createTime: '2025-05-01 10:00:00',
      },
      {
        id: 2,
        productCode: 'PD002',
        productName: '新鲜蔬菜礼盒',
        categoryId: 2,
        categoryName: '蔬菜类',
        brand: '田园鲜',
        unit: '盒',
        origin: '山东寿光',
        price: 98.0,
        status: 1,
        createTime: '2025-05-02 14:30:00',
      },
    ],
    total: 2,
    pageNum: 1,
    pageSize: 10,
  });

  const handleCreate = () => {
    form.resetFields();
    setSelectedProduct(null);
    setModalVisible(true);
  };

  const handleEdit = (record: ProductVO) => {
    form.setFieldsValue({
      productName: record.productName,
      categoryId: record.categoryId,
      brand: record.brand,
      unit: record.unit,
      origin: record.origin,
      price: record.price,
      status: record.status,
    });
    setSelectedProduct(record);
    setModalVisible(true);
  };

  const handleDelete = (_: number) => {
    message.success('删除成功');
  };

  const handleSubmit = () => {
    message.success(selectedProduct ? '更新成功' : '创建成功');
    setModalVisible(false);
  };

  const columns = [
    { title: '商品编码', dataIndex: 'productCode', key: 'productCode' },
    { title: '商品名称', dataIndex: 'productName', key: 'productName' },
    { title: '分类', dataIndex: 'categoryName', key: 'categoryName' },
    { title: '品牌', dataIndex: 'brand', key: 'brand' },
    { title: '单位', dataIndex: 'unit', key: 'unit' },
    { title: '产地', dataIndex: 'origin', key: 'origin' },
    { title: '参考价', dataIndex: 'price', key: 'price', render: (price: number) => `¥${price}` },
    { 
      title: '状态', 
      dataIndex: 'status', 
      key: 'status',
      render: (status: number) => (status === 1 ? '上架' : '下架'),
    },
    { title: '创建时间', dataIndex: 'createTime', key: 'createTime' },
    {
      title: '操作',
      key: 'actions',
      render: (_: unknown, record: ProductVO) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确定删除该商品？" onConfirm={() => handleDelete(record.id)}>
            <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>商品列表</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增商品</Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <Button icon={<RestOutlined />} onClick={() => setLoading(true)}>刷新</Button>
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
        }}
      />

      <Modal
        title={selectedProduct ? '编辑商品' : '新增商品'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          {!selectedProduct && (
            <Form.Item name="productCode" label="商品编码" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          )}
          <Form.Item name="productName" label="商品名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="categoryId" label="商品分类">
            <Select>
              <Select.Option value={1}>粮油类</Select.Option>
              <Select.Option value={2}>蔬菜类</Select.Option>
              <Select.Option value={3}>水果类</Select.Option>
              <Select.Option value={4}>肉类</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="brand" label="品牌">
            <Input />
          </Form.Item>
          <Form.Item name="unit" label="单位">
            <Input />
          </Form.Item>
          <Form.Item name="origin" label="产地">
            <Input />
          </Form.Item>
          <Form.Item name="price" label="参考价">
            <InputNumber style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="status" label="状态">
            <Select>
              <Select.Option value={1}>上架</Select.Option>
              <Select.Option value={2}>下架</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ProductList;
