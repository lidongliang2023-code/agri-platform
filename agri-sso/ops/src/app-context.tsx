import { createContext, useContext } from 'react'
import type { OpsPageKey } from './types'

export interface RouteState {
  page: OpsPageKey
  id?: string
  query: URLSearchParams
}

export interface AppContextValue extends RouteState {
  navigate: (page: OpsPageKey, id?: string, query?: Record<string, string>) => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) {
    throw new Error('AppContext 尚未初始化')
  }
  return value
}

/**
 * 页面枚举。
 *
 * <p>详情页（user-detail / org-detail）也在列表里 —— 它们靠 hash 里的 id 定位，
 * 不做成"父页面里的一个弹窗"，因为运营经常要把某个用户详情链接发给同事核对。</p>
 */
const PAGE_KEYS: OpsPageKey[] = [
  'dashboard',
  'user-list',
  'user-detail',
  'user-identity',
  'identity-audit',
  'realname-audit',
  'qualification-audit',
  'org-list',
  'org-detail',
  'org-audit',
  'role-list',
  'perm-matrix',
  'auth-app',
  'auth-record',
  'message-push',
  'message-template',
  'security-risk',
  'device-log',
  'account-freeze',
  'privacy-request',
  'feedback-manage',
  'stats',
  'health-monitor',
  'config',
  'audit-log',
]

export function parseRoute(hash: string): RouteState {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, search = ''] = raw.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const candidate = (segments[0] || 'dashboard') as OpsPageKey
  const page = PAGE_KEYS.includes(candidate) ? candidate : 'dashboard'
  // 用户 / 组织 ID 是雪花 ID（19 位），超出 Number 安全整数范围，
  // 必须按字符串透传，转成 number 会丢精度导致查不到人。
  const id = segments[1] ? decodeURIComponent(segments[1]) : undefined
  return { page, id, query: new URLSearchParams(search) }
}
