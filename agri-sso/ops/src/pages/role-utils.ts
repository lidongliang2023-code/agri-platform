export const MENU_ACTION = 'read'

export const ACTION_LABEL: Record<string, string> = {
  read: '查看',
  write: '新增/编辑',
  delete: '删除',
  export: '导出',
  audit: '审核',
  admin: '管理',
}

export const ACTIONS: Array<{ key: string; label: string }> = Object.entries(ACTION_LABEL).map(([key, label]) => ({
  key,
  label,
}))

export const OPERATION_ACTIONS = ACTIONS.filter((action) => action.key !== MENU_ACTION)

export const MODULE_LABEL: Record<string, string> = {
  info: '信息资讯',
  trade: '交易撮合',
  produce: '生产管理',
  production: '生产管理',
  iot: '物联网',
  finance: '供应链金融',
  s2b2c: 'S2B2C 商城',
  service: '综合服务',
  gov: '政府监管',
  mdm: '主数据',
  uc: '用户中心',
  user: '账号',
}

export const KNOWN_MODULES = ['info', 'trade', 'produce', 'iot', 'finance', 's2b2c', 'service', 'gov', 'mdm', 'uc', 'user']

export function moduleLabel(module: string): string {
  return MODULE_LABEL[module] ?? module
}

export function permissionLabel(code: string): string {
  if (code === '*') return '全部权限'
  const [module, action] = code.split(':')
  return `${moduleLabel(module ?? code)}·${ACTION_LABEL[action] ?? action ?? '未知'}`
}

export function parsePermissions(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
  } catch {
    return raw.split(',').map((item) => item.trim()).filter(Boolean)
  }
  return []
}

export function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false
  const rightSet = new Set(right)
  return left.every((item) => rightSet.has(item))
}
