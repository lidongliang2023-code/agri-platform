#!/usr/bin/env node
/** 官网门户 · 供应链金融页回归（2026-10-20）。 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))
const BASE = 'http://localhost:8098/portal/'
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ headless: !HEADFUL, executablePath: BROWSER, args: ['--no-sandbox'] })
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}#/finance`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.fin-hero', { timeout: 20000 })
  await sleep(500)

  const text = await page.evaluate(() => document.body.innerText)
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(text.includes('让每一笔订单') && text.includes('都能快速拿到钱'), '供应链金融 Hero 已渲染')
  check(desktopOverflow <= 1, '桌面端无横向溢出', String(desktopOverflow))
  const activeNav = await page.$$eval('.main-nav a.active', (items) => items.map((item) => (item.textContent ?? '').trim()))
  check(activeNav.includes('供应链金融'), '门户导航「供应链金融」处于选中态', activeNav.join(' / '))
  /**
   * 产品矩阵改由资金方端在架配置供给（`/open/finance/products`），
   * 所以这一段的期望值一律从接口现取：写死产品名与利率会被数据漂移打假红，
   * 也会让"页面在替资金方报一个没人承诺过的价"这类真问题看不出来。
   */
  const apiProducts = await fetch('http://localhost:8098/open/finance/products',
    { headers: { Accept: 'application/json' } }).then((response) => response.json())
  const enabled = (apiProducts.data ?? []).filter((item) => item.status === '启用')
  check(apiProducts.code === 200 && enabled.length > 0, '资金方端在架产品接口可用',
    `code=${apiProducts.code} 在架=${enabled.length}`)
  const minRate = Math.min(...enabled.map((item) => Number(item.rate)))
  const cards = await page.$$eval('.fin-product', (items) => items.map((card) => ({
    title: card.querySelector('h3')?.textContent?.trim() ?? '',
    rate: card.querySelector('.fin-rate')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
    href: card.querySelector('a.btn-primary')?.getAttribute('href') ?? '',
  })))
  check(cards.length === enabled.length, '产品卡数量与资金方在架产品一致',
    `页面=${cards.length} 接口=${enabled.length}`)
  check(enabled.every((product) => cards.some((card) => card.title === product.productName)),
    '产品卡名称逐个来自资金方配置', cards.map((card) => card.title).join('/'))
  check(enabled.every((product) => cards.some((card) => card.rate.includes(`年化 ${Number(product.rate).toFixed(2)}%`))),
    '产品卡利率与配置逐条一致', cards.map((card) => card.rate).join(' | ').slice(0, 140))
  check(text.includes(`年化利率 ${minRate.toFixed(2)}% 起`), 'Hero 最低价由在架产品实算得出（不再写死 4.5%）',
    `接口最低价=${minRate.toFixed(2)}%`)
  check(!text.includes('年化利率低至 4.5%'), 'Hero 不再出现无出处的写死利率')
  check(cards.every((card) => card.href.includes(':8081/finance/#/borrower/loan-apply?product=')
    && enabled.some((product) => card.href.endsWith(encodeURIComponent(product.productCode)))),
    '申请入口带产品编码跳到资金方端申请页', cards[0]?.href ?? '')
  check(text.includes('产品名称、利率、额度与期限取自资金方端在架配置')
    && text.includes('仍为原型示例'), 'Hero 说清哪部分是实配、哪部分仍是示例')
  check((await page.$$eval('.fin-hero-stat', (items) => items.length)) === 4, 'Hero 四项金融指标已展示')
  check((await page.$$eval('.fin-stat-grid > div', (items) => items.length)) === 5, '平台数据条展示 5 项指标')
  check(text.includes('原型示例数据'), '平台数据条标注为原型示例')
  check((await page.$$eval('.fin-risk-grid .card', (items) => items.length)) === 4, '三角链风控四项能力已展示')
  check((await page.$$eval('.fin-partner', (items) => items.length)) === 8, '合作机构示例区展示 8 家')
  check(text.includes('非平台正式合作名单') && text.includes('资金方入驻与联合风控方案请联系平台运营'),
    '合作机构与资金方入驻口径如实标注')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.fin-hero-actions button')]
      .find((item) => (item.textContent ?? '').includes('查看金融产品'))
    button?.click()
  })
  await sleep(900)
  const productsTop = await page.$eval('#fin-products', (element) => element.getBoundingClientRect().top)
  check(Math.abs(productsTop) < 180, '「查看金融产品」定位到产品区', String(Math.round(productsTop)))

  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)
  await page.screenshot({ path: path.join(OUT, 'portal-finance.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${BASE}#/finance`, { waitUntil: 'networkidle' })
  await page.waitForSelector('.fin-hero', { timeout: 20000 })
  await sleep(500)
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(mobileOverflow <= 1, '390px 移动端无横向溢出', String(mobileOverflow))
  await page.screenshot({ path: path.join(OUT, 'portal-finance-mobile-top.png') })
  await page.screenshot({ path: path.join(OUT, 'portal-finance-mobile.png'), fullPage: true })
  check(errors.length === 0, '供应链金融页无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '供应链金融页回归脚本未抛异常', String(error).slice(0, 220))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
