import { useEffect, useState } from 'react'
import { DownloadOutlined, ThunderboltOutlined } from '@ant-design/icons'
import { Button, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { MarketData } from '../types'
import { AiCard, ChangePct, ErrorBlock, LoadingBlock, PageTitle, QuoteRow, StatTile } from '../components/ui'

export function MarketPage(): JSX.Element {
  const { navigate, openMarket } = useApp()
  const [data, setData] = useState<MarketData | null>(null)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('全部')
  const [market, setMarket] = useState('全国综合')
  const [keyword, setKeyword] = useState('')

  const load = (nextCategory = category, nextMarket = market, nextKeyword = keyword): void => {
    setError('')
    infoApi.markets({
      category: nextCategory === '全部' ? undefined : nextCategory,
      market: nextMarket === '全国综合' ? undefined : nextMarket,
      keyword: nextKeyword || undefined,
    })
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load() }, [])

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="MARKET QUOTES"
        title="行情中心"
        description="覆盖 200+ 核心农产品 · 批发市场数据 T+0 实时更新 · 产地价格 T+1（每日 18:00）更新"
        actions={
          <>
            <Button icon={<DownloadOutlined />} onClick={() => message.success('已生成行情导出任务，完成后在消息中心下载')}>导出行情</Button>
            <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => navigate('alerts')}>设置价格预警</Button>
          </>
        }
      />

      <div className="grid-4">
        <StatTile label="监测品种" value={data.stats.total} unit="个" note="覆盖蔬菜 / 水果 / 粮油 / 畜禽 / 水产" />
        <StatTile label="今日上涨品种" value={data.stats.up} unit="个" note="葱姜蒜类领涨" tone="up" />
        <StatTile label="今日下跌品种" value={data.stats.down} unit="个" note="叶菜类多数回落" tone="down" />
        <StatTile label="异常波动预警" value={data.stats.abnormal} unit="条" note="超过历史均值 2 倍标准差" tone="warn" />
      </div>

      <section className="surface-card">
        <div className="row" style={{ gap: 14 }}>
          <span className="small muted">品类</span>
          <div className="chip-row">
            {['全部', ...data.categories].map((item) => (
              <button
                type="button"
                key={item}
                className={`chip${category === item ? ' on' : ''}`}
                onClick={() => { setCategory(item); load(item, market, keyword) }}
              >
                {item}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <div className="row" style={{ gap: 8 }}>
            <select className="chip" value={market} onChange={(event) => { setMarket(event.target.value); load(category, event.target.value, keyword) }}>
              {['全国综合', ...data.markets].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input
              className="chip"
              style={{ width: 180 }}
              placeholder="搜索品种 / 产地"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Enter') load() }}
            />
            <Button size="small" onClick={() => load()}>筛选</Button>
          </div>
        </div>
      </section>

      <div className="grid-main-aside">
        <section className="surface-card">
          <div className="row between" style={{ marginBottom: 10 }}>
            <b style={{ fontSize: 14 }}>热门品种实时行情 <span className="soft-tag">单位：元/公斤</span></b>
            <button type="button" className="link-button" onClick={() => navigate('compare')}>多品种比价 →</button>
          </div>
          <div className="table-scroll">
            <table className="data-table clickable">
              <thead>
                <tr>
                  <th>品种</th><th>主产区 / 市场</th><th className="num">最新价</th><th className="num">涨跌额</th>
                  <th className="num">涨跌幅</th><th>近 7 日走势</th><th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.quotes.map((quote) => (
                  <QuoteRow key={quote.id} quote={quote} onOpen={() => openMarket(quote.id)} />
                ))}
              </tbody>
            </table>
          </div>
          {data.quotes.length === 0 && <p className="muted small" style={{ padding: 20, textAlign: 'center' }}>没有符合条件的品种</p>}
        </section>

        <aside className="stack">
          <section className="surface-card">
            <b style={{ fontSize: 13.5 }}>🗺️ 产区价格对比</b>
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
            <Button size="small" style={{ width: '100%', marginTop: 12 }} onClick={() => navigate('compare')}>进入多品种比价</Button>
          </section>

          <AiCard
            title="AI 行情解读"
            confidence={data.aiRead.confidence}
            actions={<Button size="small" type="primary" ghost onClick={() => navigate('forecast')}>查看预测</Button>}
          >
            {data.aiRead.content}
          </AiCard>

          <section className="surface-card">
            <b style={{ fontSize: 13.5 }}>价格指数速览</b>
            <div className="row" style={{ marginTop: 10, gap: 8 }}>
              <Button size="small" onClick={() => navigate('indices')}>查看 5 条指数</Button>
              <Button size="small" onClick={() => navigate('news', undefined, { channel: '市场动态' })}>行情解读资讯</Button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}
