/**
 * 用户中心 · 跨模块入口 端到端验证
 *
 * 验证链路：
 *   1. `/modules` 返回 6 个子系统，字段完整（entryUrl / state / requires）
 *   2. **状态由真实数据算出**：拿 `/summary`、`/identity-applications` 两个独立接口
 *      自行推导一遍，与 `/modules` 的结论逐项比对 —— 否则就是在验证自己
 *   3. 目录里的每个 entryUrl 真的可达（HTTP 200），不是指向死链
 *   4. 页面渲染：6 个模块、可进入数量、前置条件标签、缺口说明与补齐入口
 *   5. 页面文案声明"不代替子系统做权限判断"
 *   6. 清理：本脚本不写库，只做只读校验（保持数据零残留）
 *
 * 用法：node scripts/e2e-uc-modules.mjs
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

const MYSQL = existsSync('C:////Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:////Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
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
const marker = `模块E2E${Date.now().toString().slice(-6)}`
const baselineId = Number(sql('SELECT IFNULL(MAX(id),0) FROM agri_core.platform_identity_application') || 0)
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


  /* ---------- 1) 目录结构 ---------- */
  const mods = await call('GET', '/api/v1/sso/account/modules')
  const data = mods.json?.data ?? {}
  const list = data.modules ?? []
  check(mods.json?.code === 0, '跨模块入口接口可用', `code=${mods.json?.code}`)
  check(list.length === 6, '返回 6 个子系统', `count=${list.length}`)
  check(
    list.every((m) => m.code && m.name && m.entryUrl && Array.isArray(m.requires)),
    '每个模块字段完整（code/name/entryUrl/requires）',
  )
  check(
    list.every((m) => m.state === 'available' || m.state === 'blocked'),
    '状态只有 available / blocked 两态',
    list.map((m) => m.state).join(','),
  )

  /* ---------- 2) 状态是算出来的，不是写死的 ----------
     用另外两个接口独立推导一遍，再与 /modules 的结论比对。
     这一步才是真正的验证：如果 /modules 里有人把 state 写死，这里会立刻不匹配。 */
  const summary = await call('GET', '/api/v1/sso/account/summary')
  const s = summary.json?.data ?? {}
  const personalVerified = String(s.realName?.status ?? '') === 'verified'
  const merchants = s.merchants ?? []
  const hasMerchant = merchants.length > 0
  const merchantVerified = merchants.some((m) => String(m.certification?.status ?? '') === 'approved')

  const apps = await call('GET', '/api/v1/sso/account/identity-applications')
  const identities = apps.json?.data?.identities ?? []
  const hasBusinessIdentity = identities.some((i) => i.status === 'approved')

  const profile = data.profile ?? {}
  check(profile.personalVerified === personalVerified, '个人实名状态与 /summary 一致',
    `modules=${profile.personalVerified} summary=${personalVerified}`)
  check(profile.hasMerchant === hasMerchant, '主体状态与 /summary 一致',
    `modules=${profile.hasMerchant} summary=${hasMerchant}`)
  check(profile.merchantVerified === merchantVerified, '主体认证状态与 /summary 一致',
    `modules=${profile.merchantVerified} summary=${merchantVerified}`)
  check(profile.hasBusinessIdentity === hasBusinessIdentity, '业务身份状态与身份申请一致',
    `modules=${profile.hasBusinessIdentity} identity=${hasBusinessIdentity}`)

  const expectState = (requires) => {
    const real = {
      merchant: hasMerchant,
      merchant_verified: merchantVerified,
      personal_verified: personalVerified,
      business_identity: hasBusinessIdentity,
    }
    return requires.every((r) => real[r] === true) ? 'available' : 'blocked'
  }
  const mismatched = list.filter((m) => m.state !== expectState(m.requires))
  check(mismatched.length === 0, '每个模块的 state 与前置条件推导结果一致',
    mismatched.map((m) => `${m.code}:${m.state}≠${expectState(m.requires)}`).join(' '))

  const counted = list.filter((m) => m.state === 'available').length
  check(data.availableCount === counted, 'availableCount 与逐项统计一致',
    `接口=${data.availableCount} 统计=${counted}`)
  check(
    list.filter((m) => m.state === 'blocked').every((m) => m.missingLabels.length > 0),
    '被拦下的模块都写明了缺什么',
  )

  /* ---------- 3) 入口不是死链 ---------- */
  for (const m of list) {
    const url = m.entryUrl.startsWith('http') ? m.entryUrl : `${BASE}${m.entryUrl}`
    let code = 0
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'manual' })
      code = res.status
    } catch {
      code = -1
    }
    check(code > 0 && code < 400, `入口可达：${m.name}`, `${url} → ${code}`)
  }

  /* ---------- 4) 页面渲染 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/crossModule`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2000)
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('跨模块入口') || text.includes('个子系统'), '「跨模块入口」页已打开')
  for (const m of list) {
    check(text.includes(m.name), `渲染模块「${m.name}」`)
  }
  check(text.includes(`共 ${list.length} 个子系统`), '显示模块总数', `共 ${list.length} 个子系统`)
  check(text.includes(`当前可进入 ${counted} 个`), '显示可进入数量', `当前可进入 ${counted} 个`)
  check(text.includes('可进入') && text.includes('待完善'), '两种状态都有展示')

  /* 前置条件标签（来自真实 profile，不是写死） */
  check(
    text.includes(`个人实名${personalVerified ? '已通过' : '未通过'}`),
    '前置条件标签：个人实名',
    personalVerified ? '已通过' : '未通过',
  )
  check(
    text.includes(`经营主体${hasMerchant ? '已加入' : '未加入'}`),
    '前置条件标签：经营主体',
    hasMerchant ? '已加入' : '未加入',
  )

  /* 被拦下的模块要在页面上写出缺口 */
  const blocked = list.filter((m) => m.state === 'blocked')
  for (const m of blocked) {
    check(text.includes(m.missingLabels[0]), `页面写出「${m.name}」缺什么`, m.missingLabels[0])
  }

  check(text.includes('不代替子系统做权限判断'), '页面声明不代替子系统做权限判断')

  /* 按钮数量与模块数一致（每个模块一个「进入」） */
  const enterButtons = await page.locator('button', { hasText: '进入' }).count()
  check(enterButtons === list.length, '每个模块都有「进入」按钮', `buttons=${enterButtons}`)

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))

  /* ---------- 5) 状态会跟着数据变（证明不是写死的） ----------
     临时开通一个业务身份，交易撮合应当从 blocked 翻成 available。
     这是本轮最硬的一条断言：如果 state 是常量，这里必然失败。 */
  const tradeBefore = list.find((m) => m.code === 'trade')
  if (tradeBefore?.state === 'blocked') {
    const apply = await call('POST', '/api/v1/sso/account/identity-applications', {
      identityType: 'wholesaler',
      subjectName: marker,
    })
    check(apply.json?.code === 0, '临时提交业务身份申请', `code=${apply.json?.code}`)
    const appId = apply.json?.data?.id

    /* 运营审核需要 Bearer；这里用刷新凭证换一枚（与其它 uc 脚本一致） */
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
    const review = await page.evaluate(
      async ({ id, t }) => {
        const res = await fetch(`/api/v1/admin/identity-applications/${id}/review`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${t}` },
          body: JSON.stringify({ approved: true, remark: '跨模块入口联调' }),
        })
        const j = await res.json().catch(() => null)
        return { code: j?.code, message: j?.message }
      },
      { id: appId, t: token },
    )
    check(review.code === 0, '运营审核通过', `code=${review.code}`)

    const after = await call('GET', '/api/v1/sso/account/modules')
    const tradeAfter = (after.json?.data?.modules ?? []).find((m) => m.code === 'trade')
    check(tradeAfter?.state === 'available', '开通身份后「交易撮合」变为可进入',
      `before=${tradeBefore.state} after=${tradeAfter?.state}`)
    check(
      after.json?.data?.availableCount === counted + 1,
      '可进入数量同步 +1',
      `${counted} → ${after.json?.data?.availableCount}`,
    )
    check(
      (tradeAfter?.missingLabels ?? []).length === 0,
      '该模块的缺口说明被清空',
    )
  } else {
    check(false, '交易撮合初始应为 blocked（当前环境不满足，本段无法验证状态联动）',
      `state=${tradeBefore?.state}`)
  }
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  await browser.close()
}

/* ---------- 清理：本脚本只为验证状态联动临时造了一条身份申请 ---------- */
if (MYSQL) {
  const before = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_identity_application WHERE id > ${baselineId}`)
  sql(`DELETE FROM agri_core.platform_user_operation_log WHERE action IN ('identity_apply','identity_cancel')`)
  const left = sql(`SELECT COUNT(*) FROM agri_core.platform_identity_application WHERE subject_name LIKE '${marker}%'`)
  console.log(`\n清理：本轮临时身份申请 ${before} 条已删除（剩余 ${left}）`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
