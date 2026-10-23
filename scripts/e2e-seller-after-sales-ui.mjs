#!/usr/bin/env node
/** 卖家中心售后纠纷与物流管理页面回归。 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8086'
const CORE = 'http://localhost:8093'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const stamp = Date.now()
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

const fill = async (page, selector, value) => page.evaluate(({ target, next }) => {
  const input = document.querySelector(target)
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
    throw new Error(`未找到输入框 ${target}`)
  }
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(prototype, 'value').set
  setter.call(input, next)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}, { target: selector, next: value })

const loginApi = async () => {
  const response = await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'farmer', password: 'Admin@123', marketId: 1 }),
  })
  const body = await response.json()
  if (body.code !== 0) throw new Error(body.message ?? '卖家登录失败')
  return body.data.accessToken
}

const sellerToken = await loginApi()
const created = await fetch(`${BASE}/api/trade/dispute`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${sellerToken}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    orderId: 7631,
    disputeType: 'other',
    disputeReason: `售后页面回归 ${stamp}`,
    disputeDescription: '卖家中心售后页面样式与处理流程联调，完成后由双方自行和解。',
    claimAmount: 10,
  }),
}).then((response) => response.json())
const disputeNo = created?.code === 200
  ? scalar(`SELECT dispute_no FROM agri_trade.agri_trade_dispute WHERE order_id=7631 AND del_flag=0 ORDER BY id DESC LIMIT 1`)
  : ''
check(Boolean(disputeNo), '准备一张真实待处理售后工单', disputeNo || created?.message || '')

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
  await page.goto(`${BASE}/member/seller?tab=after`, { waitUntil: 'networkidle2', timeout: 60000 })
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
  await page.waitForSelector('.after-workbench', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})

  const afterText = await page.evaluate(() => document.body.innerText)
  check(afterText.includes('纠纷管理') && afterText.includes('售后工单') && afterText.includes('本页待处理'),
    '卖家售后页使用统一的纠纷工作区')
  check(afterText.includes(disputeNo), '卖家售后列表显示待处理工单', disputeNo)
  check(!(await page.$('.ant-table')), '纠纷列表已改为会员中心风格')
  await page.screenshot({ path: path.join(OUT, 'seller-dispute-list.png'), fullPage: true })

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => (item.textContent ?? '').includes('发起售后'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('发起售后纠纷'), { timeout: 10000 })
  const createText = await page.evaluate(() => document.body.innerText)
  check(createText.includes('工单信息') && createText.includes('发起条件'), '发起售后使用独立页面和引导侧栏')
  await page.click('.after-back')
  await page.waitForSelector('.after-name-link', { timeout: 10000 })

  const openedDetail = await page.evaluate((targetNo) => {
    const row = [...document.querySelectorAll('tr')].find((item) => item.textContent?.includes(targetNo))
    const button = row ? [...row.querySelectorAll('button')].find((item) =>
      (item.textContent ?? '').replace(/\s/g, '') === '查看') : null
    if (!button) return false
    button.click()
    return true
  }, disputeNo)
  check(openedDetail, '待处理纠纷可进入独立详情页')
  await page.waitForFunction(() => document.body.innerText.includes('售后诉求'), { timeout: 10000 })
  const detailText = await page.evaluate(() => document.body.innerText)
  check(detailText.includes('争议双方') && detailText.includes('处理记录') && detailText.includes('处理进度'),
    '纠纷详情展示双方、诉求、处理记录和进度')
  await page.screenshot({ path: path.join(OUT, 'seller-dispute-detail.png'), fullPage: true })

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.includes('处理工单'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('处理售后工单'), { timeout: 10000 })
  const processText = await page.evaluate(() => document.body.innerText)
  check(processText.includes('双方处理结果') && processText.includes('确认了结'),
    '处理纠纷使用独立页面')
  await page.click('.after-form .ant-select-selector')
  await sleep(250)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await fill(page, '.after-form textarea', '页面回归完成，双方达成和解。')
  await page.click('.after-form button[type="submit"]')
  for (let i = 0; i < 30; i += 1) {
    await sleep(300)
    if ((await page.evaluate(() => document.body.innerText)).includes('已解决')) break
  }
  const resolvedText = await page.evaluate(() => document.body.innerText)
  check(resolvedText.includes('已解决'), '纠纷处理结果正确回写详情页')

  await page.goto(`${BASE}/member/seller?tab=ship`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.logistics-workbench', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  const logisticsText = await page.evaluate(() => document.body.innerText)
  check(logisticsText.includes('待发货订单') && logisticsText.includes('物流管理') && logisticsText.includes('本页运输中'),
    '卖家发货页统一展示待发货订单和物流工作区')
  check((await page.$$eval('.logistics-workbench', (items) => items.length)) === 1,
    '物流工作区没有重复渲染')
  check(!(await page.$('.ant-table')), '物流列表已改为会员中心风格')
  await page.screenshot({ path: path.join(OUT, 'seller-logistics-list.png'), fullPage: true })

  const openedLogistics = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.logistics-table tbody tr')][0]
    const button = row ? [...row.querySelectorAll('button')].find((item) =>
      (item.textContent ?? '').replace(/\s/g, '') === '查看') : null
    if (!button) return false
    button.click()
    return true
  })
  check(openedLogistics, '物流列表可进入独立详情页')
  await page.waitForFunction(() => document.body.innerText.includes('运输路线'), { timeout: 10000 })
  const logisticsDetailText = await page.evaluate(() => document.body.innerText)
  check(logisticsDetailText.includes('物流信息') && logisticsDetailText.includes('履约进度') && logisticsDetailText.includes('快捷操作'),
    '物流详情展示路线、物流信息、履约进度和操作')
  await page.screenshot({ path: path.join(OUT, 'seller-logistics-detail.png'), fullPage: true })

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.logistics-hero-actions button')]
      .find((item) => item.textContent?.includes('查看轨迹'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('运输节点'), { timeout: 10000 })
  const traceText = await page.evaluate(() => document.body.innerText)
  check(traceText.includes('物流轨迹') && (traceText.includes('已签收') || traceText.includes('已揽收') || traceText.includes('运输中')),
    '物流轨迹使用独立时间线页面')
  await page.screenshot({ path: path.join(OUT, 'seller-logistics-trace.png'), fullPage: true })
  await page.click('.after-back')
  await page.waitForFunction(() => document.body.innerText.includes('运输路线'), { timeout: 10000 })

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.logistics-hero-actions button')]
      .find((item) => item.textContent?.includes('编辑'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('编辑物流信息'), { timeout: 10000 })
  const editText = await page.evaluate(() => document.body.innerText)
  check(editText.includes('物流与收发货信息') && editText.includes('保存物流信息'),
    '物流编辑使用独立页面并保留完整字段')
  await page.screenshot({ path: path.join(OUT, 'seller-logistics-edit.png'), fullPage: true })
  await page.click('.after-back')
  await page.waitForFunction(() => document.body.innerText.includes('运输路线'), { timeout: 10000 })
  await page.click('.after-back')
  await page.waitForSelector('.logistics-workbench', { timeout: 10000 })

  await page.setViewport({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.logistics-workbench', { timeout: 30000 })
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  check(noOverflow, '390px 卖家物流页无横向溢出')
  await page.screenshot({ path: path.join(OUT, 'seller-logistics-mobile.png'), fullPage: true })
  check(errors.length === 0, '卖家售后与物流页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '卖家售后与物流页面回归未抛异常', String(error).slice(0, 320))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
