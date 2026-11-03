/**
 * 用户中心 · 消息中心 端到端验证
 *
 * 验证链路（全部走真实代码路径，不插假数据）：
 *   1. admin 创建一个经营主体（admin 成为 owner）
 *   2. farmer 向该主体提交加入申请
 *   3. 后端 notifyMerchantOwners → 给 owner 写一条站内信（platform_message）
 *   4. admin 的 /api/v1/messages 能读到这条消息，unread-count ≥ 1
 *   5. 账号中心「消息中心」页面把它渲染出来
 *   6. 清理本轮造的数据（主体 / 绑定 / 申请 / 站内信）
 *
 * 用法：node scripts/e2e-uc-messages.mjs [--keep]
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

const BASE = 'http://localhost'
const KEEP = process.argv.includes('--keep')
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sql = (q) => {
  if (!MYSQL) return ''
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q], {
      encoding: 'utf8',
    }).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 100)}`
  }
}

const stamp = Date.now().toString().slice(-8)
const marker = `E2E消息联调-${stamp}`
// 统一社会信用代码必须 15-18 位字母数字，且全局唯一（后端会拒重复）
const creditCode = `91370811MA${stamp}`
const created = { merchantId: null, joinId: null, messageIds: [] }

/** 在浏览器里用 SSO 会话调接口（账号中心认的是全局会话 Cookie，不是 accessToken） */
async function ssoLogin(page, username, password) {
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill(username)
  await page.locator('input[placeholder*="登录密码"]').first().fill(password)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  return !page.url().includes('/sso/index.html')
}

/**
 * 在页面上下文里发请求，返回解析后的 body。
 *
 * <p>会先尝试用 HttpOnly 刷新凭证换一个平台访问令牌并带上 Authorization ——
 * `/api/v1/messages` 认的是 Bearer 令牌，只有 SSO Cookie 会 401；
 * 而 `/api/v1/sso/account/**` 只认 Cookie，多带一个头也不影响。</p>
 */
