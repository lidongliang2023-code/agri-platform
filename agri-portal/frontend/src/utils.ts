import { useEffect, useState } from 'react'

/** 门户使用 hash 路由：静态托管在 /portal/ 下也不需要额外的前端回退规则。 */
export function parseHash(): { path: string; query: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, '') || '/'
  const [path, search = ''] = raw.split('?')
  return { path: path || '/', query: new URLSearchParams(search) }
}

export function useHashRoute(): { path: string; query: URLSearchParams } {
  const [route, setRoute] = useState(parseHash)
  useEffect(() => {
    const onChange = (): void => setRoute(parseHash())
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return route
}

export function go(path: string): void {
  window.location.hash = path.startsWith('#') ? path.slice(1) : path
}

const protocol = window.location.protocol
const hostname = window.location.hostname

/** 交易撮合前端（本地固定 8086）。 */
export function tradeUrl(path = '/'): string {
  return `${protocol}//${hostname}:8086${path}`
}

/** 公开交易大厅（无需登录即可浏览）。 */
export function hallUrl(): string {
  return tradeUrl('/hall')
}

/** 生产管理用户端登录入口（会经统一认证中心）。 */
export function productionLogin(): string {
  return `${protocol}//${hostname}/production/login`
}

/** 统一认证中心注册页（已支持无授权上下文的独立注册）。 */
export function ssoRegister(): string {
  return `${protocol}//${hostname}:8090/register`
}

export function ssoLogin(): string {
  return `${protocol}//${hostname}:8090/login`
}
