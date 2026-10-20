#!/usr/bin/env node
/** 主数据管理 · 商品与分类迁移回归（2026-10-20）。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const MDM = 'http://localhost:8080'
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
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { sel: selector, val: value })
}

async function loginAndOpen(page, targetPath) {
  await page.goto(`${MDM}${targetPath}`, { waitUntil: 'networkidle2', timeout: 60000 })
  for (let i = 0; i < 30; i++) {
    await sleep(500)
    if (page.url().includes(':8090') || page.url().includes('/login')) break
    if (await page.$('.catalog-page')) return
  }
  await page.waitForSelector('.auth-card', { timeout: 25000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')].find((el) => (el.textContent ?? '').includes('账号 + 密码'))
    tab?.click()
  })
  await sleep(250)
  await fill(page, 'input[autocomplete="username"]', 'admin')
  await fill(page, 'input[type="password"]', 'Admin@123')
  await page.click('.auth-submit')
  for (let i = 0; i < 40; i++) {
    await sleep(700)
    if (page.url().includes('8080') && !page.url().includes('/login')) break
  }
  if (!page.url().includes(targetPath)) {
    await page.goto(`${MDM}${targetPath}`, { waitUntil: 'networkidle2' })
  }
  await page.waitForSelector('.catalog-page', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 15000 }).catch(() => {})
  await sleep(500)
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(page, '/product/catalog')

  const text = await page.evaluate(() => document.body.innerText)
  check(text.includes('商品与分类') && text.includes('主数据管理'), '商品与分类已迁入主数据管理')
  const categoryRows = await page.evaluate(() => document.querySelector('.data-table tbody')?.innerText ?? '')
  check(categoryRows.includes('粮食') && categoryRows.includes('大米') && categoryRows.includes('水果'),
    '品类列表读取交易域真实分类', categoryRows.replace(/\s+/g, ' ').slice(0, 80))
  check(text.includes('新建品类') && text.includes('品类为全平台共用'), '品类维护入口与说明已展示')

  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('.catalog-tabs button')].find((el) => (el.textContent ?? '').includes('商品违规'))
    tab?.click()
  })
  await sleep(500)
  const violationText = await page.evaluate(() => document.body.innerText)
  check(violationText.includes('商品违规') && violationText.includes('处置单号'), '商品违规处置页可打开')

  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('.catalog-tabs button')].find((el) => (el.textContent ?? '').includes('品类管理'))
    tab?.click()
  })
  await sleep(300)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((el) => (el.textContent ?? '').includes('新建品类'))
    btn?.click()
  })
  await page.waitForSelector('.modal-content', { timeout: 10000 })
  const modalText = await page.evaluate(() => document.querySelector('.modal-content')?.innerText ?? '')
  check(modalText.includes('品类名称') && modalText.includes('上级品类'), '新建品类表单已渲染')
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.modal-footer button')].find((el) => (el.textContent ?? '').includes('取消'))
    btn?.click()
  })

  await page.screenshot({
    path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'mdm-catalog.png'),
    fullPage: true
  })
  check(errors.length === 0, '商品与分类页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '商品与分类回归脚本未抛异常', String(error).slice(0, 220))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
