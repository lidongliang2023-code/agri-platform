/**
 * 用户中心（账号中心）页面校验：IA 分组、账号总览、待接入说明、既有功能可达。
 *
 * 用法：node scripts/check-uc-account-center.mjs
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')
const { existsSync } = require2('node:fs')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const BASE = 'http://localhost'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
const page = await ctx.newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  // 必须带上栈：天地图 SDK 抛的 `Cannot read properties of undefined (reading 'extend')`
  // 光看 message 跟本仓库的 bug 一模一样，只有栈帧里的 military.js 能区分。
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 160))
})

try {
  // 账号中心的接口（/api/v1/sso/account/**）认的是 **SSO 全局会话 Cookie**，
  // 不是平台 accessToken —— 直接打 /api/v1/auth/login 拿到的令牌对它无效（会 401 请先登录）。
  // 所以这里走真实登录页：账号+密码 → 建立全局会话 → 再进账号中心。
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 20000 })
  // 用文本/占位符定位而不是 getByRole：这些 tab 与按钮都是 <button> 内嵌多个 span，
  // 可访问名在不同浏览器下拼出来的空格不一致，role+name 匹配不稳。
  // 默认落在「手机号 + 验证码」，必须先切到「账号 + 密码」才会出现用户名/密码框。
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 8000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  check(!page.url().includes('/sso/index.html'), 'SSO 登录成功并跳转', page.url().replace(BASE, ''))

  await page.goto(`${BASE}/portal/index.html#/account`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)

  const text = await page.evaluate(() => document.body.innerText)
  const compact = text.replace(/\s+/g, ' ')

  // 1) 原型 8 组导航
  for (const group of ['账号', '身份', '认证', '组织权限', '安全', '消息', '我的服务', '设置']) {
    check(compact.includes(group), `侧栏分组「${group}」存在`)
  }
  // 2) 进度提示
  // 原型 28 项 + 既有功能「收货地址」1 项 = 29 项（不是拍脑袋的 20）
  check(/已实现 \d+ \/ 29 项/.test(compact), '显示原型条目实现进度', (compact.match(/已实现[^·]*/) ?? [''])[0])
  // 3) 账号总览
  check(compact.includes('账号总览'), '默认进入「账号总览」')
  check(compact.includes('安全评分'), '账号总览含安全评分')
  check(compact.includes('我的身份'), '账号总览含我的身份')
  check(compact.includes('待办事项'), '账号总览含待办事项')

  // 4) 29 项已全部实现，不应再有「暂未接入」的条目。
  //    这一条是"反向断言"：如果以后有人把某项改回 pending，这里会立刻失败。
  //    早期版本这里验的是「点二次验证 → 显示待接入说明」，第 17 轮把 MFA 做完后该断言失效。
  const pendingItems = await page.evaluate(() => {
    const nodes = Array.from(document.querySelectorAll('.uc-nav-item'))
    return nodes
      .filter((node) => (node.textContent ?? '').includes('待接入'))
      .map((node) => (node.textContent ?? '').trim())
  })
  check(pendingItems.length === 0, '侧栏已无「待接入」条目（29/29 全部实现）',
    pendingItems.join(' | '))

  // 二次验证现在应该是真实功能页，而不是缺口面板
  await page.locator('.uc-nav-item').filter({ hasText: '二次验证' }).first().click()
  await page.waitForTimeout(1200)
  const mfaText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(!mfaText.includes('暂未接入'), '「二次验证」不再是待接入面板')
  check(mfaText.includes('二次验证') && (mfaText.includes('未启用') || mfaText.includes('已启用')),
    '「二次验证」显示真实状态')

  // 5) 点「成员管理」→ 既有功能可达
  await page.locator('.uc-nav-item').filter({ hasText: '成员管理' }).first().click()
  await page.waitForTimeout(1200)
  const teamText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(teamText.includes('成员'), '「成员管理」可打开既有功能')
  check(!teamText.includes('暂未接入'), '「成员管理」不是待接入面板')

  check(jsErrors.length === 0, '无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

console.log('')
if (failures.length === 0) { console.log('全部断言通过 ✅'); process.exit(0) }
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
