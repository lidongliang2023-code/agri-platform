import { useEffect, useState } from 'react'
import { Button, Input, Pagination } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { ArticleList } from '../types'
import { ArticleCard, ErrorBlock, LoadingBlock, PageTitle } from '../components/ui'

export function NewsPage(): JSX.Element {
  const { query, navigate } = useApp()
  const [channel, setChannel] = useState(query.get('channel') || '推荐')
  const [contentType, setContentType] = useState('全部')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<ArticleList | null>(null)
  const [error, setError] = useState('')

  const load = (nextPage = 1, nextChannel = channel, nextType = contentType, nextKeyword = keyword): void => {
    setError('')
    infoApi.articles({
      channel: nextChannel === '推荐' ? undefined : nextChannel,
      contentType: nextType === '全部' ? undefined : nextType,
      keyword: nextKeyword || undefined,
      page: nextPage,
      size: 8,
    })
      .then((result) => { setData(result); setPage(nextPage) })
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load(1) }, [])

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="INDUSTRY NEWS"
        title="行业资讯"
        description="原创 + 权威聚合 + AI 生成（均标注来源）· 内容经平台三级审核后发布 · 支持按栏目与内容形态筛选"
        actions={
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="搜索资讯标题或关键词"
            style={{ width: 260 }}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={() => load(1)}
          />
        }
      />

      <section className="surface-card">
        <div className="row between" style={{ gap: 12 }}>
          <div className="chip-row">
            {['推荐', ...data.channels.map((item) => item.name)].map((item) => (
              <button
                type="button"
                key={item}
                className={`chip${channel === item ? ' on' : ''}`}
                onClick={() => { setChannel(item); load(1, item, contentType, keyword) }}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="chip-row">
            {['全部', '图文', '短视频', '直播', '行情简报'].map((item) => (
              <button
                type="button"
                key={item}
                className={`chip${contentType === item ? ' on' : ''}`}
                onClick={() => { setContentType(item); load(1, channel, item, keyword) }}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="grid-main-aside">
        <div className="stack">
          {data.items.map((article) => <ArticleCard key={article.id} article={article} />)}
          {data.items.length === 0 && <p className="muted small" style={{ padding: 30, textAlign: 'center' }}>没有符合条件的资讯</p>}
          <div className="row between">
            <span className="small muted">共 {data.total} 条 · 第 {data.page} 页</span>
            <Pagination
              current={page}
              pageSize={data.size}
              total={data.total}
              showSizeChanger={false}
              onChange={(nextPage) => load(nextPage)}
            />
          </div>
        </div>

        <aside className="stack">
          <section className="surface-card">
            <b style={{ fontSize: 13.5 }}>🔥 热读榜</b>
            <div className="hot-rank" style={{ marginTop: 8 }}>
              {data.hot.map((item, index) => (
                <button type="button" key={item.id} onClick={() => navigate('news-detail', item.id)}>
                  <span className="rank-no">{index + 1}</span>
                  <span className="rank-name">{item.coverIcon} {item.title}</span>
                  <span className="small muted">{item.readCount > 10000 ? `${(item.readCount / 10000).toFixed(1)}万` : item.readCount}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="surface-card">
            <b style={{ fontSize: 13.5 }}>栏目订阅</b>
            <p className="small muted" style={{ margin: '8px 0 12px', lineHeight: 1.7 }}>
              订阅后新内容会进入「预警与订阅」，也可以开启每日摘要推送。
            </p>
            <Button block onClick={() => navigate('alerts')}>管理订阅</Button>
          </section>
        </aside>
      </div>
    </div>
  )
}
