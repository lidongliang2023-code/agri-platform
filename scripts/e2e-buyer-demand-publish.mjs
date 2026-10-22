#!/usr/bin/env node
/** 买家中心“发布采购需求”独立菜单回归（2026-10-22）。 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const TRADE = 'http://localhost:8086'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const demandName = `买家中心采购需求联调${Date.now().toString().slice(-6)}`
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

let createdId = null
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
  await page.goto(`${TRADE}/member/buyer?tab=publish`, { waitUntil: 'networkidle2', timeout: 60000 })
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
    if (page.url().includes(':8086/member/buyer')) break
  }
  await page.waitForSelector('.mc-shell', { timeout: 30000 })
  await page.waitForSelector('.demand-create-page.is-embedded', { timeout: 20000 })
  check(page.url().includes('tab=publish'), '买家中心独立菜单地址进入发布采购需求')

  const menu = await page.$$eval('.mc-side-nav button', (items) =>
    items.map((item) => ({ text: item.textContent?.trim(), active: item.classList.contains('on') })))
  check(menu.some((item) => item.text === '发布采购需求' && item.active),
    '买家中心包含并选中发布采购需求菜单')
  const formText = await page.evaluate(() => document.body.innerText)
  check(formText.includes('发布采购需求') && formText.includes('智能解析并预填'),
    '独立菜单内加载完整发布需求功能')
  await page.screenshot({ path: path.join(OUT, 'buyer-publish-demand.png'), fullPage: true })

  await page.goto(`${TRADE}/demand/create?productId=7011&quantity=10`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  })
  await page.waitForFunction(() => window.location.pathname === '/member/buyer'
    && new URLSearchParams(location.search).get('tab') === 'publish', { timeout: 15000 })
  check(page.url().includes('productId=7011') && page.url().includes('quantity=10'),
    '旧发布地址兼容重定向并保留商品参数')

  const refreshed = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    return await response.json()
  })
  const token = refreshed.data?.accessToken
  check(Boolean(token), '取得买家中心访问令牌')

  const categories = await fetch('http://localhost:8086/api/trade/product/category/list',
    { headers: { Authorization: `Bearer ${token}` } }).then((response) => response.json())
  const category = Array.isArray(categories.data) ? categories.data.at(-1) : null
  check(categories.code === 200 && Boolean(category), '读取真实采购品类')

  const created = await fetch('http://localhost:8086/api/trade/demand', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      demandName,
      categoryId: category.id,
      categoryName: category.categoryName,
      productName: '买家中心联调商品',
      variety: '联调品种',
      quantity: 12,
      unit: '吨',
      priceMin: 100,
      priceMax: 120,
      demandType: 'spot',
      deliveryProvince: '北京市',
      deliveryCity: '北京市',
      deliveryAddress: '联调收货地址',
      qualityRequirement: '联调质量要求',
    }),
  }).then((response) => response.json())
  check(created.code === 200 && created.data === true, '通过买家中心发布链路真实创建采购需求')

  const pageResult = await fetch(
    `http://localhost:8086/api/trade/demand/page?pageNum=1&pageSize=20&keyword=${encodeURIComponent(demandName)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  ).then((response) => response.json())
  const demand = pageResult.data?.records?.find((item) => item.demandName === demandName)
  createdId = demand?.id ?? null
  check(pageResult.code === 200 && Boolean(demand), '新建采购需求可从真实接口查询')

  await page.goto(`${TRADE}/member/buyer?tab=inquiry`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.mc-shell', { timeout: 20000 })
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.mc-table', { timeout: 20000 })
  const demandTableText = await page.evaluate(() =>
    [...document.querySelectorAll('.mc-table')].map((table) => table.innerText).join('\n'))
  check(demandTableText.includes(demandName), '采购需求进入买家中心需求管理列表',
    demandTableText.replace(/\s+/g, ' ').slice(0, 240))
  check(errors.length === 0, '发布采购需求页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '发布采购需求回归未抛异常', String(error).slice(0, 280))
} finally {
  if (createdId) {
    try {
      execFileSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
        ['-uroot', '--batch', '-e', `DELETE FROM agri_trade.agri_trade_demand WHERE id=${createdId};`],
        { env: { ...process.env, MYSQL_PWD: 'root' } })
      check(true, '采购需求测试数据已清理')
    } catch {
      check(false, '采购需求测试数据清理失败')
    }
  }
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
