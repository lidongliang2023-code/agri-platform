/**
 * 政府监管端登录链路点检：经统一认证登录后能进入监管工作台。
 *
 * 用法：node scripts/check-gov-login-ui.mjs
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

const BASE = 'http://localhost:8108'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'gov-login-20261030')
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
  if (!page.url().includes(':8108')) return
  errors.push(String(e?.message ?? e).slice(0, 120))
})

try {
  await page.goto(`${BASE}/gov/#/home`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  if (!page.url().includes(':8108')) {
    await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
    await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 }).catch(() => {})
    await page.locator('input[placeholder*="用户名"]').first().fill('admin').catch(() => {})
    await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123').catch(() => {})
    await page.locator('button').filter({ hasText: '登' }).first().click().catch(() => {})
    await page.waitForURL(/localhost:8108/, { timeout: 30000 }).catch(() => {})
    await page.goto(`${BASE}/gov/#/home`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(2500)
  }
  check(page.url().includes(':8108'), 'SSO 登录后回到政府监管端', page.url())
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.length > 60 && !text.includes('没有该操作的权限'), '监管工作台可进入', `${text.length} 字符`)
  await page.screenshot({ path: path.join(OUT, 'gov-home.png'), fullPage: false })
  check(errors.length === 0, '页面无 JS 异常', errors[0] ?? '')
} finally {
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
