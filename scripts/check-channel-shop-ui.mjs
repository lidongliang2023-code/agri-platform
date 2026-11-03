/**
 * 消费端「渠道店铺」点检：SSO 登录 → 打开渠道店铺 → 加购带渠道。
 * 用法：node scripts/check-channel-shop-ui.mjs
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
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'channel-shop-20261030')
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
  // 1) 临时造数据
  const identityCount = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE user_id = '${adminId}' AND identity_type = 'wholesaler' AND status = 'approved'`)
  if (identityCount === '0' || identityCount === '') {
    const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ identityType: 'wholesaler', subjectName: '渠道店铺点检主体' }),
    })).json()
    identityId = applied?.data?.id ?? ''
    await fetch(`${CORE}/api/v1/admin/identity-applications/${identityId}/review`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true, remark: 'channel shop check' }),
    })
  }

  const supplierProfile = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  if (supplierProfile?.applied) {
    supplierId = String(supplierProfile.id)
  } else {
    await fetch(`${S2B2C}/api/supplier/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: '渠道店铺点检供应商', creditCode: '91320100SHOP001X', contactPhone: '13800000000' }),
    })
    supplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    created.supplier = true
  }

  await fetch(`${S2B2C}/api/supplier/product/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 1, name: '渠道店铺点检商品', price: 9.9, stock: 20, commissionRate: 8 }),
  })
  productId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id = '${supplierId}' AND name = '渠道店铺点检商品' ORDER BY id DESC LIMIT 1`)
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
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: '渠道店铺点检', contactPhone: '13800000000', shopName: '渠道店铺点检店' }),
    })
    channelId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    created.channel = true
    await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, { method: 'PUT', headers: auth })
  }
  await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, { method: 'POST', headers: auth })
  relationId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}' LIMIT 1`)
  check(Boolean(channelId && productId), '造好渠道店铺与在架商品', `channel=${channelId} product=${productId}`)

  // 2) 浏览器点检
  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  try {
    await page.goto(`http://localhost:8082/channel/${channelId}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    if (!page.url().includes(':8082')) {
      await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
      await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 }).catch(() => {})
      await page.locator('input[placeholder*="用户名"]').first().fill('admin').catch(() => {})
      await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123').catch(() => {})
      await page.locator('button').filter({ hasText: '登' }).first().click().catch(() => {})
      await page.waitForURL(/localhost:8082/, { timeout: 30000 }).catch(() => {})
      await page.goto(`http://localhost:8082/channel/${channelId}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
      await page.waitForTimeout(2000)
    }
    await page.goto('http://localhost:8082/', { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('渠道好店') && text.includes('渠道店铺点检店'), '商城首页展示渠道好店入口', text.slice(0, 40))
    await page.locator('.channel-card', { hasText: '渠道店铺点检店' }).first().click()
    await page.waitForTimeout(1300)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(page.url().includes(':8082') && page.url().includes('/channel/'), '从首页进入渠道专柜', page.url())
    check(text.includes('渠道店铺点检店') && text.includes('渠道店铺点检商品'), '渠道店铺展示名称与商品', text.slice(0, 40))

    page.on('dialog', (d) => d.accept())
    await page.locator('button', { hasText: '加入购物车' }).first().click()
    await page.waitForTimeout(1500)
    consumerId = sql(`SELECT id FROM agri_s2b2c.s2b2c_consumer WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    const cartChannel = sql(`SELECT channel_id FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${consumerId}' AND product_id = '${productId}' ORDER BY id DESC LIMIT 1`)
    check(String(cartChannel) === String(channelId), '加购后购物车行带渠道归属', `channel_id=${cartChannel}`)
    await page.screenshot({ path: path.join(OUT, 'channel-shop.png'), fullPage: false })
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
