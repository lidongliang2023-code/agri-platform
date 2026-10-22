#!/usr/bin/env node
/** 卖家中心“发布新商品”独立菜单回归（2026-10-22）。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
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

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(`${TRADE}/member/seller?tab=publish`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => window.location.port === '8090', { timeout: 20000 })
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
  await page.waitForSelector('.product-create-page.is-embedded', { timeout: 20000 })
  check(page.url().includes('tab=publish'), '卖家中心独立菜单地址进入发布新商品')

  const menu = await page.$$eval('.mc-side-nav button', (items) =>
    items.map((item) => ({ text: item.textContent?.trim(), active: item.classList.contains('on') })))
  check(menu.some((item) => item.text === '发布新商品' && item.active),
    '卖家中心包含并选中发布新商品菜单')
  const text = await page.evaluate(() => document.body.innerText)
  check(text.includes('上架新商品') && text.includes('基础信息')
    && text.includes('价格与库存') && text.includes('商品图片（首张为主图）'),
  '独立菜单内加载完整商品发布功能')
  check((await page.$$eval('.product-create-page input', (items) => items.length)) > 5,
    '商品发布表单字段完整渲染')
  await page.screenshot({ path: path.join(OUT, 'seller-publish-product.png'), fullPage: true })

  await page.goto(`${TRADE}/product/create?sellerId=2112531950528262146`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  })
  await page.waitForFunction(() => window.location.pathname === '/member/seller'
    && new URLSearchParams(location.search).get('tab') === 'publish', { timeout: 15000 })
  check(page.url().includes('sellerId=2112531950528262146'),
    '旧发布商品地址兼容跳转并保留卖家主体')

  await page.goto(`${TRADE}/product/edit/7011?sellerId=2112531950528262146`, {
    waitUntil: 'networkidle2',
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
