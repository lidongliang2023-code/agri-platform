/**
 * 供应商端「撤销授权」真实点检（临时造数据 → 浏览器点击 → 清理）。
 *
 * 前置：s2b2c(8088)、SSO(8090)、门户网关(8084) 已启动。
 * 用法：node scripts/check-supplier-revoke-ui.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')

const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const sql = (q) => {
  if (!existsSync(MYSQL)) return ''
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' }).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 80)}`
  }
}
const CORE = 'http://localhost:8093'
const S2B2C = 'http://localhost:8088'
const SUPPLIER_UI = 'http://localhost:8084'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'supplier-revoke-ui-20261030')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const readJson = async (res) => {
  try {
    return await res.json()
  } catch {
    return null
  }
}

/* ---------------- 1) 造数据 ---------------- */
const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
})).json()
const token = login?.data?.accessToken ?? ''
const auth = { Authorization: `Bearer ${token}` }
check(Boolean(token), '拿到平台令牌')

const adminId = sql(`SELECT id FROM agri_core.platform_user WHERE username = 'admin'`)
const sessionRes = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
})
const cookie = (sessionRes.headers.getSetCookie?.() ?? []).map((item) => item.split(';')[0]).join('; ')

let identityId = ''
let supplierId = ''
let channelId = ''
let productId = ''
let relationId = ''
const created = { supplier: false, channel: false, product: false }

try {
  // 1.1 批发商身份（没有就建）
  const identityCount = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE user_id = '${adminId}' AND identity_type = 'wholesaler' AND status = 'approved'`)
  if (identityCount !== '0' && identityCount !== '') {
    console.log('  （已有批发商身份，复用）')
  } else {
    const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ identityType: 'wholesaler', subjectName: 'UI点检供应商主体' }),
    })).json()
    identityId = applied?.data?.id ?? ''
    await fetch(`${CORE}/api/v1/admin/identity-applications/${identityId}/review`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ approved: true, remark: 'ui 点检' }),
    })
    check(Boolean(identityId), '开通批发商身份', `id=${identityId}`)
  }

  // 1.2 供应商档案
  const supplierProfile = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  if (supplierProfile?.applied) {
    supplierId = String(supplierProfile.id)
  } else {
    const applied = await (await fetch(`${S2B2C}/api/supplier/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: 'UI点检供应商', creditCode: '91320100UI00001X', contactPhone: '13800000000' }),
    })).json()
    supplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    created.supplier = applied?.success === true
    check(Boolean(supplierId), '供应商档案就绪', `id=${supplierId}`)
  }

  // 1.3 商品 + 审核通过
  const product = await (await fetch(`${S2B2C}/api/supplier/product/create`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 1, name: 'UI点检商品', price: 1, stock: 10, commissionRate: 5 }),
  })).json()
  created.product = product?.success === true
  productId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id = '${supplierId}' AND name = 'UI点检商品' ORDER BY id DESC LIMIT 1`)
  check(Boolean(productId), '创建点检商品', `id=${productId}`)
  await fetch(`${S2B2C}/api/platform/product/audit?id=${productId}&status=APPROVED&opinion=ui`, { method: 'PUT', headers: auth })

  // 1.4 渠道 + 审核通过 + 选品
  const channelProfile = await (await fetch(`${S2B2C}/api/channel/profile`, { headers: auth })).json()
  if (channelProfile?.applied) {
    channelId = String(channelProfile.id)
    if (channelProfile.auditStatus !== 'APPROVED') {
      await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, {
        method: 'PUT', headers: auth,
      })
    }
  } else {
    const applied = await (await fetch(`${S2B2C}/api/channel/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: 'UI点检渠道', contactPhone: '13800000000', shopName: 'UI点检渠道店' }),
    })).json()
    created.channel = applied?.success === true
    channelId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=ui`, {
      method: 'PUT', headers: auth,
    })
  }
  check(Boolean(channelId), '渠道档案就绪', `id=${channelId}`)
  const picked = await (await fetch(`${S2B2C}/api/channel/select-product?channelId=${channelId}&productId=${productId}`, {
    method: 'POST', headers: auth,
  })).json()
  relationId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${channelId}' AND product_id = '${productId}' LIMIT 1`)
  check(picked?.success === true && Boolean(relationId), '渠道已选中点检商品', `relation=${relationId}`)

  /* ---------------- 2) 浏览器点检 ---------------- */
  const browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    args: ['--no-sandbox'],
  })
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 960 } })).newPage()
  try {
    await page.goto(`${SUPPLIER_UI}/products`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1500)
    // 未登录会跳 SSO 授权页 → 登录
    if (!page.url().includes(':8084')) {
      // SSO 登录页默认是短信 Tab，先切到「账号 + 密码」
      await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
      await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 }).catch(() => {})
      await page.locator('input[placeholder*="用户名"]').first().fill('admin').catch(() => {})
      await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123').catch(() => {})
      await page.locator('button').filter({ hasText: '登' }).first().click().catch(() => {})
      try {
        await page.waitForURL(/localhost:8084/, { timeout: 30000 })
      } catch {
        // 登录失败时保留页面证据
        await page.screenshot({ path: path.join(OUT, 'login-failed.png'), fullPage: true })
      }
      await page.goto(`${SUPPLIER_UI}/products`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
      await page.waitForTimeout(2500)
    }
    check(page.url().includes(':8084'), '登录后回到供应商工作台', page.url())

    if (!page.url().includes(':8084')) {
      throw new Error('登录未完成，无法继续 UI 点检')
    }
    await page.waitForSelector('.el-table__row', { timeout: 30000 }).catch(() => {})
    const row = page.locator('.el-table__row', { hasText: 'UI点检商品' }).first()
    check(await row.count() > 0, '商品列表出现点检商品')
    await row.locator('button', { hasText: '渠道授权' }).click()
    await page.waitForTimeout(1200)
    const dialogText = (await page.locator('.el-dialog').innerText()).replace(/\s+/g, ' ')
    check(dialogText.includes('UI点检渠道店') && dialogText.includes('生效中'), '弹窗列出渠道与状态', dialogText.slice(0, 50))

    page.on('dialog', (d) => d.accept())
    await page.locator('.el-dialog button', { hasText: '撤销授权' }).first().click()
    await page.waitForFunction(() => document.body.innerText.includes('已撤销'), { timeout: 15000 })
    const afterText = (await page.locator('.el-dialog').innerText()).replace(/\s+/g, ' ')
    check(/已撤销/.test(afterText) && !/生效中/.test(afterText), '点击撤销后弹窗显示已撤销', afterText.slice(0, 50))
    await page.screenshot({ path: path.join(OUT, 'supplier-revoke.png'), fullPage: false })

    const dbStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
    check(dbStatus === 'REVOKED', '库里关系已置为 REVOKED', `status=${dbStatus}`)
  } finally {
    await browser.close()
  }
} finally {
  if (relationId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE id = '${relationId}'`)
  if (created.product && productId) sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${productId}'`)
  if (created.channel && channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${channelId}'`)
  if (created.supplier && supplierId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
  if (identityId) sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${identityId}'`)
  console.log(`\n清理：identity=${identityId ? 1 : 0} supplier=${created.supplier ? 1 : 0} channel=${created.channel ? 1 : 0} product=${created.product ? 1 : 0}`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
