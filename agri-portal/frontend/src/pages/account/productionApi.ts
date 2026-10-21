import { getPlatformAccessToken } from '../../utils/platformToken'

interface ApiBody<T> {
  code: number
  message?: string
  data?: T
}

/** 门户内调用生产域用户接口，统一转发当前标签页的短时访问令牌。 */
export async function productionApi<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const token = await getPlatformAccessToken()
  const response = await fetch(`/api/v1/production${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers ?? {}),
    },
  })
  if (response.status === 401 && retry) {
    await getPlatformAccessToken(true)
    return productionApi<T>(path, init, false)
  }
  const body = await response.json() as ApiBody<T>
  if (!response.ok || !([0, 200].includes(body.code))) {
    throw new Error(body.message || '生产管理服务请求失败')
  }
  return body.data as T
}
