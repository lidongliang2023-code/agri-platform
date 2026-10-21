#!/usr/bin/env node
/** 交易商品详情页回归（2026-10-21）。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = process.argv.find((item) => item.startsWith('--base='))?.split('=').slice(1).join('=')
  ?? 'http://localhost:8086'
const HEADFUL = process.argv.includes('--headful')
const OUT_DIR = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const productsResponse = await fetch(`${BASE}/api/trade/public/products?limit=8`)
const productsBody = await productsResponse.json()
const products = Array.isArray(productsBody.data) ? productsBody.data : []
const product = products[0]
if (!product) {
  console.error('没有可用于详情页回归的已发布商品')
  process.exit(1)
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/product/detail/${product.id}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.pd-hero', { timeout: 20000 })
  await sleep(400)

  const text = await page.evaluate(() => document.body.innerText)
  check(page.url().includes(`/product/detail/${product.id}`), '未登录可公开浏览商品详情', page.url())
  check(text.includes(product.productName), '商品名称来自真实商品接口', product.productName)
  check(text.includes(product.sellerName || ''), '展示真实供应商', product.sellerName ?? '')
  check(text.includes(`¥${Number(product.price).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}`),
    '当前价格来自真实商品记录', String(product.price))
  check(text.includes(`起订 ${product.minOrderQuantity} ${product.unit}`), '展示真实起订量')
  check((await page.$$eval('.pd-reference-grid > div', (items) => items.length)) === 3, '价格参考区展示最低价、当前价、最高价')
  check((await page.$$eval('.pd-info-line', (items) => items.length)) >= 6, '规格摘要展示真实商品字段')
  check(text.includes('平台在售') && text.includes('已发布'), '展示真实在售与发布状态')
  check((await page.$$eval('.pd-tabs button', (items) => items.length)) === 4, '商品详情四个页签齐全')
  check((await page.$$eval('.pd-similar-card', (items) => items.length)) > 0, '展示同品类相似商品')
  check(text.includes('在线议价') && text.includes('供应商在线报价'), '在线议价流程完整展示')
  check(!text.includes('采购方报价：¥4500') && !text.includes('华润万家采购中心'),
    '页面不展示原型中的模拟聊天与成交记录')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.pd-tabs button')].find((item) => item.textContent?.includes('规格参数'))
    button?.click()
  })
  await sleep(200)
  const specText = await page.evaluate(() => document.querySelector('.pd-tab-panel')?.textContent ?? '')
  check(specText.includes(product.productName) && specText.includes('商品编码')
    && (!product.barcode || specText.includes(product.barcode)),
  '规格参数页签读取真实商品资料与条码')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.pd-tabs button')].find((item) => item.textContent?.includes('供应商信息'))
    button?.click()
  })
  await sleep(200)
  const supplierText = await page.evaluate(() => document.querySelector('.pd-tab-panel')?.textContent ?? '')
  check(supplierText.includes(product.sellerName || ''), '供应商页签展示当前商品供应商')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.pd-tabs button')].find((item) => item.textContent?.includes('交易记录'))
    button?.click()
  })
  await sleep(200)
  const recordsText = await page.evaluate(() => document.querySelector('.pd-tab-panel')?.textContent ?? '')
  check(recordsText.includes('暂无公开的逐笔成交记录'), '无公开成交数据时展示明确空态')

  await page.screenshot({ path: path.join(OUT_DIR, 'trade-product-detail.png'), fullPage: true })

  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${BASE}/product/detail/${product.id}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.pd-hero', { timeout: 20000 })
  await sleep(400)
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  check(noOverflow, '390px 移动端无横向溢出')
  await page.screenshot({ path: path.join(OUT_DIR, 'trade-product-detail-mobile.png'), fullPage: true })

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.pd-actions button')].find((item) => item.textContent?.includes('立即下单'))
    button?.click()
  })
  await page.waitForFunction(() => location.pathname === '/login', { timeout: 10000 })
  const loginRedirect = new URL(page.url()).searchParams.get('redirect') ?? ''
  check(loginRedirect.includes('/order/create')
    && loginRedirect.includes(`productId=${product.id}`)
    && loginRedirect.includes('quantity='),
  '未登录下单跳转登录并携带下单页与数量回跳地址', loginRedirect)
  check(errors.length === 0, '商品详情页无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '商品详情回归脚本未抛异常', String(error).slice(0, 240))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
