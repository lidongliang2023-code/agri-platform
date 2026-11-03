/**
 * 用户中心 · 消息中心
 *
 * <p>数据来自平台侧已有的 {@code GET /api/v1/messages}（读 {@code agri_core.platform_message}），
 * 不新建消息表 —— 平台早就有站内信门面 {@code MessageFacade}，再建一张就是重复造轮子。</p>
 *
 * <p>消息的真实来源（本轮接通的）：
 * 有人申请加入你负责的经营主体 → 通知负责人；申请被审核 → 通知申请人。
 * 两条都在 `SsoAccountController` 的加入申请流程里写入。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'
import { getPlatformAccessToken } from '../../utils/platformToken'

interface MessageRow {
  id: number | string
  title: string | null
  content: string | null
  readFlag: number
  createdAt: string
}

interface PageBody<T> {
  code: number
  message?: string
  data?: { records?: T[]; list?: T[]; total?: number | string }
}

/**
 * 统一取数。
 *
 * <p>⚠️ `/api/v1/messages` 认的是**平台访问令牌（Bearer）**，不是 SSO 会话 Cookie ——
 * 只用 Cookie 调会 401。门户里已经有换取短时令牌的工具（`platformToken`，
 * 走 HttpOnly 刷新凭证换 accessToken），这里复用它，不另造一套鉴权。</p>
 */
async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getPlatformAccessToken()
  const response = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  })
  const body = (await response.json()) as PageBody<T> | { code: number; data?: T; message?: string }
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

/**
 * 消息中心页面
 *
 * @returns 页面内容
 */
export function Messages(): JSX.Element {
  const [rows, setRows] = useState<MessageRow[]>([])
  const [total, setTotal] = useState(0)
  const [unread, setUnread] = useState(0)
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const size = 20

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const [list, count] = await Promise.all([
        api<{ records?: MessageRow[]; list?: MessageRow[]; total?: number | string }>(
          `/api/v1/messages?page=${page}&size=${size}`,
        ),
        api<number>('/api/v1/messages/unread-count').catch(() => 0),
      ])
      setRows(list?.records ?? list?.list ?? [])
      setTotal(Number(list?.total ?? 0))
      setUnread(Number(count ?? 0))
    } catch (e) {
      setError((e as Error).message || '消息加载失败')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  /** 标记已读：先本地更新让点击立刻有反馈，再回写服务端 */
  const markRead = async (row: MessageRow): Promise<void> => {
    if (row.readFlag === 1) return
    setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, readFlag: 1 } : item)))
    setUnread((prev) => Math.max(0, prev - 1))
    try {
      await api(`/api/v1/messages/${row.id}/read`, { method: 'POST' })
    } catch {
      // 回写失败就回滚，避免"看起来读了、下次刷新又变未读"
      setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, readFlag: 0 } : item)))
      setUnread((prev) => prev + 1)
    }
  }

  const visible = onlyUnread ? rows.filter((item) => item.readFlag !== 1) : rows
  const totalPages = Math.max(1, Math.ceil(total / size))

  return (
    <div className="uc-msg">
      <div className="uc-msg-head">
        <div className="uc-msg-tabs">
          <button
            type="button"
            className={onlyUnread ? '' : 'on'}
            onClick={() => setOnlyUnread(false)}
          >
            全部消息
          </button>
          <button
            type="button"
            className={onlyUnread ? 'on' : ''}
            onClick={() => setOnlyUnread(true)}
          >
            仅看未读{unread > 0 ? `（${unread}）` : ''}
          </button>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()}>
          刷新
        </button>
      </div>

      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载消息…</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="card empty">
          {onlyUnread ? '没有未读消息' : '暂无消息。当有人申请加入你负责的主体、或你的申请被审核时，这里会收到通知。'}
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <ul className="uc-msg-list">
          {visible.map((row) => (
            <li
              key={row.id}
              className={row.readFlag === 1 ? '' : 'unread'}
              onClick={() => void markRead(row)}
            >
              <span className="uc-msg-dot" />
              <div className="uc-msg-body">
                <div className="uc-msg-title">
                  <strong>{row.title || '通知'}</strong>
                  <small>{String(row.createdAt ?? '').slice(0, 16)}</small>
                </div>
                <p>{row.content || ''}</p>
              </div>
              {row.readFlag !== 1 && <span className="uc-msg-badge">未读</span>}
            </li>
          ))}
        </ul>
      )}

      {!loading && !error && total > size && (
        <div className="uc-msg-pager">
          <button
            className="btn btn-outline btn-sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            上一页
          </button>
          <span>
            第 {page} / {totalPages} 页 · 共 {total} 条
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            下一页
          </button>
        </div>
      )}

      <p className="uc-msg-foot">
        <Icon name="alert" size={13} />
        <span>
          站内信由平台统一投递（{'{'}MessageFacade{'}'}）。短信/推送渠道尚未接入，当前只在这里可见。
        </span>
      </p>
    </div>
  )
}
