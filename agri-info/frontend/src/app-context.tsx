import { createContext, useContext } from 'react'
import type { PageKey } from './types'

export interface RouteState {
  page: PageKey
  id?: number
  query: URLSearchParams
}

export interface AppContextValue extends RouteState {
  navigate: (page: PageKey, id?: number, query?: Record<string, string>) => void
  openSearch: (keyword: string) => void
  openMarket: (id: number) => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) {
    throw new Error('AppContext 尚未初始化')
  }
  return value
}

const PAGE_KEYS: PageKey[] = [
  'home',
  'market',
  'market-detail',
  'compare',
  'indices',
  'forecast',
  'news',
  'news-detail',
  'search',
  'sd',
  'sd-detail',
  'sd-publish',
  'sd-match',
  'ai-qa',
  'pest',
  'expert',
  'training',
  'knowledge',
  'reports',
  'attest',
  'alerts',
  'favorites',
  'expert-cert',
]

export function parseRoute(hash: string): RouteState {
  const raw = hash.replace(/^#\/?/, '')
  const [pathPart, search = ''] = raw.split('?')
  const segments = pathPart.split('/').filter(Boolean)
  const candidate = (segments[0] || 'home') as PageKey
  const page = PAGE_KEYS.includes(candidate) ? candidate : 'home'
  const numericId = segments[1] ? Number(segments[1]) : undefined
  return {
    page,
    id: Number.isFinite(numericId) ? numericId : undefined,
    query: new URLSearchParams(search),
  }
}
