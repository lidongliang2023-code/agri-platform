declare const uni: any
let pending: Promise<boolean> | null = null

/** 移动端必须用当前访问令牌完成服务端吊销，失败时保留会话供重试。 */
export function logoutMobile(url: string, token: string, clear: () => void): Promise<boolean> {
  if (pending) return pending
  pending = new Promise<boolean>((resolve) => {
    uni.request({
      url, method: 'POST', data: {}, timeout: 10000,
      header: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      success(response: any) {
        const code = response.data?.code
        if (response.statusCode >= 200 && response.statusCode < 300 && (code === 0 || code === 200)) {
          clear()
          resolve(true)
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
  }).finally(() => { pending = null })
  return pending
}
