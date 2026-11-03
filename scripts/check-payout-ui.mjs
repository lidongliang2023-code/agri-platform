/**
 * 运营端「提现审核」打款流水号点检：造一条已通过的提现 → 标记已打款 → 填流水号 → 校验落库与列表展示。
 * 用法：node scripts/check-payout-ui.mjs
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
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'payout-ui-20261030')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const payoutNo = `UI-PAY-${Date.now()}`
sql(`INSERT INTO agri_s2b2c.s2b2c_commission_withdrawal (channel_id, amount, status, apply_time, reviewer, review_time)
     VALUES (1, 0.01, 'APPROVED', NOW(), '平台运营', NOW())`)
const withdrawalId = sql(`SELECT id FROM agri_s2b2c.s2b2c_commission_withdrawal
     WHERE channel_id = 1 AND amount = 0.01 AND status = 'APPROVED' AND payout_no IS NULL ORDER BY id DESC LIMIT 1`)
check(Boolean(withdrawalId), '造一条已通过的提现', `id=${withdrawalId}`)

const sessionRes = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
})
const cookiePairs = (sessionRes.headers.getSetCookie?.() ?? []).map((x) => x.split(';')[0].split('='))

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
await context.addCookies(cookiePairs.map(([name, ...rest]) => ({
  name, value: rest.join('='), domain: 'localhost', path: '/',
})))
const page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e?.message ?? e).slice(0, 120)))

try {
  await page.goto('http://localhost:8103/withdrawals', { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('提现审核'), '运营端提现审核页渲染', page.url())

  const row = page.locator('tr', { hasText: '0.01' }).filter({ hasText: '已通过待打款' }).first()
  await row.locator('button', { hasText: '标记已打款' }).click()
  await page.waitForSelector('.el-message-box__input input', { timeout: 10000 })
  const promptText = (await page.evaluate(() => document.querySelector('.el-message-box__message')?.textContent ?? '')).replace(/\s+/g, ' ')
  check(promptText.includes('流水号'), '打款弹窗要求流水号', promptText.slice(0, 30))
  await page.locator('.el-message-box__input input').fill(payoutNo)
  await page.locator('.el-message-box__btns button').last().click()
  await page.waitForTimeout(1800)

  const dbRow = sql(`SELECT CONCAT(status, '|', IFNULL(payout_no, '')) FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE id = '${withdrawalId}'`)
  check(dbRow === `PAID|${payoutNo}`, '打款状态与流水号落库', dbRow)
  text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes(payoutNo), '列表展示打款流水号', payoutNo)
  await page.screenshot({ path: path.join(OUT, 'payout-recorded.png'), fullPage: false })
  check(errors.length === 0, '页面无 JS 异常', errors[0] ?? '')
} finally {
  await browser.close()
  if (withdrawalId) sql(`DELETE FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE id = '${withdrawalId}'`)
}

console.log('')
if (!failures.length) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
