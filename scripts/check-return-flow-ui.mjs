/**
 * 退货退款真实浏览器联调：
 * 消费者售后详情填写退货物流 → 平台售后页确认收到退货 → 订单退款、库存回补。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')
const BROWSER = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find((p) => existsSync(p))
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const sql = (q) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '-N', '-B', '--default-character-set=utf8mb4', '-e', q],
      { encoding: 'utf8' }).trim()
  } catch (e) { return `ERR:${e.message.slice(0, 80)}` }
}
const CORE = 'http://localhost:8093'
const S2 = 'http://localhost:8088'
const CONSUMER = 'http://localhost:8082'
const PLATFORM = 'http://localhost:8103'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'return-flow-20261031')
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
const auth = { Authorization: `Bearer ${login?.data?.accessToken}` }
const consumer = await (await fetch(`${S2}/api/consumer/profile`, { headers: auth })).json()
const consumerId = String(consumer?.id ?? '')
const ADDRESS_ID = '990000000000000051'
const CART_ID = '990000000000000052'
let orderId = ''
let afterSaleId = ''
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
  stockSnapshot = {
    stock: sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3'),
    sales: sql('SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = 3'),
  }
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${ADDRESS_ID}'`)
  sql(`INSERT INTO agri_s2b2c.s2b2c_address
       (id,consumer_id,name,phone,province,city,district,address,is_default,status)
       VALUES ('${ADDRESS_ID}','${consumerId}','退货UI点检','13800000000','江苏省','南京市','鼓楼区','退货 UI 路 51 号',FALSE,'ACTIVE')`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${CART_ID}'`)
  sql(`INSERT INTO agri_s2b2c.s2b2c_cart (id,consumer_id,shop_id,product_id,quantity,selected,channel_id)
       VALUES ('${CART_ID}','${consumerId}',2,3,1,TRUE,NULL)`)
  const created = await (await fetch(`${S2}/api/consumer/order/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, addressId: ADDRESS_ID }),
  })).json()
  orderId = String(created?.orderIds?.[0] ?? '')
  check(Boolean(orderId), '退货 UI 夹具：订单已创建', orderId)
  await fetch(`${S2}/api/consumer/order/pay/${orderId}`, { method: 'PUT', headers: auth })
  const payAmount = sql(`SELECT pay_amount FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  const applied = await (await fetch(`${S2}/api/consumer/after-sales`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ consumerId, orderId, type: 'RETURN', reason: 'UI 退货点检', amount: payAmount }),
  })).json()
  afterSaleId = sql(`SELECT id FROM agri_s2b2c.s2b2c_after_sale WHERE order_id = '${orderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
  await (await fetch(`${S2}/api/platform/after-sale/review?id=${afterSaleId}&status=APPROVED&opinion=同意退货`,
    { method: 'PUT', headers: auth })).json()
  check(applied?.success === true && Boolean(afterSaleId), '退货 UI 夹具：售后已同意退货', afterSaleId)

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 120)))
  try {
    await openApp(page, `${CONSUMER}/aftersale/${afterSaleId}`)
    await page.waitForTimeout(1200)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('退货物流') && text.includes('填写退货物流'), '消费者售后详情展示退货物流入口')
    await page.locator('button', { hasText: '填写退货物流' }).click()
    await page.waitForSelector('.el-dialog input[placeholder*="退货快递"]', { timeout: 10000 })
    await page.locator('.el-dialog input[placeholder*="退货快递"]').fill(`RET${Date.now()}`)
    await page.locator('.el-dialog button', { hasText: '提交物流' }).click()
    await page.waitForTimeout(1500)
    const returnInfo = sql(`SELECT CONCAT(IFNULL(return_company,''),'|',IFNULL(return_logistics_no,''),'|',
                                            IFNULL(return_shipped_at,'')) FROM agri_s2b2c.s2b2c_after_sale
                            WHERE id = '${afterSaleId}'`)
    check(returnInfo.split('|')[1].length > 0 && returnInfo.split('|')[2].length > 0,
      '消费者退货物流落库', returnInfo)

    await openApp(page, `${PLATFORM}/after-sales`)
    await page.waitForTimeout(1200)
    const row = page.locator('tr', { hasText: afterSaleId }).first()
    check(await row.count() > 0, '平台售后列表显示退货单')
    await row.locator('button', { hasText: '确认收到退货' }).click()
    await page.waitForSelector('.el-message-box__input input', { timeout: 10000 })
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1600)
    const finalState = sql(`SELECT CONCAT(a.status,'|',o.status) FROM agri_s2b2c.s2b2c_after_sale a
                            JOIN agri_s2b2c.s2b2c_order o ON o.id = a.order_id WHERE a.id = '${afterSaleId}'`)
    const stockAfter = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3')
    check(finalState === 'COMPLETED|REFUNDED' && Number(stockAfter) === Number(stockSnapshot.stock),
      '平台确认收货后退款并回补库存', `${finalState} stock=${stockSnapshot.stock}→${stockAfter}`)
    check(pageErrors.length === 0, '退货流程无运行时异常', pageErrors.slice(0, 1).join(' '))
    await page.screenshot({ path: path.join(OUT, 'return-flow.png'), fullPage: false })
  } finally {
    await browser.close()
  }
} finally {
  if (afterSaleId) sql(`DELETE FROM agri_s2b2c.s2b2c_after_sale WHERE id = '${afterSaleId}'`)
  if (orderId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id = '${orderId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
  }
  sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${CART_ID}'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${ADDRESS_ID}'`)
  if (stockSnapshot?.stock && stockSnapshot?.sales
      && !stockSnapshot.stock.startsWith('ERR') && !stockSnapshot.sales.startsWith('ERR')) {
    sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = ${stockSnapshot.stock}, sales = ${stockSnapshot.sales} WHERE id = 3`)
  }
  console.log(`\n清理：order=${orderId ? 1 : 0} afterSale=${afterSaleId ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log(`  - ${item}`))
process.exit(1)