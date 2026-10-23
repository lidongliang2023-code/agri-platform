#!/usr/bin/env node
/** 卖家报价工作区、询价报价页和独立报价编辑页回归。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8086'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const failures = []
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
  await page.goto(`${BASE}/member/seller?tab=trade`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => window.location.port === '8090', { timeout: 20000 })
  await page.waitForSelector('button[role="tab"]', { timeout: 20000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => item.textContent?.includes('账号 + 密码'))
    tab?.click()
  })
  await fill(page, 'input[autocomplete="username"]', 'farmer')
  await fill(page, 'input[autocomplete="current-password"]', 'Admin@123')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => item.textContent?.includes('登 录'))
    button?.click()
  })
  for (let i = 0; i < 60; i += 1) {
    await sleep(400)
    if (page.url().includes('/member/seller')) break
  }
  await page.waitForSelector('.quote-workbench', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})

  const listText = await page.evaluate(() => document.body.innerText)
  check(listText.includes('收到的询价') && listText.includes('报价管理') && listText.includes('新增报价'),
    '报价工作区整合采购询价与报价记录')
  check((await page.$$eval('.quote-inquiry-card', (items) => items.length)) > 0,
    '收到的询价以业务卡片展示')
  check((await page.$$eval('.quote-card', (items) => items.length)) > 0,
    '报价记录以业务卡片展示')
  check(!(await page.$('.ant-table')) && !(await page.$('.ant-modal')),
    '报价管理已移除默认表格和弹窗')
  await page.hover('.seller-switch-tabs button:nth-child(2)')
  await sleep(220)
  const switchHover = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('.seller-switch-tabs button:nth-child(2)'))
    return { background: style.backgroundColor, border: style.borderColor, color: style.color }
  })
  check(switchHover.background === 'rgb(247, 252, 249)'
    && switchHover.border === 'rgb(165, 214, 184)'
    && switchHover.color === 'rgb(14, 82, 51)',
  '报价与撮合顶部入口悬浮态使用统一绿色', JSON.stringify(switchHover))
  await page.hover('.quote-inquiry-card .mc-btn')
  await sleep(180)
  const quoteButtonHover = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('.quote-inquiry-card .mc-btn'))
    return { color: style.color, backgroundImage: style.backgroundImage }
  })
  check(quoteButtonHover.color === 'rgb(255, 255, 255)'
    && quoteButtonHover.backgroundImage.includes('linear-gradient'),
  '报价卡片操作按钮悬浮态不会变成默认蓝色', JSON.stringify(quoteButtonHover))
  await page.screenshot({ path: path.join(OUT, 'seller-quote-list-redesigned.png'), fullPage: true })

  const openedInquiryQuote = await page.evaluate(() => {
    const button = [...document.querySelectorAll('.quote-inquiry-card button')]
      .find((item) => item.textContent?.includes('去报价'))
    if (!button) return false
    button.click()
    return true
  })
  check(openedInquiryQuote, '收到询价提供页面级报价入口')
  await page.waitForFunction(() => document.body.innerText.includes('询价报价'), { timeout: 10000 })
  const inquiryQuoteText = await page.evaluate(() => document.body.innerText)
  check(inquiryQuoteText.includes('报价信息') && inquiryQuoteText.includes('报价提示') && inquiryQuoteText.includes('提交正式报价'),
    '询价报价使用独立页面、表单和提示侧栏')
  await page.screenshot({ path: path.join(OUT, 'seller-inquiry-quote-page.png'), fullPage: true })
  await page.click('.quote-back')
  await page.waitForSelector('.quote-workbench', { timeout: 10000 })

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.includes('新增报价'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('新增报价') &&
    document.body.innerText.includes('报价内容'), { timeout: 10000 })
  const createQuoteText = await page.evaluate(() => document.body.innerText)
  check(createQuoteText.includes('销售单价') && createQuoteText.includes('有效期') && createQuoteText.includes('创建报价'),
    '新增报价使用独立编辑页面')
  await page.screenshot({ path: path.join(OUT, 'seller-quote-create-page.png'), fullPage: true })
  await page.click('.quote-back')
  await page.waitForSelector('.quote-workbench', { timeout: 10000 })

  await page.evaluate(() => {
    const input = document.querySelector('input[placeholder="报价编号"]')
    if (!(input instanceof HTMLInputElement)) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, 'Q20261013301')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  const pendingQuoteVisible = await page.evaluate(() => document.body.innerText.includes('Q20261013301'))
  check(pendingQuoteVisible, '报价列表支持按编号查询', 'Q20261013301')
  const openedEdit = await page.evaluate(() => {
    const button = [...document.querySelectorAll('.quote-card button')]
      .find((item) => (item.textContent ?? '').includes('编辑'))
    if (!button) return false
    button.click()
    return true
  })
  check(openedEdit, '待受理报价提供页面级编辑入口')
  await page.waitForFunction(() => document.body.innerText.includes('编辑报价'), { timeout: 10000 })
  check((await page.evaluate(() => document.body.innerText)).includes('保存报价'),
    '编辑报价页面完整回显并保留保存操作')
  await page.screenshot({ path: path.join(OUT, 'seller-quote-edit-page.png'), fullPage: true })
  await page.click('.quote-back')
  await page.waitForSelector('.quote-workbench', { timeout: 10000 })

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.seller-switch-tabs button')]
      .find((item) => item.textContent?.includes('价格推荐'))
    button?.click()
  })
  await sleep(400)
  await page.hover('.seller-embedded-workbench .ant-btn-primary')
  await sleep(180)
  const embeddedPrimaryHover = await page.evaluate(() => {
    const style = getComputedStyle(document.querySelector('.seller-embedded-workbench .ant-btn-primary'))
    return { background: style.backgroundColor, color: style.color, border: style.borderColor }
  })
  check(embeddedPrimaryHover.background === 'rgb(14, 82, 51)'
    && embeddedPrimaryHover.color === 'rgb(255, 255, 255)'
    && embeddedPrimaryHover.border === 'rgb(14, 82, 51)',
  '智能匹配与价格推荐主按钮悬浮态统一为深绿色', JSON.stringify(embeddedPrimaryHover))
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.seller-switch-tabs button')]
      .find((item) => item.textContent?.includes('报价管理'))
    button?.click()
  })
  await page.waitForSelector('.quote-workbench', { timeout: 10000 })

  await page.setViewport({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.quote-workbench', { timeout: 30000 })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '390px 报价管理工作区无横向溢出')
  await page.screenshot({ path: path.join(OUT, 'seller-quote-mobile.png'), fullPage: true })
  check(errors.length === 0, '报价相关页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '报价页面回归未抛异常', String(error).slice(0, 320))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
