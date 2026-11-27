const ORIGIN_KEY = 'agri_service_origin'
export function serviceOrigin(): string {
  const configured = String(uni.getStorageSync(ORIGIN_KEY) || import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')
  if (configured) return configured
  // #ifdef H5
  return window.location.origin
  // #endif
  // #ifndef H5
  return ''
  // #endif
}
export function apiBase(): string {
  // #ifdef H5
  if (!uni.getStorageSync(ORIGIN_KEY) && !import.meta.env.VITE_API_BASE) return ''
  // #endif
  return serviceOrigin()
}
export function validateServiceOrigin(value: string): string {
  const origin = value.trim().replace(/\/$/, '')
  const match = /^(https?):\/\/([a-zA-Z0-9.-]+)(?::([0-9]{1,5}))?$/.exec(origin)
  if (!match) throw new Error('请输入完整服务地址，只包含协议、主机和端口')
  const [, protocol, rawHost, port] = match
  const host = rawHost.toLowerCase()
  if (port && (Number(port) < 1 || Number(port) > 65535)) throw new Error('服务端口须在 1 到 65535 之间')
  const ipv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host)
  const octets = ipv4 ? host.split('.').map(Number) : []
  if (ipv4 && octets.some((part, index) => part > 255 || String(part) !== host.split('.')[index])) throw new Error('请输入有效的 IPv4 地址')
  if (!ipv4 && (host.length > 253 || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)))) throw new Error('请输入有效的服务主机名')
  const local = host === 'localhost' || host === '127.0.0.1' || (ipv4 && (
    octets[0] === 10 || (octets[0] === 192 && octets[1] === 168)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
  ))
  if (protocol !== 'https' && !local) throw new Error('公网服务必须使用 HTTPS')
  return origin
}
export function saveServiceOrigin(value: string): void {
  uni.setStorageSync(ORIGIN_KEY, validateServiceOrigin(value))
}
