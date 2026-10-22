#!/usr/bin/env node
/**
 * 交易大厅联调（2026-10-20）。
 *
 * 覆盖：门户导航复用、公开浏览、关键词搜索、分类/产地筛选、价格排序、
 * 采购需求列表、未登录报价与商品详情的登录回跳。
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const HALL = 'http://localhost:8086/hall?embed=1'
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const fill = async (page, selector, value) => {
  await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel)
    if (!input) throw new Error(`未找到输入框 ${sel}`)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { sel: selector, val: value })
}

const clickText = async (page, text, selector) => {
  await page.evaluate(({ label, sel }) => {
    const target = [...document.querySelectorAll(sel)]
      .find((el) => (el.textContent ?? '').replace(/\s/g, '').includes(label.replace(/\s/g, '')))
    if (!target) throw new Error(`未找到 ${label}`)
    target.click()
  }, { label: text, sel: selector })
  await sleep(500)
}

const productNames = (page) => page.evaluate(() =>
  [...document.querySelectorAll('.hall-product-title strong')].map((el) => el.textContent?.trim() ?? ''))

const waitProducts = async (page, count) => {
  for (let i = 0; i < 25; i++) {
    const names = await productNames(page)
    if (names.length === count) return names
    await sleep(200)
  }
  return productNames(page)
}

const hallApi = await (await fetch('http://localhost:8086/api/trade/public/hall/products?pageNum=1&pageSize=24')).json()
const expectedProductCount = hallApi?.code === 200 ? hallApi.data?.records?.length ?? 0 : 0

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: HEADFUL ? false : 'new',
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(HALL, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.hall-product', { timeout: 20000 })
  const text = await page.evaluate(() => document.body.innerText)
  check(text.includes('交易大厅') && text.includes('供应大厅') && text.includes('采购需求'), '交易大厅公开页面已渲染')
  const portalPage = await browser.newPage()
  await portalPage.setViewport({ width: 1440, height: 1000 })
  await portalPage.goto('http://localhost:8098/portal/#/hall', { waitUntil: 'networkidle2', timeout: 60000 })
  await portalPage.waitForSelector('.portal-hall-embed iframe', { timeout: 20000 })
  const navLabels = await portalPage.$$eval('.main-nav a', (items) => items.map((item) => (item.textContent ?? '').trim()))
  const portalNavLabels = await portalPage.$$eval('.main-nav a', (items) => items.map((item) => (item.textContent ?? '').trim()))
  check(JSON.stringify(navLabels) === JSON.stringify(portalNavLabels) && navLabels.includes('物流服务'),
    '交易大厅直接复用门户导航菜单', navLabels.join(' / '))
  const underlines = await portalPage.$$eval('.main-nav a', (items) => items.map((item) => getComputedStyle(item).textDecorationLine))
  check(underlines.every((value) => value === 'none'), '交易大厅导航项没有下划线', underlines.join(' / '))
  const activeLine = await portalPage.$eval('.main-nav a.active', (item) => getComputedStyle(item, '::after').height)
  check(activeLine === '2px', '当前菜单「交易大厅」保留下划线', activeLine)
  await portalPage.close()
  check((await productNames(page)).length === expectedProductCount,
    `供应大厅显示 ${expectedProductCount} 条真实在售商品`)
  const filterText = await page.evaluate(() => document.querySelector('.hall-filter-card')?.innerText ?? '')
  check(filterText.includes('一级产业') && filterText.includes('二级品类') && filterText.includes('三级品种')
    && filterText.includes('产地') && !filterText.includes('价格区间'), '筛选结构与产业链页面一致')
  const filterRows = await page.$$eval('.hall-filter-row', (rows) => rows.length)
  check(filterRows === 4 && !(await page.$('.hall-layout')), '筛选条件采用产业链页的整行卡片布局', `${filterRows} 行`)

  // 搜索
  await fill(page, '.header-search input', '苹果')
  await page.evaluate(() => document.querySelector('.header-search button')?.click())
  let names = await waitProducts(page, 1)
  check(names.length === 1 && names[0].includes('苹果'), '关键词搜索「苹果」命中洛川苹果', names.join('、'))

  // 分类筛选
  await clickText(page, '清空筛选', '.hall-reset')
  await waitProducts(page, expectedProductCount)
  await clickText(page, '粮油产业', '.hall-filter-body .hall-chips button')
  names = await waitProducts(page, 1)
  check(names.length === 1 && names[0].includes('五常大米'), '一级产业「粮油产业」筛选出五常大米', names.join('、'))

  // 产地筛选
  await clickText(page, '清空筛选', '.hall-reset')
  await waitProducts(page, expectedProductCount)
  await clickText(page, '江苏', '.hall-filter-body .hall-chips button')
  names = await waitProducts(page, 1)
  check(names.length === 1 && names[0].includes('大闸蟹'), '产地「江苏」筛选出大闸蟹', names.join('、'))

  // 价格排序
  await clickText(page, '清空筛选', '.hall-reset')
  await waitProducts(page, expectedProductCount)
  await clickText(page, '价格从低到高', '.hall-toolbar .hall-chips button')
  names = await waitProducts(page, expectedProductCount)
  check(names[0]?.includes('有机大白菜'), '价格升序首项为 18.8 元的大白菜', names[0] ?? '')

  // 采购需求
  await clickText(page, '采购需求', '.hall-tabs button')
  await page.waitForSelector('.hall-table', { timeout: 10000 })
  const demandText = await page.evaluate(() => document.querySelector('.hall-table')?.innerText ?? '')
  const demandRows = await page.$$eval('.hall-table tbody tr', (rows) => rows.length)
  check(demandRows === 4 && demandText.includes('北京新发地批发市场'), '采购需求大厅显示 4 条真实需求', `${demandRows} 条`)
  check(demandText.includes('五常稻花香') && demandText.includes('红富士'), '采购需求包含真实品类与品种')

  // 未登录报价 → 登录回跳
  await page.evaluate(() => document.querySelector('.hall-quote')?.click())
  await page.waitForFunction(() => window.location.port === '8090', { timeout: 15000 })
  check(page.url().includes(':8090/') && page.url().includes('/login'),
    '未登录点击报价直达统一认证登录页', page.url())

  // 商品详情公开，写操作才需要登录
  const ctx2 = await browser.createBrowserContext()
  const page2 = await ctx2.newPage()
  await page2.setViewport({ width: 390, height: 844 })
  await page2.goto(HALL, { waitUntil: 'networkidle2', timeout: 60000 })
  await page2.waitForSelector('.hall-product', { timeout: 20000 })
  await page2.evaluate(() => document.querySelector('.hall-product')?.click())
  await page2.waitForFunction(() => location.pathname.startsWith('/product/detail/'), { timeout: 10000 })
  await page2.waitForSelector('.pd-hero', { timeout: 20000 })
  check(page2.url().includes('/product/detail/') && !page2.url().includes('/login'),
    '未登录点击商品可公开进入详情页', page2.url())
  await page2.goto(HALL, { waitUntil: 'networkidle2' })
  await page2.waitForSelector('.hall-product', { timeout: 20000 })
  await page2.screenshot({ path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'trade-hall-mobile.png'), fullPage: true })
  await ctx2.close()

  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(HALL, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.hall-product', { timeout: 20000 })
  await page.screenshot({ path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'trade-hall.png'), fullPage: true })
  check(errors.length === 0, '交易大厅无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '交易大厅联调脚本未抛异常', String(error).slice(0, 220))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
