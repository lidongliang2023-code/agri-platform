/**
 * uni-app 客户端（H5 / 微信小程序 / APP）web-view 内嵌模式。
 *
 * 独立的 React 移动 H5 已下线：手机端统一由 uni-app 提供登录、导航和账号管理，
 * React 只在客户端通过一次性票据（/mobile/session）打开时，以「纯业务内容」方式渲染。
 * 该标志只影响展示和会话结束后的去向，不参与服务端授权。
 */
export function mobileWorkspace(): boolean {
  if (window.location.pathname.startsWith('/mobile/')) {
    sessionStorage.setItem('agri_mobile_workspace', '1')
    return true
  }
  return sessionStorage.getItem('agri_mobile_workspace') === '1'
}

/** 内嵌会话结束（过期 / 退出）后的落点：提示用户回到客户端，不在网页里另起登录。 */
export function workspaceEndedPath(reason: 'expired' | 'logout' = 'expired'): string {
  return `/mobile/session?reason=${reason}`
}

/** 通知 uni-app H5 外层容器（iframe 父页面）会话已结束；小程序 / APP 由用户点返回。 */
export function notifyNativeShell(reason: 'expired' | 'logout'): void {
  try {
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'agri-workspace-ended', reason }, window.location.origin)
    }
  } catch {
    // 跨源或容器不支持时忽略，页面上有返回提示
  }
}

export function safeProductionTarget(raw: string | null, fallback = '/production/dashboard'): string {
  return raw && /^\/(production|admin\/production)\/[a-zA-Z0-9/_-]+$/.test(raw) && !raw.includes('//') ? raw : fallback
}
