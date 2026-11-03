/**
 * 用户中心 · 业务身份 → 能力 → 业务接口 联动回归
 *
 * 验证链路（真实审核 + 真实业务接口）：
 *   1. 未开通身份：交易挂牌接口被 403 拒绝，错误文案指向「我的组织 → 业务身份」
 *   2. 提交「批发商」身份申请 → 运营审核通过
 *   3. GET /sso/account/capabilities 出现 trade.wholesale（granted）
 *   4. 同一挂牌接口放行（SELL / BUY 都可用）
 *   5. 跨模块入口：交易模块由 blocked 变为 available
 *   6. 页面：业务身份区块出现「批发交易」能力标签
 *   7. 清理：删除挂牌与身份申请记录，恢复原状
 *
 * 用法：node scripts/e2e-uc-capability.mjs
 */
import { existsSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
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

const BASE = 'http://localhost'
const PORTAL = 'http://localhost:8098'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'uc-capability-20261030')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1080 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  if (!page.url().includes(':8098')) return
  const text = String(e?.message ?? e)
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(text)) jsErrors.push(text.slice(0, 140))
})

const call = (method, url, body, headers = {}) =>
  page.evaluate(async ({ m, u, b, h }) => {
    const res = await fetch(u, {
      method: m,
      credentials: 'include',
      headers: { ...(b ? { 'Content-Type': 'application/json' } : {}), ...h },
      body: b ? JSON.stringify(b) : undefined,
    })
    let json = null
    try { json = await res.json() } catch { /* 非 JSON */ }
    return { status: res.status, json }
  }, { m: method, u: url, b: body, h: headers })

let applicationId = ''
const listingIds = []

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

  // 运营接口令牌（审核用）
  const adminLogin = await (await fetch(`${BASE}:8093/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
  })).json()
  const ADMIN_AUTH = { Authorization: `Bearer ${adminLogin?.data?.accessToken ?? ''}` }
  check(adminLogin?.code === 0 && Boolean(adminLogin?.data?.accessToken), '拿到运营令牌')

  // 清掉上一轮可能残留的「批发商」已通过申请，保证从"无能力"开始
  sql(`DELETE FROM agri_core.platform_identity_application WHERE user_id = (SELECT id FROM agri_core.platform_user WHERE username = 'admin') AND identity_type = 'wholesaler'`)

  /* ---------- 1) 无身份：业务接口被拒 ---------- */
  const listingPayload = (type) => ({
    type, merchantId: 2001, productId: 1, productName: `E2E能力联动-${type}`, quantity: 1, price: 1,
  })
  const denied = await call('POST', '/api/v1/trade/listings', listingPayload('SELL'), ADMIN_AUTH)
  check(denied.json?.code !== 0 && String(denied.json?.message ?? '').includes('业务身份'),
    '未开通身份时发布挂牌被拒，并说明缺哪类身份', `code=${denied.json?.code} msg=${String(denied.json?.message ?? '').slice(0, 32)}`)
  const modulesBefore = await call('GET', '/api/v1/sso/account/modules')
  const tradeBefore = (modulesBefore.json?.data?.modules ?? []).find((m) => m.code === 'trade')
  check(tradeBefore?.state === 'blocked' && (tradeBefore?.missing ?? []).includes('trade_identity'),
    '跨模块入口：交易模块因缺交易身份被阻断', `state=${tradeBefore?.state}`)

  /* ---------- 2) 提交并审核业务身份 ---------- */
  const applied = await call('POST', '/api/v1/sso/account/identity-applications', {
    identityType: 'wholesaler', subjectName: 'E2E能力联动主体', creditCode: '91320100MA1CAP8X',
  })
  applicationId = applied.json?.data?.id ?? ''
  check(applied.json?.code === 0 && Boolean(applicationId), '提交批发商身份申请', `id=${applicationId}`)

  const reviewed = await call('POST', `/api/v1/admin/identity-applications/${applicationId}/review`,
    { approved: true, remark: 'e2e 能力联动' }, ADMIN_AUTH)
  check(reviewed.json?.code === 0, '运营审核通过', `code=${reviewed.json?.code}`)

  /* ---------- 3) 能力生效 ---------- */
  const capabilities = await call('GET', '/api/v1/sso/account/capabilities')
  const wholesale = (capabilities.json?.data?.capabilities ?? []).find((c) => c.code === 'trade.wholesale')
  check(wholesale?.granted === true, '能力接口：trade.wholesale 已开通', `granted=${wholesale?.granted}`)
  const modulesAfter = await call('GET', '/api/v1/sso/account/modules')
  const tradeAfter = (modulesAfter.json?.data?.modules ?? []).find((m) => m.code === 'trade')
  check(tradeAfter?.state === 'available', '跨模块入口：交易模块变为可用', `state=${tradeAfter?.state}`)

  /* ---------- 4) 同一业务接口放行 ---------- */
  const sell = await call('POST', '/api/v1/trade/listings', listingPayload('SELL'), ADMIN_AUTH)
  check(sell.json?.code === 0 && Boolean(sell.json?.data), '审核通过后可发布供货挂牌', `id=${sell.json?.data}`)
  if (sell.json?.data) listingIds.push(sell.json.data)

  const buy = await call('POST', '/api/v1/trade/listings', listingPayload('BUY'), ADMIN_AUTH)
  check(buy.json?.code === 0 && Boolean(buy.json?.data), '批发商也可发布采购挂牌', `id=${buy.json?.data}`)
  if (buy.json?.data) listingIds.push(buy.json.data)

  /* ---------- 5) 页面展示 ---------- */
  await page.goto(`${PORTAL}/portal/index.html#/account/org`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('.uc-cap-strip', { timeout: 15000 })
  await page.waitForTimeout(600)
  const strip = await page.evaluate(() => document.querySelector('.uc-cap-strip')?.innerText.replace(/\s+/g, ' ') ?? '')
  check(strip.includes('批发交易'), '业务身份区块显示「批发交易」能力标签', strip.slice(0, 50))
  await page.screenshot({ path: path.join(OUT, '01-capability-strip.png'), fullPage: false })

  check(jsErrors.length === 0, '门户页无控制台异常', jsErrors[0] ?? '')
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  /* ---------- 清理 ---------- */
  if (MYSQL) {
    for (const id of listingIds) {
      sql(`DELETE FROM agri_core.trade_listing WHERE id = '${id}'`)
    }
    if (applicationId) {
      sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${applicationId}'`)
    }
    const left = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE id = '${applicationId}'`)
    console.log(`\n清理：挂牌 ${listingIds.length} 条、身份申请 1 条（残留 ${left}）`)
  }
  await browser.close()
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
