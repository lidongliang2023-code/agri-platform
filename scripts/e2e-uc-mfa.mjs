/**
 * 用户中心 · 二次验证（TOTP）端到端验证
 *
 * 验证链路（**核心是"真的拦在登录上"**，不是页面上有个开关）：
 *   1. 初始未启用；setup 只生成 pending，不会直接启用
 *   2. 输错码确认 → 400；输对码确认 → 启用 + 返回 8 个备用码
 *   3. 再次 setup → 400（已启用不允许换密钥，否则会话被拿到就能把机主锁在门外）
 *   4. **退出登录后用密码重新登录 → mfaRequired=true 且没有拿到 accessToken**（关键断言）
 *   5. 第二步：错码 → 401；正确码 → 真的登进来（拿到会话）
 *   6. challenge 一次性：同一个 challenge 第二次用 → 401
 *   7. 备用码可登录，且**用过的备用码不能再用**
 *   8. 停用需要再验一次码；停用后登录不再要求二次验证
 *   9. 页面渲染与"生效范围"声明
 *  10. 清理：确保最终状态为未启用
 *
 * TOTP 在脚本侧按 RFC 6238 自行计算（HMAC-SHA1 / 30s / 6 位），不依赖后端算法。
 *
 * 用法：node scripts/e2e-uc-mfa.mjs
 */
import { createHmac } from 'node:crypto'
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

