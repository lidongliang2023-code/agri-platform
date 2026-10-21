const STORAGE_KEY = 'fengchain_platform_access_token'

let memoryToken: string | null = null

/** 从 HttpOnly 刷新凭证换取短时访问令牌，仅保存于当前标签页。 */
export async function getPlatformAccessToken(force = false): Promise<string> {
  if (!force) {
    const cached = memoryToken || sessionStorage.getItem(STORAGE_KEY)
    if (cached) return cached
  }
  const response = await fetch('/api/v1/auth/refresh', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  const result = await response.json() as {
    code?: number
    message?: string
    data?: { accessToken?: string }
  }
  if (!response.ok || result.code !== 0 || !result.data?.accessToken) {
    clearPlatformAccessToken()
    throw new Error(result.message || '登录状态已失效，请重新登录')
  }
  memoryToken = result.data.accessToken
  sessionStorage.setItem(STORAGE_KEY, memoryToken)
  return memoryToken
}

export function clearPlatformAccessToken(): void {
  memoryToken = null
  sessionStorage.removeItem(STORAGE_KEY)
}
