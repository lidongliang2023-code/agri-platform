/**
 * 交易域能力校验回归（agri-trade :8089）
 *
 * 链路：
 *   1. 无令牌 → 401（原有认证拦截器）
 *   2. 有令牌但没有交易身份 → 供货/采购写接口 403，提示去「我的组织 → 业务身份」
 *   3. GET 读接口不受能力影响
 *   4. 临时开通「批发商」身份 → 同一写接口放行到业务校验（不再 403）
 *   5. 运营端路径不受能力拦截
 *   6. 清理：删除本轮身份申请，恢复原状
 *
 * 用法：node scripts/e2e-trade-capability.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

const CORE = 'http://localhost:8093'
const TRADE = 'http://localhost:8089'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const sql = (q) => {
  if (!existsSync(MYSQL)) return ''
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' }).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 80)}`
  }
}

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const readJson = async (res) => {
  try {
    return await res.json()
  } catch {
    return null
  }
}

const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
})).json()
const token = login?.data?.accessToken ?? ''
check(Boolean(token), '拿到平台令牌')

const AUTH = { Authorization: `Bearer ${token}` }
const tradeCall = async (method, url, body, headers = {}) => {
  const response = await fetch(`${TRADE}${url}`, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, body: await readJson(response) }
}

/* ---------- 1) 无令牌 / 有令牌无身份 ---------- */
const anonymous = await tradeCall('POST', '/api/trade/seller/product/mine', {})
check(anonymous.status === 401, '无令牌发布商品 401', `status=${anonymous.status}`)

const deniedSeller = await tradeCall('POST', '/api/trade/seller/product/mine', {}, AUTH)
check(deniedSeller.status === 403 && String(deniedSeller.body?.message ?? '').includes('业务身份'),
  '无交易身份发布商品被 403', `status=${deniedSeller.status} msg=${String(deniedSeller.body?.message ?? '').slice(0, 26)}`)

const deniedDemand = await tradeCall('POST', '/api/trade/demand', {}, AUTH)
check(deniedDemand.status === 403 && String(deniedDemand.body?.message ?? '').includes('业务身份'),
  '无交易身份发布采购需求被 403', `status=${deniedDemand.status}`)

const readList = await tradeCall('GET', '/api/trade/seller/product/mine', null, AUTH)
check(readList.status !== 401 && readList.status !== 403, 'GET 读接口不受能力影响', `status=${readList.status}`)

/* ---------- 2) 临时开通批发商身份 ---------- */
const sessionRes = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
})
const cookie = (sessionRes.headers.getSetCookie?.() ?? []).map((item) => item.split(';')[0]).join('; ')
const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ identityType: 'wholesaler', subjectName: 'E2E交易能力主体' }),
})).json()
const applicationId = applied?.data?.id ?? ''
check(Boolean(applicationId), '提交批发商身份申请', `id=${applicationId}`)

let approved = false
try {
  const review = await (await fetch(`${CORE}/api/v1/admin/identity-applications/${applicationId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...AUTH },
    body: JSON.stringify({ approved: true, remark: 'e2e 交易能力' }),
  })).json()
  approved = review?.code === 0
  check(approved, '运营审核通过', `code=${review?.code}`)

  const allowedSeller = await tradeCall('POST', '/api/trade/seller/product/mine', {}, AUTH)
  check(allowedSeller.status !== 403,
    '开通批发商后发布商品放行到业务校验', `status=${allowedSeller.status} code=${allowedSeller.body?.code}`)

  const allowedDemand = await tradeCall('POST', '/api/trade/demand', {}, AUTH)
  check(allowedDemand.status !== 403,
    '开通批发商后发布采购需求也放行', `status=${allowedDemand.status} code=${allowedDemand.body?.code}`)

  // 商城供应商能力应随交易身份一起生效
  const supplierCheck = await (await fetch(`${CORE}/api/v1/internal/capability-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'X-Internal-Token': 'agri-internal-dev' },
    body: JSON.stringify({ code: 's2b2c.supplier' }),
  })).json()
  check(supplierCheck?.data?.granted === true, '开通批发商后 s2b2c.supplier 变为具备',
    `granted=${supplierCheck?.data?.granted}`)

  const adminPath = await tradeCall('POST', '/api/trade/admin/__e2e_none__', {}, AUTH)
  const adminMessage = String(adminPath.body?.message ?? '')
  check(!adminMessage.includes('业务身份'), '运营端路径不经过能力拦截',
    `status=${adminPath.status} msg=${adminMessage.slice(0, 20)}`)
} finally {
  if (applicationId) {
    sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${applicationId}'`)
  }
}

const left = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE id = '${applicationId}'`)
console.log(`\n清理：身份申请已删除（残留 ${left}）`)

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
