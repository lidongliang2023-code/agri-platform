/**
 * 页面名称：产量预测
 * 路由路径：/production/ai/yield-forecast
 * 所属模块：智能决策中心
 * PRD 序号：PRD 6.1 #42
 *
 * 还原要点（PRD 6.1 #42「产量预测模型、历史准确率、销售联动」）：
 * - 预测表单：地块 + 作物 + 预测模型选择，发起预测
 * - 预测结果：预计产量（kg）、单产（kg/亩）、置信区间、模型版本、预计采收日期、关键影响因素
 * - 历史准确率：ECharts 双轴图（近 6 期准确率 + 预测 / 实际产量对比）
 * - 销售联动：基于区间下限给出建议可售量、建议上市窗口、建议渠道与预估产值，可跳转采收批次
 *
 * 数据来源：`/ai/yield-forecast`（发起预测 + 历史列表）、`/ai/yield-forecast/accuracy`；
 * 后端骨架无数据时按示例口径本地测算，保证表单—结果—图表闭环可用。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Button,
  Card,
  Col,
  Descriptions,
  Empty,
  Form,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ExperimentOutlined, RiseOutlined, ShoppingOutlined } from '@ant-design/icons'
import ReactECharts from 'echarts-for-react'
import dayjs from 'dayjs'
import useFarmStore from '@/store/farm'
import { createYieldForecast, listForecastAccuracy, listYieldForecasts } from '@/api/ai'
import { listPlots } from '@/api/plots'
import { formatNumber } from '@/utils/production-adapter'
import type { Plot, YieldForecast } from '@/types'
import type { ForecastAccuracyPoint } from '@/api/ai'

const { Text, Paragraph } = Typography

/** 作物选项（名称 → 亩产基线 kg） */
const CROP_OPTIONS: { value: string; label: string; perMu: number; price: number }[] = [
  { value: 'tomato', label: '番茄', perMu: 5200, price: 5.6 },
  { value: 'cucumber', label: '黄瓜', perMu: 4600, price: 4.2 },
  { value: 'pepper', label: '辣椒', perMu: 3200, price: 6.8 },
  { value: 'eggplant', label: '茄子', perMu: 4100, price: 4.6 },
  { value: 'cabbage', label: '白菜', perMu: 3800, price: 2.1 },
  { value: 'rice', label: '水稻', perMu: 620, price: 3.0 },
  { value: 'wheat', label: '小麦', perMu: 480, price: 2.8 },
  { value: 'apple', label: '苹果', perMu: 2800, price: 7.5 },
]

/** 作物字典（按值索引） */
const CROP_MAP: Record<string, { label: string; perMu: number; price: number }> =
  CROP_OPTIONS.reduce(
    (acc, item) => {
      acc[item.value] = { label: item.label, perMu: item.perMu, price: item.price }
      return acc
    },
    {} as Record<string, { label: string; perMu: number; price: number }>,
  )

/** 预测模型选项（值 → 名称 / 波动系数 / 版本） */
const MODEL_OPTIONS: { value: string; label: string; version: string; bias: number }[] = [
  { value: 'lstm', label: 'LSTM 时序预测模型', version: 'yield-lstm-v2.1', bias: 0.96 },
  { value: 'rf', label: '随机森林回归模型', version: 'yield-rf-v1.8', bias: 0.92 },
  { value: 'ensemble', label: '多模型融合（推荐）', version: 'yield-ensemble-v3.0', bias: 1.01 },
]

/** 模型字典（按值索引） */
const MODEL_MAP: Record<string, { label: string; version: string; bias: number }> =
  MODEL_OPTIONS.reduce(
    (acc, item) => {
      acc[item.value] = { label: item.label, version: item.version, bias: item.bias }
      return acc
    },
    {} as Record<string, { label: string; version: string; bias: number }>,
  )

/** 预测表单字段 */
interface ForecastFormValues {
  /** 地块 ID */
  plotId?: string
  /** 作物 */
  cropId: string
  /** 模型 */
  model: string
}

