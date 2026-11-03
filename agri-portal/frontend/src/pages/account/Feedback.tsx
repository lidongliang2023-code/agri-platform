/**
 * 用户中心 · 意见反馈
 *
 * <p>数据来自 `GET /api/v1/sso/account/feedback`：返回**类型目录**（由后端下发，前端不留第二份）
 * 和**我提交过的反馈**。运营回复后，回复内容直接显示在列表里，不靠用户自己去翻站内信。</p>
 *
 * <p>为什么回复内容要在本页可见：站内信可以被用户删掉，反馈单不会 ——
 * 用户回头想确认"平台到底怎么答复的"，这里必须查得到。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface FeedbackType {
  code: string
  label: string
}

interface FeedbackRow {
  id: string
  feedbackType: string
  title: string
  content: string
  contact: string | null
  pagePath: string | null
  status: string
  replyContent: string | null
  replierName: string | null
  submitTime: string | null
  replyTime: string | null
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  })
  const body = (await response.json()) as ApiBody<T>
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

/** 单据状态展示元数据 */
const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: '待处理', className: 'pending' },
  replied: { label: '已回复', className: 'replied' },
  closed: { label: '已关闭', className: 'closed' },
}

interface FeedbackForm {
  feedbackType: string
  title: string
  content: string
  contact: string
}

const EMPTY_FORM: FeedbackForm = {
  feedbackType: 'suggestion',
  title: '',
  content: '',
  contact: '',
}

/** 当前所在页面，随反馈一起提交，便于运营定位问题 */
function currentPagePath(): string {
  return `${window.location.pathname}${window.location.hash}`
}

/**
 * 意见反馈页面
 *
 * @returns 页面内容
 */
export function Feedback(): JSX.Element {
  const [types, setTypes] = useState<FeedbackType[]>([])
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [form, setForm] = useState<FeedbackForm | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await api<{ types?: FeedbackType[]; records?: FeedbackRow[] }>(
        '/api/v1/sso/account/feedback',
      )
      setTypes(data?.types ?? [])
      setRows(data?.records ?? [])
    } catch (e) {
      setError((e as Error).message || '反馈加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const openForm = (): void => {
    setForm({ ...EMPTY_FORM, feedbackType: types[0]?.code ?? 'suggestion' })
    setNotice('')
    setError('')
  }

  const submit = async (): Promise<void> => {
    if (!form) return
    if (!form.title.trim()) {
      setError('请填写反馈标题')
      return
    }
    if (!form.content.trim()) {
      setError('请填写反馈内容')
      return
    }
    setSaving(true)
    setError('')
    try {
      await api('/api/v1/sso/account/feedback', {
        method: 'POST',
        body: JSON.stringify({
          feedbackType: form.feedbackType,
          title: form.title.trim(),
          content: form.content.trim(),
          contact: form.contact.trim() || null,
          pagePath: currentPagePath(),
        }),
      })
      setNotice('反馈已提交，运营回复后会在这里显示')
      setForm(null)
      await load()
    } catch (e) {
      setError((e as Error).message || '提交失败')
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = (code: string): string =>
    types.find((type) => type.code === code)?.label ?? code
  const pendingCount = rows.filter((row) => row.status === 'pending').length
  const repliedCount = rows.filter((row) => row.status === 'replied').length

  return (
    <div className="uc-fb">
      <div className="uc-fb-head">
        <div>
          <strong>
            我的反馈 {rows.length} 条 · 待处理 {pendingCount} · 已回复 {repliedCount}
          </strong>
          <small>功能建议、问题报错、投诉举报都可以在这里提交，运营回复后本页可见</small>
        </div>
        <div className="uc-fb-actions">
          <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
            刷新
          </button>
          <button className="btn btn-primary btn-sm" onClick={openForm} disabled={saving}>
            提交反馈
          </button>
        </div>
      </div>

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载反馈…</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="card empty">
          还没有提交过反馈。遇到问题或想提建议，点右上角「提交反馈」。
        </div>
      )}

      {!loading && rows.length > 0 && (
        <ul className="uc-fb-list">
          {rows.map((row) => {
            const meta = STATUS_META[row.status] ?? STATUS_META.pending
            return (
              <li key={row.id}>
                <div className="uc-fb-top">
                  <span className="uc-fb-type">{typeLabel(row.feedbackType)}</span>
                  <strong className="uc-fb-title">{row.title}</strong>
                  <span className={`uc-fb-status ${meta.className}`}>{meta.label}</span>
                </div>
                <p className="uc-fb-content">{row.content}</p>
                <div className="uc-fb-meta">
                  <span>提交于 {(row.submitTime ?? '').replace('T', ' ').slice(0, 16)}</span>
                  {row.pagePath && <span>来源 {row.pagePath}</span>}
                </div>
                {row.replyContent && (
                  <div className="uc-fb-reply">
                    <span className="uc-fb-reply-who">
                      <Icon name="bell" size={13} /> {row.replierName || '平台运营'} 回复
                      {row.replyTime ? `　${row.replyTime.replace('T', ' ').slice(0, 16)}` : ''}
                    </span>
                    <p>{row.replyContent}</p>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {form && (
        <div className="uc-fb-mask" onClick={() => !saving && setForm(null)}>
          <div className="uc-fb-modal" onClick={(event) => event.stopPropagation()}>
            <h3>提交反馈</h3>
            <label>
              反馈类型
              <select
                value={form.feedbackType}
                onChange={(event) => setForm({ ...form, feedbackType: event.target.value })}
              >
                {types.map((type) => (
                  <option key={type.code} value={type.code}>
                    {type.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              标题
              <input
                value={form.title}
                maxLength={120}
                placeholder="一句话说明问题，例如「地块列表翻页后回到第一页」"
                onChange={(event) => setForm({ ...form, title: event.target.value })}
              />
            </label>
            <label>
              详细描述
              <textarea
                value={form.content}
                maxLength={2000}
                rows={5}
                placeholder="复现步骤、期望结果、实际结果；有报错信息请一并贴上来"
                onChange={(event) => setForm({ ...form, content: event.target.value })}
              />
            </label>
            <label>
              联系方式（选填）
              <input
                value={form.contact}
                maxLength={64}
                placeholder="手机号或邮箱，便于进一步沟通"
                onChange={(event) => setForm({ ...form, contact: event.target.value })}
              />
            </label>
            <p className="uc-fb-tip">
              提交时会自动带上当前页面地址，方便运营复现；不需要的话可以忽略。
            </p>
            <div className="uc-fb-modal-actions">
              <button className="btn btn-outline btn-sm" onClick={() => setForm(null)} disabled={saving}>
                取消
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => void submit()} disabled={saving}>
                {saving ? '提交中…' : '提交'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
