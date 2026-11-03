/**
 * 用户中心 · 操作日志
 *
 * <p>数据来自 `GET /api/v1/sso/account/operation-logs`：只返回**本人**的记录。
 * 这不是运维审计台 —— 用户在这里看到的应该是"我最近做了什么"，不是"谁改了什么"。</p>
 *
 * <p>当前已埋点的动作：登录、改密码、换手机、改资料、绑定/解绑第三方、通知设置、下线设备。
 * 没埋点的动作不会出现在这里 —— 与其补一条假记录，不如让列表短一点。</p>
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface LogRow {
  id: string
  action: string
  actionLabel: string
  target: string | null
  detail: string | null
  ip: string | null
  result: string
  createdAt: string | null
}

interface PagePayload {
  records?: LogRow[]
  total?: number | string
  page?: number
  size?: number
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

async function api<T>(path: string): Promise<T> {
  const response = await fetch(path, { credentials: 'include' })
  const body = (await response.json()) as ApiBody<T>
  if (!response.ok || body.code !== 0) {
    throw new Error(body.message || '请求失败')
  }
  return body.data as T
}

/** 安全类动作：改密 / 换手机 / 下线设备 / 登录 */
const SECURITY_ACTIONS = ['login', 'password_change', 'phone_change', 'session_revoke']

/**
 * 操作日志页面
 *
 * @returns 页面内容
 */
export function OperationLogs(): JSX.Element {
  const [rows, setRows] = useState<LogRow[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [onlySecurity, setOnlySecurity] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const size = 20

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await api<PagePayload>(
        `/api/v1/sso/account/operation-logs?pageNum=${page}&pageSize=${size}`,
      )
      setRows(data?.records ?? [])
      setTotal(Number(data?.total ?? 0))
    } catch (e) {
      setError((e as Error).message || '操作日志加载失败')
    } finally {
      setLoading(false)
    }
  }, [page])

  useEffect(() => {
    void load()
  }, [load])

  const visible = useMemo(
    () => (onlySecurity ? rows.filter((row) => SECURITY_ACTIONS.includes(row.action)) : rows),
    [rows, onlySecurity],
  )

  const totalPages = Math.max(1, Math.ceil(total / size))

  return (
    <div className="uc-logs">
      <div className="uc-logs-head">
        <div className="uc-logs-tabs">
          <button type="button" className={onlySecurity ? '' : 'on'} onClick={() => setOnlySecurity(false)}>
            全部操作
          </button>
          <button type="button" className={onlySecurity ? 'on' : ''} onClick={() => setOnlySecurity(true)}>
            仅安全类
          </button>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={loading}>
          刷新
        </button>
      </div>

      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载操作日志…</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="card empty">
          {onlySecurity ? '没有安全类操作记录' : '暂无操作记录。登录、改密、换手机、绑定第三方等动作会记录在这里。'}
        </div>
      )}

      {!loading && !error && visible.length > 0 && (
        <div className="uc-logs-wrap">
          <table className="uc-logs-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作</th>
                <th>对象</th>
                <th>说明</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td className="uc-logs-time">{String(row.createdAt ?? '').replace('T', ' ').slice(0, 19)}</td>
                  <td>
                    <span className={`uc-logs-tag ${SECURITY_ACTIONS.includes(row.action) ? 'sec' : ''}`}>
                      {row.actionLabel}
                    </span>
                  </td>
                  <td>{row.target || '—'}</td>
                  <td className="uc-logs-detail">{row.detail || '—'}</td>
                  <td className="uc-logs-ip">{row.ip || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !error && total > size && (
        <div className="uc-msg-pager">
          <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
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
          这里只显示你自己的操作，且只包含已埋点的动作（登录 / 改密 / 换手机 / 改资料 / 绑定第三方 /
          通知设置 / 下线设备）。敏感字段（手机号）以掩码形式记录。
        </span>
      </p>
    </div>
  )
}