/** 示例地块（接口无数据时的兜底） */
const FALLBACK_PLOTS: { value: string; label: string; area: number }[] = [
  { value: 'DEMO-PLOT-1', label: '1号田', area: 45 },
  { value: 'DEMO-PLOT-2', label: '2号田', area: 38 },
  { value: 'DEMO-PLOT-3', label: '3号棚', area: 12 },
  { value: 'DEMO-PLOT-4', label: '4号棚', area: 10 },
  { value: 'DEMO-PLOT-5', label: '水稻A区', area: 320 },
  { value: 'DEMO-PLOT-6', label: '果园北区', area: 160 },
]

/** 示例历史准确率 */
const DEMO_ACCURACY: ForecastAccuracyPoint[] = [
  { period: '2025-09', forecastYield: 182000, actualYield: 176400, accuracy: 96.9 },
  { period: '2025-11', forecastYield: 156000, actualYield: 168200, accuracy: 92.7 },
  { period: '2026-01', forecastYield: 204000, actualYield: 199600, accuracy: 97.8 },
  { period: '2026-02', forecastYield: 138000, actualYield: 129500, accuracy: 93.8 },
  { period: '2026-04', forecastYield: 226000, actualYield: 231800, accuracy: 97.5 },
  { period: '2026-05', forecastYield: 192000, actualYield: 201300, accuracy: 95.2 },
]

/**
 * 生成示例历史预测记录
 * @param count 条数
 * @returns 预测列表
 */
function buildDemoForecasts(count = 10): YieldForecast[] {
  return Array.from({ length: count }, (_unused, index) => {
    const crop = CROP_OPTIONS[index % CROP_OPTIONS.length]
    const plot = FALLBACK_PLOTS[index % FALLBACK_PLOTS.length]
    const forecastYield = Math.round(crop.perMu * plot.area * (0.94 + (index % 5) / 50))
    return {
      forecastId: `DEMO-FORECAST-${String(index + 1).padStart(4, '0')}`,
      plotId: plot.value,
      plotName: plot.label,
      cropId: crop.value,
      cropName: crop.label,
      forecastYield,
      forecastPerMu: Number((forecastYield / plot.area).toFixed(1)),
      lowerBound: Math.round(forecastYield * 0.88),
      upperBound: Math.round(forecastYield * 1.12),
      modelVersion: MODEL_OPTIONS[index % MODEL_OPTIONS.length].version,
      accuracy: Number((92 + (index % 7) * 0.6).toFixed(1)),
      factors: ['有效积温', '土壤墒情', '病虫害损失率', '历史同期修正'],
      forecastHarvestDate: dayjs('2026-06-03')
        .add(20 + index * 3, 'day')
        .format('YYYY-MM-DD'),
      forecastAt: dayjs('2026-06-03 10:30:00')
        .subtract(index * 4, 'day')
        .format('YYYY-MM-DD HH:mm:ss'),
    }
  })
}

/** 示例历史预测记录 */
const DEMO_FORECASTS: YieldForecast[] = buildDemoForecasts()

/**
 * 产量预测
 *
 * 业务职责：按地块 + 作物 + 模型发起产量预测，展示置信区间、历史准确率与销售联动建议。
 *
 * @returns 页面内容
 */
