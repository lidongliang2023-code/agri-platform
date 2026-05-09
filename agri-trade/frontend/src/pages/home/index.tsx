import { Card, Row, Col, Statistic, Table, Tag, Button } from 'antd'
import { WarningOutlined, DingdingOutlined, ShoppingCartOutlined, UserOutlined, ManOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getMarketData, getRecentTransactions } from '@/api/home'

function Home() {
  const { data: marketData } = useQuery({
    queryKey: ['marketData'],
    queryFn: getMarketData,
  })

  const { data: transactions } = useQuery({
    queryKey: ['recentTransactions'],
    queryFn: getRecentTransactions,
  })

  const marketColumns = [
    { title: '品类', dataIndex: 'category', key: 'category' },
    { title: '均价', dataIndex: 'price', key: 'price', render: (val: string) => `${val}元/斤` },
    { title: '涨跌幅', dataIndex: 'change', key: 'change', render: (val: string) => (
      <Tag color={val.startsWith('+') ? 'green' : 'red'}>
        {val.startsWith('+') ? <WarningOutlined /> : <DingdingOutlined />} {val}
      </Tag>
    )},
    { title: '成交量', dataIndex: 'volume', key: 'volume', render: (val: string) => `${val}吨` },
  ]

  const transactionColumns = [
    { title: '商品', dataIndex: 'productName', key: 'productName' },
    { title: '买家', dataIndex: 'buyerName', key: 'buyerName', ellipsis: true },
    { title: '数量', dataIndex: 'quantity', key: 'quantity', render: (val: string) => `${val}斤` },
    { title: '单价', dataIndex: 'unitPrice', key: 'unitPrice', render: (val: string) => `${val}元/斤` },
    { title: '时间', dataIndex: 'time', key: 'time' },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Card style={{ marginBottom: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 28, fontWeight: 'bold', color: '#1f1f1f', marginBottom: 8 }}>
            一网连四海，百业兴三农
          </h1>
          <p style={{ color: '#666' }}>打造中国领先的农业产业互联网平台</p>
        </div>
        
        <Row gutter={16}>
          <Col span={6}>
            <Statistic 
              title="累计交易额" 
              value={marketData?.data?.totalAmount || 0} 
              prefix="¥" 
              suffix="亿"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="注册用户数" 
              value={marketData?.data?.userCount || 0} 
              suffix="万人"
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="累计成交笔数" 
              value={marketData?.data?.transactionCount || 0} 
              suffix="万笔"
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="覆盖区域" 
              value={marketData?.data?.coverageCount || 0} 
              suffix="个县域"
              prefix={<ManOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Col>
        </Row>
      </Card>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="今日行情快报" extra={<Button type="link">查看更多</Button>}>
            <Table 
              columns={marketColumns} 
              dataSource={marketData?.data?.marketList || []} 
              pagination={false} 
              bordered={false}
            />
          </Card>
        </Col>
        <Col span={10}>
          <Card title="今日实时成交" extra={<span style={{ color: '#fa8c16', fontSize: 12 }}>实时更新</span>}>
            <Table 
              columns={transactionColumns} 
              dataSource={transactions?.data || []} 
              pagination={false} 
              bordered={false}
              rowKey="id"
            />
          </Card>
        </Col>
      </Row>

      <Card title="平台能力亮点" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          <Col span={4}>
            <div style={{ textAlign: 'center', padding: 16, background: '#f6ffed', borderRadius: 8 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🤖</div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>智能供需匹配</div>
              <div style={{ fontSize: 12, color: '#666' }}>AI驱动精准匹配</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center', padding: 16, background: '#e6f7ff', borderRadius: 8 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>交易资金托管</div>
              <div style={{ fontSize: 12, color: '#666' }}>第三方资金托管</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center', padding: 16, background: '#fff7e6', borderRadius: 8 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>⛓️</div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>区块链存证</div>
              <div style={{ fontSize: 12, color: '#666' }}>全链路数据上链</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center', padding: 16, background: '#f9f0ff', borderRadius: 8 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>💳</div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>金融服务支撑</div>
              <div style={{ fontSize: 12, color: '#666' }}>货押融资订单融资</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center', padding: 16, background: '#e6fffb', borderRadius: 8 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🚚</div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>智能物流匹配</div>
              <div style={{ fontSize: 12, color: '#666' }}>一键约车全程跟踪</div>
            </div>
          </Col>
          <Col span={4}>
            <div style={{ textAlign: 'center', padding: 16, background: '#fff1f0', borderRadius: 8 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>行情数据支撑</div>
              <div style={{ fontSize: 12, color: '#666' }}>实时行情参考</div>
            </div>
          </Col>
        </Row>
      </Card>

      <Card title="服务多元用户" style={{ marginTop: 24 }}>
        <Row gutter={16}>
          <Col span={6}>
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>👨‍🌾</div>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>种植户/合作社</div>
              <ul style={{ fontSize: 12, color: '#666', paddingLeft: 20 }}>
                <li>一键发布货源</li>
                <li>语音发布</li>
                <li>附近买家推荐</li>
              </ul>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>🏪</div>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>批发商</div>
              <ul style={{ fontSize: 12, color: '#666', paddingLeft: 20 }}>
                <li>采购计划</li>
                <li>供应商评估</li>
                <li>批量操作</li>
              </ul>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>🍽️</div>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>餐饮/商超</div>
              <ul style={{ fontSize: 12, color: '#666', paddingLeft: 20 }}>
                <li>今日急采</li>
                <li>框架协议</li>
                <li>品质追溯</li>
              </ul>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ padding: 16, border: '1px solid #e8e8e8', borderRadius: 8 }}>
              <div style={{ fontSize: 24, marginBottom: 12 }}>🏭</div>
              <div style={{ fontWeight: 'bold', marginBottom: 8 }}>食品加工企业</div>
              <ul style={{ fontSize: 12, color: '#666', paddingLeft: 20 }}>
                <li>原料需求库</li>
                <li>供应商审核</li>
                <li>ERP对接</li>
              </ul>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  )
}

export default Home