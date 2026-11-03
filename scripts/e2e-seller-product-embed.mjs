#!/usr/bin/env node
/** 卖家中心从商品管理进入发布商品回归（2026-10-24）。 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))
const TRADE = 'http://localhost:8086'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
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

const browser = await chromium.launch({
  headless: true,
  executablePath: BROWSER,
  args: ['--no-sandbox'],
})
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${TRADE}/member/seller?tab=goods`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => window.location.port === '8090', undefined, { timeout: 20000 })
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
  await page.waitForSelector('.mc-shell', { timeout: 30000 })
  const menu = await page.$$eval('.mc-side-nav button', (items) =>
    items.map((item) => ({ text: item.textContent?.trim(), active: item.classList.contains('on') })))
  const menuTexts = menu.map((item) => item.text)
  check(!menuTexts.includes('发布新商品') && !menuTexts.includes('供应发布'),
    '卖家中心侧栏不再显示发布新商品和供应发布菜单')
  check(menuTexts.indexOf('商品管理') >= 0
    && menuTexts.indexOf('商品管理') < menuTexts.indexOf('报价与撮合')
    && menuTexts.indexOf('报价与撮合') < menuTexts.indexOf('销售订单'),
  '商品管理、报价与撮合均排在销售订单之前')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => (item.textContent ?? '').trim() === '上架新商品')
    button?.click()
  })
  await page.waitForFunction(() => new URLSearchParams(location.search).get('tab') === 'publish')
  await page.waitForSelector('.product-create-page.is-embedded', { timeout: 20000 })
  check(page.url().includes('tab=publish'), '商品管理页按钮进入发布新商品')
  const text = await page.evaluate(() => document.body.innerText)
  check(text.includes('发布新商品') && text.includes('基础信息')
    && text.includes('价格与SKU库存') && text.includes('添加 SKU') && text.includes('商品图片'),
  '独立菜单内加载完整商品发布功能')
  check((await page.$$eval('.product-create-page input', (items) => items.length)) > 5,
    '商品发布表单字段完整渲染')
  await page.screenshot({ path: path.join(OUT, 'seller-publish-product.png'), fullPage: true })

  await page.goto(`${TRADE}/product/create?sellerId=2112531950528262146`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForFunction(() => window.location.pathname === '/member/seller'
    && new URLSearchParams(location.search).get('tab') === 'publish', { timeout: 15000 })
  check(page.url().includes('sellerId=2112531950528262146'),
    '旧发布商品地址兼容跳转并保留卖家主体')

  await page.goto(`${TRADE}/product/edit/7011?sellerId=2112531950528262146`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForFunction(() => window.location.pathname === '/member/seller'
    && new URLSearchParams(location.search).get('tab') === 'publish'
    && new URLSearchParams(location.search).get('id') === '7011', { timeout: 15000 })
  check(true, '旧编辑商品地址兼容跳转到卖家中心发布页')
  check(errors.length === 0, '发布新商品页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '发布新商品嵌入回归未抛异常', String(error).slice(0, 280))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
