#!/usr/bin/env node
/** 买家评价/资金与卖家经营页面重构回归。 */
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

const openMemberPage = async (page, role, tab, selector) => {
  await page.goto(`${BASE}/member/${role}?tab=${tab}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector(selector, { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 12000 }).catch(() => {})
  await sleep(300)
  return page.evaluate(() => document.body.innerText)
}

const noOverflow = (page) => page.evaluate(() =>
  document.documentElement.scrollWidth <= window.innerWidth + 1)

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
  await loginAndOpen(buyer, '/member/buyer?tab=rate', '19900002005', 'Test12345')

  const buyerRate = await openMemberPage(buyer, 'buyer', 'rate', '.buyer-rating-workspace')
  check(buyerRate.includes('采购评价') && buyerRate.includes('待评价订单') && buyerRate.includes('我发出的评价'),
    '买家采购评价页完成工作区重构')
  check((await buyer.$$eval('.buyer-workspace-stats > div', (items) => items.length)) === 3,
    '采购评价页展示待评价、已评价和平均评分')
  check((await buyer.$$eval('.buyer-review-card', (items) => items.length)) > 0,
    '采购评价以卡片展示真实评价')
  await buyer.screenshot({ path: path.join(OUT, 'buyer-rating-redesigned.png'), fullPage: true })
  await buyer.setViewport({ width: 390, height: 844 })
  await buyer.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await buyer.waitForSelector('.buyer-rating-workspace', { timeout: 30000 })
  check(await noOverflow(buyer), '390px 买家采购评价页无横向溢出')
  await buyer.screenshot({ path: path.join(OUT, 'buyer-rating-mobile.png'), fullPage: true })
  await buyer.setViewport({ width: 1440, height: 1000 })

  const buyerFund = await openMemberPage(buyer, 'buyer', 'fund', '.buyer-fund-workspace')
  check(buyerFund.includes('资金与发票') && buyerFund.includes('发票申请与记录') && buyerFund.includes('保证金账户'),
    '买家资金与发票页整合资金和开票信息')
  check((await buyer.$$eval('.buyer-invoice-card', (items) => items.length)) > 0,
    '发票记录以统一业务卡片展示')
  await buyer.screenshot({ path: path.join(OUT, 'buyer-fund-redesigned.png'), fullPage: true })
  await buyer.setViewport({ width: 390, height: 844 })
  await buyer.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await buyer.waitForSelector('.buyer-fund-workspace', { timeout: 30000 })
  const buyerFundNoOverflow = await noOverflow(buyer)
  if (!buyerFundNoOverflow) {
    const offenders = await buyer.evaluate(() => [...document.querySelectorAll('*')]
      .filter((item) => item.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 12)
      .map((item) => ({
        tag: item.tagName,
        cls: typeof item.className === 'string' ? item.className : '',
        right: Math.round(item.getBoundingClientRect().right),
        width: Math.round(item.getBoundingClientRect().width),
      })))
    console.log('买家资金移动端溢出元素：', offenders)
  }
  check(buyerFundNoOverflow, '390px 买家资金与发票页无横向溢出')
  await buyer.screenshot({ path: path.join(OUT, 'buyer-fund-mobile.png'), fullPage: true })
  check(buyerErrors.length === 0, '买家评价与资金页面无未捕获脚本异常', buyerErrors.slice(0, 2).join(' | '))
  await buyerContext.close()

  const sellerContext = await browser.createBrowserContext()
  const seller = await sellerContext.newPage()
  const sellerErrors = []
  seller.on('pageerror', (error) => sellerErrors.push(String(error)))
  await seller.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(seller, '/member/seller?tab=overview', 'farmer', 'Admin@123')

  const sellerOverview = await openMemberPage(seller, 'seller', 'overview', '.seller-overview')
  check(sellerOverview.includes('店铺经营工作台') && sellerOverview.includes('最近销售订单') && sellerOverview.includes('经营线索'),
    '卖家首页概览整合经营与订单信息')
  check((await seller.$$eval('.seller-task', (items) => items.length)) === 4,
    '卖家首页四项经营任务可点击')
  check((await seller.$$eval('.seller-lead-grid > div', (items) => items.length)) === 4,
    '卖家首页展示商品、询价、评分与客户线索')
  await seller.screenshot({ path: path.join(OUT, 'seller-overview-redesigned.png'), fullPage: true })
  await seller.setViewport({ width: 390, height: 844 })
  await seller.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await seller.waitForSelector('.seller-overview', { timeout: 30000 })
  check(await noOverflow(seller), '390px 卖家首页概览无横向溢出')
  await seller.screenshot({ path: path.join(OUT, 'seller-overview-mobile.png'), fullPage: true })
  await seller.setViewport({ width: 1440, height: 1000 })

  const sellerPublish = await openMemberPage(seller, 'seller', 'publish', '.seller-product-page')
  check(sellerPublish.includes('发布新商品') && sellerPublish.includes('基础信息') && sellerPublish.includes('商品图片'),
    '卖家发布新商品页完成分区工作台重构')
  check((await seller.$$eval('.seller-product-main .mc-panel', (items) => items.length)) >= 5,
    '商品发布页使用统一会员中心面板')
  await seller.screenshot({ path: path.join(OUT, 'seller-product-publish-redesigned.png'), fullPage: true })
  await seller.setViewport({ width: 390, height: 844 })
  await seller.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await seller.waitForSelector('.seller-product-page', { timeout: 30000 })
  check(await noOverflow(seller), '390px 卖家商品发布页无横向溢出')
  await seller.screenshot({ path: path.join(OUT, 'seller-product-publish-mobile.png'), fullPage: true })
  await seller.setViewport({ width: 1440, height: 1000 })

  const sellerTrade = await openMemberPage(seller, 'seller', 'trade', '.seller-trade-workspace')
  check(sellerTrade.includes('报价与撮合') && sellerTrade.includes('报价管理') && sellerTrade.includes('智能匹配') && sellerTrade.includes('价格推荐'),
    '报价与撮合页提供三个统一业务入口')
  await seller.evaluate(() => {
    const button = [...document.querySelectorAll('.seller-switch-tabs button')]
      .find((item) => item.textContent?.includes('智能匹配'))
    button?.click()
  })
  await sleep(400)
  check((await seller.evaluate(() => document.body.innerText)).includes('匹配结果'),
    '报价与撮合页可切换到智能匹配')
  await seller.evaluate(() => {
    const button = [...document.querySelectorAll('.seller-switch-tabs button')]
      .find((item) => item.textContent?.includes('价格推荐'))
    button?.click()
  })
  await sleep(400)
  check((await seller.evaluate(() => document.body.innerText)).includes('价格推荐'),
    '报价与撮合页可切换到价格推荐')
  await seller.screenshot({ path: path.join(OUT, 'seller-trade-redesigned.png'), fullPage: true })

  const sellerRate = await openMemberPage(seller, 'seller', 'rate', '.seller-rating-workspace')
  check(sellerRate.includes('店铺评价与信用') && sellerRate.includes('最新买家评价') && sellerRate.includes('评价管理与申诉'),
    '卖家评价与信用页重构完成')
  check((await seller.$$eval('.seller-review-card', (items) => items.length)) > 0,
    '卖家评价以买家反馈卡片展示')
  await seller.screenshot({ path: path.join(OUT, 'seller-rating-redesigned.png'), fullPage: true })

  const sellerFund = await openMemberPage(seller, 'seller', 'fund', '.seller-fund-workspace')
  check(sellerFund.includes('资金结算') && sellerFund.includes('待结算订单') && sellerFund.includes('已结算记录'),
    '卖家资金结算页整合应收与结算进度')
  check(sellerFund.includes('保证金') && sellerFund.includes('获赔'),
    '卖家资金页保留保证金和获赔能力')
  await seller.screenshot({ path: path.join(OUT, 'seller-fund-redesigned.png'), fullPage: true })

  const sellerCustomer = await openMemberPage(seller, 'seller', 'customer', '.seller-customer-workspace')
  check(sellerCustomer.includes('客户管理') && sellerCustomer.includes('客户档案') && sellerCustomer.includes('累计采购额'),
    '卖家客户管理页改为客户档案卡片')
  check((await seller.$$eval('.seller-customer-card', (items) => items.length)) > 0,
    '客户卡片来自真实销售订单聚合')
  await seller.screenshot({ path: path.join(OUT, 'seller-customer-redesigned.png'), fullPage: true })
  await seller.setViewport({ width: 390, height: 844 })
  await seller.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await seller.waitForSelector('.seller-customer-workspace', { timeout: 30000 })
  check(await noOverflow(seller), '390px 卖家客户管理页无横向溢出')
  await seller.screenshot({ path: path.join(OUT, 'seller-customer-mobile.png'), fullPage: true })

  await seller.setViewport({ width: 1440, height: 1000 })
  const sellerIot = await openMemberPage(seller, 'seller', 'iot', '.seller-iot-workspace')
  check(sellerIot.includes('生产接入') && sellerIot.includes('设备登记') && sellerIot.includes('进入生产管理工作台'),
    '生产接入页重构为流程与入口页面')
  await seller.screenshot({ path: path.join(OUT, 'seller-iot-redesigned.png'), fullPage: true })
  check(sellerErrors.length === 0, '卖家经营页面无未捕获脚本异常', sellerErrors.slice(0, 2).join(' | '))
  await sellerContext.close()
} catch (error) {
  check(false, '会员页面重构回归未抛异常', String(error).slice(0, 320))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
