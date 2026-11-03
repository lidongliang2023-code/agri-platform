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
  await page.goto(`${TRADE}${centerPath}`, { waitUntil: 'networkidle', timeout: 60000 })
  /**
   * 交易端未登录时由 PrivateRoute → LoginRedirect **自动**跳统一认证中心，
   * 页面上只留一行「正在前往平台认证中心登录…」。早先这里是要点「前往平台认证中心登录」按钮的，
   * 现在没有可点的按钮，等跳转即可 —— 等 URL 落到 :8090 再继续。
   */
  if (!page.url().includes(':8090/')) {
    await page.waitForFunction(() => window.location.href.includes(':8090/'), undefined, { timeout: 20000 })
      .catch(() => {})
  }
  if (page.url().includes(':8090/')) {
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
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 700))
  await sleep(500)
}

async function openTab(page, label) {
  await clickText(page, label, '.mc-side-nav button')
  await sleep(500)
  return page.evaluate(() => document.body.innerText)
}

const browser = await chromium.launch({ headless: !HEADFUL, executablePath: BROWSER, args: ['--no-sandbox'] })
try {
  // ---------------- 卖家中心（farmer 绑定主体 2001，真实销售订单/商品/评价） ----------------
  const ctxSeller = await browser.newContext()
  const seller = await ctxSeller.newPage()
  const sellerErrors = []
  seller.on('pageerror', (error) => sellerErrors.push(String(error)))
  await seller.setViewportSize({ width: 1440, height: 1000 })
  await loginAndOpen(seller, '/member/seller', 'farmer', 'Admin@123')
  const sellerHome = await seller.evaluate(() => document.body.innerText)
  check(sellerHome.includes('卖家中心') && sellerHome.includes('首页概览'), '卖家中心已渲染')
  check(sellerHome.includes('待发货') && sellerHome.includes('最近销售订单'), '卖家概览包含待办与最近销售订单')
  /**
   * 单号不写死：演示库每轮都会被 e2e 造单刷新，钉死 T20261013xx 只会假红。
   * 改为从概览里抓真实单号，再要求销售订单列表页包含它们 —— 两处同源才算展示真实订单。
   */
  // 单号格式换代过：老演示单是 T2026xxxxx，新造单是 SO<时间戳>，两种都算真实销售订单号。
  const orderNoPattern = /\b(?:SO\d{6,}|T\d{8,})\b/g
  const sellerOrderNos = (sellerHome.match(orderNoPattern) ?? [])
  check(sellerOrderNos.length > 0, '卖家概览显示真实销售订单', '概览单号：' + sellerOrderNos.slice(0, 3).join('/'))
  await seller.screenshot({ path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'member-seller.png'), fullPage: true })

  const sales = await openTab(seller, '销售订单')
  const salesOrderNos = (sales.match(orderNoPattern) ?? [])
  check(salesOrderNos.length > 0 && sellerOrderNos.every((no) => sales.includes(no)),
    '销售订单页按卖家侧展示真实订单（概览单号在列表里都能找到）',
    '概览 ' + sellerOrderNos.length + ' 单 / 列表 ' + salesOrderNos.length + ' 单')
  const goods = await openTab(seller, '商品管理')
  check(goods.includes('商品') || goods.includes('货源'), '商品管理显示当前卖家的货源视图', goods.replace(/s+/g, ' ').slice(0, 60))
  // 「供应发布」不再是侧边栏条目（SellerCenter 把 publish/supply 统一挂到「商品管理」高亮下），只能按 tab 参数进。
  await seller.goto(TRADE + '/member/seller?tab=supply', { waitUntil: 'networkidle', timeout: 60000 })
  await seller.waitForSelector('.mc-shell', { timeout: 30000 })
  await sleep(700)
  const supply = await seller.evaluate(() => document.body.innerText)
  check(supply.includes('浏览 / 询单') || supply.includes('还没有发布供应'),
    '供应视图按「浏览 / 询单」列展示（无货源时如实空态）', supply.replace(/s+/g, ' ').slice(0, 70))
  const trade = await openTab(seller, '报价与撮合')
  check(trade.includes('报价管理') && trade.includes('智能匹配') && trade.includes('价格推荐'),
    '报价/撮合/价格功能已并入卖家中心')
  const ship = await openTab(seller, '发货与物流')
  check(ship.includes('待发货') && (ship.includes('去发货') || ship.includes('没有')), '发货与物流页给出待发货队列（无待发货时如实空态）', ship.replace(/s+/g, ' ').slice(0, 70))
  check(ship.includes('物流'), '发货与物流内嵌完整物流功能')
  const after = await openTab(seller, '售后处理')
  check(after.includes('售后工单') && after.includes('纠纷'), '售后处理内嵌纠纷处理功能')
  const rate = await openTab(seller, '店铺评价与信用')
  const rateCount = (rate.match(/\d+ 条真实评价/) ?? [])[0] ?? ""
  check(/店铺评分|店铺评价/.test(rate) && (rate.match(/\d\.\d/) !== null || rate.includes("暂无")),
    "店铺评价显示均分与真实评价（不钉死历史分值）", rateCount || rate.replace(/\s+/g, " ").slice(0, 60))
  const sellerContract = await openTab(seller, '合同管理')
  check(sellerContract.includes('合同'), '合同管理已并入卖家中心')
  const fund = await openTab(seller, '资金结算')
  check(fund.includes('待结算订单') && fund.includes('已结算记录') && fund.includes('保证金账户'),
    '资金结算显示待结算、已结算与保证金')
  check(fund.includes('T20261013005') && fund.includes('卖家应收'), '资金结算显示真实待结算订单与分账金额')
  check(fund.includes('我的保证金') && fund.includes('我的获赔'), '保证金与获赔已并入卖家资金页')
  const customer = await openTab(seller, '客户管理')
  check(customer.includes('北京新发地批发市场'), '客户管理由真实订单聚合出采购商')
  const iot = await openTab(seller, '生产接入')
  check(iot.includes("生产") && (iot.includes("前往") || iot.includes("未接入")), "生产接入页给出跳转或如实未接入", iot.replace(/\s+/g, " ").slice(0, 60))
  // 店铺资料与认证已从卖家中心迁到个人中心（见 e2e-profile-move），侧栏不该再有这一项
  const sellerNavLabels = await seller.$$eval(".mc-side-nav button", (items) => items.map((item) => item.textContent?.replace(/\s+/g, "").trim()))
  check(!sellerNavLabels.some((label) => label.includes('店铺资料')), '卖家中心不再保留「店铺资料与认证」入口（资料归个人中心）', sellerNavLabels.join('/').slice(0, 120))
  check(sellerErrors.length === 0, '卖家中心无未捕获脚本异常', sellerErrors.slice(0, 2).join(' | '))

  // 全局交易后台已删除：根路径直接进买家中心，旧菜单页不再存在
  await seller.goto(`${TRADE}/`, { waitUntil: 'networkidle' })
  await sleep(600)
  const rootText = await seller.evaluate(() => document.body.innerText)
  check(seller.url().includes('/member/buyer') && rootText.includes('买家中心'),
    '交易端根路径直接进入买家中心', seller.url())
  check(!rootText.includes('交易撮合管理系统') && !(await seller.$('.ant-menu')),
    '全局交易后台菜单与首页已删除')
  await seller.goto(`${TRADE}/board`, { waitUntil: 'networkidle' })
  await sleep(500)
  check(seller.url().includes('/member/buyer'), '旧 /board 经营看板页已删除并回落到买家中心', seller.url())
  await seller.goto(`${TRADE}/order`, { waitUntil: 'networkidle' })
  await sleep(500)
  check(seller.url().includes('/member/buyer') && seller.url().includes('tab=purchase'),
    '旧 /order 入口重定向到买家采购订单', seller.url())
  await seller.goto(`${TRADE}/product`, { waitUntil: 'networkidle' })
  await sleep(500)
  check(seller.url().includes('/member/seller') && seller.url().includes('tab=goods'),
    '旧 /product 入口重定向到卖家商品管理', seller.url())
  await ctxSeller.close()

  // ---------------- 买家中心（联调账号绑定 3001 北京新发地，真实采购订单/评价） ----------------
  const ctxBuyer = await browser.newContext()
  const buyer = await ctxBuyer.newPage()
  const buyerErrors = []
  buyer.on('pageerror', (error) => buyerErrors.push(String(error)))
  await buyer.setViewportSize({ width: 1440, height: 1000 })
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
  check(buyerAfter.includes('售后与争议工单') && buyerAfter.includes('纠纷'),
    '买家售后页内含纠纷与物流功能')
  const buyerRate = await openTab(buyer, '采购评价')
  check(buyerRate.includes('米质没问题'), '采购评价显示我发出的真实评价')
  let buyerFund = await openTab(buyer, '资金与发票')
  check(buyerFund.includes('发票申请与记录') && buyerFund.includes('申请开票'),
    '资金与发票提供真实开票申请入口')
  if (!buyerFund.includes('待开票')) {
    await clickText(buyer, '申请开票')
    await sleep(600)
    await buyer.evaluate(() => {
      const btn = [...document.querySelectorAll('.ant-modal-footer button')]
        .find((el) => (el.textContent ?? '').includes('提交申请'))
      btn?.click()
    })
    await sleep(1800)
    buyerFund = await buyer.evaluate(() => document.body.innerText)
  }
  check(buyerFund.includes('待开票') && buyerFund.includes('T20261013005'),
    '开票申请落库并在列表显示待开票')
  check(buyerFund.includes('我的保证金') && buyerFund.includes('我的获赔'),
    '保证金与获赔已并入买家资金页')
  const buyerContract = await openTab(buyer, '合同管理')
  check(buyerContract.includes('合同'), '合同管理已并入买家中心')
  const favorite = await openTab(buyer, '收藏与关注')
  check(favorite.includes('收藏与关注尚未接入'), '收藏与关注如实标注未接入')
  const buyerProfile = await openTab(buyer, '企业资料与认证')
  check(buyerProfile.includes('经营主体 ID') && buyerProfile.includes('北京新发地批发市场'), '企业资料显示真实绑定主体')
  check(buyerProfile.includes('实名认证'), '实名认证已并入企业资料页')
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
