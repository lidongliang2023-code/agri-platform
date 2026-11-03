import { useEffect, useState } from 'react'
import { Button, Drawer, Input, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { SupplyDemand, SupplyDemandList } from '../types'
import { AiCard, ErrorBlock, LoadingBlock, PageTitle, StatTile } from '../components/ui'

export function SupplyDemandPage(): JSX.Element {
  const { navigate } = useApp()
  const [data, setData] = useState<SupplyDemandList | null>(null)
  const [error, setError] = useState('')
  const [type, setType] = useState('all')
  const [category, setCategory] = useState('全部品类')
  const [origin, setOrigin] = useState('全部产地')
  const [sort, setSort] = useState('default')
  const [keyword, setKeyword] = useState('')
  const [mine, setMine] = useState<{ items: SupplyDemand[] } | null>(null)
  const [mineOpen, setMineOpen] = useState(false)
  const [mineLoading, setMineLoading] = useState(false)
  const [mineError, setMineError] = useState('')
  const [showClosed, setShowClosed] = useState(false)

  // 供需在交易模块是两张表，后端 mine 接口一次只返回一侧。
  // 原来这里不传 type，后端默认按供应查 —— 需求侧发布的东西在「我的发布」里根本看不到。
  const openMine = (): void => {
    setMineOpen(true)
    setMineLoading(true)
    setMineError('')
    Promise.all([infoApi.mySupplyDemands('supply'), infoApi.mySupplyDemands('demand')])
      .then(([supply, demand]) => {
        setMine({ items: [...(supply.items ?? []), ...(demand.items ?? [])] })
      })
      .catch((reason: Error) => setMineError(reason.message))
      .finally(() => setMineLoading(false))
  }

  // 筛选条件既要在 UI 上保留，又要立刻用于本次请求；直接读 state 会拿到上一次渲染的旧值，
  // 因此这里用「显式覆盖参数 + 回写 state」的方式，避免筛选后要点两次才生效。
  const load = (overrides: Partial<{ type: string; category: string; origin: string; sort: string; keyword: string }> = {}): void => {
    const next = { type, category, origin, sort, keyword, ...overrides }
    setType(next.type)
    setCategory(next.category)
    setOrigin(next.origin)
    setSort(next.sort)
    setKeyword(next.keyword)
    setError('')
    infoApi.supplyDemands({
      type: next.type === 'all' ? undefined : next.type,
      category: next.category === '全部品类' ? undefined : next.category,
      origin: next.origin === '全部产地' ? undefined : next.origin,
      sort: next.sort === 'default' ? undefined : next.sort,
      keyword: next.keyword || undefined,
    })
      .then(setData)
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load() }, [])

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} />

  // 「我的发布」排序：待审核 → 在线 → 已下架/未通过。
  // 已下架通常是历史成交或主动下架的老记录，默认折叠，否则一次几十条把有效信息挤没了。
  const mineItems = mine?.items ?? []
  const statusRank: Record<string, number> = { pending: 0, online: 1 }
  const mineSorted = [...mineItems].sort(
    (a, b) => (statusRank[a.status] ?? 2) - (statusRank[b.status] ?? 2),
  )
  const mineClosed = mineSorted.filter((item) => item.status === 'offline' || item.status === 'rejected')
  const mineVisible = showClosed ? mineSorted : mineSorted.filter(
    (item) => item.status !== 'offline' && item.status !== 'rejected',
  )

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="SUPPLY & DEMAND"
        title="供需信息大厅"
        description="供应与需求信息一站式撮合 · 信息经平台审核后展示（≤2 小时）· 匹配度 ≥80% 才推送撮合建议"
        actions={
          <>
            <Button onClick={openMine}>
              我的发布
            </Button>
            <Button onClick={() => navigate('sd-match')}>✦ 智能匹配</Button>
            <Button type="primary" onClick={() => navigate('sd-publish', undefined, { type: 'supply' })}>＋ 发布供应</Button>
            <Button onClick={() => navigate('sd-publish', undefined, { type: 'demand' })}>＋ 发布需求</Button>
          </>
        }
      />

      <div className="grid-4">
        <StatTile label="在线供应信息" value={data.stats.supplyCount} unit="条" note={`今日新增 ${data.stats.todayCount} 条`} tone="up" />
        <StatTile label="在线需求信息" value={data.stats.demandCount} unit="条" note="采购商实时发布" />
        <StatTile label="撮合成功率" value={data.stats.matchRate} unit="%" note="平台近 7 日均值" tone="up" />
        <StatTile label="平均响应时长" value={data.stats.avgResponse} unit="分钟" note="目标 ≤5 分钟 · 达标" />
      </div>

      <AiCard
        title={data.ai.headline}
        confidence={data.ai.confidence}
        actions={
          <>
            <Button size="small" type="primary" ghost onClick={() => navigate('sd-match')}>查看 {data.ai.suggestions} 条撮合建议</Button>
            <Button size="small" onClick={() => message.success('已开启实时撮合推送')}>开启实时撮合推送</Button>
          </>
        }
      >
        {data.ai.content}
      </AiCard>

      <section className="surface-card">
        <div className="row" style={{ gap: 12 }}>
          <div className="chip-row">
            {[{ key: 'all', label: '全部' }, { key: 'supply', label: `供应（${data.stats.supplyCount}）` }, { key: 'demand', label: `需求（${data.stats.demandCount}）` }].map((item) => (
              <button type="button" key={item.key} className={`chip${type === item.key ? ' on' : ''}`} onClick={() => { setType(item.key); setTimeout(load, 0) }}>
                {item.label}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <select className="chip" value={category} onChange={(event) => { setCategory(event.target.value); setTimeout(load, 0) }}>
            {['全部品类', ...data.categories].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="chip" value={origin} onChange={(event) => { setOrigin(event.target.value); setTimeout(load, 0) }}>
            {['全部产地', ...data.origins].map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
          <select className="chip" value={sort} onChange={(event) => { setSort(event.target.value); setTimeout(load, 0) }}>
            <option value="default">综合排序</option>
            <option value="latest">最新发布</option>
            <option value="price_asc">价格从低到高</option>
            <option value="price_desc">价格从高到低</option>
            <option value="match">匹配度优先</option>
          </select>
          <Input
            allowClear
            style={{ width: 200 }}
            placeholder="搜索品种 / 产地 / 发布者"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onPressEnter={load}
          />
        </div>
      </section>

      <div className="grid-2">
        {data.items.map((item) => (
          <article className="sd-card" key={item.id} onClick={() => navigate('sd-detail', item.id)}>
            <div className="sd-card-head">
              <h3>{item.title}</h3>
              <span className={`soft-tag ${item.sdType === 'supply' ? 'tone-green' : 'tone-blue'}`}>
                {item.sdType === 'supply' ? '供应' : '需求'}
              </span>
              {item.isTop && <span className="soft-tag tone-up">置顶</span>}
              {item.verified && <span className="soft-tag tone-green">✓ 已认证</span>}
              {item.badge && item.badge !== '—' && <span className="soft-tag tone-amber">{item.badge}</span>}
              {item.matchScore > 0 && <span className="soft-tag tone-purple">✦ 匹配度 {item.matchScore}%</span>}
            </div>
            <p className="sd-spec">
              规格 {item.spec || '—'} ｜ 可供/求购 {item.quantity} ｜ {item.origin} ｜ 上市 {item.availableDate}
            </p>
            <div className="row between">
              <div className="sd-price-row">
                <span className="sd-price">{Number(item.price).toFixed(2)}<small>{item.priceUnit}</small></span>
                <span className="small muted">{item.marketRef}</span>
              </div>
              <div className="sd-aside">
                <span className="small muted">有效期至 {item.expireDate}</span>
                <span className="small muted">浏览 {item.viewCount} · 沟通 {item.chatCount}</span>
              </div>
            </div>
            <div className="sd-foot">
              <span className="sd-avatar">{item.orgName.slice(0, 1)}</span>
              <span>{item.orgName}</span>
              <span className="soft-tag">{item.orgType}</span>
              <span style={{ marginLeft: 'auto' }}>发布 {item.createdAt}</span>
            </div>
          </article>
        ))}
      </div>
      {data.items.length === 0 && <p className="muted small" style={{ textAlign: 'center', padding: 30 }}>没有符合条件的供需信息</p>}

      <Drawer
        open={mineOpen}
        onClose={() => { setMineOpen(false); setMine(null) }}
        width={560}
        title="我的发布"
      >
        {mineLoading && <p className="muted small">正在读取…</p>}
        {!mineLoading && mineError && <p className="small" style={{ color: '#c94b4b' }}>{mineError}</p>}
        {!mineLoading && !mineError && mine && (
          <div className="stack">
            <div className="row" style={{ gap: 10 }}>
              <span className="soft-tag tone-green">在线 {mineItems.filter((item) => item.status === 'online').length}</span>
              <span className="soft-tag tone-amber">待审核 {mineItems.filter((item) => item.status === 'pending').length}</span>
              <button
                type="button"
                className={`chip${showClosed ? ' on' : ''}`}
                onClick={() => setShowClosed((previous) => !previous)}
              >
                已下架 {mineClosed.length}
              </button>
            </div>
            {mineItems.some((item) => item.status === 'pending') && (
              <p className="small" style={{ color: '#ae6b00', margin: 0 }}>
                商品与采购需求发布后需运营审核（≤2 小时），审核通过才会出现在供需大厅。
              </p>
            )}
            {mineVisible.map((item) => (
              <div
                className="surface-card"
                key={`${item.sdType}-${item.id}`}
                style={{ padding: 14 }}
                onClick={() => navigate('sd-detail', item.id, { type: item.sdType })}
              >
                <div className="row between">
                  <b style={{ fontSize: 13 }}>
                    <span className="soft-tag" style={{ marginRight: 8 }}>{item.sdType === 'demand' ? '求购' : '供应'}</span>
                    {item.title}
                  </b>
                  <span className="soft-tag">{statusLabel(item.status)}</span>
                </div>
                <p className="small muted" style={{ marginTop: 6 }}>
                  {item.sdNo} · {item.quantity} · {Number(item.price).toFixed(2)} {item.priceUnit} · {item.createdAt}
                </p>
                {item.auditNote && <p className="small" style={{ marginTop: 4, color: '#ae6b00' }}>审核意见：{item.auditNote}</p>}
              </div>
            ))}
            {mineVisible.length === 0 && (
              <p className="muted small">
                {mineItems.length === 0
                  ? '还没有发布记录，去发布一条供应或需求试试。'
                  : `当前没有在架或在审的记录，已下架 ${mineClosed.length} 条可点上方「已下架」查看。`}
              </p>
            )}
            {mineVisible.length > 0 && (
              <p className="small muted" style={{ margin: 0 }}>
                这里只展示最近的记录，改价、上下架等完整管理请到交易端。
              </p>
            )}
          </div>
        )}
      </Drawer>
    </div>
  )
}

function statusLabel(status: string): string {
  return ({ online: '在线', pending: '待审核', offline: '已下架', rejected: '未通过' } as Record<string, string>)[status] ?? status
}
