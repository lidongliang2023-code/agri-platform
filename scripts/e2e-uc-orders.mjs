/**
 * 用户中心 · 订单聚合 端到端验证
 *
 * 验证链路：
 *   1. 来源清单：3 个来源，只有交易域 enabled，另两个带"为什么没接"的原因
 *   2. 状态口径与交易域真实取值一致（不臆造"待付款/待发货"）
 *   3. 交易域订单接口可用，且**范围由服务端推导**：不传 participantId 也能拿到自己名下的单
 *   4. 页面渲染：订单号/金额/状态出现在页面上，条数与接口返回一致
 *   5. 统计卡数字与已取回数据逐状态统计一致（页面口径已注明"仅当前页"）
 *   6. 未接入来源在页面上写明原因（不假装已聚合）
 *   7. 按状态筛选真的会过滤（点「已退款」后列表里不应出现「待确认」的单）
 *
 * 只读校验，不写库。
 *
 * 用法：node scripts/e2e-uc-orders.mjs
 */
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

const BASE = 'http://localhost'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1050 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

/** 交易域成功码是 200，平台侧是 0，两个都认 */
const ok = (body) => body?.code === 0 || body?.code === 200

const call = (url, token) =>
  page.evaluate(
    async ({ u, t }) => {
      const headers = t ? { Authorization: `Bearer ${t}` } : {}
      const res = await fetch(u, { credentials: 'include', headers })
      let json = null
      try {
        json = await res.json()
      } catch {
        /* 非 JSON */
      }
      return { status: res.status, json }
    },
    { u: url, t: token },
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

  /* ---------- 1) 来源清单 ---------- */
  const meta = await call('/api/v1/sso/account/orders/sources')
  const sources = meta.json?.data?.sources ?? []
  const statuses = meta.json?.data?.statuses ?? []
  check(meta.json?.code === 0, '来源清单接口可用', `code=${meta.json?.code}`)
  check(sources.length === 3, '返回 3 个候选来源', `count=${sources.length}`)
  check(
    sources.filter((s) => s.enabled).map((s) => s.code).join(',') === 'trade',
    '只接入交易域',
    sources.filter((s) => s.enabled).map((s) => s.code).join(','),
  )
  check(
    sources.filter((s) => !s.enabled).every((s) => typeof s.reason === 'string' && s.reason.length > 10),
    '未接入的来源都写明了原因（不是空白占位）',
  )
  // 平台侧把 Long 序列化成字符串（避免 JS 精度丢失），这里按数值比较
  check(Number(meta.json?.data?.enabledCount) === 1, 'enabledCount 与逐项统计一致',
    `=${meta.json?.data?.enabledCount} (${typeof meta.json?.data?.enabledCount})`)

  /* ---------- 2) 状态口径 ---------- */
  check(statuses.length === 5, '下发 5 个状态口径', `count=${statuses.length}`)
  check(
    statuses.map((s) => s.code).join(',') === 'pending_confirm,shipped,received,refunded,cancelled',
    '状态编码与交易域真实取值一致',
    statuses.map((s) => s.code).join(','),
  )

  /* ---------- 3) 交易域订单：范围由服务端推导 ---------- */
  const token = await page.evaluate(async () => {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const j = await res.json().catch(() => null)
    return j?.data?.accessToken ?? ''
  })
  check(token.length > 0, '换取到平台访问令牌')

  const orders = await call('/api/trade/order/page?pageNum=1&pageSize=50', token)
  const records = orders.json?.data?.records ?? []
  check(ok(orders.json), '交易域订单接口可用（成功码 200）', `code=${orders.json?.code}`)
  check(records.length > 0, '当前账号名下有订单', `count=${records.length}`)

  const mine = await call('/api/trade/identity/my-merchants', token)
  const merchantIds = (mine.json?.data ?? []).map((r) => String(r.merchantId))
  check(merchantIds.length > 0, '拿到当前账号的主体范围', merchantIds.join(','))

  /* 每条订单都必须与我名下的主体有关 —— 这是"聚合"不是"全平台列表"的分界线 */
  const unrelated = records.filter(
    (o) => !merchantIds.includes(String(o.buyerId)) && !merchantIds.includes(String(o.sellerId)),
  )
  check(unrelated.length === 0, '返回的订单都与我名下主体有关（不是全平台）',
    unrelated.length ? `越界 ${unrelated.length} 条` : `检查 ${records.length} 条`)

  /* ---------- 4) 页面渲染 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/orders`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2500)
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('笔订单'), '「订单聚合」页已打开')
  check(!/加载失败|请求失败/.test(text), '页面无加载失败提示',
    text.match(/加载失败|请求失败/)?.[0] ?? '')

  /* 第一笔订单的订单号必须真的出现在页面上 */
  const first = records[0]
  check(text.includes(first.orderNo), '页面渲染出真实订单号', first.orderNo)
  check(text.includes(`¥${Number(first.totalAmount ?? 0).toFixed(2)}`), '页面渲染出订单金额',
    `¥${Number(first.totalAmount ?? 0).toFixed(2)}`)

  /* 条数：页面上出现的订单号个数应与接口返回一致（最多 50） */
  const renderedNos = records.filter((o) => text.includes(o.orderNo)).length
  check(renderedNos === records.length, '页面订单条数与接口一致',
    `页面 ${renderedNos} / 接口 ${records.length}`)

  /* ---------- 5) 统计卡 ---------- */
  const counts = {}
  for (const o of records) counts[o.orderStatus] = (counts[o.orderStatus] ?? 0) + 1
  for (const meta2 of statuses) {
    const expected = counts[meta2.code] ?? 0
    const matched = new RegExp(`${meta2.label}\\s*${expected}(?!\\d)`).test(text)
    check(matched, `统计卡「${meta2.label}」= ${expected}`, matched ? '' : '数字与逐条统计不一致')
  }

  /* ---------- 6) 未接入来源写明原因 ---------- */
  const pendingSources = sources.filter((s) => !s.enabled)
  check(text.includes('未纳入聚合的来源'), '页面有「未纳入聚合」区块')
  for (const s of pendingSources) {
    check(text.includes(s.name), `列出未接入来源「${s.name}」`)
  }
  check(
    text.includes('没有账号/主体字段') || text.includes('未打通'),
    '页面上写明了未接入的具体原因（不是"暂不支持"这种空话）',
  )

  /* ---------- 7) 筛选真的生效 ---------- */
  const filterTarget = statuses.find((s) => (counts[s.code] ?? 0) > 0 && (counts[s.code] ?? 0) < records.length)
  if (filterTarget) {
    const before = text
    await page.locator('.uc-ord-stats li', { hasText: filterTarget.label }).first().click()
    await page.waitForTimeout(800)
    const filtered = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    const others = records.filter((o) => o.orderStatus !== filterTarget.code)
    const leaked = others.filter((o) => filtered.includes(o.orderNo))
    check(leaked.length === 0, `按「${filterTarget.label}」筛选后不出现其他状态`,
      leaked.length ? `漏出 ${leaked.length} 条` : `目标 ${counts[filterTarget.code]} 条`)
    check(filtered !== before, '筛选后页面内容确实变化')
    check(filtered.includes(`按「${filterTarget.label}」筛选`), '显示当前筛选条件')
  } else {
    check(false, '没有可用的筛选目标（数据分布不满足验证条件）')
  }

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  await browser.close()
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
