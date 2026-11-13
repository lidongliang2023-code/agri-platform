/** 浏览器退出共用流程：明确吊销当前账号，成功后只回跳，不二次选择 Cookie 账号。 */
export interface LogoutOptions {
  token: string | null | undefined
  clientId: string
  ssoOrigin: string
  clear: () => void
}
let pending: Promise<boolean> | null = null

export function logoutBrowser(options: LogoutOptions): Promise<boolean> {
  if (pending) return pending
  pending = performLogout(options).finally(() => { pending = null })
  return pending
}

async function performLogout(options: LogoutOptions): Promise<boolean> {
  if (!options.token) {
    window.location.assign(`${options.ssoOrigin}/logout?client_id=${encodeURIComponent(options.clientId)}`)
    return false
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const response = await fetch('/api/v1/auth/logout', {
      method: 'POST', credentials: 'include', signal: controller.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.token}` },
      body: '{}',
    })
    const body = await response.json()
    if (!response.ok || body?.code !== 0) throw new Error(body?.message || '退出请求失败')
    options.clear()
    window.location.assign(`${options.ssoOrigin}/api/v1/sso/logout/complete?client_id=${encodeURIComponent(options.clientId)}`)
    return true
  } catch {
    window.alert('未完成全局退出，登录状态已保留。请检查网络后重试。')
    return false
  } finally {
    clearTimeout(timer)
  }
}
