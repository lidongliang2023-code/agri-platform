/**
 * 开通主数据运营端的"非超管运营账号"（幂等，全部走既有接口，不直接改库）
 *
 * 为什么需要这个账号：按钮级权限点对超管是**不生效**的（`permissions` 含 `*` 直接放行），
 * 而运营端此前只有 `admin` 一个 SUPER_ADMIN 能进 —— 于是"运营端按钮按权限点隐藏"这件事
 * 没有任何一个账号能验出来。本脚本把这条分支变成可验证的：
 *
 *   1) 给平台角色 MARKET_OPS 补上 `masterdata:read` / `masterdata:write`
 *      —— 这正是主数据后端 `application.yml` 里写明的开通方式（改数据，不改代码）；
 *   2) 建运营账号 mdmops 并绑到 MARKET_OPS（不是 SUPER_ADMIN，所以它会受权限点约束）；
 *   3) 自检三件事：它能读运营端接口、能调写接口、且 `permission/mine` 明确报告
 *      `superAdmin=false`（这条为假就说明它还是超管，隐藏逻辑验了个假的）。
 *
 * 用法：node scripts/provision-mdm-operator-access.mjs
 *   默认口令 Admin@123（与本地其它演示账号一致，可用 MDM_OPERATOR_PASSWORD 覆盖）。
 */
const CORE = process.env.CORE_URL || 'http://localhost:8093'
const MDM = process.env.MDM_URL || 'http://localhost:8080'
const ROLE_CODE = process.env.MDM_OPERATOR_ROLE || 'MARKET_OPS'
const USERNAME = process.env.MDM_OPERATOR_USERNAME || 'mdmops'
const PASSWORD = process.env.MDM_OPERATOR_PASSWORD || 'Admin@123'
const MARKET_ID = 1
const NEEDED = ['masterdata:read', 'masterdata:write']

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

async function call(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { code: -1, message: text.slice(0, 160), data: null }
  }
  return { status: response.status, code: parsed?.code ?? -1, message: parsed?.message ?? '', data: parsed?.data }
}

const unwrap = (result, label) => {
  if (result.status >= 400 || (result.code !== 0 && result.code !== 200)) {
    throw new Error(`${label}失败：${result.message || `HTTP ${result.status}`}`)
  }
  return result.data
}

const login = async (username) => unwrap(await call(CORE, '/api/v1/auth/login', {
  method: 'POST', body: { username, password: PASSWORD, marketId: MARKET_ID },
}), `${username} 登录`)

async function main() {
  const admin = await login('admin')
  const token = admin?.accessToken ?? ''
  check(Boolean(token), '以 admin 取得平台运营令牌')

  // 1) 角色权限码：先读回现有码，再覆盖写入合并后的列表 —— 不能拿两份硬编码清单互相覆盖
  const roles = unwrap(await call(CORE, '/api/v1/admin/roles', { token }), '查询平台角色')
  const role = (roles ?? []).find((item) => item.code === ROLE_CODE)
  if (!role) throw new Error(`平台角色 ${ROLE_CODE} 不存在，请确认 core-platform 的角色迁移已执行`)
  const before = unwrap(await call(CORE, `/api/v1/admin/roles/${ROLE_CODE}/permissions`, { token }), '读取角色权限码') ?? []
  const merged = [...new Set([...before.map(String), ...NEEDED])]
  unwrap(await call(CORE, `/api/v1/admin/roles/${ROLE_CODE}/permissions`, {
    method: 'PUT', token, body: { permissions: merged },
  }), '写入角色权限码')
  const after = unwrap(await call(CORE, `/api/v1/admin/roles/${ROLE_CODE}/permissions`, { token }), '回读角色权限码') ?? []
  check(NEEDED.every((code) => after.includes(code)),
    `${ROLE_CODE} 现在具备主数据运营端读写码（原有 ${before.length} 个码一个都没丢）`,
    `before=${before.length} after=${after.length}`)
  check(after.length === before.length + (before.some((c) => NEEDED.includes(String(c))) ? 0 : NEEDED.length),
    '权限码是合并而不是替换（覆盖写会把市场运营的其它能力抹掉）', `after=${after.length}`)

  // 2) 运营账号
  const page = unwrap(await call(CORE, `/api/v1/admin/users?page=1&size=20&keyword=${encodeURIComponent(USERNAME)}`,
    { token }), '查询运营账号')
  const existing = (page?.records ?? []).find((item) => item.username === USERNAME)
  const userId = existing ? String(existing.id) : String(unwrap(await call(CORE, '/api/v1/admin/users', {
    method: 'POST', token,
    body: {
      username: USERNAME, nickname: '主数据运营（非超管）', phone: '13800139300',
      password: PASSWORD, marketId: MARKET_ID, roleId: Number(role.id),
    },
  }), '创建运营账号'))
  check(Boolean(userId), '运营账号已就绪', `${USERNAME}(id=${userId}) 角色=${ROLE_CODE}`)

  // 3) 自检：能读、能写、且不是超管
  const operator = await login(USERNAME)
  const operatorToken = operator?.accessToken ?? ''
  check(Boolean(operatorToken), `${USERNAME} 登录成功`)

  const readProbe = await call(MDM, '/admin/masterdata/subject/list?pageNum=1&pageSize=1', { token: operatorToken })
  check(readProbe.code === 200, '它能读运营端接口（RBAC 的 masterdata:read 已生效）',
    `code=${readProbe.code} ${String(readProbe.message).slice(0, 30)}`)

  const writeProbe = await call(MDM, '/admin/masterdata/permission/points/sync', { method: 'POST', token: operatorToken })
  check(writeProbe.code === 200, '它能调运营端写接口（masterdata:write 已生效，拦它的只可能是权限点）',
    `code=${writeProbe.code}`)

  const mine = unwrap(await call(MDM, '/admin/masterdata/permission/mine', { token: operatorToken }), '读取我的权限点')
  check(mine?.superAdmin === false, `${USERNAME} 明确不是超管 —— 否则按钮隐藏根本验不出来`,
    `superAdmin=${mine?.superAdmin} username=${mine?.username}`)

  const adminMine = unwrap(await call(MDM, '/admin/masterdata/permission/mine', { token }), '读取超管的我的权限点')
  check(adminMine?.superAdmin === true, '对照：admin 仍是超管（权限点永不拦它）', `superAdmin=${adminMine?.superAdmin}`)
}

main().then(() => {
  console.log('')
  if (failures.length) {
    console.log(`失败 ${failures.length} 项：`)
    failures.forEach((label) => console.log('  -', label))
    process.exit(1)
  }
  console.log('主数据运营账号开通完成 ✅')
}).catch((error) => {
  console.error('执行异常：', String(error?.message ?? error).slice(0, 200))
  process.exit(1)
})
