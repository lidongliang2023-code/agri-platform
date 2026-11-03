#!/usr/bin/env node
/** 卖家信用评价列表、回复页与申诉页视觉回归。 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
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
const BASE = 'http://localhost:8086'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
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

const browser = await chromium.launch({
  headless: true,
  executablePath: BROWSER,
  args: ['--no-sandbox'],
})
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/member/seller?tab=rate`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForFunction(() => window.location.port === '8090', undefined, { timeout: 20000 })
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
  await page.waitForSelector('.credit-workbench', { timeout: 30000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 700))

  const pageText = await page.evaluate(() => document.body.innerText)
  /**
   * 「信用评价明细」这个标题从来不存在（这一页的工作区标题是「店铺评价与信用」，列表按卡片渲染），
   * 断言改成看真实渲染产物：卡片条数 + 每条卡片上的可执行动作。
   */
  const cards = await page.$$eval('.credit-evaluation-card', (items) => items.map((card) => ({
    text: (card.innerText ?? '').replace(/\s+/g, ' '),
    actions: [...card.querySelectorAll('.credit-evaluation-actions button')].map((b) => b.textContent?.replace(/\s+/g, '').trim()),
  })))
  check(cards.length > 0 && pageText.includes('店铺评价与信用'), '信用评价列表使用统一工作区并按卡片展示',
    `${cards.length} 张评价卡`)
  /** 已经回复过 / 已在申诉中的卡片按口径不再给动作，所以不能要求"每张都有按钮"。 */
  const withReply = cards.filter((card) => card.actions.includes('回复评价')).length
  const withAppeal = cards.filter((card) => card.actions.includes('发起申诉')).length
  check(withReply > 0 && withAppeal > 0, '评价卡按可执行动作给出回复与申诉入口',
    `可回复 ${withReply} 张、可申诉 ${withAppeal} 张（共 ${cards.length} 张）`)
  check(!(await page.$('.ant-table')), '信用评价已移除默认 Ant Design 表格')
  check((await page.$$eval('.credit-evaluation-card', (items) => items.length)) > 0,
    '真实评价以业务卡片展示')

  const openedReply = await page.evaluate(() => {
    const button = [...document.querySelectorAll('.credit-evaluation-card button')]
      .find((item) => item.textContent?.includes('回复评价'))
    if (!button) return false
    button.click()
    return true
  })
  check(openedReply, '未回复评价提供页面级回复入口')
  await page.waitForFunction(() => document.body.innerText.includes('回复买家评价'), undefined, { timeout: 10000 })
  const replyText = await page.evaluate(() => document.body.innerText)
  check(replyText.includes('公开回复') && replyText.includes('回复说明') && replyText.includes('发布回复'),
    '回复页面使用独立表单与说明侧栏')
  check(!(await page.$('.ant-modal')), '回复评价不再使用弹窗')
  await page.screenshot({ path: path.join(OUT, 'seller-evaluation-reply.png'), fullPage: true })
  await page.click('.credit-back')
  await page.waitForSelector('.credit-evaluation-card', { timeout: 10000 })

  const openedAppeal = await page.evaluate(() => {
    const button = [...document.querySelectorAll('.credit-evaluation-card button')]
      .find((item) => item.textContent?.includes('发起申诉'))
    if (!button) return false
    button.click()
    return true
  })
  check(openedAppeal, '被评价卖家提供页面级申诉入口')
  await page.waitForFunction(() => document.body.innerText.includes('发起评价申诉'), undefined, { timeout: 10000 })
  const appealText = await page.evaluate(() => document.body.innerText)
  check(appealText.includes('申诉信息') && appealText.includes('申诉须知') && appealText.includes('提交申诉'),
    '申诉页面使用独立表单与申诉须知')
  check(!(await page.$('.ant-modal')), '评价申诉不再使用弹窗')
  await page.screenshot({ path: path.join(OUT, 'seller-evaluation-appeal.png'), fullPage: true })
  await page.click('.credit-back')
  await page.waitForSelector('.credit-workbench', { timeout: 10000 })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.credit-workbench', { timeout: 30000 })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '390px 信用评价页无横向溢出')
  await page.screenshot({ path: path.join(OUT, 'seller-evaluation-mobile.png'), fullPage: true })
  check(errors.length === 0, '信用评价回复与申诉页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '信用评价页面回归未抛异常', String(error).slice(0, 300))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
