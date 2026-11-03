import { useEffect, useMemo, useState } from 'react'
import { DeleteOutlined } from '@ant-design/icons'
import { Button, Popconfirm, Tag, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { Favorite, PageKey } from '../types'
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, StatTile } from '../components/ui'

/** 收藏类型到页面路由的映射，点击收藏直接回到原内容。 */
const ROUTE: Record<string, { page: PageKey; withId: boolean; label: string }> = {
  article: { page: 'news-detail', withId: true, label: '资讯' },
  quote: { page: 'market-detail', withId: true, label: '行情' },
  report: { page: 'reports', withId: false, label: '报告' },
  knowledge: { page: 'knowledge', withId: true, label: '知识' },
  course: { page: 'training', withId: false, label: '课程' },
  supplyDemand: { page: 'sd-detail', withId: true, label: '供需' },
}

export function FavoritesPage(): JSX.Element {
  const { navigate } = useApp()
  const [items, setItems] = useState<Favorite[] | null>(null)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('全部')

  const load = (): void => {
    setError('')
    infoApi.favorites()
      .then(setItems)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const types = useMemo(() => {
    const unique = new Set((items ?? []).map((item) => item.targetType))
    return ['全部', ...Array.from(unique)]
  }, [items])

  const visible = useMemo(
    () => (items ?? []).filter((item) => filter === '全部' || item.targetType === filter),
    [items, filter],
  )

  const remove = (id: number): void => {
    infoApi.removeFavorite(id)
      .then((result) => { setItems(result.favorites); message.success(result.message) })
      .catch((reason: Error) => message.error(reason.message))
  }

  if (!items && !error) return <LoadingBlock rows={4} />
  if (error || !items) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="MY FAVORITES"
        title="我的收藏"
        description="收藏的资讯、行情、报告、知识与供需信息集中在此 · 支持按类型筛选与一键取消"
      />

      <div className="grid-4">
        <StatTile label="收藏总数" value={items.length} unit="条" note="跨内容类型" />
        <StatTile label="资讯" value={items.filter((item) => item.targetType === 'article').length} unit="条" />
        <StatTile label="行情" value={items.filter((item) => item.targetType === 'quote').length} unit="条" />
        <StatTile label="报告与知识" value={items.filter((item) => item.targetType === 'report' || item.targetType === 'knowledge').length} unit="条" />
      </div>

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {types.map((type) => (
            <button type="button" key={type} className={`chip${filter === type ? ' on' : ''}`} onClick={() => setFilter(type)}>
              {type === '全部' ? '全部' : ROUTE[type]?.label ?? type}
            </button>
          ))}
        </div>

        {visible.length === 0 && (
          <EmptyState
            icon="⭐"
            title="还没有收藏内容"
            description="在资讯、行情、报告页点击收藏，内容会汇总到这里。"
            action={<Button type="primary" onClick={() => navigate('news')}>去逛逛资讯</Button>}
          />
        )}

        <div className="stack" style={{ gap: 10 }}>
          {visible.map((item) => (
            <article className="favorite-row" key={item.id}>
              <div
                style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                onClick={() => {
                  const route = ROUTE[item.targetType]
                  if (!route) { message.info('该类型暂不支持跳转'); return }
                  navigate(route.page, route.withId ? item.targetId : undefined)
                }}
              >
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 13 }}>{item.title}</b>
                  <Tag className="soft-tag">{ROUTE[item.targetType]?.label ?? item.targetType}</Tag>
                </div>
                <p className="small muted" style={{ margin: '6px 0 0' }}>{item.summary}</p>
                <p className="small muted" style={{ margin: '4px 0 0' }}>收藏于 {item.createdAt}</p>
              </div>
              <Popconfirm title="取消收藏？" okText="取消收藏" cancelText="再想想" onConfirm={() => remove(item.id)}>
                <Button size="small" icon={<DeleteOutlined />}>取消收藏</Button>
              </Popconfirm>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
