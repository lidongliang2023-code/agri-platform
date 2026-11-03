/**
 * 佣金结算批次点检：运营端发起批次结算（空范围）+ 渠道端批次区渲染。
 * 用法：node scripts/check-settle-batch-ui.mjs
 */
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')
const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const CORE = 'http://localhost:8093'
const PLATFORM = 'http://localhost:8103'
const CHANNEL = 'http://localhost:8085'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'settle-batch-20261030')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const sessionRes = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
})
const cookiePairs = (sessionRes.headers.getSetCookie?.() ?? []).map((x) => x.split(';')[0].split('='))
const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1360, height: 940 } })
await context.addCookies(cookiePairs.map(([name, ...rest]) => ({
  name, value: rest.join('='), domain: 'localhost', path: '/',
})))

const pageErrors = []
const page = await context.newPage()
page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)))
let settleRequest = null
page.on('request', (req) => {
  if (req.url().includes('/api/platform/commission/settlement')) {
    settleRequest = { method: req.method(), body: req.postData() }
  }
})

try {
  await page.goto(`${PLATFORM}/`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.locator('.el-menu-item', { hasText: '等级与佣金' }).click()
  await page.waitForTimeout(1200)
  let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(!page.url().includes('/login') && !text.includes('404 Not Found'), '运营端免登录直进（SSO 会话有效）', page.url())
  check(text.includes('佣金结算批次'), '运营端展示「佣金结算批次」', '')
  check(text.includes('批量结算待结算佣金'), '运营端有批量结算按钮', '')

  await page.locator('input[placeholder*="渠道 ID"]').fill('999999999')
  const [settleRes] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/api/platform/commission/settlement') && r.request().method() === 'POST', { timeout: 20000 }),
    page.locator('button', { hasText: '批量结算待结算佣金' }).click(),
  ])
  const settleResponse = await settleRes.json().catch(() => null)
  await page.waitForTimeout(800)
  text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(String(settleRequest?.body ?? '').includes('999999999'), '结算请求带上渠道参数', String(settleRequest?.body ?? ''))
  check(settleResponse?.success === false && String(settleResponse?.message ?? '').includes('没有待结算佣金'),
    '空范围结算返回无待结算提示', `message=${settleResponse?.message ?? ''}`)
  check(text.includes('没有待结算佣金') || text.includes('所选范围内没有待结算佣金'), '页面可见空范围提示', '')
  await page.screenshot({ path: path.join(OUT, 'platform-settlement.png'), fullPage: false })

  pageErrors.length = 0
  await page.goto(`${CHANNEL}/`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.locator('.el-menu-item', { hasText: '佣金管理' }).click()
  await page.waitForTimeout(1200)
  text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(!page.url().includes('/login') && !text.includes('404 Not Found'), '渠道端免登录直进（SSO 会话有效）', page.url())
  check(text.includes('结算批次'), '渠道端展示「结算批次」区', '')
  await page.screenshot({ path: path.join(OUT, 'channel-settlements.png'), fullPage: false })

  check(pageErrors.length === 0, '页面无运行时异常', pageErrors.slice(0, 2).join(' | '))
} finally {
  await browser.close()
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
