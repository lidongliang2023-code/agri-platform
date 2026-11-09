import { createContext, useContext } from 'react'
import type { OpsPageKey } from './types'

export interface RouteState {
  page: OpsPageKey
  id?: number
  query: URLSearchParams
}

export interface AppContextValue extends RouteState {
  navigate: (page: OpsPageKey, id?: number, query?: Record<string, string>) => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) {
    throw new Error('AppContext 尚未初始化')
  }
  return value
}

const PAGE_KEYS: OpsPageKey[] = [
  'green-supply',
  'cloud-factories',
  'dashboard',
  'contents',
  'channels',
  'courses',
  'quotes',
  'supply-demands',
  'recommend',
  'ai',
  'reports',
  'experts',
  'attestations',
  'stats',
  'audit-logs',
]

export function parseRoute(hash: string): RouteState {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, search = ''] = raw.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const candidate = (segments[0] || 'dashboard') as OpsPageKey
  const page = PAGE_KEYS.includes(candidate) ? candidate : 'dashboard'
  const numericId = segments[1] ? Number(segments[1]) : undefined
  return {
    page,
    id: Number.isFinite(numericId) ? numericId : undefined,
    query: new URLSearchParams(search),
  }
}
