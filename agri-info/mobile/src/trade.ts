declare const plus: { runtime: { openURL(url: string, fail: () => void): void } }

/** 订单、报价及交易会话归交易撮合所有。跨应用登录由各端独立完成。 */
export function openTrade(id: number, type: string): void {
  const route = type === 'demand' ? '/pages/demands/index' : `/pages/product/detail?id=${id}`
  // #ifdef H5
  const base = String(import.meta.env.VITE_TRADE_MOBILE_URL || (['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:8181/` : '/trade-mobile/'))
  window.location.assign(`${base.replace(/\/$/, '')}/#${route}`)
  return;
  // #endif
  // #ifdef MP-WEIXIN
  const appId = String(import.meta.env.VITE_TRADE_MINIPROGRAM_APPID || '')
  if (appId) {
    uni.navigateToMiniProgram({ appId, path: route.slice(1), fail: () => uni.showToast({ title: '交易小程序打开失败', icon: 'none' }) })
    return
  }
  // #endif
  // #ifdef APP-PLUS
  const scheme = String(import.meta.env.VITE_TRADE_APP_SCHEME || '')
  if (scheme) {
    plus.runtime.openURL(`${scheme}://open?path=${encodeURIComponent(route)}`, () => uni.showToast({ title: '请先安装交易应用', icon: 'none' }))
    return
  }
  // #endif
  uni.showModal({ title: '前往交易撮合', content: `请在交易撮合应用中查找${type === 'demand' ? '采购需求' : '供应商品'}编号 ${id}，继续报价或下单。当前端尚未配置跨应用入口。`, showCancel: false })
}
