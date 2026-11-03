/**
 * 消费端移动 H5 结算优惠券点检：造券/地址/购物车 → 打开结算页选券 → 提交订单 → 校验落库。
 * 用法：node scripts/check-mobile-coupon-checkout.mjs
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
const MOBILE = 'http://localhost:8182/mall-mobile/versions/20261030-coupon-checkout-r5'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'mobile-coupon-checkout-20261030')
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

const ADDRESS_ID = '990000000000000023'
const CART_ID = '990000000000000024'
let consumer = null
let couponId = ''
let couponUserId = ''
let couponName = ''
let orderId = ''
let previousDefaultId = ''
let previousSelected = []
let stockSnapshot = null

try {
  consumer = await (await fetch(`${S2B2C}/api/consumer/profile`, { headers: auth })).json()
  check(Boolean(consumer?.id), '读取消费者档案', `consumer=${consumer?.id}`)

  const pad = (n) => String(n).padStart(2, '0')
  const dayText = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  couponName = `移动点检券${Date.now() % 10000}`
  const coupon = await (await fetch(`${S2B2C}/api/platform/coupons`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: couponName, type: 'FIXED', amount: 5, minAmount: 1,
      totalCount: 5, perUserLimit: 1,
      validStart: dayText(new Date()), validEnd: dayText(new Date(Date.now() + 7 * 86400000)),
    }),
  })).json()
  couponId = String(coupon?.id ?? '')
  const received = await (await fetch(
    `${S2B2C}/api/consumer/coupon/receive?consumerId=${consumer.id}&couponId=${couponId}`,
    { method: 'POST', headers: auth })).json()
  const couponRows = await (await fetch(`${S2B2C}/api/consumer/coupons?consumerId=${consumer.id}`, { headers: auth })).json()
  const couponUser = (couponRows ?? []).find((row) => String(row.couponId) === couponId
    && String(row.status).toUpperCase() === 'UNUSED')
  couponUserId = String(couponUser?.id ?? '')
  check(coupon?.success === true && received?.success === true && Boolean(couponUserId), '造好移动端点检券', couponId)

  previousDefaultId = sql(`SELECT id FROM agri_s2b2c.s2b2c_address
                            WHERE consumer_id = '${consumer.id}' AND is_default = TRUE ORDER BY id DESC LIMIT 1`)
  if (previousDefaultId.startsWith('ERR')) previousDefaultId = ''
  sql(`UPDATE agri_s2b2c.s2b2c_address SET is_default = FALSE WHERE consumer_id = '${consumer.id}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${ADDRESS_ID}'`)
  sql(`INSERT INTO agri_s2b2c.s2b2c_address
       (id, consumer_id, name, phone, province, city, district, address, is_default, status)
       VALUES ('${ADDRESS_ID}', '${consumer.id}', '移动券点检', '13800009998', '江苏省', '南京市', '鼓楼区', '移动券路 23 号', TRUE, 'ACTIVE')`)

  const selectedRows = sql(`SELECT id FROM agri_s2b2c.s2b2c_cart
                             WHERE consumer_id = '${consumer.id}' AND selected = TRUE`)
  previousSelected = selectedRows && !selectedRows.startsWith('ERR')
    ? selectedRows.split('\n').map((row) => row.trim()).filter(Boolean)
    : []
  sql(`UPDATE agri_s2b2c.s2b2c_cart SET selected = FALSE WHERE consumer_id = '${consumer.id}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${CART_ID}'`)
  sql(`INSERT INTO agri_s2b2c.s2b2c_cart (id, consumer_id, shop_id, product_id, quantity, selected, channel_id)
       VALUES ('${CART_ID}', '${consumer.id}', 2, 3, 1, TRUE, NULL)`)
  stockSnapshot = {
    stock: sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3'),
    sales: sql('SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = 3'),
  }

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  })
  await context.addInitScript(({ token: t, consumer: c }) => {
    localStorage.setItem('s2b2c_unified_token', t)
    localStorage.setItem('s2b2c_unified_user', JSON.stringify({ type: 'object', data: { username: 'admin' } }))
    localStorage.setItem('s2b2c_mobile_user', JSON.stringify({ type: 'object', data: c }))
  }, { token, consumer })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e)))
  try {
    await page.goto(`${MOBILE}/#/pages/checkout/index`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('商品清单') && text.includes('优惠券'), '移动结算页展示优惠券区', text.slice(0, 50))
    check(text.includes(couponName), '移动结算页展示可用券', couponName)

    await page.locator('text=' + couponName).first().click()
    await page.waitForTimeout(600)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('-¥5.00') && text.includes('¥33.00'), '移动端选券后优惠与应付正确', text.slice(-50))

    await page.locator('text=提交订单').first().click()
    await page.waitForTimeout(2200)
    orderId = sql(`SELECT id FROM agri_s2b2c.s2b2c_order
                   WHERE consumer_id = '${consumer.id}' AND coupon_user_id = '${couponUserId}'
                   ORDER BY create_time DESC, id DESC LIMIT 1`)
    check(Boolean(orderId) && !orderId.startsWith('ERR'), '移动端提交订单成功', `order=${orderId}`)
    if (orderId && !orderId.startsWith('ERR')) {
      const moneyRow = sql(`SELECT CONCAT(discount_amount,'|',pay_amount,'|',coupon_discount)
                            FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
      check(moneyRow === '5.00|33.00|5.00', '移动端券优惠落库正确', moneyRow)
      const used = sql(`SELECT status FROM agri_s2b2c.s2b2c_coupon_user WHERE id = '${couponUserId}'`)
      check(used === 'USED', '移动端券标记已使用', used)
    }
    check(pageErrors.length === 0, '移动端结算无运行时异常', pageErrors.slice(0, 1).join(' '))
    await page.screenshot({ path: path.join(OUT, 'mobile-checkout-coupon.png'), fullPage: false })
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
  if (consumer?.id && previousDefaultId) {
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
