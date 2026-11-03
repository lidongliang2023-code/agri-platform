/**
 * 用户中心 · 授权管理 端到端验证
 *
 * 验证链路：
 *   1. 接口返回四类授权（渠道/会话/身份/主体），summary 与逐项数量一致
 *   2. **四类授权都与既有接口同源**：渠道对 `/bindings`、会话对 `/sessions`、
 *      身份对 `/identity-applications`、主体对 `/summary` —— 逐项比对，证明没有第二套数据
 *   3. 会话里恰有且仅有一个 `current=true`
 *   4. 绑定一个渠道 → 出现在授权清单 → **在页面上点「撤回授权」** → 清单里消失
 *      （验证的是页面动作真的落到接口，不只是接口本身可用）
 *   5. 页面渲染：4 个统计卡、4 个分区、RBAC 提示、同源声明
 *   6. 清理：撤回测试绑定
 *
 * 用法：node scripts/e2e-uc-authz.mjs
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

const BASE = 'http://localhost'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const isOk = (body) => body?.code === 0 || body?.code === 200

const MYSQL = existsSync('C:////Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:////Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
  : ''
/** 解绑只把状态置 unbound（留痕），测试数据要整行删掉，否则会一直堆在库里 */
const sql = (q) => {
  if (!MYSQL) return
  try {
    execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' })
  } catch {
    /* 清理失败不影响断言结果 */
  }
}

const marker = `授权E2E${Date.now().toString().slice(-6)}`

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


  /* ---------- 1) 结构 ---------- */
  const authz = await call('GET', '/api/v1/sso/account/authorizations')
  const data = authz.json?.data ?? {}
  const summary = data.summary ?? {}
  check(isOk(authz.json), '授权清单接口可用', `code=${authz.json?.code}`)
  check(
    ['channels', 'sessions', 'identities', 'memberships'].every((k) => Array.isArray(data[k])),
    '四类授权都以数组返回',
  )
  check(
    Number(summary.channelCount) === (data.channels ?? []).length
      && Number(summary.sessionCount) === (data.sessions ?? []).length
      && Number(summary.identityCount) === (data.identities ?? []).length
      && Number(summary.membershipCount) === (data.memberships ?? []).length,
    'summary 与逐项数量一致',
    JSON.stringify(summary),
  )

  /* ---------- 2) 与既有接口同源（没有第二套数据） ---------- */
  const bindings = await call('GET', '/api/v1/sso/account/bindings')
  const sessionsApi = await call('GET', '/api/v1/sso/account/sessions')
  const summaryApi = await call('GET', '/api/v1/sso/account/summary')
  const identityApi = await call('GET', '/api/v1/sso/account/identity-applications')

  const boundProviders = (bindings.json?.data?.bindings ?? bindings.json?.data ?? [])
    .filter((row) => (row.status ?? row.bindStatus) === 'bound')
    .map((row) => row.provider)
    .sort()
  const authzProviders = (data.channels ?? []).map((row) => row.provider).sort()
  check(
    JSON.stringify(boundProviders) === JSON.stringify(authzProviders),
    '渠道授权与 /bindings 同源',
    `bindings=${boundProviders.join(',') || '空'} authz=${authzProviders.join(',') || '空'}`,
  )

  check(
    Number(sessionsApi.json?.data?.total) === (data.sessions ?? []).length,
    '会话授权与 /sessions 同源',
    `${sessionsApi.json?.data?.total} vs ${(data.sessions ?? []).length}`,
  )

  const approvedIdentities = (identityApi.json?.data?.identities ?? [])
    .filter((row) => row.status === 'approved')
    .map((row) => row.code)
    .sort()
  const authzIdentities = (data.identities ?? []).map((row) => row.code).sort()
  check(
    JSON.stringify(approvedIdentities) === JSON.stringify(authzIdentities),
    '业务身份授权与 /identity-applications 同源',
    `identity=${approvedIdentities.join(',') || '空'} authz=${authzIdentities.join(',') || '空'}`,
  )

  check(
    Number(summary.membershipCount) === (summaryApi.json?.data?.merchants ?? []).length,
    '主体成员身份与 /summary 同源',
    `${summary.membershipCount} vs ${(summaryApi.json?.data?.merchants ?? []).length}`,
  )

  /* ---------- 3) 当前会话唯一 ---------- */
  const currents = (data.sessions ?? []).filter((row) => row.current)
  check(currents.length === 1, '恰有一个会话标记为「本机」', `count=${currents.length}`)

  /* ---------- 4) 页面动作真的落到接口 ---------- */
  const bind = await call('POST', '/api/v1/sso/account/bindings', {
    provider: 'wechat',
    externalAccount: marker,
    displayName: marker,
  })
  check(isOk(bind.json), '准备：绑定一个微信渠道', `code=${bind.json?.code}`)

  const afterBind = await call('GET', '/api/v1/sso/account/authorizations')
  const wechatRow = (afterBind.json?.data?.channels ?? []).find((row) => row.provider === 'wechat')
  check(Boolean(wechatRow), '新绑定出现在授权清单里', wechatRow ? wechatRow.label : '')
  check(wechatRow?.label === '微信', '渠道名称由后端翻译成中文', String(wechatRow?.label))

  await page.goto(`${BASE}/portal/index.html#/account/authorizations`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  })
  await page.waitForTimeout(2200)
  let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('谁在代表我访问平台'), '「授权管理」页已打开')
  check(!/加载失败|请求失败/.test(text), '页面无加载失败提示',
    text.match(/加载失败|请求失败/)?.[0] ?? '')
  check(text.includes('微信'), '页面列出微信授权')
  check(text.includes(marker), '页面显示外部账号标识')

  /* 统计卡 */
  check(text.includes('第三方渠道授权'), '统计卡：第三方渠道授权')
  check(text.includes('活跃登录会话'), '统计卡：活跃登录会话')
  check(text.includes('已开通业务身份'), '统计卡：业务开通身份')
  check(text.includes('主体成员身份'), '统计卡：主体成员身份')

  /* 四个分区 */
  for (const title of ['第三方渠道授权', '登录会话', '业务身份授权', '主体成员身份']) {
    check(text.includes(title), `分区存在「${title}」`)
  }

  /* 关键声明 */
  check(text.includes('细粒度权限不在这里配'), '页面声明不提供第二套权限配置入口')
  check(text.includes('我的角色与权限'), '指向权威页面「我的角色与权限」')
  check(text.includes('同一个动作'), '声明与「隐私与数据」页的撤回同源')

  /* 点「撤回授权」：微信那一行的按钮 */
  const wechatItem = page.locator('.uc-au-list li', { hasText: marker }).first()
  await wechatItem.locator('button', { hasText: '撤回授权' }).click()
  await page.waitForTimeout(1800)
  const afterRevoke = await call('GET', '/api/v1/sso/account/authorizations')
  const gone = !(afterRevoke.json?.data?.channels ?? []).some((row) => row.provider === 'wechat')
  check(gone, '在页面上撤回后，接口里已不存在该渠道（页面动作真的落库）')

  text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('已撤回'), '页面给出撤回成功提示')
  check(!text.includes(marker), '撤回后页面不再显示该渠道')

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  /* 兜底清理：不管走到哪一步，都把这个测试绑定撤掉 */
  try {
    await call('DELETE', '/api/v1/sso/account/bindings/wechat')
  } catch {
    /* ignore */
  }
  await browser.close()
  sql(`DELETE FROM agri_core.platform_user_binding WHERE external_account LIKE '${marker}%'`)
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
