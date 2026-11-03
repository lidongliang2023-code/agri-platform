/**
 * 供应商招募点检：生成邀请码 → 渠道带码入驻 → 平台审核 → 招募关系同步。
 * 用法：node scripts/check-recruit-ui.mjs
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
const SUPPLIER_APP = 'http://localhost:8084'
const CHANNEL_APP = 'http://localhost:8085'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'recruit-20261030')
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
let inviteId = ''
let recruitId = ''
let supplierCreated = false

try {
  const existingChannel = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE user_id = '${adminId}' LIMIT 1`)
  check(!existingChannel, '点检账号当前没有渠道档案', existingChannel ? `channel=${existingChannel}` : '')
  if (existingChannel) throw new Error('admin 已有渠道档案，无法验证带码入驻')

  const identityCount = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE user_id = '${adminId}' AND identity_type = 'wholesaler' AND status = 'approved'`)
  if (identityCount === '0' || identityCount === '') {
    const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
      body: JSON.stringify({ identityType: 'wholesaler', subjectName: '招募点检主体' }),
    })).json()
    identityId = applied?.data?.id ?? ''
    await fetch(`${CORE}/api/v1/admin/identity-applications/${identityId}/review`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ approved: true, remark: 'recruit check' }),
    })
  }

  const supplierProfile = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  if (supplierProfile?.applied) {
    supplierId = String(supplierProfile.id)
  } else {
    await fetch(`${S2B2C}/api/supplier/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName: '招募点检供应商', creditCode: '91320100REC0001X', contactPhone: '13800000000' }),
    })
    supplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
    supplierCreated = true
  }

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 940 } })
  const cookiePairs = cookie.split('; ').map((x) => x.split('='))
  await context.addCookies(cookiePairs.map(([name, ...rest]) => ({ name, value: rest.join('='), domain: 'localhost', path: '/' })))
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 120)))

  try {
    await page.goto(`${SUPPLIER_APP}/recruit`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    await page.locator('button', { hasText: '生成邀请码' }).click()
    await page.waitForSelector('.el-dialog input', { timeout: 10000 })
    await page.locator('.el-dialog .el-form-item', { hasText: '渠道数量上限' }).locator('input').fill('1')
    await page.locator('.el-dialog button', { hasText: '生成' }).click()
    await page.waitForTimeout(1200)
    inviteId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier_invite WHERE supplier_id='${supplierId}' ORDER BY create_time DESC LIMIT 1`)
    const code = sql(`SELECT code FROM agri_s2b2c.s2b2c_supplier_invite WHERE id='${inviteId}'`)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(Boolean(code) && text.includes(code), '供应商生成邀请码', `code=${code}`)
    await page.screenshot({ path: path.join(OUT, '01-supplier-invite.png'), fullPage: false })

    await page.goto(`${CHANNEL_APP}/apply`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('供应商邀请码'), '渠道入驻页含邀请码字段')

    const badApply = await (await fetch(`${S2B2C}/api/channel/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: '招募点检', contactPhone: '13800000000',
        shopName: '招募点检渠道店', inviteCode: 'BADCODE' }),
    })).json()
    check(badApply?.success === false && String(badApply?.message ?? '').includes('邀请码'),
      '错误邀请码不能入驻', String(badApply?.message ?? '').slice(0, 20))
    const noChannel = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_channel_partner WHERE user_id='${adminId}'`)
    check(noChannel === '0', '错误邀请码未创建渠道档案', `rows=${noChannel}`)

    const goodApply = await (await fetch(`${S2B2C}/api/channel/apply`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ registerType: 'PERSONAL', contactName: '招募点检', contactPhone: '13800000000',
        shopName: '招募点检渠道店', inviteCode: code }),
    })).json()
    check(goodApply?.success === true, '渠道带码入驻提交成功', String(goodApply?.message ?? ''))
    channelId = sql(`SELECT id FROM agri_s2b2c.s2b2c_channel_partner WHERE user_id='${adminId}' ORDER BY id DESC LIMIT 1`)
    recruitId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier_recruit WHERE supplier_id='${supplierId}' AND channel_id='${channelId}'`)
    const recruitState = sql(`SELECT CONCAT(status,'|',invite_code) FROM agri_s2b2c.s2b2c_supplier_recruit WHERE id='${recruitId}'`)
    const used = sql(`SELECT used_count FROM agri_s2b2c.s2b2c_supplier_invite WHERE id='${inviteId}'`)
    check(recruitState === `PENDING|${code}` && used === '1', '招募关系待审核且邀请码已计数',
      `recruit=${recruitState} used=${used}`)

    await page.goto(`${SUPPLIER_APP}/recruit`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('招募点检渠道店') && text.includes('待审核'), '供应商看到待审核招募')
    await page.screenshot({ path: path.join(OUT, '02-recruit-pending.png'), fullPage: false })

    const approve = await (await fetch(`${S2B2C}/api/platform/channel-partner/audit?id=${channelId}&auditStatus=APPROVED&auditOpinion=recruit-check`, {
      method: 'PUT', headers: auth,
    })).json()
    check(approve?.success === true, '平台审核通过渠道', String(approve?.message ?? '').slice(0, 20))
    const approvedRecruit = sql(`SELECT status FROM agri_s2b2c.s2b2c_supplier_recruit WHERE id='${recruitId}'`)
    check(approvedRecruit === 'APPROVED', '招募关系同步为已通过', `status=${approvedRecruit}`)

    await page.goto(`${SUPPLIER_APP}/recruit`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1000)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('招募点检渠道店') && text.includes('已通过'), '供应商看到已通过招募')
    await page.screenshot({ path: path.join(OUT, '03-recruit-approved.png'), fullPage: false })

    check(pageErrors.length === 0, '页面无运行时异常', pageErrors.slice(0, 2).join(' | '))
  } finally {
    await browser.close()
  }
} finally {
  if (recruitId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier_recruit WHERE id='${recruitId}'`)
  if (inviteId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier_invite WHERE id='${inviteId}'`)
  if (channelId) sql(`DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE id='${channelId}'`)
  if (supplierCreated && supplierId) sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE id='${supplierId}'`)
  if (identityId) sql(`DELETE FROM agri_core.platform_identity_application WHERE id='${identityId}'`)
  console.log(`\n清理：channel=${channelId ? 1 : 0} invite=${inviteId ? 1 : 0} recruit=${recruitId ? 1 : 0} supplier=${supplierCreated ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
