/**
 * S2B2C 四端交易主链路真实浏览器联调：
 * 消费者下单支付 → 供应商提交发货 → 渠道确认发货 → 消费者确认收货 →
 * 平台批次结算 → 渠道申请提现 → 平台审核打款。
 *
 * 运行前需要 S2B2C(:8088)、核心(:8093)、消费 PC(:8082)、渠道(:8085)、
 * 供应商(:8084)、运营(:8103) 均已启动。
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
    return execFileSync(MYSQL, ['-uroot', '-proot', '-N', '-B', '--default-character-set=utf8mb4', '-e', q],
      { encoding: 'utf8' }).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 100)}`
  }
}
const CORE = 'http://localhost:8093'
const S2 = 'http://localhost:8088'
const CONSUMER = 'http://localhost:8082'
const SUPPLIER = 'http://localhost:8084'
const CHANNEL = 'http://localhost:8085'
const PLATFORM = 'http://localhost:8103'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'four-end-flow-20261031')
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
const session = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
})
const cookie = (session.headers.getSetCookie?.() ?? []).map((x) => x.split(';')[0]).join('; ')
const adminId = sql(`SELECT id FROM agri_core.platform_user WHERE username = 'admin'`)
const consumer = await (await fetch(`${S2}/api/consumer/profile`, { headers: auth })).json()
const consumerId = String(consumer?.id ?? '')

const CART_ID = '990000000000000041'
const ADDRESS_ID = '990000000000000042'
let identityId = ''
let supplierId = ''
let channelId = ''
let productId = ''
let relationId = ''
let orderId = ''
let orderNo = ''
let withdrawalId = ''
let settlementBatch = ''
let accounts = { identityCreated: false, supplierCreated: false, channelCreated: false }
let previousDefaultId = ''
let previousSelected = []
let stockSnapshot = null

const openApp = async (page, url) => {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1200)
  const port = new URL(url).port
  if (!page.url().includes(`:${port}`)) {
    await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
    await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 }).catch(() => {})
    await page.locator('input[placeholder*="用户名"]').first().fill('admin').catch(() => {})
    await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123').catch(() => {})
    await page.locator('button').filter({ hasText: '登' }).first().click().catch(() => {})
    await page.waitForTimeout(3500)
    if (!page.url().includes(`:${port}`)) {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    }
    await page.waitForTimeout(1500)
  }
}

try {
  // ---------- 1) 账号档案与渠道/供应商/商品数据 ----------
  const identityCount = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application
                             WHERE user_id = '${adminId}' AND identity_type = 'wholesaler' AND status = 'approved'`)
  if (identityCount === '0') {
    const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ identityType: 'wholesaler', subjectName: '四端联调供货主体' }),
    })).json()
    identityId = String(applied?.data?.id ?? '')
    if (identityId) {
      await fetch(`${CORE}/api/v1/admin/identity-applications/${identityId}/review`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: true, remark: 'four-end-flow' }),
      })
      accounts.identityCreated = true
    }
  }

  const supplierProfile = await (await fetch(`${S2}/api/supplier/profile`, { headers: auth })).json()
  if (supplierProfile?.applied) {
    supplierId = String(supplierProfile.id)
    if (supplierProfile.auditStatus !== 'APPROVED') {
      await fetch(`${S2}/api/platform/supplier/audit?id=${supplierId}&auditStatus=APPROVED&auditOpinion=flow`,
        { method: 'PUT', headers: auth })
    }
  } else {
    await fetch(`${S2}/api/supplier/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: '四端联调供货企业', creditCode: '91320100FLOW001X',
        contactPhone: '13800000000', shopName: '四端联调供货店' }),
    })
    supplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    accounts.supplierCreated = true
    await fetch(`${S2}/api/platform/supplier/audit?id=${supplierId}&auditStatus=APPROVED&auditOpinion=flow`,
      { method: 'PUT', headers: auth })
  }
  check(Boolean(supplierId), '供应商档案可用', `supplier=${supplierId}`)

  const productCreate = await (await fetch(`${S2}/api/supplier/product/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 1, name: `四端联调商品${Date.now() % 10000}`, price: 26, stock: 10, commissionRate: 8 }),
  })).json()
  productId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id = '${supplierId}' ORDER BY id DESC LIMIT 1`)
  const productName = sql(`SELECT name FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`)
  await fetch(`${S2}/api/platform/product/audit?id=${productId}&status=APPROVED&opinion=flow`,
    { method: 'PUT', headers: auth })
  check(productCreate?.success === true && Boolean(productId), '供应商上架并审核商品', productName)

  const channelProfile = await (await fetch(`${S2}/api/channel/profile`, { headers: auth })).json()
  if (channelProfile?.applied) {
    channelId = String(channelProfile.id)
    if (channelProfile.auditStatus !== 'APPROVED') {
      await fetch(`${S2}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=flow`,
        { method: 'PUT', headers: auth })
    }
  } else {
    await fetch(`${S2}/api/channel/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: '四端联调渠道',
        contactPhone: '13800000000', shopName: '四端联调渠道店' }),
    })
    channelId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    accounts.channelCreated = true
    await fetch(`${S2}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=flow`,
      { method: 'PUT', headers: auth })
  }
  const picked = await (await fetch(`${S2}/api/channel/select-product?channelId=${channelId}&productId=${productId}`,
    { method: 'POST', headers: auth })).json()
  relationId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}' LIMIT 1`)
  check(picked?.success === true && Boolean(relationId), '渠道选中商品建立分销关系', `channel=${channelId}`)

  previousDefaultId = sql(`SELECT id FROM agri_s2b2c.s2b2c_address
                            WHERE consumer_id = '${consumerId}' AND is_default = TRUE ORDER BY id DESC LIMIT 1`)
  if (previousDefaultId.startsWith('ERR')) previousDefaultId = ''
  sql(`UPDATE agri_s2b2c.s2b2c_address SET is_default = FALSE WHERE consumer_id = '${consumerId}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${ADDRESS_ID}'`)
  sql(`INSERT INTO agri_s2b2c.s2b2c_address
       (id,consumer_id,name,phone,province,city,district,address,is_default,status)
       VALUES ('${ADDRESS_ID}','${consumerId}','四端联调买家','13800000000','江苏省','南京市','鼓楼区','联调路 42 号',TRUE,'ACTIVE')`)
  const selectedRows = sql(`SELECT id FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${consumerId}' AND selected = TRUE`)
  previousSelected = selectedRows && !selectedRows.startsWith('ERR')
    ? selectedRows.split('\n').map((row) => row.trim()).filter(Boolean) : []
  sql(`UPDATE agri_s2b2c.s2b2c_cart SET selected = FALSE WHERE consumer_id = '${consumerId}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${CART_ID}'`)
  sql(`INSERT INTO agri_s2b2c.s2b2c_cart (id,consumer_id,shop_id,product_id,quantity,selected,channel_id)
       VALUES ('${CART_ID}','${consumerId}',1,'${productId}',1,TRUE,'${channelId}')`)
  stockSnapshot = {
    stock: sql(`SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`),
    sales: sql(`SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`),
  }

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 120)))
  try {
    // ---------- 2) 消费者下单并支付 ----------
    await openApp(page, `${CONSUMER}/order/confirm`)
    await page.waitForTimeout(1200)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('确认订单') && text.includes(productName), '消费者确认订单页展示商品', text.slice(0, 40))
    await page.locator('button', { hasText: '提交订单' }).first().click()
    await page.waitForTimeout(2200)
    orderId = sql(`SELECT id FROM agri_s2b2c.s2b2c_order
                   WHERE consumer_id = '${consumerId}' AND supplier_id = '${supplierId}' AND channel_id = '${channelId}'
                   ORDER BY create_time DESC, id DESC LIMIT 1`)
    orderNo = sql(`SELECT order_no FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    check(Boolean(orderId) && !orderId.startsWith('ERR'), '消费者提交订单成功', orderNo)
    if (!page.url().includes('/pay/')) {
      await page.goto(`${CONSUMER}/pay/${orderId}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
      await page.waitForTimeout(900)
    }
    await page.locator('button', { hasText: '确认支付' }).first().click()
    await page.waitForTimeout(2000)
    const paidStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    check(paidStatus === 'PENDING_SHIP', '消费者支付后订单进入待发货', paidStatus)

    // ---------- 3) 供应商提交发货 ----------
    await openApp(page, `${SUPPLIER}/orders`)
    await page.waitForTimeout(900)
    const supplierRow = page.locator('tr', { hasText: orderNo }).first()
    check(await supplierRow.count() > 0, '供应商订单列表显示新订单', orderNo)
    await supplierRow.locator('button', { hasText: '提交发货' }).click()
    await page.waitForSelector('.el-dialog input[placeholder*="电子面单"]', { timeout: 10000 })
    await page.locator('.el-dialog input[placeholder*="电子面单"]').fill(`SF${Date.now()}`)
    await page.locator('.el-dialog button', { hasText: '确认发货' }).click()
    await page.waitForTimeout(1500)
    const proposal = sql(`SELECT CONCAT(status,'|',proposer_type) FROM agri_s2b2c.s2b2c_order_shipment
                          WHERE order_id = '${orderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
    check(proposal === 'PROPOSED|SUPPLIER', '供应商提交发货待渠道确认', proposal)

    // ---------- 4) 渠道确认发货 ----------
    await openApp(page, `${CHANNEL}/orders`)
    await page.waitForTimeout(900)
    const channelRow = page.locator('tr', { hasText: orderNo }).first()
    check(await channelRow.count() > 0, '渠道订单列表显示新订单', orderNo)
    await channelRow.locator('button', { hasText: '详情' }).click()
    await page.waitForTimeout(1300)
    await page.locator('button', { hasText: '确认发货' }).first().click()
    await page.waitForTimeout(1800)
    const shippedStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    check(shippedStatus === 'SHIPPED', '渠道确认后订单为已发货', shippedStatus)

    // ---------- 5) 消费者确认收货 ----------
    await openApp(page, `${CONSUMER}/orders`)
    await page.waitForTimeout(900)
    const consumerRow = page.locator('.order-card', { hasText: orderNo }).first()
    check(await consumerRow.count() > 0, '消费者订单列表显示已发货订单', orderNo)
    await consumerRow.locator('button', { hasText: '确认收货' }).click()
    await page.waitForSelector('.el-message-box__btns button', { timeout: 10000 })
    await page.locator('.el-message-box__btns button', { hasText: '确认收货' }).click()
    await page.waitForTimeout(1800)
    const completed = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    check(completed === 'COMPLETED', '消费者确认收货后订单已完成', completed)

    // ---------- 6) 平台批次结算佣金 ----------
    await openApp(page, `${PLATFORM}/settlement`)
    await page.waitForTimeout(900)
    await page.locator('input[placeholder*="渠道 ID"]').fill(channelId)
    await page.locator('button', { hasText: '批量结算待结算佣金' }).click()
    await page.waitForTimeout(1800)
    settlementBatch = sql(`SELECT batch_no FROM agri_s2b2c.s2b2c_commission_settlement
                           WHERE channel_id = '${channelId}' ORDER BY id DESC LIMIT 1`)
    const commissionStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${orderId}'`)
    check(Boolean(settlementBatch) && commissionStatus === 'SETTLED', '平台批次结算佣金', `${settlementBatch} ${commissionStatus}`)

    // ---------- 7) 渠道申请提现 ----------
    await openApp(page, `${CHANNEL}/wallet`)
    await page.waitForTimeout(1200)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('可提现余额'), '渠道钱包展示已结算余额')
    await page.locator('button', { hasText: '申请提现' }).click()
    await page.waitForSelector('.el-message-box__input input', { timeout: 10000 })
    await page.locator('.el-message-box__input input').fill('0.01')
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1500)
    withdrawalId = sql(`SELECT id FROM agri_s2b2c.s2b2c_commission_withdrawal
                        WHERE channel_id = '${channelId}' ORDER BY apply_time DESC, id DESC LIMIT 1`)
    const withdrawalStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE id = '${withdrawalId}'`)
    check(Boolean(withdrawalId) && withdrawalStatus === 'PENDING', '渠道提交提现申请', withdrawalId)

    // ---------- 8) 平台审核并打款 ----------
    await openApp(page, `${PLATFORM}/withdrawals`)
    await page.waitForTimeout(1200)
    const withdrawalRow = page.locator('tr', { hasText: '四端联调渠道' }).first()
    check(await withdrawalRow.count() > 0, '平台提现页显示渠道申请')
    await withdrawalRow.locator('button', { hasText: '通过' }).click()
    await page.waitForTimeout(1500)
    const approved = sql(`SELECT status FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE id = '${withdrawalId}'`)
    check(approved === 'APPROVED', '平台审核通过提现', approved)
    const paidRow = page.locator('tr', { hasText: '四端联调渠道' }).first()
    await paidRow.locator('button', { hasText: '标记已打款' }).click()
    await page.waitForSelector('.el-message-box__input input', { timeout: 10000 })
    await page.locator('.el-message-box__input input').fill(`PAY${Date.now()}`)
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1500)
    const paid = sql(`SELECT CONCAT(status,'|',IFNULL(payout_no,'')) FROM agri_s2b2c.s2b2c_commission_withdrawal
                      WHERE id = '${withdrawalId}'`)
    check(paid.startsWith('PAID|'), '平台登记打款流水并完成提现', paid)

    // ---------- 9) 四端结果页 ----------
    await openApp(page, `${SUPPLIER}/revenue`)
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(productName), '供应商收入页包含本单商品', productName)
    await openApp(page, `${PLATFORM}/orders`)
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(orderNo), '运营订单页可见完成订单', orderNo)
    check(pageErrors.length === 0, '四端浏览器无运行时异常', pageErrors.slice(0, 2).join(' '))
    await page.screenshot({ path: path.join(OUT, 'four-end-flow.png'), fullPage: false })
  } finally {
    await browser.close()
  }
} finally {
  if (withdrawalId) sql(`DELETE FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE id = '${withdrawalId}'`)
  if (channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_commission_settlement WHERE channel_id = '${channelId}'`)
  if (orderId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_shipment WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  }
  if (relationId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
  if (productId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_distribution_region WHERE product_id = '${productId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`)
  }
  sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${CART_ID}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${ADDRESS_ID}'`)
  if (previousDefaultId) sql(`UPDATE agri_s2b2c.s2b2c_address SET is_default = TRUE WHERE id = '${previousDefaultId}'`)
  for (const id of previousSelected) sql(`UPDATE agri_s2b2c.s2b2c_cart SET selected = TRUE WHERE id = '${id}'`)
  if (accounts.channelCreated && channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  if (accounts.supplierCreated && supplierId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
  if (accounts.identityCreated && identityId) {
    sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${identityId}'`)
  }
  console.log(`\n清理：supplier=${accounts.supplierCreated ? 1 : 0} channel=${accounts.channelCreated ? 1 : 0} identity=${accounts.identityCreated ? 1 : 0} order=${orderId ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log(`  - ${item}`))
process.exit(1)