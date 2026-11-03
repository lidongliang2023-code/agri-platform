/**
 * 主数据管理 · 统一认证登录闭环回归
 *
 * 针对一个真实故障：登录后浏览器在「统一认证中心」与 `/sso/callback` 之间无限打转。
 *
 * 根因（已修）：`main.ts` 在 `router.isReady()` 之前就用 `currentRoute` 判断"是不是公开页"，
 * 此时 currentRoute 还是 START_LOCATION（meta 为空、fullPath='/'），于是**任何**页面
 * ——包括公开的 /sso/callback——都被当成受保护页踢到 /login；登录页挂载后又自动跳认证中心，
 * 形成死循环。因为是竞态，表现成"有时候能进、有时候卡住"。
 *
 * 本脚本验证的场景（每条都要不出现循环、且最终落到业务页）：
 *   A. 首次访问（无 Cookie）→ 认证中心 → 登录 → 回到 /dashboard
 *   B. **已登录后重新打开首页**（有 Cookie，走静默续签）→ 直接进业务页，不经过认证中心
 *   C. 已登录后**直接访问受保护深链接** → 落到该页面（不是登录页）
 *   D. 已登录后**刷新**业务页 → 不弹回登录页
 *   E. 认证中心回跳（带 code）时，`/sso/token` 必须真的被调用一次
 *   F. 全程无 JS 错误；且不出现"登录页反复自动跳转"
 *
 * 循环的判定：统计 10 秒窗口内 `/authorize` 与 `/sso/callback` 的请求次数，
 * 超过阈值即判定为打转（正常一次登录最多各 1~2 次）。
 *
 * 用法：node scripts/e2e-mdm-sso-loop.mjs
 */
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

const MDM = 'http://localhost:8080'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 950 } })
const page = await context.newPage()

/** 统计认证相关请求次数（用于判定打转） */
const hits = { authorize: 0, callback: 0, token: 0, loginHtml: 0 }
page.on('request', (req) => {
  const url = req.url()
  if (url.includes('/authorize?')) hits.authorize++
  if (url.includes('/sso/callback')) hits.callback++
  if (url.includes('/api/v1/sso/token')) hits.token++
  if (/localhost:8090\/login/.test(url)) hits.loginHtml++
})
const resetHits = () => {
  hits.authorize = 0
  hits.callback = 0
  hits.token = 0
  hits.loginHtml = 0
}

const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

/** 在认证中心页面填表登录 */
async function signInOnSso() {
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click({ timeout: 10000 })
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
}

const text = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

try {
  /* ---------- A. 首次访问：无 Cookie → 认证中心 → 登录 → 业务页 ---------- */
  resetHits()
  await page.goto(`${MDM}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check(page.url().includes(':8090/login'), 'A1 未登录时被送到认证中心登录页',
    page.url().replace('http://localhost', '').slice(0, 60))

  await signInOnSso()
  await page.waitForTimeout(5000)
  check(page.url().startsWith(`${MDM}/dashboard`), 'A2 登录后落到运营大盘',
    page.url().replace('http://localhost', ''))
  check(hits.token === 1, 'A3 换票接口被调用恰好 1 次', `token=${hits.token}`)
  check(hits.authorize <= 2 && hits.callback <= 2, 'A4 未出现认证打转',
    `authorize=${hits.authorize} callback=${hits.callback}`)
  const dash = await text()
  check(dash.includes('运营大盘') || dash.includes('主数据'), 'A5 页面渲染出业务内容')
  check(!dash.includes('正在完成登录'), 'A6 没有停在"正在完成登录"中间页')

  /* ---------- B. 已登录后重新打开首页：应静默续签直进，不经认证中心 ---------- */
  resetHits()
  await page.goto(`${MDM}/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  check(!page.url().includes(':8090'), 'B1 有 Cookie 时不再跳认证中心',
    page.url().replace('http://localhost', ''))
  check(page.url().startsWith(`${MDM}/dashboard`), 'B2 直接进入运营大盘',
    page.url().replace('http://localhost', ''))
  check(hits.authorize === 0 && hits.callback === 0, 'B3 全程未发生认证跳转',
    `authorize=${hits.authorize} callback=${hits.callback}`)

  /* ---------- C. 已登录后直接访问受保护深链接 ---------- */
  resetHits()
  await page.goto(`${MDM}/uc/identity-audit`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  check(page.url().includes('/uc/identity-audit'), 'C1 深链接直接落到目标页（没被弹回登录页）',
    page.url().replace('http://localhost', ''))
  check(!page.url().includes(':8090'), 'C2 深链接未经过认证中心')
  const deep = await text()
  check(deep.includes('身份申请审核'), 'C3 目标页真的渲染出来了')

  /* ---------- D. 已登录后刷新业务页：不掉登录 ---------- */
  resetHits()
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  check(page.url().includes('/uc/identity-audit'), 'D1 刷新后仍在原页面',
    page.url().replace('http://localhost', ''))
  check(!page.url().includes('/login'), 'D2 刷新后没有被弹回登录页')
  check(hits.authorize === 0, 'D3 刷新未触发认证跳转', `authorize=${hits.authorize}`)

  /* ---------- E. 回调页本身不再把用户踢走 ---------- */
  resetHits()
  /* 用一个无效 code 直接访问回调页：应显示明确错误，而不是被换成登录页再自动跳走 */
  await page.goto(`${MDM}/sso/callback?code=invalid-code-for-test&state=whatever`, {
    waitUntil: 'domcontentloaded',
  })
  await page.waitForTimeout(3000)
  const cbText = await text()
  check(page.url().includes('/sso/callback'), 'E1 回调页没有被自动换成登录页',
    page.url().replace('http://localhost', ''))
  check(cbText.includes('登录未完成'), 'E2 回调失败时给出明确错误页（不是空白/打转）')
  check(hits.authorize === 0, 'E3 回调失败没有触发自动跳认证中心', `authorize=${hits.authorize}`)

  /* ---------- F. 手动回到登录页时，自动跳转冷却生效 ---------- */
  resetHits()
  await page.goto(`${MDM}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(4000)
  /* 第一次自动跳是允许的；但如果一直打转，10 秒内会出现多次 authorize */
  check(hits.authorize <= 1, 'F1 登录页自动跳转最多一次（未打转）', `authorize=${hits.authorize}`)

  check(jsErrors.length === 0, '全程无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
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
