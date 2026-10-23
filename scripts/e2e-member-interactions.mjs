#!/usr/bin/env node
/** 会员中心按钮、输入框、页签交互态颜色审计。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8086'
const failures = []
const warnings = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
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

const isBlue = (value) => {
  const match = String(value).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!match) return false
  const [, r, g, b] = match.map(Number)
  return b > 150 && b - r > 65 && b - g > 15
}

const loginAndOpen = async (page, targetPath, username, password) => {
  await page.goto(`${BASE}${targetPath}`, { waitUntil: 'networkidle2', timeout: 60000 })
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
    if (page.url().includes(':8086/member/')) break
  }
  await page.waitForSelector('.mc-shell', { timeout: 30000 })
}

const auditPage = async (page, role, tab, selector) => {
  await page.goto(`${BASE}/member/${role}?tab=${tab}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector(selector, { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {})

  const buttons = await page.$$('.mc-body button:not([disabled])')
  const visibleButtons = []
  for (const button of buttons.slice(0, 16)) {
    const visible = await button.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    if (visible) visibleButtons.push(button)
  }
  let buttonBlue = ''
  for (const button of visibleButtons.slice(0, 10)) {
    await button.hover()
    await sleep(40)
    const style = await button.evaluate((element) => {
      const computed = getComputedStyle(element)
      return {
        text: (element.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 28),
        color: computed.color,
        background: computed.backgroundColor,
        border: computed.borderColor,
      }
    })
    if ([style.color, style.background, style.border].some(isBlue)) {
      buttonBlue = `${style.text || button.constructor.name}: color=${style.color}, bg=${style.background}, border=${style.border}`
      break
    }
  }
  check(!buttonBlue, `${role}/${tab} 按钮悬浮态无默认蓝色`, buttonBlue)

  const inputs = await page.$$('.mc-body input:not([disabled]), .mc-body textarea:not([disabled])')
  let inputBlue = ''
  for (const input of inputs.slice(0, 4)) {
    const visible = await input.evaluate((element) => {
      const rect = element.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
    if (!visible) continue
    await input.focus()
    await sleep(40)
    const border = await input.evaluate((element) => getComputedStyle(element).borderColor)
    if (isBlue(border)) {
      inputBlue = border
      break
    }
  }
  check(!inputBlue, `${role}/${tab} 输入框聚焦态无默认蓝色`, inputBlue)

  const tabs = await page.$$('.mc-body .ant-tabs-tab')
  let tabBlue = ''
  for (const tabElement of tabs.slice(0, 4)) {
    await tabElement.hover()
    await sleep(40)
    const color = await tabElement.evaluate((element) => {
      const label = element.querySelector('.ant-tabs-tab-btn')
      return getComputedStyle(label ?? element).color
    })
    if (isBlue(color)) {
      tabBlue = color
      break
    }
  }
  check(!tabBlue, `${role}/${tab} 页签悬浮态无默认蓝色`, tabBlue)
  warnings.push(`${role}/${tab}: buttons=${visibleButtons.length}, inputs=${inputs.length}, tabs=${tabs.length}`)
}

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
})
try {
  const buyerContext = await browser.createBrowserContext()
  const buyer = await buyerContext.newPage()
  await buyer.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(buyer, '/member/buyer?tab=overview', '19900002005', 'Test12345')
  const buyerPages = [
    ['overview', '.buyer-overview'],
    ['publish', '.buyer-demand-page'],
    ['purchase', '.mc-panel'],
    ['inquiry', '.mc-panel'],
    ['after', '.after-workbench'],
    ['rate', '.buyer-rating-workspace'],
    ['fund', '.buyer-fund-workspace'],
    ['contract', '.contract-page'],
  ]
  for (const [tab, selector] of buyerPages) await auditPage(buyer, 'buyer', tab, selector)
  await buyerContext.close()

  const sellerContext = await browser.createBrowserContext()
  const seller = await sellerContext.newPage()
  await seller.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(seller, '/member/seller?tab=overview', 'farmer', 'Admin@123')
  const sellerPages = [
    ['overview', '.seller-overview'],
    ['publish', '.seller-product-page'],
    ['sales', '.mc-panel'],
    ['goods', '.mc-panel'],
    ['supply', '.mc-panel'],
    ['trade', '.seller-trade-workspace'],
    ['ship', '.logistics-workbench'],
    ['after', '.after-workbench'],
    ['rate', '.seller-rating-workspace'],
    ['fund', '.seller-fund-workspace'],
    ['customer', '.seller-customer-workspace'],
    ['iot', '.seller-iot-workspace'],
    ['contract', '.contract-page'],
  ]
  for (const [tab, selector] of sellerPages) await auditPage(seller, 'seller', tab, selector)

  await seller.goto(`${BASE}/member/seller?tab=trade`, { waitUntil: 'networkidle2', timeout: 60000 })
  await seller.waitForSelector('.seller-switch-tabs', { timeout: 20000 })
  await seller.evaluate(() => {
    const button = [...document.querySelectorAll('.seller-switch-tabs button')]
      .find((item) => item.textContent?.includes('智能匹配'))
    button?.click()
  })
  await seller.waitForFunction(() => document.body.innerText.includes('匹配结果'), { timeout: 15000 })
  const antTabs = await seller.$$('.mc-body .ant-tabs-tab')
  let antTabBlue = ''
  for (const tabElement of antTabs) {
    await tabElement.hover()
    await sleep(40)
    const color = await tabElement.evaluate((element) => {
      const label = element.querySelector('.ant-tabs-tab-btn')
      return getComputedStyle(label ?? element).color
    })
    if (isBlue(color)) {
      antTabBlue = color
      break
    }
  }
  check(!antTabBlue, '智能匹配页签悬浮态无默认蓝色', antTabBlue)
  await sellerContext.close()
} catch (error) {
  check(false, '会员中心交互态审计未抛异常', String(error).slice(0, 320))
} finally {
  await browser.close()
}

console.log(`\n审计页面：${warnings.length} 个`)
console.log(`== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
