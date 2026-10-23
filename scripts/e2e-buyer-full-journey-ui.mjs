#!/usr/bin/env node
/** 买家中心全链路页面验收：从询价报价受理到合同、售后、评价、开票及运营发票页。 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const TRADE = 'http://localhost:8086'
const CORE = 'http://localhost:8093'
const MAIN_ORDER_ID = Number(process.argv.find((item) => /^\d+$/.test(item)) ?? '7627')
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const stamp = Date.now()
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sql = (statement) => {
  const output = execFileSync(MYSQL, [
    '--default-character-set=utf8mb4', '-uroot', '-proot', '-N', '-B', '-e', statement,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('\t'))
}
const scalar = (statement) => sql(statement)[0]?.[0] ?? ''

const loginApi = async (username, password) => {
  const response = await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, marketId: 1 }),
  })
  const body = await response.json()
  if (body.code !== 0) throw new Error(body.message ?? '登录失败')
  return body.data.accessToken
}
const api = async (method, requestPath, token, payload) => {
  const url = requestPath.startsWith('http://') || requestPath.startsWith('https://')
    ? requestPath : `${TRADE}${requestPath}`
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
  return response.json()
}

const fill = async (page, selector, value) => page.evaluate(({ target, next }) => {
  const input = document.querySelector(target)
  if (!(input instanceof HTMLInputElement)) throw new Error(`未找到输入框 ${target}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, next)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}, { target: selector, next: value })

const loginAndOpen = async (page, targetPath, username, password) => {
  await page.goto(`${TRADE}${targetPath}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForFunction(() => window.location.port === '8090', { timeout: 20000 })
  await page.waitForSelector('button[role="tab"]', { timeout: 20000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => item.textContent?.includes('账号 + 密码'))
    tab?.click()
  })
  await fill(page, 'input[autocomplete="username"]', username)
  await fill(page, 'input[autocomplete="current-password"]', password)
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => item.textContent?.includes('登 录'))
    button?.click()
  })
  for (let i = 0; i < 60; i += 1) {
    await sleep(400)
    if (page.url().includes(':8086') && !page.url().includes('/login')) break
  }
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
}

const openBuyerTab = async (page, label) => {
  await page.goto(`${TRADE}/member/buyer?tab=${encodeURIComponent(label)}`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  })
  await page.waitForSelector('.mc-shell', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 12000 }).catch(() => {})
  await sleep(400)
  return page.evaluate(() => document.body.innerText)
}

// 先准备一张待受理报价，用于在页面真实点击“接受并生成订单”。
const [buyerTokenApi, sellerTokenApi] = await Promise.all([
  loginApi('19900002005', 'Test12345'),
  loginApi('farmer', 'Admin@123'),
])
const buyerMerchantId = String((await api(
  'GET', `${CORE}/api/v1/platform/merchants/mine`, buyerTokenApi,
))?.data?.[0]?.merchantId ?? '')
const demandName = `买家中心页面验收采购需求${stamp}`
const createdDemand = await api('POST', '/api/trade/demand', buyerTokenApi, {
  demandName,
  categoryId: 5101,
  categoryName: '大米',
  variety: '五常稻花香',
  productName: '东北五常大米 25kg/袋',
  quantity: 1,
  unit: '袋',
  priceMin: 110,
  priceMax: 130,
  deliveryProvince: '北京市',
  deliveryCity: '北京市',
  deliveryAddress: '新发地页面验收仓',
})
if (createdDemand?.code !== 200) throw new Error(createdDemand?.message ?? '页面验收需求创建失败')
const viewDemandId = Number(scalar(`
  SELECT id FROM agri_trade.agri_trade_demand
  WHERE demand_name = '${demandName}' AND del_flag = 0 ORDER BY id DESC LIMIT 1
`))
const createdInquiry = await api('POST', '/api/trade/negotiation/inquiry', buyerTokenApi, {
  demandId: viewDemandId,
  productId: 7001,
})
if (createdInquiry?.code !== 200) throw new Error(createdInquiry?.message ?? '页面验收询价创建失败')
const createdQuote = await api('POST', '/api/trade/negotiation/quote', sellerTokenApi, {
  inquiryId: createdInquiry.data.id,
  unitPrice: 118,
  quantity: 1,
  freightAmount: 8,
  remark: '页面验收报价',
})
if (createdQuote?.code !== 200) throw new Error(createdQuote?.message ?? '页面验收报价创建失败')
const pendingQuoteNo = createdQuote.data.quoteNo

const mainContract = sql(`
  SELECT id, contract_no, contract_status FROM agri_trade.agri_trade_contract
  WHERE order_id = ${MAIN_ORDER_ID} AND del_flag = 0 LIMIT 1
`)[0] ?? []
const mainOrderNo = scalar(`
  SELECT order_no FROM agri_trade.agri_trade_order WHERE id = ${MAIN_ORDER_ID}
`)
const mainInvoice = sql(`
  SELECT id, invoice_no, invoice_status FROM agri_trade.agri_trade_invoice
  WHERE order_id = ${MAIN_ORDER_ID} AND del_flag = 0 LIMIT 1
`)[0] ?? []
const mainEvaluation = sql(`
  SELECT evaluation_content FROM agri_trade.agri_trade_evaluation
  WHERE order_id = ${MAIN_ORDER_ID} AND del_flag = 0 LIMIT 1
`)[0]?.[0] ?? ''
const disputeNo = scalar(`
  SELECT dispute_no FROM agri_trade.agri_trade_dispute
  WHERE order_id = ${MAIN_ORDER_ID} AND del_flag = 0 ORDER BY id DESC LIMIT 1
`)
const refundOrderId = Number(scalar(`
  SELECT id FROM agri_trade.agri_trade_order
  WHERE order_no <> '' AND buyer_id = '${buyerMerchantId}' AND order_status = 'refunded'
  ORDER BY id DESC LIMIT 1
`))
const refundNo = scalar(`
  SELECT refund_no FROM agri_trade.agri_trade_refund
  WHERE order_id = ${refundOrderId} AND del_flag = 0 ORDER BY id DESC LIMIT 1
`)

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
})
try {
  const buyerContext = await browser.createBrowserContext()
  const buyer = await buyerContext.newPage()
  const errors = []
  buyer.on('pageerror', (error) => errors.push(String(error)))
  await buyer.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(buyer, '/member/buyer?tab=inquiry', '19900002005', 'Test12345')

  const inquiryText = await openBuyerTab(buyer, 'inquiry')
  check(inquiryText.includes('发布采购需求') && inquiryText.includes('我的询价'), '买家中心询价页完整渲染')
  check(inquiryText.includes(pendingQuoteNo), '待受理供应商报价在页面可见', pendingQuoteNo)
  const clicked = await buyer.evaluate((quoteNo) => {
    const row = [...document.querySelectorAll('tr')].find((item) => item.textContent?.includes(quoteNo))
    const button = row ? [...row.querySelectorAll('button')].find((item) =>
      item.textContent?.includes('接受并生成订单')) : null
    if (!button) return false
    button.click()
    return true
  }, pendingQuoteNo)
  check(clicked, '页面提供“接受并生成订单”操作')
  for (let i = 0; i < 60; i += 1) {
    await sleep(400)
    if (buyer.url().includes('/order/confirm?orderId=')) break
  }
  check(buyer.url().includes('/order/confirm?orderId='), '点击后生成订单并进入订单确认页', buyer.url())
  const generatedOrderId = Number(new URL(buyer.url()).searchParams.get('orderId'))
  check(generatedOrderId > 0, '页面受理报价得到真实订单号', String(generatedOrderId || ''))
  await buyer.screenshot({ path: path.join(OUT, 'buyer-journey-quote-accepted.png'), fullPage: true })

  const purchaseText = await openBuyerTab(buyer, 'purchase')
  check(purchaseText.includes('采购订单') && purchaseText.includes('订单号'), '采购订单工作区正常加载')

  const contractText = await openBuyerTab(buyer, 'contract')
  check(contractText.includes('合同管理') && contractText.includes('双方签署') && contractText.includes('合同状态'),
    '合同列表展示双方签署进度与合同状态')
  await buyer.screenshot({ path: path.join(OUT, 'contract-list-redesigned.png'), fullPage: true })
  const latestDraft = sql(`
    SELECT contract_no FROM agri_trade.agri_trade_contract
    WHERE order_id = ${generatedOrderId} AND del_flag = 0
    ORDER BY id DESC LIMIT 1
  `)[0]?.[0] ?? ''
  const openedSign = await buyer.evaluate((contractNo) => {
    const row = [...document.querySelectorAll('tr')].find((item) => item.textContent?.includes(contractNo))
    const button = row ? [...row.querySelectorAll('button')].find((item) =>
      (item.textContent ?? '').replace(/\s/g, '') === '签署') : null
    if (!button) return false
    button.click()
    return true
  }, latestDraft)
  check(openedSign, '待签合同提供签署入口', latestDraft)
  await buyer.waitForSelector('.contract-sign-page', { timeout: 10000 })
  const signPageText = await buyer.evaluate(() => document.body.innerText)
  check(signPageText.includes('选择签署方式') && signPageText.includes('合同概要'),
    '签署合同使用会员中心页面级布局')
  check(signPageText.includes('在线电子签章') && signPageText.includes('线下签署'),
    '签署页同时提供两种签署方式')
  check(signPageText.includes('上传清晰的电子签章'), '在线电子签章提供签章图片上传入口')
  await buyer.evaluate(() => {
    const label = [...document.querySelectorAll('.contract-method-card')]
      .find((item) => item.textContent?.includes('线下签署'))
    label?.click()
  })
  await sleep(300)
  const offlineSignText = await buyer.evaluate(() => document.body.innerText)
  check(offlineSignText.includes('上传已签署合同扫描件'), '线下签署提供合同扫描件上传入口')
  await buyer.screenshot({ path: path.join(OUT, 'contract-sign-modes.png'), fullPage: true })
  await buyer.setViewport({ width: 390, height: 844 })
  const signMobileNoOverflow = await buyer.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1)
  check(signMobileNoOverflow, '390px 合同签署页无横向溢出')
  await buyer.screenshot({ path: path.join(OUT, 'contract-sign-mobile.png'), fullPage: true })
  await buyer.setViewport({ width: 1440, height: 1000 })
  await buyer.click('.contract-back')
  await buyer.waitForSelector('.contract-detail-page', { timeout: 10000 })
  const detailText = await buyer.evaluate(() => document.body.innerText)
  check(detailText.includes('合同主体') && detailText.includes('交易条款') && detailText.includes('签署记录'),
    '合同详情以会员中心页面展示完整合同内容')
  check(detailText.includes('签约进度') && detailText.includes('存证信息'),
    '合同详情展示签约进度与存证信息')
  await buyer.click('.contract-back')
  await buyer.waitForSelector('.contract-table', { timeout: 10000 })
  await buyer.evaluate((contractNo) => {
    const input = document.querySelector('input[placeholder="输入合同编号搜索"]')
    if (!(input instanceof HTMLInputElement)) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, contractNo)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, mainContract[1] ?? '')
  await buyer.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => (item.textContent ?? '').replace(/\s/g, '') === '搜索')
    button?.click()
  })
  await buyer.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  const signedContractText = await buyer.evaluate(() => document.body.innerText)
  check(signedContractText.includes(mainContract[1] ?? '') && signedContractText.includes('已签署'),
    '合同管理可查询并显示已签署合同', mainContract[1] ?? '')
  const openedDetail = await buyer.evaluate((contractNo) => {
    const row = [...document.querySelectorAll('tr')].find((item) => item.textContent?.includes(contractNo))
    const button = row ? [...row.querySelectorAll('button')].find((item) =>
      (item.textContent ?? '').replace(/\s/g, '') === '查看') : null
    if (!button) return false
    button.click()
    return true
  }, mainContract[1] ?? '')
  check(openedDetail, '合同列表可进入已签署合同详情', mainContract[1] ?? '')
  await buyer.waitForSelector('.contract-detail-page', { timeout: 10000 })
  const mainDetailText = await buyer.evaluate(() => document.body.innerText)
  check(mainDetailText.includes('在线电子签章') && mainDetailText.includes('线下签署文件'),
    '已签署合同详情展示在线签章和线下签署证据')
  await buyer.screenshot({ path: path.join(OUT, 'contract-detail-redesigned.png'), fullPage: true })
  await buyer.setViewport({ width: 390, height: 844 })
  const detailMobileNoOverflow = await buyer.evaluate(() =>
    document.documentElement.scrollWidth <= window.innerWidth + 1)
  check(detailMobileNoOverflow, '390px 合同详情页无横向溢出')
  await buyer.screenshot({ path: path.join(OUT, 'contract-detail-mobile.png'), fullPage: true })
  await buyer.setViewport({ width: 1440, height: 1000 })
  await buyer.click('.contract-back')
  await buyer.waitForSelector('.contract-table', { timeout: 10000 })

  const afterText = await openBuyerTab(buyer, 'after')
  check(afterText.includes(disputeNo), '收货与售后页显示售后工单', disputeNo)
  check(afterText.includes(refundNo), '收货与售后页显示已通过的退款记录', refundNo)
  check(afterText.includes('已退款'), '退款状态以中文显示')

  const rateText = await openBuyerTab(buyer, 'rate')
  check(rateText.includes(mainEvaluation), '采购评价页显示买家发出的真实评价')
  check(rateText.includes('5'), '评价页显示五星评分')

  const fundText = await openBuyerTab(buyer, 'fund')
  check(fundText.includes(mainInvoice[1] ?? ''), '资金与发票页显示真实开票申请', mainInvoice[1] ?? '')
  check(fundText.includes('已开票'), '买家端开票状态显示已开票')
  check(errors.length === 0, '买家中心全链路页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
  await buyer.screenshot({ path: path.join(OUT, 'buyer-journey-fund.png'), fullPage: true })
  await buyerContext.close()

  const sellerContext = await browser.createBrowserContext()
  const seller = await sellerContext.newPage()
  const sellerErrors = []
  seller.on('pageerror', (error) => sellerErrors.push(String(error)))
  await seller.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(seller, '/member/seller?tab=contract', 'farmer', 'Admin@123')
  await seller.waitForSelector('.contract-page', { timeout: 30000 })
  const sellerContractText = await seller.evaluate(() => document.body.innerText)
  check(sellerContractText.includes('合同管理') && sellerContractText.includes('合同档案'),
    '卖家中心使用同一套合同管理工作区')
  await seller.evaluate((contractNo) => {
    const input = document.querySelector('input[placeholder="输入合同编号搜索"]')
    if (!(input instanceof HTMLInputElement)) return
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, contractNo)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, mainContract[1] ?? '')
  await seller.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => (item.textContent ?? '').replace(/\s/g, '') === '搜索')
    button?.click()
  })
  await seller.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  const sellerRowFound = await seller.evaluate((contractNo) =>
    document.body.innerText.includes(contractNo), mainContract[1] ?? '')
  check(sellerRowFound, '卖家中心可按合同编号查询合同', mainContract[1] ?? '')
  const sellerOpenedDetail = await seller.evaluate((contractNo) => {
    const row = [...document.querySelectorAll('tr')].find((item) => item.textContent?.includes(contractNo))
    const button = row ? [...row.querySelectorAll('button')].find((item) =>
      (item.textContent ?? '').replace(/\s/g, '') === '查看') : null
    if (!button) return false
    button.click()
    return true
  }, mainContract[1] ?? '')
  check(sellerOpenedDetail, '卖家中心可进入合同详情页')
  await seller.waitForSelector('.contract-detail-page', { timeout: 10000 })
  const sellerDetailText = await seller.evaluate(() => document.body.innerText)
  check(sellerDetailText.includes('采购方签署') && sellerDetailText.includes('供货方签署'),
    '卖家端合同详情展示双方签署记录')
  await seller.screenshot({ path: path.join(OUT, 'contract-detail-seller.png'), fullPage: true })
  check(sellerErrors.length === 0, '卖家合同页面无未捕获脚本异常', sellerErrors.slice(0, 2).join(' | '))
  await sellerContext.close()

  const adminContext = await browser.createBrowserContext()
  const admin = await adminContext.newPage()
  const adminErrors = []
  admin.on('pageerror', (error) => adminErrors.push(String(error)))
  await admin.setViewport({ width: 1440, height: 1000 })
  await loginAndOpen(admin, '/admin/trade/invoice', 'admin', 'Admin@123')
  await admin.waitForSelector('.admin-shell', { timeout: 30000 })
  await admin.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  // 默认是“待开票”，切到“已开票”验证最新发票。
  await admin.click('.ant-select-selector')
  await sleep(250)
  await admin.keyboard.press('ArrowDown')
  await admin.keyboard.press('Enter')
  await admin.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  await sleep(500)
  const adminText = await admin.evaluate(() => document.body.innerText)
  check(adminText.includes('发票审核') && adminText.includes(mainInvoice[1] ?? ''),
    '运营端发票审核页显示已开票记录', mainInvoice[1] ?? '')
  check(adminErrors.length === 0, '运营发票页无未捕获脚本异常', adminErrors.slice(0, 2).join(' | '))
  await admin.screenshot({ path: path.join(OUT, 'admin-invoice-review.png'), fullPage: true })
  await adminContext.close()

  console.log(`\n页面受理生成订单：${generatedOrderId}`)
  console.log(`主订单：${MAIN_ORDER_ID} / 合同：${mainContract[1]} / 发票：${mainInvoice[1]}`)
} catch (error) {
  check(false, '买家中心全链路页面验收未抛异常', String(error).slice(0, 300))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
