import React from 'react';
import { Card, Typography } from 'antd';

const { Title, Paragraph } = Typography;

const DataMonitor: React.FC = () => {
  return (
    <div className="page-container">
      <Card>
        <Title level={3}>数据监测</Title>
        <Paragraph>此功能正在开发中...</Paragraph>
      </Card>
    </div>
  );
};

export default DataMonitor;
