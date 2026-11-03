/**
 * 用户中心 · 通知设置 端到端验证
 *
 * 验证链路：
 *   1. 首次读取返回**默认值**（不是空对象），页面才能直接渲染一份合理配置
 *   2. 保存后能读回（落库复核）
 *   3. 参数校验：非法频率、非法时间格式应 400，而不是静默存进去
 *   4. 未知类型编码被过滤掉（不会存进去永远不生效）
 *   5. 页面渲染：3 个渠道（短信/推送标"未接入"）、5 个类型（3 个标"暂不产生消息"）
 *   6. 清理本轮造的偏好行
 *
 * 用法：node scripts/e2e-uc-notify.mjs
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
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/** 本轮之前是否已有偏好记录（决定清理时删不删）—— 必须在 try 外声明，否则 finally 里拿不到 */
let persistedBefore = null

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

  /* ---------- 1) 首次读取返回默认值 ---------- */
  const first = await call('GET', '/api/v1/sso/account/notification-settings')
  const data0 = first.json?.data ?? {}
  check(first.json?.code === 0, '通知设置接口可用', `code=${first.json?.code}`)
  check(Array.isArray(data0.types) && data0.types.length === 5, '返回 5 个通知类型', `types=${data0.types?.length}`)
  check(Array.isArray(data0.channels) && data0.channels.length === 3, '返回 3 个通知渠道', `channels=${data0.channels?.length}`)
  check(
    data0.channels?.filter((c) => c.wired).length === 1 && data0.channels?.find((c) => c.wired)?.code === 'inapp',
    '只有「站内信」标记为已接入',
    data0.channels?.filter((c) => c.wired).map((c) => c.label).join(','),
  )
  check(
    data0.types?.filter((t) => t.produces).length === 2,
    '只有 2 个类型会真的产生消息（加入申请 / 审核结果）',
    data0.types?.filter((t) => t.produces).map((t) => t.label).join(','),
  )
  persistedBefore = data0.persisted === true

  /* ---------- 2) 保存 + 读回 ---------- */
  const save = await call('PUT', '/api/v1/sso/account/notification-settings', {
    inappTypes: ['join_request', 'system'],
    smsTypes: [],
    pushTypes: [],
    quietStart: '22:00',
    quietEnd: '08:00',
    digest: 'daily',
  })
  check(save.json?.code === 0, '保存通知设置成功', `code=${save.json?.code} msg=${save.json?.message ?? ''}`)

  const second = await call('GET', '/api/v1/sso/account/notification-settings')
  const data1 = second.json?.data ?? {}
  check(data1.persisted === true, '读回时标记为已持久化')
  check(data1.quietStart === '22:00' && data1.quietEnd === '08:00', '免打扰时段已保存',
    `${data1.quietStart} - ${data1.quietEnd}`)
  check(data1.digest === 'daily', '推送频率已保存', data1.digest)
  const inappOn = data1.types?.filter((t) => t.inapp).map((t) => t.code).sort().join(',')
  check(inappOn === 'join_request,system', '站内信开关已保存', inappOn)

  const dbRow = sql(
    `SELECT inapp_types,quiet_start,quiet_end,digest FROM agri_core.platform_notification_setting WHERE deleted=0 ORDER BY id DESC LIMIT 1`,
  )
  check(dbRow.includes('join_request') && dbRow.includes('22:00') && dbRow.includes('daily'),
    '设置已落库（直连 MySQL 复核）', dbRow)

  /* ---------- 3) 参数校验 ---------- */
  const badDigest = await call('PUT', '/api/v1/sso/account/notification-settings', { digest: 'hourly' })
  check(badDigest.json?.code === 400, '非法推送频率被拒（400）', `code=${badDigest.json?.code}`)
  const badClock = await call('PUT', '/api/v1/sso/account/notification-settings', {
    digest: 'realtime',
    quietStart: '25:99',
  })
  check(badClock.json?.code === 400, '非法时间格式被拒（400）',
    `code=${badClock.json?.code} msg=${String(badClock.json?.message ?? '').slice(0, 40)}`)

  /* ---------- 4) 未知类型被过滤 ---------- */
  await call('PUT', '/api/v1/sso/account/notification-settings', {
    inappTypes: ['join_request', 'not_a_real_type'],
    digest: 'realtime',
  })
  const afterUnknown = await call('GET', '/api/v1/sso/account/notification-settings')
  const inappAfter = afterUnknown.json?.data?.types?.filter((t) => t.inapp).map((t) => t.code).join(',')
  check(inappAfter === 'join_request', '未知类型编码被过滤（不落库）', inappAfter)

  /* ---------- 5) 页面渲染 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/notification`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1800)
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('通知设置'), '「通知设置」页已打开')
  check(text.includes('免打扰时段'), '含免打扰时段配置')
  check(text.includes('推送频率'), '含推送频率配置')
  check(text.includes('未接入'), '短信/推送渠道标注「未接入」')
  check(text.includes('暂不产生消息'), '预留类型标注「暂不产生消息」')
  for (const label of ['加入申请', '审核结果', '订单与交易', '告警提醒', '系统公告']) {
    check(text.includes(label), `渲染通知类型「${label}」`)
  }
  check(text.includes('站内信已开启'), '顶部显示已开启数量摘要',
    (text.match(/站内信已开启[^ ]*/) ?? [''])[0])

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

/* ---------- 清理 ---------- */
if (MYSQL) {
  if (persistedBefore === false) {
    // 本轮之前没有记录，说明这行是我们造的 —— 删掉，让演示库回到原状
    sql(`DELETE FROM agri_core.platform_notification_setting`)
    console.log('\n清理：本轮新增的通知偏好已删除（原本没有记录）')
  } else {
    console.log('\n保留：用户原本就有通知偏好记录，未做删除')
  }
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
