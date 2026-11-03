import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { consumerApi } from '../api'
import { useUserStore } from '../stores/user'

/**
 * 收藏状态（商品卡 / 详情页 / 收藏页共用）。
 * 后端收藏表是 consumer_id + product_id 唯一，这里在内存里维护一份 id 集合做按钮态，
 * 任何写操作后再回读一次，避免"点了没反应"的假成功。
 */
export function useFavorites() {
  const userStore = useUserStore()
  const ids = ref(new Set())
  const loading = ref(false)

  async function load() {
    if (!userStore.consumerId) return
    loading.value = true
    try {
      const rows = await consumerApi.getFavorites(userStore.consumerId)
      ids.value = new Set((rows || []).map((row) => String(row.productId)))
    } catch {
      ids.value = new Set()
    } finally {
      loading.value = false
    }
  }

  function has(productId) {
    return ids.value.has(String(productId))
  }

  async function toggle(productId) {
    const consumerId = userStore.consumerId
    if (!consumerId) {
      ElMessage.warning('登录后才能收藏商品')
      return
    }
    const key = String(productId)
    const wasFav = ids.value.has(key)
    try {
      const res = wasFav
        ? await consumerApi.removeFavorite(consumerId, productId)
        : await consumerApi.addFavorite(consumerId, productId)
      if (res && res.success === false) {
        ElMessage.warning(res.message || '操作失败')
        return
      }
      await load()
      const nowFav = ids.value.has(key)
      if (nowFav === wasFav) {
        ElMessage.error('收藏状态未变更，请稍后重试')
        return
      }
      ElMessage.success(nowFav ? '已加入收藏' : '已取消收藏')
    } catch (err) {
      ElMessage.error(err.friendlyMessage || '收藏操作失败')
    }
  }

  return { ids, loading, load, has, toggle }
}
