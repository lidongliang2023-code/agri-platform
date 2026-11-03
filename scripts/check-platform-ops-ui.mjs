/**
 * 运营端全页面点检：造渠道/商品/订单/售后 → 浏览器逐页校验（大盘/选品池/入驻/售后/履约/价盘/结算/佣金报表/活动/边界）。
 * 用法：node scripts/check-platform-ops-ui.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')
const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const sql = (q) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' }).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 80)}`
  }
}
const CORE = 'http://localhost:8093'
const S2B2C = 'http://localhost:8088'
const APP = 'http://localhost:8103'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'platform-ops-20261030')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
})).json()
const token = login?.data?.accessToken ?? ''
const auth = { Authorization: `Bearer ${token}` }
const adminId = sql(`SELECT id FROM agri_core.platform_user WHERE username = 'admin'`)
const sessionRes = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
})
const cookie = (sessionRes.headers.getSetCookie?.() ?? []).map((x) => x.split(';')[0]).join('; ')

let identityId = ''
let supplierId = ''
let channelId = ''
let productId = ''
let relationId = ''
let consumerId = ''
let addressId = ''
let orderId = ''
let cartId = ''
let reviewId = ''
let pendingProductA = ''
let pendingProductB = ''
const pendingNameA = `待审驳回${Date.now() % 10000}`
const pendingNameB = `待审批量${Date.now() % 10000}`
let activityCouponId = ''
let activityFlashId = ''
let activityGroupId = ''
let riskEventKey = ''
const couponName = `点检券${Date.now() % 100000}`
const groupName = `点检拼团${Date.now() % 100000}`
let pendingChannelId = '990000000000000101'
const created = { supplier: false, channel: false, product: false }
const productName = `运营点检商品${Date.now() % 10000}`

try {
  sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${pendingChannelId}'`)
  sql(`INSERT INTO agri_s2b2c.s2b2c_channel_partner
       (id, register_type, contact_name, contact_phone, shop_name, grade, audit_status)
       VALUES ('${pendingChannelId}', 'PERSONAL', '待审点检', '13800002222', '运营点检待审渠道', 'LEVEL_1', 'PENDING')`)

  const identityCount = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE user_id = '${adminId}' AND identity_type = 'wholesaler' AND status = 'approved'`)
  if (identityCount === '0' || identityCount === '') {
    const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ identityType: 'wholesaler', subjectName: '运营端点检主体' }),
    })).json()
    identityId = applied?.data?.id ?? ''
    await fetch(`${CORE}/api/v1/admin/identity-applications/${identityId}/review`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true, remark: 'platform ops check' }),
    })
  }

  const supplierProfile = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  if (supplierProfile?.applied) {
    supplierId = String(supplierProfile.id)
  } else {
    await fetch(`${S2B2C}/api/supplier/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: '运营点检供应商', creditCode: '91320100OPS1001X', contactPhone: '13800000000' }),
    })
    supplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    created.supplier = true
  }
  await fetch(`${S2B2C}/api/supplier/product/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 1, name: productName, price: 12.8, stock: 30, commissionRate: 8 }),
  })
  productId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id = '${supplierId}' AND name = '${productName}' ORDER BY id DESC LIMIT 1`)
  created.product = true
  await fetch(`${S2B2C}/api/platform/product/audit?id=${productId}&status=APPROVED&opinion=ui`, { method: 'PUT', headers: auth })
  for (const name of [pendingNameA, pendingNameB]) {
    await fetch(`${S2B2C}/api/supplier/product/create`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ categoryId: 1, name, price: 9.9, stock: 10, commissionRate: 5 }),
    })
  }
  pendingProductA = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE name = '${pendingNameA}' ORDER BY id DESC LIMIT 1`)
  pendingProductB = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE name = '${pendingNameB}' ORDER BY id DESC LIMIT 1`)

  const channelProfile = await (await fetch(`${S2B2C}/api/channel/profile`, { headers: auth })).json()
  if (channelProfile?.applied) {
    channelId = String(channelProfile.id)
    if (channelProfile.auditStatus !== 'APPROVED') {
      await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, { method: 'PUT', headers: auth })
    }
  } else {
    await fetch(`${S2B2C}/api/channel/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: '运营点检渠道', contactPhone: '13800000000', shopName: '运营点检渠道店', shopDesc: '点检' }),
    })
    channelId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE shop_name = '运营点检渠道店' ORDER BY id DESC LIMIT 1`)
    created.channel = true
    await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, { method: 'PUT', headers: auth })
  }
  await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, { method: 'POST', headers: auth })
  relationId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}' LIMIT 1`)
  // 渠道零售价故意低于供货价：改价接口已禁止低于供货价，这里直接写库模拟历史越界数据
  sql(`UPDATE agri_s2b2c.s2b2c_channel_product SET retail_price = 5, shelf_status = 'ON' WHERE id = '${relationId}'`)

  const consumer = await (await fetch(`${S2B2C}/api/consumer/profile`, { headers: auth })).json()
  consumerId = String(consumer?.id ?? '')
  await fetch(`${S2B2C}/api/consumer/address/add`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, name: '运营点检买家', phone: '13900002222', province: '广东省', city: '广州市', district: '天河区', address: '点检路 2 号', isDefault: true, status: 'ACTIVE' }),
  })
  addressId = sql(`SELECT id FROM agri_s2b2c.s2b2c_address WHERE consumer_id = '${consumerId}' ORDER BY id DESC LIMIT 1`)
  await fetch(`${S2B2C}/api/consumer/cart/add?consumerId=${consumerId}&productId=${productId}&quantity=2&channelId=${channelId}`, { method: 'POST', headers: auth })
  cartId = sql(`SELECT id FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${consumerId}' AND product_id = '${productId}' ORDER BY id DESC LIMIT 1`)
  const orderRes = await (await fetch(`${S2B2C}/api/consumer/order/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, addressId }),
  })).json()
  orderId = String(orderRes?.orderIds?.[0] ?? '')
  check(Boolean(orderId), '造好渠道订单', `order=${orderId}`)
  await fetch(`${S2B2C}/api/consumer/order/pay/${orderId}`, { method: 'PUT', headers: auth })
  const orderNo = sql(`SELECT order_no FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE order_id = '${orderId}' AND product_id = '${productId}'`)
  reviewId = String(Date.now())
  sql(`INSERT INTO agri_s2b2c.s2b2c_review
       (id,order_id,product_id,consumer_id,rating,content,anonymous,create_time)
       VALUES ('${reviewId}','${orderId}','${productId}','${consumerId}',5,'运营点检评价：包装完整，发货及时',FALSE,NOW())`)
  await fetch(`${S2B2C}/api/consumer/after-sales`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, orderId, type: 'REFUND', reason: '运营点检售后', amount: 3 }),
  })

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } })
  const cookiePairs = cookie.split('; ').map((x) => x.split('='))
  await context.addCookies(cookiePairs.map(([name, ...rest]) => ({ name, value: rest.join('='), domain: 'localhost', path: '/' })))
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 120)))

  try {
    await page.goto(`${APP}/`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1200)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('运营大盘') && text.includes('GMV'), '运营大盘渲染')
    check(['商品与供应链', '小 B 渠道商', '订单与履约', '价格与结算', '模块边界与协同'].every((label) => text.includes(label)), '侧栏按原型 IA 分组')
    await page.screenshot({ path: path.join(OUT, '01-dashboard.png'), fullPage: false })

    await page.goto(`${APP}/orders`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    await page.locator('input[placeholder="搜索订单号"]').fill(orderNo)
    await page.locator('input[placeholder="搜索订单号"]').press('Enter')
    await page.waitForTimeout(1000)
    const platformOrderRow = page.locator('tr', { hasText: orderNo }).first()
    check(await platformOrderRow.count() > 0, '运营订单列表按订单号检索')
    check((await page.evaluate(() => document.body.innerText)).includes('自动确认收货'),
      '运营订单页提供自动确认收货入口')
    await platformOrderRow.locator('button', { hasText: '查看' }).click()
    await page.waitForTimeout(1200)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(orderNo) && text.includes(productName) && text.includes('收货信息'),
      '运营订单详情展示商品与收货信息')

    await page.goto(`${APP}/reports`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1300)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    const reportCharts = await page.locator('canvas').count()
    check(text.includes('数据报表中心') && reportCharts >= 2, '数据报表渲染双图表', `canvas=${reportCharts}`)
    check(text.includes('运营点检渠道店') && text.includes(productName), '报表含渠道排行与热销商品')
    check(text.includes('履约质量') && text.includes('财务概览') && text.includes('营销概况'), '报表含履约/财务/营销主题')
    await page.screenshot({ path: path.join(OUT, '04-reports.png'), fullPage: false })

    await page.goto(`${APP}/product-pool`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(productName), '总部选品池含商品', productName)

    await page.goto(`${APP}/products`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    await page.locator('input[placeholder="搜索商品名称"]').fill(pendingNameA)
    await page.locator('button', { hasText: '查询' }).click()
    await page.waitForTimeout(900)
    await page.locator('tr', { hasText: pendingNameA }).first().getByRole('button', { name: '审核', exact: true }).click()
    await page.waitForTimeout(600)
    await page.locator('.el-dialog .el-radio', { hasText: '拒绝' }).click()
    await page.locator('.el-dialog textarea').fill('资料不全，请补充检测报告')
    await page.locator('.el-dialog button', { hasText: '确认' }).click()
    await page.waitForTimeout(1200)
    const rejectedStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_product WHERE id = '${pendingProductA}'`)
    const rejectedLog = sql(`SELECT action FROM agri_s2b2c.s2b2c_product_audit_log WHERE product_id = '${pendingProductA}' ORDER BY create_time DESC LIMIT 1`)
    check(rejectedStatus === 'REJECTED' && rejectedLog === 'REJECTED', '商品拒绝原因与审核留痕', `status=${rejectedStatus} log=${rejectedLog}`)

    await page.locator('input[placeholder="搜索商品名称"]').fill(pendingNameB)
    await page.locator('button', { hasText: '查询' }).click()
    await page.waitForTimeout(900)
    await page.locator('tr', { hasText: pendingNameB }).first().locator('.el-checkbox').first().click()
    await page.locator('button', { hasText: '批量通过' }).click()
    await page.waitForTimeout(600)
    await page.locator('.el-dialog button', { hasText: '确认通过' }).click()
    await page.waitForTimeout(1200)
    const approvedStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_product WHERE id = '${pendingProductB}'`)
    const approvedLog = sql(`SELECT action FROM agri_s2b2c.s2b2c_product_audit_log WHERE product_id = '${pendingProductB}' ORDER BY create_time DESC LIMIT 1`)
    check(approvedStatus === 'APPROVED' && approvedLog === 'APPROVED', '商品批量通过并留痕', `status=${approvedStatus} log=${approvedLog}`)
    await page.screenshot({ path: path.join(OUT, '08-product-audit.png'), fullPage: false })

    await page.goto(`${APP}/suppliers`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    await page.locator('input[placeholder="搜索公司名称"]').fill('运营点检供应商')
    await page.locator('input[placeholder="搜索公司名称"]').press('Enter')
    await page.waitForTimeout(900)
    const supplierRow = page.locator('tr', { hasText: '运营点检供应商' }).first()
    check(await supplierRow.count() > 0, '供应商管理列出待审供应商')
    await supplierRow.locator('button', { hasText: '审核' }).click()
    await page.waitForSelector('.el-dialog', { timeout: 10000 })
    await page.locator('.el-dialog button', { hasText: '确认' }).click()
    await page.waitForTimeout(1300)
    const supplierAuditStatus = sql(`SELECT audit_status FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
    check(supplierAuditStatus === 'APPROVED', '供应商审核通过落库', supplierAuditStatus)

    await page.goto(`${APP}/channel-onboard`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('运营点检待审渠道'), '入驻审核列出待审渠道')
    await page.locator('tr', { hasText: '运营点检待审渠道' }).first().locator('button', { hasText: '通过' }).click()
    await page.waitForSelector('.el-message-box__input input', { timeout: 10000 })
    await page.locator('.el-message-box__input input').fill('点检通过')
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const pendingAudit = sql(`SELECT audit_status FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${pendingChannelId}'`)
    check(pendingAudit === 'APPROVED', '入驻审核落库', `audit=${pendingAudit}`)

    await page.goto(`${APP}/channel-partners`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('渠道商列表与分层') && text.includes('30 天 GMV'), '渠道列表展示经营绩效')
    check(text.includes('运营点检渠道店'), '渠道列表含新渠道')
    await page.locator('tr', { hasText: '运营点检渠道店' }).first().locator('button', { hasText: '详情' }).click()
    await page.waitForTimeout(1300)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    const detailCanvas = await page.locator('canvas').count()
    check(text.includes('渠道商详情') && text.includes('近 30 天 GMV') && detailCanvas > 0, '渠道详情展示绩效与走势图')
    check(text.includes(productName) && text.includes('佣金与提现'), '渠道详情含热销商品与佣金概况')
    await page.screenshot({ path: path.join(OUT, '03-channel-detail.png'), fullPage: false })

    await page.goto(`${APP}/fulfillment`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    check((await page.evaluate(() => document.body.innerText)).includes(orderNo), '履约调度含待发货订单', orderNo)
    await page.locator('tr', { hasText: orderNo }).first().locator('button', { hasText: '发货' }).click()
    await page.waitForSelector('.el-dialog input[placeholder*="电子面单号"]', { timeout: 10000 })
    await page.locator('.el-dialog input[placeholder*="电子面单号"]').fill(`SF-OPS-${Date.now()}`)
    await page.locator('.el-dialog button', { hasText: '确认发货' }).click()
    await page.waitForTimeout(1400)
    const shipped = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    check(shipped === 'SHIPPED', '履约调度发货落库', `status=${shipped}`)

    await page.goto(`${APP}/after-sales`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(orderNo) && text.includes('运营点检售后'), '异常与售后含工单')
    await page.locator('tr', { hasText: orderNo }).first().locator('button', { hasText: '同意' }).click()
    await page.waitForSelector('.el-message-box__input input', { timeout: 10000 })
    await page.locator('.el-message-box__input input').fill('平台复核同意')
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const afterSaleStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_after_sale WHERE order_id = '${orderId}'`)
    check(afterSaleStatus === 'APPROVED', '售后复核落库', `status=${afterSaleStatus}`)

    await page.goto(`${APP}/reviews`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('评价审核') && text.includes('运营点检评价：包装完整'), '评价审核页展示全量评价')
    await page.locator('tr', { hasText: '运营点检评价：包装完整' }).first().locator('button', { hasText: '隐藏' }).click()
    await page.waitForSelector('.el-message-box__btns button', { timeout: 10000 })
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const platformHidden = sql(`SELECT hidden FROM agri_s2b2c.s2b2c_review WHERE id = '${reviewId}'`)
    check(platformHidden === '1', '平台页面隐藏评价落库', `hidden=${platformHidden}`)
    await page.locator('tr', { hasText: '运营点检评价：包装完整' }).first().locator('button', { hasText: '恢复' }).click()
    await page.waitForSelector('.el-message-box__btns button', { timeout: 10000 })
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const platformRestored = sql(`SELECT hidden FROM agri_s2b2c.s2b2c_review WHERE id = '${reviewId}'`)
    check(platformRestored === '0', '平台页面恢复评价落库', `hidden=${platformRestored}`)
    await page.screenshot({ path: path.join(OUT, '12-reviews.png'), fullPage: false })

    await page.goto(`${APP}/price-center`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    await page.locator('input[placeholder="搜索商品"]').fill(productName)
    await page.locator('button', { hasText: '查询' }).click()
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(productName) && text.includes('低于供货价'), '价盘标记低于供货价', productName)
    await page.locator('button', { hasText: '全量巡检' }).click()
    await page.waitForTimeout(1800)
    const guardShelf = sql(`SELECT shelf_status FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
    const guardLog = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_price_guard_log WHERE product_id = '${productId}' AND trigger_source = 'MANUAL'`)
    check(guardShelf === 'OFF' && guardLog !== '0', '全量巡检自动下架并留痕', `shelf=${guardShelf} logs=${guardLog}`)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('最近巡检记录') && text.includes(productName) && text.includes('手动巡检'),
      '价盘页展示巡检记录')
    await page.screenshot({ path: path.join(OUT, '02-price-center.png'), fullPage: false })

    sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = 1 WHERE id = '${productId}'`)
    await page.goto(`${APP}/inventory`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(productName) && text.includes('库存与云仓'), '库存页展示商品')
    check(text.includes('低库存') && text.includes('7 日销量'), '库存页标记低库存与动销')
    await page.screenshot({ path: path.join(OUT, '05-inventory.png'), fullPage: false })

    await page.goto(`${APP}/risk-events`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('风控事件') && text.includes(productName), '风控事件含低价销售信号', productName)
    check(text.includes(orderNo) && text.includes('人工复核'), '风控事件含秒拍秒退与复核说明', orderNo)
    const riskEvents = await (await fetch(`${S2B2C}/api/platform/risk-events`, { headers: auth })).json()
    riskEventKey = (riskEvents?.records ?? []).find((row) => row.handleStatus === 'PENDING')?.eventKey ?? ''
    check(Boolean(riskEventKey), '风控事件可人工处置', riskEventKey)
    await page.locator('button', { hasText: '标记复核' }).first().click()
    await page.waitForSelector('.el-message-box__input input', { timeout: 10000 })
    await page.locator('.el-message-box__input input').fill('点检复核完成')
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const handledStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_risk_event_action WHERE event_key = '${riskEventKey}'`)
    check(handledStatus === 'HANDLED', '风控处置留痕落库', `status=${handledStatus}`)
    text = (await page.evaluate(() => document.body.innerText)).replace(/s+/g, ' ')
    check(text.includes('已复核'), '风控事件显示已复核')
    await page.screenshot({ path: path.join(OUT, '07-risk-events.png'), fullPage: false })

    await page.goto(`${APP}/risk-rules`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    const quickRuleRow = page.locator('tr', { hasText: '支付后 X 分钟内申请售后' }).first()
    await quickRuleRow.locator('input').first().fill('6')
    await quickRuleRow.locator('button', { hasText: '保存' }).click()
    await page.waitForTimeout(1200)
    const ruleThreshold = sql(`SELECT threshold FROM agri_s2b2c.s2b2c_risk_rule WHERE code = 'QUICK_REFUND'`)
    check(Number(ruleThreshold) === 6, '风控规则阈值落库', `threshold=${ruleThreshold}`)
    await fetch(`${S2B2C}/api/platform/risk-rules/QUICK_REFUND`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ threshold: 5, status: 'ACTIVE' }),
    })

    await page.goto(`${APP}/settlement`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    await page.locator('input[placeholder*="渠道 ID"]').fill(channelId)
    await page.locator('button', { hasText: '批量结算待结算佣金' }).click()
    await page.waitForTimeout(1600)
    const batch = sql(`SELECT batch_no FROM agri_s2b2c.s2b2c_commission_settlement WHERE channel_id = '${channelId}' ORDER BY id DESC LIMIT 1`)
    check(Boolean(batch) && batch !== '', '分润结算生成批次', `batch=${batch}`)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(batch), '结算批次列表展示批次号')

    await page.goto(`${APP}/commission-report`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(orderNo), '佣金报表含本单佣金', orderNo)

    await page.goto(`${APP}/commission-rules`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('等级考核规则') && text.includes('立即考核'), '佣金页展示等级考核规则与立即考核')

    await page.goto(`${APP}/supplier-statements`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('供应商对账单') && text.includes('生成对账单'), '供应商对账单页渲染')

    await page.goto(`${APP}/activities`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('活动列表') && text.includes('优惠券'), '活动列表渲染')
    await page.goto(`${APP}/coupons`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('优惠券管理'), '优惠券页渲染')

    await page.goto(`${APP}/activity-create`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    await page.locator('.el-form-item', { hasText: '名称' }).locator('input').first().fill(couponName)
    await page.locator('.el-form-item', { hasText: '面额(元)' }).locator('input').first().fill('6')
    await page.locator('.el-form-item', { hasText: '使用门槛(元)' }).locator('input').first().fill('30')
    await page.locator('.el-form-item', { hasText: '活动预算(元)' }).locator('input').first().fill('100')
    await page.locator('button', { hasText: '创建优惠券' }).click()
    await page.waitForTimeout(1500)
    activityCouponId = sql(`SELECT id FROM agri_s2b2c.s2b2c_coupon WHERE name = '${couponName}' ORDER BY create_time DESC LIMIT 1`)
    check(Boolean(activityCouponId), '运营端创建优惠券落库', `id=${activityCouponId}`)
    const couponBudget = sql(`SELECT CONCAT(budget,'|',cost_bearer) FROM agri_s2b2c.s2b2c_coupon WHERE id='${activityCouponId}'`)
    check(couponBudget === '100.00|PLATFORM', '券预算与承担方落库', couponBudget)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(couponName) && text.includes('预算/已用'), '创建后活动列表展示新券与预算')
    await page.locator('tr', { hasText: couponName }).first().locator('button', { hasText: '结束' }).click()
    await page.waitForSelector('.el-message-box__btns button', { timeout: 10000 })
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const couponStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_coupon WHERE id = '${activityCouponId}'`)
    check(couponStatus === 'ENDED', '优惠券结束状态落库', `status=${couponStatus}`)

    const flashRes = await (await fetch(`${S2B2C}/api/platform/flash-sales`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, salePrice: 1, totalStock: 5, perUserLimit: 1,
        startTime: '2026-01-01 00:00:00', endTime: '2030-12-31 23:59:59',
        budget: 100, costBearer: 'PLATFORM' }),
    })).json()
    activityFlashId = String(flashRes?.id ?? '')
    check(flashRes?.success === true && Boolean(activityFlashId), '创建秒杀活动', String(flashRes?.message ?? ''))
    const flashBudget = sql(`SELECT CONCAT(budget,'|',cost_bearer) FROM agri_s2b2c.s2b2c_flash_sale WHERE id='${activityFlashId}'`)
    check(flashBudget === '100.00|PLATFORM', '秒杀预算与承担方落库', flashBudget)
    const groupRes = await (await fetch(`${S2B2C}/api/platform/group-buys`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: groupName, productId, singlePrice: 12.8, groupPrice: 9.9,
        groupSize: 3, perUserLimit: 1, validHours: 24,
        startTime: '2026-01-01 00:00:00', endTime: '2030-12-31 23:59:59',
        budget: 200, costBearer: 'SUPPLIER' }),
    })).json()
    activityGroupId = String(groupRes?.id ?? '')
    check(groupRes?.success === true && Boolean(activityGroupId), '创建拼团活动', String(groupRes?.message ?? ''))
    const groupBudget = sql(`SELECT CONCAT(budget,'|',cost_bearer) FROM agri_s2b2c.s2b2c_group_buy WHERE id='${activityGroupId}'`)
    check(groupBudget === '200.00|SUPPLIER', '拼团预算与承担方落库', groupBudget)
    const marketing = await (await fetch(`${S2B2C}/api/consumer/marketing`, { headers: auth })).json()
    check((marketing?.flashSales ?? []).some((row) => String(row.id) === activityFlashId), '消费者端可见新建秒杀')
    check((marketing?.groupBuys ?? []).some((row) => String(row.id) === activityGroupId), '消费者端可见新建拼团')
    const flashMonitor = await (await fetch(`${S2B2C}/api/platform/activities/FLASH/${activityFlashId}/monitor`, {
      headers: auth,
    })).json()
    check(Number(flashMonitor?.metrics?.orderCount ?? 0) >= 1
      && String(flashMonitor?.attribution ?? '').includes('近似'), '秒杀监控按时间窗归因',
      `orders=${flashMonitor?.metrics?.orderCount} gmv=${flashMonitor?.metrics?.gmv}`)

    await page.goto(`${APP}/activity-monitor`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(700)
    await page.locator('.el-tabs__item', { hasText: '秒杀' }).click()
    await page.waitForTimeout(700)
    await page.locator('tr', { hasText: productName }).first().locator('button', { hasText: '监控' }).click()
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('关联订单') && text.includes(orderNo) && text.includes('近似'), '活动监控弹窗展示归因与订单')
    await page.screenshot({ path: path.join(OUT, '06-activity-monitor.png'), fullPage: false })
    await page.locator('.el-dialog__headerbtn').last().click().catch(() => {})
    await page.locator('.el-tabs__item', { hasText: '优惠券' }).first().click()
    await page.waitForTimeout(600)
    await page.locator('tr', { hasText: couponName }).first().locator('button', { hasText: '监控' }).click()
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('券优惠金额') && text.includes('coupon_user_id')
      && text.includes('活动预算') && text.includes('预算已用'), '券监控展示优惠金额、预算与归因口径')
    await page.locator('.el-dialog__headerbtn').last().click().catch(() => {})
    await page.goto(`${APP}/activities`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(700)
    await page.locator('.el-tabs__item', { hasText: '拼团' }).click()
    await page.waitForTimeout(700)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(groupName), '活动列表展示新建拼团')
    await page.locator('.el-tabs__item', { hasText: '秒杀' }).click()
    await page.waitForTimeout(700)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(productName), '活动列表展示新建秒杀')

    await page.goto(`${APP}/boundary`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('模块边界与协同说明') && text.includes('交易撮合') && text.includes('城市合伙人'), '模块边界页展示协同关系')

    await page.goto(`${APP}/gap/inventory`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('库存与云仓') && text.includes('能力未接入'), '未接入页明确缺口')

    check(pageErrors.length === 0, '页面无运行时异常', pageErrors.slice(0, 2).join(' | '))
  } finally {
    await browser.close()
  }
} finally {
  if (reviewId) sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE id = '${reviewId}'`)
  if (orderId) sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE order_id = '${orderId}' AND content LIKE '运营点检评价%'`)
  if (orderId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_after_sale WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  }
  if (channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_commission_settlement WHERE channel_id = '${channelId}'`)
  if (cartId) sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${cartId}'`)
  if (addressId) sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${addressId}'`)
  if (relationId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
  if (created.product && productId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_price_guard_log WHERE product_id = '${productId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`)
  }
  if (created.channel && channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  if (created.supplier && supplierId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
  if (identityId) sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${identityId}'`)
  if (activityCouponId) sql(`DELETE FROM agri_s2b2c.s2b2c_coupon WHERE id = '${activityCouponId}'`)
  if (activityFlashId) sql(`DELETE FROM agri_s2b2c.s2b2c_flash_sale WHERE id = '${activityFlashId}'`)
  if (activityGroupId) sql(`DELETE FROM agri_s2b2c.s2b2c_group_buy WHERE id = '${activityGroupId}'`)
  if (riskEventKey) sql(`DELETE FROM agri_s2b2c.s2b2c_risk_event_action WHERE event_key = '${riskEventKey}'`)
  if (pendingProductA) sql(`DELETE FROM agri_s2b2c.s2b2c_product_audit_log WHERE product_id = '${pendingProductA}'`)
  if (pendingProductB) sql(`DELETE FROM agri_s2b2c.s2b2c_product_audit_log WHERE product_id = '${pendingProductB}'`)
  if (pendingProductA) sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${pendingProductA}'`)
  if (pendingProductB) sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${pendingProductB}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${pendingChannelId}'`)
  console.log(`\n清理：order=${orderId ? 1 : 0} pendingChannel=1 supplier=${created.supplier ? 1 : 0} channel=${created.channel ? 1 : 0} product=${created.product ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
