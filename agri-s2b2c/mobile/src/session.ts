import { reactive } from 'vue'
import type { Consumer } from './api'
import { clearUnifiedAccount, getUnifiedToken } from '../../frontend-shared/mobile-unified-auth'

const SESSION_KEY = 's2b2c_mobile_user'
const savedUser = uni.getStorageSync(SESSION_KEY) as Consumer | null

export const session = reactive<{ user: Consumer | null }>({
  user: savedUser || null,
})

export function saveSession(user: Consumer) {
  session.user = user
  uni.setStorageSync(SESSION_KEY, user)
}

export function clearSession() {
  session.user = null
  uni.removeStorageSync(SESSION_KEY)
  clearUnifiedAccount()
}

export function ensureLogin(): boolean {
  if (session.user && getUnifiedToken()) return true
  clearSession()
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as unknown as {
    options?: Record<string, string>
    $page?: { options?: Record<string, string> }
    route?: string
  } | undefined
  const options = current?.options || current?.$page?.options || {}
  const query = Object.keys(options)
    .filter((key) => options[key] !== undefined && options[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(options[key])}`)
    .join('&')
  const currentPath = current?.route ? `/${current.route}${query ? `?${query}` : ''}` : '/pages/profile/index'
  const redirect = currentPath
  uni.navigateTo({ url: `/pages/login/index?redirect=${encodeURIComponent(redirect)}` })
  return false
}

export function leaveLoginPage(redirect?: string) {
  const pages = getCurrentPages()
  const target = redirect ? decodeURIComponent(redirect) : ''
  if (target) {
    const isTab = ['/pages/home/index', '/pages/category/index', '/pages/cart/index', '/pages/profile/index'].includes(target)
    if (isTab) {
      uni.switchTab({ url: target })
    } else {
      uni.redirectTo({ url: target })
    }
    return
  }
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/profile/index' })
  }
}
