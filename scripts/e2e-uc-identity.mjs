/**
 * 用户中心 · 身份申请 端到端验证（用户提交 → 运营审核 全闭环）
 *
 * 验证链路：
 *   1. 用户端返回 6 类身份，初始均为 available
 *   2. 提交「批发商」申请 → pending；同身份重复提交 → 409
 *   3. 运营端列表能看到这条待审
 *   4. 运营审核通过 → 用户端状态变 approved
 *   5. 用户端/运营端页面都能渲染
 *   6. 撤回：再提一条「零售商」→ 撤回 → cancelled
 *   7. 清理本轮造的申请单与操作日志
 *
 * 用法：node scripts/e2e-uc-identity.mjs
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
const MYSQL = existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
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

const BASE = 'http://localhost'
const OPS = 'http://localhost:8080'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const marker = `身份E2E${Date.now().toString().slice(-6)}`
const baselineId = Number(sql('SELECT IFNULL(MAX(id),0) FROM agri_core.platform_identity_application') || 0)

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1050 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

/**
 * 两套鉴权：`/sso/account/**` 认 SSO 全局会话 Cookie；`/admin/**` 在 JwtAuthFilter
 * 的 SUPER_ADMIN_ONLY 白名单里，**只认 Bearer**，带 Cookie 也是 401。
 * 这里对 /admin/** 先用 HttpOnly 刷新凭证换一枚短时令牌（不新建会话、不多一台设备）。
 */
let accessToken = ''
async function ensureToken() {
  if (accessToken) return accessToken
  accessToken = await page.evaluate(async () => {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const j = await res.json().catch(() => null)
    return j?.data?.accessToken ?? ''
  })
  return accessToken
}

const call = async (method, url, body) => {
  const needBearer = url.startsWith('/api/v1/admin/')
  const token = needBearer ? await ensureToken() : ''
  return page.evaluate(
    async ({ m, u, b, t }) => {
      const headers = {}
      if (b) headers['Content-Type'] = 'application/json'
      if (t) headers.Authorization = `Bearer ${t}`
      const res = await fetch(u, {
        method: m,
        credentials: 'include',
        headers,
        body: b ? JSON.stringify(b) : undefined,
      })
      let json = null
      try {
        json = await res.json()
      } catch {
        /* 非 JSON */
      }
      return { status: res.status, json }
    },
    { m: method, u: url, b: body, t: token },
  )
}

