import { request, subjectSummary, SUBJECT_KEY, clearProductionContext } from './request'
import { serviceOrigin } from './runtime'
import { currentUser, ensureLogin } from './auth'
import menus from '../../../../packages/agri-shared/src/production/menus.json'

/** 按共享菜单查业务名称，用作容器页导航条标题（与电脑端菜单同名）。 */
export function workspaceTitle(target: string): string {
  for (const group of [...menus.user, ...menus.admin]) {
    const hit = group.children.find(item => item.key === target)
    if (hit) return hit.label
  }
  return '生产业务'
}
export type WorkspaceMode = 'user' | 'ops'

const WORKSPACE_MODE_PREFIX = 'agri_workspace_mode:'

/** 只有具备运营角色的账号可以切换工作模式；普通账号固定为用户端。 */
export function canSwitchWorkspace(): boolean {
  return (currentUser().roles || []).some(role => role === 'SUPER_ADMIN' || role === 'MARKET_OPS' || role.endsWith('ADMIN') || role.endsWith('OPS'))
}

function modeKey(): string {
  return WORKSPACE_MODE_PREFIX + String(currentUser().userId || currentUser().username || 'anonymous')
}

/** 读取当前账号上次选择的端模式；管理员默认进入运营端。 */
export function workspaceMode(): WorkspaceMode {
  if (!canSwitchWorkspace()) return 'user'
  return uni.getStorageSync(modeKey()) === 'user' ? 'user' : 'ops'
}

/** 保存端模式并清空另一端的主体／农场上下文，避免两端数据串用。 */
export function setWorkspaceMode(mode: WorkspaceMode): void {
  if (!canSwitchWorkspace()) {
    if (mode !== 'user') throw new Error('当前账号没有运营端权限')
    return
  }
  uni.setStorageSync(modeKey(), mode)
  clearProductionContext()
}

export function isProductionOps(): boolean {
  return workspaceMode() === 'ops'
}
let returnCheckNeeded = false
let syncPromise: Promise<boolean> | undefined
/** 从业务容器返回时同步服务端身份和当前主体，不把网页会话与客户端分开管理。 */
export async function ensureWorkspaceSession(): Promise<boolean> {
  if (!ensureLogin()) return false
  if (!returnCheckNeeded) return true
  if (syncPromise) return syncPromise
  syncPromise = (async () => {
    try {
      await request({ url: '/api/v1/auth/me' })
      if (!isProductionOps()) {
        const summary = await subjectSummary()
        const next = String(summary.activeMerchantId || '')
        if (next !== String(uni.getStorageSync(SUBJECT_KEY) || '')) {
          clearProductionContext()
          if (next) uni.setStorageSync(SUBJECT_KEY, next)
        }
      }
      returnCheckNeeded = false
      return true
    } catch (e: any) {
      uni.showToast({ title: e?.message || '账号同步失败，请重试', icon: 'none' })
      return false
    } finally { syncPromise = undefined }
  })()
  return syncPromise
}
const dedicatedUserPages: Record<string,string> = {
 '/production/analytics':'/pages/native/analytics',
 '/production/analytics/reports':'/pages/native/reports',
 '/production/dashboard':'/pages/workbench/workbench',
 '/production/plots':'/pages/plots/plots',
 '/production/tasks':'/pages/tasks/tasks',
 '/production/harvests':'/pages/harvests/harvests',
 '/production/messages':'/pages/messages/messages',
 '/production/tasks/voice-records':'/pages/native/voice',
 '/production/plans/calendar':'/pages/native/calendar',
 '/production/harvests/window-decision':'/pages/native/harvest-window',
 '/production/ai/assistant':'/pages/native/assistant',
 '/production/ai/processing-schedule':'/pages/native/processing',
}
export const nativeUserPages: Record<string,string> = Object.fromEntries(menus.user.flatMap(group=>group.children).map(item=>[item.key,dedicatedUserPages[item.key] || '/pages/native/business?target='+encodeURIComponent(item.key)]))
export function openWorkspace(target: string, full = false): void {
  if (!ensureLogin()) return
  if (!/^\/(production|admin\/production)\/[a-zA-Z0-9/_-]+$/.test(target)) { uni.showToast({ title: '业务地址无效', icon: 'none' }); return }
  const opsTarget = target.startsWith('/admin/production/')
  if (opsTarget !== (workspaceMode() === 'ops')) {
    uni.showToast({ title: opsTarget ? '请先切换到运营端' : '请先切换到用户端', icon: 'none' })
    return
  }
  const nativePage = !opsTarget ? nativeUserPages[target] : undefined
  if (nativePage) {
    if (['/pages/workbench/workbench','/pages/tasks/tasks', '/pages/harvests/harvests'].includes(nativePage)) uni.switchTab({ url: nativePage })
    else uni.navigateTo({ url: nativePage })
    return
  }
  if (!opsTarget) { uni.showToast({ title: '请从全部业务选择对应功能', icon: 'none' }); return }
  returnCheckNeeded = true
  uni.navigateTo({ url: '/pages/workspace/workspace?target=' + encodeURIComponent(target) + '&title=' + encodeURIComponent(workspaceTitle(target)) })
}
export async function workspaceUrl(target: string): Promise<string> {
  if (!target.startsWith('/admin/production/')) throw new Error('用户业务请从原生页面打开')
  const origin = serviceOrigin()
  if (!origin) throw new Error('请先在服务连接中设置生产网关地址')
  const result = await request<{ticket: string}>({ url: '/api/v1/production/mobile-session/ticket', method: 'POST', data: { target } })
  return origin + '/mobile/session#ticket=' + encodeURIComponent(result.ticket)
}
