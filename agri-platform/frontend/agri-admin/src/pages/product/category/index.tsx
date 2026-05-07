import React, { useState } from 'react';
import { Tree, Button, Modal, Form, Input, Select, message, Popconfirm, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';

interface CategoryVO {
  id: number;
  categoryName: string;
  parentId: number;
  categoryCode: string;
  orderNum: number;
  icon: string;
  status: number;
  children?: CategoryVO[];
}

const ProductCategory: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryVO | null>(null);
  const [loading, setLoading] = useState(false);

  const [treeData] = useState<CategoryVO[]>([
    {
      id: 1,
      categoryName: '粮油类',
      parentId: 0,
      categoryCode: 'C001',
      orderNum: 1,
      icon: 'WheatOutlined',
      status: 1,
      children: [
        {
          id: 101,
          categoryName: '大米',
          parentId: 1,
          categoryCode: 'C001-01',
          orderNum: 1,
          icon: '',
          status: 1,
        },
        {
          id: 102,
          categoryName: '面粉',
          parentId: 1,
          categoryCode: 'C001-02',
          orderNum: 2,
          icon: '',
          status: 1,
        },
      ],
    },
    {
      id: 2,
      categoryName: '蔬菜类',
      parentId: 0,
      categoryCode: 'C002',
      orderNum: 2,
      icon: 'CarrotOutlined',
      status: 1,
      children: [
        {
          id: 201,
          categoryName: '叶菜',
          parentId: 2,
          categoryCode: 'C002-01',
          orderNum: 1,
          icon: '',
          status: 1,
        },
        {
          id: 202,
          categoryName: '根茎类',
          parentId: 2,
          categoryCode: 'C002-02',
          orderNum: 2,
          icon: '',
          status: 1,
        },
      ],
    },
    {
      id: 3,
      categoryName: '水果类',
      parentId: 0,
      categoryCode: 'C003',
      orderNum: 3,
      icon: 'AppleOutlined',
      status: 1,
    },
  ]);

  const handleCreate = () => {
    form.resetFields();
    setSelectedCategory(null);
    setModalVisible(true);
  };

  const handleEdit = (category: CategoryVO) => {
    form.setFieldsValue({
      categoryName: category.categoryName,
      categoryCode: category.categoryCode,
      orderNum: category.orderNum,
      icon: category.icon,
      status: category.status,
    });
    setSelectedCategory(category);
    setModalVisible(true);
  };

  const handleDelete = (_: number) => {
    message.success('删除成功');
  };

  const handleSubmit = () => {
    message.success(selectedCategory ? '更新成功' : '创建成功');
    setModalVisible(false);
  };

  const renderTreeNodes = (data: CategoryVO[]): React.ReactNode => {
    return data.map((item) => {
      const title = (
        <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span>{item.categoryName}</span>
          <span style={{ display: 'flex', gap: 4 }}>
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(item)}>编辑</Button>
            <Popconfirm title="确定删除该分类？" onConfirm={() => handleDelete(item.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
            </Popconfirm>
          </span>
        </span>
      );

      if (item.children && item.children.length > 0) {
        return (
          <Tree.TreeNode title={title} key={item.id}>
            {renderTreeNodes(item.children)}
          </Tree.TreeNode>
        );
      }
      return <Tree.TreeNode title={title} key={item.id} />;
    });
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>商品分类</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增分类</Button>
      </div>

      <Button icon={<RestOutlined />} onClick={() => setLoading(true)} style={{ marginBottom: 16 }}>刷新</Button>

      <Spin spinning={loading}>
        <Tree
          loadData={() => Promise.resolve()}
          defaultExpandAll
        >
          {renderTreeNodes(treeData)}
        </Tree>
      </Spin>

      <Modal
        title={selectedCategory ? '编辑分类' : '新增分类'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="categoryName" label="分类名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="categoryCode" label="分类编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="orderNum" label="排序">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input placeholder="Ant Design 图标名称" />
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

export default ProductCategory;
