import { useEffect, useState } from 'react'
import {
  dayLabel,
  formatCount,
  infoPublicApi,
  money,
  type Course,
  type Expert,
  type Knowledge,
  type Report,
} from './infoApi'
import { usePageMeta } from '../../utils'
import './info.css'

type Tab = 'training' | 'experts' | 'reports' | 'knowledge'

/** 供路由层使用：`/info/{tab}` 的 tab 取值。 */
export type InfoTab = Tab

const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'training', label: '培训课堂' },
  { key: 'experts', label: '认证专家' },
  { key: 'reports', label: '数据报告' },
  { key: 'knowledge', label: '农技知识' },
]

/**
 * 学习与服务：培训 / 专家 / 报告 / 知识库 四个频道合一。
 * 它们在门户上是并列的浏览入口，交互高度一致，拆成四个页面只会重复三遍骨架。
 */
const TAB_META: Record<Tab, { title: string; desc: string }> = {
  training: { title: '培训课堂', desc: '农技专家录播课程与直播回放，手机端可继续学习。' },
  experts: { title: '认证专家', desc: '平台审核通过的农业专家，可在线提问。' },
  reports: { title: '数据报告', desc: '行情研判与产业分析报告。' },
  knowledge: { title: '农技知识库', desc: '病虫害防治、营养管理与采后处理知识。' },
}

export function InfoService({ tab }: { tab: Tab }): JSX.Element {
  usePageMeta(TAB_META[tab].title, TAB_META[tab].desc)

  return (
    <div className="info-page">
      <div className="info-chips" style={{ marginBottom: 18 }}>
        {TABS.map((item) => (
          <a
            key={item.key}
            className={`info-chip${tab === item.key ? ' on' : ''}`}
            href={`#/info/${item.key}`}
          >
            {item.label}
          </a>
        ))}
      </div>
      {tab === 'training' && <Training />}
      {tab === 'experts' && <Experts />}
      {tab === 'reports' && <Reports />}
      {tab === 'knowledge' && <KnowledgeBase />}
    </div>
  )
}

