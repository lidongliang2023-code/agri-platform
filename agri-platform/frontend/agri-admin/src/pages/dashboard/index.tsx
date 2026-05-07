import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { UserOutlined, ShoppingCartOutlined, BuildOutlined, LeftOutlined } from '@ant-design/icons';

const Dashboard: React.FC = () => {
  return (
    <div className="page-container">
      <h2>工作台</h2>
      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="用户总数"
              value={128}
              prefix={<UserOutlined />}
              suffix="人"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="商品数量"
              value={520}
              prefix={<ShoppingCartOutlined />}
              suffix="件"
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="客户数量"
              value={386}
              prefix={<BuildOutlined />}
              suffix="家"
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="供应商数量"
              value={156}
              prefix={<LeftOutlined />}
              suffix="家"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
