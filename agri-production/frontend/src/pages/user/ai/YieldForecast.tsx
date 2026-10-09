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
 * 数据来源：`POST /ai/yield-forecast`（发起预测）、`GET /ai/yield-forecast`（历史列表）、
 * `GET /ai/yield-forecast/accuracy`（历史准确率）。
 *
 * ⚠️ 数据来源纪律（不可回退）：
 * 1. 地块下拉在 `/plots` 返回空时显示空态 + 「暂无地块，请先建档」，**不再编造 6 个示例地块**。
 * 2. 历史准确率接口无数据 / 不可用时，展示空态与明确提示，**不再用 6 期示例准确率渲染图表**。
 * 3. 历史预测记录只取服务端列表，**不再生成 10 条示例记录**。
 * 4. 预测接口失败或服务端未返回 `forecastYield` 时**直接报错**，
 *    **不再用「亩产基线 × 面积 × 模型系数」本地测算**并弹「预测已完成」；
 *    销售联动建议同理，不再按本地比例换算可售量 / 产值。
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  App as AntdApp,
  Alert,
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
import useFarmStore from '@/store/farm'
import { createYieldForecast, listForecastAccuracy, listYieldForecasts } from '@/api/ai'
import { listPlots } from '@/api/plots'
import { formatNumber } from '@/utils/production-adapter'
import type { Plot, YieldForecast } from '@/types'
import type { ForecastAccuracyPoint } from '@/api/ai'

const { Text } = Typography

/** 服务端未提供该字段时的统一占位文案 */
const NOT_PROVIDED = '服务端未提供'

/**
 * 作物选择项（仅 id → 名称的选择字典）
 *
 * ⚠️ 此前该表还携带「亩产基线 / 单价」用于本地测算产量与产值，
 * 属于把编造的业务数字当成服务端结论展示，已全部移除。
 */
const CROP_OPTIONS: { value: string; label: string }[] = [
  { value: 'tomato', label: '番茄' },
  { value: 'cucumber', label: '黄瓜' },
  { value: 'pepper', label: '辣椒' },
  { value: 'eggplant', label: '茄子' },
  { value: 'cabbage', label: '白菜' },
  { value: 'rice', label: '水稻' },
  { value: 'wheat', label: '小麦' },
  { value: 'apple', label: '苹果' },
]

/** 作物字典（按值索引） */
const CROP_LABEL: Record<string, string> = CROP_OPTIONS.reduce(
  (acc, item) => {
    acc[item.value] = item.label
    return acc
  },
  {} as Record<string, string>,
)

/** 预测模型选项（选择项字典；模型能力以服务端返回为准） */
const MODEL_OPTIONS: { value: string; label: string; version: string }[] = [
  { value: 'lstm', label: 'LSTM 时序预测模型', version: 'yield-lstm-v2.1' },
  { value: 'rf', label: '随机森林回归模型', version: 'yield-rf-v1.8' },
  { value: 'ensemble', label: '多模型融合（推荐）', version: 'yield-ensemble-v3.0' },
]

