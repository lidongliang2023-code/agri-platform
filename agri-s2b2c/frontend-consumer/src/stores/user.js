import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { consumerApi } from '../api'
import {
  getUnifiedToken,
  logoutUnified,
  unifiedSession,
} from '../../../frontend-shared/unified-auth'

function accountView(account) {
  if (!account) return null
  return {
    id: null, // 商城消费者 ID，由 /consumer/profile 换回，未换回前不能下单
    unifiedUserId: account.id,
    nickname: account.nickname || account.username,
    username: account.username,
    phone: account.username,
    memberLevel: 'NORMAL',
    points: 0,
    totalConsume: 0,
  }
}

export const useUserStore = defineStore('user', () => {
  const user = ref(accountView(unifiedSession.user))
  const token = ref(getUnifiedToken())
  const cartCount = ref(0)
  const unreadCount = ref(0)
  const categories = ref([])
  const booted = ref(false)

  const consumerId = computed(() => user.value?.id || null)
  const displayName = computed(() => user.value?.nickname || '我的')
  const isLoggedIn = computed(() => Boolean(token.value))

  async function init() {
    token.value = getUnifiedToken()
    user.value = accountView(unifiedSession.user)
    if (!user.value) {
      booted.value = true
      return
    }
    // 统一账号 ID ≠ 消费者 ID：必须按 /consumer/profile 换一次真实档案，
    // 否则购物车/订单接口会拿错 ID 被后端 403 拒绝。
    try {
      const profile = await consumerApi.getProfile()
      if (profile?.id) {
        user.value = {
          ...user.value,
          id: profile.id,
          nickname: profile.nickname || user.value.nickname,
          phone: profile.phone || user.value.phone,
          memberLevel: profile.memberLevel || 'NORMAL',
          points: profile.points ?? 0,
          totalConsume: profile.totalConsume ?? 0,
        }
      }
    } catch {
      // 建档失败时保留统一身份；写操作会被后端拒绝，好过静默用错 ID
    }
    booted.value = true
    await Promise.all([refreshCart(), refreshUnread()])
  }

  async function refreshProfile() {
    try {
      const profile = await consumerApi.getProfile()
      if (profile?.id && user.value) {
        user.value = {
          ...user.value,
          id: profile.id,
          nickname: profile.nickname || user.value.nickname,
          memberLevel: profile.memberLevel || 'NORMAL',
          points: profile.points ?? 0,
          totalConsume: profile.totalConsume ?? 0,
        }
      }
      return profile
    } catch {
      return null
    }
  }

  async function refreshCart() {
    if (!consumerId.value) {
      cartCount.value = 0
      return
    }
    try {
      const lines = await consumerApi.getCart(consumerId.value)
      cartCount.value = (lines || []).reduce((sum, line) => sum + (line.quantity || 0), 0)
    } catch {
      cartCount.value = 0
    }
  }

  async function refreshUnread() {
    if (!consumerId.value) {
      unreadCount.value = 0
      return
    }
    try {
      const rows = await consumerApi.getMessages({ consumerId: consumerId.value })
      unreadCount.value = (rows || []).filter((row) => !row.isRead).length
    } catch {
      unreadCount.value = 0
    }
  }

  async function loadCategories(force = false) {
    if (categories.value.length && !force) return categories.value
    try {
      categories.value = (await consumerApi.getCategories()) || []
    } catch {
      categories.value = []
    }
    return categories.value
  }

  async function logout() {
    user.value = null
    token.value = ''
    await logoutUnified('mall-consumer')
  }

  return {
    user,
    token,
    booted,
    cartCount,
    unreadCount,
    categories,
    consumerId,
    displayName,
    isLoggedIn,
    init,
    refreshProfile,
    refreshCart,
    refreshUnread,
    loadCategories,
    logout,
  }
})
