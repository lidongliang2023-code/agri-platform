/**
 * 能力校验扩展到生产 / 金融的回归（纯接口，不需要浏览器）。
 *
 * 验证链路：
 *   1. 能力接口：admin 有 production.manage（有主体）、没有 finance.apply（主体未认证）
 *   2. 内部校验接口：需要平台令牌 + X-Internal-Token 双门；缺内部令牌 403
 *   3. 生产域写接口：无令牌 401；有令牌且有能力 → 放行（返回业务结果而非 401/403）
 *   4. 金融域融资申请：无令牌 401；有令牌但主体未认证 → 403，消息说明缺认证
 *
 * 用法：node scripts/e2e-uc-capability-gate.mjs
 */
import path from 'node:path'
import process from 'node:process'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'

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
const CERT_ID = '9501'
const BINDING_ID = '9001'
let certTouched = false
let bindingTouched = false

const CORE = 'http://localhost:8093'
const PRODUCTION = 'http://localhost:8092'
const FINANCE = 'http://localhost:8087'
const INFO = 'http://localhost:8096'
const IOT = 'http://localhost:8091'
const SERVICE = 'http://localhost:8094'
const INTERNAL_TOKEN = 'agri-internal-dev'

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const readJson = async (response) => {
  try {
    return await response.json()
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

/* ---------- 1) 能力接口（会话口径） ---------- */
const sessionResponse = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
})
const sessionBody = await readJson(sessionResponse)
const cookie = (sessionResponse.headers.getSetCookie?.() ?? []).map((item) => item.split(';')[0]).join('; ')
check(sessionBody?.code === 0 && cookie !== '', '建立 SSO 会话')
const capabilities = await readJson(await fetch(`${CORE}/api/v1/sso/account/capabilities`, {
  headers: { Cookie: cookie },
}))
const caps = capabilities?.data?.capabilities ?? []
const productionCap = caps.find((item) => item.code === 'production.manage')
const financeCap = caps.find((item) => item.code === 'finance.apply')
check(productionCap?.granted === true, 'admin 具备 production.manage（已加入经营主体）', `granted=${productionCap?.granted}`)
check(financeCap?.granted === false, 'admin 不具备 finance.apply（主体认证未通过）', `granted=${financeCap?.granted} reason=${financeCap?.reason}`)
const consumerCap = caps.find((item) => item.code === 's2b2c.consumer')
const supplierCap = caps.find((item) => item.code === 's2b2c.supplier')
check(consumerCap?.granted === true, 's2b2c.consumer 登录即具备', `granted=${consumerCap?.granted}`)
check(supplierCap?.granted === false, 's2b2c.supplier 需交易身份（当前不具备）', `reason=${supplierCap?.reason}`)

