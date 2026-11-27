declare const uni: any

/** 有效期由认证中心决定；兼容未返回 expiresIn 的旧接口，最多按两小时缓存。 */
export function sessionDeadline(expiresIn: unknown): number {
  const seconds = expiresIn == null ? 7200 : Number(expiresIn)
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('认证中心返回的会话有效期无效，请重新登录')
  const deadline = Date.now() + seconds * 1000
  if (!Number.isSafeInteger(Math.ceil(deadline))) throw new Error('认证中心返回的会话有效期无效，请重新登录')
  return deadline
}

/** 旧缓存缺少有效期时重新认证；不把本地时间检查当作服务端授权。 */
export function readSessionToken(tokenKey: string, expiresKey: string, clear: () => void): string {
  const token = String(uni.getStorageSync(tokenKey) || '')
  if (!token) return ''
  const expires = Number(uni.getStorageSync(expiresKey))
  if (!Number.isFinite(expires) || expires <= Date.now()) { clear(); return '' }
  return token
}
