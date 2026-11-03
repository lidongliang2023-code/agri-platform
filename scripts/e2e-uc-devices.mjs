/**
 * 用户中心 · 登录设备 端到端验证
 *
 * 验证链路：
 *   1. 同一账号在两个独立浏览器上下文各登录一次 → Redis 里应有 2 个会话
 *   2. 上下文 A 查 /sso/account/sessions → 至少 2 条，且**只有一条**标 current
 *   3. 上下文 A 下线 B 的会话 → B 立刻失效（再调账号接口 401）
 *   4. 页面 #/account/devices 能渲染出设备列表与「本机」标记
 *   5. 顺带验一次"退出其他设备"
 *
 * 用法：node scripts/e2e-uc-devices.mjs
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
const USER = 'admin'
const PASSWORD = 'Admin@123'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/** 走真实登录页建立 SSO 会话（账号中心系列接口认会话 Cookie） */
async function ssoLogin(page) {
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill(USER)
  await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  return !page.url().includes('/sso/index.html')
}

async function call(page, method, url) {
  return page.evaluate(
    async ({ method: m, url: u }) => {
      const res = await fetch(u, { method: m, credentials: 'include' })
      let json = null
      try {
        json = await res.json()
      } catch {
        /* 非 JSON */
      }
      return { status: res.status, json }
    },
    { method, url },
  )
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const ctxA = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
const ctxB = await browser.newContext()
const pageA = await ctxA.newPage()
const pageB = await ctxB.newPage()
const jsErrors = []
pageA.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

try {
  check(await ssoLogin(pageA), '上下文 A 登录成功')
  check(await ssoLogin(pageB), '上下文 B 登录成功（同一账号第二个会话）')

  /* ---------- 1) A 看到两个会话 ---------- */
  const listA = await call(pageA, 'GET', '/api/v1/sso/account/sessions')
  const rowsA = listA.json?.data?.records ?? []
  check(listA.json?.code === 0, '会话列表接口可用', `code=${listA.json?.code}`)
  check(rowsA.length >= 2, '至少两个在线会话', `total=${rowsA.length}`)

  const currents = rowsA.filter((r) => r.current)
  check(currents.length === 1, '恰好一条标记为「本机」', `current=${currents.length}`)
  // 只校验**本次登录产生的**会话：加元数据之前建立的历史会话没有 UA，
  // 只能显示「未知设备」—— 这是事实，不该拿它判失败
  const currentRow = rowsA.find((r) => r.current)
  check(
    /^[A-Za-z]+ · [A-Za-z\u4e00-\u9fa5]+$/.test(String(currentRow?.device ?? '')),
    '本机会话的设备名解析成「系统 · 浏览器」',
    String(currentRow?.device ?? ''),
  )
  check(Boolean(currentRow?.ip), '本机会话记录了 IP', String(currentRow?.ip ?? ''))
  check(
    rowsA.every((r) => typeof r.sessionKey === 'string' && r.sessionKey.length === 12),
    '对外只暴露 12 位哈希标识（不泄露 sid）',
    rowsA[0]?.sessionKey,
  )

  /* ---------- 2) 下线 B ---------- */
  const other = rowsA.find((r) => !r.current)
  check(Boolean(other), '能找到非本机的会话', other?.device ?? '')
  if (other) {
    const del = await call(pageA, 'DELETE', `/api/v1/sso/account/sessions/${other.sessionKey}`)
    check(del.json?.code === 0, '下线指定设备成功', `code=${del.json?.code}`)

    const afterB = await call(pageB, 'GET', '/api/v1/sso/account/summary')
    check(afterB.json?.code === 401, '被下线的会话立刻失效（B 调账号接口 401）',
      `code=${afterB.json?.code} msg=${afterB.json?.message ?? ''}`)

    const listA2 = await call(pageA, 'GET', '/api/v1/sso/account/sessions')
    const rowsA2 = listA2.json?.data?.records ?? []
    check(rowsA2.length === rowsA.length - 1, '列表少一条',
      `${rowsA.length} → ${rowsA2.length}`)
  }

  /* ---------- 3) 退出其他设备 ---------- */
  await ssoLogin(pageB)
  const before = (await call(pageA, 'GET', '/api/v1/sso/account/sessions')).json?.data?.records ?? []
  check(before.length >= 2, '重新登录后又有多个会话', `total=${before.length}`)
  const revokeOthers = await call(pageA, 'DELETE', '/api/v1/sso/account/sessions')
  check(revokeOthers.json?.code === 0, '「退出其他设备」接口可用', `code=${revokeOthers.json?.code}`)
  check(Number(revokeOthers.json?.data?.revoked ?? 0) >= 1, '至少吊销 1 个会话',
    `revoked=${revokeOthers.json?.data?.revoked}`)
  const after = (await call(pageA, 'GET', '/api/v1/sso/account/sessions')).json?.data?.records ?? []
  check(after.length === 1 && after[0].current, '只剩本机会话', `total=${after.length}`)

  /* ---------- 4) 页面渲染 ---------- */
  await pageA.goto(`${BASE}/portal/index.html#/account/devices`, { waitUntil: 'networkidle', timeout: 30000 })
  await pageA.waitForTimeout(1800)
  const text = (await pageA.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('登录设备'), '「登录设备」页已打开')
  check(/共 \d+ 台设备在线/.test(text), '显示在线设备数', (text.match(/共 \d+ 台设备在线/) ?? [''])[0])
  check(text.includes('本机'), '本机会话有「本机」标记')
  check(text.includes('退出其他设备'), '提供「退出其他设备」入口')
  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
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