try {
  /* ---------- 登录 ---------- */
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  check(!page.url().includes('/sso/index.html'), 'SSO 登录成功')

  /* 主数据域必须先走完自己的 SSO 回调才有本域登录态：直接访问 `/` 会自动
     302 到认证中心（此时全局会话已建立），再回跳换票。少了这一步，
     下面访问 8080 的任何页面都会被守卫送回登录页。 */
  await page.goto(`${OPS}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(4000)


  /* ---------- 1) 初始 6 类身份 ---------- */
  const init = await call('GET', '/api/v1/sso/account/identity-applications')
  const identities = init.json?.data?.identities ?? []
  check(init.json?.code === 0, '身份申请接口可用', `code=${init.json?.code}`)
  check(identities.length === 6, '返回 6 类身份', `count=${identities.length}`)
  check(
    identities.every((r) => r.status === 'available'),
    '初始均为「可申请」',
    identities.map((r) => r.status).join(','),
  )

  /* ---------- 2) 提交申请 ---------- */
  const apply = await call('POST', '/api/v1/sso/account/identity-applications', {
    identityType: 'wholesaler',
    subjectName: marker,
    creditCode: '91370811MA00000001',
    businessPlace: '金乡县大蒜市场 A-12',
    businessCategory: '大蒜',
    annualVolume: '800 吨',
    contactName: '张三',
    contactPhone: '13800000000',
    applyNote: '端到端联调申请',
  })
  check(apply.json?.code === 0, '提交「批发商」申请成功',
    `code=${apply.json?.code} msg=${apply.json?.message ?? ''}`)
  const applicationId = apply.json?.data?.id

  const afterApply = await call('GET', '/api/v1/sso/account/identity-applications')
  const wholesaler = (afterApply.json?.data?.identities ?? []).find((r) => r.code === 'wholesaler')
  check(wholesaler?.status === 'pending', '提交后状态为「审核中」', `status=${wholesaler?.status}`)

  const dup = await call('POST', '/api/v1/sso/account/identity-applications', {
    identityType: 'wholesaler',
    subjectName: marker,
  })
  check(dup.json?.code === 409, '同身份重复提交被拒（409）',
    `code=${dup.json?.code} msg=${String(dup.json?.message ?? '').slice(0, 30)}`)

  const dbRow = sql(
    `SELECT identity_type,status FROM agri_core.platform_identity_application WHERE id=${applicationId}`,
  )
  check(dbRow.includes('pending'), '申请单已落库（直连 MySQL 复核）', dbRow)

  /* ---------- 3) 运营端看到待审 ---------- */
  const opsList = await call('GET', '/api/v1/admin/identity-applications?pageNum=1&pageSize=100&status=pending')
  const opsRows = opsList.json?.data?.records ?? []
  check(opsList.json?.code === 0, '运营端身份申请列表可用', `code=${opsList.json?.code}`)
  const target = opsRows.find((r) => r.id === String(applicationId))
  check(Boolean(target), '运营端能看到这条待审', target ? `申请人=${target.applicantName}` : `rows=${opsRows.length}`)

  /* ---------- 4) 审核通过 ---------- */
  const review = await call('POST', `/api/v1/admin/identity-applications/${applicationId}/review`, {
    approved: true,
    remark: '材料齐全，审核通过',
  })
  check(review.json?.code === 0, '运营审核通过', `code=${review.json?.code} msg=${review.json?.message ?? ''}`)

  const afterReview = await call('GET', '/api/v1/sso/account/identity-applications')
  const approved = (afterReview.json?.data?.identities ?? []).find((r) => r.code === 'wholesaler')
  check(approved?.status === 'approved', '用户端状态变为「已开通」', `status=${approved?.status}`)
  check(Boolean(approved?.reviewTime), '带回了审核时间')

  const repeat = await call('POST', `/api/v1/admin/identity-applications/${applicationId}/review`, {
    approved: false,
  })
  check(repeat.json?.code === 400, '已处理的申请不能重复审核（400）', `code=${repeat.json?.code}`)

  /* ---------- 5) 撤回 ---------- */
  const apply2 = await call('POST', '/api/v1/sso/account/identity-applications', {
    identityType: 'retailer',
    subjectName: marker,
  })
  const id2 = apply2.json?.data?.id
  check(apply2.json?.code === 0, '提交「零售商」申请成功', `code=${apply2.json?.code}`)
  const cancel = await call('DELETE', `/api/v1/sso/account/identity-applications/${id2}`)
  check(cancel.json?.code === 0, '撤回申请成功', `code=${cancel.json?.code}`)
  const afterCancel = await call('GET', '/api/v1/sso/account/identity-applications')
  const retailer = (afterCancel.json?.data?.identities ?? []).find((r) => r.code === 'retailer')
  check(retailer?.status === 'cancelled', '撤回后状态为「已撤回」', `status=${retailer?.status}`)

  /* ---------- 6) 用户端页面 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/identityApply`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1800)
  const userText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(userText.includes('可申请身份'), '「身份申请」页已打开')
  for (const label of ['批发商', '零售商', '农户', '合作社管理员', '服务商', '政府人员']) {
    check(userText.includes(label), `渲染身份「${label}」`)
  }
  check(userText.includes('已开通'), '已通过的身份显示「已开通」')

  /* ---------- 7) 运营端页面 ---------- */
  await page.goto(`${OPS}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.locator('text=关联系统（只读）').first().click()
  await page.waitForTimeout(500)
  const menuText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(menuText.includes('身份申请审核'), '运营端菜单含「身份申请审核」')

  await page.goto(`${OPS}/uc/identity-audit`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const opsText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(opsText.includes('身份申请审核'), '「身份申请审核」页已打开')
  check(!opsText.includes('页面不存在'), '不是兜底 404')

  /* 这一页调的是 /api/v1/admin/**（超管白名单，只认 Bearer）。默认筛选是「待审核」，
     而这条申请刚被审完，所以切到「全部状态」再断言 —— 只有 ensureToken() 真的换到
     令牌、表格真的取到数据，这行才会出现。光看标题是验不出 401 的。 */
  check(!/加载失败|未认证|凭证已失效/.test(opsText), '运营端页面无鉴权报错',
    opsText.match(/加载失败|未认证|凭证已失效/)?.[0] ?? '')
  await page.locator('select.filter-select').first().selectOption('all')
  await page.waitForTimeout(1800)
  const allText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(allText.includes(marker), '切换「全部状态」后能看到本轮申请单', marker)
  check(allText.includes('已通过'), '该申请单显示「已通过」')

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  await browser.close()
}

/* ---------- 清理 ---------- */
if (MYSQL) {
  const before = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_identity_application WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_user_operation_log WHERE action IN ('identity_apply','identity_cancel')`)
  const left = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE subject_name LIKE '${marker}%'`)
  console.log(`\n清理：本轮新增申请单 ${before} 条已删除（剩余 ${left}）`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
