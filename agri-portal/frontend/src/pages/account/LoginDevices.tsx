/**
 * 用户中心 · 登录设备
 *
 * <p>数据来自 `GET /api/v1/sso/account/sessions`：会话真身在 Redis，
 * 接口只返回设备名（服务端解析 UA）、IP、登录时间与「是否本机」。
 * **前端拿不到也拿不到原始 sid** —— 接口只给哈希标识。</p>
 *
 * <p>安全取舍：本机不允许在列表里"下线自己"（那等于点了就掉线，体验很怪），
 * 要退出请用右上角的退出登录；这里只处理"踢掉别的设备"。</p>
 */
import { useCallback, useEffect, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface SessionRow {
  sessionKey: string
  device: string
  ip: string
  loginAt: number
  current: boolean
}

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

/** 账号中心系列接口认 SSO 会话 Cookie，不需要 Bearer */
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

/**
 * 时间戳 → 相对时间。
 *
 * @param millis 毫秒时间戳
 * @returns 例如「3 分钟前」
 */
function relative(millis: number): string {
  if (!millis) return '未知'
  const diff = Date.now() - millis
  if (diff < 60_000) return '刚刚'
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.floor(hours / 24)} 天前`
}

/**
 * 登录设备页面
 *
 * @returns 页面内容
 */
export function LoginDevices(): JSX.Element {
  const [rows, setRows] = useState<SessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await api<{ records?: SessionRow[]; total?: number }>('/api/v1/sso/account/sessions')
      setRows(data?.records ?? [])
    } catch (e) {
      setError((e as Error).message || '登录设备加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  /** 下线单台设备 */
  const revoke = async (row: SessionRow): Promise<void> => {
    setBusy(true)
    setNotice('')
    try {
      await api(`/api/v1/sso/account/sessions/${row.sessionKey}`, { method: 'DELETE' })
      setNotice(`已下线：${row.device}`)
      await load()
    } catch (e) {
      setError((e as Error).message || '下线失败')
    } finally {
      setBusy(false)
    }
  }

  /** 退出其他所有设备 */
  const revokeOthers = async (): Promise<void> => {
    setBusy(true)
    setNotice('')
    try {
      const data = await api<{ revoked?: number }>('/api/v1/sso/account/sessions', { method: 'DELETE' })
      setNotice(`已退出其他设备 ${data?.revoked ?? 0} 台`)
      await load()
    } catch (e) {
      setError((e as Error).message || '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const others = rows.filter((row) => !row.current)

  return (
    <div className="uc-devices">
      <div className="uc-devices-head">
        <div>
          <strong>共 {rows.length} 台设备在线</strong>
          <small>这些设备当前持有你账号的有效登录会话</small>
        </div>
        <div className="uc-devices-actions">
          <button className="btn btn-outline btn-sm" onClick={() => void load()} disabled={busy}>
            刷新
          </button>
          <button
            className="btn btn-outline btn-sm"
            onClick={() => void revokeOthers()}
            disabled={busy || others.length === 0}
            title={others.length === 0 ? '没有其他设备在线' : ''}
          >
            退出其他设备
          </button>
        </div>
      </div>

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}
      {loading && <div className="card empty">正在加载登录设备…</div>}

      {!loading && !error && rows.length === 0 && (
        <div className="card empty">没有查询到有效会话。若刚退出过登录，重新登录后会出现在这里。</div>
      )}

      {!loading && !error && rows.length > 0 && (
        <ul className="uc-device-list">
          {rows.map((row) => (
            <li key={row.sessionKey} className={row.current ? 'on' : ''}>
              <span className="uc-device-icon">
                <Icon name={row.device.includes('iOS') || row.device.includes('Android') ? 'phone' : 'cpu'} size={18} />
              </span>
              <div className="uc-device-body">
                <div className="uc-device-title">
                  <strong>{row.device}</strong>
                  {row.current && <span className="tag tag-tech">本机</span>}
                </div>
                <small>
                  IP {row.ip || '未知'} · {relative(row.loginAt)}登录
                </small>
              </div>
              {row.current ? (
                <span className="uc-device-hint">当前会话</span>
              ) : (
                <button className="btn btn-outline btn-sm" disabled={busy} onClick={() => void revoke(row)}>
                  下线
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="uc-msg-foot">
        <Icon name="alert" size={13} />
        <span>
          发现不认识的设备请立即下线并修改密码。会话标识以哈希形式展示，不会暴露登录凭据本身。
        </span>
      </p>
    </div>
  )
}
