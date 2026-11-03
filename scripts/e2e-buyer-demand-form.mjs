#!/usr/bin/env node
/** 买家中心真实表单发布采购需求 → 列表 → 详情 → 数据库字段核对。 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
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
const CORE = 'http://localhost:8093'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const demandName = `买家中心真实表单采购${Date.now()}`
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sql = (statement) => execFileSync(MYSQL, [
  '--default-character-set=utf8mb4', '-uroot', '-proot', '-N', '-B', '-e', statement,
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

const fillByLabel = async (page, label, value) => page.evaluate(({ label, value }) => {
  const formItem = [...document.querySelectorAll('.ant-form-item')]
    .find((item) => (item.querySelector('.ant-form-item-label')?.textContent ?? '').includes(label))
  const input = formItem?.querySelector('input,textarea')
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
    throw new Error(`未找到字段：${label}`)
  }
  const proto = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, String(value))
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}, { label, value })

const selectByLabel = async (page, label, text) => page.evaluate(({ label, text }) => {
  const formItem = [...document.querySelectorAll('.ant-form-item')]
    .find((item) => (item.querySelector('.ant-form-item-label')?.textContent ?? '').includes(label))
  formItem?.querySelector('.ant-select-selector')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
}, { label, text }).then(async () => {
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 5000 })
  await page.evaluate((wanted) => {
    const options = [...document.querySelectorAll(
      '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')]
    const option = options.find((item) => (item.textContent ?? '').trim().includes(wanted)) ?? options[0]
    if (!option) throw new Error(`没有可选项：${wanted}`)
    option.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    option.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    option.click()
  }, text)
  await sleep(200)
})

let demandId = null
let browser
try {
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${TRADE}/member/buyer?tab=publish`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => window.location.port === '8090', undefined, { timeout: 20000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => item.textContent?.includes('账号 + 密码'))
    tab?.click()
  })
  await page.evaluate(() => {
    const username = document.querySelector('input[autocomplete="username"]')
    const input = document.querySelector('input[autocomplete="current-password"]')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(username, '19900002005')
    username.dispatchEvent(new Event('input', { bubbles: true }))
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, 'Test12345')
    input.dispatchEvent(new Event('input', { bubbles: true }))
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => item.textContent?.includes('登 录'))
    button?.click()
  })
  for (let i = 0; i < 60; i += 1) {
    await sleep(400)
    if (page.url().includes(':8086/member/buyer')) break
  }
  await page.waitForSelector('.demand-create-page.is-embedded', { timeout: 30000 })

  await fillByLabel(page, '需求标题', demandName)
  await selectByLabel(page, '采购品类', '大米')
  await fillByLabel(page, '品种', '五常稻花香')
  await fillByLabel(page, '商品名称', '东北五常大米 25kg/袋')
  await fillByLabel(page, '等级要求', '一级')
  await fillByLabel(page, '采购数量', '18')
  await selectByLabel(page, '单位', '袋')
  await fillByLabel(page, '期望最低价', '118')
  await fillByLabel(page, '期望最高价', '128')
  await fillByLabel(page, '收货地址', '新发地真实表单联调仓')
  await fillByLabel(page, '质量要求', '一级新米，水分不高于 14.5%')
  await fillByLabel(page, '包装要求', '25kg/袋')

  const responsePromise = page.waitForResponse((response) =>
    response.url().endsWith('/api/trade/demand') && response.request().method() === 'POST',
  { timeout: 20000 })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.buyer-demand-actions button[type="submit"]')][0]
    button?.click()
  })
  const response = await responsePromise
  const responseBody = await response.json()
  check(response.status() === 200 && responseBody.code === 200, '页面表单提交采购需求接口成功',
    responseBody.message ?? '')
  await page.waitForFunction(() => new URLSearchParams(location.search).get('tab') === 'demand-list',
    undefined, { timeout: 20000 })
  await page.waitForSelector('.mc-table', { timeout: 20000 })
  await page.waitForFunction((name) => document.body.innerText.includes(name), demandName, { timeout: 15000 })
  check(true, '发布成功后自动回到采购需求列表并显示新需求')

  demandId = Number(sql(`
    SELECT id FROM agri_trade.agri_trade_demand
    WHERE demand_name = '${demandName}' AND del_flag = 0 ORDER BY id DESC LIMIT 1
  `))
  const row = sql(`
    SELECT buyer_id, buyer_name, category_name, variety, product_name, quantity, unit,
           price_min, price_max, delivery_address, quality_requirement, packaging_require,
           demand_status
    FROM agri_trade.agri_trade_demand WHERE id = ${demandId}
  `).split('\t')
  check(demandId > 0 && row[0] === '2112531950528262146', '采购需求真实落库并绑定当前主体',
    `id=${demandId}`)
  check(row[2] === '大米' && row[3] === '五常稻花香' && row[4] === '东北五常大米 25kg/袋',
    '品类、品种和商品名称正确落库', row.slice(2, 5).join(' / '))
  check(Number(row[5]) === 18 && row[6] === '袋' && Number(row[7]) === 118 && Number(row[8]) === 128,
    '数量、单位和期望价格正确落库', row.slice(5, 9).join(' / '))
  check(row[9] === '新发地真实表单联调仓' && row[10].includes('14.5') && row[11] === '25kg/袋',
    '收货地址、质量和包装要求正确落库')
  check(row[12] === 'pending', '新需求初始状态为待匹配', row[12])

  await page.goto(`${TRADE}/demand/detail/${demandId}`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForSelector('.demand-detail-hero', { timeout: 15000 })
  const detailText = await page.evaluate(() => document.body.innerText)
  check(detailText.includes(demandName) && detailText.includes('18 袋')
    && detailText.includes('¥118.00') && detailText.includes('¥128.00')
    && detailText.includes('新发地真实表单联调仓')
    && detailText.includes('一级新米，水分不高于 14.5%')
    && detailText.includes('25kg/袋'), '需求详情完整展示发布表单字段')
} catch (error) {
  check(false, '真实表单发布需求回归未抛异常', String(error).slice(0, 360))
} finally {
  if (browser) await browser.close()
  if (demandId) {
    try {
      sql(`
        DELETE FROM agri_trade.agri_trade_match_record WHERE demand_id=${demandId};
        DELETE FROM agri_trade.agri_trade_demand WHERE id=${demandId};
      `)
      check(true, '真实表单测试需求已清理')
    } catch {
      check(false, '真实表单测试需求清理失败')
    }
  }
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
