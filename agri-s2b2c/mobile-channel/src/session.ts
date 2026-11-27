import { reactive } from 'vue'
import { clearUnifiedAccount, getUnifiedToken } from '../../frontend-shared/mobile-unified-auth'

export interface ChannelSession {
  id: number | string
  phone: string
  username?: string
  nickname?: string
  unifiedUserId?: number | string
  shopName?: string
}

const KEY = 's2b2c_channel_mobile_session'
const TAB_PAGES = ['/pages/home/index', '/pages/products/index', '/pages/orders/index', '/pages/profile/index']
const saved = uni.getStorageSync(KEY) as ChannelSession | null

export const channelSession = reactive<{ account: ChannelSession | null }>({
  account: getUnifiedToken() ? saved || null : null,
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
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as unknown as { route?: string; options?: Record<string,string> } | undefined
  if (current?.route && current.route !== 'pages/login/index') {
    const query=Object.entries(current.options || {}).map(([k,v])=>`${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    uni.setStorageSync('s2b2c_channel_redirect',`/${current.route}${query?'?'+query:''}`)
    uni.navigateTo({ url: '/pages/login/index' })
  }
  return false
}

/**
 * 当前登录渠道的 id。没有就跳登录并返回 null —— 不再回落到「渠道 1」，
 * 否则未登录或会话残缺时会去请求别人的店铺数据。
 */
export function currentChannelId(): number | string | null {
  if (!requireChannelLogin()) return null
  const id = channelSession.account?.id
  return typeof id === 'number' ? (Number.isSafeInteger(id) && id > 0 ? id : null) : (typeof id === 'string' && /^[1-9]\d*$/.test(id) ? id : null)
}

export function leaveChannelLogin() {
  const redirect=String(uni.getStorageSync('s2b2c_channel_redirect') || '')
  uni.removeStorageSync('s2b2c_channel_redirect')
  if(redirect.startsWith('/pages/') && !redirect.startsWith('/pages/login/')) {
    if(TAB_PAGES.includes(redirect.split('?')[0])) uni.switchTab({url:redirect.split('?')[0]})
    else uni.redirectTo({url:redirect})
    return
  }
  const pages = getCurrentPages()
  if (pages.length > 1) uni.navigateBack()
  else uni.switchTab({ url: '/pages/home/index' })
}

export function openPage(url: string) {
  const path = url.split('?')[0]
  if (TAB_PAGES.includes(path)) uni.switchTab({ url: path })
  else uni.navigateTo({ url })
}

uni.$on('s2b2c:session-cleared', () => { channelSession.account = null; uni.removeStorageSync('s2b2c_channel_mobile_session') })
