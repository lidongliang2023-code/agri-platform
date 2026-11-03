/**
 * 集采模块点检：平台创建批次 → 渠道报名 → 平台截止 → 渠道报名锁定 → 平台到货。
 * 用法：node scripts/check-group-purchase-ui.mjs
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
const PLATFORM = 'http://localhost:8103'
const CHANNEL = 'http://localhost:8085'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'group-purchase-20261030')
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
let batchId = ''
const created = { supplier: false, channel: false, product: false }
const batchTitle = `集采点检批次${Date.now() % 100000}`
const productName = `集采点检商品${Date.now() % 10000}`

try {
  const identityCount = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE user_id = '${adminId}' AND identity_type = 'wholesaler' AND status = 'approved'`)
  if (identityCount === '0' || identityCount === '') {
    const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ identityType: 'wholesaler', subjectName: '集采点检主体' }),
    })).json()
    identityId = applied?.data?.id ?? ''
    await fetch(`${CORE}/api/v1/admin/identity-applications/${identityId}/review`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true, remark: 'group purchase check' }),
    })
  }

  const supplierProfile = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  if (supplierProfile?.applied) {
    supplierId = String(supplierProfile.id)
  } else {
    await fetch(`${S2B2C}/api/supplier/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: '集采点检供应商', creditCode: '91320100GP0001X', contactPhone: '13800000000' }),
    })
    supplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    created.supplier = true
  }
  await fetch(`${S2B2C}/api/supplier/product/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 1, name: productName, price: 12.8, stock: 100, commissionRate: 8 }),
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
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: '集采点检渠道', contactPhone: '13800000000', shopName: '集采点检渠道店' }),
    })
    channelId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE shop_name = '集采点检渠道店' ORDER BY id DESC LIMIT 1`)
    created.channel = true
    await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, { method: 'PUT', headers: auth })
  }
  const shopName = sql(`SELECT shop_name FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, { method: 'POST', headers: auth })
  relationId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}' LIMIT 1`)

  const batch = await (await fetch(`${S2B2C}/api/platform/group-purchases`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ productId, title: batchTitle, purchasePrice: 10, minQuantity: 5, targetQuantity: 20,
      startTime: '2026-01-01 00:00:00', endTime: '2030-12-31 23:59:59', warehouse: '华东云仓' }),
  })).json()
  batchId = String(batch?.id ?? '')
  check(batch?.success === true && Boolean(batchId), '平台创建集采批次', `id=${batchId}`)

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } })
  const cookiePairs = cookie.split('; ').map((x) => x.split('='))
  await context.addCookies(cookiePairs.map(([name, ...rest]) => ({ name, value: rest.join('='), domain: 'localhost', path: '/' })))
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 120)))

  try {
    await page.goto(`${PLATFORM}/group-purchases`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('集采管理') && text.includes(batchTitle) && text.includes('报名中'), '运营端展示集采批次')
    await page.screenshot({ path: path.join(OUT, '01-platform-batch.png'), fullPage: false })

    await page.goto(`${CHANNEL}/purchase`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('集采采购补货') && text.includes(batchTitle), '渠道端展示可报名批次')
    await page.locator('tr', { hasText: batchTitle }).first().locator('button', { hasText: '报名' }).click()
    await page.waitForSelector('.el-dialog .el-form-item input', { timeout: 10000 })
    const qtyInput = page.locator('.el-dialog .el-form-item', { hasText: '报名数量' }).locator('input').first()
    await qtyInput.fill('8')
    await page.locator('.el-dialog button', { hasText: '确认报名' }).click()
    await page.waitForTimeout(1500)
    const commitment = sql(`SELECT CONCAT(quantity,'|',amount,'|',status) FROM agri_s2b2c.s2b2c_group_purchase_order WHERE batch_id='${batchId}' AND channel_id='${channelId}'`)
    check(commitment === '8|80.00|RESERVED', '渠道报名落库', commitment)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('8 件') && text.includes('已报名'), '渠道端展示我的报名')
    await page.screenshot({ path: path.join(OUT, '02-channel-joined.png'), fullPage: false })

    await page.goto(`${PLATFORM}/group-purchases`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('1 家 · 8 件'), '运营端看到渠道报名汇总')
    await page.locator('tr', { hasText: batchTitle }).first().locator('button', { hasText: '详情' }).click()
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(shopName) && text.includes('8'), '运营端详情含渠道报名')
    await page.locator('.el-dialog__headerbtn').last().click().catch(() => {})
    await page.waitForTimeout(400)
    await page.locator('tr', { hasText: batchTitle }).first().locator('button', { hasText: '截止' }).click()
    await page.waitForSelector('.el-message-box__btns button', { timeout: 10000 })
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const closed = sql(`SELECT status FROM agri_s2b2c.s2b2c_group_purchase WHERE id='${batchId}'`)
    const confirmed = sql(`SELECT status FROM agri_s2b2c.s2b2c_group_purchase_order WHERE batch_id='${batchId}'`)
    check(closed === 'CLOSED' && confirmed === 'CONFIRMED', '平台截止并锁定报名', `batch=${closed} order=${confirmed}`)

    const lateJoin = await (await fetch(`${S2B2C}/api/channel/group-purchases/${batchId}/join`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: JSON.stringify({ quantity: 2 }),
    })).json()
    check(lateJoin?.success === false, '截止后不能报名', String(lateJoin?.message ?? '').slice(0, 20))

    await page.goto(`${CHANNEL}/purchase`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(!text.includes(batchTitle) || text.includes('已确认'), '渠道端批次关闭后展示确认状态')
    const historyStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_group_purchase_order WHERE batch_id='${batchId}'`)
    check(historyStatus === 'CONFIRMED', '渠道我的集采记录为已确认', historyStatus)

    await page.goto(`${PLATFORM}/group-purchases`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(900)
    await page.locator('tr', { hasText: batchTitle }).first().locator('button', { hasText: '到货' }).click()
    await page.waitForSelector('.el-message-box__btns button', { timeout: 10000 })
    await page.locator('.el-message-box__btns button').last().click()
    await page.waitForTimeout(1200)
    const fulfilled = sql(`SELECT status FROM agri_s2b2c.s2b2c_group_purchase WHERE id='${batchId}'`)
    const orderFulfilled = sql(`SELECT status FROM agri_s2b2c.s2b2c_group_purchase_order WHERE batch_id='${batchId}'`)
    check(fulfilled === 'FULFILLED' && orderFulfilled === 'FULFILLED', '平台确认到货并同步报名状态',
      `batch=${fulfilled} order=${orderFulfilled}`)
    await page.screenshot({ path: path.join(OUT, '03-platform-fulfilled.png'), fullPage: false })

    check(pageErrors.length === 0, '页面无运行时异常', pageErrors.slice(0, 2).join(' | '))
  } finally {
    await browser.close()
  }
} finally {
  if (batchId) sql(`DELETE FROM agri_s2b2c.s2b2c_group_purchase_order WHERE batch_id = '${batchId}'`)
  if (batchId) sql(`DELETE FROM agri_s2b2c.s2b2c_group_purchase WHERE id = '${batchId}'`)
  if (relationId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
  if (created.product && productId) sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`)
  if (created.channel && channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  if (created.supplier && supplierId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
  if (identityId) sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${identityId}'`)
  console.log(`\n清理：batch=${batchId ? 1 : 0} supplier=${created.supplier ? 1 : 0} channel=${created.channel ? 1 : 0} product=${created.product ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
