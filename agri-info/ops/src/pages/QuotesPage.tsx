import { useEffect, useState } from 'react'
import { Button, Drawer, Form, Input, InputNumber, Modal, Select, Switch, Table, Tabs, Tag, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { opsApi } from '../api'
import type { AlertRule, CollectTask, Forecast, PriceIndex, Quote, QuoteSource, QuotesAdmin } from '../types'
import {
  ChangePct,
  ErrorBlock,
  LoadingBlock,
  PageTitle,
  SectionHeading,
  Sparkline,
  StatTile,
  StatusTag,
  formatCount,
} from '../components/ui'

/**
 * 行情运营：报价维护、数据源与采集任务、价格指数、AI 预测、数据质量与预警规则。
 * 报价录入后立即影响用户端行情中心与预测输入，因此写操作全部记审计。
 */
export function QuotesPage(): JSX.Element {
  const [data, setData] = useState<QuotesAdmin | null>(null)
  const [error, setError] = useState('')
  const [quoteOpen, setQuoteOpen] = useState(false)
  const [editing, setEditing] = useState<Quote | null>(null)
  const [ruleOpen, setRuleOpen] = useState(false)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [form] = Form.useForm<Record<string, unknown>>()
  const [ruleForm] = Form.useForm<Record<string, unknown>>()

  const load = (): void => {
    setError('')
    opsApi.quotes().then(setData).catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const openQuote = (quote?: Quote): void => {
    setEditing(quote ?? null)
    form.setFieldsValue(quote
      ? {
          name: quote.name, price: quote.price, changePct: quote.changePct, changeAmount: quote.changeAmount,
          spec: quote.spec, monitorLevel: quote.monitorLevel, status: quote.status,
        }
      : { icon: '🌾', category: '蔬菜', priceUnit: '元/公斤', monitorLevel: 'normal', status: 'online' })
    setQuoteOpen(true)
  }

  const quoteColumns: ColumnsType<Quote> = [
    {
      title: '品种',
      dataIndex: 'name',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.icon} {record.name}</b>
          <span className="small muted">{record.code} · {record.origin}</span>
        </div>
      ),
    },
    { title: '市场', dataIndex: 'market', width: 190 },
    { title: '价格', dataIndex: 'price', width: 110, render: (value: number, record) => <b>{Number(value).toFixed(2)} <small className="muted">{record.priceUnit}</small></b> },
    { title: '涨跌幅', dataIndex: 'changePct', width: 90, render: (value: number) => <ChangePct value={value} /> },
    { title: '走势', dataIndex: 'trend', width: 100, render: (value: number[]) => <Sparkline points={value} /> },
    {
      title: '监测',
      dataIndex: 'monitorLevel',
      width: 90,
      render: (value: string) => <StatusTag status={value} />,
    },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
    { title: '更新时间', dataIndex: 'updatedAt', width: 140 },
    { title: '操作', width: 80, render: (_, record) => <Button size="small" onClick={() => openQuote(record)}>维护</Button> },
  ]

  const sourceColumns: ColumnsType<QuoteSource> = [
    { title: '数据源', dataIndex: 'name' },
    { title: '类型', dataIndex: 'sourceType', width: 110 },
    { title: '频率', dataIndex: 'frequency', width: 100 },
    { title: '采集点', dataIndex: 'pointCount', width: 100, render: (value: number) => formatCount(value) },
    { title: '错误率', dataIndex: 'errorRate', width: 100, render: (value: number) => `${Number(value).toFixed(2)}%` },
    { title: '最近同步', dataIndex: 'lastSync', width: 150 },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
  ]

  const taskColumns: ColumnsType<CollectTask> = [
    { title: '任务', dataIndex: 'name' },
    { title: '数据源', dataIndex: 'sourceName', width: 170 },
    { title: '调度', dataIndex: 'cron', width: 130 },
    { title: '最近执行', dataIndex: 'lastRun', width: 150 },
    { title: '行数', dataIndex: 'lastRows', width: 90 },
    { title: '耗时', dataIndex: 'durationMs', width: 90, render: (value: number) => `${value} ms` },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
    {
      title: '操作',
      width: 100,
      render: (_, record) => (
        <Button size="small" onClick={() => opsApi.runTask(record.id)
          .then((result) => { message.success(result.message); load() })
          .catch((reason: Error) => message.error(reason.message))}>
          立即执行
        </Button>
      ),
    },
  ]

  const indexColumns: ColumnsType<PriceIndex> = [
    {
      title: '指数',
      dataIndex: 'name',
      render: (_, record) => (
        <div className="table-title-cell">
          <b>{record.name}</b>
          <span className="small muted">{record.code} · 基期 {record.basePeriod}</span>
        </div>
      ),
    },
    { title: '类别', dataIndex: 'category', width: 100 },
    { title: '点位', dataIndex: 'value', width: 100, render: (value: number) => Number(value).toFixed(2) },
    { title: '涨跌幅', dataIndex: 'changePct', width: 90, render: (value: number) => <ChangePct value={value} /> },
    { title: '样本', dataIndex: 'sampleCount', width: 80 },
    { title: '走势', dataIndex: 'trend', width: 100, render: (value: number[]) => <Sparkline points={value} /> },
    { title: '状态', dataIndex: 'status', width: 90, render: (value: string) => <StatusTag status={value} /> },
  ]

  const forecastColumns: ColumnsType<Forecast> = [
    {
      title: '预测对象',
      dataIndex: 'quoteId',
      render: (value: number) => {
        const quote = data?.quotes.find((item) => item.id === value)
        return <b>{quote ? `${quote.icon} ${quote.name}（${quote.origin}）` : `#${value}`}</b>
      },
    },
    { title: '周期', dataIndex: 'horizon', width: 80 },
    {
      title: '预测中值',
      dataIndex: 'midPrice',
      width: 160,
      render: (value: number, record) => (
        <span>{Number(value).toFixed(2)} <small className="muted">[{Number(record.lowPrice).toFixed(2)}, {Number(record.highPrice).toFixed(2)}]</small></span>
      ),
    },
    { title: '上涨概率', dataIndex: 'upProbability', width: 100, render: (value: number) => <ChangePct value={value} digits={1} /> },
    { title: '置信度', dataIndex: 'confidence', width: 90, render: (value: number) => `${value}%` },
    { title: 'MAPE', dataIndex: 'mape', width: 90, render: (value: number) => `${Number(value).toFixed(2)}%` },
    { title: '更新时间', dataIndex: 'updatedAt', width: 140 },
    { title: '操作', width: 80, render: (_, record) => <Button size="small" onClick={() => setForecast(record)}>查看</Button> },
  ]

  const ruleColumns: ColumnsType<AlertRule> = [
    { title: '规则', dataIndex: 'ruleName' },
    { title: '对象', dataIndex: 'quoteName', width: 160 },
    { title: '条件', dataIndex: 'threshold', width: 180, render: (_, record) => `${record.metric} ${record.operator} ${Number(record.threshold).toFixed(2)}` },
    { title: '触达', dataIndex: 'channel', width: 150 },
    { title: '命中', dataIndex: 'hitCount', width: 80 },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (value: boolean, record) => (
        <Switch
          size="small"
          checked={value}
          onChange={(checked) => opsApi.saveAlertRule({ id: record.id, ruleName: record.ruleName, metric: record.metric, operator: record.operator, threshold: record.threshold, channel: record.channel, enabled: checked })
            .then((result) => { message.success(result.message); load() })
            .catch((reason: Error) => message.error(reason.message))}
        />
      ),
    },
  ]

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="MARKET OPERATIONS"
        title="行情与采集"
        description="报价录入、数据源调度、指数编制与 AI 预测统一维护 · 数据质量规则实时拦截异常值"
        actions={
          <>
            <Button onClick={() => setRuleOpen(true)}>＋ 预警规则</Button>
            <Button type="primary" onClick={() => openQuote()}>＋ 新增监测品种</Button>
          </>
        }
      />

      <div className="grid-4">
        <StatTile label="监测品种" value={data.quotes.length} unit="个" note={`在线 ${data.quotes.filter((item) => item.status === 'online').length} 个`} />
        <StatTile label="数据源" value={data.sources.length} unit="个" note={`正常 ${data.sources.filter((item) => item.status === 'success').length} 个`} tone="up" />
        <StatTile label="数据可用率" value={data.quality.availableRate} unit="%" note={`拦截 ${data.quality.blockedRows} 行`} tone="up" />
        <StatTile label="采集任务" value={data.tasks.length} unit="个" note={`运行中 ${data.tasks.filter((item) => item.status === 'success').length} 个`} />
      </div>

      <section className="surface-card">
        <Tabs
          defaultActiveKey="quotes"
          items={[
            {
              key: 'quotes',
              label: `报价维护（${data.quotes.length}）`,
              children: <Table rowKey="id" size="middle" columns={quoteColumns} dataSource={data.quotes} pagination={false} scroll={{ x: 1080 }} />,
            },
            {
              key: 'sources',
              label: `数据源（${data.sources.length}）`,
              children: <Table rowKey="id" size="middle" columns={sourceColumns} dataSource={data.sources} pagination={false} />,
            },
            {
              key: 'tasks',
              label: `采集任务（${data.tasks.length}）`,
              children: <Table rowKey="id" size="middle" columns={taskColumns} dataSource={data.tasks} pagination={false} />,
            },
            {
              key: 'indices',
              label: `价格指数（${data.indices.length}）`,
              children: <Table rowKey="id" size="middle" columns={indexColumns} dataSource={data.indices} pagination={false} />,
            },
            {
              key: 'forecasts',
              label: `AI 预测（${data.forecasts.length}）`,
              children: <Table rowKey="id" size="middle" columns={forecastColumns} dataSource={data.forecasts} pagination={false} scroll={{ x: 1080 }} />,
            },
            {
              key: 'quality',
              label: '数据质量',
              children: (
                <div className="stack">
                  <div className="grid-4">
                    <StatTile label="可用率" value={data.quality.availableRate} unit="%" tone="up" />
                    <StatTile label="拦截行数" value={data.quality.blockedRows} unit="行" note="价格偏离中位数 ±30%" tone="warn" />
                    <StatTile label="去重行数" value={data.quality.duplicateRows} unit="行" note="同品种同市场重复报价" />
                    <StatTile label="补全行数" value={data.quality.missingRows} unit="行" note="单位与规格缺失" />
                  </div>
                  <Table
                    rowKey="name"
                    size="middle"
                    pagination={false}
                    dataSource={data.quality.rules}
                    columns={[
                      { title: '规则', dataIndex: 'name' },
                      { title: '处置', dataIndex: 'level', width: 110, render: (value: string) => <Tag className="soft-tag tone-amber">{value}</Tag> },
                      { title: '命中次数', dataIndex: 'hit', width: 120 },
                    ]}
                  />
                </div>
              ),
            },
            {
              key: 'rules',
              label: `预警规则（${data.rules.length}）`,
              children: <Table rowKey="id" size="middle" columns={ruleColumns} dataSource={data.rules} pagination={false} />,
            },
          ]}
        />
      </section>

      <Modal
        open={quoteOpen}
        title={editing ? `维护行情：${editing.name}` : '新增监测品种'}
        onCancel={() => setQuoteOpen(false)}
        onOk={() => form.submit()}
        okText="保存"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) => {
            opsApi.saveQuote({ ...values, id: editing?.id })
              .then((result) => {
                message.success(result.message)
                setQuoteOpen(false)
                load()
              })
              .catch((reason: Error) => message.error(reason.message))
          }}
        >
          <div className="form-grid">
            <Form.Item name="name" label="品种名称" rules={[{ required: true, message: '请填写品种名称' }]}>
              <Input placeholder="例：大蒜" />
            </Form.Item>
            <Form.Item name="price" label="最新价" rules={[{ required: true, message: '请填写价格' }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
            </Form.Item>
            <Form.Item name="changePct" label="涨跌幅（%）" rules={[{ required: true }]}>
              <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
            <Form.Item name="changeAmount" label="涨跌额">
              <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
            <Form.Item name="monitorLevel" label="监测级别" rules={[{ required: true }]}>
              <Select options={[{ value: 'normal', label: '正常' }, { value: 'abnormal', label: '异动' }]} />
            </Form.Item>
            <Form.Item name="status" label="状态" rules={[{ required: true }]}>
              <Select options={[{ value: 'online', label: '在线' }, { value: 'offline', label: '下线' }]} />
            </Form.Item>
          </div>
          <Form.Item name="spec" label="规格">
            <Input placeholder="例：杂交红蒜 5.5-6.0cm 混级" />
          </Form.Item>
          {!editing && (
            <div className="form-grid">
              <Form.Item name="icon" label="图标（emoji）"><Input /></Form.Item>
              <Form.Item name="category" label="类别">
                <Select options={['蔬菜', '水果', '粮油', '畜禽', '水产'].map((item) => ({ value: item, label: item }))} />
              </Form.Item>
              <Form.Item name="origin" label="产地"><Input /></Form.Item>
              <Form.Item name="market" label="市场"><Input /></Form.Item>
              <Form.Item name="priceUnit" label="计价单位">
                <Select options={['元/公斤', '元/斤', '元/吨'].map((item) => ({ value: item, label: item }))} />
              </Form.Item>
            </div>
          )}
        </Form>
      </Modal>

      <Modal
        open={ruleOpen}
        title="新建预警规则"
        onCancel={() => setRuleOpen(false)}
        onOk={() => ruleForm.submit()}
        okText="创建"
      >
        <Form
          form={ruleForm}
          layout="vertical"
          initialValues={{ metric: '涨跌幅', operator: '>=', channel: '站内消息' }}
          onFinish={(values) => {
            opsApi.saveAlertRule(values)
              .then((result) => {
                message.success(result.message)
                setRuleOpen(false)
                ruleForm.resetFields()
                load()
              })
              .catch((reason: Error) => message.error(reason.message))
          }}
        >
          <Form.Item name="ruleName" label="规则名称" rules={[{ required: true, message: '请填写规则名称' }]}>
            <Input placeholder="例：大蒜涨跌幅超 5%" />
          </Form.Item>
          <Form.Item name="quoteId" label="监控品种" rules={[{ required: true, message: '请选择品种' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              onChange={(value) => {
                const quote = data.quotes.find((item) => item.id === value)
                ruleForm.setFieldValue('quoteName', quote?.name ?? '全平台')
              }}
              options={data.quotes.map((quote) => ({ value: quote.id, label: `${quote.icon} ${quote.name}（${quote.origin}）` }))}
            />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="metric" label="指标" rules={[{ required: true }]}>
              <Select options={['涨跌幅', '最新价', '周涨幅', '月涨幅'].map((item) => ({ value: item, label: item }))} />
            </Form.Item>
            <Form.Item name="operator" label="条件" rules={[{ required: true }]}>
              <Select options={[{ value: '>=', label: '大于等于' }, { value: '<=', label: '小于等于' }]} />
            </Form.Item>
            <Form.Item name="threshold" label="阈值" rules={[{ required: true, message: '请填写阈值' }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
            </Form.Item>
            <Form.Item name="channel" label="触达渠道" rules={[{ required: true }]}>
              <Select options={['站内消息', '短信', '微信'].map((item) => ({ value: item, label: item }))} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <Drawer open={Boolean(forecast)} onClose={() => setForecast(null)} width={520} title="AI 预测详情">
        {forecast && (
          <div className="stack">
            <div className="kv-list">
              <div className="kv"><span>预测周期</span><b>{forecast.horizon}</b></div>
              <div className="kv"><span>预测中值</span><b>{Number(forecast.midPrice).toFixed(2)}</b></div>
              <div className="kv"><span>预测区间</span><b>{Number(forecast.lowPrice).toFixed(2)} ~ {Number(forecast.highPrice).toFixed(2)}</b></div>
              <div className="kv"><span>上涨概率</span><b>{forecast.upProbability}%</b></div>
              <div className="kv"><span>震荡概率</span><b>{forecast.flatProbability}%</b></div>
              <div className="kv"><span>下跌概率</span><b>{forecast.downProbability}%</b></div>
              <div className="kv"><span>供给指数 / 需求指数</span><b>{forecast.supplyIndex} / {forecast.demandIndex}</b></div>
              <div className="kv"><span>库存天数</span><b>{forecast.stockDays}</b></div>
              <div className="kv"><span>模型置信度</span><b>{forecast.confidence}%</b></div>
              <div className="kv"><span>MAPE</span><b>{Number(forecast.mape).toFixed(2)}%</b></div>
            </div>
            <SectionHeading kicker="ADVICE" title="经营建议" />
            <p className="small"><b>销售端：</b>{forecast.salesAdvice}</p>
            <p className="small"><b>种植端：</b>{forecast.plantAdvice}</p>
            <SectionHeading kicker="DRIVERS" title="驱动因子" />
            <p className="small">{forecast.drivers}</p>
            <p className="source-note">更新时间 {forecast.updatedAt}</p>
          </div>
        )}
      </Drawer>
    </div>
  )
}
