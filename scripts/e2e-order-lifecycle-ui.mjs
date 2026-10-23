#!/usr/bin/env node
/** 全链路订单在买家端、卖家端的最终状态与按钮角色验收。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const TRADE = 'http://localhost:8086'
const ORDER_ID = process.argv.find((item) => /^\d+$/.test(item)) ?? '7624'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const fill = async (page, selector, value) => page.evaluate(({ target, next }) => {
  const input = document.querySelector(target)
  if (!(input instanceof HTMLInputElement)) throw new Error(`未找到输入框 ${target}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, next)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}, { target: selector, next: value })

const loginAndOpen = async (page, centerPath, username, password) => {
  await page.goto(`${TRADE}${centerPath}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => window.location.port === '8090', { timeout: 20000 })
  await page.waitForSelector('button[role="tab"]', { timeout: 20000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => item.textContent?.includes('账号 + 密码'))
    tab?.click()
  })
  await fill(page, 'input[autocomplete="username"]', username)
  await fill(page, 'input[autocomplete="current-password"]', password)
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => item.textContent?.includes('登 录'))
    button?.click()
  })
  for (let i = 0; i < 60; i += 1) {
    await sleep(400)
    if (page.url().includes(':8086') && page.url().includes(centerPath)) break
  }
  await page.waitForSelector('.mc-shell', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 12000 }).catch(() => {})

  await page.goto(`${TRADE}/order/detail/${ORDER_ID}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.order-detail-hero', { timeout: 30000 })
  await page.waitForFunction((id) => document.body.innerText.includes(`/order/detail/${id}`)
    || document.body.innerText.includes('订单总额'), { timeout: 20000 }, ORDER_ID)
  await sleep(500)
  return page.evaluate(() => document.body.innerText)
}

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
})
try {
  const buyerContext = await browser.createBrowserContext()
  const buyer = await buyerContext.newPage()
  const buyerErrors = []
  buyer.on('pageerror', (error) => buyerErrors.push(String(error)))
  await buyer.setViewport({ width: 1440, height: 1000 })
  const buyerText = await loginAndOpen(buyer, '/member/buyer', '19900002005', 'Test12345')
  check(buyerText.includes('订单总额') && buyerText.includes('¥266'), '买家可打开全链路订单详情')
  check(buyerText.includes('已退款'), '买家端最终状态显示为已退款')
  check(buyerText.includes('delivered') || buyerText.includes('已签收'), '买家端显示物流已签收状态')
  check(!buyerText.includes('立即支付') && !buyerText.includes('确认收货')
    && !buyerText.includes('申请退货退款'), '退款完成后不再显示支付、收货、重复退款按钮')
  check(buyerErrors.length === 0, '买家订单详情无未捕获脚本异常', buyerErrors.slice(0, 2).join(' | '))
  await buyer.screenshot({ path: path.join(OUT, 'order-lifecycle-buyer.png'), fullPage: true })
  await buyerContext.close()

  const sellerContext = await browser.createBrowserContext()
  const seller = await sellerContext.newPage()
  const sellerErrors = []
  seller.on('pageerror', (error) => sellerErrors.push(String(error)))
  await seller.setViewport({ width: 1440, height: 1000 })
  const sellerText = await loginAndOpen(seller, '/member/seller', 'farmer', 'Admin@123')
  check(sellerText.includes('订单总额') && sellerText.includes('¥266'), '卖家可打开全链路订单详情')
  check(sellerText.includes('已退款'), '卖家端最终状态显示为已退款')
  check(!sellerText.includes('确认发货') && !sellerText.includes('立即支付')
    && !sellerText.includes('确认收货'), '退款完成后卖家端不再显示履约按钮')
  check(sellerErrors.length === 0, '卖家订单详情无未捕获脚本异常', sellerErrors.slice(0, 2).join(' | '))
  await seller.screenshot({ path: path.join(OUT, 'order-lifecycle-seller.png'), fullPage: true })
  await sellerContext.close()
} catch (error) {
  check(false, '浏览器验收未抛异常', String(error).slice(0, 300))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
