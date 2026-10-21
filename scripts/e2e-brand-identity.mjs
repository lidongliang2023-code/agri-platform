#!/usr/bin/env node
/** 丰链云跨子系统品牌一致性回归。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')

const BASE = 'http://localhost'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const fill = async (page, selector, value) => page.evaluate(({ sel, val }) => {
  const input = document.querySelector(sel)
  if (!(input instanceof HTMLInputElement)) throw new Error(`未找到输入框 ${sel}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, val)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}, { sel: selector, val: value })

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
try {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 1000 })

  await page.goto(`${BASE}:8098/portal/#/`, { waitUntil: 'networkidle2', timeout: 60000 })
  let text = await page.evaluate(() => document.body.innerText)
  check(text.includes('丰链云') && !text.includes('农产云'), '官网门户已使用丰链云品牌名')
  check(await page.$$eval('svg[aria-label="丰链云"]', (nodes) => nodes.length > 0),
    '官网门户已显示丰链云图形标识')

  await page.goto(`${BASE}:8090/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  text = await page.evaluate(() => document.body.innerText)
  check(text.includes('丰链云') && !text.includes('农产云'), '统一认证中心已使用丰链云品牌名')
  check(await page.$$eval('svg[aria-label="丰链云"]', (nodes) => nodes.length > 0),
    '统一认证中心已显示丰链云图形标识')

  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => (item.textContent ?? '').includes('账号 + 密码'))
    tab?.click()
  })
  await fill(page, 'input[autocomplete="username"]', 'admin')
  await fill(page, 'input[autocomplete="current-password"]', 'Admin@123')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => (item.textContent ?? '').includes('登 录'))
    button?.click()
  })
  for (let i = 0; i < 30; i += 1) {
    await sleep(500)
    if (!page.url().includes(':8090/')) break
  }

  await page.goto(`${BASE}/admin/production/dashboard/screen`, { waitUntil: 'networkidle2', timeout: 60000 })
  text = await page.evaluate(() => document.body.innerText)
  check(text.includes('丰链云') && !text.includes('农产云'), '生产管理运营端已使用丰链云品牌名')
  check(await page.$$eval('svg[aria-label="丰链云"]', (nodes) => nodes.length > 0),
    '生产管理运营端已显示丰链云图形标识')

  await page.goto(`${BASE}:8080/subject/list`, { waitUntil: 'networkidle2', timeout: 60000 })
  text = await page.evaluate(() => document.body.innerText)
  check(text.includes('丰链云') && !text.includes('农产云'), '主数据管理端已使用丰链云品牌名')
  check(await page.$$eval('svg[aria-label="丰链云"]', (nodes) => nodes.length > 0),
    '主数据管理端已显示丰链云图形标识')

  await page.goto(`${BASE}:8086/member/seller`, { waitUntil: 'networkidle2', timeout: 60000 })
  text = await page.evaluate(() => document.body.innerText)
  check(text.includes('丰链云') && !text.includes('农产云'), '卖家中心已使用丰链云品牌名')
  check(await page.$$eval('svg[aria-label="丰链云"]', (nodes) => nodes.length > 0),
    '卖家中心已显示丰链云图形标识')
  await context.close()
} catch (error) {
  check(false, '脚本执行未抛异常', String(error).slice(0, 200))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) process.exitCode = 1
