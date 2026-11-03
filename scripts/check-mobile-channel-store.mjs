/**
 * 消费端移动 H5「渠道店铺」点检：造数据 → 打开店铺页 → 加购 → 校验购物车行渠道归属。
 * 用法：node scripts/check-mobile-channel-store.mjs
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
const MOBILE = 'http://localhost:8182/mall-mobile/versions/20261030-channel-discovery-r3'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'mobile-channel-store-20261030')
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
const created = { supplier: false, channel: false, product: false }

try {
  // 1) 造渠道店铺数据（与 PC 点检同一套）
  const identityCount = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE user_id = '${adminId}' AND identity_type = 'wholesaler' AND status = 'approved'`)
  if (identityCount === '0' || identityCount === '') {
    const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ identityType: 'wholesaler', subjectName: '移动渠道店铺点检主体' }),
    })).json()
    identityId = applied?.data?.id ?? ''
    await fetch(`${CORE}/api/v1/admin/identity-applications/${identityId}/review`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true, remark: 'mobile channel store check' }),
    })
  }

  const supplierProfile = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  if (supplierProfile?.applied) {
    supplierId = String(supplierProfile.id)
  } else {
    await fetch(`${S2B2C}/api/supplier/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: '移动渠道点检供应商', creditCode: '91320100MSHOP01X', contactPhone: '13800000000' }),
    })
    supplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    created.supplier = true
  }

  const productName = `移动渠道点检商品${Date.now() % 10000}`
  await fetch(`${S2B2C}/api/supplier/product/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 1, name: productName, price: 12.8, stock: 30, commissionRate: 6 }),
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
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: '移动渠道点检', contactPhone: '13800000000', shopName: '移动渠道点检店' }),
    })
    channelId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    created.channel = true
    await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, { method: 'PUT', headers: auth })
  }
  await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, { method: 'POST', headers: auth })
  relationId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}' LIMIT 1`)
  const shopName = sql(`SELECT shop_name FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  check(Boolean(channelId && productId && relationId), '造好移动渠道店铺数据', `channel=${channelId} product=${productId}`)

  const consumer = await (await fetch(`${S2B2C}/api/consumer/profile`, { headers: auth })).json()
  consumerId = String(consumer?.id ?? '')
  check(Boolean(consumerId), '统一账号有消费者档案', `consumer=${consumerId}`)

  // 2) 移动 H5 点检（uni-app H5 用 hash 路由）
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
  page.on('response', async (res) => {
    if (res.url().includes('/consumer/cart/add')) {
      console.log('　[cart/add]', res.status(), (await res.text().catch(() => '')).slice(0, 160))
    }
  })

  try {
    await page.goto(`${MOBILE}/#/pages/channel/index?channelId=${channelId}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(shopName) && text.includes(productName), '移动端展示渠道店铺与商品', `${shopName} / ${productName}`)
    check(text.includes('渠道专属'), '展示渠道标识', '')
    await page.screenshot({ path: path.join(OUT, 'mobile-channel-store.png'), fullPage: false })

    await page.locator('text=加入购物车').first().click()
    await page.waitForTimeout(1500)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('加入购物车成功') || text.includes('已加入购物车'), '加购成功提示', '')
    const cartChannel = sql(`SELECT channel_id FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${consumerId}' AND product_id = '${productId}' ORDER BY id DESC LIMIT 1`)
    check(String(cartChannel) === String(channelId), '移动端加购带渠道归属', `channel_id=${cartChannel}`)
    await page.screenshot({ path: path.join(OUT, 'mobile-channel-cart-added.png'), fullPage: false })

    await page.goto(`${MOBILE}/#/pages/product/detail?id=${productId}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1200)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes(productName) && !text.includes('不存在'), '商品详情按雪花 ID 加载', `id=${productId}`)
    await page.screenshot({ path: path.join(OUT, 'mobile-product-detail.png'), fullPage: false })

    await page.goto(`${MOBILE}/#/pages/home/index`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('渠道好店') && text.includes(shopName), '移动端首页展示渠道好店入口')
    await page.locator('.channel-card-m', { hasText: shopName }).first().click()
    await page.waitForTimeout(1300)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('渠道店铺') && text.includes(productName), '移动端从首页进入渠道店铺')
    await page.screenshot({ path: path.join(OUT, 'mobile-channel-entry.png'), fullPage: false })
    check(pageErrors.length === 0, '页面无运行时异常', pageErrors.slice(0, 2).join(' | '))
  } finally {
    await browser.close()
  }
} finally {
  if (consumerId) sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${consumerId}' AND product_id = '${productId}'`)
  if (relationId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
  if (created.product && productId) sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`)
  if (created.channel && channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  if (created.supplier && supplierId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
  if (identityId) sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${identityId}'`)
  console.log(`\n清理：supplier=${created.supplier ? 1 : 0} channel=${created.channel ? 1 : 0} product=${created.product ? 1 : 0} identity=${identityId ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
