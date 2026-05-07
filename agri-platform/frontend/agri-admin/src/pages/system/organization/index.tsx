import React, { useState } from 'react';
import { Tree, Button, Modal, Form, Input, Select, message, Popconfirm, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, RestOutlined } from '@ant-design/icons';

interface OrganizationVO {
  id: number;
  orgName: string;
  parentId: number;
  orgCode: string;
  orgType: string;
  contactPerson: string;
  contactPhone: string;
  address: string;
  status: number;
  children?: OrganizationVO[];
}

const OrganizationManagement: React.FC = () => {
  const [form] = Form.useForm();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<OrganizationVO | null>(null);
  const [loading, setLoading] = useState(false);

  const [treeData] = useState<OrganizationVO[]>([
    {
      id: 1,
      orgName: '农业平台总部',
      parentId: 0,
      orgCode: 'AGRI-HQ',
      orgType: '1',
      contactPerson: '张总',
      contactPhone: '13800138000',
      address: '北京市朝阳区',
      status: 1,
      children: [
        {
          id: 2,
          orgName: '华北分公司',
          parentId: 1,
          orgCode: 'AGRI-NC',
          orgType: '2',
          contactPerson: '李经理',
          contactPhone: '13900139000',
          address: '北京市海淀区',
          status: 1,
        },
        {
          id: 3,
          orgName: '华东分公司',
          parentId: 1,
          orgCode: 'AGRI-EC',
          orgType: '2',
          contactPerson: '王经理',
          contactPhone: '13700137000',
          address: '上海市浦东新区',
          status: 1,
        },
      ],
    },
  ]);

  const handleCreate = () => {
    form.resetFields();
    setSelectedOrg(null);
    setModalVisible(true);
  };

  const handleEdit = (org: OrganizationVO) => {
    form.setFieldsValue({
      orgName: org.orgName,
      orgCode: org.orgCode,
      orgType: org.orgType,
      contactPerson: org.contactPerson,
      contactPhone: org.contactPhone,
      address: org.address,
      status: org.status,
    });
    setSelectedOrg(org);
    setModalVisible(true);
  };

  const handleDelete = (_: number) => {
    message.success('删除成功');
  };

  const handleSubmit = () => {
    message.success(selectedOrg ? '更新成功' : '创建成功');
    setModalVisible(false);
  };

  const renderTreeNodes = (data: OrganizationVO[]): React.ReactNode => {
    return data.map((item) => {
      const title = (
        <span style={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
          <span>{item.orgName}</span>
          <span style={{ display: 'flex', gap: 4 }}>
            <Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(item)}>编辑</Button>
            <Popconfirm title="确定删除该组织？" onConfirm={() => handleDelete(item.id)}>
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
        <h2>组织管理</h2>
        <Button icon={<PlusOutlined />} onClick={handleCreate}>新增组织</Button>
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
        title={selectedOrg ? '编辑组织' : '新增组织'}
        visible={modalVisible}
        onOk={handleSubmit}
        onCancel={() => setModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="orgName" label="组织名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="orgCode" label="组织编码" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="orgType" label="组织类型">
            <Select>
              <Select.Option value="1">平台</Select.Option>
              <Select.Option value="2">企业</Select.Option>
              <Select.Option value="3">农场</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="contactPerson" label="联系人">
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="联系电话">
            <Input />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input />
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

export default OrganizationManagement;
