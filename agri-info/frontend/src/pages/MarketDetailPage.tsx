import { useEffect, useState } from 'react'
import { BellOutlined, StarOutlined, SwapOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { MarketDetail } from '../types'
import { AiCard, ArticleCard, ChangePct, ErrorBlock, LoadingBlock, PageTitle, Sparkline, TrendChart } from '../components/ui'

export function MarketDetailPage(): JSX.Element {
  const { id, navigate } = useApp()
  const [data, setData] = useState<MarketDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    setError('')
    infoApi.market(id).then(setData).catch((reason: Error) => setError(reason.message))
  }, [id])

  if (!id) return <ErrorBlock message="缺少品种编号，请从行情中心进入" />
  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} />

  const tone = Number(data.changePct) >= 0 ? 'up' : 'down'
  const forecast = data.forecast

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow={`${data.code} · ${data.category}`}
        title={`${data.icon} ${data.name}`}
        description={`主产区 ${data.origin} · ${data.market} · 更新于 ${data.updatedAt}（T+0）· 数据来源：${data.source}`}
        actions={
          <>
            <Button icon={<StarOutlined />} onClick={() => message.success('已加入收藏')}>收藏品种</Button>
            <Button icon={<SwapOutlined />} onClick={() => navigate('compare')}>加入比价</Button>
            <Button type="primary" icon={<BellOutlined />} onClick={() => navigate('alerts')}>设置预警</Button>
          </>
        }
      />

      <section className="detail-hero">
        <div className="row between">
          <div className="price-block">
            <span className={`big ${tone}`}>{Number(data.price).toFixed(2)}</span>
            <span className="muted small">{data.priceUnit}</span>
            <ChangePct value={Number(data.changePct)} />
            <span className="muted small">
              涨跌额 {Number(data.changeAmount) > 0 ? '+' : ''}{Number(data.changeAmount).toFixed(2)} · 近 7 日 {Number(data.weekPct).toFixed(1)}% · 近 30 日 {Number(data.monthPct).toFixed(1)}%
            </span>
          </div>
          <Sparkline points={data.trend} width={140} height={40} tone={tone} />
        </div>
        <div className="detail-meta">
          <span>规格：{data.spec}</span>
          <span>监测状态：{data.monitorLevel === 'abnormal' ? '异常波动' : '正常'}</span>
          <span>品种编码：{data.code}</span>
        </div>
      </section>

      <div className="grid-main-aside">
        <div className="stack">
          <section className="surface-card">
            <div className="row between" style={{ marginBottom: 6 }}>
              <b style={{ fontSize: 14 }}>30 日价格走势与 7 日 AI 预测区间</b>
              <span className="small muted">实线为实际价，虚线为 AI 预测中值，阴影为 80% 置信区间</span>
            </div>
            <TrendChart series={data.series} />
          </section>

          {forecast && (
            <div className="grid-3">
              <AiCard title="销售决策建议" confidence={forecast.confidence}>{forecast.salesAdvice}</AiCard>
              <AiCard title="种植决策参考" confidence={Math.max(forecast.confidence - 14, 55)}>{forecast.plantAdvice}</AiCard>
              <section className="surface-card">
                <b style={{ fontSize: 13.5 }}>⚠️ 30 日风险提示</b>
                <div className="kv-list" style={{ marginTop: 10 }}>
                  {safeRisks(forecast.riskJson).map((risk) => (
                    <div className="kv" key={risk.name}>
                      <span>{risk.name}</span>
                      <b className={risk.probability >= 50 ? 'up' : risk.probability >= 30 ? '' : 'down'}>
                        {risk.level} {risk.probability}%
                      </b>
                    </div>
                  ))}
                </div>
                <p className="small muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
                  供需缺口：供给指数 {forecast.supplyIndex} / 需求指数 {forecast.demandIndex}；库存 {forecast.stockDays}
                </p>
              </section>
            </div>
          )}

          <section className="surface-card">
            <b style={{ fontSize: 14, display: 'block', marginBottom: 10 }}>相关资讯</b>
            <div className="stack">
              {data.relatedArticles.map((article) => <ArticleCard key={article.id} article={article} compact />)}
              {data.relatedArticles.length === 0 && <p className="muted small">暂无相关资讯</p>}
            </div>
          </section>
        </div>

        <aside className="stack">
          <section className="surface-card">
            <b style={{ fontSize: 13.5 }}>产区价格对比</b>
            <table className="data-table" style={{ marginTop: 8 }}>
              <thead><tr><th>产区</th><th className="num">价格</th><th className="num">较昨日</th></tr></thead>
              <tbody>
                {data.regionPrices.map((row) => (
                  <tr key={row.region}>
                    <td>{row.region}</td>
                    <td className="num"><b>{Number(row.price).toFixed(2)}</b></td>
                    <td className="num"><ChangePct value={Number(row.changePct)} digits={1} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <AiCard title="AI 行情解读" confidence={data.aiRead.confidence} actions={
            <Button size="small" type="primary" ghost onClick={() => navigate('forecast', undefined, { quoteId: String(data.id) })}>
              查看供需预测
            </Button>
          }>
            {data.aiRead.content}
          </AiCard>

          <section className="surface-card">
            <b style={{ fontSize: 13.5 }}>我的预警规则</b>
            <div className="kv-list" style={{ marginTop: 10 }}>
              {data.alertRules.slice(0, 4).map((rule) => (
                <div className="kv" key={rule.id}>
                  <span>{rule.ruleName}</span>
                  <b className={rule.enabled ? 'down' : ''}>{rule.enabled ? '生效中' : '已停用'}</b>
                </div>
              ))}
              {data.alertRules.length === 0 && <p className="muted small">尚未设置预警规则</p>}
            </div>
            <Button size="small" style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('alerts')}>管理预警</Button>
          </section>
        </aside>
      </div>
    </div>
  )
}

function safeRisks(raw: string): Array<{ name: string; level: string; probability: number }> {
  try {
    const parsed = JSON.parse(raw) as Array<{ name: string; level: string; probability: number }>
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