/* ---------- TOTP（RFC 6238，脚本侧独立实现） ---------- */

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function base32Decode(input) {
  const clean = input.replace(/=|\s/g, '').toUpperCase()
  let bits = 0
  let value = 0
  const out = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx < 0) throw new Error(`非法 Base32 字符：${ch}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

function totp(secret, offsetSteps = 0) {
  const step = Math.floor(Date.now() / 1000 / 30) + offsetSteps
  const buf = Buffer.alloc(8)
  buf.writeUInt32BE(Math.floor(step / 2 ** 32), 0)
  buf.writeUInt32BE(step % 2 ** 32, 4)
  const hmac = createHmac('sha1', base32Decode(secret)).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0x0f
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)
  return String(binary % 1_000_000).padStart(6, '0')
}

/** 取一个当前有效、且未被用过的码（避开刚用过的时间步） */
function freshCode(secret) {
  return totp(secret, 1)
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1500, height: 1050 } })
const page = await context.newPage()
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

/** 走 SSO 页面登录（密码步骤），返回 { mfaRequired, challengeToken, loggedIn } */
async function loginByPassword() {
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  const body = await page.evaluate(() =>
    document.body.innerText.replace(/\s+/g, ' '),
  )
  const mfaStep = body.includes('已开启二次验证')
  return { mfaStep, text: body }
}

let secret = ''
let recoveryCodes = []

try {
  /* ---------- 登录（初始未启用，应能直接进） ---------- */
  const first = await loginByPassword()
  check(!first.mfaStep, '初始未启用时直接登录成功')
  check(!page.url().includes('/sso/index.html'), '登录后已离开登录页')

  /* ---------- 1) 初始状态 ---------- */
  const init = await call('GET', '/api/v1/sso/account/mfa')
  check(init.json?.code === 0, '二次验证状态接口可用', `code=${init.json?.code}`)
  check(init.json?.data?.enabled === false, '初始为未启用', `status=${init.json?.data?.status}`)

  /* ---------- 2) setup 只生成 pending ---------- */
  const setup = await call('POST', '/api/v1/sso/account/mfa/setup')
  secret = setup.json?.data?.secret ?? ''
  check(setup.json?.code === 0, '生成密钥成功', `code=${setup.json?.code}`)
  check(/^[A-Z2-7]{16,}$/.test(secret), '密钥是 Base32', `len=${secret.length}`)
  check(
    String(setup.json?.data?.otpauthUri ?? '').startsWith('otpauth://totp/'),
    '返回 otpauth 链接',
    String(setup.json?.data?.otpauthUri ?? '').slice(0, 40),
  )
  const afterSetup = await call('GET', '/api/v1/sso/account/mfa')
  check(afterSetup.json?.data?.enabled === false, '生成密钥后仍未启用（必须确认后才生效）',
    `status=${afterSetup.json?.data?.status}`)

  /* ---------- 3) 确认：错码拒绝，对码启用 ---------- */
  const wrong = await call('POST', '/api/v1/sso/account/mfa/confirm', { code: '000000' })
  check(wrong.json?.code === 400, '错误验证码确认被拒（400）', `code=${wrong.json?.code}`)

  const confirm = await call('POST', '/api/v1/sso/account/mfa/confirm', { code: totp(secret) })
  check(confirm.json?.code === 0, '正确验证码确认成功', `code=${confirm.json?.code}`)
  recoveryCodes = confirm.json?.data?.recoveryCodes ?? []
  check(recoveryCodes.length === 8, '返回 8 个备用码', `count=${recoveryCodes.length}`)

  const enabled = await call('GET', '/api/v1/sso/account/mfa')
  check(enabled.json?.data?.enabled === true, '状态变为已启用')
  check(Number(enabled.json?.data?.remainingRecoveryCodes) === 8, '剩余备用码 8 个')

  const dbRow = sql('SELECT status FROM agri_core.platform_user_mfa WHERE status=\'active\' LIMIT 1')
  check(dbRow === 'active', '已落库（直连 MySQL 复核）', dbRow)
  const cipherRow = sql('SELECT LEFT(secret_cipher,6) FROM agri_core.platform_user_mfa LIMIT 1')
  check(cipherRow !== secret && cipherRow.length > 0, '库里存的是密文不是明文密钥', cipherRow)

  /* ---------- 4) 已启用不允许重新 setup ---------- */
  const reSetup = await call('POST', '/api/v1/sso/account/mfa/setup')
  check(reSetup.json?.code === 400, '已启用时不允许重新生成密钥（400）', `code=${reSetup.json?.code}`)

  /* ---------- 5) 关键：登录被拦住 ---------- */
  await context.clearCookies()
  const gated = await loginByPassword()
  check(gated.mfaStep, '再次登录时被要求输入二次验证码（真的拦住了）')
  check(page.url().includes('/sso/index.html'), '此时仍未离开登录页（没有建立会话）')

  /* 页面上下文里没有登录态，接口应拒绝 */
  const blocked = await call('GET', '/api/v1/sso/account/mfa')
  check(blocked.json?.code === 401, '未通过二次验证时接口仍是未登录（401）', `code=${blocked.json?.code}`)

  /* ---------- 6) 第二步：错码 / 对码 / challenge 一次性 ---------- */
  const wrongMfa = await call('POST', '/api/v1/sso/login-standalone-mfa', {
    challengeToken: 'not-a-real-token',
    code: '123456',
  })
  check(wrongMfa.json?.code === 401, '无效 challenge 被拒（401）', `code=${wrongMfa.json?.code}`)

  /* 重新走一次密码步骤拿新 challenge，再用正确码登录 */
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2000)

  const challenge = await page.evaluate(async () => {
    const res = await fetch('/api/v1/sso/login-standalone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
    })
    const j = await res.json().catch(() => null)
    return j?.data ?? null
  })
  check(challenge?.mfaRequired === true, '第一步返回 mfaRequired=true')
  check(
    !challenge?.accessToken && !challenge?.user,
    '第一步**没有**返回访问令牌与用户信息',
    `accessToken=${challenge?.accessToken ?? 'null'}`,
  )
  const token1 = challenge?.challengeToken ?? ''
  check(token1.length > 0, '返回一次性 challenge')

  const badCode = await call('POST', '/api/v1/sso/login-standalone-mfa', {
    challengeToken: token1,
    code: '000000',
  })
  check(badCode.json?.code === 401, '错误验证码登录被拒（401）', `code=${badCode.json?.code}`)

  /* 失败后 challenge 已消费：再试正确码也应失败（防暴力试码） */
  const reuseAfterFail = await call('POST', '/api/v1/sso/login-standalone-mfa', {
    challengeToken: token1,
    code: totp(secret),
  })
  check(reuseAfterFail.json?.code === 401, 'challenge 一次性：失败后再用同一 token 无效（401）',
    `code=${reuseAfterFail.json?.code}`)

  /* 新 challenge + 正确码 → 真正登录 */
  const challenge2 = await page.evaluate(async () => {
    const res = await fetch('/api/v1/sso/login-standalone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
    })
    const j = await res.json().catch(() => null)
    return j?.data ?? null
  })
  const okLogin = await call('POST', '/api/v1/sso/login-standalone-mfa', {
    challengeToken: challenge2?.challengeToken,
    code: freshCode(secret),
    marketId: 1,
  })
  check(okLogin.json?.code === 0, '正确验证码登录成功', `code=${okLogin.json?.code}`)
  check(
    Boolean(okLogin.json?.data?.accessToken),
    '第二步返回了访问令牌（此时才真正登录）',
  )

  const loggedIn = await call('GET', '/api/v1/sso/account/mfa')
  check(loggedIn.json?.code === 0 && loggedIn.json?.data?.enabled === true,
    '登录后接口可访问且状态为已启用')

  /* ---------- 7) 备用码：可用一次，用完失效 ---------- */
  const usedCode = recoveryCodes[0]
  const recoveryLogin = await page.evaluate(async (code) => {
    const step1 = await fetch('/api/v1/sso/login-standalone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
    })
    const j1 = await step1.json().catch(() => null)
    const res = await fetch('/api/v1/sso/login-standalone-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeToken: j1?.data?.challengeToken, code, marketId: 1 }),
    })
    const j2 = await res.json().catch(() => null)
    return { code: j2?.code, hasToken: Boolean(j2?.data?.accessToken) }
  }, usedCode)
  check(recoveryLogin.code === 0 && recoveryLogin.hasToken, '备用码可以登录', `code=${recoveryLogin.code}`)

  const afterRecovery = await call('GET', '/api/v1/sso/account/mfa')
  check(Number(afterRecovery.json?.data?.remainingRecoveryCodes) === 7,
    '用掉一个后剩余 7 个', `remaining=${afterRecovery.json?.data?.remainingRecoveryCodes}`)

  const reuseRecovery = await page.evaluate(async (code) => {
    const step1 = await fetch('/api/v1/sso/login-standalone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
    })
    const j1 = await step1.json().catch(() => null)
    const res = await fetch('/api/v1/sso/login-standalone-mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeToken: j1?.data?.challengeToken, code, marketId: 1 }),
    })
    const j2 = await res.json().catch(() => null)
    return j2?.code
  }, usedCode)
  check(reuseRecovery === 401, '用过的备用码不能再用（401）', `code=${reuseRecovery}`)

  /* ---------- 8) 页面渲染 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/mfa`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2200)
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('二次验证'), '「二次验证」页已打开')
  check(text.includes('已启用'), '页面显示已启用')
  check(text.includes('剩余备用码'), '页面显示剩余备用码')
  check(text.includes('当前生效范围'), '页面声明生效范围（不夸大）')
  check(text.includes('OIDC'), '页面写明 OIDC 链路尚未接入（诚实标注）')

  /* ---------- 9) 停用需要再验一次 ---------- */
  const disableNoCode = await call('POST', '/api/v1/sso/account/mfa/disable', {})
  check(disableNoCode.json?.code === 400, '停用不输码被拒（400）', `code=${disableNoCode.json?.code}`)

  const disableWrong = await call('POST', '/api/v1/sso/account/mfa/disable', { code: '000000' })
  check(disableWrong.json?.code === 400, '停用错码被拒（400）', `code=${disableWrong.json?.code}`)

  const disableOk = await call('POST', '/api/v1/sso/account/mfa/disable', { code: freshCode(secret) })
  check(disableOk.json?.code === 0, '停用成功', `code=${disableOk.json?.code}`)

  const disabled = await call('GET', '/api/v1/sso/account/mfa')
  check(disabled.json?.data?.enabled === false, '停用后状态为未启用')
  const cipherCleared = sql('SELECT IFNULL(secret_cipher,\'\') FROM agri_core.platform_user_mfa LIMIT 1')
  check(cipherCleared === '', '停用后密钥已清空（不是"停了还留着密文"）', `cipher=${cipherCleared || '(空)'}`)

  /* ---------- 10) 停用后登录不再要求二次验证 ---------- */
  await context.clearCookies()
  const free = await loginByPassword()
  check(!free.mfaStep, '停用后登录不再要求验证码')
  check(!page.url().includes('/sso/index.html'), '停用后可以直接登录进来')

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  /* 兜底：无论如何都保证最终是"未启用"，否则后续所有登录都会被拦 */
  try {
    await call('POST', '/api/v1/sso/account/mfa/disable', { code: freshCode(secret) })
  } catch {
    /* ignore */
  }
  await browser.close()
}

/* ---------- 清理 ---------- */
if (MYSQL) {
  sql("DELETE FROM agri_core.platform_user_mfa WHERE status <> 'active'")
  sql("DELETE FROM agri_core.platform_user_operation_log WHERE action LIKE 'mfa%'")
  const left = sql("SELECT COUNT(*) FROM agri_core.platform_user_mfa WHERE status = 'active'")
  console.log(`\n清理：残留启用中的 MFA 记录 ${left} 条（应为 0）`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
