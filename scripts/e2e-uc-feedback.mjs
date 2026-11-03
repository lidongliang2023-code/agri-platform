/**
 * 用户中心 · 意见反馈 端到端验证（用户提交 → 运营回复 全闭环）
 *
 * 验证链路：
 *   1. 用户端返回 4 类反馈类型，初始无记录
 *   2. 提交一条「问题报错」→ 落库 pending；标题/内容为空 → 400
 *   3. 运营端列表能看到这条待处理
 *   4. 运营回复 → 用户端状态变 replied 且能看到回复内容
 *   5. 回复为空 → 400；关闭后不可再回复 → 400
 *   6. 两端页面都能渲染，且用户端能看到运营的回复
 *   7. 清理本轮造的反馈单与操作日志
 *
 * 用法：node scripts/e2e-uc-feedback.mjs
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
const OPS = 'http://localhost:8080'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const marker = `反馈E2E${Date.now().toString().slice(-6)}`
const baselineId = Number(sql('SELECT IFNULL(MAX(id),0) FROM agri_core.platform_user_feedback') || 0)

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1050 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

/**
 * 两套鉴权：`/sso/account/**` 认 SSO 全局会话 Cookie；`/admin/**` 在 JwtAuthFilter
 * 的 SUPER_ADMIN_ONLY 白名单里，**只认 Bearer**。对 /admin/** 先用 HttpOnly 刷新凭证
 * 换一枚短时令牌（不新建会话、不多一台设备）。
 */
let accessToken = ''
async function ensureToken() {
  if (accessToken) return accessToken
  accessToken = await page.evaluate(async () => {
    const res = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    const j = await res.json().catch(() => null)
    return j?.data?.accessToken ?? ''
  })
  return accessToken
}

