import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event;
// Progress / Select 没有被用到，删掉 —— 类型检查（tsc --noEmit）会把它当成错误挡住发布
import { Card, Table, Button, Input, Space, Tag, Modal, Descriptions, message, Statistic, Row, Col } from "@/vue/ui";
import { SearchOutlined, LineChartOutlined } from "@ant-design/icons-vue";
import { getPriceRecommendation, getMarketPrice, getPriceTrend, PriceRecommendation, MarketPrice, PriceTrend } from '@/api/price';
const trendMap: Record<string, {
  color: string;
  text: string;
}> = {
  up: {
    color: 'success',
    text: '↑ 上涨'
  },
  down: {
    color: 'error',
    text: '↓ 下跌'
  },
  stable: {
    color: 'warning',
    text: '→ 稳定'
  }
};
const PriceList = defineComponent({
  name: "PriceList",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const productId = shallowRef<string | undefined>(undefined);
    const setProductId = (next: typeof productId.value | ((previous: typeof productId.value) => typeof productId.value)) => {
      productId.value = typeof next === 'function' ? (next as (previous: typeof productId.value) => typeof productId.value)(productId.value) : next;
    };
    const productName = shallowRef<string | undefined>(undefined);
    const setProductName = (next: typeof productName.value | ((previous: typeof productName.value) => typeof productName.value)) => {
      productName.value = typeof next === 'function' ? (next as (previous: typeof productName.value) => typeof productName.value)(productName.value) : next;
    };
    const loading = shallowRef(false);
    const setLoading = (next: typeof loading.value | ((previous: typeof loading.value) => typeof loading.value)) => {
      loading.value = typeof next === 'function' ? (next as (previous: typeof loading.value) => typeof loading.value)(loading.value) : next;
    };
    const recommendation = shallowRef<PriceRecommendation | null>(null);
    const setRecommendation = (next: typeof recommendation.value | ((previous: typeof recommendation.value) => typeof recommendation.value)) => {
      recommendation.value = typeof next === 'function' ? (next as (previous: typeof recommendation.value) => typeof recommendation.value)(recommendation.value) : next;
    };
    const marketPrice = shallowRef<MarketPrice | null>(null);
    const setMarketPrice = (next: typeof marketPrice.value | ((previous: typeof marketPrice.value) => typeof marketPrice.value)) => {
      marketPrice.value = typeof next === 'function' ? (next as (previous: typeof marketPrice.value) => typeof marketPrice.value)(marketPrice.value) : next;
    };
    const priceTrend = shallowRef<PriceTrend[]>([]);
    const setPriceTrend = (next: typeof priceTrend.value | ((previous: typeof priceTrend.value) => typeof priceTrend.value)) => {
      priceTrend.value = typeof next === 'function' ? (next as (previous: typeof priceTrend.value) => typeof priceTrend.value)(priceTrend.value) : next;
    };
    const trendVisible = shallowRef(false);
    const setTrendVisible = (next: typeof trendVisible.value | ((previous: typeof trendVisible.value) => typeof trendVisible.value)) => {
      trendVisible.value = typeof next === 'function' ? (next as (previous: typeof trendVisible.value) => typeof trendVisible.value)(trendVisible.value) : next;
    };
    const handleSearchByProduct = async () => {
      if (!productId.value) {
        message.warning('请输入产品ID');
        return;
      }
      setLoading(true);
      try {
        const res = await getPriceRecommendation(parseInt(productId.value));
        if (res.code === 200) {
          setRecommendation(res.data);
        } else {
          message.error(res.message || '获取价格推荐失败');
        }
      } catch (error) {
        message.error('获取价格推荐失败');
      } finally {
        setLoading(false);
      }
    };
    const handleSearchMarket = async () => {
      if (!productName.value) {
        message.warning('请输入产品名称');
        return;
      }
      setLoading(true);
      try {
        const res = await getMarketPrice(productName.value);
        if (res.code === 200) {
          setMarketPrice(res.data);
        } else {
          message.error(res.message || '获取市场价格失败');
        }
      } catch (error) {
        message.error('获取市场价格失败');
      } finally {
        setLoading(false);
      }
    };
    const handleViewTrend = async () => {
      if (!productId.value) {
        message.warning('请先查询产品价格');
        return;
      }
      setLoading(true);
      try {
        const res = await getPriceTrend(parseInt(productId.value), 7);
        if (res.code === 200) {
          setPriceTrend(res.data || []);
          setTrendVisible(true);
        } else {
          message.error(res.message || '获取价格趋势失败');
        }
      } catch (error) {
        message.error('获取价格趋势失败');
      } finally {
        setLoading(false);
      }
    };
    const trendColumns = computed(() => [{
      title: '日期',
      dataIndex: 'date',
      key: 'date'
    }, {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (v: number) => `¥${v}`
    }, {
      title: '成交量',
      dataIndex: 'volume',
      key: 'volume'
    }, {
      title: '均价',
      dataIndex: 'avgPrice',
      key: 'avgPrice',
      render: (v: number) => `¥${v}`
    }]);
    return () => {
      const view_marketPrice = marketPrice.value;
      const view_recommendation = recommendation.value;
      return <div>
      <Card title="价格推荐" style={{
          marginBottom: 16
        }}>
        <Space style={{
            marginBottom: 16
          }}>
          <span>产品ID：</span>
          <Input placeholder="请输入产品ID" value={productId.value} onChange={e => setProductId(e.target.value ?? '')} style={{
              width: 200
            }} />
          <Button type="primary" icon={<SearchOutlined />} loading={loading.value} onClick={handleSearchByProduct}>
            查询推荐价格
          </Button>
          <Button icon={<LineChartOutlined />} loading={loading.value} onClick={handleViewTrend}>
            查看价格趋势
          </Button>
        </Space>

        {view_recommendation && <div style={{
            marginTop: 24
          }}>
            <Row gutter={16}>
              <Col span={6}>
                <Card>
                  <Statistic title="推荐价格" value={view_recommendation.recommendedPrice} precision={2} prefix="¥" suffix="/单位" />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="价格区间" value={`¥${view_recommendation.minPrice} - ¥${view_recommendation.maxPrice}`} />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="市场均价" value={view_recommendation.avgPrice} precision={2} prefix="¥" />
                </Card>
              </Col>
              <Col span={6}>
                <Card>
                  <Statistic title="置信度" value={view_recommendation.confidence} suffix="%" valueStyle={{
                    color: view_recommendation.confidence >= 80 ? '#3f8600' : '#cf1322'
                  }} />
                </Card>
              </Col>
            </Row>

            <Card title="价格分析" style={{
              marginTop: 16
            }}>
              <Descriptions bordered column={2}>
                <Descriptions.Item label="产品名称">{view_recommendation.productName}</Descriptions.Item>
                <Descriptions.Item label="品类">{view_recommendation.categoryName}</Descriptions.Item>
                <Descriptions.Item label="价格趋势">
                  <Tag color={trendMap[view_recommendation.priceTrend]?.color}>
                    {trendMap[view_recommendation.priceTrend]?.text}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="价格变化">
                  <span style={{
                    color: view_recommendation.priceChange >= 0 ? '#3f8600' : '#cf1322'
                  }}>
                    {view_recommendation.priceChange >= 0 ? '+' : ''}{view_recommendation.priceChange} ({view_recommendation.priceChangePercent}%)
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="市场需求">{view_recommendation.marketDemand}</Descriptions.Item>
                <Descriptions.Item label="供应状态">{view_recommendation.supplyStatus}</Descriptions.Item>
                <Descriptions.Item label="定价建议" span={2}>{view_recommendation.suggestion}</Descriptions.Item>
              </Descriptions>
            </Card>
          </div>}
      </Card>

      <Card title="市场价格查询">
        <Space style={{
            marginBottom: 16
          }}>
          <span>产品名称：</span>
          <Input placeholder="请输入产品名称" value={productName.value} onChange={e => setProductName(e.target.value ?? '')} style={{
              width: 200
            }} />
          <Button type="primary" icon={<SearchOutlined />} loading={loading.value} onClick={handleSearchMarket}>
            查询市场价格
          </Button>
        </Space>

        {view_marketPrice && <Card style={{
            marginTop: 16
          }}>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="产品名称">{view_marketPrice.productName}</Descriptions.Item>
              <Descriptions.Item label="品类">{view_marketPrice.categoryName}</Descriptions.Item>
              <Descriptions.Item label="当前价格">¥{view_marketPrice.currentPrice}</Descriptions.Item>
              <Descriptions.Item label="昨日价格">¥{view_marketPrice.previousPrice}</Descriptions.Item>
              <Descriptions.Item label="价格变化">
                <span style={{
                  color: view_marketPrice.priceChange >= 0 ? '#3f8600' : '#cf1322'
                }}>
                  {view_marketPrice.priceChange >= 0 ? '+' : ''}{view_marketPrice.priceChange} ({view_marketPrice.priceChangePercent}%)
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="价格区间">
                ¥{view_marketPrice.minPrice} - ¥{view_marketPrice.maxPrice}
              </Descriptions.Item>
              <Descriptions.Item label="市场均价">¥{view_marketPrice.avgPrice}</Descriptions.Item>
              <Descriptions.Item label="成交量">{view_marketPrice.tradingVolume}</Descriptions.Item>
              <Descriptions.Item label="更新时间" span={2}>{view_marketPrice.updateTime}</Descriptions.Item>
            </Descriptions>
          </Card>}
      </Card>

      <Modal title="价格趋势（近7天）" open={trendVisible.value} onCancel={() => setTrendVisible(false)} footer={null} width={800}>
        <Table columns={trendColumns.value} dataSource={priceTrend.value} rowKey="date" pagination={false} />
      </Modal>
    </div>;
    };
  }
});
export default PriceList;
