/**
 * 用户中心 · 资质证照 端到端验证
 *
 * 验证链路：
 *   1. 新增三种证照：10 天后到期 / 已过期 / 长期有效
 *   2. 列表返回服务端现算的到期状态（expiring / expired / permanent）与计数
 *   3. 校验：有效期早于发证日期 → 400；未知证照类型 → 400
 *   4. 修改、删除
 *   5. 页面渲染：表格 + 到期提醒条 + 状态标签
 *   6. 清理本轮造的证照
 *
 * 用法：node scripts/e2e-uc-cert.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
const MYSQL = existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
  : ''
const sql = (q) => {
  if (!MYSQL) return ''
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' }).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 80)}`
  }
}

const BASE = 'http://localhost'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'uc-cert-20261030')
mkdirSync(OUT, { recursive: true })
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/** yyyy-MM-dd 偏移 */
const day = (offset) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

const marker = `证照E2E${Date.now().toString().slice(-6)}`
const createdIds = []
let withImageId = ''
const reminderCertIds = []

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1050 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

const call = (method, url, body) =>
  page.evaluate(
    async ({ m, u, b }) => {
      const res = await fetch(u, {
        method: m,
        credentials: 'include',
        headers: b ? { 'Content-Type': 'application/json' } : {},
        body: b ? JSON.stringify(b) : undefined,
      })
      let json = null
      try {
        json = await res.json()
      } catch {
        /* 非 JSON */
      }
      return { status: res.status, json }
    },
    { m: method, u: url, b: body },
  )

