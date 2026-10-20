#!/usr/bin/env node
/**
 * 买家中心 / 卖家中心联调（2026-10-20）。
 *
 * 真浏览器走一次 SSO 登录，再逐页验证：
 *   · 卖家中心：概览、销售订单、商品、供应、发货物流、售后、评价、资金、客户、生产接入、店铺资料；
 *   · 买家中心：概览、采购订单、询价、售后、评价、资金、收藏、企业资料。
 *
 * 用法：node scripts/e2e-member-center.mjs [--headful]
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')

const TRADE = 'http://localhost:8086'
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

const clickText = async (page, text, selector = 'button') => {
  await page.evaluate(({ label, sel }) => {
    const target = [...document.querySelectorAll(sel)]
      .find((el) => (el.textContent ?? '').replace(/\s/g, '').includes(label.replace(/\s/g, '')))
    if (!target) throw new Error(`未找到 ${label}`)
    target.click()
  }, { label: text, sel: selector })
  await sleep(350)
}

/** 从会员中心入口走一次真实 SSO 登录，回到指定会员中心。 */
async function loginAndOpen(page, centerPath, username, password) {
  await page.goto(`${TRADE}${centerPath}`, { waitUntil: 'networkidle2', timeout: 60000 })
  if (page.url().includes('/login')) {
    await clickText(page, '前往平台认证中心登录')
    for (let i = 0; i < 24; i++) {
      await sleep(500)
      if (page.url().includes(':8090/')) break
    }
    await page.waitForSelector('.auth-card', { timeout: 20000 })
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll('button[role="tab"]')].find((el) => (el.textContent ?? '').includes('账号 + 密码'))
      tab?.click()
    })
    await sleep(250)
    await fill(page, 'input[autocomplete="username"]', username)
    await fill(page, 'input[type="password"]', password)
    await page.click('.auth-submit')
    for (let i = 0; i < 40; i++) {
      await sleep(700)
      if (page.url().includes('8086') && !page.url().includes('/login')) break
    }
  }
  await page.waitForSelector('.mc-shell', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  await sleep(500)
}

async function openTab(page, label) {
  await clickText(page, label, '.mc-side-nav button')
  await sleep(500)
  return page.evaluate(() => document.body.innerText)
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  // ---------------- 卖家中心（farmer 绑定主体 2001，真实销售订单/商品/评价） ----------------
  const ctxSeller = await browser.createBrowserContext()
  const seller = await ctxSeller.newPage()
  const sellerErrors = []
  seller.on('pageerror', (error) => sellerErrors.push(String(error)))
  await seller.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(seller, '/member/seller', 'farmer', 'Admin@123')
  const sellerHome = await seller.evaluate(() => document.body.innerText)
  check(sellerHome.includes('卖家中心') && sellerHome.includes('首页概览'), '卖家中心已渲染')
  check(sellerHome.includes('待发货') && sellerHome.includes('最近销售订单'), '卖家概览包含待办与最近销售订单')
  check(sellerHome.includes('T20261013001') && sellerHome.includes('T20261013005'), '卖家概览显示真实销售订单')
  await seller.screenshot({ path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'member-seller.png'), fullPage: true })

  const sales = await openTab(seller, '销售订单')
  check(sales.includes('T20261013001') && sales.includes('绿源农业合作社'), '销售订单页按卖家侧展示真实订单')
  const goods = await openTab(seller, '商品管理')
  check(goods.includes('东北五常大米'), '商品管理显示当前卖家的真实货源')
  const supply = await openTab(seller, '供应发布')
  check(supply.includes('浏览 / 询单'), '供应发布显示浏览与询单列')
  const ship = await openTab(seller, '发货与物流')
  check(ship.includes('待发货') && ship.includes('去发货'), '发货与物流显示待发货订单')
  const after = await openTab(seller, '售后处理')
  check(after.includes('售后工单'), '售后处理页可打开')
  const rate = await openTab(seller, '店铺评价与信用')
  check(rate.includes('4.0') && rate.includes('米质没问题'), '店铺评价显示真实评价与均分')
  const fund = await openTab(seller, '资金结算')
  check(fund.includes('保证金账户') && fund.includes('结算流水'), '资金结算显示保证金与结算口径')
  const customer = await openTab(seller, '客户管理')
  check(customer.includes('北京新发地批发市场'), '客户管理由真实订单聚合出采购商')
  const iot = await openTab(seller, '生产接入')
  check(iot.includes('前往生产管理') && iot.includes('不展示未经来源'), '生产接入如实引导到生产域')
  const profile = await openTab(seller, '店铺资料与认证')
  check(profile.includes('绿源农业合作社') && profile.includes('经营主体 ID'), '店铺资料显示真实绑定主体')
  check(sellerErrors.length === 0, '卖家中心无未捕获脚本异常', sellerErrors.slice(0, 2).join(' | '))
  await ctxSeller.close()

  // ---------------- 买家中心（联调账号绑定 3001 北京新发地，真实采购订单/评价） ----------------
  const ctxBuyer = await browser.createBrowserContext()
  const buyer = await ctxBuyer.newPage()
  const buyerErrors = []
  buyer.on('pageerror', (error) => buyerErrors.push(String(error)))
  await buyer.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(buyer, '/member/buyer', '13962330440', 'Agri2026test')
  const buyerHome = await buyer.evaluate(() => document.body.innerText)
  check(buyerHome.includes('买家中心') && buyerHome.includes('首页概览'), '买家中心已渲染')
  check(buyerHome.includes('最近采购订单') && buyerHome.includes('T20261013005'), '买家概览显示真实采购订单')
  await buyer.screenshot({ path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'member-buyer.png'), fullPage: true })

  const purchase = await openTab(buyer, '采购订单')
  check(purchase.includes('T20261013001') && purchase.includes('北京新发地批发市场'), '采购订单页按买家侧展示真实订单')
  const inquiry = await openTab(buyer, '我的询价')
  check(inquiry.includes('采购需求') && inquiry.includes('货源询价进展'), '我的询价显示需求与询价两块')
  const buyerAfter = await openTab(buyer, '收货与售后')
  check(buyerAfter.includes('售后与争议工单'), '买家售后页可打开')
  const buyerRate = await openTab(buyer, '采购评价')
  check(buyerRate.includes('米质没问题'), '采购评价显示我发出的真实评价')
  const buyerFund = await openTab(buyer, '资金与发票')
  check(buyerFund.includes('发票模块尚未接入'), '资金与发票如实标注未接入')
  const favorite = await openTab(buyer, '收藏与关注')
  check(favorite.includes('收藏与关注尚未接入'), '收藏与关注如实标注未接入')
  const buyerProfile = await openTab(buyer, '企业资料与认证')
  check(buyerProfile.includes('经营主体 ID') && buyerProfile.includes('北京新发地批发市场'), '企业资料显示真实绑定主体')
  check(buyerErrors.length === 0, '买家中心无未捕获脚本异常', buyerErrors.slice(0, 2).join(' | '))
  await ctxBuyer.close()
} catch (error) {
  check(false, '会员中心联调脚本未抛异常', String(error).slice(0, 220))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
