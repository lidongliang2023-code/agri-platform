import { Card, Row, Col, Statistic, Table, Button } from 'antd'
import { ShoppingCartOutlined, UserOutlined, ManOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { getHomeSummary } from '@/api/home'

function Home() {
  // 一次请求拿全：原先这里是两个返回写死对象的"接口"，页面根本不发请求
  const { data: summary } = useQuery({
    queryKey: ['homeSummary'],
    queryFn: getHomeSummary,
  })
  const stat = summary?.data?.stat
  // 保留两个局部变量名，下面两个表格的 dataSource 不用改
  const marketData = { data: { marketList: summary?.data?.categoryQuotes || [] } }
  const transactions = { data: summary?.data?.recentDeals || [] }

  const marketColumns = [
    { title: '品类', dataIndex: 'categoryName', key: 'categoryName' },
    {
      title: '在架货源',
      dataIndex: 'productCount',
      key: 'productCount',
      render: (val: number) => `${val} 个`
    },
    {
      title: '价格区间',
      key: 'priceRange',
      // 不写"元/斤"：货源的计价单位各不相同（袋 / 箱 / 吨 / 公斤），统一换算等于编数据
      render: (_: unknown, row: { minPrice: number; maxPrice: number }) =>
        row.minPrice == null ? '—' : `¥${row.minPrice} ~ ¥${row.maxPrice}`
    }
  ]

  const transactionColumns = [
    { title: '商品', dataIndex: 'productName', key: 'productName' },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
      render: (val: number, row: { unit?: string }) => (val == null ? '—' : `${val} ${row.unit ?? ''}`)
    },
    { title: '金额', dataIndex: 'amount', key: 'amount', render: (val: number) => `¥${val}` },
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
              value={Number(stat?.tradeAmount || 0)} 
              prefix="¥" 
              suffix="元"
              valueStyle={{ color: '#1890ff' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="累计成交笔数" 
              value={Number(stat?.dealCount || 0)} 
              suffix="笔"
              prefix={<ShoppingCartOutlined />}
              valueStyle={{ color: '#fa8c16' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="参与买卖方" 
              value={Number(stat?.participantCount || 0)} 
              suffix="家"
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Col>
          <Col span={6}>
            <Statistic 
              title="在架货源" 
              value={Number(stat?.publishedProductCount || 0)} 
              suffix="个"
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
