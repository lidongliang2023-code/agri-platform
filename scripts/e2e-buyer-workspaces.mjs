#!/usr/bin/env node
/** 买家中心首页、发布需求、采购订单详情和询价详情页面回归。 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8086'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sql = (statement) => {
  const output = execFileSync(MYSQL, [
    '--default-character-set=utf8mb4', '-uroot', '-proot', '-N', '-B', '-e', statement,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('\t'))
}
const scalar = (statement) => sql(statement)[0]?.[0] ?? ''

const buyerId = '2112531950528262146'
const orderId = scalar(`
  SELECT id FROM agri_trade.agri_trade_order
  WHERE buyer_id='${buyerId}' AND order_status IN ('received','completed')
  ORDER BY id DESC LIMIT 1
`)
const demandId = scalar(`
  SELECT d.id
  FROM agri_trade.agri_trade_demand d
  JOIN agri_trade.agri_trade_inquiry i ON i.demand_id=d.id
  JOIN agri_trade.agri_trade_quote q ON q.inquiry_id=i.id AND q.del_flag=0
  WHERE d.buyer_id='${buyerId}' AND d.del_flag=0
  ORDER BY d.id DESC LIMIT 1
`)
check(Boolean(orderId), '找到真实采购订单用于详情验收', orderId)
check(Boolean(demandId), '找到含供应商报价的询价需求', demandId)

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
  await page.goto(`${BASE}/member/buyer?tab=overview`, { waitUntil: 'networkidle2', timeout: 60000 })
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
  for (let i = 0; i < 60; i += 1) {
    await sleep(400)
    if (page.url().includes('/member/buyer')) break
  }
  await page.waitForSelector('.buyer-overview', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})

  const overviewText = await page.evaluate(() => document.body.innerText)
  check(overviewText.includes('采购工作台') && overviewText.includes('待付款') && overviewText.includes('待收货'),
    '买家首页概览展示采购工作台与任务')
  check((await page.$$eval('.buyer-task', (items) => items.length)) === 4,
    '首页四项采购任务均可点击')
  check(overviewText.includes('最近采购订单') && overviewText.includes('询价与报价进展'),
    '首页概览聚合订单与报价进展')
  check(overviewText.includes('资金账户') && overviewText.includes('快捷入口'),
    '首页侧栏聚合资金与快捷操作')
  await page.screenshot({ path: path.join(OUT, 'buyer-overview-redesigned.png'), fullPage: true })
  await page.setViewport({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.buyer-overview', { timeout: 30000 })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '390px 买家首页概览无横向溢出')
  await page.screenshot({ path: path.join(OUT, 'buyer-overview-mobile.png'), fullPage: true })
  await page.setViewport({ width: 1440, height: 1000 })

  if (demandId) {
    await page.goto(`${BASE}/member/buyer?tab=publish`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.buyer-demand-page.is-embedded', { timeout: 30000 })
    const createText = await page.evaluate(() => document.body.innerText)
    check(createText.includes('发布采购需求') && createText.includes('智能需求助手') && createText.includes('基本信息'),
      '发布采购需求采用新的工作台页面')
    check(createText.includes('数量与价格') && createText.includes('交收要求') && createText.includes('质量与包装'),
      '发布需求表单分区完整')
    check((await page.$$eval('.buyer-demand-main .mc-panel', (items) => items.length)) >= 4,
      '发布页面使用统一会员中心卡片')
    await page.screenshot({ path: path.join(OUT, 'buyer-demand-redesigned.png'), fullPage: true })
    await page.setViewport({ width: 390, height: 844 })
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.buyer-demand-page', { timeout: 30000 })
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      '390px 发布采购需求页无横向溢出')
    await page.screenshot({ path: path.join(OUT, 'buyer-demand-mobile.png'), fullPage: true })
    await page.setViewport({ width: 1440, height: 1000 })
  }

  if (orderId) {
    await page.goto(`${BASE}/order/detail/${orderId}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.order-detail-hero', { timeout: 30000 })
    const orderText = await page.evaluate(() => document.body.innerText)
    check(orderText.includes('商品明细') && orderText.includes('交付信息') && orderText.includes('交易评价'),
      '订单详情展示商品、交付和评价工作区')
    check(orderText.includes('订单金额') && orderText.includes('履约进度') && orderText.includes('交易双方'),
      '订单详情的金额、履约与双方信息集中展示')
    check(!(await page.$('.ant-card')) && !(await page.$('.ant-table')), '订单详情已移除默认 Ant Design 卡片与表格')
    await page.screenshot({ path: path.join(OUT, 'buyer-order-detail-redesigned.png'), fullPage: true })
    await page.setViewport({ width: 390, height: 844 })
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.order-detail-hero', { timeout: 30000 })
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      '390px 采购订单详情无横向溢出')
    await page.screenshot({ path: path.join(OUT, 'buyer-order-detail-mobile.png'), fullPage: true })
    await page.setViewport({ width: 1440, height: 1000 })
  }

  if (demandId) {
    await page.goto(`${BASE}/demand/detail/${demandId}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.demand-detail-hero', { timeout: 30000 })
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
    const demandText = await page.evaluate(() => document.body.innerText)
    check(demandText.includes('采购要求') && demandText.includes('智能撮合') && demandText.includes('询价与供应商报价'),
      '询价详情整合需求、撮合和供应商报价')
    check(demandText.includes('接受报价并成单') || demandText.includes('查看订单'),
      '询价详情提供报价受理或订单入口')
    check(demandText.includes('需求概览') && demandText.includes('需求进度') && demandText.includes('操作提示'),
      '询价详情侧栏展示概览、进度和提示')
    check(!(await page.$('.ant-card')) && !(await page.$('.ant-table')), '询价详情已移除默认卡片与表格')
    await page.screenshot({ path: path.join(OUT, 'buyer-inquiry-detail-redesigned.png'), fullPage: true })

    await page.setViewport({ width: 390, height: 844 })
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.demand-detail-hero', { timeout: 30000 })
    const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
    check(noOverflow, '390px 询价详情无横向溢出')
    await page.screenshot({ path: path.join(OUT, 'buyer-inquiry-detail-mobile.png'), fullPage: true })
  }
  check(errors.length === 0, '买家工作台页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '买家工作台页面回归未抛异常', String(error).slice(0, 320))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
