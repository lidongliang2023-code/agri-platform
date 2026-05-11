import { useState } from 'react'
import { Card, Table, Button, Input, Space, Tag, Modal, Descriptions, message, Statistic, Row, Col, Progress, Select } from 'antd'
import { SearchOutlined, LineChartOutlined } from '@ant-design/icons'
import {
  getPriceRecommendation,
  getMarketPrice,
  getPriceTrend,
  PriceRecommendation,
  MarketPrice,
  PriceTrend,
} from '@/api/price'

const trendMap: Record<string, { color: string; text: string }> = {
  up: { color: 'success', text: '↑ 上涨' },
  down: { color: 'error', text: '↓ 下跌' },
  stable: { color: 'warning', text: '→ 稳定' },
}

export default function PriceList() {
  const [productId, setProductId] = useState<string>()
  const [productName, setProductName] = useState<string>()
  const [loading, setLoading] = useState(false)
  const [recommendation, setRecommendation] = useState<PriceRecommendation | null>(null)
  const [marketPrice, setMarketPrice] = useState<MarketPrice | null>(null)
  const [priceTrend, setPriceTrend] = useState<PriceTrend[]>([])
  const [trendVisible, setTrendVisible] = useState(false)

  const handleSearchByProduct = async () => {
    if (!productId) {
      message.warning('请输入产品ID')
      return
    }
    setLoading(true)
    try {
      const res = await getPriceRecommendation(parseInt(productId))
      if (res.code === 200) {
        setRecommendation(res.data)
      } else {
        message.error(res.message || '获取价格推荐失败')
      }
    } catch (error) {
      message.error('获取价格推荐失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchMarket = async () => {
    if (!productName) {
      message.warning('请输入产品名称')
      return
    }
    setLoading(true)
    try {
      const res = await getMarketPrice(productName)
      if (res.code === 200) {
        setMarketPrice(res.data)
      } else {
        message.error(res.message || '获取市场价格失败')
      }
    } catch (error) {
      message.error('获取市场价格失败')
    } finally {
      setLoading(false)
    }
  }

  const handleViewTrend = async () => {
    if (!productId) {
      message.warning('请先查询产品价格')
      return
    }
    setLoading(true)
    try {
      const res = await getPriceTrend(parseInt(productId), 7)
      if (res.code === 200) {
        setPriceTrend(res.data || [])
        setTrendVisible(true)
      } else {
        message.error(res.message || '获取价格趋势失败')
      }
    } catch (error) {
      message.error('获取价格趋势失败')
    } finally {
      setLoading(false)
    }
  }

  const trendColumns = [
    { title: '日期', dataIndex: 'date', key: 'date' },
    { title: '价格', dataIndex: 'price', key: 'price', render: (v: number) => `¥${v}` },
    { title: '成交量', dataIndex: 'volume', key: 'volume' },
    { title: '均价', dataIndex: 'avgPrice', key: 'avgPrice', render: (v: number) => `¥${v}` },
  ]

  return (
    <div>
      <Card title="价格推荐" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <span>产品ID：</span>
          <Input
            placeholder="请输入产品ID"
            value={productId}
            onChange={(e) => setProductId(e.target.value)}
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleSearchByProduct}>
            查询推荐价格
          </Button>
          <Button icon={<LineChartOutlined />} loading={loading} onClick={handleViewTrend}>
            查看价格趋势
          </Button>
        </Space>

        {recommendation && (
          <div style={{ marginTop: 24 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="推荐价格"
                    value={recommendation.recommendedPrice}
                    precision={2}
                    prefix="¥"
                    suffix="/单位"
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="价格区间"
                    value={`¥${recommendation.minPrice} - ¥${recommendation.maxPrice}`}
                  />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="市场均价" value={recommendation.avgPrice} precision={2} prefix="¥" />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic
                    title="置信度"
                    value={recommendation.confidence}
                    suffix="%"
                    valueStyle={{ color: recommendation.confidence >= 80 ? '#3f8600' : '#cf1322' }}
                  />
                </Card>
              </Col>
            </Row>

            <Card title="价格分析" style={{ marginTop: 16 }}>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="产品名称">{recommendation.productName}</Descriptions.Item>
                <Descriptions.Item label="品类">{recommendation.categoryName}</Descriptions.Item>
                <Descriptions.Item label="价格趋势">
                  <Tag color={trendMap[recommendation.priceTrend]?.color}>
                    {trendMap[recommendation.priceTrend]?.text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="价格变化">
                  <span style={{ color: recommendation.priceChange >= 0 ? '#3f8600' : '#cf1322' }}>
                    {recommendation.priceChange >= 0 ? '+' : ''}{recommendation.priceChange} ({recommendation.priceChangePercent}%)
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="市场需求">{recommendation.marketDemand}</Descriptions.Item>
                <Descriptions.Item label="供应状态">{recommendation.supplyStatus}</Descriptions.Item>
                <Descriptions.Item label="定价建议" span={2}>{recommendation.suggestion}</Descriptions.Item>
              </Descriptions>
            </Card>
          </div>
        )}
      </Card>

      <Card title="市场价格查询">
        <Space style={{ marginBottom: 16 }}>
          <span>产品名称：</span>
          <Input
            placeholder="请输入产品名称"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            style={{ width: 200 }}
          />
          <Button type="primary" icon={<SearchOutlined />} loading={loading} onClick={handleSearchMarket}>
            查询市场价格
          </Button>
        </Space>

        {marketPrice && (
          <Card style={{ marginTop: 16 }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="产品名称">{marketPrice.productName}</Descriptions.Item>
              <Descriptions.Item label="品类">{marketPrice.categoryName}</Descriptions.Item>
              <Descriptions.Item label="当前价格">¥{marketPrice.currentPrice}</Descriptions.Item>
              <Descriptions.Item label="昨日价格">¥{marketPrice.previousPrice}</Descriptions.Item>
              <Descriptions.Item label="价格变化">
                <span style={{ color: marketPrice.priceChange >= 0 ? '#3f8600' : '#cf1322' }}>
                  {marketPrice.priceChange >= 0 ? '+' : ''}{marketPrice.priceChange} ({marketPrice.priceChangePercent}%)
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="价格区间">
                ¥{marketPrice.minPrice} - ¥{marketPrice.maxPrice}
              </Descriptions.Item>
              <Descriptions.Item label="市场均价">¥{marketPrice.avgPrice}</Descriptions.Item>
              <Descriptions.Item label="成交量">{marketPrice.tradingVolume}</Descriptions.Item>
              <Descriptions.Item label="更新时间" span={2}>{marketPrice.updateTime}</Descriptions.Item>
            </Descriptions>
          </Card>
        )}
      </Card>

      <Modal
        title="价格趋势（近7天）"
        open={trendVisible}
        onCancel={() => setTrendVisible(false)}
        footer={null}
        width={800}
      >
        <Table
          columns={trendColumns}
          dataSource={priceTrend}
          rowKey="date"
          pagination={false}
        />
      </Modal>
    </div>
  )
}