/** 预测表单字段 */
interface ForecastFormValues {
  /** 地块 ID */
  plotId?: string
  /** 作物 */
  cropId: string
  /** 模型 */
  model: string
}

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
  /** 预测失败原因（接口失败 / 服务端未返回预测产量） */
  const [predictError, setPredictError] = useState<string>('')
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

  /** 历史准确率（接口不可用时会抛出，由页面显式提示，不再回落示例数据） */
  const accuracyQuery = useQuery({
    queryKey: ['yield-forecast-accuracy', farmId],
    queryFn: () => listForecastAccuracy(),
    retry: false,
  })

  /**
   * 地块选项
   *
   * `/plots` 返回空时返回空数组（空态），**不编造任何地块**。
   */
  const plotItems: { value: string; label: string; area: number }[] = useMemo(() => {
    const plots: Plot[] = plotQuery.data?.list ?? []
    return plots.map((item) => ({ value: item.plotId, label: item.plotName, area: item.area }))
  }, [plotQuery.data])

  /** 地块列表已加载完成且为空 */
  const plotsEmpty: boolean = !plotQuery.isLoading && plotItems.length === 0

  const remoteHistory: YieldForecast[] = historyQuery.data?.list ?? []

  /** 历史预测列表：服务端列表 + 本次会话内服务端返回的新增记录 */
  const history: YieldForecast[] = useMemo(
    () => [...extraForecasts, ...remoteHistory],
    [extraForecasts, remoteHistory],
  )

  /** 历史准确率数据（只取服务端返回值） */
  const accuracy: ForecastAccuracyPoint[] = accuracyQuery.data ?? []

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

  /** 发起预测：只接受服务端结果，失败即报错，不做本地测算兜底 */
  const predictMutation = useMutation({
    mutationFn: async (values: ForecastFormValues) => {
      const res = await createYieldForecast({
        plotId: values.plotId,
        cropId: values.cropId,
      })
      if (!res || typeof res.forecastYield !== 'number' || !Number.isFinite(res.forecastYield)) {
        throw new Error('服务端未返回预测产量（forecastYield）')
      }
      return { ...res, cropName: res.cropName ?? CROP_LABEL[values.cropId] }
    },
    onSuccess: (data) => {
      setPredictError('')
      setResult(data)
      setExtraForecasts((prev) => [data, ...prev])
      void queryClient.invalidateQueries({ queryKey: ['yield-forecast-history'] })
      message.success('产量预测已完成（结果来自服务端）')
    },
    onError: (error: Error) => {
      setResult(null)
      setPredictError(
        `产量预测失败：${error?.message || '接口不可用'}。` +
          '未生成任何预测结果（不会用本地测算值代替，避免给出与服务端不符的产量结论）。',
      )
      message.error('产量预测失败，请稍后重试')
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
    setPredictError('')
    setPredicting(true)
    predictMutation.mutate(values)
  }

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
            {record.lowerBound === undefined || record.upperBound === undefined
              ? `区间 ${NOT_PROVIDED}`
              : `区间 ${formatNumber(record.lowerBound)} ~ ${formatNumber(record.upperBound)}`}
          </Text>
        </Space>
      ),
    },
    {
      title: '单产(kg/亩)',
      dataIndex: 'forecastPerMu',
      width: 120,
      render: (value?: number) =>
        value === undefined ? (
          <Text type="secondary">{NOT_PROVIDED}</Text>
        ) : (
          formatNumber(value, 1)
        ),
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
          <Text type="secondary">{NOT_PROVIDED}</Text>
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
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {plotsEmpty && (
              <Alert
                type="warning"
                showIcon
                message="暂无地块，请先建档"
                description="服务端 /plots 未返回任何地块数据。请先在「农场档案 · 地块管理」完成地块建档后再发起预测；此处不会用示例地块代替。"
              />
            )}
            <Form
              form={form}
              layout="inline"
              initialValues={{ cropId: 'tomato', model: 'ensemble' }}
              style={{ rowGap: 12 }}
            >
              <Form.Item name="plotId" label="地块" rules={[{ required: true, message: '请选择地块' }]}>
                <Select
                  style={{ width: 200 }}
                  placeholder={plotsEmpty ? '暂无地块，请先建档' : '请选择地块'}
                  notFoundContent={plotQuery.isLoading ? '加载中…' : '暂无地块'}
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
                  options={MODEL_OPTIONS.map((item) => ({
                    value: item.value,
                    label: item.label,
                  }))}
                />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  icon={<ExperimentOutlined />}
                  loading={predicting}
                  disabled={plotsEmpty}
                  onClick={() => void handlePredict()}
                >
                  开始预测
                </Button>
              </Form.Item>
            </Form>
          </Space>
        </Card>

        <Spin spinning={predicting}>
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            {predictError && (
              <Alert type="error" showIcon message="产量预测未完成" description={predictError} />
            )}
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
                        {result.forecastPerMu === undefined ? (
                          <>
                            <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>预计单产</div>
                            <div style={{ fontSize: 24, color: 'rgba(0,0,0,0.45)' }}>
                              {NOT_PROVIDED}
                            </div>
                          </>
                        ) : (
                          <Statistic
                            title="预计单产"
                            value={result.forecastPerMu}
                            precision={1}
                            suffix="kg/亩"
                          />
                        )}
                      </Col>
                      <Col span={8}>
                        {result.accuracy === undefined ? (
                          <>
                            <div style={{ color: 'rgba(0,0,0,0.45)', fontSize: 14 }}>
                              模型历史准确率
                            </div>
                            <div style={{ fontSize: 24, color: 'rgba(0,0,0,0.45)' }}>
                              {NOT_PROVIDED}
                            </div>
                          </>
                        ) : (
                          <Statistic
                            title="模型历史准确率"
                            value={result.accuracy}
                            precision={1}
                            suffix="%"
                            valueStyle={{ color: '#52c41a' }}
                          />
                        )}
                      </Col>
                    </Row>
                    <Descriptions column={2} size="small" bordered style={{ marginTop: 16 }}>
                      <Descriptions.Item label="置信区间">
                        {result.lowerBound === undefined || result.upperBound === undefined
                          ? NOT_PROVIDED
                          : `${formatNumber(result.lowerBound)} ~ ${formatNumber(result.upperBound)} kg`}
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
                          {(result.factors ?? []).length === 0 && (
                            <Text type="secondary">{NOT_PROVIDED}</Text>
                          )}
                        </Space>
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Col>
                <Col span={10}>
                  <Card title="销售联动建议" extra={<ShoppingOutlined />}>
                    <Alert
                      type="warning"
                      showIcon
                      message="销售联动建议：未接入"
                      description="建议可售量、上市窗口、渠道与预估产值需要服务端提供置信区间、预计采收日期与渠道价格等字段。当前服务端未返回这些数据，为避免给出与事实不符的经营结论，此处不做任何本地比例换算。"
                    />
                    <div style={{ marginTop: 12 }}>
                      <Button onClick={() => navigate('/production/harvests')}>
                        查看采收批次
                      </Button>
                    </div>
                  </Card>
                </Col>
              </Row>
            ) : (
              !predictError && (
                <Card>
                  <Empty description="选择地块、作物与模型后点击「开始预测」" />
                </Card>
              )
            )}
          </Space>
        </Spin>

        <Card title="历史准确率">
          {accuracyQuery.isError ? (
            <Alert
              type="error"
              showIcon
              message="历史准确率接口不可用"
              description="服务端 GET /ai/yield-forecast/accuracy 未接入或调用失败。此处不使用任何示例准确率渲染图表，图表区域保持为空。"
            />
          ) : accuracy.length === 0 ? (
            <Alert
              type="info"
              showIcon
              message="暂无历史准确率数据"
              description="服务端未返回历史准确率明细（period / forecastYield / actualYield / accuracy）。接口提供数据后图表将自动渲染。"
            />
          ) : (
            <ReactECharts option={accuracyOption} style={{ height: 320 }} notMerge />
          )}
        </Card>

        <Card title={`历史预测记录（${formatNumber(history.length)}）`}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {historyQuery.isError && (
              <Alert
                type="error"
                showIcon
                message="历史预测记录加载失败"
                description="服务端 GET /ai/yield-forecast 接口不可用，历史记录无法展示。此处不使用示例数据占位。"
              />
            )}
            <Table<YieldForecast>
              rowKey="forecastId"
              columns={columns}
              dataSource={history}
              scroll={{ x: 1100 }}
              locale={{
                emptyText: (
                  <Empty
                    description={
                      historyQuery.isLoading ? '加载中…' : '暂无历史预测记录（服务端无数据）'
                    }
                  />
                ),
              }}
              pagination={{ pageSize: 8, showTotal: (value) => `共 ${value} 条` }}
            />
          </Space>
        </Card>
      </Space>
    </div>
  )
}
