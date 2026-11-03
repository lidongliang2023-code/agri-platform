import { useEffect, useState } from 'react'
import { Drawer, Button, Tag, message } from 'antd'
import { StarFilled, TeamOutlined } from '@ant-design/icons'
import { infoApi } from '../api'
import { useApp } from '../app-context'
import type { Expert } from '../types'
import { EmptyState, ErrorBlock, LoadingBlock, PageTitle, SectionHeading, StatTile, formatCount } from '../components/ui'

/**
 * 专家服务：按领域筛选专家，抽屉内查看简介与历史问答。
 * 「申请成为专家」跳转 expert-cert 页，走运营端审核链路。
 */
export function ExpertPage(): JSX.Element {
  const { navigate } = useApp()
  const [data, setData] = useState<{ items: Expert[]; fields: string[]; questions: Expert['answers'] } | null>(null)
  const [error, setError] = useState('')
  const [field, setField] = useState('全部领域')
  const [detail, setDetail] = useState<Expert | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const load = (nextField: string): void => {
    setField(nextField)
    setError('')
    infoApi.experts(nextField === '全部领域' ? undefined : nextField)
      .then((result) => setData({ items: result.items, fields: result.fields, questions: result.questions }))
      .catch((reason: Error) => setError(reason.message))
  }

  useEffect(() => { load('全部领域') }, [])

  const openDetail = (id: number): void => {
    setLoadingDetail(true)
    infoApi.expert(id)
      .then(setDetail)
      .catch((reason: Error) => message.error(reason.message))
      .finally(() => setLoadingDetail(false))
  }

  if (!data && !error) return <LoadingBlock rows={4} />
  if (error || !data) return <ErrorBlock message={error} onRetry={() => load(field)} />

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="EXPERT SERVICE"
        title="专家在线服务"
        description="平台认证农技专家一对一答疑 · 专家资质经运营端审核并公示证书编号 · 平均响应 2 小时内"
        actions={
          <>
            <Button onClick={() => navigate('ai-qa')}>先问 AI</Button>
            <Button type="primary" onClick={() => navigate('expert-cert')}>申请成为专家</Button>
          </>
        }
      />

      <div className="grid-4">
        <StatTile label="在册专家" value={data.items.length} unit="位" note="覆盖种植、植保、土肥、电商等方向" />
        <StatTile label="累计答疑" value={formatCount(data.items.reduce((sum, item) => sum + item.answerCount, 0))} unit="条" note="近 30 日新增 268 条" tone="up" />
        <StatTile label="平均评分" value={(data.items.reduce((sum, item) => sum + item.rating, 0) / Math.max(data.items.length, 1)).toFixed(1)} unit="分" note="满分 5 分" />
        <StatTile label="关注用户" value={formatCount(data.items.reduce((sum, item) => sum + item.followers, 0))} unit="人" note="可订阅专家动态" />
      </div>

      <section className="surface-card">
        <div className="chip-row" style={{ marginBottom: 14 }}>
          {['全部领域', ...data.fields].map((item) => (
            <button type="button" key={item} className={`chip${field === item ? ' on' : ''}`} onClick={() => load(item)}>
              {item}
            </button>
          ))}
        </div>

        {data.items.length === 0 && <EmptyState icon="👩‍🌾" title="该领域暂无专家" description="换个领域看看，或申请成为平台专家。" />}

        <div className="grid-2">
          {data.items.map((expert) => (
            <article className="expert-card" key={expert.id} onClick={() => openDetail(expert.id)}>
              <div className="expert-head">
                <span className="expert-avatar">{expert.name.slice(0, 1)}</span>
                <div>
                  <b>{expert.name}</b>
                  <p className="small muted">{expert.title} · {expert.orgName}</p>
                </div>
                <span className="soft-tag tone-green" style={{ marginLeft: 'auto' }}>{expert.level}</span>
              </div>
              <p className="small" style={{ marginTop: 10 }}>{expert.intro}</p>
              <div className="row" style={{ gap: 12, marginTop: 10, flexWrap: 'wrap' }}>
                <Tag className="soft-tag">{expert.field}</Tag>
                <Tag className="soft-tag">{expert.region}</Tag>
                <span className="small muted">证书 {expert.certNo}</span>
              </div>
              <div className="expert-foot">
                <span><StarFilled /> {expert.rating.toFixed(1)}</span>
                <span>答疑 {expert.answerCount}</span>
                <span><TeamOutlined /> {formatCount(expert.followers)}</span>
                <Button size="small" type="primary" ghost style={{ marginLeft: 'auto' }} onClick={(event) => {
                  event.stopPropagation()
                  openDetail(expert.id)
                }}>
                  咨询
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="surface-card">
        <SectionHeading kicker="LATEST Q&A" title="最新专家问答" />
        {(data.questions ?? []).length === 0 && <p className="muted small">暂无公开问答。</p>}
        <div className="stack" style={{ gap: 12 }}>
          {(data.questions ?? []).map((record) => (
            <div className="qa-item" key={record.id}>
              <div className="row between">
                <b style={{ fontSize: 13 }}>Q：{record.question}</b>
                <span className="small muted">{record.expertName || '平台专家'} · {record.createdAt}</span>
              </div>
              <p className="small" style={{ marginTop: 6 }}>A：{record.answer}</p>
            </div>
          ))}
        </div>
      </section>

      <Drawer
        open={Boolean(detail) || loadingDetail}
        onClose={() => setDetail(null)}
        width={520}
        title={detail ? `${detail.name} · ${detail.title}` : '加载中'}
      >
        {detail && (
          <div className="stack">
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <Tag className="soft-tag tone-green">{detail.level}</Tag>
              <Tag className="soft-tag">{detail.field}</Tag>
              <Tag className="soft-tag">{detail.region}</Tag>
              <Tag className="soft-tag">证书 {detail.certNo}</Tag>
            </div>
            <p className="small">{detail.intro}</p>
            <div className="kv-list">
              <div className="kv"><span>所在单位</span><b>{detail.orgName}</b></div>
              <div className="kv"><span>累计答疑</span><b>{detail.answerCount} 条</b></div>
              <div className="kv"><span>用户评分</span><b>{detail.rating.toFixed(1)} 分</b></div>
              <div className="kv"><span>关注人数</span><b>{formatCount(detail.followers)} 人</b></div>
              <div className="kv"><span>入驻时间</span><b>{detail.applyAt}</b></div>
            </div>
            <Button type="primary" block onClick={() => message.success('已提交咨询请求，专家将在 2 小时内回复')}>
              发起一对一咨询
            </Button>

            <SectionHeading kicker="ANSWERS" title="TA 的公开答疑" />
            {(detail.answers ?? []).length === 0 && <p className="muted small">暂无公开答疑记录。</p>}
            {(detail.answers ?? []).map((record) => (
              <div className="qa-item" key={record.id}>
                <b style={{ fontSize: 13 }}>Q：{record.question}</b>
                <p className="small" style={{ marginTop: 6 }}>A：{record.answer}</p>
                <p className="small muted">{record.crop} · {record.createdAt}</p>
              </div>
            ))}
          </div>
        )}
      </Drawer>
    </div>
  )
}
