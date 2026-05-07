import React from 'react';
import { Row, Col, Card, Statistic, Table, List, Typography } from 'antd';
import {
  ShoppingOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  RiseOutlined,
  TeamOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/auth';
import './index.css';

const { Title, Text } = Typography;

const Dashboard: React.FC = () => {
  const { userInfo } = useAuthStore();

  const statisticsData = [
    {
      title: '今日交易额',
      value: 126800,
      prefix: <DollarOutlined />,
      suffix: '元',
      trend: 12.5,
      icon: <DollarOutlined style={{ color: '#1890ff' }} />,
    },
    {
      title: '今日订单数',
      value: 328,
      prefix: <ShoppingCartOutlined />,
      suffix: '笔',
      trend: 8.2,
      icon: <ShoppingCartOutlined style={{ color: '#52c41a' }} />,
    },
    {
      title: '供应商数量',
      value: 156,
      prefix: <ShopOutlined />,
      suffix: '家',
      trend: 5.3,
      icon: <ShopOutlined style={{ color: '#722ed1' }} />,
    },
    {
      title: '采购商数量',
      value: 2847,
      prefix: <TeamOutlined />,
      suffix: '人',
      trend: 15.8,
      icon: <TeamOutlined style={{ color: '#faad14' }} />,
    },
  ];

  const recentOrders = [
    {
      id: 'ORD20240507001',
      customer: '某某农业合作社',
      product: '有机大米 5kg装',
      amount: 15000,
      status: '已完成',
      createTime: '2025-05-07 10:30:00',
    },
    {
      id: 'ORD20240507002',
      customer: '某某食品公司',
      product: '新鲜蔬菜礼盒',
      amount: 8500,
      status: '处理中',
      createTime: '2025-05-07 09:15:00',
    },
    {
      id: 'ORD20240507003',
      customer: '某某超市',
      product: '土鸡蛋 30枚装',
      amount: 4200,
      status: '已完成',
      createTime: '2025-05-07 08:45:00',
    },
    {
      id: 'ORD20240507004',
      customer: '某某餐饮公司',
      product: '有机蔬菜混合装',
      amount: 12000,
      status: '待发货',
      createTime: '2025-05-07 08:20:00',
    },
  ];

  const announcements = [
    {
      title: '平台系统升级通知',
      time: '2025-05-06',
      content: '平台将于5月8日凌晨2:00-6:00进行系统升级维护。',
    },
    {
      title: '新功能上线公告',
      time: '2025-05-05',
      content: '供应链金融模块新增仓单质押功能，欢迎使用。',
    },
    {
      title: '交易撮合规则调整',
      time: '2025-05-04',
      content: '为提升交易效率，平台对撮合规则进行了优化调整。',
    },
  ];

  const orderColumns = [
    {
      title: '订单编号',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: '客户名称',
      dataIndex: 'customer',
      key: 'customer',
    },
    {
      title: '商品信息',
      dataIndex: 'product',
      key: 'product',
    },
    {
      title: '订单金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (amount: number) => `¥${amount.toLocaleString()}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <span className={`status-tag status-${status}`}>{status}</span>
      ),
    },
    {
      title: '下单时间',
      dataIndex: 'createTime',
      key: 'createTime',
    },
  ];

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <Title level={3}>欢迎回来，{userInfo?.nickname || '管理员'}</Title>
          <Text type="secondary">今天是{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</Text>
        </div>
      </div>

      <Row gutter={[16, 16]} className="statistics-row">
        {statisticsData.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <Card>
              <Statistic
                title={stat.title}
                value={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                valueStyle={{ color: '#333' }}
              />
              <div className="stat-footer">
                <RiseOutlined style={{ color: '#52c41a', marginRight: 4 }} />
                <Text type="secondary">较昨日 +{stat.trend}%</Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card title="近期订单" extra={<a href="/trade/orders">查看更多</a>}>
            <Table
              columns={orderColumns}
              dataSource={recentOrders}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card title="平台公告" extra={<a href="/info/announcements">更多</a>}>
            <List
              itemLayout="horizontal"
              dataSource={announcements}
              renderItem={(item) => (
                <List.Item>
                  <List.Item.Meta
                    title={<a href="#">{item.title}</a>}
                    description={
                      <>
                        <div>{item.content}</div>
                        <Text type="secondary" className="announcement-time">{item.time}</Text>
                      </>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card title="快捷入口">
            <div className="quick-access">
              <a href="/trade/demand" className="quick-access-item">
                <ShoppingOutlined />
                <span>发布需求</span>
              </a>
              <a href="/production/plan" className="quick-access-item">
                <AppstoreOutlined />
                <span>生产计划</span>
              </a>
              <a href="/finance/apply" className="quick-access-item">
                <DollarOutlined />
                <span>金融服务</span>
              </a>
              <a href="/service/trace" className="quick-access-item">
                <TeamOutlined />
                <span>质量溯源</span>
              </a>
            </div>
          </Card>
        </Col>

        <Col xs={24} sm={12} lg={18}>
          <Card title="系统概览">
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="设备在线" value={98} suffix="/ 100" valueStyle={{ color: '#52c41a' }} />
              </Col>
              <Col span={8}>
                <Statistic title="待处理订单" value={23} valueStyle={{ color: '#faad14' }} />
              </Col>
              <Col span={8}>
                <Statistic title="预警信息" value={5} valueStyle={{ color: '#ff4d4f' }} />
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
