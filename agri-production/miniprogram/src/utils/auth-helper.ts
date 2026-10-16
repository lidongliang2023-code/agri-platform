/**
 * 认证与农场上下文的统一出口。
 *
 * <p>页面只从 `@/utils/auth-helper` 取，避免登录页同时依赖 `api/` 与 `utils/auth` 两层
 * 造成循环引用（登录成功后要立刻拉农场列表建立上下文）。</p>
 */
import { listFarms as fetchFarms } from '@/api/production'
import {
  currentFarm,
  currentUser,
  ensureLogin,
  isLoggedIn,
  login,
  logout,
  setCurrentFarm,
} from './auth'
import type { FarmBrief } from './auth'

export { currentFarm, currentUser, ensureLogin, isLoggedIn, login, logout, setCurrentFarm }

/**
 * 当前账号可见的农场列表（归一化 farmId）。
 *
 * @returns 农场数组；接口失败时抛出，由调用方决定提示口径
 */
export async function listFarms(): Promise<FarmBrief[]> {
  const farms = await fetchFarms()
  return (farms ?? []).map((farm: any) => ({
    farmId: String(farm.farmId ?? farm.id ?? ''),
    farmCode: farm.farmCode,
    farmName: farm.farmName ?? farm.name ?? '未命名农场',
    location: farm.location ?? farm.address,
  }))
}
