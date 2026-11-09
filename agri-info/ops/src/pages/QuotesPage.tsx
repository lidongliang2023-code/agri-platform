import { CollectionAlertsPanel } from './CollectionAlertsPanel'
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
  const [collectionForm] = Form.useForm<{ endpoint?: string; rowsPath?: string; fieldMap?: string; tokenEnv?: string; enabled?: boolean }>()
  const [configTask, setConfigTask] = useState<CollectTask | null>(null)
  const [running, setRunning] = useState<number[]>([])
  const [runTask, setRunTask] = useState<CollectTask | null>(null)
  const [runs, setRuns] = useState<Awaited<ReturnType<typeof opsApi.collectionRuns>>>([])
  const [savingConfig, setSavingConfig] = useState(false)
  const [scheduleTask, setScheduleTask] = useState<CollectTask | null>(null)
  const [scheduleForm] = Form.useForm<{ enabled: boolean; cron: string; maxRetries: number; retrySeconds: number }>()
  const [savingSchedule, setSavingSchedule] = useState(false)

  const load = (): void => {
    setError('')
    opsApi.quotes().then(setData).catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') opsApi.quotes().then(setData).catch(() => { /* 保留现有数据，手动刷新可查看错误 */ })
    }, 15000)
    return () => window.clearInterval(timer)
  }, [])

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
    { title: '自动调度（北京时间）', width: 230, render: (_, record) => <div>
      <Tag color={record.scheduleEnabled ? 'green' : 'default'}>{record.scheduleEnabled ? '已启用' : '已暂停'}</Tag>
      <div>{record.cron || '尚未配置'}</div>
      <small className="muted">下次：{record.scheduleEnabled ? record.nextRunAt || '等待配置' : '—'}{record.retryCount ? ` · 重试 ${record.retryCount}` : ''}</small>
      {record.scheduleResult && <div className="muted">{record.scheduleResult}</div>}
    </div> },
    { title: '最近执行', dataIndex: 'lastRun', width: 150 },
    { title: '入库行数', dataIndex: 'lastRows', width: 90 },
    { title: '执行说明', dataIndex: 'remark', width: 240 },
    { title: '耗时', dataIndex: 'durationMs', width: 90, render: (value: number) => `${value} ms` },
    { title: '状态', dataIndex: 'status', width: 100, render: (value: string) => ({ pending_config: '待接入', running: '执行中', partial: '部分成功', failed: '失败', success: '成功' }[value] ?? value) },
    {
      title: '操作',
      width: 390,
      render: (_, record) => (
        <div className="table-actions">
            <Button size="small" onClick={() => {
              opsApi.collectionSchedule(record.id).then(value => {
                scheduleForm.resetFields(); scheduleForm.setFieldsValue(value); setScheduleTask(record)
              }).catch((reason: Error) => message.error(reason.message))
            }}>自动调度</Button>
          <Button size="small" loading={running.includes(record.id)} disabled={record.status === 'running'} onClick={() => {
            setRunning(v => [...v, record.id])
            opsApi.runTask(record.id)
              .then(result => { if (result.status === 'success') message.success(result.message); else message.warning(result.message) })
              .catch((reason: Error) => message.error(reason.message))
              .finally(() => { setRunning(v => v.filter(id => id !== record.id)); load() })
          }}>立即执行</Button>
          <Button size="small" onClick={() => opsApi.collectionConfig(record.id).then(value => {
            collectionForm.resetFields(); collectionForm.setFieldsValue(value); setConfigTask(record)
          }).catch((reason: Error) => message.error(reason.message))}>接入配置</Button>
          <Button size="small" onClick={() => opsApi.collectionRuns(record.id).then(value => {
            setRuns(value); setRunTask(record)
          }).catch((reason: Error) => message.error(reason.message))}>执行记录</Button>
        </div>
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
        description="授权接口真实采集、历史观测归档与数据质量管理；未配置接口的任务不会产生行情。"
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
        <StatTile label="采集任务" value={data.tasks.length} unit="个" note={`执行中 ${data.tasks.filter((item) => item.status === 'running').length} 个`} />
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
            { key: 'collection-alerts', label: '采集异常告警', children: <CollectionAlertsPanel tasks={data.tasks} /> },
            {
              key: 'sources',
              label: `数据源（${data.sources.length}）`,
              children: <Table rowKey="id" size="middle" columns={sourceColumns} dataSource={data.sources} pagination={false} />,
            },
            {
              key: 'tasks',
              label: `采集任务（${data.tasks.length}）`,
              children: <Table rowKey="id" size="middle" columns={taskColumns} dataSource={data.tasks} pagination={false} scroll={{ x: 1450 }} />,
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
                    <StatTile label="拦截行数" value={data.quality.blockedRows} unit="行" note="真实采集校验拒收" tone="warn" />
                    <StatTile label="去重行数" value={data.quality.duplicateRows} unit="行" note="同报价同一观测时点" />
                    <StatTile label="自动补全行数" value={data.quality.missingRows} unit="行" note="不猜测规格或单位，缺失直接拒收" />
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

      <Modal open={Boolean(scheduleTask)} title={`自动采集调度：${scheduleTask?.name ?? ''}`} width={680}
        onCancel={() => setScheduleTask(null)} onOk={() => scheduleForm.submit()} confirmLoading={savingSchedule} okText="保存调度">
        <p className="muted">按北京时间执行，服务每15秒检查到期任务。同一任务不会重复启动；停机错过的周期合并补跑一次，之后按当前时间计算下个周期。服务必须保持运行。</p>
        <p className="muted">失败按基础间隔的1、2、4倍退避重试，耗尽后等待下一周期。部分成功保留拒收记录，不自动重试。暂停阻止后续执行，已开始的采集允许完成。关闭数据源接入也会停止后续调度。</p>
        <Form form={scheduleForm} layout="vertical" onFinish={values => {
          if (!scheduleTask) return
          setSavingSchedule(true)
          opsApi.saveCollectionSchedule(scheduleTask.id, values).then(result => {
            message.success(result.message); setScheduleTask(null); load()
          }).catch((reason: Error) => message.error(reason.message)).finally(() => setSavingSchedule(false))
        }}>
          <Form.Item name="enabled" label="启用自动采集" valuePropName="checked"><Switch /></Form.Item>
          <Form.Item label="常用频率"><Select placeholder="选择后填入 Cron，可继续编辑" onChange={value => scheduleForm.setFieldValue('cron', value)} options={[
            {value: '0 */15 * * * *', label: '每15分钟'}, {value: '0 */30 * * * *', label: '每30分钟'},
            {value: '0 0 * * * *', label: '每小时'}, {value: '0 0 8,12,18 * * *', label: '每天08:00、12:00、18:00'},
            {value: '0 0 8 * * MON-FRI', label: '工作日08:00'},
          ]} /></Form.Item>
          <Form.Item name="cron" label="六段 Cron（秒 分 时 日 月 周），间隔至少60秒" rules={[{ required: true }]}><Input maxLength={60} placeholder="0 */15 * * * *" /></Form.Item>
          <div className="form-grid">
            <Form.Item name="maxRetries" label="失败额外重试次数（0～3）" rules={[{ required: true }]}><InputNumber min={0} max={3} precision={0} /></Form.Item>
            <Form.Item name="retrySeconds" label="重试基础间隔（60～3600秒）" rules={[{ required: true }]}><InputNumber min={60} max={3600} precision={0} /></Form.Item>
          </div>
        </Form>
      </Modal>
      <Modal open={Boolean(configTask)} title={`授权行情接口：${configTask?.name ?? ''}`} width={720}
        onCancel={() => setConfigTask(null)} onOk={() => collectionForm.submit()} confirmLoading={savingConfig} okText="保存配置">
        <p className="muted">仅接入已获得使用授权的 HTTPS JSON 接口，GET 请求。接口应返回完整报价数组（最多5000条、2MB），不自动翻页。此处启用允许采集；自动执行还需单独在“自动调度”中配置并启用。</p>
        <p className="muted">默认字段：code、name、category、origin、market、spec、priceUnit、price、observedAt；时间支持带时区ISO时间或北京时间。缺失字段拒收；不同规格与单位分别存储，不擅自换算。日线保留当天最新观测，历史补采不会覆盖更晚报价。</p>
        <Form form={collectionForm} layout="vertical" onFinish={values => {
          if (!configTask) return
          setSavingConfig(true)
          opsApi.saveCollectionConfig(configTask.id, values).then(result => {
            message.success(result.message); setConfigTask(null); load()
          }).catch((reason: Error) => message.error(reason.message)).finally(() => setSavingConfig(false))
        }}>
          <Form.Item name="endpoint" label="已授权 HTTPS 接口地址（不含查询参数或密钥）" rules={[{ required: true }]}><Input maxLength={1500} /></Form.Item>
          <Form.Item name="rowsPath" label="报价数组 JSON Pointer（根数组留空）"><Input placeholder="/data/rows" maxLength={200} /></Form.Item>
          <Form.Item name="fieldMap" label="字段映射 JSON（标准字段留 {}，如 price 映射为 /avgPrice）" rules={[{ required: true }]}><Input.TextArea rows={5} maxLength={4000} /></Form.Item>
          <Form.Item name="tokenEnv" label="Bearer Token 环境变量名（无鉴权可留空，不要填写密钥本身）"><Input maxLength={120} /></Form.Item>
          <Form.Item name="enabled" label="允许执行采集" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
      <Drawer open={Boolean(runTask)} title={`${runTask?.name ?? ''} · 最近20次真实执行`} width={1000} onClose={() => setRunTask(null)}>
        <Table rowKey="id" dataSource={runs} pagination={false} scroll={{ x: 900 }} columns={[
          { title: '开始时间', dataIndex: 'startedAt' }, { title: '状态', dataIndex: 'status', render: (v: string) => ({ running: '执行中', partial: '部分成功', failed: '失败', success: '成功' }[v] ?? v) },
          { title: '接收', dataIndex: 'totalRows' }, { title: '入库', dataIndex: 'acceptedRows' },
          { title: '重复', dataIndex: 'duplicateRows' }, { title: '拒收', dataIndex: 'rejectedRows' },
          { title: '结果与拒收原因', dataIndex: 'detail', width: 340 },
        ]} />
      </Drawer>
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
