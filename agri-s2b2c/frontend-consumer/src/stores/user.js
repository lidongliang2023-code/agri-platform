import { computed, ref, watch } from 'vue'
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

  watch(() => unifiedSession.user, (account) => {
    token.value = getUnifiedToken()
    user.value = accountView(account)
    cartCount.value = 0
    unreadCount.value = 0
  }, { flush: 'sync' })

  async function init() {
    token.value = getUnifiedToken()
    user.value = accountView(unifiedSession.user)
    if (!user.value) {
      booted.value = true
      return
    }
    // 统一账号 ID ≠ 消费者 ID：必须按 /consumer/profile 换一次真实档案，
    // 否则购物车/订单接口会拿错 ID 被后端 403 拒绝。
    await refreshProfile()
    booted.value = true
    await Promise.all([refreshCart(), refreshUnread()])
  }

  async function refreshProfile() {
    const requestedToken = token.value
    try {
      const profile = await consumerApi.getProfile()
      if (requestedToken !== token.value || !user.value) return null
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
    const requestedToken = token.value
    try {
      const lines = await consumerApi.getCart(consumerId.value)
      if (requestedToken !== token.value) return
      cartCount.value = (lines || []).reduce((sum, line) => sum + (line.quantity || 0), 0)
    } catch {
      if (requestedToken === token.value) cartCount.value = 0
    }
  }

  async function refreshUnread() {
    if (!consumerId.value) {
      unreadCount.value = 0
      return
    }
    const requestedToken = token.value
    try {
      const rows = await consumerApi.getMessages({ consumerId: consumerId.value })
      if (requestedToken !== token.value) return
      unreadCount.value = (rows || []).filter((row) => !row.isRead).length
    } catch {
      if (requestedToken === token.value) unreadCount.value = 0
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
    if (await logoutUnified('mall-consumer')) {
      user.value = null
      token.value = ''
    }
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