try {
  /* ---------- 登录 ---------- */
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  check(!page.url().includes('/sso/index.html'), 'SSO 登录成功')

  /* ---------- 取一个自己的主体 ---------- */
  const summary = await call('GET', '/api/v1/sso/account/summary')
  const merchants = summary.json?.data?.merchants ?? []
  check(merchants.length > 0, '当前账号有经营主体', `count=${merchants.length}`)
  const merchantId = merchants[0]?.merchantId
  if (!merchantId) throw new Error('没有可用主体，无法继续')

  /* ---------- 0.5) 临期人群接口（运营端口径） ---------- */
  const adminLogin = await (await fetch(`${BASE}:8093/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
  })).json()
  const ADMIN_AUTH = { Authorization: `Bearer ${adminLogin?.data?.accessToken ?? ''}` }
  const certAudienceCount = async () => {
    const res = await fetch(`${BASE}:8093/api/v1/admin/uc/message-pushes/audience-count?audience=cert_expiring`,
      { headers: ADMIN_AUTH })
    const body = await res.json()
    return body?.data?.count
  }
  const baseAudience = await certAudienceCount()
  check(typeof baseAudience === 'number', '临期人群预估接口可用', `count=${baseAudience}`)

  /* ---------- 1) 新增三张证照 ---------- */
  const cases = [
    { name: `${marker}-营业执照`, type: 'business_license', expire: day(10), expect: 'expiring' },
    { name: `${marker}-食品经营许可`, type: 'food_business', expire: day(-5), expect: 'expired' },
    { name: `${marker}-长期资质`, type: 'other', expire: null, expect: 'permanent' },
  ]
  for (const item of cases) {
    const res = await call('POST', '/api/v1/sso/account/certificates', {
      merchantId,
      certType: item.type,
      certName: item.name,
      certNo: `NO-${Date.now().toString().slice(-6)}`,
      issueOrg: 'E2E 测试机关',
      issueDate: day(-400),
      expireDate: item.expire,
      remark: 'e2e',
    })
    check(res.json?.code === 0, `新增证照「${item.name}」`, `code=${res.json?.code} msg=${res.json?.message ?? ''}`)
    if (res.json?.data?.id) createdIds.push(res.json.data.id)
  }

  /* ---------- 2) 列表与到期状态 ---------- */
  const list = await call('GET', '/api/v1/sso/account/certificates')
  const rows = list.json?.data?.records ?? []
  check(list.json?.code === 0, '证照列表接口可用', `code=${list.json?.code}`)
  check(rows.length >= 3, '列表包含新增的证照', `rows=${rows.length}`)

  for (const item of cases) {
    const hit = rows.find((r) => r.certName === item.name)
    check(hit?.expireState === item.expect, `「${item.name}」到期状态为 ${item.expect}`,
      `实际 ${hit?.expireState}`)
  }
  check(Number(list.json?.data?.expiringCount) >= 1, '统计出即将到期数量',
    `expiringCount=${list.json?.data?.expiringCount}`)
  check(Number(list.json?.data?.expiredCount) >= 1, '统计出已过期数量',
    `expiredCount=${list.json?.data?.expiredCount}`)
  check(Array.isArray(list.json?.data?.types) && list.json.data.types.length === 6,
    '返回 6 个证照类型', `types=${list.json?.data?.types?.length}`)

  const dbRow = sql(
    `SELECT cert_name,expire_date,status FROM agri_core.platform_merchant_certificate WHERE cert_name='${marker}-营业执照'`,
  )
  check(dbRow.includes('active'), '证照已落库（直连 MySQL 复核）', dbRow)

  /* ---------- 2.5) 临期证照应命中主体成员（而不是全量用户） ---------- */
  const afterCreateAudience = await certAudienceCount()
  const expectedMin = baseAudience === 0 ? 1 : baseAudience
  check(afterCreateAudience >= expectedMin && afterCreateAudience > 0,
    '临期证照命中主体成员', `base=${baseAudience} after=${afterCreateAudience}`)

  /* ---------- 2.6) 自动到期提醒：发送一次 + 幂等 ---------- */
  const scanOnce = await (await fetch(`${BASE}:8093/api/v1/admin/uc/cert-reminders/scan`, {
    method: 'POST', headers: ADMIN_AUTH,
  })).json()
  check(scanOnce.code === 0 && Number(scanOnce.data?.messages) >= 1,
    '证照到期提醒发出站内信', JSON.stringify(scanOnce.data ?? {}))
  const reminderMessages = sql(
    `SELECT COUNT(*) FROM agri_core.platform_message WHERE deleted = 0 AND content LIKE '%${marker}%'`,
  )
  check(Number(reminderMessages) >= 1, '站内信已落库且带证照名', `rows=${reminderMessages}`)
  const scanTwice = await (await fetch(`${BASE}:8093/api/v1/admin/uc/cert-reminders/scan`, {
    method: 'POST', headers: ADMIN_AUTH,
  })).json()
  check(scanTwice.code === 0 && Number(scanTwice.data?.messages) === 0 && Number(scanTwice.data?.skipped) >= 1,
    '重复扫描不重复发信', JSON.stringify(scanTwice.data ?? {}))

  /* ---------- 3) 校验 ---------- */
  const badDate = await call('POST', '/api/v1/sso/account/certificates', {
    merchantId,
    certType: 'business_license',
    certName: `${marker}-日期错`,
    issueDate: day(0),
    expireDate: day(-30),
  })
  check(badDate.json?.code === 400, '有效期早于发证日期被拒（400）',
    `code=${badDate.json?.code} msg=${String(badDate.json?.message ?? '').slice(0, 30)}`)

  const badType = await call('POST', '/api/v1/sso/account/certificates', {
    merchantId,
    certType: 'not_a_type',
    certName: `${marker}-类型错`,
  })
  check(badType.json?.code === 400, '未知证照类型被拒（400）', `code=${badType.json?.code}`)

  /* ---------- 4.5) 影像件：受控上传 + 外链拒绝 ---------- */
  const upload = await page.evaluate(async (mid) => {
    const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const form = new FormData()
    form.append('file', new File([bytes], 'cert-e2e.png', { type: 'image/png' }))
    const res = await fetch(`/api/v1/sso/account/businesses/${mid}/certification-files?kind=certificate`,
      { method: 'POST', credentials: 'include', body: form })
    let json = null
    try { json = await res.json() } catch { /* 非 JSON */ }
    return { status: res.status, json }
  }, merchantId)
  const fileUrl = upload.json?.data?.url ?? ''
  check(upload.json?.code === 0 && fileUrl.includes('/certification-files/certificate/'),
    '证照影像件上传成功（受控地址）', fileUrl.slice(0, 48))

  const withImage = await call('POST', '/api/v1/sso/account/certificates', {
    merchantId,
    certType: 'business_license',
    certName: `${marker}-带影像件`,
    issueDate: day(-30),
    expireDate: day(360),
    fileUrl,
  })
  check(withImage.json?.code === 0, '证照可挂接影像件', `code=${withImage.json?.code}`)
  if (withImage.json?.data?.id) {
    withImageId = withImage.json.data.id
    createdIds.push(withImageId)
  }

  const external = await call('POST', '/api/v1/sso/account/certificates', {
    merchantId,
    certType: 'other',
    certName: `${marker}-外链影像`,
    fileUrl: 'https://example.com/not-ours.png',
  })
  check(external.json?.code === 400, '任意外链影像件被拒绝（400）',
    `code=${external.json?.code} msg=${String(external.json?.message ?? '').slice(0, 24)}`)

  const previewRes = await page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: 'include' })
    return { status: res.status, type: res.headers.get('content-type') }
  }, fileUrl)
  check(previewRes.status === 200 && String(previewRes.type ?? '').includes('image/'),
    '影像件可预览（按会话鉴权）', `${previewRes.status} ${previewRes.type}`)

  /* ---------- 5) 页面渲染 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/certificates`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1800)
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('资质证照'), '「资质证照」页已打开')
  check(text.includes('即将到期'), '页面渲染出「即将到期」状态')
  check(text.includes('已过期'), '页面渲染出「已过期」状态')
  check(text.includes('长期有效'), '页面渲染出「长期有效」状态')
  check(text.includes('新增证照'), '提供「新增证照」入口')
  const tableRows = await page.evaluate(() => document.querySelectorAll('.uc-cert-table tbody tr').length)
  check(tableRows >= 3, '表格渲染出证照行', `rows=${tableRows}`)

  const thumbs = await page.evaluate(() => document.querySelectorAll('.uc-cert-thumb img').length)
  check(thumbs >= 1, '列表渲染出影像件缩略图', `imgs=${thumbs}`)
  await page.screenshot({ path: path.join(OUT, '01-cert-list.png'), fullPage: true })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('新增证照'))
    button?.click()
  })
  await page.waitForTimeout(500)
  await page.screenshot({ path: path.join(OUT, '02-cert-form.png'), fullPage: false })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.uc-cert-modal button')].find((b) => (b.textContent ?? '').includes('取消'))
    button?.click()
  })
  await page.waitForTimeout(300)
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.uc-cert-table tbody tr')]
      .find((r) => (r.textContent ?? '').includes('带影像件'))
    const button = [...(row?.querySelectorAll('button') ?? [])].find((b) => (b.textContent ?? '').includes('删除'))
    button?.click()
  })
  await page.waitForTimeout(400)
  const confirmVisible = await page.evaluate(() => Boolean(document.querySelector('.uc-cert-confirm')))
  check(confirmVisible, '删除前弹出二次确认')
  if (confirmVisible) {
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.uc-cert-confirm button')]
        .find((b) => (b.textContent ?? '').includes('取消'))
      button?.click()
    })
    await page.waitForTimeout(300)
  }


  /* ---------- 4.6) 删除证照：影像件一并清理 ---------- */
  if (withImageId) {
    const removed = await call('DELETE', `/api/v1/sso/account/certificates/${withImageId}`)
    check(removed.json?.code === 0, '删除带影像件的证照', `code=${removed.json?.code}`)
    const afterRemove = await call('GET', '/api/v1/sso/account/certificates')
    const stillThere = (afterRemove.json?.data?.records ?? []).some((r) => r.id === String(withImageId))
    check(!stillThere, '删除后证照不再出现在列表')
    const fileId = fileUrl.split('/').pop()
    const diskPath = path.join(path.resolve(OUT, '..', '..'), 'core-platform', 'uploads', 'platform', 'certification', String(merchantId), fileId)
    check(!existsSync(diskPath), '影像文件已从磁盘删除', diskPath.split('certification')[1])
    const previewAfter = await page.evaluate(async (url) => {
      const res = await fetch(url, { credentials: 'include', cache: 'no-store' })
      let body = null
      try { body = await res.json() } catch { /* 二进制或空体 */ }
      return { status: res.status, code: body?.code ?? null }
    }, fileUrl)
    check(previewAfter.status === 404 || previewAfter.code === 404, '影像件随证照删除（预览不可再取）',
      `status=${previewAfter.status} code=${previewAfter.code}`)
    const idx = createdIds.indexOf(withImageId)
    if (idx >= 0) createdIds.splice(idx, 1)
  }

  /* ---------- 4) 修改 + 删除 ---------- */
  const target = createdIds[0]
  const update = await call('PUT', `/api/v1/sso/account/certificates/${target}`, {
    merchantId,
    certType: 'business_license',
    certName: `${marker}-营业执照（已换证）`,
    expireDate: day(400),
  })
  check(update.json?.code === 0, '修改证照成功', `code=${update.json?.code}`)
  const afterUpdate = await call('GET', '/api/v1/sso/account/certificates')
  const updated = (afterUpdate.json?.data?.records ?? []).find((r) => r.id === String(target))
  check(updated?.expireState === 'valid', '换证后状态变为有效', `state=${updated?.expireState}`)

  /* ---------- 6) 人群随证照删除回落 ---------- */
  reminderCertIds.push(...createdIds)
  for (const id of [...createdIds]) {
    await call('DELETE', `/api/v1/sso/account/certificates/${id}`)
  }
  createdIds.length = 0
  const finalAudience = await certAudienceCount()
  check(finalAudience === baseAudience, '证照清理后临期人群回到基线', `base=${baseAudience} final=${finalAudience}`)

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

/* ---------- 清理 ---------- */
if (MYSQL && reminderCertIds.length > 0) {
  const inClause = reminderCertIds.map((id) => `'${id}'`).join(',')
  sql(`DELETE FROM agri_core.platform_cert_reminder WHERE cert_id IN (${inClause})`)
  sql(`DELETE FROM agri_core.platform_message WHERE content LIKE '%${marker}%'`)
}

if (MYSQL && createdIds.length > 0) {
  const inClause = createdIds.map((id) => `'${id}'`).join(',')
  sql(`DELETE FROM agri_core.platform_merchant_certificate WHERE id IN (${inClause})`)
  const left = sql(
    `SELECT COUNT(*) FROM agri_core.platform_merchant_certificate WHERE deleted = 0 AND cert_name LIKE '${marker}%'`,
  )
  console.log(`\n清理：本轮 ${createdIds.length} 张证照已删除（剩余 ${left}）`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
