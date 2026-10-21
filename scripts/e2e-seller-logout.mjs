#!/usr/bin/env node
/** 卖家中心退出登录 → 官网门户首页（2026-10-21）。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const HEADFUL = process.argv.includes('--headful')
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto('http://localhost:8098/portal/', { waitUntil: 'networkidle2', timeout: 60000 })
  const login = await page.evaluate(async () => {
    const response = await fetch('/api/v1/sso/login-standalone', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '19900002005',
        password: 'Test12345',
        marketId: 1,
        remember: false,
      }),
    })
    return await response.json()
  })
  check(login.code === 0 && login.data?.stage === 'done', '卖家账号登录成功')

  await page.goto('http://localhost:8086/member/seller?tab=goods', {
    waitUntil: 'networkidle2',
    timeout: 60000,
  })
  await page.waitForSelector('.mc-logout', { timeout: 30000 })
  check((await page.evaluate(() => document.body.innerText)).includes('卖家中心'), '卖家中心已进入')

  await page.click('.mc-logout')
  await page.waitForFunction(() => {
    return location.origin === 'http://localhost:8098'
      && location.pathname.startsWith('/portal/')
  }, { timeout: 30000 })
  await page.waitForFunction(() => document.body.innerText.includes('从田间到餐桌'), { timeout: 20000 })
  const finalUrl = page.url()
  const text = await page.evaluate(() => document.body.innerText)
  check(finalUrl.startsWith('http://localhost:8098/portal/'), '退出后落到官网门户首页', finalUrl)
  check(text.includes('从田间到餐桌') && text.includes('产业链频道'), '官网门户首页内容已渲染')
  check(!text.includes('已登录') && text.includes('免费注册'), '退出后官网恢复未登录态')

  const session = await page.evaluate(async () => {
    const response = await fetch('/api/v1/sso/onboarding/status', { credentials: 'include' })
    let body = null
    try { body = await response.json() } catch { /* 空响应 */ }
    return { status: response.status, body }
  })
  check(session.status === 401 || session.body?.code === 401 || session.body?.code !== 0,
    '认证中心会话已销毁', `${session.status}/${session.body?.code ?? ''}`)
  check(errors.length === 0, '退出流程无未捕获脚本异常', errors.slice(0, 2).join(' | '))
  await page.screenshot({ path: path.join(OUT, 'seller-logout-portal-home.png'), fullPage: true })
} catch (error) {
  check(false, '卖家退出登录回归未抛异常', String(error).slice(0, 240))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
