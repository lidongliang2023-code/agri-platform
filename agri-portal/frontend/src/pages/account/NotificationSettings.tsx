/**
 * 用户中心 · 通知设置
 *
 * <p>数据来自 `GET/PUT /api/v1/sso/account/notification-settings`。
 * 类型目录与渠道清单由**后端下发**，前端不再自己维护一套 —— 否则新增一个通知类型时
 * 两边必然有一处漏改。</p>
 *
 * <p><b>诚实性</b>：三个渠道里只有「站内信」真的接通了（平台 MessageFacade 写 platform_message）；
 * 短信/推送只存偏好、不会真的发出去。类型里的 order / alert / system 同理 ——
 * 对应业务域还没接消息门面，配了也收不到。这些都在界面上明确标出来，不用"看起来能用"糊弄。</p>
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { JSX } from 'react'
import { Icon } from '@/components/Icon'

interface NotifyType {
  code: string
  label: string
  /** 该类型现在是否真的会产生消息 */
  produces: boolean
  inapp: boolean
  sms: boolean
  push: boolean
}

interface NotifyChannel {
  code: 'inapp' | 'sms' | 'push'
  label: string
  /** 该渠道是否已接入 */
  wired: boolean
}

interface SettingsPayload {
  persisted: boolean
  types: NotifyType[]
  channels: NotifyChannel[]
  quietStart: string | null
  quietEnd: string | null
  digest: string
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

const DIGEST_OPTIONS = [
  { value: 'realtime', label: '实时推送' },
  { value: 'daily', label: '每日汇总' },
  { value: 'weekly', label: '每周汇总' },
]

/**
 * 通知设置页面
 *
 * @returns 页面内容
 */
export function NotificationSettings(): JSX.Element {
  const [payload, setPayload] = useState<SettingsPayload | null>(null)
  const [types, setTypes] = useState<NotifyType[]>([])
  const [quietStart, setQuietStart] = useState('')
  const [quietEnd, setQuietEnd] = useState('')
  const [digest, setDigest] = useState('realtime')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const load = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError('')
    try {
      const data = await api<SettingsPayload>('/api/v1/sso/account/notification-settings')
      setPayload(data)
      setTypes(data?.types ?? [])
      setQuietStart(data?.quietStart ?? '')
      setQuietEnd(data?.quietEnd ?? '')
      setDigest(data?.digest ?? 'realtime')
    } catch (e) {
      setError((e as Error).message || '通知设置加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const channels = payload?.channels ?? []

  /** 切换某个类型在某个渠道上的开关 */
  const toggle = (code: string, channel: 'inapp' | 'sms' | 'push'): void => {
    setTypes((prev) => prev.map((item) => (item.code === code ? { ...item, [channel]: !item[channel] } : item)))
  }

  /** 已开启数量（用于顶部摘要） */
  const summary = useMemo(() => {
    const inapp = types.filter((item) => item.inapp).length
    return { inapp, total: types.length }
  }, [types])

  const save = async (): Promise<void> => {
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await api('/api/v1/sso/account/notification-settings', {
        method: 'PUT',
        body: JSON.stringify({
          inappTypes: types.filter((item) => item.inapp).map((item) => item.code),
          smsTypes: types.filter((item) => item.sms).map((item) => item.code),
          pushTypes: types.filter((item) => item.push).map((item) => item.code),
          quietStart: quietStart || null,
          quietEnd: quietEnd || null,
          digest,
        }),
      })
      setNotice('通知设置已保存')
      await load()
    } catch (e) {
      setError((e as Error).message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="card empty">正在加载通知设置…</div>

  return (
    <div className="uc-notify">
      <div className="uc-notify-head">
        <div>
          <strong>站内信已开启 {summary.inapp} / {summary.total} 类</strong>
          <small>只有勾选的类型才会给你发通知</small>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => void save()} disabled={saving}>
          {saving ? '保存中…' : '保存设置'}
        </button>
      </div>

      {notice && <div className="account-notice">{notice}</div>}
      {error && <div className="account-error">{error}</div>}

      {/* 通知矩阵 */}
      <div className="uc-notify-matrix">
        <table>
          <thead>
            <tr>
              <th>通知类型</th>
              {channels.map((channel) => (
                <th key={channel.code}>
                  {channel.label}
                  {!channel.wired && <span className="uc-notify-nowire">未接入</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type.code}>
                <td>
                  {type.label}
                  {!type.produces && <span className="uc-notify-nomsg">暂不产生消息</span>}
                </td>
                {channels.map((channel) => {
                  const key = channel.code as 'inapp' | 'sms' | 'push'
                  return (
                    <td key={channel.code}>
                      <label className={`uc-notify-check ${!channel.wired ? 'disabled' : ''}`}>
                        <input
                          type="checkbox"
                          checked={Boolean(type[key])}
                          disabled={!channel.wired}
                          onChange={() => toggle(type.code, key)}
                        />
                        <span />
                      </label>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="uc-notify-extra">
        <div className="uc-notify-block">
          <h4>免打扰时段</h4>
          <p>该时段内不发送通知（站内信仍会入库，只是不打扰你）。留空表示不启用。</p>
          <div className="uc-notify-times">
            <input
              type="time"
              value={quietStart}
              onChange={(event) => setQuietStart(event.target.value)}
            />
            <span>至</span>
            <input type="time" value={quietEnd} onChange={(event) => setQuietEnd(event.target.value)} />
          </div>
        </div>

        <div className="uc-notify-block">
          <h4>推送频率</h4>
          <p>实时推送会即时通知；汇总模式把一段时间内的通知合并成一条。</p>
          <div className="uc-notify-digest">
            {DIGEST_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={digest === option.value ? 'on' : ''}
                onClick={() => setDigest(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="uc-msg-foot">
        <Icon name="alert" size={13} />
        <span>
          当前只有<strong>站内信</strong>接通（消息中心可查看）；短信与推送渠道尚未接入，勾选只会保存偏好。
          标注「暂不产生消息」的类型，对应业务域还没接消息门面。
        </span>
      </p>
    </div>
  )
}
