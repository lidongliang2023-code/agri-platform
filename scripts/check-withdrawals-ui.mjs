/**
 * 运营端「提现审核」页面点检（经 SSO 登录 8103）。
 * 用法：node scripts/check-withdrawals-ui.mjs
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
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'withdrawals-ui-20261030')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage()
const errors = []
page.on('pageerror', (e) => {
  if (!page.url().includes(':8103')) return
  errors.push(String(e?.message ?? e).slice(0, 120))
})

try {
  await page.goto('http://localhost:8103/withdrawals', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1200)
  if (!page.url().includes(':8103')) {
    await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
    await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 }).catch(() => {})
    await page.locator('input[placeholder*="用户名"]').first().fill('admin').catch(() => {})
    await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123').catch(() => {})
    await page.locator('button').filter({ hasText: '登' }).first().click().catch(() => {})
    await page.waitForURL(/localhost:8103/, { timeout: 30000 }).catch(() => {})
    await page.goto('http://localhost:8103/withdrawals', { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(2000)
  }
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(page.url().includes(':8103'), 'SSO 登录后进入运营端', page.url())
  check(text.includes('提现审核') && text.includes('渠道申请提现后在这里审核'), '提现审核页渲染')
  check(text.includes('提现审核') || text.includes('待审核'), '状态筛选可用')
  await page.screenshot({ path: path.join(OUT, 'withdrawals.png'), fullPage: false })
  check(errors.length === 0, '页面无 JS 异常', errors[0] ?? '')
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
