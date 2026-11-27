declare const uni: any
const pending = new Map<string, Promise<boolean>>()

/** 仅服务端确认全局退出时返回 true。调用方可在 HTTP 401 时结束失效的本机会话。 */
export function logoutMobile(
  url: string, token: string, clear: () => void, onUnauthorized?: () => void, isCurrent: () => boolean = () => true,
): Promise<boolean> {
  const key = `${url}\n${token}`
  const active = pending.get(key)
  if (active) return active
  if (!token) { if (isCurrent()) (onUnauthorized || clear)(); return Promise.resolve(false) }
  const task = new Promise<boolean>((resolve) => {
    uni.request({
      url, method: 'POST', data: {}, timeout: 10000,
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      success(response: any) {
        if (!isCurrent()) { resolve(false); return }
        const code = response.data?.code
        if (response.statusCode >= 200 && response.statusCode < 300 && (code === 0 || code === 200)) {
          clear()
          resolve(true)
        } else if ((response.statusCode === 401 || (response.statusCode >= 200 && response.statusCode < 300 && code === 401)) && onUnauthorized) {
          onUnauthorized()
          resolve(false)
        } else {
          uni.showToast({ title: '未完成全局退出，请重试', icon: 'none' })
          resolve(false)
        }
      },
      fail() {
        uni.showToast({ title: '未完成全局退出，请检查网络后重试', icon: 'none' })
        resolve(false)
      },
    })
  }).finally(() => { if (pending.get(key) === task) pending.delete(key) })
  pending.set(key, task)
  return task
}
