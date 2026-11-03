import { reactive } from 'vue'
import { clearUnifiedAccount, getUnifiedToken } from '../../frontend-shared/mobile-unified-auth'

export interface SupplierSession {
  id: number
  phone: string
  username?: string
  nickname?: string
  unifiedUserId?: number | string
  shopName?: string
}

const KEY = 's2b2c_supplier_mobile_session'
const saved = uni.getStorageSync(KEY) as SupplierSession | null

export const supplierSession = reactive<{ account: SupplierSession | null }>({
  account: saved || null,
})

export function saveSupplierSession(account: SupplierSession) {
  supplierSession.account = account
  uni.setStorageSync(KEY, account)
}

export function clearSupplierSession() {
  supplierSession.account = null
  uni.removeStorageSync(KEY)
  clearUnifiedAccount()
}

export function requireSupplierLogin() {
  if (supplierSession.account && getUnifiedToken()) return true
  clearSupplierSession()
  uni.navigateTo({ url: '/pages/login/index' })
  return false
}

export function leaveSupplierLogin() {
  const pages = getCurrentPages()
  if (pages.length > 1) {
    uni.navigateBack()
  } else {
    uni.switchTab({ url: '/pages/home/index' })
  }
}
