/**
 * 用户中心 · 操作日志 端到端验证
 *
 * 验证链路：
 *   1. 做几个真实动作（登录 / 保存通知设置 / 绑定第三方）→ 日志自动落库
 *   2. 查询接口返回这些记录，且**只返回本人**
 *   3. 按动作筛选生效
 *   4. 页面渲染出表格与行
 *   5. 清理：只删本轮新增的日志（按 id > 基线），不动历史
 *
 * 用法：node scripts/e2e-uc-logs.mjs
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
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/** 本轮开始前的日志 id 基线（清理时只删这之后的） */
const baselineId = Number(sql('SELECT IFNULL(MAX(id),0) FROM agri_core.platform_user_operation_log') || 0)

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1050 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

const call = (method, url, body) =>
  page.evaluate(
    async ({ m, u, b }) => {
      const res = await fetch(u, {
        method: m,
        credentials: 'include',
        headers: b ? { 'Content-Type': 'application/json' } : {},
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
    { m: method, u: url, b: body },
  )

const marker = `oLog${Date.now().toString().slice(-8)}`

try {
  /* ---------- 1) 登录（应产生 login 日志） ---------- */
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  check(!page.url().includes('/sso/index.html'), 'SSO 登录成功')

  /* ---------- 2) 触发两个动作 ---------- */
  const saveNotify = await call('PUT', '/api/v1/sso/account/notification-settings', {
    inappTypes: ['join_request'],
    digest: 'realtime',
  })
  check(saveNotify.json?.code === 0, '保存通知设置成功', `code=${saveNotify.json?.code}`)

  const bind = await call('POST', '/api/v1/sso/account/bindings', {
    provider: 'alipay',
    externalAccount: marker,
    displayName: 'E2E日志',
  })
  check(bind.json?.code === 0, '绑定第三方账号成功', `code=${bind.json?.code}`)

  /* ---------- 3) 查询日志 ---------- */
  const logs = await call('GET', '/api/v1/sso/account/operation-logs?pageNum=1&pageSize=50')
  const rows = logs.json?.data?.records ?? []
  check(logs.json?.code === 0, '操作日志接口可用', `code=${logs.json?.code}`)
  check(rows.length > 0, '有操作日志', `total=${logs.json?.data?.total}`)

  const actions = rows.map((r) => r.action)
  check(actions.includes('login'), '记录了「登录」')
  check(actions.includes('notify_update'), '记录了「更新通知设置」')
  check(actions.includes('binding_bind'), '记录了「绑定第三方账号」')
  check(
    rows.every((r) => r.actionLabel && r.createdAt),
    '每条日志都有动作名与时间',
    rows[0] ? `${rows[0].actionLabel} / ${rows[0].createdAt}` : '',
  )

  /* ---------- 4) 按动作筛选 ---------- */
  const onlyLogin = await call('GET', '/api/v1/sso/account/operation-logs?pageNum=1&pageSize=50&action=login')
  const loginRows = onlyLogin.json?.data?.records ?? []
  check(loginRows.length > 0 && loginRows.every((r) => r.action === 'login'),
    '按动作筛选生效（只返回 login）', `rows=${loginRows.length}`)

  /* ---------- 5) 只返回本人 ---------- */
  const otherUserRows = sql(
    `SELECT COUNT(*) FROM agri_core.platform_user_operation_log WHERE user_id <> 2108130996492058625 AND id > ${baselineId}`,
  )
  check(Number(otherUserRows) === 0, '本轮产生的日志都属于当前账号', `others=${otherUserRows}`)

  /* ---------- 6) 页面渲染 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/logs`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1800)
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('操作日志'), '「操作日志」页已打开')
  check(text.includes('登录账号'), '页面渲染出「登录账号」记录')
  check(text.includes('更新通知设置'), '页面渲染出「更新通知设置」记录')
  check(text.includes('绑定第三方账号'), '页面渲染出「绑定第三方账号」记录')
  const tableRows = await page.evaluate(() => document.querySelectorAll('.uc-logs-table tbody tr').length)
  check(tableRows > 0, '表格有数据行', `rows=${tableRows}`)
  check(text.includes('仅安全类'), '提供「仅安全类」筛选入口')

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

/* ---------- 清理：只删本轮新增 ---------- */
if (MYSQL) {
  const before = sql(`SELECT COUNT(*) FROM agri_core.platform_user_operation_log WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_user_operation_log WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_user_binding WHERE external_account='${marker}'`)
  const left = sql(`SELECT COUNT(*) FROM agri_core.platform_user_operation_log WHERE id > ${baselineId}`)
  console.log(`\n清理：本轮新增日志 ${before} 条已删除（剩余 ${left}）；测试绑定记录已删除`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