/* ---------- 2) 内部校验接口双门 ---------- */
const internal = async (body, headers = {}) => {
  const response = await fetch(`${CORE}/api/v1/internal/capability-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: await readJson(response) }
}
const okProduction = await internal({ code: 'production.manage' }, { 'X-Internal-Token': INTERNAL_TOKEN })
check(okProduction.body?.code === 0 && okProduction.body?.data?.granted === true,
  '内部接口：production.manage 判定为具备', `granted=${okProduction.body?.data?.granted}`)
const okFinance = await internal({ code: 'finance.apply' }, { 'X-Internal-Token': INTERNAL_TOKEN })
check(okFinance.body?.code === 0 && okFinance.body?.data?.granted === false,
  '内部接口：finance.apply 判定为不具备', `reason=${okFinance.body?.data?.reason}`)
const badInternal = await internal({ code: 'finance.apply' }, { 'X-Internal-Token': 'wrong-token' })
check(badInternal.status >= 400 || badInternal.body?.code >= 400,
  '内部令牌错误被拒', `status=${badInternal.status} code=${badInternal.body?.code}`)

/* ---------- 3) 生产域写接口 ---------- */
const farmWrite = async (headers) => {
  const response = await fetch(`${PRODUCTION}/api/v1/production/farms/__e2e_none__`, {
    method: 'DELETE',
    headers,
  })
  return { status: response.status, body: await readJson(response) }
}
const anonymousFarm = await farmWrite({})
check(anonymousFarm.status === 401, '生产写接口：无令牌 401', `status=${anonymousFarm.status}`)
const allowedFarm = await farmWrite({ Authorization: `Bearer ${token}` })
check(allowedFarm.status !== 401 && allowedFarm.status !== 403,
  '生产写接口：具备能力后放行（返回业务结果）', `status=${allowedFarm.status}`)
  // 真实用户走网关（:80 → agri-production），确认拦截器在真实链路上生效
  const gatewayFarm = await (await fetch('http://localhost/api/v1/production/farms/__e2e_none__', {
    method: 'DELETE',
  })).json().catch(() => null)
  check(gatewayFarm?.code === 401, '生产写接口（经网关）：无令牌被拦', `code=${gatewayFarm?.code}`)

/* ---------- 4) 金融域融资申请 ---------- */
const loanApply = async (headers) => {
  const response = await fetch(`${FINANCE}/api/v1/loan/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({}),
  })
  return { status: response.status, body: await readJson(response) }
}
const anonymousLoan = await loanApply({})
check(anonymousLoan.status === 401, '融资申请：无令牌 401', `status=${anonymousLoan.status}`)
const blockedLoan = await loanApply({ Authorization: `Bearer ${token}` })
const blockedMessage = String(blockedLoan.body?.message ?? '')
check(blockedLoan.status === 403 && blockedMessage.includes('认证'),
  '融资申请：主体未认证被能力校验拦下', `status=${blockedLoan.status} msg=${blockedMessage.slice(0, 30)}`)

/* ---------- 4.5) 资讯供需发布：透传到交易域的能力校验 ---------- */
const infoPublish = await (await fetch(`${INFO}/api/v1/info/supply-demands`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify({ sdType: 'demand', title: 'e2e 能力透传', category: '测试', quantity: '1', contactPhone: '13800000000' }),
})).json().catch(() => null)
check(String(infoPublish?.message ?? '').includes('业务身份'),
  '资讯供需发布被交易域能力拦截（错误透传）',
  `code=${infoPublish?.code} msg=${String(infoPublish?.message ?? '').slice(0, 24)}`)

/* ---------- 4.6) 物联网写接口 ---------- */
const iotWrite = async (headers) => {
  const response = await fetch(`${IOT}/api/iot/device`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: '{}',
  })
  return { status: response.status, body: await readJson(response) }
}
const anonymousIot = await iotWrite({})
check(anonymousIot.status === 401, '物联网写接口：无令牌 401', `status=${anonymousIot.status}`)
const allowedIot = await iotWrite({ Authorization: `Bearer ${token}` })
check(allowedIot.status !== 401 && allowedIot.status !== 403,
  '物联网写接口：有主体时放行', `status=${allowedIot.status} code=${allowedIot.body?.code}`)

/* ---------- 4.7) 服务商工作台：需要 service.provider ---------- */
const serviceWrite = async (headers) => {
  const response = await fetch(`${SERVICE}/api/v1/service/mobile/workbench/provider/999999/demands/999999/accept`, {
    method: 'POST',
    headers,
  })
  return { status: response.status, body: await readJson(response) }
}
const anonymousService = await serviceWrite({})
check(anonymousService.status === 401, '服务商工作台：无令牌 401', `status=${anonymousService.status}`)
const deniedService = await serviceWrite({ Authorization: `Bearer ${token}` })
check(deniedService.status === 403 && String(deniedService.body?.message ?? '').includes('服务商'),
  '服务商工作台：无服务商身份被 403', `status=${deniedService.status} msg=${String(deniedService.body?.message ?? '').slice(0, 24)}`)

