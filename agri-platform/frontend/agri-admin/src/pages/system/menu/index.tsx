import React, { useState, useEffect } from 'react';
import { Tree, Button, Modal, Form, Input, Select, message, Popconfirm, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';
import { MenuVO, MenuSaveDTO, MenuUpdateDTO } from '@/models/system/menu';
import { menuApi } from '@/api/system/menu';

const { TreeNode } = Tree;

const MenuManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMenu, setSelectedMenu] = useState<MenuVO | null>(null);
  const [treeData, setTreeData] = useState<MenuVO[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);

  useEffect(() => {
    fetchMenuTree();
  }, []);

  const fetchMenuTree = async () => {
    setLoading(true);
    try {
      const response = await menuApi.getTree();
      setTreeData(response.data);
    } catch (error) {
      message.error('获取菜单失败');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    form.resetFields();
    setSelectedMenu(null);
    setModalVisible(true);
  };

  const handleEdit = (menu: MenuVO) => {
    form.setFieldsValue({
      menuName: menu.menuName,
      parentId: menu.parentId,
      orderNum: menu.orderNum,
      path: menu.path,
      component: menu.component,
      menuType: menu.menuType,
      visible: menu.visible,
      perms: menu.perms,
      icon: menu.icon,
      status: menu.status,
    });
    setSelectedMenu(menu);
    setModalVisible(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await menuApi.delete(id);
      message.success('删除成功');
      fetchMenuTree();
    } catch (error) {
      message.error('删除失败');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue();
      
      if (!selectedMenu) {
        await menuApi.create(values as MenuSaveDTO);
        message.success('创建成功');
      } else {
        await menuApi.update(selectedMenu.id, values as MenuUpdateDTO);
        message.success('更新成功');
      }
      
      setModalVisible(false);
      fetchMenuTree();
    } catch (error) {
      message.error('操作失败');
    }
  };

  const renderTreeNodes = (data: MenuVO[]): React.ReactNode => {
    return data.map((item) => {
      const title = (
        <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span>{item.menuName}</span>
          <span style={{ display: 'flex', gap: 4 }}>
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(item)}>编辑</Button>
            <Popconfirm title="确定删除该菜单？" onConfirm={() => handleDelete(item.id)}>
              <Button icon={<DeleteOutlined />} size="small" danger>删除</Button>
            </Popconfirm>
          </span>
        </span>
      );

      if (item.children && item.children.length > 0) {
        return (
          <TreeNode title={title} key={item.id}>
            {renderTreeNodes(item.children)}
          </TreeNode>
        );
      }
      return <TreeNode title={title} key={item.id} />;
    });
  };

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2>菜单管理</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增菜单</Button>
      </div>

      <Button icon={<RestOutlined />} onClick={fetchMenuTree} style={{ marginBottom: 16 }}>刷新</Button>

      <Spin spinning={loading}>
        <Tree
          loadData={() => Promise.resolve()}
          defaultExpandAll
          selectedKeys={selectedKeys}
          onSelect={(keys) => setSelectedKeys(keys as string[])}
        >
          {renderTreeNodes(treeData)}
        </Tree>
      </Spin>

      <Modal
        title={selectedMenu ? '编辑菜单' : '新增菜单'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="menuName" label="菜单名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="parentId" label="上级菜单">
            <Select placeholder="请选择上级菜单">
              <Select.Option value={0}>顶级菜单</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="menuType" label="菜单类型">
            <Select>
              <Select.Option value="M">目录</Select.Option>
              <Select.Option value="C">菜单</Select.Option>
              <Select.Option value="F">按钮</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="path" label="路由路径">
            <Input />
          </Form.Item>
          <Form.Item name="component" label="组件路径">
            <Input />
          </Form.Item>
          <Form.Item name="perms" label="权限标识">
            <Input />
          </Form.Item>
          <Form.Item name="icon" label="图标">
            <Input />
          </Form.Item>
          <Form.Item name="orderNum" label="排序">
            <Input type="number" />
          </Form.Item>
          <Form.Item name="visible" label="显示状态">
            <Select>
              <Select.Option value={1}>显示</Select.Option>
              <Select.Option value={2}>隐藏</Select.Option>
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
    </div>
  );
};

export default MenuManagement;
