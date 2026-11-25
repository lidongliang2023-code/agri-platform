import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { OpsPageKey } from './types'

export interface RouteState {
  page: OpsPageKey
  id?: string
  query: URLSearchParams
}

const PAGE_KEYS: OpsPageKey[] = [
  'dashboard',
  'audit-workbench',
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
  const id = segments[1] ? decodeURIComponent(segments[1]) : undefined
  return { page, id, query: new URLSearchParams(search) }
}

export const useAppStore = defineStore('uc-ops-app', () => {
  const hash = ref(window.location.hash)
  const route = computed(() => parseRoute(hash.value))
  const page = computed(() => route.value.page)
  const id = computed(() => route.value.id)
  const query = computed(() => route.value.query)

  const syncFromWindow = () => {
    hash.value = window.location.hash
  }

  const navigate = (targetPage: OpsPageKey, targetId?: string, targetQuery?: Record<string, string>) => {
    const params = new URLSearchParams(targetQuery)
    const suffix = params.toString() ? `?${params.toString()}` : ''
    window.location.hash = `/${targetPage}${targetId === undefined ? '' : `/${targetId}`}${suffix}`
    hash.value = window.location.hash
  }

  const navigatePath = (path: string) => {
    window.location.hash = `/${path.replace(/^#?\/?/, '')}`
    hash.value = window.location.hash
  }

  return { hash, route, page, id, query, syncFromWindow, navigate, navigatePath }
})
