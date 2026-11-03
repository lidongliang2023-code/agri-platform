/**
 * 渠道商端全页面点检：造一条真实渠道订单 → 浏览器逐页校验（看板/订单/履约/售后/客户/资金/分析/设置/边界）。
 * 用法：node scripts/check-channel-ops-ui.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
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
const APP = 'http://localhost:8085'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'channel-ops-20261030')
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
let marketingFlashId = ''
const created = { supplier: false, channel: false, product: false }
const productName = `渠道经营点检商品${Date.now() % 10000}`
const orderNoSql = []

try {
  // 1) 造渠道与商品
  const identityCount = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE user_id = '${adminId}' AND identity_type = 'wholesaler' AND status = 'approved'`)
  if (identityCount === '0' || identityCount === '') {
    const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ identityType: 'wholesaler', subjectName: '渠道经营点检主体' }),
    })).json()
    identityId = applied?.data?.id ?? ''
    await fetch(`${CORE}/api/v1/admin/identity-applications/${identityId}/review`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true, remark: 'channel ops check' }),
    })
  }

  const supplierProfile = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  if (supplierProfile?.applied) {
    supplierId = String(supplierProfile.id)
  } else {
    await fetch(`${S2B2C}/api/supplier/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: '渠道经营点检供应商', creditCode: '91320100OPS0001X', contactPhone: '13800000000' }),
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

  const channelProfile = await (await fetch(`${S2B2C}/api/channel/profile`, { headers: auth })).json()
  if (channelProfile?.applied) {
    channelId = String(channelProfile.id)
    if (channelProfile.auditStatus !== 'APPROVED') {
      await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, { method: 'PUT', headers: auth })
    }
  } else {
    await fetch(`${S2B2C}/api/channel/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: '渠道经营点检', contactPhone: '13800000000', shopName: '渠道经营点检店', shopDesc: '点检店铺' }),
    })
    channelId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    created.channel = true
    await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, { method: 'PUT', headers: auth })
  }
  await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, { method: 'POST', headers: auth })
  relationId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}' LIMIT 1`)
  const shopName = sql(`SELECT shop_name FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  check(Boolean(channelId && productId && relationId), '造好渠道与在架商品', `channel=${channelId}`)
  const marketingFlash = await (await fetch(`${S2B2C}/api/platform/flash-sales`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, salePrice: 1, totalStock: 5, perUserLimit: 1,
      startTime: '2026-01-01 00:00:00', endTime: '2030-12-31 23:59:59' }),
  })).json()
  marketingFlashId = String(marketingFlash?.id ?? '')
  check(marketingFlash?.success === true, '造好本店商品秒杀活动')

  // 2) 造渠道订单：消费者建档 → 地址 → 渠道加购 → 下单 → 支付
  const consumer = await (await fetch(`${S2B2C}/api/consumer/profile`, { headers: auth })).json()
  consumerId = String(consumer?.id ?? '')
  await fetch(`${S2B2C}/api/consumer/address/add`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, name: '点检买家', phone: '13900001111', province: '广东省', city: '广州市', district: '天河区', address: '点检路 1 号', isDefault: true, status: 'ACTIVE' }),
  })
  addressId = sql(`SELECT id FROM agri_s2b2c.s2b2c_address WHERE consumer_id = '${consumerId}' ORDER BY id DESC LIMIT 1`)
  await fetch(`${S2B2C}/api/consumer/cart/add?consumerId=${consumerId}&productId=${productId}&quantity=2&channelId=${channelId}`, { method: 'POST', headers: auth })
  cartId = sql(`SELECT id FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${consumerId}' AND product_id = '${productId}' ORDER BY id DESC LIMIT 1`)
  const orderRes = await (await fetch(`${S2B2C}/api/consumer/order/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, addressId }),
  })).json()
  const orderIds = orderRes?.orderIds ?? []
  orderId = String(orderIds[0] ?? '')
  check(orderRes?.success === true && Boolean(orderId), '造好渠道订单', `order=${orderId}`)
  await fetch(`${S2B2C}/api/consumer/order/pay/${orderId}`, { method: 'PUT', headers: auth })
  const orderNo = sql(`SELECT order_no FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  orderNoSql.push(orderNo)
  sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE order_id = '${orderId}' AND product_id = '${productId}'`)
  reviewId = String(Date.now())
  sql(`INSERT INTO agri_s2b2c.s2b2c_review
       (id,order_id,product_id,consumer_id,rating,content,anonymous,create_time)
       VALUES ('${reviewId}','${orderId}','${productId}','${consumerId}',4,'UI点检评价：渠道服务不错',TRUE,NOW())`)
  const afterSaleCreated = await (await fetch(`${S2B2C}/api/consumer/after-sales`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, orderId, type: 'REFUND', reason: '点检售后：包装破损', amount: 5 }),
  })).json()

  // 3) 浏览器逐页点检
  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } })
  const cookiePairs = cookie.split('; ').map((x) => x.split('='))
  await context.addCookies(cookiePairs.map(([name, ...rest]) => ({
    name, value: rest.join('='), domain: 'localhost', path: '/',
  })))
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 120)))

  try {
    await page.goto(`${APP}/`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1200)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('经营看板') && text.includes('今日销售额'), '经营看板渲染')
    check(['选品与商品', '订单与履约', '资金结算', '模块边界与协同'].every((label) => text.includes(label)), '侧栏按原型 IA 分组')
    await page.screenshot({ path: path.join(OUT, '01-dashboard.png'), fullPage: false })

    await page.goto(`${APP}/orders`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(orderNo), '订单列表含新订单', orderNo)
    await page.locator('tr', { hasText: orderNo }).first().locator('button', { hasText: '详情' }).click()
    await page.waitForTimeout(1200)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('订单详情') && text.includes(productName), '订单详情含商品明细')
    check(text.includes('点检买家'), '订单详情含收货信息')
    await page.screenshot({ path: path.join(OUT, '02-order-detail.png'), fullPage: false })

    await page.goto(`${APP}/fulfillment`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(orderNo) && text.includes('待发货'), '履约台含待发货订单')
    const row = page.locator('tr', { hasText: orderNo }).first()
    await row.locator('button', { hasText: '一键代发' }).click()
    await page.waitForSelector('.el-dialog input[placeholder*="电子面单号"]', { timeout: 10000 })
    await page.locator('.el-dialog input[placeholder*="电子面单号"]').fill(`SF-UI-${Date.now()}`)
    await page.locator('.el-dialog button', { hasText: '确认发货' }).click()
    await page.waitForTimeout(1600)
    const pendingShipStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    const proposal = sql(`SELECT CONCAT(status,'|',proposer_type) FROM agri_s2b2c.s2b2c_order_shipment WHERE order_id='${orderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
    check(pendingShipStatus === 'PENDING_SHIP' && proposal === 'PROPOSED|CHANNEL', '渠道提交发货待供应商确认',
      `order=${pendingShipStatus} proposal=${proposal}`)
    const confirmed = await (await fetch(`${S2B2C}/api/supplier/order/${orderId}/shipment/confirm`, { method: 'PUT', headers: auth })).json()
    check(confirmed?.success === true, '供应商确认发货', String(confirmed?.message ?? '').slice(0, 20))
    const shipped = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    check(shipped === 'SHIPPED', '双方确认后订单为已发货', `status=${shipped}`)
    const channelNotices = await (await fetch(`${S2B2C}/api/channel/notices?page=1&size=50`, { headers: auth })).json()
    check((channelNotices?.records ?? []).some((row) => row.type === 'SHIP_CONFIRMED' && String(row.refId) === String(orderId)),
      '渠道收到发货确认通知')
    await page.screenshot({ path: path.join(OUT, '03-fulfillment.png'), fullPage: false })

    await page.goto(`${APP}/after-sales`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(orderNo) && text.includes('点检售后：包装破损'), '售后页含本渠道售后单')
    await page.locator('tr', { hasText: orderNo }).first().locator('button', { hasText: '同意' }).click()
    await page.waitForSelector('.el-message-box__input input', { timeout: 10000 })
    await page.locator('.el-message-box__input input').fill('点检同意')
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const afterSaleStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_after_sale WHERE order_id = '${orderId}'`)
    check(afterSaleStatus === 'APPROVED', '售后处理落库', `status=${afterSaleStatus}`)
    await page.screenshot({ path: path.join(OUT, '04-after-sale.png'), fullPage: false })

    await page.goto(`${APP}/reviews`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('评价管理') && text.includes('UI点检评价：渠道服务不错') && text.includes('匿名用户'),
      '评价管理页展示本渠道订单匿名评价')
    await page.locator('tr', { hasText: 'UI点检评价：渠道服务不错' }).first().locator('button', { hasText: '回复' }).click()
    await page.waitForSelector('.el-dialog textarea', { timeout: 10000 })
    await page.locator('.el-dialog textarea').fill('感谢您的支持，期待再次光临')
    await page.locator('.el-dialog button', { hasText: '提交回复' }).click()
    await page.waitForTimeout(1200)
    const channelReviewReplyDb = sql(`SELECT CONCAT(IFNULL(reply,''),'|',IFNULL(reply_by,'')) FROM agri_s2b2c.s2b2c_review WHERE id = '${reviewId}'`)
    check(channelReviewReplyDb === '感谢您的支持，期待再次光临|CHANNEL', '渠道页面回复评价落库', channelReviewReplyDb)
    await page.screenshot({ path: path.join(OUT, '13-reviews.png'), fullPage: false })

    await page.goto(`${APP}/customers`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('客户总数') && !text.includes('当前筛选条件下没有客户'), '客户列表含本渠道客户')
    await page.locator('button', { hasText: '画像' }).first().click()
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('客户画像') && text.includes(orderNo), '客户画像含最近订单')
    await page.screenshot({ path: path.join(OUT, '05-customer.png'), fullPage: false })

    await page.goto(`${APP}/customer-ops`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/s+/g, ' ')
    check(text.includes('客户运营与社群') && text.includes('复购率') && text.includes('高价值客户'), '客户运营页展示分层汇总')
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.locator('button', { hasText: '导出客户名单' }).click(),
    ])
    const downloadPath = await download.path()
    const csv = downloadPath ? readFileSync(downloadPath, 'utf8') : ''
    check(csv.includes('客户ID') && csv.includes('下单次数') && csv.includes(String(consumerId)), '客户名单 CSV 导出', download.suggestedFilename())
    await page.locator('.segment-card', { hasText: '新客' }).first().locator('button', { hasText: '查看名单' }).click()
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(page.url().includes('layer=NEW') && !text.includes('当前筛选条件下没有客户'), '分层名单跳转客户列表', page.url())
    await page.screenshot({ path: path.join(OUT, '11-customer-ops.png'), fullPage: false })

    await page.goto(`${APP}/commissions`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('佣金中心') && text.includes(orderNo), '佣金中心含本单佣金')

    await page.goto(`${APP}/reconcile`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('分润与对账单') && text.includes(orderNo), '月度对账单含本单流水')
    await page.screenshot({ path: path.join(OUT, '06-reconcile.png'), fullPage: false })

    await page.goto(`${APP}/analytics`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1200)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    const hasChart = await page.locator('canvas').count()
    check(text.includes('经营数据分析') && hasChart > 0, '经营分析渲染走势图', `canvas=${hasChart}`)
    await page.screenshot({ path: path.join(OUT, '07-analytics.png'), fullPage: false })

    sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = 1 WHERE id = '${productId}'`)
    await page.goto(`${APP}/inventory`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('库存管理') && text.includes(productName), '渠道库存页展示在架商品')
    check(text.includes('本渠道 7 日销量') && (text.includes('预警') || text.includes('缺货')), '渠道库存页标记动销与预警')
    await page.screenshot({ path: path.join(OUT, '09-inventory.png'), fullPage: false })

    await page.goto(`${APP}/marketing/flash`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('营销中心') && text.includes(productName) && text.includes('秒杀'), '营销中心展示本店可用秒杀', productName)
    await page.goto(`${APP}/marketing/coupons`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(700)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('优惠券') && text.includes('平台券'), '营销中心展示平台券')
    await page.goto(`${APP}/marketing/share`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(700)
    const shareValue = await page.locator('input[readonly]').first().inputValue().catch(() => '')
    check(shareValue.includes('channelId=') && shareValue.includes(channelId), '分享链接带渠道 ID', shareValue)
    await page.screenshot({ path: path.join(OUT, '10-marketing.png'), fullPage: false })

    await page.goto(`${APP}/products`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    const productRow = page.locator('tr', { hasText: productName }).first()
    check(await productRow.count() > 0, '我的货架含已选商品', productName)
    await productRow.locator('button', { hasText: '改价' }).click()
    await page.waitForSelector('.el-dialog input[placeholder*="留空"]', { timeout: 10000 })
    await page.locator('.el-dialog input[placeholder*="留空"]').fill('16.60')
    await page.locator('.el-dialog button', { hasText: '保存' }).click()
    await page.waitForTimeout(1400)
    const retailPrice = sql(`SELECT retail_price FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}'`)
    check(Number(retailPrice) === 16.6, '渠道改价落库', `retail=${retailPrice}`)
    await productRow.locator('button', { hasText: '下架' }).click()
    await page.waitForSelector('.el-message-box__btns button', { timeout: 10000 })
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const shelfOff = sql(`SELECT shelf_status FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}'`)
    check(shelfOff === 'OFF', '渠道下架落库', `shelf=${shelfOff}`)
    await page.locator('tr', { hasText: productName }).first().locator('button', { hasText: '上架' }).click()
    await page.waitForSelector('.el-message-box__btns button', { timeout: 10000 })
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const shelfOn = sql(`SELECT shelf_status FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}'`)
    check(shelfOn === 'ON', '渠道重新上架落库', `shelf=${shelfOn}`)

    await (await fetch(`${S2B2C}/api/supplier/product/${productId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, regionNames: ['浙江省'] }),
    })).json()
    await page.goto(`${APP}/product-pool`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('限售区域') && text.includes('浙江省') && text.includes(productName),
      '商品池展示供应商限售区域')
    await (await fetch(`${S2B2C}/api/supplier/product/${productId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, regionNames: [] }),
    })).json()

    await page.goto(`${APP}/listing`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('商品编辑') && text.includes('渠道零售价'), '商品编辑页渲染')
    await page.screenshot({ path: path.join(OUT, '08-listing.png'), fullPage: false })

    await page.goto(`${APP}/settings`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    const shopValue = await page.locator('input').first().inputValue().catch(() => '')
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('店铺与资质') && shopValue.includes(shopName), '店铺设置回显渠道资料', shopValue)
    check(text.includes('等级考核') && text.includes('当前等级'), '店铺设置展示等级考核与调整记录')

    await page.goto(`${APP}/notice-settings`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/s+/g, ' ')
    check(text.includes('通知设置') && text.includes('新渠道订单'), '渠道通知设置页展示事件开关')
    const channelNoticeRow = page.locator('tr', { hasText: '新订单 / 新渠道订单' }).first()
    await channelNoticeRow.locator('.el-switch').click()
    await page.waitForTimeout(900)
    const channelPref = sql(`SELECT enabled FROM agri_s2b2c.s2b2c_notice_preference WHERE recipient_type='CHANNEL' AND recipient_id='${channelId}' AND notice_type='ORDER_CREATED'`)
    check(channelPref === '0', '渠道关闭新订单通知落库', `enabled=${channelPref}`)
    await channelNoticeRow.locator('.el-switch').click()
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(OUT, '12-notice-settings.png'), fullPage: false })

    await page.goto(`${APP}/boundary`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('模块边界与协同说明') && text.includes('交易撮合') && text.includes('城市合伙人'), '模块边界页展示协同关系')

    await page.goto(`${APP}/gap/ai-selection`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(600)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('AI 智能选品') && text.includes('能力未接入') && text.includes('接入还缺什么'), '未接入页明确缺口')

    check(pageErrors.length === 0, '页面无运行时异常', pageErrors.slice(0, 2).join(' | '))
  } finally {
    await browser.close()
  }
} finally {
  if (reviewId) sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE id = '${reviewId}'`)
  if (orderId) sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE order_id = '${orderId}' AND content LIKE 'UI点检评价%'`)
  if (channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_notice_preference WHERE recipient_type='CHANNEL' AND recipient_id='${channelId}'`)
  if (orderId) sql(`DELETE FROM agri_s2b2c.s2b2c_notice WHERE ref_type = 'ORDER' AND ref_id = '${orderId}'`)
  if (orderId) sql(`DELETE FROM agri_s2b2c.s2b2c_after_sale WHERE order_id = '${orderId}'`)
  if (orderId) sql(`DELETE FROM agri_s2b2c.s2b2c_order_shipment WHERE order_id = '${orderId}'`)
  if (orderId) sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${orderId}'`)
  if (orderId) sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id = '${orderId}'`)
  if (orderId) sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  if (cartId) sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${cartId}'`)
  if (addressId) sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${addressId}'`)
  if (relationId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
  if (created.product && productId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_distribution_region WHERE product_id = '${productId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`)
  }
  if (created.channel && channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  if (created.supplier && supplierId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
  if (identityId) sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${identityId}'`)
  if (marketingFlashId) sql(`DELETE FROM agri_s2b2c.s2b2c_flash_sale WHERE id = '${marketingFlashId}'`)
  console.log(`\n清理：order=${orderId ? 1 : 0} supplier=${created.supplier ? 1 : 0} channel=${created.channel ? 1 : 0} product=${created.product ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
