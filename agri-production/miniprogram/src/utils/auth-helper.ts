/**
 * 认证与农场上下文的统一出口。
 *
 * <p>页面只从 `@/utils/auth-helper` 取，避免登录页同时依赖 `api/` 与 `utils/auth` 两层
 * 造成循环引用（登录成功后要立刻拉农场列表建立上下文）。</p>
 */
import { listFarms as fetchFarms } from '@/api/production'
import {
  completeMfaLogin,
  currentFarm,
  currentUser,
  ensureLogin,
  getOnboardingStatus,
  isLoggedIn,
  isMfaChallenge,
  login,
  loginBySms,
  logout,
  registerAccount,
  sendSmsCode,
  setCurrentFarm,
  type LoginSuccess,
  type MfaChallenge,
  type MobileUser,
} from './auth'
import type { FarmBrief } from './auth'
import { TOKEN_KEY, productionContextVersion, isProductionSubjectSwitching } from './request'
import { isProductionOps } from './workspace'

export {
  completeMfaLogin,
  currentFarm,
  currentUser,
  ensureLogin,
  getOnboardingStatus,
  isLoggedIn,
  isMfaChallenge,
  login,
  loginBySms,
  logout,
  registerAccount,
  sendSmsCode,
  setCurrentFarm,
}
export type { LoginSuccess, MfaChallenge, MobileUser }

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

/** 平台管理员不归属具体农场：农场作用域的页面给出运营端去向，而不是让他去选农场。 */
export const OPS_FARM_MESSAGE = '平台管理员账号不归属具体农场，请在「全部业务 › 运营管理」中查看各农场数据'

let resolving: { token: unknown; version: number; promise: Promise<FarmBrief> } | undefined

/**
 * 取当前农场；本地没有时按当前经营主体重新加载并选中第一个农场。
 *
 * <p>当前农场会在切换主体、主体在别处被切换、登录时农场列表加载失败等情况下被清空，
 * 以前各页面只读本地缓存，清空后就一直提示「未关联农场」，必须手动去「我的」重选。
 * 这里统一补回；主体下确实没有农场、或接口失败时，抛出可直接展示给用户的原因。</p>
 */
export function resolveCurrentFarm(): Promise<FarmBrief> {
  if (isProductionSubjectSwitching()) return Promise.reject(new Error('正在切换经营主体，请稍候再试'))
  const cached = currentFarm()
  if (cached?.farmId) return Promise.resolve(cached)
  if (isProductionOps()) return Promise.reject(new Error(OPS_FARM_MESSAGE))
  const tokenAtStart = uni.getStorageSync(TOKEN_KEY)
  const versionAtStart = productionContextVersion()
  if (resolving && resolving.token === tokenAtStart && resolving.version === versionAtStart) return resolving.promise
  const promise = (async () => {
    let farms: FarmBrief[]
    try {
      farms = (await listFarms()).filter((farm) => farm.farmId)
    } catch (e: any) {
      throw new Error(e?.message ? `农场列表加载失败：${e.message}` : '农场列表加载失败，请下拉刷新或稍后重试')
    }
    if (tokenAtStart !== uni.getStorageSync(TOKEN_KEY) || versionAtStart !== productionContextVersion()) {
      throw new Error('账号、主体或农场已切换，请刷新后重试')
    }
    // 等待期间用户可能已在「我的」页手动选了农场，以用户的选择为准
    const picked = currentFarm()
    if (picked?.farmId) return picked
    if (farms.length === 0) throw new Error('当前经营主体下还没有农场，请先在「全部业务 › 农场管理」新建农场，或到「我的」切换经营主体')
    setCurrentFarm(farms[0])
    return farms[0]
  })()
  const pending = { token: tokenAtStart, version: versionAtStart, promise }
  resolving = pending
  const release = () => { if (resolving === pending) resolving = undefined }
  promise.then(release, release)
  return promise
}
