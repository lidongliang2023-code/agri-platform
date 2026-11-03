/**
 * 供应商入驻门禁真实浏览器点检：
 * 未申请 → 只能看到入驻申请；提交后审核中 → 不能进入工作台；平台通过后 → 进入工作台。
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
const APP = 'http://localhost:8084'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'supplier-onboarding-20261031')
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
const companyName = `入驻门禁点检企业${Date.now() % 10000}`
let supplierId = ''

try {
  const existing = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '2108130996492058625' LIMIT 1`)
  check(existing === '', '测试账号初始无供应商档案', existing ? `leftover=${existing}` : '')

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 120)))
  try {
    await page.goto(`${APP}/`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(1200)
    if (!page.url().includes(':8084')) {
      await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
      await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 }).catch(() => {})
      await page.locator('input[placeholder*="用户名"]').first().fill('admin').catch(() => {})
      await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123').catch(() => {})
      await page.locator('button').filter({ hasText: '登' }).first().click().catch(() => {})
      await page.waitForTimeout(4000)
    }
    await page.waitForTimeout(1200)
    let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(page.url().includes('/apply'), '未申请账号打开供应商端进入入驻申请', page.url())
    check(text.includes('供应商入驻申请') && !text.includes('分销总览'),
      '未申请账户看不到工作台菜单')

    const labelInput = (label) => page.locator('.el-form-item', { hasText: label }).locator('input').first()
    await labelInput('公司名称').fill(companyName)
    await labelInput('统一信用代码').fill(`91320100UI${Date.now() % 100000}X`)
    await labelInput('联系电话').fill('13800001111')
    await labelInput('省 / 市 / 区').fill('江苏省')
    await labelInput('店铺名称').fill(`${companyName}店`)
    await page.locator('button', { hasText: '提交入驻申请' }).click()
    await page.waitForTimeout(2000)
    supplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE company_name = '${companyName}' ORDER BY id DESC LIMIT 1`)
    const pendingStatus = sql(`SELECT audit_status FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(Boolean(supplierId) && pendingStatus === 'PENDING', '提交入驻申请落库为待审核', pendingStatus)
    check(page.url().includes('/audit-progress') && text.includes('审核中'), '提交后进入审核进度页')

    await page.goto(`${APP}/products`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1200)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(page.url().includes('/audit-progress') && !text.includes('分销总览'),
      '审核中直接访问工作台被拦截', page.url())

    await fetch(`${S2}/api/platform/supplier/audit?id=${supplierId}&auditStatus=APPROVED&auditOpinion=ui-onboarding`,
      { method: 'PUT', headers: auth })
    await page.goto(`${APP}/`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForTimeout(1800)
    text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(text.includes('分销总览') && text.includes('我的分销池'), '审核通过后进入供应商工作台')
    check(pageErrors.length === 0, '入驻流程无运行时异常', pageErrors.slice(0, 1).join(' '))
    await page.screenshot({ path: path.join(OUT, 'supplier-onboarding.png'), fullPage: false })
  } finally {
    await browser.close()
  }
} finally {
  if (supplierId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_notice WHERE recipient_type = 'SUPPLIER' AND recipient_id = '${supplierId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE id = '${supplierId}'`)
  }
  console.log(`\n清理：supplier=${supplierId ? 1 : 0}`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log(`  - ${item}`))
process.exit(1)