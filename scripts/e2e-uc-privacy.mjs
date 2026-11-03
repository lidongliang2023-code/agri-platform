/**
 * 用户中心 · 隐私与数据 端到端验证
 *
 * 验证链路：
 *   1. 返回 2 类请求（export / deletion），初始无记录
 *   2. 提交「数据导出」→ pending；同类重复提交 → 409
 *   3. 提交「账号注销」不写理由 → 400（不可逆操作必须有理由）
 *   4. 运营端能看到待处理；办结必须有处理说明 → 400
 *   5. 办结 → 用户端状态 completed 且能看到处理说明
 *   6. 已办结不能再处理 → 400；待处理可撤回 → cancelled
 *   7. 第三方授权撤回：绑定 → 出现在 grants → 撤回 → 从 grants 消失
 *   8. 两端页面都能渲染，且运营端切「全部状态」后能看到本轮单据
 *   9. 清理本轮数据（申请单、绑定、操作日志）
 *
 * 用法：node scripts/e2e-uc-privacy.mjs
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

const marker = `隐私E2E${Date.now().toString().slice(-6)}`
const baselineId = Number(sql('SELECT IFNULL(MAX(id),0) FROM agri_core.platform_privacy_request') || 0)

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1050 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

/**
 * 两套鉴权：`/sso/account/**` 认 SSO 会话 Cookie；`/admin/**` 在 SUPER_ADMIN_ONLY
 * 白名单里只认 Bearer。对 /admin/** 先用 HttpOnly 刷新凭证换令牌（不新建会话）。
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
  const init = await call('GET', '/api/v1/sso/account/privacy-requests')
  const types = init.json?.data?.types ?? []
  check(init.json?.code === 0, '隐私接口可用', `code=${init.json?.code}`)
  check(types.length === 2, '返回 2 类请求', `count=${types.length}`)
  check(
    types.map((t) => t.code).join(',') === 'export,deletion',
    '类型为 export / deletion',
    types.map((t) => t.code).join(','),
  )
  check(
    types.every((t) => typeof t.description === 'string' && t.description.length > 10),
    '每类都带说明文案（页面不自己编）',
  )

  /* ---------- 2) 提交数据导出 ---------- */
  const exp = await call('POST', '/api/v1/sso/account/privacy-requests', {
    requestType: 'export',
    reason: marker,
    scope: '账号资料 + 近一年订单',
  })
  check(exp.json?.code === 0, '提交「数据导出」成功',
    `code=${exp.json?.code} msg=${exp.json?.message ?? ''}`)
  const exportId = exp.json?.data?.id

  const dup = await call('POST', '/api/v1/sso/account/privacy-requests', {
    requestType: 'export',
    reason: '重复提交',
  })
  check(dup.json?.code === 409, '同类未办结申请重复提交被拒（409）',
    `code=${dup.json?.code} msg=${String(dup.json?.message ?? '').slice(0, 24)}`)

  /* ---------- 3) 注销必须有理由 ---------- */
  const delNoReason = await call('POST', '/api/v1/sso/account/privacy-requests', {
    requestType: 'deletion',
  })
  check(delNoReason.json?.code === 400, '注销不写理由被拒（400）', `code=${delNoReason.json?.code}`)

  const badType = await call('POST', '/api/v1/sso/account/privacy-requests', {
    requestType: 'nonsense',
    reason: marker,
  })
  check(badType.json?.code === 400, '非法类型被拒（400）', `code=${badType.json?.code}`)

  const dbRow = sql(
    `SELECT request_type,status FROM agri_core.platform_privacy_request WHERE id=${exportId}`,
  )
  check(dbRow.includes('pending'), '申请单已落库（直连 MySQL 复核）', dbRow)

  /* ---------- 4) 运营端看到待处理 ---------- */
  const opsList = await call('GET', '/api/v1/admin/privacy-requests?pageNum=1&pageSize=100&status=pending')
  const opsRows = opsList.json?.data?.records ?? []
  check(opsList.json?.code === 0, '运营端申请列表可用', `code=${opsList.json?.code}`)
  const target = opsRows.find((r) => r.id === String(exportId))
  check(Boolean(target), '运营端能看到这条待处理',
    target ? `申请人=${target.applicantName}` : `rows=${opsRows.length}`)

  const noRemark = await call('POST', `/api/v1/admin/privacy-requests/${exportId}/handle`, {
    status: 'completed',
  })
  check(noRemark.json?.code === 400, '办结不写处理说明被拒（400）', `code=${noRemark.json?.code}`)

  const badStatus = await call('POST', `/api/v1/admin/privacy-requests/${exportId}/handle`, {
    status: 'pending',
    remark: '想改回待处理',
  })
  check(badStatus.json?.code === 400, '非法流转状态被拒（400）', `code=${badStatus.json?.code}`)

  /* ---------- 5) 办结 ---------- */
  const done = await call('POST', `/api/v1/admin/privacy-requests/${exportId}/handle`, {
    status: 'completed',
    remark: '导出文件已通过邮箱发送，请注意查收。',
  })
  check(done.json?.code === 0, '办结成功', `code=${done.json?.code} msg=${done.json?.message ?? ''}`)

  const afterDone = await call('GET', '/api/v1/sso/account/privacy-requests')
  const doneRow = (afterDone.json?.data?.records ?? []).find((r) => r.id === String(exportId))
  check(doneRow?.status === 'completed', '用户端状态变为「已办结」', `status=${doneRow?.status}`)
  check(
    (doneRow?.handleRemark ?? '').includes('邮箱发送'),
    '用户端能看到处理说明',
    String(doneRow?.handleRemark ?? '').slice(0, 20),
  )
  check(Boolean(doneRow?.handlerName), '带回了处理人', String(doneRow?.handlerName ?? ''))

  const again = await call('POST', `/api/v1/admin/privacy-requests/${exportId}/handle`, {
    status: 'rejected',
    remark: '再处理一次',
  })
  check(again.json?.code === 400, '已办结不能再处理（400）', `code=${again.json?.code}`)

  /* ---------- 6) 注销申请可撤回 ---------- */
  const del = await call('POST', '/api/v1/sso/account/privacy-requests', {
    requestType: 'deletion',
    reason: '不再使用本平台',
  })
  check(del.json?.code === 0, '提交「账号注销」成功', `code=${del.json?.code}`)
  const delId = del.json?.data?.id
  const cancel = await call('DELETE', `/api/v1/sso/account/privacy-requests/${delId}`)
  check(cancel.json?.code === 0, '撤回注销申请成功', `code=${cancel.json?.code}`)

  const afterCancel = await call('GET', '/api/v1/sso/account/privacy-requests')
  const cancelled = (afterCancel.json?.data?.records ?? []).find((r) => r.id === String(delId))
  check(cancelled?.status === 'cancelled', '撤回后状态为「已撤回」', `status=${cancelled?.status}`)

  /* ---------- 7) 第三方授权撤回（真实动作） ---------- */
  const bind = await call('POST', '/api/v1/sso/account/bindings', {
    provider: 'dingtalk',
    externalAccount: marker,
    displayName: marker,
  })
  check(bind.json?.code === 0, '绑定钉钉（准备撤回授权）', `code=${bind.json?.code}`)

  const withGrant = await call('GET', '/api/v1/sso/account/privacy-requests')
  const grants = withGrant.json?.data?.grants ?? []
  check(grants.some((g) => g.provider === 'dingtalk'), '授权列表出现该渠道', `count=${grants.length}`)

  const revoke = await call('DELETE', '/api/v1/sso/account/bindings/dingtalk')
  check(revoke.json?.code === 0, '撤回授权成功', `code=${revoke.json?.code}`)

  const afterRevoke = await call('GET', '/api/v1/sso/account/privacy-requests')
  const grantsAfter = afterRevoke.json?.data?.grants ?? []
  check(!grantsAfter.some((g) => g.provider === 'dingtalk'), '撤回后授权列表不再包含该渠道')

  /* ---------- 8) 用户端页面 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/privacy`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const userText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(userText.includes('隐私与数据'), '「隐私与数据」页已打开')
  check(userText.includes('数据导出') && userText.includes('账号注销'), '渲染两类申请入口')
  check(userText.includes('第三方授权'), '渲染第三方授权区块')
  check(userText.includes(marker), '渲染出本轮提交的理由', marker)
  check(userText.includes('邮箱发送'), '用户端显示运营的处理说明')
  check(userText.includes('已办结'), '页面显示「已办结」状态')
  check(
    userText.includes('不会在提交时自动导出或删除'),
    '页面显式声明不会自动执行（不误导）',
  )

  /* ---------- 9) 运营端页面 ---------- */
  await page.goto(`${OPS}/`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.locator('text=关联系统（只读）').first().click()
  await page.waitForTimeout(500)
  const menuText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(menuText.includes('隐私与数据申请'), '运营端菜单含「隐私与数据申请」')

  await page.goto(`${OPS}/uc/privacy`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const opsText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(opsText.includes('隐私与数据申请'), '「隐私与数据申请」页已打开')
  check(!opsText.includes('页面不存在'), '不是兜底 404')
  check(!/加载失败|未认证|凭证已失效/.test(opsText), '运营端页面无鉴权报错',
    opsText.match(/加载失败|未认证|凭证已失效/)?.[0] ?? '')

  /* 默认筛选是「待处理」，本轮两条都已终态 —— 切「全部状态」必须能看到，
     否则说明 ensureToken/取数没真正生效（只看标题验不出来）。 */
  await page.locator('select.filter-select').first().selectOption('all')
  await page.waitForTimeout(1800)
  const allText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(allText.includes(marker), '切换「全部状态」后能看到本轮申请', marker)
  check(allText.includes('邮箱发送'), '运营端也显示处理说明')

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  await browser.close()
}

/* ---------- 清理 ---------- */
if (MYSQL) {
  const before = sql(`SELECT COUNT(*) FROM agri_core.platform_privacy_request WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_privacy_request WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_user_binding WHERE external_account LIKE '${marker}%'`)
  sql(`DELETE FROM agri_core.platform_user_operation_log WHERE action IN ('privacy_request','privacy_cancel')`)
  const left = sql(`SELECT COUNT(*) FROM agri_core.platform_privacy_request WHERE reason LIKE '${marker}%'`)
  console.log(`\n清理：本轮新增申请 ${before} 条已删除（剩余 ${left}）`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
