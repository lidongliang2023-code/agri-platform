import { useEffect, useState } from 'react'
import { SearchOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { SearchResult } from '../types'
import { ArticleCard, ChangePct, EmptyState, ErrorBlock, LoadingBlock, PageTitle } from '../components/ui'

export function SearchPage(): JSX.Element {
  const { query, navigate } = useApp()
  const [keyword, setKeyword] = useState(query.get('q') || '')
  const [data, setData] = useState<SearchResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const run = (value: string): void => {
    if (!value.trim()) {
      setData(null)
      return
    }
    setLoading(true)
    setError('')
    infoApi.search(value.trim())
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { run(keyword) }, [])

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="SEARCH"
        title="搜索与发现"
        description="一次搜索覆盖行情品种、行业资讯、农技知识、供需信息与数据报告。支持按作物、产区、发布者检索。"
      />

      <section className="surface-card">
        <div className="row" style={{ gap: 10 }}>
          <Input
            size="large"
            allowClear
            prefix={<SearchOutlined />}
            placeholder="如：大蒜行情、番茄缺钾、金乡采购需求…"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => run(keyword)}
            style={{ flex: 1 }}
          />
          <Button size="large" type="primary" onClick={() => run(keyword)}>搜索</Button>
        </div>
        <div className="chip-row" style={{ marginTop: 12 }}>
          {['大蒜', '番茄', '稻飞虱', '补贴', '金乡', '马铃薯'].map((item) => (
            <button type="button" key={item} className="chip" onClick={() => { setKeyword(item); run(item) }}>{item}</button>
          ))}
        </div>
      </section>

      {loading && <LoadingBlock rows={3} />}
      {error && <ErrorBlock message={error} />}
      {!loading && !error && !data && (
        <EmptyState icon="🔎" title="输入关键词开始搜索" description="行情、资讯、知识库、供需与报告会一起检索并按相关度排序。" />
      )}

      {data && (
        <>
          <div className="small muted">「{data.keyword}」共命中 {data.total} 条结果</div>

          {data.quotes.length > 0 && (
            <section className="surface-card">
              <b style={{ fontSize: 14 }}>行情品种（{data.quotes.length}）</b>
              <table className="data-table clickable" style={{ marginTop: 10 }}>
                <thead><tr><th>品种</th><th>主产区</th><th className="num">最新价</th><th className="num">涨跌幅</th><th>操作</th></tr></thead>
                <tbody>
                  {data.quotes.map((quote) => (
                    <tr key={quote.id} onClick={() => navigate('market-detail', quote.id)}>
                      <td><b>{quote.icon} {quote.name}</b></td>
                      <td>{quote.origin}</td>
                      <td className="num">{Number(quote.price).toFixed(2)} {quote.priceUnit}</td>
                      <td className="num"><ChangePct value={Number(quote.changePct)} /></td>
                      <td><button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); navigate('market-detail', quote.id) }}>行情详情</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {data.articles.length > 0 && (
            <section className="surface-card">
              <b style={{ fontSize: 14, display: 'block', marginBottom: 10 }}>行业资讯（{data.articles.length}）</b>
              <div className="stack">
                {data.articles.map((article) => <ArticleCard key={article.id} article={article} compact />)}
              </div>
            </section>
          )}

          <div className="grid-2">
            {data.knowledge.length > 0 && (
              <section className="surface-card">
                <b style={{ fontSize: 14 }}>农技知识（{data.knowledge.length}）</b>
                <div className="stack" style={{ marginTop: 10 }}>
                  {data.knowledge.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="todo-item"
                      onClick={() => navigate('knowledge', undefined, { q: item.title })}
                    >
                      <span className="todo-dot" />
                      <span><b>{item.title}</b><small>{item.summary}</small></span>
                      <em>{item.crop}</em>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {data.supplyDemands.length > 0 && (
              <section className="surface-card">
                <b style={{ fontSize: 14 }}>供需信息（{data.supplyDemands.length}）</b>
                <div className="stack" style={{ marginTop: 10 }}>
                  {data.supplyDemands.map((item) => (
                    <button type="button" key={item.id} className="todo-item" onClick={() => navigate('sd-detail', item.id)}>
                      <span className="todo-dot" />
                      <span><b>{item.title}</b><small>{item.origin} · {item.quantity} · {Number(item.price).toFixed(2)} {item.priceUnit}</small></span>
                      <em>{item.sdType === 'supply' ? '供应' : '需求'}</em>
                    </button>
                  ))}
                </div>
              </section>
            )}
          </div>

          {data.reports.length > 0 && (
            <section className="surface-card">
              <b style={{ fontSize: 14 }}>数据报告（{data.reports.length}）</b>
              <div className="stack" style={{ marginTop: 10 }}>
                {data.reports.map((item) => (
                  <button type="button" key={item.id} className="todo-item" onClick={() => navigate('reports')}>
                    <span className="todo-dot" />
                    <span><b>{item.title}</b><small>{item.category} · {item.period} · {item.pageCount} 页</small></span>
                    <em>{item.isFree ? '免费' : `¥${Number(item.price).toFixed(0)}`}</em>
                  </button>
                ))}
              </div>
            </section>
          )}

          {data.total === 0 && <EmptyState icon="🌾" title="没有找到相关内容" description="试试更短的关键词，或从行情中心、资讯频道直接浏览。" />}
        </>
      )}
    </div>
  )
}
