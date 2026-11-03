import { reactive } from 'vue'
import { clearUnifiedAccount, getUnifiedToken } from '../../frontend-shared/mobile-unified-auth'

export interface ChannelSession {
  id: number
  phone: string
  username?: string
  nickname?: string
  unifiedUserId?: number | string
  shopName?: string
}

const KEY = 's2b2c_channel_mobile_session'
const saved = uni.getStorageSync(KEY) as ChannelSession | null

export const channelSession = reactive<{ account: ChannelSession | null }>({
  account: saved || null,
})

export function saveChannelSession(account: ChannelSession) {
  channelSession.account = account
  uni.setStorageSync(KEY, account)
}

export function clearChannelSession() {
  channelSession.account = null
  uni.removeStorageSync(KEY)
  clearUnifiedAccount()
}

export function requireChannelLogin() {
  if (channelSession.account && getUnifiedToken()) return true
  clearChannelSession()
  uni.navigateTo({ url: '/pages/login/index' })
  return false
}

export function leaveChannelLogin() {
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/home/index' })
}