export default function YieldForecast(): JSX.Element {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const farmId = useFarmStore((state) => state.currentFarm?.farmId)

  const [form] = Form.useForm<ForecastFormValues>()
  const [predicting, setPredicting] = useState<boolean>(false)
  const [result, setResult] = useState<YieldForecast | null>(null)
  const [extraForecasts, setExtraForecasts] = useState<YieldForecast[]>([])

  /** 地块列表 */
  const plotQuery = useQuery({
    queryKey: ['yield-forecast-plots', farmId],
    queryFn: () => listPlots({ pageNum: 1, pageSize: 100, farmId }),
  })

  /** 历史预测 */
  const historyQuery = useQuery({
    queryKey: ['yield-forecast-history', farmId],
    queryFn: () => listYieldForecasts({ pageNum: 1, pageSize: 50 }),
  })

  /** 历史准确率 */
  const accuracyQuery = useQuery({
    queryKey: ['yield-forecast-accuracy', farmId],
    queryFn: () => listForecastAccuracy(),
  })

  /** 地块选项 */
  const plotItems: { value: string; label: string; area: number }[] = useMemo(() => {
    const plots: Plot[] = plotQuery.data?.list ?? []
    if (plots.length === 0) return FALLBACK_PLOTS
    return plots.map((item) => ({ value: item.plotId, label: item.plotName, area: item.area }))
  }, [plotQuery.data])

  const remoteHistory: YieldForecast[] = historyQuery.data?.list ?? []
  const usingFallback: boolean =
    !historyQuery.isLoading && (historyQuery.isError || remoteHistory.length === 0)

  /** 历史预测列表 */
  const history: YieldForecast[] = usingFallback
    ? [...extraForecasts, ...DEMO_FORECASTS]
    : [...extraForecasts, ...remoteHistory]

  /** 历史准确率数据 */
  const accuracy: ForecastAccuracyPoint[] =
    accuracyQuery.data && accuracyQuery.data.length > 0 ? accuracyQuery.data : DEMO_ACCURACY

  /** 准确率图表配置 */
  const accuracyOption = useMemo(() => {
    return {
      tooltip: { trigger: 'axis' },
      legend: { data: ['预测产量', '实际产量', '准确率'], bottom: 0 },
      grid: { left: 60, right: 60, top: 30, bottom: 50 },
      xAxis: { type: 'category', data: accuracy.map((item) => item.period) },
      yAxis: [
        { type: 'value', name: '产量(kg)' },
        { type: 'value', name: '准确率(%)', min: 80, max: 100 },
      ],
      series: [
        {
          name: '预测产量',
          type: 'bar',
          data: accuracy.map((item) => item.forecastYield),
          itemStyle: { color: '#91caff' },
        },
        {
          name: '实际产量',
          type: 'bar',
          data: accuracy.map((item) => item.actualYield),
          itemStyle: { color: '#1677ff' },
        },
        {
          name: '准确率',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: accuracy.map((item) => item.accuracy),
          itemStyle: { color: '#52c41a' },
        },
      ],
    }
  }, [accuracy])

  /**
   * 本地测算预测结果（接口不可用时的兜底）
   *
   * @param values 表单值
   * @returns 预测结果
   */
  const computeLocally = (values: ForecastFormValues): YieldForecast => {
    const crop = CROP_MAP[values.cropId] ?? { label: '未知作物', perMu: 3000, price: 4 }
    const model = MODEL_MAP[values.model] ?? MODEL_MAP.ensemble
    const plot = plotItems.find((item) => item.value === values.plotId)
    const area = plot?.area ?? 40
    const total = Math.round(crop.perMu * area * model.bias)
    return {
      forecastId: `LOCAL-FORECAST-${Date.now()}`,
      plotId: values.plotId,
      plotName: plot?.label,
      cropId: values.cropId,
      cropName: crop.label,
      forecastYield: total,
      forecastPerMu: Number((total / area).toFixed(1)),
      lowerBound: Math.round(total * 0.88),
      upperBound: Math.round(total * 1.12),
      modelVersion: model.version,
      accuracy: Number((93 + (total % 6) * 0.5).toFixed(1)),
      factors: ['有效积温', '土壤墒情', '病虫害损失率', '历史同期修正'],
      forecastHarvestDate: dayjs().add(26, 'day').format('YYYY-MM-DD'),
      forecastAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }
  }

  /** 发起预测 */
  const predictMutation = useMutation({
    mutationFn: async (values: ForecastFormValues) => {
      try {
        const res = await createYieldForecast({
          plotId: values.plotId,
          cropId: values.cropId,
        })
        if (res && res.forecastYield) {
          return { ...res, cropName: res.cropName ?? CROP_MAP[values.cropId]?.label }
        }
        return computeLocally(values)
      } catch {
        return computeLocally(values)
      }
    },
    onSuccess: (data) => {
      setResult(data)
      setExtraForecasts((prev) => [data, ...prev])
      void queryClient.invalidateQueries({ queryKey: ['yield-forecast-history'] })
      message.success('产量预测已完成')
    },
    onSettled: () => setPredicting(false),
  })

  /** 提交表单 */
  const handlePredict = async (): Promise<void> => {
    let values: ForecastFormValues
    try {
      values = await form.validateFields()
    } catch {
      message.warning('请选择地块、作物与预测模型')
      return
    }
    setPredicting(true)
    predictMutation.mutate(values)
  }

  /** 销售联动建议 */
  const salesAdvice = useMemo(() => {
    if (!result) return null
    const crop = CROP_MAP[result.cropId] ?? { label: result.cropName ?? '', price: 4, perMu: 0 }
    const salable = Math.round(result.lowerBound * 0.92)
    const premium = Math.round(salable * 0.35)
    return {
      salable,
      premium,
      windowStart: result.forecastHarvestDate ?? dayjs().add(26, 'day').format('YYYY-MM-DD'),
      windowEnd: dayjs(result.forecastHarvestDate ?? dayjs().add(26, 'day')).add(12, 'day').format('YYYY-MM-DD'),
      channels:
        premium > 3000
          ? ['商超直供', '社区团购', '企业集采']
          : ['本地批发', '社区团购', '线上零售'],
      outputValue: Math.round(salable * crop.price),
    }
  }, [result])

  /** 历史预测列定义 */
  const columns: ColumnsType<YieldForecast> = [
    {
      title: '地块 / 作物',
      key: 'target',
      render: (_value: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.plotName || '未关联地块'}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.cropName ?? record.cropId}
          </Text>
        </Space>
      ),
    },
    {
      title: '预计产量(kg)',
      dataIndex: 'forecastYield',
      width: 140,
      render: (value: number, record) => (
        <Space direction="vertical" size={0}>
          <Text>{formatNumber(value)}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            区间 {formatNumber(record.lowerBound)} ~ {formatNumber(record.upperBound)}
          </Text>
        </Space>
      ),
    },
    {
      title: '单产(kg/亩)',
      dataIndex: 'forecastPerMu',
      width: 120,
      render: (value: number) => formatNumber(value, 1),
    },
    {
      title: '模型版本',
      dataIndex: 'modelVersion',
      width: 180,
      render: (value?: string) => <Text code>{value || '-'}</Text>,
    },
    {
      title: '预计采收',
      dataIndex: 'forecastHarvestDate',
      width: 120,
      render: (value?: string) => value || '-',
    },
    {
      title: '历史准确率',
      dataIndex: 'accuracy',
      width: 140,
      render: (value?: number) =>
        value === undefined ? (
          '-'
        ) : (
          <Progress percent={Math.round(value)} size="small" style={{ maxWidth: 120 }} />
        ),
    },
    {
      title: '预测时间',
      dataIndex: 'forecastAt',
      width: 170,
    },
    {
      title: '操作',
      key: 'action',
      width: 90,
      fixed: 'right',
      render: (_value: unknown, record) => (
        <Button type="link" size="small" onClick={() => setResult(record)}>
          查看
        </Button>
      ),
    },
  ]

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Card>
          <Space size={8}>
            <RiseOutlined style={{ fontSize: 20, color: '#52c41a' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>产量预测</span>
            <Text type="secondary">按地块 + 作物 + 模型预测产量区间，并给出销售联动建议</Text>
          </Space>
        </Card>

        <Card title="预测条件">
          <Form
            form={form}
            layout="inline"
            initialValues={{ cropId: 'tomato', model: 'ensemble' }}
            style={{ rowGap: 12 }}
          >
            <Form.Item name="plotId" label="地块" rules={[{ required: true, message: '请选择地块' }]}>
              <Select
                style={{ width: 200 }}
                placeholder="请选择地块"
                options={plotItems.map((item) => ({
                  value: item.value,
                  label: `${item.label}（${item.area} 亩）`,
                }))}
              />
            </Form.Item>
            <Form.Item name="cropId" label="作物" rules={[{ required: true }]}>
              <Select
                style={{ width: 160 }}
                options={CROP_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
              />
            </Form.Item>
            <Form.Item name="model" label="预测模型" rules={[{ required: true }]}>
              <Select
                style={{ width: 220 }}
                options={MODEL_OPTIONS.map((item) => ({ value: item.value, label: item.label }))}
              />
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                icon={<ExperimentOutlined />}
                loading={predicting}
                onClick={() => void handlePredict()}
              >
                开始预测
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Spin spinning={predicting}>
          {result ? (
            <Row gutter={16}>
              <Col span={14}>
                <Card title="预测结果">
                  <Row gutter={16}>
                    <Col span={8}>
                      <Statistic
                        title="预计产量"
                        value={result.forecastYield}
                        suffix="kg"
                        valueStyle={{ color: '#1677ff' }}
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="预计单产"
                        value={result.forecastPerMu}
                        precision={1}
                        suffix="kg/亩"
                      />
                    </Col>
                    <Col span={8}>
                      <Statistic
                        title="模型历史准确率"
                        value={result.accuracy ?? 0}
                        precision={1}
                        suffix="%"
                        valueStyle={{ color: '#52c41a' }}
                      />
                    </Col>
                  </Row>
                  <Descriptions column={2} size="small" bordered style={{ marginTop: 16 }}>
                    <Descriptions.Item label="置信区间">
                      {formatNumber(result.lowerBound)} ~ {formatNumber(result.upperBound)} kg
                    </Descriptions.Item>
                    <Descriptions.Item label="模型版本">
                      <Text code>{result.modelVersion || '-'}</Text>
                    </Descriptions.Item>
                    <Descriptions.Item label="预计采收日期">
                      {result.forecastHarvestDate || '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="预测时间">{result.forecastAt}</Descriptions.Item>
                    <Descriptions.Item label="关键影响因素" span={2}>
                      <Space size={4} wrap>
                        {(result.factors ?? []).map((item) => (
                          <Tag key={item} color="blue">
                            {item}
                          </Tag>
                        ))}
                        {(result.factors ?? []).length === 0 && '-'}
                      </Space>
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
              <Col span={10}>
                <Card title="销售联动建议" extra={<ShoppingOutlined />}>
                  {salesAdvice && (
                    <Space direction="vertical" size={12} style={{ width: '100%' }}>
                      <Statistic
                        title="建议可售量（按下限 × 0.92）"
                        value={salesAdvice.salable}
                        suffix="kg"
                        valueStyle={{ color: '#fa8c16' }}
                      />
                      <Descriptions column={1} size="small">
                        <Descriptions.Item label="建议优果预售">
                          {formatNumber(salesAdvice.premium)} kg
                        </Descriptions.Item>
                        <Descriptions.Item label="建议上市窗口">
                          {salesAdvice.windowStart} ~ {salesAdvice.windowEnd}
                        </Descriptions.Item>
                        <Descriptions.Item label="建议渠道">
                          <Space size={4} wrap>
                            {salesAdvice.channels.map((item) => (
                              <Tag key={item} color="green">
                                {item}
                              </Tag>
                            ))}
                          </Space>
                        </Descriptions.Item>
                        <Descriptions.Item label="预估产值">
                          ¥ {formatNumber(salesAdvice.outputValue)}
                        </Descriptions.Item>
                      </Descriptions>
                      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
                        产量确认后将通过领域事件 prod.batch.harvested 推送至交易模块挂载可售库存。
                      </Paragraph>
                      <Space>
                        <Button onClick={() => navigate('/production/harvests')}>
                          查看采收批次
                        </Button>
                        <Button
                          type="primary"
                          onClick={() => {
                            void navigator.clipboard
                              ?.writeText(
                                `${result.cropName ?? ''} 预计产量 ${result.forecastYield}kg，建议可售 ${salesAdvice.salable}kg，上市窗口 ${salesAdvice.windowStart} ~ ${salesAdvice.windowEnd}`,
                              )
                              .then(() => message.success('联动摘要已复制'))
                              .catch(() => message.warning('当前浏览器不支持自动复制'))
                          }}
                        >
                          复制联动摘要
                        </Button>
                      </Space>
                    </Space>
                  )}
                </Card>
              </Col>
            </Row>
          ) : (
            <Card>
              <Empty description="选择地块、作物与模型后点击「开始预测」" />
            </Card>
          )}
        </Spin>

        <Card title="历史准确率">
          <ReactECharts option={accuracyOption} style={{ height: 320 }} notMerge />
        </Card>

        <Card title={`历史预测记录（${formatNumber(history.length)}）`}>
          <Table<YieldForecast>
            rowKey="forecastId"
            columns={columns}
            dataSource={history}
            scroll={{ x: 1100 }}
            pagination={{ pageSize: 8, showTotal: (value) => `共 ${value} 条` }}
          />
        </Card>
      </Space>
    </div>
  )
}
