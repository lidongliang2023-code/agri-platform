import { useEffect, useState } from 'react'
import { Button, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { Forecast, MarketDetail, Quote } from '../types'
import { AiCard, ErrorBlock, LoadingBlock, PageTitle, TrendChart } from '../components/ui'

interface ForecastData {
  quote: Quote
  forecast: Forecast | null
  series: MarketDetail['series']
  drivers: Array<{ name: string; detail: string; weight: string; state: string }>
  mape: string
}

export function ForecastPage(): JSX.Element {
  const { query, navigate } = useApp()
  const [pool, setPool] = useState<Quote[]>([])
  const [quoteId, setQuoteId] = useState(Number(query.get('quoteId')) || 1)
  const [horizon, setHorizon] = useState('7d')
  const [data, setData] = useState<ForecastData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    infoApi.markets().then((result) => setPool(result.quotes)).catch(() => undefined)
  }, [])

  useEffect(() => {
    setError('')
    infoApi.forecast(quoteId, horizon)
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }, [quoteId, horizon])

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} />

  const forecast = data.forecast
  const risks = parseRisks(forecast?.riskJson ?? '[]')

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="AI FORECAST"
        title="AI 行情预测与供需决策"
        description={`多源数据融合预测引擎 · 7 日 MAPE ${data.mape}% · 模型每日凌晨 02:00 更新 · 当前品种 ${data.quote.name}（${data.quote.origin}）`}
        actions={
          <>
            <select className="chip" value={quoteId} onChange={(event) => setQuoteId(Number(event.target.value))}>
              {pool.map((quote) => <option key={quote.id} value={quote.id}>{quote.icon} {quote.name}（{quote.origin}）</option>)}
            </select>
            <select className="chip" value={horizon} onChange={(event) => setHorizon(event.target.value)}>
              <option value="7d">未来 7 天</option>
              <option value="30d">未来 30 天</option>
            </select>
            <Button onClick={() => navigate('market-detail', data.quote.id)}>查看品种行情</Button>
          </>
        }
      />

      {!forecast ? (
        <section className="surface-card">
          <p className="muted">该品种暂无预测模型输出，建议先补充行情数据或选择已纳入预测的品种。</p>
        </section>
      ) : (
        <>
          <div className="grid-main-aside">
            <section className="surface-card">
              <div className="row between" style={{ marginBottom: 8 }}>
                <b style={{ fontSize: 14 }}>价格预测区间</b>
                <span className="soft-tag tone-purple">AI Forecast · {horizon === '7d' ? '未来 7 天' : '未来 30 天'}</span>
              </div>
              <TrendChart series={data.series} />
              <div className="row" style={{ gap: 16, marginTop: 8 }}>
                <span className="small muted">预测中值 <b>{Number(forecast.midPrice).toFixed(2)}</b> {data.quote.priceUnit}</span>
                <span className="small muted">区间 {Number(forecast.lowPrice).toFixed(2)} – {Number(forecast.highPrice).toFixed(2)}</span>
                <span className="small muted">上涨 {forecast.upProbability}% / 震荡 {forecast.flatProbability}% / 下跌 {forecast.downProbability}%</span>
              </div>
            </section>

            <aside className="stack">
              <section className="surface-card">
                <b style={{ fontSize: 13.5 }}>供需平衡研判</b>
                <div style={{ marginTop: 12 }}>
                  <div className="row between small"><span>供给指数</span><b className="up">{forecast.supplyIndex < 50 ? '偏紧' : '偏松'} {forecast.supplyIndex}</b></div>
                  <div className="confidence-bar" style={{ marginTop: 5, background: '#f2f6f3' }}><i style={{ width: `${forecast.supplyIndex}%`, background: 'linear-gradient(90deg,#e8b339,#ae6b00)' }} /></div>
                </div>
                <div style={{ marginTop: 14 }}>
                  <div className="row between small"><span>需求指数</span><b className="up">旺盛 {forecast.demandIndex}</b></div>
                  <div className="confidence-bar" style={{ marginTop: 5, background: '#f2f6f3' }}><i style={{ width: `${forecast.demandIndex}%`, background: 'linear-gradient(90deg,#e57f7f,#c62828)' }} /></div>
                </div>
                <div className="kv-list" style={{ marginTop: 14 }}>
                  <div className="kv"><span>库存周转</span><b>{forecast.stockDays}</b></div>
                  <div className="kv"><span>模型置信度</span><b>{forecast.confidence}%</b></div>
                  <div className="kv"><span>更新时间</span><b>{forecast.updatedAt}</b></div>
                </div>
              </section>
            </aside>
          </div>

          <div className="grid-3">
            <AiCard title="销售决策建议" confidence={forecast.confidence} actions={
              <>
                <Button size="small" type="primary" ghost onClick={() => message.success('已采纳建议，将同步到我的农事待办')}>采纳建议</Button>
                <Button size="small" onClick={() => message.info('已忽略该建议，模型会记录你的偏好')}>忽略</Button>
              </>
            }>
              {forecast.salesAdvice}
            </AiCard>
            <AiCard title="种植决策参考" confidence={Math.max(forecast.confidence - 14, 55)}>
              {forecast.plantAdvice}
            </AiCard>
            <section className="surface-card">
              <b style={{ fontSize: 13.5 }}>⚠️ 风险三色预警</b>
              <div className="kv-list" style={{ marginTop: 10 }}>
                {risks.map((risk) => (
                  <div className="kv" key={risk.name}>
                    <span>{risk.name}</span>
                    <b className={risk.probability >= 50 ? 'up' : risk.probability >= 30 ? '' : 'down'}>
                      {risk.level} {risk.probability}%
                    </b>
                  </div>
                ))}
              </div>
              <p className="small muted" style={{ marginTop: 10, lineHeight: 1.7 }}>
                主因提示：{data.drivers.slice(0, 3).map((driver) => driver.state).join('；')}。
              </p>
            </section>
          </div>

          <section className="surface-card">
            <b style={{ fontSize: 14 }}>多源数据融合与驱动因子</b>
            <div className="grid-4" style={{ marginTop: 12 }}>
              {data.drivers.map((driver) => (
                <div key={driver.name} className="surface-card" style={{ padding: 12, background: '#fbfdfc' }}>
                  <b style={{ fontSize: 12.5 }}>{driver.name}</b>
                  <p className="small muted" style={{ marginTop: 5 }}>{driver.detail} · {driver.weight}</p>
                  <span className="soft-tag tone-green" style={{ marginTop: 8 }}>{driver.state}</span>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function parseRisks(raw: string): Array<{ name: string; level: string; probability: number }> {
  try {
    const parsed = JSON.parse(raw) as Array<{ name: string; level: string; probability: number }>
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
