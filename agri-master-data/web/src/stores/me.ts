/** 用户端上下文：当前登录人的经营主体与未读消息数（一次加载，多页复用）。 */
import { defineStore } from 'pinia'
import { getMyMerchants, getUnreadCount, type MyMerchant } from '@/utils/me'
import { MERCHANT_STORAGE_KEY } from '@/utils/userApi'

export const useMeStore = defineStore('me', {
  state: () => ({
    merchants: [] as MyMerchant[],
    unread: 0,
    loaded: false,
    loading: false,
  }),
  getters: {
    /** 当前主体：目前只支持单主体（接口 /merchants/mine 只返回当前生效的一个） */
    current(state): MyMerchant | null {
      return state.merchants[0] ?? null
    },
  },
  actions: {
    async load(force = false) {
      if (this.loading) return
      if (this.loaded && !force) return
      this.loading = true
      try {
        const [merchants, unread] = await Promise.all([
          getMyMerchants().catch(() => null),
          getUnreadCount().catch(() => null),
        ])
        this.merchants = (merchants?.data ?? []) as MyMerchant[]
        this.unread = Number(unread?.data ?? 0)
        // 供 userApi 的请求头使用：后端会拿它回源 core 校验归属，前端只负责“声明我在哪个主体”
        const merchantId = this.merchants[0]?.merchantId
        if (merchantId) localStorage.setItem(MERCHANT_STORAGE_KEY, String(merchantId))
        else localStorage.removeItem(MERCHANT_STORAGE_KEY)
        this.loaded = true
      } finally {
        this.loading = false
      }
    },
    async refreshUnread() {
      try {
        const response = await getUnreadCount()
        this.unread = Number(response?.data ?? 0)
      } catch {
        // 角标失败不影响页面
      }
    },
  },
})
