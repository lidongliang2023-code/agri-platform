/**
 * 用户中心 · 第三方绑定 端到端验证
 *
 * 验证链路：
 *   1. 列表返回**全部三个渠道**（含未绑定），页面才能渲染"去绑定"
 *   2. 绑定 → 落库（直连 MySQL 复核）
 *   3. 同渠道再绑一次 = 改绑（不新增行）
 *   4. 解绑 → 状态置 unbound，列表回到未绑定
 *   5. 页面渲染：提示文案、三个渠道、"已绑定"标记
 *   6. 清理：删掉本轮造的绑定行
 *
 * 用法：node scripts/e2e-uc-bindings.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

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
const USER = 'admin'
const PASSWORD = 'Admin@123'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1000 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

/** 在页面上下文里调接口（账号中心认 SSO Cookie） */
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

const marker = `oE2E${Date.now().toString().slice(-8)}`

try {
  /* ---------- 登录 ---------- */
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill(USER)
  await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  check(!page.url().includes('/sso/index.html'), 'SSO 登录成功')

  /* ---------- 1) 初始列表：三个渠道都在 ---------- */
  const list0 = await call('GET', '/api/v1/sso/account/bindings')
  const rows0 = list0.json?.data ?? []
  check(list0.json?.code === 0, '绑定列表接口可用', `code=${list0.json?.code}`)
  check(rows0.length === 3, '返回全部 3 个渠道（含未绑定）', `rows=${rows0.length}`)
  check(
    rows0.every((r) => ['wechat', 'alipay', 'dingtalk'].includes(r.provider)),
    '渠道为 微信/支付宝/钉钉',
    rows0.map((r) => r.providerLabel).join(' / '),
  )

  /* ---------- 2) 绑定 ---------- */
  const bind1 = await call('POST', '/api/v1/sso/account/bindings', {
    provider: 'wechat',
    externalAccount: marker,
    displayName: 'E2E微信',
  })
  check(bind1.json?.code === 0, '绑定接口返回成功', `code=${bind1.json?.code} msg=${bind1.json?.message ?? ''}`)
  check(bind1.json?.data?.created === true, '首次绑定标记为新建', `created=${bind1.json?.data?.created}`)

  const list1 = await call('GET', '/api/v1/sso/account/bindings')
  const wechat1 = (list1.json?.data ?? []).find((r) => r.provider === 'wechat')
  check(wechat1?.bound === true, '列表显示微信已绑定')
  check(wechat1?.externalAccount === marker, '回显外部账号标识', String(wechat1?.externalAccount ?? ''))

  const db1 = sql(
    `SELECT provider,external_account,bind_status FROM agri_core.platform_user_binding WHERE external_account='${marker}'`,
  )
  check(db1.includes('wechat') && db1.includes('bound'), '绑定已落库（直连 MySQL 复核）', db1)

  /* ---------- 3) 改绑：不新增行 ---------- */
  const newAccount = `${marker}X`
  const bind2 = await call('POST', '/api/v1/sso/account/bindings', {
    provider: 'wechat',
    externalAccount: newAccount,
    displayName: 'E2E微信改绑',
  })
  check(bind2.json?.code === 0, '改绑接口返回成功', `code=${bind2.json?.code}`)
  check(bind2.json?.data?.created === false, '同渠道再绑走的是改绑（不新建）', `created=${bind2.json?.data?.created}`)
  const rowCount = sql(
    `SELECT COUNT(*) FROM agri_core.platform_user_binding WHERE provider='wechat' AND deleted=0 AND bind_status='bound'`,
  )
  check(Number(rowCount) === 1, '同渠道只有一条有效绑定', `rows=${rowCount}`)

  /* ---------- 4) 页面渲染 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/bindings`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1800)
  const pageText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(pageText.includes('第三方绑定'), '「第三方绑定」页已打开')
  check(pageText.includes('未接入第三方 OAuth'), '页面明确说明未接入 OAuth（不误导用户）')
  for (const label of ['微信', '支付宝', '钉钉']) {
    check(pageText.includes(label), `页面渲染渠道「${label}」`)
  }
  check(pageText.includes('已绑定'), '已绑定的渠道有标记')
  check(pageText.includes(newAccount), '页面显示改绑后的账号标识', newAccount)

  /* ---------- 5) 解绑 ---------- */
  const unbind = await call('DELETE', '/api/v1/sso/account/bindings/wechat')
  check(unbind.json?.code === 0, '解绑接口返回成功', `code=${unbind.json?.code}`)
  const list2 = await call('GET', '/api/v1/sso/account/bindings')
  const wechat2 = (list2.json?.data ?? []).find((r) => r.provider === 'wechat')
  check(wechat2?.bound === false, '解绑后列表回到未绑定')
  const db2 = sql(
    `SELECT bind_status FROM agri_core.platform_user_binding WHERE external_account='${newAccount}'`,
  )
  check(db2 === 'unbound', '解绑状态已落库（保留留痕）', `bind_status=${db2}`)

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

/* ---------- 清理 ---------- */
if (MYSQL) {
  sql(`DELETE FROM agri_core.platform_user_binding WHERE external_account LIKE '${marker}%'`)
  const left = sql(`SELECT COUNT(*) FROM agri_core.platform_user_binding WHERE external_account LIKE '${marker}%'`)
  console.log(`\n清理：e2e 绑定记录已删除（剩余 ${left}）`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
