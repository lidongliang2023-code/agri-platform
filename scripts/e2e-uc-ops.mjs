/**
 * 用户中心 · 运营端（主数据管理控制台）验证
 *
 * 本轮做了三件事，脚本逐条验：
 *   1. 菜单把散落的「用户列表 / 认证审核 / 主体内组织 / 角色管理」收进「用户中心」一组
 *   2. 新增「用户中心总览」页，KPI 与后端实时聚合一致（不是写死的数字）
 *   3. 修掉「认证审核」页的成功码判定 bug —— 原先按 code===200 判，后端返回 0，
 *      导致列表永远是空的、还挂着"加载失败"
 *
 * 访问方式：运营端在 **8080 根路径**（nginx 注释里写明"直接 http://localhost:8080/ 打开"）。
 * 注意路由是 history 模式且 base='/', 所以不能加 /mdm/ 前缀，否则命中兜底 404。
 *
 * 用法：node scripts/e2e-uc-ops.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const SSO = 'http://localhost'
const OPS = 'http://localhost:8080'
const MYSQL = existsSync('C:////Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:////Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
  : ''
const sql = (q) => {
  if (!MYSQL) return ''
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

/* ---------- 0) 取后端真实数字，作为断言基准 ---------- */
const login = await (
  await fetch(`${SSO}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
  })
).json()
check(login.code === 0, '接口登录', `code=${login.code}`)
const AUTH = { Authorization: `Bearer ${login.data.accessToken}` }
const getJson = async (url) => (await (await fetch(url, { headers: AUTH })).json())

const enterprise = await getJson(`${SSO}/api/v1/admin/merchant-certifications?pageNum=1&pageSize=200`)
const personal = await getJson(`${SSO}/api/v1/admin/user-identities?pageNum=1&pageSize=200`)
const entRows = enterprise?.data?.records ?? []
const perRows = personal?.data?.records ?? []
const expectTotal = entRows.length + perRows.length
// 两侧状态字段名与取值都不同：企业是 certStatus（draft/pending/approved/rejected），
// 个人是 status（draft/pending/verified/rejected）。脚本必须按同一口径归一，
// 否则算出来的"期望值"跟页面比的是两个东西。
const norm = (raw) => {
  const t = String(raw ?? '').toLowerCase()
  if (t === 'approved' || t === 'verified') return 'approved'
  if (t === 'rejected') return 'rejected'
  if (t === 'pending') return 'pending'
  if (t === 'draft') return 'draft'
  return t || 'unknown'
}
const expectPending =
  entRows.filter((r) => norm(r.certStatus) === 'pending').length +
  perRows.filter((r) => norm(r.status) === 'pending').length
const expectApproved =
  entRows.filter((r) => norm(r.certStatus) === 'approved').length +
  perRows.filter((r) => norm(r.status) === 'approved').length
check(expectTotal > 0, '后端有认证数据可作为基准', `企业 ${entRows.length} + 个人 ${perRows.length}`)

/* ---------- 1) 浏览器：登录运营端 ---------- */
const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

try {
  await page.goto(`${SSO}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)

  /* 先走完主数据域自己的 SSO 回调（访问 `/` 会自动 302 到认证中心再回来换票）。
     旧版主数据前端有缺陷，未登录也能渲染页面骨架，脚本因此"看起来能过"；
     修复后必须真正完成这一跳。 */
  await page.goto(`${OPS}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(4500)

  await page.goto(`${OPS}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const menuText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

  /* ---------- 2) 菜单分组 ---------- */
  check(menuText.includes('关联系统（只读）'), '侧栏出现「关联系统（只读）」分组（用户中心入口所在分组）')
  // 分组默认折叠，子项不在 DOM 文本里 —— 先点开再断言
  await page.locator('text=关联系统（只读）').first().click()
  await page.waitForTimeout(600)
  const expandedMenu = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  /* 断言按**当前真实菜单**写。
     早先这里断言的是「用户列表 / 主体内组织 / 角色管理」，那是旧菜单名，
     而且当时是靠匹配整页文本"假通过"—— 菜单实际叫「全平台用户 / 全平台组织 /
     角色与权限点」，用户中心入口则全部挂在「关联系统（只读）」分组下。
     断言写成真实名称后，菜单一旦被改坏（或入口被删）这里就会立刻失败。 */
  for (const label of [
    '用户中心总览',
    '身份管理',
    '身份申请审核',
    '资质审核',
    '意见反馈处理',
    '隐私与数据申请',
  ]) {
    check(expandedMenu.includes(label), `「关联系统（只读）」下含用户中心入口「${label}」`)
  }
  check(!menuText.includes('用户管理'), '旧的「用户管理」分组已并入（不重复）')
  check(!menuText.includes('组织架构'), '旧的「组织架构」分组已并入（不重复）')

  /* ---------- 3) 用户中心总览页 ---------- */
  await page.goto(`${OPS}/uc/overview`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2200)
  const ovText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(page.url().includes('/uc/overview'), '「用户中心总览」路由可达', page.url().replace(OPS, ''))
  check(ovText.includes('用户中心总览'), '页面标题渲染')
  check(ovText.includes('认证申请总数'), '含「认证申请总数」KPI')
  check(ovText.includes('待审核'), '含「待审核」KPI')
  check(ovText.includes('快捷入口'), '含快捷入口区')
  check(!ovText.includes('页面不存在'), '不是兜底 404 页')

  // KPI 数字必须与后端一致（防"写死演示数字"）
  const kpiNumbers = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.audit-kpi')]
    return cards.map((c) => ({
      label: c.querySelector('span')?.textContent?.trim() ?? '',
      value: c.querySelector('strong')?.textContent?.trim() ?? '',
    }))
  })
  const totalCard = kpiNumbers.find((c) => c.label.includes('认证申请总数'))
  const pendingCard = kpiNumbers.find((c) => c.label === '待审核')
  check(Number(totalCard?.value) === expectTotal, '「认证申请总数」与后端一致',
    `页面 ${totalCard?.value} / 后端 ${expectTotal}`)
  check(Number(pendingCard?.value) === expectPending, '「待审核」与后端一致',
    `页面 ${pendingCard?.value} / 后端 ${expectPending}`)
  const approvedCard = kpiNumbers.find((c) => c.label === '已通过')
  check(Number(approvedCard?.value) === expectApproved, '「已通过」与后端一致（含个人 verified）',
    `页面 ${approvedCard?.value} / 后端 ${expectApproved}`)
  const draftCard = kpiNumbers.find((c) => c.label.includes('草稿'))
  check(draftCard !== undefined, '单独统计「草稿」而不是混进待审', draftCard?.value ?? '')

  /* ---------- 4) 认证审核页（验证 code 判定修复） ---------- */
  await page.goto(`${OPS}/user/audit`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2500)
  const auditText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(auditText.includes('认证审核'), '「认证审核」页已打开')
  check(!auditText.includes('加载失败'), '没有「加载失败」提示（code 判定已修）',
    (auditText.match(/[^\s]*加载失败[^\s]*/) ?? [''])[0])
  // 用后端第一条真实姓名作为"数据真的渲染出来了"的证据
  const sampleName = String(perRows[0]?.realName ?? entRows[0]?.merchantName ?? '')
  check(sampleName.length > 0 && auditText.includes(sampleName),
    '列表渲染出后端真实数据', `样例：${sampleName}`)

  /* ---------- 5) 身份管理 ---------- */
  await page.goto(`${OPS}/uc/identity`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const idText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(idText.includes('身份管理'), '「身份管理」页已打开')
  check(!idText.includes('页面不存在'), '「身份管理」不是兜底 404')
  const idRows = await page.evaluate(() => document.querySelectorAll('.uc-table tbody tr').length)
  check(idRows > 0, '「身份管理」渲染出数据行', `rows=${idRows}`)
  const idTotal = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.audit-kpi')]
    const hit = cards.find((c) => c.querySelector('span')?.textContent?.includes('身份总数'))
    return hit?.querySelector('strong')?.textContent?.trim()
  })
  check(Number(idTotal) === perRows.length, '「身份总数」与后端一致',
    `页面 ${idTotal} / 后端 ${perRows.length}`)

  /* ---------- 6) 资质审核 ---------- */
  await page.goto(`${OPS}/uc/certification`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const certText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(certText.includes('资质审核'), '「资质审核」页已打开')
  check(!certText.includes('页面不存在'), '「资质审核」不是兜底 404')
  const certRows = await page.evaluate(() => document.querySelectorAll('.uc-table tbody tr').length)
  check(certRows > 0, '「资质审核」渲染出数据行', `rows=${certRows}`)
  const certTotal = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.audit-kpi')]
    const hit = cards.find((c) => c.querySelector('span')?.textContent?.includes('资质总数'))
    return hit?.querySelector('strong')?.textContent?.trim()
  })
  check(Number(certTotal) === entRows.length, '「资质总数」与后端一致',
    `页面 ${certTotal} / 后端 ${entRows.length}`)

  /* ---------- 7) 身份管理页不再提供审核入口 ----------
     早先这里点「通过」按钮验证写路径。后来产品决策把审核动作**收敛到用户中心运营端**：
     同一个动作在两个页面都能改，审核记录会出现两套口径（页面自己写着这句）。
     于是这里的旧断言必然失败 —— 改成反向断言，守住这条约束：
     身份管理页一旦又把按钮加回来，这条会立刻报警。
     审核写路径本身由 e2e-uc-identity.mjs（身份申请审核）覆盖。 */
  await page.goto(`${OPS}/uc/identity`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1800)
  const identityPageText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  const approveCount = await page.locator('button', { hasText: '通过' }).count()
  const rejectCount = await page.locator('button', { hasText: '驳回' }).count()
  check(approveCount === 0 && rejectCount === 0,
    '「身份管理」页不再提供通过/驳回按钮（审核统一在运营端，避免两套口径）',
    `通过=${approveCount} 驳回=${rejectCount}`)
  check(identityPageText.includes('已移除'), '页面写明了为什么移除审核按钮')

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
