import { computed, onMounted, onUnmounted, ref } from 'vue'
import axios from 'axios'
import { attachUnifiedAuth, redirectToSso } from './sso'

export interface BusinessSubjectItem {
  merchantId: string
  merchantName?: string
  status?: number
}

export interface BusinessSubjectSummary {
  activeMerchantId?: string
  merchants: BusinessSubjectItem[]
}

const account = axios.create({ baseURL: '/api/v1/sso/account', timeout: 15000, withCredentials: true })
attachUnifiedAuth(account, 'iot')

async function request<T>(url: string, method: 'get' | 'post' = 'get', signal?: AbortSignal): Promise<T> {
  const response = await account.request({ url, method, ...(method === 'post' ? { data: {} } : {}), signal })
  if (![0, 200].includes(response.data?.code) || !response.data?.data) {
    throw new Error(response.data?.message || '经营主体服务返回异常')
  }
  return response.data.data as T
}

function errorMessage(error: unknown): string {
  return axios.isAxiosError(error)
    ? (error.response?.data as { message?: string } | undefined)?.message || '经营主体服务暂时无法连接，请重试'
    : error instanceof Error
      ? error.message
      : '经营主体加载失败'
}

export function useBusinessSubject() {
  const summary = ref<BusinessSubjectSummary | null>(null)
  const loading = ref(true)
  const switching = ref(false)
  const error = ref('')
  let controller: AbortController | null = null
  let currentId: string | undefined = undefined
  let switchingFlag = false

  const load = async () => {
    if (switchingFlag) return
    controller?.abort()
    const operation = new AbortController()
    controller = operation
    loading.value = true
    try {
      const next = await request<BusinessSubjectSummary>('/summary', 'get', operation.signal)
      if (operation.signal.aborted) return
      next.merchants = next.merchants.filter((item) => item.status !== 0 && !!item.merchantName?.trim())
      const nextId = String(next.activeMerchantId || '')
      if (currentId !== undefined && currentId !== nextId) {
        window.location.replace('/dashboard')
        return
      }
      currentId = nextId
      summary.value = next
      error.value = ''
    } catch (cause) {
      if (!operation.signal.aborted) error.value = errorMessage(cause)
    } finally {
      if (!operation.signal.aborted) loading.value = false
    }
  }

  const onFocus = () => {
    if (document.visibilityState === 'visible') void load()
  }

  onMounted(() => {
    void load()
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onFocus)
  })

  onUnmounted(() => {
    controller?.abort()
    window.removeEventListener('focus', onFocus)
    document.removeEventListener('visibilitychange', onFocus)
  })

  const active = computed(() =>
    summary.value?.merchants.find((item) => String(item.merchantId) === String(summary.value?.activeMerchantId)),
  )

  const switchSubject = async (id: string) => {
    if (
      switchingFlag ||
      id === String(active.value?.merchantId) ||
      !summary.value?.merchants.some((item) => String(item.merchantId) === id)
    ) {
      return
    }
    switchingFlag = true
    controller?.abort()
    switching.value = true
    error.value = ''
    try {
      const result = await request<{ activeMerchantId: string }>(`/businesses/${encodeURIComponent(id)}/activate`, 'post')
      if (String(result.activeMerchantId) !== id) throw new Error('主体切换结果不一致，请重新加载')
      window.location.replace('/dashboard')
    } catch (cause) {
      error.value = errorMessage(cause)
      switchingFlag = false
      switching.value = false
      void load()
    }
  }

  const ready = computed(() => !error.value && Boolean(active.value))
  const busy = computed(() => loading.value || switching.value)
  const goSso = () => void redirectToSso('iot', '/dashboard')

  return {
    summary,
    active,
    loading,
    switching,
    error,
    ready,
    busy,
    load,
    switchSubject,
    goSso,
  }
}