function useAsync<T>(loader: () => Promise<T>, deps: unknown[] = []): {
  data: T | null; loading: boolean; error: string
} {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    loader()
      .then((value) => { if (!cancelled) setData(value) })
      .catch((reason: Error) => { if (!cancelled) setError(reason.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return { data, loading, error }
}

function Training(): JSX.Element {
  const { data, loading, error } = useAsync(() => infoPublicApi.courses())
  const courses: Course[] = data?.items ?? []

  return (
    <>
      <div className="info-section-head">
        <h2>培训课堂 <small>专家录播课程 · 手机端可继续学习</small></h2>
        <span className="small gray">{courses.length} 门课程 · {formatCount(data?.learners)} 人次在学</span>
      </div>
      {error && <div className="info-error">{error}</div>}
      {loading && <div className="info-loading">正在加载课程…</div>}
      {!loading && courses.length === 0 && !error && <div className="info-empty">暂无课程</div>}
      <div className="info-grid-3">
        {courses.map((course) => (
          <div className="info-tile" key={course.id}>
            <div className="info-tile-ico">{course.coverIcon ?? '🎓'}</div>
            <h3>{course.title}</h3>
            <p>{course.summary}</p>
            <div className="small gray">{course.teacher} · {course.mode} · {course.duration}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }} className="small gray">
              <span>{formatCount(course.learners)} 人在学</span>
              <span>{course.rating} 分</span>
            </div>
            {course.isLive && <span className="info-chip">{course.liveAt ?? '直播课'}</span>}
          </div>
        ))}
      </div>
      <p className="portal-data-note" style={{ marginTop: 18 }}>
        观看课程需登录平台账号，移动端可在「我的 → 培训课堂」继续学习。
      </p>
    </>
  )
}

function Experts(): JSX.Element {
  const [field, setField] = useState('')
  const { data, loading, error } = useAsync(() => infoPublicApi.experts(field || undefined), [field])
  const experts: Expert[] = data?.items ?? []

  return (
    <>
      <div className="info-section-head">
        <h2>认证专家 <small>平台审核通过 · 可在线提问</small></h2>
        <span className="small gray">{experts.length} 位</span>
      </div>

      {data?.fields && data.fields.length > 0 && (
        <div className="info-chips" style={{ marginBottom: 16 }}>
          <button type="button" className={`info-chip${field === '' ? ' on' : ''}`} onClick={() => setField('')}>全部</button>
          {data.fields.map((item) => (
            <button
              type="button"
              key={item}
              className={`info-chip${field === item ? ' on' : ''}`}
              onClick={() => setField(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {error && <div className="info-error">{error}</div>}
      {loading && <div className="info-loading">正在加载专家…</div>}
      {!loading && experts.length === 0 && !error && <div className="info-empty">暂无专家</div>}

      <div className="info-grid-3">
        {experts.map((expert) => (
          <div className="info-tile" key={expert.id}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="info-tile-ico">{expert.avatarText ?? '👨‍🌾'}</div>
              <div>
                <h3 style={{ margin: 0 }}>{expert.name}</h3>
                <div className="small gray">{expert.title ?? expert.field}</div>
              </div>
            </div>
            <p>{expert.intro ?? expert.orgName}</p>
            <div className="small gray">
              {expert.orgName}
              {expert.years ? ` · 从业 ${expert.years} 年` : ''}
              {expert.answerCount ? ` · 已回答 ${formatCount(expert.answerCount)} 次` : ''}
            </div>
            {expert.tags && expert.tags.length > 0 && (
              <div className="info-chips">
                {expert.tags.slice(0, 3).map((tag) => <span className="info-chip gray" key={tag}>{tag}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function Reports(): JSX.Element {
  const [category, setCategory] = useState('')
  const { data, loading, error } = useAsync(() => infoPublicApi.reports(category || undefined), [category])
  const reports: Report[] = data?.items ?? []

  return (
    <>
      <div className="info-section-head">
        <h2>数据报告 <small>行情研判 · 产业分析</small></h2>
        <span className="small gray">{reports.length} 份</span>
      </div>

      {data?.categories && data.categories.length > 0 && (
        <div className="info-chips" style={{ marginBottom: 16 }}>
          <button type="button" className={`info-chip${category === '' ? ' on' : ''}`} onClick={() => setCategory('')}>全部</button>
          {data.categories.map((item) => (
            <button
              type="button"
              key={item}
              className={`info-chip${category === item ? ' on' : ''}`}
              onClick={() => setCategory(item)}
            >
              {item}
            </button>
          ))}
        </div>
      )}

      {error && <div className="info-error">{error}</div>}
      {loading && <div className="info-loading">正在加载报告…</div>}
      {!loading && reports.length === 0 && !error && <div className="info-empty">暂无报告</div>}

      <div className="info-grid-3">
        {reports.map((report) => (
          <div className="info-tile" key={report.id}>
            <div className="info-tile-ico">{report.coverIcon ?? '📊'}</div>
            <h3>{report.title}</h3>
            <p>{report.summary}</p>
            <div className="small gray">
              {report.category} · {report.pages ?? '—'} 页 · {report.publishDate}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <b style={{ color: 'var(--danger)' }}>{report.price ? `¥${money(report.price, 0)}` : '免费'}</b>
              <span className="small gray">下载 {formatCount(report.downloadCount)}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

function KnowledgeBase(): JSX.Element {
  const [keyword, setKeyword] = useState('')
  const [crop, setCrop] = useState('')
  const [openId, setOpenId] = useState(0)
  const [detail, setDetail] = useState<Knowledge | null>(null)
  const { data, loading, error } = useAsync(() => infoPublicApi.knowledge({
    keyword: keyword || undefined, crop: crop || undefined,
  }), [keyword, crop])
  const items: Knowledge[] = data ?? []

  useEffect(() => {
    if (!openId) { setDetail(null); return }
    infoPublicApi.knowledgeDetail(openId).then(setDetail).catch(() => setDetail(null))
  }, [openId])

  return (
    <>
      <div className="info-section-head">
        <h2>农技知识库 <small>病虫害 · 营养管理 · 采后处理</small></h2>
        <span className="small gray">{items.length} 篇</span>
      </div>

      <div className="info-filter">
        <input
          value={keyword}
          placeholder="搜症状、病害、作物"
          onChange={(event) => setKeyword(event.target.value)}
          style={{ width: 240 }}
        />
        <input
          value={crop}
          placeholder="作物（如 大蒜）"
          onChange={(event) => setCrop(event.target.value)}
          style={{ width: 160 }}
        />
      </div>

      {error && <div className="info-error">{error}</div>}
      {loading && <div className="info-loading">正在加载知识库…</div>}
      {!loading && items.length === 0 && !error && <div className="info-empty">没有匹配的知识条目</div>}

      <div className="info-card">
        {items.map((item) => (
          <div key={item.id} style={{ borderBottom: '1px dashed var(--line-2)', padding: '12px 0' }}>
            <button
              type="button"
              onClick={() => setOpenId(openId === item.id ? 0 : item.id)}
              style={{ display: 'flex', width: '100%', alignItems: 'flex-start', gap: 12, textAlign: 'left' }}
            >
              <span className="info-chip gray">{item.category ?? '农技'}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="info-news-title">{item.title}</span>
                <span className="info-news-sub" style={{ display: 'block' }}>
                  {item.crop} · {item.sourceName} · {dayLabel(item.updatedAt)} · 阅读 {formatCount(item.viewCount)}
                </span>
              </span>
              <span className="small gray">{openId === item.id ? '收起' : '展开'}</span>
            </button>

            {openId === item.id && (
              <div className="info-article-body" style={{ marginTop: 12, fontSize: 13.5 }}>
                {detail && detail.id === item.id
                  ? (detail.content ?? item.summary ?? '暂无内容').split(/\n+/).filter(Boolean).map((line, index) => (
                    <p key={index}>{line}</p>
                  ))
                  : <p className="gray">正在加载…</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
