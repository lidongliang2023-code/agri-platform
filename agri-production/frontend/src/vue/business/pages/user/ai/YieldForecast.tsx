import { defineComponent, ref, shallowRef, computed, watch, watchEffect, onMounted, onBeforeUnmount, useId, type PropType, type VNodeChild, type CSSProperties } from 'vue';
type PortalEvent<T = HTMLElement> = Event & {
  target: T;
  currentTarget: T;
  nativeEvent: Event;
  key: string;
  shiftKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
};
import dayjs from 'dayjs';
import YieldMarketPrices from './YieldMarketPrices';
import type { MarketQuote } from '@/api/yield-forecast';
import { useMutation, useQuery, useQueryClient } from '@/vue/query';
import { Alert, App, Button, Card, Col, DatePicker, Descriptions, Divider, Empty, Form, Input, InputNumber, List, Row, Space, Statistic, Table, Tag, Typography } from '@/vue/ui';
import { LineChartOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons-vue';
import { PageContainer } from '@/vue/pro';
import { feedbackYieldForecast, getYieldForecast, inferYieldForecast, listYieldForecasts } from '@/api/yield-forecast';
import type { YieldForecastRequest, YieldForecastDetail } from '@/api/yield-forecast';
const YieldForecast = defineComponent({
  name: "YieldForecast",
  props: {},
  setup(__props: {}, {
    slots: __slots
  }) {
    const {
      message
    } = App.useApp();
    const [form] = Form.useForm<YieldForecastRequest & {
      harvestStart: dayjs.Dayjs;
      harvestEnd: dayjs.Dayjs;
    }>();
    const cropName = Form.useWatch('cropName', form);
    const selectedQuote = shallowRef<MarketQuote>();
    const setSelectedQuote = (next: typeof selectedQuote.value | ((previous: typeof selectedQuote.value) => typeof selectedQuote.value)) => {
      selectedQuote.value = typeof next === 'function' ? (next as (previous: typeof selectedQuote.value) => typeof selectedQuote.value)(selectedQuote.value) : next;
    };
    const current = shallowRef<YieldForecastDetail>();
    const setCurrent = (next: typeof current.value | ((previous: typeof current.value) => typeof current.value)) => {
      current.value = typeof next === 'function' ? (next as (previous: typeof current.value) => typeof current.value)(current.value) : next;
    };
    const client = useQueryClient();
    const history = useQuery(() => ({
      queryKey: ['yield-forecasts'],
      queryFn: () => listYieldForecasts({
        pageNum: 1,
        pageSize: 20
      })
    }));
    const loadDetail = async (id: string): Promise<void> => {
      setCurrent(await getYieldForecast(id));
    };
    const infer = useMutation(() => ({
      mutationFn: (values: YieldForecastRequest & {
        harvestStart: dayjs.Dayjs;
        harvestEnd: dayjs.Dayjs;
      }) => inferYieldForecast({
        ...values,
        marketQuoteId: selectedQuote.value?.cropName === (values.cropName === '番茄' ? '西红柿' : values.cropName === '马铃薯' ? '土豆' : values.cropName) ? selectedQuote.value.id : undefined,
        harvestStart: values.harvestStart.format('YYYY-MM-DD'),
        harvestEnd: values.harvestEnd.format('YYYY-MM-DD'),
        forecastDate: dayjs().format('YYYY-MM-DD'),
        dataCutoff: dayjs().format('YYYY-MM-DD')
      }),
      onSuccess: row => {
        setCurrent(row);
        void client.invalidateQueries({
          queryKey: ['yield-forecasts']
        });
        message.success('预测与销售建议已保存为可追溯快照');
      },
      onError: (e: Error) => message.error(e.message)
    }));
    const feedback = useMutation(() => ({
      mutationFn: (values: {
        actualQuantity: number;
        unit: string;
        actualDate: string;
        note?: string;
      }) => feedbackYieldForecast(current.value!.id, values),
      onSuccess: row => {
        setCurrent(row);
        void client.invalidateQueries({
          queryKey: ['yield-forecasts']
        });
        message.success('实际采收已回填，偏差已留痕');
      },
      onError: (e: Error) => message.error(e.message)
    }));
    return () => {
      const _currentSnapshot = current.value;
      return <PageContainer title="产量预估与销售时机建议" subTitle="长势与气象输入 · 产量区间预测 · 分批出货建议 · 实际采收回填">
    <Space direction="vertical" size={20} style={{
          width: '100%'
        }}>
      <Card class="yield-hero"><Space align="start"><LineChartOutlined style={{
                fontSize: 30,
                color: '#0b6379'
              }} /><div><Tag color="blue">AI 农技助手 · 场景 49</Tag><Typography.Title level={3} style={{
                  margin: '8px 0'
                }}>融合真实输入生成可追溯的产量区间和销售建议</Typography.Title><Typography.Text>建议只作为决策参考，实际采收由采收台账记录，订单和交易仍由产销对接模块负责。</Typography.Text></div></Space></Card>
      <Row gutter={[20, 20]}>
        <Col xs={24} xl={9}><Card title="① 输入与数据" extra={<Tag color="green">INPUT</Tag>}><Form form={form} layout="vertical" onFinish={values => infer.mutate(values)} initialValues={{
                  harvestStart: dayjs().add(14, 'day'),
                  harvestEnd: dayjs().add(35, 'day'),
                  areaMu: 10,
                  historyYield: 1000,
                  ndviScore: 1,
                  weatherFactor: 1,
                  shipmentBatches: 2
                }} disabled={infer.isPending}>
          <Form.Item name="cropName" label="作物" rules={[{
                    required: true,
                    message: '请填写作物'
                  }]}><Input placeholder="例如：番茄" /></Form.Item>
          <Form.Item name="cropVariety" label="品种"><Input placeholder="可选，例如：普罗旺斯" /></Form.Item>
          <Row gutter={10}><Col span={12}><Form.Item name="areaMu" label="种植面积（亩）" rules={[{
                        required: true
                      }]}><InputNumber min={0.01} style={{
                          width: '100%'
                        }} /></Form.Item></Col><Col span={12}><Form.Item name="historyYield" label="历史/基准亩产（kg）" rules={[{
                        required: true
                      }]}><InputNumber min={0.01} style={{
                          width: '100%'
                        }} /></Form.Item></Col></Row>
          <Row gutter={10}><Col span={12}><Form.Item name="ndviScore" label="长势系数"><InputNumber min={0} max={1.2} step={0.01} style={{
                          width: '100%'
                        }} /></Form.Item></Col><Col span={12}><Form.Item name="weatherFactor" label="天气修正系数"><InputNumber min={0.7} max={1.2} step={0.01} style={{
                          width: '100%'
                        }} /></Form.Item></Col></Row>
          <Row gutter={10}><Col span={12}><Form.Item name="harvestStart" label="预计采收开始" rules={[{
                        required: true
                      }]}><DatePicker style={{
                          width: '100%'
                        }} /></Form.Item></Col><Col span={12}><Form.Item name="harvestEnd" label="预计采收结束" rules={[{
                        required: true
                      }]}><DatePicker style={{
                          width: '100%'
                        }} /></Form.Item></Col></Row>
          <Alert showIcon type={selectedQuote.value && (selectedQuote.value.cropName === cropName.value || cropName.value === '番茄' && selectedQuote.value.cropName === '西红柿' || cropName.value === '马铃薯' && selectedQuote.value.cropName === '土豆') ? 'success' : 'info'} message={selectedQuote.value && (selectedQuote.value.cropName === cropName.value || cropName.value === '番茄' && selectedQuote.value.cropName === '西红柿' || cropName.value === '马铃薯' && selectedQuote.value.cropName === '土豆') ? `已选 ${selectedQuote.value.quoteDate} · ${selectedQuote.value.priceKg} 元/kg · ${selectedQuote.value.market}` : '可在下方真实行情中引用报价；不引用时只生成产量和批次参考，不填入价格。'} />
          {selectedQuote.value && <Button type="link" onClick={() => setSelectedQuote(undefined)}>取消行情引用</Button>}
          <Form.Item name="shipmentBatches" label="建议分批数"><InputNumber min={1} max={4} precision={0} style={{
                      width: '100%'
                    }} /></Form.Item>
          <Alert showIcon type="info" message="缺少面积或历史/基准亩产时拒绝生成，不使用固定样例数值。" /><Button block type="primary" htmlType="submit" loading={infer.isPending} icon={<LineChartOutlined />} style={{
                    marginTop: 16
                  }}>生成预测与销售建议</Button>
        </Form></Card></Col>
        <Col xs={24} xl={15}><Card title="③ 输出与动作" extra={<Button icon={<ReloadOutlined />} onClick={() => void history.refetch()}>刷新历史</Button>}>{_currentSnapshot ? <ForecastResult current={_currentSnapshot} feedback={feedback} /> : <Empty description="填写真实输入后生成预测快照" />}</Card></Col>
      </Row>
      <YieldMarketPrices crop={cropName.value ?? ''} onSelect={setSelectedQuote} />
      <Card title="分析结果" extra={<Tag color="blue">本次预测快照</Tag>}><Table size="middle" rowKey="id" dataSource={history.data?.list ?? []} pagination={false} locale={{
              emptyText: <Empty description="暂无预测记录" />
            }} columns={[{
              title: '作物 / 品种',
              render: (_, r) => `${String(r.crop_name ?? '')} · ${String(r.crop_variety ?? '—')}`
            }, {
              title: '预测日',
              dataIndex: 'forecast_date'
            }, {
              title: '采收期',
              render: (_, r) => `${String(r.harvest_start)} 至 ${String(r.harvest_end)}`
            }, {
              title: '数据截止',
              dataIndex: 'data_cutoff'
            }, {
              title: '状态',
              dataIndex: 'status',
              render: v => <Tag color={v === 'ACTIVE' ? 'green' : 'default'}>{v === 'ACTIVE' ? '有效' : '已失效'}</Tag>
            }, {
              title: '操作',
              render: (_, r) => <Button type="link" onClick={() => void loadDetail(String(r.id))}>查看结果</Button>
            }]} /></Card>
      <Alert type="warning" showIcon message="规则与边界" description="早期预测必须标注仅供参考；建议标注数据截止时间和有效期，不替代农户自主决策；不与平台自营采购形成未披露利益冲突；跨周未更新自动失效。产量建议不修改采收台账、不创建订单，实际采收和销售结果回到原业务模块。" />
      <Row gutter={[20, 20]}><Col xs={24} md={8}><Card title="使用角色 / 适用对象">种植户、合作社、经纪人，以及负责订单锁量的合作社销售。</Card></Col><Col xs={24} md={8}><Card title="业务价值">把地块长势、天气、历史产量和价格区间放在同一份快照中，减少集中上市和惜售风险。</Card></Col><Col xs={24} md={8}><Card title="依赖组件 / 关联模块">地块档案、天气预报、采收台账、行情数据、仓储损耗、产销对接；预测每周更新。</Card></Col></Row>
    </Space>
  </PageContainer>;
    };
  }
});
export default YieldForecast;
const ForecastResult = defineComponent({
  name: "ForecastResult",
  props: {
    current: null as unknown as PropType<{
      current: YieldForecastDetail;
      feedback: {
        isPending: boolean;
        mutate: (value: {
          actualQuantity: number;
          unit: string;
          actualDate: string;
          note?: string;
        }) => void;
      };
    }["current"]>,
    feedback: null as unknown as PropType<{
      current: YieldForecastDetail;
      feedback: {
        isPending: boolean;
        mutate: (value: {
          actualQuantity: number;
          unit: string;
          actualDate: string;
          note?: string;
        }) => void;
      };
    }["feedback"]>
  },
  setup(__props: {
    current: YieldForecastDetail;
    feedback: {
      isPending: boolean;
      mutate: (value: {
        actualQuantity: number;
        unit: string;
        actualDate: string;
        note?: string;
      }) => void;
    };
  }, {
    slots: __slots
  }) {
    const actual = shallowRef('');
    const setActual = (next: typeof actual.value | ((previous: typeof actual.value) => typeof actual.value)) => {
      actual.value = typeof next === 'function' ? (next as (previous: typeof actual.value) => typeof actual.value)(actual.value) : next;
    };
    const result = computed(() => __props.current.result);
    return () => {
      return <Space direction="vertical" style={{
        width: '100%'
      }} size={16}><Space wrap><Tag color={result.value.earlyReferenceOnly ? 'orange' : 'green'}>{result.value.earlyReferenceOnly ? '早期预估，仅供参考' : '当前预测有效'}</Tag><Typography.Text type="secondary">数据截止：{__props.current.dataCutoff} · 有效至：{__props.current.validUntil}</Typography.Text></Space><Row gutter={12}><Col span={8}><Statistic title="预估总产量" value={result.value.predictedTotal} suffix="kg" /></Col><Col span={8}><Statistic title="区间下限" value={result.value.lowerTotal} suffix="kg" /></Col><Col span={8}><Statistic title="区间上限" value={result.value.upperTotal} suffix="kg" /></Col></Row><Descriptions bordered size="small" column={1} items={[{
          key: 'harvest',
          label: '采收窗口',
          children: `${result.value.harvestStart} 至 ${result.value.harvestEnd}`
        }, {
          key: 'price',
          label: result.value.priceKind === 'OBSERVED_WHOLESALE_PRICE' ? '引用历史批发价' : '价格依据',
          children: result.value.priceKind === 'OBSERVED_WHOLESALE_PRICE' ? `${result.value.priceLow} 元/kg` : result.value.priceLow
        }, {
          key: 'reason',
          label: '说明',
          children: result.value.notice
        }]} />{result.value.priceNotice && <Alert type="info" showIcon message={result.value.priceNotice} />}{result.value.marketEvidence?.id && <Descriptions bordered size="small" column={1} items={[{
          key: 'market',
          label: '行情市场',
          children: `${result.value.marketEvidence.market} · ${result.value.marketEvidence.region}`
        }, {
          key: 'date',
          label: '报价日期',
          children: result.value.marketEvidence.quoteDate
        }, {
          key: 'original',
          label: '原始单位',
          children: `${result.value.marketEvidence.originalPrice} ${result.value.marketEvidence.originalUnit}`
        }, {
          key: 'source',
          label: '出处',
          children: <Typography.Link href={result.value.marketEvidence.sourceUrl} target="_blank" rel="noopener noreferrer">官方报告</Typography.Link>
        }]} />}<Card size="small" title="分批出货参考"><List size="small" dataSource={result.value.shipments} renderItem={item => <List.Item><List.Item.Meta title={`第 ${item.sequence} 批 · ${Math.round(item.ratio * 100)}% · ${item.quantity} kg · ${item.suggestedDate}`} description={item.reason} /></List.Item>} /></Card><Divider orientation="left">实际采收回填</Divider><Space><InputNumber min={0.01} value={actual.value ? Number(actual.value) : undefined} onChange={v => setActual(v == null ? '' : String(v))} placeholder="实际采收量" /><Button type="primary" icon={<SendOutlined />} disabled={!actual.value} loading={__props.feedback.isPending} onClick={() => __props.feedback.mutate({
            actualQuantity: Number(actual.value),
            unit: 'kg',
            actualDate: dayjs().format('YYYY-MM-DD')
          })}>回填并记录偏差</Button></Space>{__props.current.feedback?.length > 0 && <Typography.Text type="secondary">已回填 {__props.current.feedback.length} 次，详见记录留痕。</Typography.Text>}</Space>;
    };
  }
});
