/**
 * 用户中心 · 帮助中心
 *
 * <p>两块内容：</p>
 * <ol>
 *   <li><b>常见问题</b> —— 由后端下发，答案描述的都是系统当前的真实行为
 *       （短信未接入、身份审核不改权限、注销不立即生效…），不是营销话术</li>
 *   <li><b>资料入口 + 最新资料</b> —— 正文在资讯域，这里只聚合标题与入口，
 *       不搬运正文（用户中心不该成为资讯的第二个副本）</li>
 * </ol>
 *
 * <p>资讯接口成功码是 **200**（不是平台侧的 0），两个都认。</p>
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface HelpQa {
  question: string
  answer: string
  relatedView: string | null
}

interface HelpGroup {
  category: string
  items: HelpQa[]
}

interface HelpResource {
  code: string
  name: string
  description: string
  entryUrl: string
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' })
  const body = (await response.json()) as ApiBody<T>
  const ok = body.code === 0 || body.code === 200
  if (!response.ok || !ok) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

interface InfoItem {
  id: number
  title: string
  summary?: string | null
  category?: string | null
}

/** 资讯域两种返回形态：知识库直接是数组，课程是 { items } */
function toItems(payload: unknown): InfoItem[] {
  if (Array.isArray(payload)) return payload as InfoItem[]
  const items = (payload as { items?: InfoItem[] })?.items
  return Array.isArray(items) ? items : []
}

/**
 * 帮助中心页面
 *
 * @returns 页面内容
 */
export function HelpCenter(): JSX.Element {
  const [groups, setGroups] = useState<HelpGroup[]>([])
  const [resources, setResources] = useState<HelpResource[]>([])
  const [contact, setContact] = useState<{ title: string; description: string; entryView: string } | null>(null)
  const [faqCount, setFaqCount] = useState(0)
  const [knowledge, setKnowledge] = useState<InfoItem[]>([])
  const [courses, setCourses] = useState<InfoItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [openIndex, setOpenIndex] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [infoNote, setInfoNote] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    setInfoNote('')
    try {
      const data = await fetchJson<{
        faqs?: HelpGroup[]
        resources?: HelpResource[]
        faqCount?: number | string
        contact?: { title: string; description: string; entryView: string }
      }>('/api/v1/sso/account/help')
      setGroups(data?.faqs ?? [])
      setResources(data?.resources ?? [])
      setContact(data?.contact ?? null)
      setFaqCount(Number(data?.faqCount ?? 0))

      /* 资讯域是公开内容，取不到不影响帮助中心主体，只是不显示"最新资料" */
      try {
        const [k, c] = await Promise.all([
          fetchJson<unknown>('/api/v1/info/public/knowledge?pageNum=1&pageSize=5'),
          fetchJson<unknown>('/api/v1/info/public/courses?pageNum=1&pageSize=5'),
        ])
        setKnowledge(toItems(k).slice(0, 5))
        setCourses(toItems(c).slice(0, 5))
      } catch {
        setInfoNote('资讯服务暂时不可用，资料入口仍可点开查看')
      }
    } catch (e) {
      setError((e as Error).message || '帮助内容加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** 搜索：命中问题或答案任一即可，保持原有分组 */
  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    if (!kw) return groups
    return groups
      .map((group) => ({
        category: group.category,
        items: group.items.filter(
          (item) =>
            item.question.toLowerCase().includes(kw) || item.answer.toLowerCase().includes(kw),
        ),
      }))
      .filter((group) => group.items.length > 0)
  }, [groups, keyword])

  const hitCount = filtered.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <div className="uc-hp">
      <div className="uc-hp-head">
        <div>
          <strong>
            常见问题 {faqCount} 条 · 资料入口 {resources.length} 个
          </strong>
          <small>答案描述的都是系统当前的真实行为；没做到的事会直说，不含糊</small>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>

      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载帮助内容…</div>}

      {!loading && !error && (
        <>
          <div className="uc-hp-search">
            <Icon name="search" size={14} />
            <input
              value={keyword}
              placeholder="搜索问题关键词，例如「注销」「订单为空」「短信」"
              onChange={(event) => setKeyword(event.target.value)}
            />
            {keyword && (
              <button className="uc-hp-clear" onClick={() => setKeyword('')}>
                清除
              </button>
            )}
          </div>
          {keyword && (
            <p className="uc-hp-hit">
              命中 {hitCount} 条{hitCount === 0 ? '，换个关键词试试，或直接提交反馈' : ''}
            </p>
          )}

          {filtered.length === 0 && keyword ? (
            <div className="card empty">没有匹配的问题。把问题描述清楚提交反馈，运营会回复。</div>
          ) : (
            filtered.map((group) => (
              <div className="uc-hp-group" key={group.category}>
                <h4>{group.category}</h4>
                <ul>
                  {group.items.map((item) => {
                    const key = `${group.category}-${item.question}`
                    const open = openIndex === key
                    return (
                      <li key={key} className={open ? 'on' : ''}>
                        <button
                          className="uc-hp-q"
                          onClick={() => setOpenIndex(open ? '' : key)}
                          aria-expanded={open}
                        >
                          <span>{item.question}</span>
                          <Icon name={open ? 'close' : 'plus'} size={13} />
                        </button>
                        {open && (
                          <div className="uc-hp-a">
                            <p>{item.answer}</p>
                            {item.relatedView && (
                              <a href={`#/account/${item.relatedView}`} className="uc-hp-link">
                                去相关页面
                              </a>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}

          {infoNote && <div className="account-notice">{infoNote}</div>}

          <div className="uc-hp-res">
            <h4>可查阅的资料</h4>
            <ul>
              {resources.map((row) => (
                <li key={row.code}>
                  <a href={row.entryUrl}>
                    <Icon name="file" size={15} />
                    <span className="uc-hp-res-name">{row.name}</span>
                    <span className="uc-hp-res-desc">{row.description}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {(knowledge.length > 0 || courses.length > 0) && (
            <div className="uc-hp-latest">
              <h4>最新资料</h4>
              <div className="uc-hp-latest-cols">
                {knowledge.length > 0 && (
                  <div>
                    <span className="uc-hp-latest-tag">知识库</span>
                    <ul>
                      {knowledge.map((row) => (
                        <li key={`k-${row.id}`}>
                          <a href="#/info/knowledge">{row.title}</a>
                          {row.summary && <small>{row.summary}</small>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {courses.length > 0 && (
                  <div>
                    <span className="uc-hp-latest-tag">培训课程</span>
                    <ul>
                      {courses.map((row) => (
                        <li key={`c-${row.id}`}>
                          <a href="#/info/training">{row.title}</a>
                          {row.summary && <small>{row.summary}</small>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {contact && (
            <div className="uc-hp-contact">
              <strong>{contact.title}</strong>
              <p>{contact.description}</p>
              <a className="btn btn-primary btn-sm" href={`#/account/${contact.entryView}`}>
                去提交反馈
              </a>
            </div>
          )}

          <p className="uc-hp-foot">
            说明：常见问题随系统行为维护，改了功能会同步改这里；
            资料正文在资讯服务，本页只聚合入口与标题。
          </p>
        </>
      )}
    </div>
  )
}
