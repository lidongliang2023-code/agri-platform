import { useEffect, useState } from 'react'
import { Button, Tag, message } from 'antd'
import { opsApi } from '../api'
import { useApp } from '../app-context'
import type { Dashboard } from '../types'
import {
  DistributionDonut,
  ErrorBlock,
  LoadingBlock,
  OpsTrendChart,
  PageTitle,
  SectionHeading,
  StatTile,
  StatusTag,
  formatCount,
  riskLabel,
} from '../components/ui'

/** 运营大盘：指标卡 + 产量/阅读趋势 + 渠道分布 + 待办（待审内容、预警）。 */
export function DashboardPage(): JSX.Element {
  const { navigate } = useApp()
  const [data, setData] = useState<Dashboard | null>(null)
  const [error, setError] = useState('')

  const load = (): void => {
    setError('')
    opsApi.dashboard().then(setData).catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={load} />
  const accuracy = Array.isArray(data.quoteQuality.accuracy)
    ? 100 - data.quoteQuality.accuracy.reduce((sum, item) => sum + Number(item.mape || 0), 0)
      / Math.max(data.quoteQuality.accuracy.length, 1)
    : Number(data.quoteQuality.accuracy)

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="OPERATIONS DASHBOARD"
        title="运营大盘"
        description="内容、行情、供需与 AI 服务运行态势 · 数据每 5 分钟刷新 · 所有指标支持下钻到明细"
        actions={
          <>
            <Button onClick={() => navigate('stats')}>统计报表</Button>
            <Button type="primary" onClick={() => navigate('contents')}>处理待审核（{data.pending.length}）</Button>
          </>
        }
      />

      <div className="grid-6">
        {data.cards.map((card) => (
          <StatTile key={card.label} label={card.label} value={card.value} unit={card.unit} note={card.note} tone={card.tone} />
        ))}
      </div>

      <div className="grid-main-aside">
        <section className="surface-card">
          <SectionHeading kicker="TREND" title="内容产量与阅读量趋势" />
          <OpsTrendChart points={data.trend} />
          <div className="row" style={{ gap: 18, marginTop: 6 }}>
            <span className="chart-legend"><i className="bar" /> 每日产出（条）</span>
            <span className="chart-legend"><i className="line" /> 阅读量 PV（次）</span>
          </div>
        </section>

        <section className="surface-card">
          <SectionHeading kicker="CHANNEL MIX" title="渠道内容分布" />
          <DistributionDonut items={data.distribution} />
        </section>
      </div>

      <div className="grid-4">
        <StatTile label="监测品种" value={data.quoteQuality.quoteCount} unit="个" note={`目标 ${data.quoteQuality.targetCount} 个`} />
        <StatTile label="数据源" value={data.quoteQuality.sourceCount} unit="个" note={`正常 ${data.quoteQuality.sourceNormal} 个`} tone="up" />
        <StatTile label="数据可用率" value={data.quoteQuality.availableRate} unit="%" note={`拦截 ${data.quoteQuality.blockedRows} 行`} tone="up" />
        <StatTile label="采集准确率" value={accuracy.toFixed(2)} unit="%" note={`累计 ${formatCount(data.quoteQuality.points)} 条报价`} />
      </div>

      <div className="grid-main-aside">
        <section className="surface-card">
          <SectionHeading kicker="PENDING" title="待审核内容" action="全部内容" onAction={() => navigate('contents')} />
          {data.pending.length === 0 && <p className="muted small">暂无待审核内容。</p>}
          <div className="stack" style={{ gap: 10 }}>
            {data.pending.map((item) => {
              const risk = riskLabel(item.riskLevel)
              return (
                <article className="audit-row" key={item.id}>
                  <span className="audit-icon">{item.coverIcon || '📄'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      <b style={{ fontSize: 13 }}>{item.title}</b>
                      <Tag className={`soft-tag tone-${risk.tone}`}>{risk.label}</Tag>
                      <StatusTag status={item.status} />
                    </div>
                    <p className="small muted" style={{ margin: '6px 0' }}>
                      {item.channel} · {item.contentType} · {item.author} · {item.publishedAt || '待发布'}
                    </p>
                    {item.riskNote && <p className="small" style={{ color: '#ae6b00' }}>风险提示：{item.riskNote}</p>}
                  </div>
                  <div className="row" style={{ gap: 8 }}>
                    <Button size="small" onClick={() => navigate('contents')}>去审核</Button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="surface-card">
          <SectionHeading kicker="ALERTS" title="最近价格预警" action="预警配置" onAction={() => navigate('quotes')} />
          {data.recentAlerts.length === 0 && <p className="muted small">暂无预警记录。</p>}
          <div className="stack" style={{ gap: 10 }}>
            {data.recentAlerts.map((alert) => (
              <div className="alert-row" key={alert.id}>
                <span className={`alert-level tone-${alert.level === 'high' ? 'up' : alert.level === 'medium' ? 'amber' : 'default'}`}>
                  {alert.level === 'high' ? '高' : alert.level === 'medium' ? '中' : '低'}
                </span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 12.5 }}>{alert.title}</b>
                  <p className="small muted" style={{ marginTop: 4 }}>{alert.quoteName} · 触发值 {alert.triggerValue} · {alert.createdAt}</p>
                </div>
              </div>
            ))}
          </div>
          <Button block style={{ marginTop: 12 }} onClick={() => message.info('演示环境不发送真实推送，正式版对接站内信与短信通道')}>
            一键推送今日行情简报
          </Button>
        </section>
      </div>
    </div>
  )
}
