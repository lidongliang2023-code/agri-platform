type EndpointKind = 'api' | 'auth'

/** H5 使用同源网关；原生端必须显式指定业务及统一认证地址。 */
export function governmentBase(kind: EndpointKind): string {
  const isWeb = uni.getSystemInfoSync().uniPlatform === 'web'
  const value = kind === 'auth'
    ? import.meta.env.VITE_GOVERNMENT_AUTH_BASE
    : import.meta.env.VITE_GOVERNMENT_API_BASE
  const base = String(value || '').trim().replace(/\/+$/, '')
  const label = kind === 'auth' ? '统一认证' : '监管业务'
  if (!base && isWeb) return ''
  if (!base) throw new Error(`未配置${label}服务地址，请联系管理员配置后重新构建客户端`)
  // 不使用 URL 构造器，兼容微信小程序 JS 运行环境。
  const match = /^(https?):\/\/([^/?#]+)(\/[^?#]*)?$/i.exec(base)
  if (!match || match[2].includes('@')) {
    throw new Error(`${label}服务地址格式不正确，请使用完整的服务地址`)
  }
  if (!isWeb && (match[1].toLowerCase() !== 'https'
    || /^(localhost|127\.[\d.]+|0\.0\.0\.0|\[::1\])(?::\d+)?$/i.test(match[2]))) {
    throw new Error(`小程序和 App 的${label}服务须配置为设备可访问的 HTTPS 地址`)
  }
  return base
}
