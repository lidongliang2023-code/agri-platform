/**
 * 交易撮合前端的地址与深链。
 *
 * <p>供需信息的发布表单只有一份，在交易撮合的卖家中心（发布商品）与买家中心（发布采购需求）。
 * 信息资讯端不再自建表单，只负责把用户送过去、并把用户接回来 —— 否则就会出现
 * "信息资讯填 13 个字段、交易端填 30 个字段"的两套数据，填过的东西在对方那里看不全。</p>
 *
 * <p>地址来源优先级：`VITE_TRADE_APP_ORIGIN` → 本地默认 `:8086` → 生产域名。
 * 生产环境两个子系统是独立域名（info.* / trade.*），所以不能用相对路径。</p>
 */

export type TradeKind = 'supply' | 'demand'

const LOCAL_PORT = '8086'
const PROD_ORIGIN = 'https://trade.agri-platform.com'

/** 本地/内网调试环境判定：这些主机名都按「同主机换端口」处理，不能回落到生产域名。 */
function isLocalHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true
  if (hostname.endsWith('.local')) return true
  // 纯 IPv4 字面量：手机/同事用局域网 IP 访问时，跳到生产域名会直接 404
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)
}

/** 交易端前端根地址（不带尾斜杠）。 */
export function tradeAppOrigin(): string {
  const configured = (import.meta.env.VITE_TRADE_APP_ORIGIN as string | undefined)?.trim()
  if (configured) return configured.replace(/\/+$/, '')
  const { protocol, hostname } = window.location
  if (isLocalHost(hostname)) {
    return `${protocol}//${hostname}:${LOCAL_PORT}`
  }
  return PROD_ORIGIN
}

/**
 * 发布页深链。
 *
 * <p>`tab=publish` 是交易端会员中心的既有约定（`/member/seller?tab=publish`、
 * `/member/buyer?tab=publish`），不要另起一套路由。</p>
 */
export function tradePublishUrl(kind: TradeKind, returnUrl?: string): string {
  const path = kind === 'supply' ? '/member/seller' : '/member/buyer'
  const params = new URLSearchParams({ tab: 'publish' })
  if (returnUrl) params.set('returnUrl', returnUrl)
  return `${tradeAppOrigin()}${path}?${params.toString()}`
}

/** 管理页深链：我的商品 / 我的采购需求。 */
export function tradeManageUrl(kind: TradeKind): string {
  return kind === 'supply'
    ? `${tradeAppOrigin()}/member/seller?tab=goods`
    : `${tradeAppOrigin()}/member/buyer?tab=demand-list`
}

/**
 * 回到信息资讯的绝对地址，供交易端发布成功后回跳。
 *
 * <p>信息资讯是 hash 路由（`#/sd`），所以路径必须保留 `pathname` 再拼 hash，
 * 否则在 `/info/` 部署前缀下会跳回域名根目录。</p>
 */
export function infoReturnUrl(page = 'sd'): string {
  return `${window.location.origin}${window.location.pathname}#/${page}`
}

/** 跨应用跳转：同标签页打开，保留"去发布 → 发布 → 回到大厅"的完整闭环。 */
export function openExternal(url: string): void {
  window.location.assign(url)
}
