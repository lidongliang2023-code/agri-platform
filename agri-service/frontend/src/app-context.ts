import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PageKey } from './types'

export interface RouteState {
  page: PageKey
  id?: number
  query: URLSearchParams
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

export const useAppStore = defineStore('service-app', () => {
  const hash = ref(window.location.hash)
  const route = computed(() => parseRoute(hash.value))
  const page = computed(() => route.value.page)
  const id = computed(() => route.value.id)
  const query = computed(() => route.value.query)

  const syncFromWindow = (): void => {
    hash.value = window.location.hash
  }

  const navigate = (targetPage: PageKey, targetId?: number, targetQuery?: Record<string, string>): void => {
    const params = new URLSearchParams(targetQuery)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    window.location.hash = `/${targetPage}${targetId === undefined ? '' : `/${targetId}`}${suffix}`
    hash.value = window.location.hash
  }

  const navigatePath = (path: string): void => {
    const normalized = path.replace(/^#?\/?/, '')
    window.location.hash = `/${normalized}`
    hash.value = window.location.hash
  }

  const openServices = (keyword?: string, category?: string): void => {
    const q: Record<string, string> = {}
    if (keyword) q.q = keyword
    if (category) q.category = category
    navigate('services', undefined, q)
  }

  return {
    hash,
    route,
    page,
    id,
    query,
    syncFromWindow,
    navigate,
    navigatePath,
    openServices,
  }
})
