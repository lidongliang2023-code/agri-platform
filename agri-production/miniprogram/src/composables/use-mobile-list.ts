import { ref } from 'vue'
import { onHide, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import type { PageResult } from '@/utils/request'

/** 分页列表共用状态；换筛选或离页后旧请求不再覆盖当前结果。 */
export function useMobileList(fetchPage: (page: number, size: number) => Promise<PageResult<any>>, key: (row: any) => string) {
  const rows = ref<any[]>([])
  const loading = ref(false)
  const error = ref('')
  const total = ref(0)
  const hasMore = ref(false)
  let version = 0
  let page = 0
  let failedMore = false
  async function fetch(more = false): Promise<void> {
    if (more && (loading.value || !hasMore.value)) return
    const token = ++version
    const next = more ? page + 1 : 1
    failedMore = more
    loading.value = true
    error.value = ''
    if (!more) { rows.value = []; total.value = 0; hasMore.value = false; page = 0 }
    try {
      const result = await fetchPage(next, 20)
      if (version !== token) return
      const data = more ? rows.value.concat(result.list) : result.list
      rows.value = [...new Map(data.map(row => [key(row), row])).values()]
      total.value = Number(result.total) || 0
      page = next
      hasMore.value = result.list.length > 0 && rows.value.length < total.value
    } catch (e: any) {
      if (version === token) error.value = e?.message || '加载失败，请重试'
    } finally {
      if (version === token) { loading.value = false; uni.stopPullDownRefresh() }
    }
  }
  const reload = () => fetch(false)
  const more = () => fetch(true)
  const retry = () => fetch(failedMore)
  const cancel = () => { version++; loading.value = false; uni.stopPullDownRefresh() }
  onPullDownRefresh(() => { void reload() })
  onReachBottom(() => { if (!error.value) void more() })
  onHide(cancel)
  return { rows, loading, error, total, hasMore, reload, more, retry, cancel }
}
