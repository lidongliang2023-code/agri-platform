import { createContext, useContext } from 'react'
import type { PageKey } from './types'

export interface RouteState {
  page: PageKey
  id?: number
  query: URLSearchParams
}

export interface AppContextValue extends RouteState {
  navigate: (page: PageKey, id?: number, query?: Record<string, string>) => void
  openServices: (keyword?: string, category?: string) => void
}

export const AppContext = createContext<AppContextValue | null>(null)

export function useApp(): AppContextValue {
  const value = useContext(AppContext)
  if (!value) {
    throw new Error('AppContext is unavailable')
  }
  return value
}

const PAGE_KEYS: PageKey[] = [
  'home',
  'services',
  'provider',
  'orders',
  'order-detail',
  'demand',
  'insurance',
  'policies',
  'training',
  'consult',
  'ai-diagnose',
  'resources',
  'messages',
  'join',
  'contracts',
  'complaints',
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
