import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

export type IotPage =
  | 'dashboard'
  | 'monitor'
  | 'devices'
  | 'gateways'
  | 'plots'
  | 'alerts'
  | 'automation'
  | 'analytics'
  | 'maintenance'
  | 'messages'

export const IOT_PAGES: IotPage[] = [
  'dashboard',
  'monitor',
  'devices',
  'gateways',
  'plots',
  'alerts',
  'automation',
  'analytics',
  'maintenance',
  'messages',
]

export const IOT_TITLES: Record<IotPage, string> = {
  dashboard: '监测工作台',
  monitor: '实时监测大屏',
  devices: '设备管理',
  gateways: '边缘网关',
  plots: '地块监测',
  alerts: '预警中心',
  automation: '场景与自动化',
  analytics: '数据分析',
  maintenance: '运维与 OTA',
  messages: '消息中心',
}

export function normalizeIotPath(pathname: string): IotPage {
  if (pathname.replace(/\/+$/, '') === '/alert-rules') return 'alerts'
  const key = pathname.replace(/^\//, '').split('/')[0] as IotPage
  return IOT_PAGES.includes(key) ? key : 'dashboard'
}

export const useIotRouteStore = defineStore('iot-web-route', () => {
  const pathname = ref(window.location.pathname)
  const search = ref(window.location.search)
  const hash = ref(window.location.hash)

  const syncFromWindow = () => {
    pathname.value = window.location.pathname
    search.value = window.location.search
    hash.value = window.location.hash
  }

  const page = computed<IotPage>(() => normalizeIotPath(pathname.value))
  const searchParams = computed(() => new URLSearchParams(search.value))
  const activePath = computed(() => `${pathname.value.replace(/^\/+/, '')}${search.value}`)

  const navigate = (to: string, opts?: { replace?: boolean }) => {
    const normalized = to.startsWith('/') ? to : `/${to}`
    if (opts?.replace) {
      window.history.replaceState({}, '', normalized)
    } else {
      window.history.pushState({}, '', normalized)
    }
    syncFromWindow()
  }

  return {
    pathname,
    search,
    hash,
    page,
    searchParams,
    activePath,
    syncFromWindow,
    navigate,
  }
})
