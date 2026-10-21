#!/usr/bin/env node
/** 买家/卖家资料与认证迁移到门户个人中心回归。 */
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

const login = async (page) => {
  if (page.url().includes(':8086/login')) {
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')]
        .find((item) => (item.textContent ?? '').includes('前往平台认证中心登录'))
      button?.click()
    })
  }
  for (let i = 0; i < 30; i += 1) {
    if (page.url().includes(':8090/')) break
    await sleep(400)
  }
  await page.waitForSelector('button[role="tab"]', { timeout: 15000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => (item.textContent ?? '').includes('账号 + 密码'))
    tab?.click()
  })
  await fill(page, 'input[autocomplete="username"]', '19900002005')
  await fill(page, 'input[autocomplete="current-password"]', 'Test12345')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => (item.textContent ?? '').includes('登 录'))
    button?.click()
  })
}

const waitForPersonalCenter = async (page) => {
  for (let i = 0; i < 40; i += 1) {
    await sleep(500)
    if (page.url().includes(':8098/portal/#/account')) break
  }
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  return page.url()
}

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
try {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 1000 })

  await page.goto(`${BASE}:8086/member/buyer?tab=profile`, { waitUntil: 'networkidle2', timeout: 60000 })
  await login(page)
  const buyerUrl = await waitForPersonalCenter(page)
  check(buyerUrl.includes('#/account/business'), '买家旧企业资料页自动跳转个人中心', buyerUrl)
  let text = await page.evaluate(() => document.body.innerText)
  check(text.includes('主体资料与认证') && text.includes('经营主体 ID'),
    '个人中心已承接企业资料与认证')
  check(!text.includes('企业资料与认证'), '个人中心不再保留交易端旧页签名')

  await page.goto(`${BASE}:8086/member/seller?tab=profile`, { waitUntil: 'networkidle2', timeout: 60000 })
  const sellerUrl = await waitForPersonalCenter(page)
  check(sellerUrl.includes('#/account/business'), '卖家旧店铺资料页自动跳转个人中心', sellerUrl)
  text = await page.evaluate(() => document.body.innerText)
  check(text.includes('主体资料与认证') && text.includes('认证'),
    '个人中心已承接店铺主体资料与认证状态')

  await page.goto(`${BASE}:8086/member/buyer`, { waitUntil: 'networkidle2', timeout: 60000 })
  text = await page.evaluate(() => document.body.innerText)
  check(!text.includes('企业资料与认证'), '买家中心菜单已移除企业资料与认证')
  check(text.includes('个人中心'), '买家中心保留个人中心快捷入口')

  await page.goto(`${BASE}:8086/member/seller`, { waitUntil: 'networkidle2', timeout: 60000 })
  text = await page.evaluate(() => document.body.innerText)
  check(!text.includes('店铺资料与认证'), '卖家中心菜单已移除店铺资料与认证')
  check(text.includes('个人中心'), '卖家中心保留个人中心快捷入口')
  await context.close()
} catch (error) {
  check(false, '脚本执行未抛异常', String(error).slice(0, 220))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) process.exitCode = 1
