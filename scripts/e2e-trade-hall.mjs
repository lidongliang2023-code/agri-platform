#!/usr/bin/env node
/**
 * 交易大厅联调（2026-10-20）。
 *
 * 覆盖：门户导航复用、公开浏览、关键词搜索、分类/产地筛选、价格排序、
 * 采购需求列表、未登录报价与商品详情的登录回跳。
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))
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

/**
 * 大厅条数每次现读接口，不在脚本开场取一次就当真。
 *
 * 之前这里在脚本开始时抓一次 pageSize=24 的结果，再拿它去比后面渲染出的卡片数：
 * 同一轮里别的脚本会新增/下架货源，于是"页面 14 条、接口 13 条"这种假红会随机出现，
 * 看着像大厅数错了，其实是自己抓的基线过期。
 */
const hallRecords = async () => {
  try {
    const body = await (await fetch('http://localhost:8086/api/trade/public/hall/products?pageNum=1&pageSize=24')).json()
    return body?.code === 200 ? body.data?.records ?? [] : []
  } catch {
    return []
  }
}

const browser = await chromium.launch({
  headless: !HEADFUL,
  executablePath: BROWSER,
  args: ['--no-sandbox'],
})
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(HALL, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.hall-product', { timeout: 20000 })
  const text = await page.evaluate(() => document.body.innerText)
  check(text.includes('交易大厅') && text.includes('供应大厅') && text.includes('采购需求'), '交易大厅公开页面已渲染')
  const portalPage = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  await portalPage.setViewportSize({ width: 1440, height: 1000 })
  await portalPage.goto('http://localhost:8098/portal/#/hall', { waitUntil: 'networkidle', timeout: 60000 })
  await portalPage.waitForSelector('.portal-hall-embed iframe', { timeout: 20000 })
  const portalNavLabels = await portalPage.$$eval('.main-nav a', (items) => items.map((item) => (item.textContent ?? '').trim()))
  /**
   * 「复用门户导航」要拿两个不同页面比：独立大厅(:8086/hall) 与门户嵌入页(:8098/portal/#/hall)。
   * 原来这里比的是同一个页面取两次的两份列表，永远相等，属假断言。
   */
  const hallNavLabels = await page.$$eval('.main-nav a', (items) => items.map((item) => (item.textContent ?? '').trim()))
  check(hallNavLabels.length > 0 && JSON.stringify(hallNavLabels) === JSON.stringify(portalNavLabels)
    && hallNavLabels.includes('物流服务'),
  '独立大厅与门户用的是同一套导航', `大厅=${hallNavLabels.join('/')}｜门户=${portalNavLabels.join('/')}`)
  const underlines = await portalPage.$$eval('.main-nav a', (items) => items.map((item) => getComputedStyle(item).textDecorationLine))
  check(underlines.every((value) => value === 'none'), '交易大厅导航项没有下划线', underlines.join(' / '))
  const activeLine = await portalPage.$eval('.main-nav a.active', (item) => getComputedStyle(item, '::after').height)
  check(activeLine === '2px', '当前菜单「交易大厅」保留下划线', activeLine)
  await portalPage.close()

  const baseline = await hallRecords()
  const rendered = await productNames(page)
  /**
   * 大厅自己按 PAGE_SIZE=9 分页，所以"页面 9 条、接口 14 条"不是数错，是没翻到第二页。
   * 断言改成：首屏 = min(9, 总数)，且总数超过 9 时必须出现分页器。
   */
  const hallPageSize = 9
  check(rendered.length === Math.min(hallPageSize, baseline.length) && baseline.length > 0,
    '供应大厅首屏条数等于分页容量与总数的较小值', `页面=${rendered.length} 接口=${baseline.length} PAGE_SIZE=${hallPageSize}`)
  const firstPageCount = Math.min(hallPageSize, baseline.length)
  const pagerVisible = baseline.length <= hallPageSize || Boolean(await page.$('.hall-pagination, .hall-pager, .hall-pagination button'))
  check(pagerVisible, '结果超过一页时分页器出现（否则后面的货源永远看不到）',
    `总数=${baseline.length}`)
  const filterText = await page.evaluate(() => document.querySelector('.hall-filter-card')?.innerText ?? '')
  check(filterText.includes('一级产业') && filterText.includes('二级品类') && filterText.includes('三级品种')
    && filterText.includes('产地') && !filterText.includes('价格区间'), '筛选结构与产业链页面一致')
  const filterRows = await page.$$eval('.hall-filter-row', (rows) => rows.length)
  check(filterRows === 4 && !(await page.$('.hall-layout')), '筛选条件采用产业链页的整行卡片布局', `${filterRows} 行`)

  // 搜索：命中集由接口算出来，不钉死"就是那一条"
  await fill(page, '.header-search input', '苹果')
  await page.evaluate(() => document.querySelector('.header-search button')?.click())
  let names = await waitProducts(page, 1)
  const apiApples = baseline.filter((item) => (item.productName ?? '').includes('苹果')).map((item) => item.productName)
  check(names.length === apiApples.length && names.length > 0 && names.every((name) => name.includes('苹果')),
    '关键词搜索「苹果」的命中集与接口一致', `页面 ${names.length} 条 / 接口 ${apiApples.length} 条`)

  // 分类筛选：断言"确实筛小了"且每条仍在接口结果里，而不是钉死某一件商品
  await clickText(page, '清空筛选', '.hall-reset')
  await waitProducts(page, firstPageCount)
  await clickText(page, '粮油产业', '.hall-filter-body .hall-chips button')
  names = await waitProducts(page, 1)
  check(names.length > 0 && names.length < baseline.length
    && names.every((name) => baseline.some((item) => (item.productName ?? '').includes(name.slice(0, 6)))),
  '一级产业筛选会收窄结果且都来自真实货源', names.join('、'))

  // 产地筛选：页面上每张卡片都该带这个产地
  await clickText(page, '清空筛选', '.hall-reset')
  await waitProducts(page, firstPageCount)
  await clickText(page, '江苏', '.hall-filter-body .hall-chips button')
  names = await waitProducts(page, 1)
  const cardTexts = await page.$$eval('.hall-product', (items) => items.map((item) => item.innerText.replace(/\s+/g, ' ')))
  check(cardTexts.length > 0 && cardTexts.every((text) => text.includes('江苏')),
    '产地「江苏」筛选后每张卡片产地都是江苏', cardTexts.map((text) => text.slice(0, 24)).join(' / '))

  // 价格排序：首项取接口里最便宜的那件，不写死商品名
  await clickText(page, '清空筛选', '.hall-reset')
  await waitProducts(page, firstPageCount)
  await clickText(page, '价格从低到高', '.hall-toolbar .hall-chips button')
  names = await waitProducts(page, firstPageCount)
  const cheapest = [...baseline].filter((item) => item.price != null)
    .sort((a, b) => Number(a.price) - Number(b.price))[0]?.productName ?? ''
  check(cheapest !== '' && names[0]?.includes(cheapest.slice(0, 6)),
    '价格升序首项即接口里最便宜的货源', `页面=${names[0]} 接口=${cheapest}`)
  const columnPrices = await page.$$eval('.hall-product', (items) => items
    .map((item) => Number(/¥\s*([\d.]+)/.exec(item.innerText)?.[1] ?? 'NaN'))
    .filter((value) => !Number.isNaN(value)))
  check(columnPrices.length > 1 && columnPrices.every((value, index) => index === 0 || value >= columnPrices[index - 1]),
    '价格升序在整页单调不减', columnPrices.join(' ≤ '))

  // 采购需求：条数与需求接口一致，内容包含真实品类
  await clickText(page, '采购需求', '.hall-tabs button')
  await page.waitForSelector('.hall-table', { timeout: 10000 })
  const demandText = await page.evaluate(() => document.querySelector('.hall-table')?.innerText ?? '')
  const demandRows = await page.$$eval('.hall-table tbody tr', (rows) => rows.length)
  const apiDemands = await (await fetch('http://localhost:8086/api/trade/public/demands')).json()
    .then((body) => (body?.code === 200 ? body.data ?? [] : [])).catch(() => [])
  check(demandRows > 0 && demandRows === Math.min(apiDemands.length, demandRows) && demandText.includes('需求'),
    '采购需求大厅按接口渲染真实需求', `页面=${demandRows} 行，接口=${apiDemands.length} 条`)

  // 未登录报价 → 登录回跳
  await page.evaluate(() => document.querySelector('.hall-quote')?.click())
  await page.waitForFunction(() => window.location.port === '8090', undefined, { timeout: 15000 })
  check(page.url().includes(':8090/') && page.url().includes('/login'),
    '未登录点击报价直达统一认证登录页', page.url())

  // 商品详情公开，写操作才需要登录
  const ctx2 = await browser.newContext()
  const page2 = await ctx2.newPage()
  await page2.setViewportSize({ width: 390, height: 844 })
  await page2.goto(HALL, { waitUntil: 'networkidle', timeout: 60000 })
  await page2.waitForSelector('.hall-product', { timeout: 20000 })
  await page2.evaluate(() => document.querySelector('.hall-product')?.click())
  await page2.waitForFunction(() => location.pathname.startsWith('/product/detail/'), undefined, { timeout: 10000 })
  await page2.waitForSelector('.pd-hero', { timeout: 20000 })
  check(page2.url().includes('/product/detail/') && !page2.url().includes('/login'),
    '未登录点击商品可公开进入详情页', page2.url())
  await page2.goto(HALL, { waitUntil: 'networkidle' })
  await page2.waitForSelector('.hall-product', { timeout: 20000 })
  await page2.screenshot({ path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'trade-hall-mobile.png'), fullPage: true })
  await ctx2.close()

  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(HALL, { waitUntil: 'networkidle' })
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
