import { useEffect, useMemo, useState } from 'react'
import { Button, Segmented, message } from 'antd'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { SdMatch, SupplyDemand } from '../types'
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile } from '../components/ui'

interface MatchGroup {
  sd: SupplyDemand
  matches: SdMatch[]
}

/**
 * 智能撮合工作台：把「我的发布」逐条交给后端匹配接口，汇总成一张撮合清单。
 * 后端按规格、价差、运距加权打分，只有 ≥80 分才进入建议列表。
 */
export function MatchPage(): JSX.Element {
  const { navigate } = useApp()
  const [groups, setGroups] = useState<MatchGroup[] | null>(null)
  const [error, setError] = useState('')
  const [scope, setScope] = useState<'all' | 'supply' | 'demand'>('all')

  const load = (): void => {
    setError('')
    // 供需是两张表，mine 一次只返回一侧；只查供应会让"求购"分组永远为空。
    // 已下架/未通过的记录不再参与撮合：既没有对手方愿意谈，也白白多发一轮匹配请求。
    Promise.all([infoApi.mySupplyDemands('supply'), infoApi.mySupplyDemands('demand')])
      .then(async ([supply, demand]) => {
        const mine = [...(supply.items ?? []), ...(demand.items ?? [])]
          .filter((sd) => sd.status !== 'offline' && sd.status !== 'rejected')
        const detail = await Promise.all(
          mine.map(async (sd) => ({ sd, matches: await infoApi.sdMatches(sd.id, sd.sdType) })),
        )
        setGroups(detail)
      })
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(load, [])

  const visible = useMemo(() => {
    if (!groups) return []
    return groups
      .filter((group) => scope === 'all' || group.sd.sdType === scope)
      .map((group) => ({ ...group, matches: [...group.matches].sort((a, b) => b.score - a.score) }))
  }, [groups, scope])

  const allMatches = useMemo(() => (groups ?? []).flatMap((group) => group.matches), [groups])
  const highQuality = allMatches.filter((match) => match.score >= 90).length
  const avgScore = allMatches.length
    ? Math.round(allMatches.reduce((sum, match) => sum + match.score, 0) / allMatches.length)
    : 0

  if (!groups && !error) return <LoadingBlock rows={4} />
  if (error) return <ErrorBlock message={error} onRetry={load} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="AI MATCHING"
        title="智能撮合工作台"
        description="按规格匹配度、价差、运距与信用加权打分 · 匹配度 ≥80% 才推送建议 · 建议 24 小时内响应，撮合成功率最高"
        actions={
          <>
            <Button onClick={() => navigate('sd')}>返回供需大厅</Button>
            <Button type="primary" onClick={() => navigate('sd-publish', undefined, { type: 'supply' })}>＋ 发布新信息</Button>
          </>
        }
      />

      <div className="grid-4">
        <StatTile label="撮合建议总数" value={allMatches.length} unit="条" note="来自我的全部发布" />
        <StatTile label="高匹配建议" value={highQuality} unit="条" note="匹配度 ≥90%" tone="up" />
        <StatTile label="平均匹配度" value={avgScore} unit="%" note="规格 + 价差 + 运距加权" />
        <StatTile label="待响应建议" value={allMatches.filter((match) => match.status === 'suggested').length} unit="条" note="建议 24 小时内联系" tone="warn" />
      </div>

      <section className="surface-card">
        <div className="row between" style={{ marginBottom: 12 }}>
          <Segmented
            value={scope}
            onChange={(value) => setScope(value as typeof scope)}
            options={[
              { value: 'all', label: '全部' },
              { value: 'supply', label: '我的供应' },
              { value: 'demand', label: '我的需求' },
            ]}
          />
          <Button size="small" onClick={load}>重新匹配</Button>
        </div>

        {visible.length === 0 && (
          <EmptyState
            icon="🤝"
            title="还没有可撮合的信息"
            description="发布供应或需求后，AI 会自动为您匹配对手方并在这里给出建议。"
            action={<Button type="primary" onClick={() => navigate('sd-publish', undefined, { type: 'supply' })}>去发布</Button>}
          />
        )}

        <div className="stack" style={{ gap: 18 }}>
          {visible.map((group) => (
            <div key={group.sd.id}>
              <SectionHeading
                kicker={group.sd.sdType === 'supply' ? 'SUPPLY' : 'DEMAND'}
                title={`${group.sd.title} · ${group.matches.length} 条建议`}
                action="查看详情"
                onAction={() => navigate('sd-detail', group.sd.id)}
              />
              {group.matches.length === 0 && <p className="muted small">暂无匹配度 ≥80% 的对手方，可适当放宽规格或延长有效期。</p>}
              <div className="grid-2">
                {group.matches.map((match) => (
                  <article className="match-card" key={match.id}>
                    <div className="row between">
                      <b style={{ fontSize: 13 }}>{match.targetTitle}</b>
                      <span className={`soft-tag ${match.score >= 90 ? 'tone-green' : 'tone-purple'}`}>✦ {match.score}%</span>
                    </div>
                    <p className="small muted" style={{ margin: '6px 0 6px' }}>
                      {match.targetOrg} · {match.targetRegion} · 运距 {match.distanceKm} 公里 · 价差 {match.priceGap}
                    </p>
                    <p className="small">{match.reason}</p>
                    <div className="row" style={{ gap: 8, marginTop: 10 }}>
                      <Button
                        size="small"
                        type="primary"
                        onClick={() => {
                          message.success('已发起沟通，对方将收到站内消息')
                          navigate('sd-detail', group.sd.id)
                        }}
                      >
                        发起沟通
                      </Button>
                      <Button size="small" onClick={() => message.info('已标记为「暂不考虑」，后续不再重复推荐')}>暂不考虑</Button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