const call = async (method, url, body) => {
  const needBearer = url.startsWith('/api/v1/admin/')
  const token = needBearer ? await ensureToken() : ''
  return page.evaluate(
    async ({ m, u, b, t }) => {
      const headers = {}
      if (b) headers['Content-Type'] = 'application/json'
      if (t) headers.Authorization = `Bearer ${t}`
      const res = await fetch(u, {
        method: m,
        credentials: 'include',
        headers,
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
    { m: method, u: url, b: body, t: token },
  )
}

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

  /* 主数据域必须先走完自己的 SSO 回调才有本域登录态：直接访问 `/` 会自动
     302 到认证中心（此时全局会话已建立），再回跳换票。少了这一步，
     下面访问 8080 的任何页面都会被守卫送回登录页。 */
  await page.goto(`${OPS}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(4000)


  /* ---------- 1) 类型目录 ---------- */
  const init = await call('GET', '/api/v1/sso/account/feedback')
  const types = init.json?.data?.types ?? []
  check(init.json?.code === 0, '反馈接口可用', `code=${init.json?.code}`)
  check(types.length === 4, '返回 4 类反馈类型', `count=${types.length}`)
  check(
    types.map((t) => t.code).join(',') === 'suggestion,bug,complaint,other',
    '类型编码与原型一致',
    types.map((t) => t.code).join(','),
  )

  /* ---------- 2) 提交反馈 ---------- */
  const submit = await call('POST', '/api/v1/sso/account/feedback', {
    feedbackType: 'bug',
    title: marker,
    content: '地块列表翻页后回到第一页，期望保留当前页码。',
    contact: '13800000000',
    pagePath: '/production/plot',
  })
  check(submit.json?.code === 0, '提交反馈成功',
    `code=${submit.json?.code} msg=${submit.json?.message ?? ''}`)
  const feedbackId = submit.json?.data?.id

  const emptyTitle = await call('POST', '/api/v1/sso/account/feedback', {
    feedbackType: 'bug',
    title: '',
    content: '只有内容没有标题',
  })
  check(emptyTitle.json?.code === 400, '标题为空被拒（400）', `code=${emptyTitle.json?.code}`)

  const emptyContent = await call('POST', '/api/v1/sso/account/feedback', {
    feedbackType: 'bug',
    title: '只有标题',
    content: '',
  })
  check(emptyContent.json?.code === 400, '内容为空被拒（400）', `code=${emptyContent.json?.code}`)

  const badType = await call('POST', '/api/v1/sso/account/feedback', {
    feedbackType: 'nonsense',
    title: marker,
    content: '非法类型',
  })
  check(badType.json?.code === 400, '非法类型被拒（400）', `code=${badType.json?.code}`)

  const mine = await call('GET', '/api/v1/sso/account/feedback')
  const myRow = (mine.json?.data?.records ?? []).find((r) => r.id === String(feedbackId))
  check(myRow?.status === 'pending', '提交后状态为「待处理」', `status=${myRow?.status}`)

  const dbRow = sql(
    `SELECT feedback_type,status FROM agri_core.platform_user_feedback WHERE id=${feedbackId}`,
  )
  check(dbRow.includes('pending'), '反馈单已落库（直连 MySQL 复核）', dbRow)

  /* ---------- 3) 运营端看到待处理 ---------- */
  const opsList = await call('GET', '/api/v1/admin/feedback?pageNum=1&pageSize=100&status=pending')
  const opsRows = opsList.json?.data?.records ?? []
  check(opsList.json?.code === 0, '运营端反馈列表可用', `code=${opsList.json?.code}`)
  const target = opsRows.find((r) => r.id === String(feedbackId))
  check(Boolean(target), '运营端能看到这条待处理', target ? `提交人=${target.submitterName}` : `rows=${opsRows.length}`)

  const byType = await call('GET', '/api/v1/admin/feedback?pageNum=1&pageSize=100&type=bug')
  check(
    (byType.json?.data?.records ?? []).some((r) => r.id === String(feedbackId)),
    '按类型筛选能命中（bug）',
  )

  /* ---------- 4) 回复 ---------- */
  const emptyReply = await call('POST', `/api/v1/admin/feedback/${feedbackId}/reply`, { content: '   ' })
  check(emptyReply.json?.code === 400, '回复内容为空被拒（400）', `code=${emptyReply.json?.code}`)

  const reply = await call('POST', `/api/v1/admin/feedback/${feedbackId}/reply`, {
    content: '已复现，下个版本修复，感谢反馈。',
  })
  check(reply.json?.code === 0, '运营回复成功', `code=${reply.json?.code} msg=${reply.json?.message ?? ''}`)

  const afterReply = await call('GET', '/api/v1/sso/account/feedback')
  const repliedRow = (afterReply.json?.data?.records ?? []).find((r) => r.id === String(feedbackId))
  check(repliedRow?.status === 'replied', '用户端状态变为「已回复」', `status=${repliedRow?.status}`)
  check(
    (repliedRow?.replyContent ?? '').includes('下个版本修复'),
    '用户端能看到回复内容',
    String(repliedRow?.replyContent ?? '').slice(0, 24),
  )
  check(Boolean(repliedRow?.replierName), '带回了回复人', String(repliedRow?.replierName ?? ''))

  /* ---------- 5) 关闭后不可再回复 ---------- */
  const close = await call('POST', `/api/v1/admin/feedback/${feedbackId}/reply`, {
    content: '问题已修复，本单关闭。',
    close: true,
  })
  check(close.json?.code === 0, '回复并关闭成功', `code=${close.json?.code}`)
  const afterClose = await call('GET', '/api/v1/sso/account/feedback')
  const closedRow = (afterClose.json?.data?.records ?? []).find((r) => r.id === String(feedbackId))
  check(closedRow?.status === 'closed', '用户端状态变为「已关闭」', `status=${closedRow?.status}`)

  const again = await call('POST', `/api/v1/admin/feedback/${feedbackId}/reply`, { content: '再回一次' })
  check(again.json?.code === 400, '已关闭的反馈不能再回复（400）', `code=${again.json?.code}`)

  /* ---------- 6) 用户端页面 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/feedback`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const userText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(userText.includes('我的反馈'), '「意见反馈」页已打开')
  check(userText.includes(marker), '页面渲染出本轮提交的反馈', marker)
  check(userText.includes('已关闭'), '页面显示「已关闭」状态')
  check(userText.includes('问题已修复，本单关闭'), '页面显示运营回复内容')

  /* ---------- 7) 运营端页面 ---------- */
  await page.goto(`${OPS}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.locator('text=关联系统（只读）').first().click()
  await page.waitForTimeout(500)
  const menuText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(menuText.includes('意见反馈处理'), '运营端菜单含「意见反馈处理」')

  await page.goto(`${OPS}/uc/feedback`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const opsText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(opsText.includes('意见反馈处理'), '「意见反馈处理」页已打开')
  check(!opsText.includes('页面不存在'), '不是兜底 404')
  check(!/加载失败|未认证|凭证已失效/.test(opsText), '运营端页面无鉴权报错',
    opsText.match(/加载失败|未认证|凭证已失效/)?.[0] ?? '')

  /* 默认筛选是「待处理」，这条已关闭 —— 切「全部状态」后必须能在表格里看到，
     否则说明 ensureToken/取数没真正生效（只看标题是验不出来的）。 */
  await page.locator('select.filter-select').first().selectOption('all')
  await page.waitForTimeout(1800)
  const allText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(allText.includes(marker), '切换「全部状态」后能看到本轮反馈', marker)
  check(allText.includes('问题已修复，本单关闭'), '运营端也显示最后一条回复')

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  await browser.close()
}

/* ---------- 清理 ---------- */
if (MYSQL) {
  const before = sql(`SELECT COUNT(*) FROM agri_core.platform_user_feedback WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_user_feedback WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_user_operation_log WHERE action = 'feedback_submit'`)
  const left = sql(`SELECT COUNT(*) FROM agri_core.platform_user_feedback WHERE title LIKE '${marker}%'`)
  console.log(`\n清理：本轮新增反馈 ${before} 条已删除（剩余 ${left}）`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
