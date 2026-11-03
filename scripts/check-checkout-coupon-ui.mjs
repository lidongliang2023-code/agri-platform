/**
 * 消费端结算优惠券点检：造券/地址/购物车 → 浏览器选择优惠券并提交订单 → 校验订单折扣与券状态。
 * 用法：node scripts/check-checkout-coupon-ui.mjs
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
const APP = 'http://localhost:8082'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'checkout-coupon-20261030')
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

const ADDRESS_ID = '990000000000000021'
const CART_ID = '990000000000000022'
let consumerId = ''
let couponId = ''
let couponUserId = ''
let orderId = ''
let previousDefaultId = ''
let previousSelected = []
let stockSnapshot = null

try {
  const profile = await (await fetch(`${S2B2C}/api/consumer/profile`, { headers: auth })).json()
  consumerId = String(profile?.id ?? '')
  check(Boolean(consumerId), '读取消费者档案', `consumer=${consumerId}`)

  const pad = (n) => String(n).padStart(2, '0')
  const dayText = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const coupon = await (await fetch(`${S2B2C}/api/platform/coupons`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: `点检满减券${Date.now() % 10000}`, type: 'FIXED', amount: 5, minAmount: 1,
      totalCount: 5, perUserLimit: 1,
      validStart: dayText(new Date()), validEnd: dayText(new Date(Date.now() + 7 * 86400000)),
    }),
  })).json()
  couponId = String(coupon?.id ?? '')
  check(coupon?.success === true && Boolean(couponId), '创建点检优惠券', couponId)
  const received = await (await fetch(
    `${S2B2C}/api/consumer/coupon/receive?consumerId=${consumerId}&couponId=${couponId}`,
    { method: 'POST', headers: auth })).json()
  const couponRows = await (await fetch(`${S2B2C}/api/consumer/coupons?consumerId=${consumerId}`, { headers: auth })).json()
  const couponUser = (couponRows ?? []).find((row) => String(row.couponId) === couponId
    && String(row.status).toUpperCase() === 'UNUSED')
  couponUserId = String(couponUser?.id ?? '')
  check(received?.success === true && Boolean(couponUserId), '领取点检优惠券', `id=${couponUserId}`)

  previousDefaultId = sql(`SELECT id FROM agri_s2b2c.s2b2c_address
                            WHERE consumer_id = '${consumerId}' AND is_default = TRUE ORDER BY id DESC LIMIT 1`)
  if (previousDefaultId.startsWith('ERR')) previousDefaultId = ''
  sql(`UPDATE agri_s2b2c.s2b2c_address SET is_default = FALSE WHERE consumer_id = '${consumerId}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${ADDRESS_ID}'`)
  sql(`INSERT INTO agri_s2b2c.s2b2c_address
       (id, consumer_id, name, phone, province, city, district, address, is_default, status)
       VALUES ('${ADDRESS_ID}', '${consumerId}', '券点检', '13800009999', '江苏省', '南京市', '鼓楼区', '券点检路 21 号', TRUE, 'ACTIVE')`)

  const selectedRows = sql(`SELECT id FROM agri_s2b2c.s2b2c_cart
                             WHERE consumer_id = '${consumerId}' AND selected = TRUE`)
  previousSelected = selectedRows && !selectedRows.startsWith('ERR')
    ? selectedRows.split('\n').map((row) => row.trim()).filter(Boolean)
    : []
  sql(`UPDATE agri_s2b2c.s2b2c_cart SET selected = FALSE WHERE consumer_id = '${consumerId}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${CART_ID}'`)
  sql(`INSERT INTO agri_s2b2c.s2b2c_cart (id, consumer_id, shop_id, product_id, quantity, selected, channel_id)
       VALUES ('${CART_ID}', '${consumerId}', 2, 3, 1, TRUE, NULL)`)
  stockSnapshot = {
    stock: sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3'),
    sales: sql('SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = 3'),
  }

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  try {
    await page.goto(`${APP}/order/confirm`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1200)
    if (!page.url().includes(':8082')) {
      await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
      await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 }).catch(() => {})
      await page.locator('input[placeholder*="用户名"]').first().fill('admin').catch(() => {})
      await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123').catch(() => {})
      await page.locator('button').filter({ hasText: '登' }).first().click().catch(() => {})
      await page.waitForURL(/localhost:8082/, { timeout: 30000 }).catch(() => {})
      await page.goto(`${APP}/order/confirm`, { waitUntil: 'networkidle', timeout: 60000 })
      await page.waitForTimeout(1500)
    }
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('确认订单') && text.includes('优惠券'), '结算页展示优惠券入口', text.slice(0, 50))

    await page.locator('.coupon-select').click()
    await page.waitForTimeout(500)
    const optionText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(optionText.includes('点检满减券'), '优惠券下拉展示可用券')
    await page.locator('.el-select-dropdown__item', { hasText: '点检满减券' }).first().click()
    await page.waitForTimeout(700)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('-¥5.00') && text.includes('¥33.00'), '页面按券展示优惠与应付', text.slice(-60))

    await page.locator('button', { hasText: '提交订单' }).first().click()
    await page.waitForTimeout(2200)
    orderId = sql(`SELECT id FROM agri_s2b2c.s2b2c_order
                   WHERE consumer_id = '${consumerId}' AND coupon_user_id = '${couponUserId}'
                   ORDER BY create_time DESC, id DESC LIMIT 1`)
    check(!orderId.startsWith('ERR') && Boolean(orderId), '结算页提交订单成功', `order=${orderId}`)
    if (orderId && !orderId.startsWith('ERR')) {
      const moneyRow = sql(`SELECT CONCAT(discount_amount,'|',pay_amount,'|',coupon_discount)
                            FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
      check(moneyRow === '5.00|33.00|5.00', '订单优惠与应付金额落库正确', moneyRow)
      const used = sql(`SELECT status FROM agri_s2b2c.s2b2c_coupon_user WHERE id = '${couponUserId}'`)
      check(used === 'USED', '优惠券标记已使用', used)
    }
    await page.screenshot({ path: path.join(OUT, 'checkout-coupon.png'), fullPage: false })
  } finally {
    await browser.close()
  }
} finally {
  if (orderId && !orderId.startsWith('ERR')) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  }
  if (couponId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_coupon_user WHERE coupon_id = '${couponId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_coupon WHERE id = '${couponId}'`)
  }
  sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${CART_ID}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${ADDRESS_ID}'`)
  if (consumerId && previousDefaultId) {
    sql(`UPDATE agri_s2b2c.s2b2c_address SET is_default = TRUE WHERE id = '${previousDefaultId}'`)
  }
  for (const id of previousSelected) {
    sql(`UPDATE agri_s2b2c.s2b2c_cart SET selected = TRUE WHERE id = '${id}'`)
  }
  if (stockSnapshot?.stock && stockSnapshot?.sales
      && !stockSnapshot.stock.startsWith('ERR') && !stockSnapshot.sales.startsWith('ERR')) {
    sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = ${stockSnapshot.stock}, sales = ${stockSnapshot.sales} WHERE id = 3`)
  }
  console.log(`\n清理：order=${orderId ? 1 : 0} coupon=${couponId ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log(`  - ${item}`))
process.exit(1)
