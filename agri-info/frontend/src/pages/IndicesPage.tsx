import { useEffect, useState } from 'react'
import { Drawer, Button } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { IndexDetail, PriceIndex } from '../types'
import { ChangePct, ErrorBlock, LoadingBlock, PageTitle, Sparkline, TrendChart } from '../components/ui'

export function IndicesPage(): JSX.Element {
  const { navigate } = useApp()
  const [items, setItems] = useState<PriceIndex[] | null>(null)
  const [detail, setDetail] = useState<IndexDetail | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    infoApi.indices().then(setItems).catch((reason: Error) => setError(reason.message))
  }, [])

  const open = (id: number): void => {
    infoApi.indexDetail(id).then(setDetail).catch((reason: Error) => setError(reason.message))
  }

  if (!items && !error) return <LoadingBlock rows={4} />
  if (error || !items) return <ErrorBlock message={error} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="PRICE INDEX"
        title="价格指数"
        description="平台按品类编制加权价格指数，基期 2020 年 = 100。指数日频计算，异常值自动剔除，用于观察板块性涨跌而非单一品种波动。"
        actions={<Button onClick={() => navigate('market')}>返回行情中心</Button>}
      />

      <div className="grid-3">
        {items.map((index) => (
          <button
            type="button"
            key={index.id}
            className="surface-card"
            style={{ textAlign: 'left', cursor: 'pointer' }}
            onClick={() => open(index.id)}
          >
            <div className="row between">
              <span className="soft-tag tone-blue">{index.category}</span>
              <ChangePct value={Number(index.changePct)} />
            </div>
            <b style={{ display: 'block', marginTop: 10, fontSize: 14 }}>{index.name}</b>
            <div className="row between" style={{ marginTop: 8 }}>
              <span style={{ fontSize: 24, fontWeight: 760, fontVariantNumeric: 'tabular-nums' }}>{Number(index.value).toFixed(2)}</span>
              <Sparkline points={index.trend} width={110} height={34} />
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              基期 {index.basePeriod} · 样本 {index.sampleCount} 个 · {index.publishedAt}
            </p>
          </button>
        ))}
      </div>

      <Drawer
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={720}
        title={detail ? `${detail.name}（${detail.code}）` : '指数详情'}
      >
        {detail && (
          <div className="stack">
            <div className="row between">
              <div>
                <span className="small muted">最新指数</span>
                <div style={{ fontSize: 30, fontWeight: 780 }}>{Number(detail.value).toFixed(2)}</div>
              </div>
              <ChangePct value={Number(detail.changePct)} />
            </div>
            <TrendChart series={detail.series} height={220} />
            <div className="kv-list">
              <div className="kv"><span>编制方法</span><b>{detail.method}</b></div>
              <div className="kv"><span>基期</span><b>{detail.basePeriod}</b></div>
              <div className="kv"><span>样本品种</span><b>{detail.sampleCount} 个</b></div>
              <div className="kv"><span>发布日期</span><b>{detail.publishedAt}</b></div>
            </div>
            <div>
              <b style={{ fontSize: 13.5 }}>权重品种（按波动排序）</b>
              <table className="data-table" style={{ marginTop: 8 }}>
                <thead><tr><th>品种</th><th>主产区</th><th className="num">价格</th><th className="num">涨跌幅</th></tr></thead>
                <tbody>
                  {detail.components.map((row) => (
                    <tr key={row.id} onClick={() => navigate('market-detail', row.id)} style={{ cursor: 'pointer' }}>
                      <td>{row.icon} {row.name}</td>
                      <td>{row.origin}</td>
                      <td className="num">{Number(row.price).toFixed(2)} {row.priceUnit}</td>
                      <td className="num"><ChangePct value={Number(row.changePct)} digits={1} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  )
}