/* ---------- 5) 金融放行分支：临时把主体认证置为通过 ---------- */
const certOriginal = sql(`SELECT cert_status FROM agri_core.platform_merchant_certification WHERE id = ${CERT_ID}`)
if (sql(`UPDATE agri_core.platform_merchant_certification SET cert_status = 'approved' WHERE id = ${CERT_ID}`) !== 'ERR') {
  certTouched = true
}
const capsApproved = await readJson(await fetch(`${CORE}/api/v1/sso/account/capabilities`, { headers: { Cookie: cookie } }))
const financeApproved = (capsApproved?.data?.capabilities ?? []).find((item) => item.code === 'finance.apply')
check(financeApproved?.granted === true, '主体认证通过后 finance.apply 变为具备', `granted=${financeApproved?.granted}`)
const loanAllowed = await loanApply({ Authorization: `Bearer ${token}` })
check(loanAllowed.status !== 403 && Number(loanAllowed.body?.code) !== 403,
  '融资申请：认证通过后放行到业务校验（不再被能力拦截）',
  `status=${loanAllowed.status} code=${loanAllowed.body?.code} msg=${String(loanAllowed.body?.message ?? '').slice(0, 20)}`)
if (certTouched) {
  sql(`UPDATE agri_core.platform_merchant_certification SET cert_status = '${certOriginal || 'pending'}' WHERE id = ${CERT_ID}`)
}
certTouched = false

/* ---------- 6) 生产拒绝分支：临时移除主体成员关系 ---------- */
const bindingOriginal = sql(`SELECT status FROM agri_core.platform_user_merchant WHERE id = ${BINDING_ID}`)
if (sql(`UPDATE agri_core.platform_user_merchant SET status = 0 WHERE id = ${BINDING_ID}`) !== 'ERR') {
  bindingTouched = true
}
const deniedFarm = await farmWrite({ Authorization: `Bearer ${token}` })
check(deniedFarm.status === 403 && String(deniedFarm.body?.message ?? '').includes('经营主体'),
  '生产写接口：没有经营主体时 403', `status=${deniedFarm.status} msg=${String(deniedFarm.body?.message ?? '').slice(0, 24)}`)
const deniedIot = await iotWrite({ Authorization: `Bearer ${token}` })
check(deniedIot.status === 403 && String(deniedIot.body?.message ?? '').includes('经营主体'),
  '物联网写接口：没有经营主体时 403', `status=${deniedIot.status}`)
if (bindingTouched) {
  sql(`UPDATE agri_core.platform_user_merchant SET status = ${bindingOriginal || 1} WHERE id = ${BINDING_ID}`)
}
bindingTouched = false
const restoredFarm = await farmWrite({ Authorization: `Bearer ${token}` })
check(restoredFarm.status !== 401 && restoredFarm.status !== 403, '恢复成员关系后生产写接口重新放行', `status=${restoredFarm.status}`)
const restoredIot = await iotWrite({ Authorization: `Bearer ${token}` })
check(restoredIot.status !== 401 && restoredIot.status !== 403, '恢复成员关系后物联网写接口重新放行', `status=${restoredIot.status}`)

/* ---------- 7) 运营端路径不受能力拦截 ---------- */
const adminPath = await fetch(`${PRODUCTION}/api/v1/production/admin/__e2e_none__`, { method: 'POST' })
check(adminPath.status !== 401 && adminPath.status !== 403,
  '生产运营端路径不经过能力拦截', `status=${adminPath.status}`)
// 兜底恢复：万一上面异常中断
sql(`UPDATE agri_core.platform_merchant_certification SET cert_status = '${certOriginal || 'pending'}' WHERE id = ${CERT_ID}`)
sql(`UPDATE agri_core.platform_user_merchant SET status = ${bindingOriginal || 1} WHERE id = ${BINDING_ID}`)

/* ---------- 8) 服务商工作台放行分支（临时开通服务商身份） ---------- */
let serviceApplicationId = ''
try {
  const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ identityType: 'service_provider', subjectName: 'E2E服务商能力主体' }),
  })).json()
  serviceApplicationId = applied?.data?.id ?? ''
  const reviewed = await (await fetch(`${CORE}/api/v1/admin/identity-applications/${serviceApplicationId}/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ approved: true, remark: 'e2e 服务商能力' }),
  })).json()
  check(reviewed?.code === 0, '服务商身份审核通过', `code=${reviewed?.code}`)
  const allowedService = await serviceWrite({ Authorization: `Bearer ${token}` })
  check(allowedService.status !== 403, '服务商工作台：开通身份后放行', `status=${allowedService.status} code=${allowedService.body?.code}`)
} finally {
  if (serviceApplicationId) {
    sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${serviceApplicationId}'`)
  }
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