async function call(page, method, url, body) {
  return page.evaluate(
    async ({ method: m, url: u, body: b }) => {
      let token = null
      try {
        const r = await fetch('/api/v1/auth/refresh', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        })
        const j = await r.json()
        token = j?.data?.accessToken ?? null
      } catch {
        /* 拿不到就不带，由后端决定 */
      }
      const res = await fetch(u, {
        method: m,
        credentials: 'include',
        headers: {
          ...(b ? { 'Content-Type': 'application/json' } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
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
    { method, url, body },
  )
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const adminCtx = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
const farmerCtx = await browser.newContext()
const adminPage = await adminCtx.newPage()
const farmerPage = await farmerCtx.newPage()
const jsErrors = []
adminPage.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

try {
  /* ---------- 1) 两个账号分别登录 ---------- */
  check(await ssoLogin(adminPage, 'admin', 'Admin@123'), 'admin 登录成功')
  check(await ssoLogin(farmerPage, 'farmer', 'Admin@123'), 'farmer 登录成功')

  /* ---------- 2) admin 创建主体 ---------- */
  const createRes = await call(adminPage, 'POST', '/api/v1/sso/account/businesses', {
    identity: 'enterprise',
    companyName: marker,
    // 统一社会信用代码必须是 15-18 位字母数字，后端会校验
    creditCode,
    legalPerson: '消息联调',
    contactName: '消息联调',
    contactPhone: '13800000000',
    industry: '种植',
  })
  check(createRes.json?.code === 0, '创建经营主体成功',
    `code=${createRes.json?.code} msg=${createRes.json?.message ?? ''}`)

  // 用 summary 而不是 GET /businesses 取新主体：
  // ① 页面（账号中心）读的就是 summary，口径一致；
  // ② /businesses 这个列表端点在本部署返回 500（另有问题，不在本轮范围）。
  const summaryRes = await call(adminPage, 'GET', '/api/v1/sso/account/summary')
  const businesses = summaryRes.json?.data?.merchants ?? []
  const mine = businesses.find((b) => String(b.merchantName ?? b.name ?? '').includes(marker))
  created.merchantId = mine?.merchantId ?? null
  check(Boolean(created.merchantId), '能查到刚创建的主体', `merchantId=${created.merchantId}`)
  if (!created.merchantId) throw new Error('主体未创建成功，后续步骤无法继续')

  /* ---------- 3) farmer 提交加入申请 ---------- */
  const joinRes = await call(farmerPage, 'POST', '/api/v1/sso/account/businesses/join-requests', {
    merchantId: created.merchantId,
    // 角色只接受 buyer / seller / finance（后端校验），不是自由文本
    roleInMerchant: 'seller',
    message: '端到端联调申请',
  })
  created.joinId = joinRes.json?.data?.id ?? null
  check(joinRes.json?.code === 0, '提交加入申请成功',
    `code=${joinRes.json?.code} msg=${joinRes.json?.message ?? ''}`)

  /* ---------- 4) admin 收到站内信 ---------- */
  const countRes = await call(adminPage, 'GET', '/api/v1/messages/unread-count')
  const unread = Number(countRes.json?.data ?? -1)
  check(countRes.json?.code === 0, '未读数接口可用', `code=${countRes.json?.code}`)
  check(unread >= 1, 'admin 有未读消息（申请通知已投递）', `unread=${unread}`)

  const msgRes = await call(adminPage, 'GET', '/api/v1/messages?page=1&size=20')
  const messages = msgRes.json?.data?.records ?? msgRes.json?.data?.list ?? []
  const notice = messages.find((m) => String(m.title ?? '').includes('新的加入申请'))
  check(Boolean(notice), '消息标题为「新的加入申请」', notice ? `id=${notice.id}` : `共 ${messages.length} 条`)
  check(
    notice ? String(notice.content ?? '').includes(marker) : false,
    '消息正文带上了主体名称（不是模板空壳）',
    notice ? String(notice.content).slice(0, 70) : '',
  )
  if (notice) created.messageIds.push(notice.id)

  /* ---------- 5) 页面渲染 ---------- */
  await adminPage.goto(`${BASE}/portal/index.html#/account/messages`, { waitUntil: 'networkidle', timeout: 30000 })
  await adminPage.waitForTimeout(1800)
  const pageText = (await adminPage.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(pageText.includes('消息中心'), '「消息中心」页已打开')
  check(pageText.includes('新的加入申请'), '页面渲染出这条站内信')
  check(pageText.includes(marker), '页面上能看到主体名称', pageText.match(/E2E消息联调-\d+/)?.[0] ?? '')

  /* ---------- 6) 标记已读 ---------- */
  if (notice) {
    const readRes = await call(adminPage, 'POST', `/api/v1/messages/${notice.id}/read`)
    check(readRes.json?.code === 0, '标记已读接口可用', `code=${readRes.json?.code}`)
    const after = Number((await call(adminPage, 'GET', '/api/v1/messages/unread-count')).json?.data ?? -1)
    check(after === unread - 1, '未读数减 1', `${unread} → ${after}`)
  }

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

/* ---------- 7) 清理 ---------- */
if (!KEEP && created.merchantId) {
  // 认证表也要清：主体创建时会带出一行 draft 认证，漏了它认证审核/资质审核列表里
  // 就会留下「E2E消息联调-xxx」这种脏数据（本轮就是这么发现的）
  sql(`DELETE FROM agri_core.platform_merchant_certification WHERE merchant_id=${created.merchantId}`)
  sql(`DELETE FROM agri_core.platform_merchant_join_request WHERE merchant_id=${created.merchantId}`)
  sql(`DELETE FROM agri_core.platform_user_merchant WHERE merchant_id=${created.merchantId}`)
  sql(`DELETE FROM agri_core.platform_merchant WHERE id=${created.merchantId}`)
  sql(`DELETE FROM agri_core.platform_message WHERE title='新的加入申请' AND content LIKE '%${marker}%'`)
  console.log(`\n清理：主体 ${created.merchantId}（${marker}）、其申请/绑定/站内信已删除`)
} else if (KEEP) {
  console.log(`\n已保留：主体 ${created.merchantId}（${marker}）`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
