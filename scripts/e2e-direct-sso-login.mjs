#!/usr/bin/env node
/** 交易中心受保护页面直达统一认证登录回归。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const TRADE = 'http://localhost:8086'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const fill = async (page, selector, value) => page.evaluate(({ target, next }) => {
  const input = document.querySelector(target)
  if (!(input instanceof HTMLInputElement)) throw new Error(`未找到输入框 ${target}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, next)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}, { target: selector, next: value })

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto(`${TRADE}/member/seller?tab=goods`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  })
  await page.waitForFunction(() => window.location.port === '8090', { timeout: 20000 })
  check(page.url().includes(':8090/') && page.url().includes('/login'),
    '卖家中心未登录直达统一认证登录页', page.url())
  check(!page.url().includes(':8086/login'), '不经过交易中心本地登录页')

  await page.waitForSelector('button[role="tab"]', { timeout: 20000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => item.textContent?.includes('账号 + 密码'))
    tab?.click()
  })
  await fill(page, 'input[autocomplete="username"]', '19900002005')
  await fill(page, 'input[autocomplete="current-password"]', 'Test12345')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => item.textContent?.includes('登 录'))
    button?.click()
  })
  for (let i = 0; i < 50; i += 1) {
    await sleep(400)
    if (page.url().includes(':8086/member/seller')) break
  }
  check(page.url().includes(':8086/member/seller?tab=goods')
    || page.url().includes(':8086/member/seller'),
  '统一认证成功后返回卖家中心原页面', page.url())

  const isolated = await browser.createBrowserContext()
  const another = await isolated.newPage()
  await another.goto(`${TRADE}/order/create`, { waitUntil: 'networkidle2', timeout: 60000 })
  await another.waitForFunction(() => window.location.port === '8090', { timeout: 20000 })
  check(another.url().includes(':8090/') && another.url().includes('/login'),
    '其他交易中心受保护页面同样直达统一认证', another.url())
  await isolated.close()
  check(errors.length === 0, '直达登录过程无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '直达统一认证回归未抛异常', String(error).slice(0, 260))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
