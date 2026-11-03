import { useEffect, useState } from 'react'
import { BellOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Form, Input, InputNumber, Modal, Select, Switch, Tabs, Tag, message } from 'antd'
import { infoApi } from '../api'
import type { AlertMessage, AlertRule, Quote, Subscription } from '../types'
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile } from '../components/ui'

const CHANNELS = ['站内消息', '短信', '微信', '邮件']
const METRICS = ['涨跌幅', '最新价', '周涨幅', '月涨幅']

/**
 * 预警与订阅：预警规则命中后由后端写入 info_alert_message，
 * 这里同时展示规则、消息与内容订阅，形成「监控 → 触达」闭环。
 */
export function AlertsPage(): JSX.Element {
  const [rules, setRules] = useState<AlertRule[] | null>(null)
  const [messages, setMessages] = useState<AlertMessage[]>([])
  const [unread, setUnread] = useState(0)
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [error, setError] = useState('')
  const [ruleOpen, setRuleOpen] = useState(false)
  const [subOpen, setSubOpen] = useState(false)
  const [ruleForm] = Form.useForm<{ ruleName: string; quoteId: number; metric: string; operator: string; threshold: number; channel: string[] }>()
  const [subForm] = Form.useForm<{ targetType: string; targetName: string; channel: string[]; frequency: string }>()

  const load = (): void => {
    setError('')
    Promise.all([
      infoApi.alertRules(),
      infoApi.alertMessages(),
      infoApi.subscriptions(),
      infoApi.markets(),
    ])
      .then(([ruleList, messageList, subList, marketData]) => {
        setRules(ruleList)
        setMessages(messageList.items)
        setUnread(messageList.unread)
        setSubscriptions(subList)
        setQuotes(marketData.quotes)
      })
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const createRule = (values: { ruleName: string; quoteId: number; metric: string; operator: string; threshold: number; channel: string[] }): void => {
    infoApi.createAlertRule({ ...values, channel: values.channel.join(',') })
      .then((result) => {
        setRules(result.rules)
        setRuleOpen(false)
        ruleForm.resetFields()
        message.success(result.message)
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  const createSub = (values: { targetType: string; targetName: string; channel: string[]; frequency: string }): void => {
    infoApi.createSubscription({ ...values, channel: values.channel.join(',') })
      .then((result) => {
        setSubscriptions(result.subscriptions)
        setSubOpen(false)
        subForm.resetFields()
        message.success(result.message)
      })
      .catch((reason: Error) => message.error(reason.message))
  }

  if (!rules && !error) return <LoadingBlock rows={4} />
  if (error || !rules) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="ALERTS & SUBSCRIPTIONS"
        title="价格预警与订阅"
        description="自定义涨跌幅 / 价格阈值预警，命中后站内消息实时触达 · 订阅栏目与报告，按频率推送"
        actions={
          <>
            <Button icon={<PlusOutlined />} onClick={() => setSubOpen(true)}>新建订阅</Button>
            <Button type="primary" icon={<BellOutlined />} onClick={() => setRuleOpen(true)}>新建预警</Button>
          </>
        }
      />

      <div className="grid-4">
        <StatTile label="预警规则" value={rules.length} unit="条" note={`启用 ${rules.filter((rule) => rule.enabled).length} 条`} />
        <StatTile label="累计命中" value={rules.reduce((sum, rule) => sum + rule.hitCount, 0)} unit="次" note="近 30 日" tone="warn" />
        <StatTile label="未读预警" value={unread} unit="条" note={unread > 0 ? '建议及时查看' : '暂无未读'} tone={unread > 0 ? 'up' : 'default'} />
        <StatTile label="内容订阅" value={subscriptions.length} unit="项" note={`启用 ${subscriptions.filter((item) => item.enabled).length} 项`} />
      </div>

      <section className="surface-card">
        <Tabs
          defaultActiveKey="messages"
          items={[
            {
              key: 'messages',
              label: `预警消息（${unread} 未读）`,
              children: (
                <>
                  <div className="row between" style={{ marginBottom: 12 }}>
                    <span className="small muted">按未读优先排序</span>
                    <Button size="small" onClick={() => infoApi.readAllAlerts().then((result) => {
                      setUnread(0)
                      setMessages((previous) => previous.map((item) => ({ ...item, read: true })))
                      message.success(`已标记 ${result.updated} 条为已读`)
                    }).catch((reason: Error) => message.error(reason.message))}>
                      全部标为已读
                    </Button>
                  </div>
                  {messages.length === 0 && <EmptyState icon="🔔" title="暂无预警消息" description="创建预警规则后，命中阈值会在这里提醒您。" />}
                  <div className="stack" style={{ gap: 10 }}>
                    {messages.map((item) => (
                      <article className={`alert-row${item.read ? '' : ' unread'}`} key={item.id}>
                        <span className={`alert-level tone-${item.level === 'high' ? 'up' : item.level === 'medium' ? 'amber' : 'default'}`}>
                          {item.level === 'high' ? '高' : item.level === 'medium' ? '中' : '低'}
                        </span>
                        <div style={{ flex: 1 }}>
                          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <b style={{ fontSize: 13 }}>{item.title}</b>
                            {!item.read && <Tag className="soft-tag tone-up">未读</Tag>}
                          </div>
                          <p className="small" style={{ margin: '6px 0' }}>{item.content}</p>
                          <p className="small muted">{item.quoteName} · 触发值 {item.triggerValue} · {item.createdAt}</p>
                        </div>
                      </article>
                    ))}
                  </div>
                </>
              ),
            },
            {
              key: 'rules',
              label: '预警规则',
              children: (
                <>
                  {rules.length === 0 && <EmptyState icon="⚙️" title="还没有预警规则" description="点右上角「新建预警」设置第一条规则。" />}
                  <div className="stack" style={{ gap: 10 }}>
                    {rules.map((rule) => (
                      <article className="rule-row" key={rule.id}>
                        <div style={{ flex: 1 }}>
                          <b style={{ fontSize: 13 }}>{rule.ruleName}</b>
                          <p className="small muted" style={{ margin: '6px 0' }}>
                            {rule.quoteName} · {rule.metric} {rule.operator} {Number(rule.threshold).toFixed(2)} · 触达 {rule.channel} · 已命中 {rule.hitCount} 次
                          </p>
                        </div>
                        <Switch
                          checked={rule.enabled}
                          onChange={(checked) => infoApi.updateAlertRule(rule.id, { enabled: checked })
                            .then((result) => { setRules(result.rules); message.success(result.message) })
                            .catch((reason: Error) => message.error(reason.message))}
                        />
                      </article>
                    ))}
                  </div>
                </>
              ),
            },
            {
              key: 'subscriptions',
              label: '内容订阅',
              children: (
                <>
                  {subscriptions.length === 0 && <EmptyState icon="📮" title="还没有订阅" description="订阅栏目、品种或报告，按频率接收更新。" />}
                  <div className="stack" style={{ gap: 10 }}>
                    {subscriptions.map((item) => (
                      <article className="rule-row" key={item.id}>
                        <div style={{ flex: 1 }}>
                          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                            <b style={{ fontSize: 13 }}>{item.targetName}</b>
                            <Tag className="soft-tag">{targetTypeLabel(item.targetType)}</Tag>
                          </div>
                          <p className="small muted" style={{ margin: '6px 0' }}>触达 {item.channel} · 频率 {item.frequency}</p>
                        </div>
                        <Switch
                          checked={item.enabled}
                          onChange={(checked) => infoApi.toggleSubscription(item.id, checked)
                            .then((result) => { setSubscriptions(result.subscriptions); message.success(result.message) })
                            .catch((reason: Error) => message.error(reason.message))}
                        />
                      </article>
                    ))}
                  </div>
                </>
              ),
            },
          ]}
        />
      </section>

      <Modal open={ruleOpen} title="新建价格预警" onCancel={() => setRuleOpen(false)} onOk={() => ruleForm.submit()} okText="创建">
        <Form form={ruleForm} layout="vertical" onFinish={createRule} initialValues={{ metric: '涨跌幅', operator: '>=', channel: ['站内消息'] }}>
          <Form.Item name="ruleName" label="预警名称" rules={[{ required: true, message: '请填写名称' }]}>
            <Input placeholder="例：大蒜涨跌幅超 5%" />
          </Form.Item>
          <Form.Item name="quoteId" label="监控品种" rules={[{ required: true, message: '请选择品种' }]}>
            <Select
              showSearch
              optionFilterProp="label"
              options={quotes.map((quote) => ({ value: quote.id, label: `${quote.icon} ${quote.name}（${quote.origin}）` }))}
            />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="metric" label="指标" rules={[{ required: true }]}>
              <Select options={METRICS.map((item) => ({ value: item, label: item }))} />
            </Form.Item>
            <Form.Item name="operator" label="条件" rules={[{ required: true }]}>
              <Select options={[{ value: '>=', label: '大于等于' }, { value: '<=', label: '小于等于' }]} />
            </Form.Item>
            <Form.Item name="threshold" label="阈值" rules={[{ required: true, message: '请填写阈值' }]}>
              <InputNumber style={{ width: '100%' }} min={0} step={0.1} />
            </Form.Item>
          </div>
          <Form.Item name="channel" label="触达渠道" rules={[{ required: true }]}>
            <Select mode="multiple" options={CHANNELS.map((item) => ({ value: item, label: item }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={subOpen} title="新建内容订阅" onCancel={() => setSubOpen(false)} onOk={() => subForm.submit()} okText="订阅">
        <Form form={subForm} layout="vertical" onFinish={createSub} initialValues={{ targetType: 'channel', channel: ['站内消息'], frequency: '每日' }}>
          <Form.Item name="targetType" label="订阅类型" rules={[{ required: true }]}>
            <Select options={[
              { value: 'channel', label: '资讯栏目' },
              { value: 'quote', label: '行情品种' },
              { value: 'report', label: '研究报告' },
              { value: 'expert', label: '专家动态' },
            ]} />
          </Form.Item>
          <Form.Item name="targetName" label="订阅对象" rules={[{ required: true, message: '请填写订阅对象' }]}>
            <Input placeholder="例：市场动态 / 大蒜（山东金乡）" />
          </Form.Item>
          <div className="form-grid">
            <Form.Item name="frequency" label="推送频率" rules={[{ required: true }]}>
              <Select options={['实时', '每日', '每周', '每月'].map((item) => ({ value: item, label: item }))} />
            </Form.Item>
            <Form.Item name="channel" label="触达渠道" rules={[{ required: true }]}>
              <Select mode="multiple" options={CHANNELS.map((item) => ({ value: item, label: item }))} />
            </Form.Item>
          </div>
        </Form>
      </Modal>

      <SectionHeading kicker="TIP" title="预警配置建议" />
      <p className="small muted">
        涨跌幅类预警建议阈值 5%（对应单日显著波动），绝对价格类预警建议按近 30 日均价下浮 8%-10% 设置，避免噪声反复触发。
      </p>
    </div>
  )
}

function targetTypeLabel(type: string): string {
  return ({ channel: '资讯栏目', quote: '行情品种', report: '研究报告', expert: '专家动态' } as Record<string, string>)[type] ?? type
}
