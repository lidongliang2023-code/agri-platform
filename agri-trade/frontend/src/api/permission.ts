import axios from 'axios'

/**
 * 当前登录用户在**当前市场**下的角色与权限码（平台 RBAC）。
 *
 * <p>身份从令牌来，接口不接受"查谁"的参数 —— 与 /api/trade/identity/my-merchants 同一口径。</p>
 *
 * <p>注意：这里只用来决定"运营端入口要不要给看"。真正的准入在服务端
 * （路径 /api/trade/admin/** 与方法上的 @OperatorOnly，按同一套权限码实时判定），
 * 前端藏菜单不等于有权限。</p>
 */
export interface MyPermission {
  userId: number
  marketId: number
  roles: string[]
  permissions: string[]
  wildcard: boolean
}

export async function getMyPermissions() {
  const response = await axios.get('/api/v1/platform/permissions/mine')
  return response.data
}

/** 是否具备某个权限码（支持 * 与 prefix:* 通配）。 */
export function hasPermission(data: MyPermission | undefined, code: string): boolean {
  if (!data) return false
  if (data.wildcard || (data.permissions ?? []).includes('*')) return true
  if ((data.permissions ?? []).includes(code)) return true
  const colon = code.indexOf(':')
  return colon > 0 && (data.permissions ?? []).includes(code.slice(0, colon) + ':*')
}
