import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Paragraph } = Typography;

const AlertManagement: React.FC = () => {
  return (
    <div className="page-container">
      <Card>
        <Title level={3}>预警管理</Title>
        <Paragraph>此功能正在开发中...</Paragraph>
      </Card>
    </div>
  );
};

export default AlertManagement;
