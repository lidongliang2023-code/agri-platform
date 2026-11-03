/**
 * 子系统健康自检（部署后 / 排障时用）
 *
 * 逐个打开各子系统入口，记录：最终 URL、页面标题、是否停在登录页、JS 错误、关键文本。
 * 只做"能不能正常打开并渲染"的检查，不校验业务数据 —— 数据正确性由各自的 e2e 负责。
 *
 * 用法：
 *   node scripts/health-check-subsystems.mjs
 *   node scripts/health-check-subsystems.mjs --json     # 供自动化读取
 */
import { existsSync, readFileSync } from 'node:fs'
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

/** 入口清单：与 ops/modules/catalog.json + 网关 conf 对齐 */
const ENTRIES = [
  { name: '门户官网', url: 'http://localhost:8098/portal/', expect: /丰链云|产业|行情/ },
  // 认证中心本身就是登录页：已登录也停在 /login 是正常的（允许切换账号）
  { name: '统一认证中心', url: 'http://localhost:8090/login', expect: /登录|认证/, allowLoginPage: true },
  { name: '主数据运营端', url: 'http://localhost:8080/', expect: /主数据/ },
  { name: '主数据用户端', url: 'http://localhost:8080/user', expect: /企业端|工作台|主数据/ },
  { name: '生产管理 PC', url: 'http://localhost/production/', expect: /生产|地块|种植/ },
  { name: '生产运营端', url: 'http://localhost:8190/', expect: /生产|运营/ },
  { name: '交易撮合 PC', url: 'http://localhost:8086/', expect: /交易|商品|采购|行情/ },
  { name: '物联网 PC', url: 'http://localhost:8101/', expect: /物联网|设备|监测/ },
  { name: '物联网运营端', url: 'http://localhost:8102/', expect: /物联网|设备|运营/ },
  { name: '商城消费端', url: 'http://localhost:8082/', expect: /商城|商品|购物/ },
  { name: '资讯服务', url: 'http://localhost:8104/', expect: /资讯|行情|政策/ },
  { name: '资讯运营端', url: 'http://localhost:8113/', expect: /资讯|运营|内容/ },
  { name: '农业服务', url: 'http://localhost:8105/', expect: /服务|预约|农机/ },
  { name: '用户中心运营端', url: 'http://localhost:8115/user-center-ops/', expect: /用户中心|运营/ },
]

const asJson = process.argv.includes('--json')

/**
 * 从既有 e2e 脚本读取测试口令（不在这里重复写一份明文，
 * 也避免同一份口令散落在多个文件里各自过期）。
 */
const PASSWORD = (() => {
  try {
    const src = readFileSync('scripts/e2e-mdm-sso-loop.mjs', 'utf8')
    return src.match(/登录密码"\]'\)\.first\(\)\.fill\('([^']+)'\)/)[1]
  } catch {
    return ''
  }
})()

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })

/**
 * 先建立统一认证的全局会话。
 *
 * <p>不登录逐个打开入口，看到的一定全是认证中心登录页 —— 那是**正确行为**，
 * 但无法证明各子系统的 SSO 接入是否通。先登录一次，后续每个入口都会走
 * 「授权 → 回跳 → 换票」，这才是真实用户路径。</p>
 */
const loginCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const loginPage = await loginCtx.newPage()
let loggedIn = false
try {
  await loginPage.goto('http://localhost:8090/login', { waitUntil: 'domcontentloaded', timeout: 25000 })
  await loginPage.locator('button').filter({ hasText: '账号 + 密码' }).first().click({ timeout: 10000 })
  await loginPage.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await loginPage.locator('input[placeholder*="用户名"]').first().fill('admin')
  await loginPage.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD)
  await loginPage.locator('button').filter({ hasText: '登' }).first().click()
  await loginPage.waitForTimeout(4000)
  loggedIn = !loginPage.url().includes(':8090/login')
} catch {
  loggedIn = false
}
if (!asJson) console.log(`统一认证登录：${loggedIn ? '成功（admin）' : '失败'}\n`)
const cookies = loggedIn ? await loginCtx.cookies() : []
await loginCtx.close()

const results = []

for (const entry of ENTRIES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  if (cookies.length) await ctx.addCookies(cookies)
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => {
    const t = String(e?.message ?? e)
    if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) errors.push(t.slice(0, 100))
  })
  let status = 'ok'
  let detail = ''
  let title = ''
  let finalUrl = ''
  try {
    const resp = await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 25000 })
    await page.waitForTimeout(5000)
    // 若停在 /sso/callback（正在换票），再给 3 秒等它跳到业务页
    if (page.url().includes('/sso/callback')) await page.waitForTimeout(3000)
    finalUrl = page.url()
    title = (await page.title()) || ''
    const text = (await page.evaluate(() => document.body?.innerText ?? '')).replace(/\s+/g, ' ')

    if (!resp || resp.status() >= 400) {
      status = 'http-error'
      detail = `HTTP ${resp ? resp.status() : 'no-response'}`
    } else if (finalUrl.includes(':8090/login') && !entry.allowLoginPage) {
      // 已经登录过还停在认证中心：该子系统的 SSO 接入没走通
      status = loggedIn ? 'stuck-at-sso' : 'need-login'
      detail = loggedIn ? '已登录仍被要求重新登录' : '未登录（跳认证中心，属正常）'
    } else if (text.trim().length < 10) {
      status = 'blank'
      detail = '页面几乎无内容'
    } else if (!entry.expect.test(text)) {
      status = 'unexpected'
      detail = `未匹配预期关键词：${text.slice(0, 60)}`
    }
    if (errors.length) {
      status = status === 'ok' ? 'js-error' : status
      detail = (detail ? detail + '; ' : '') + errors[0]
    }
  } catch (e) {
    status = 'failed'
    detail = String(e?.message ?? e).slice(0, 100)
  }
  results.push({ name: entry.name, url: entry.url, finalUrl, title, status, detail })
  await ctx.close()
}

await browser.close()

if (asJson) {
  console.log(JSON.stringify(results, null, 2))
} else {
  const bad = results.filter((r) => r.status !== 'ok')
  for (const r of results) {
    const mark = r.status === 'ok' ? '✓' : '✗'
    console.log(`${mark} ${r.name.padEnd(14)} ${r.status.padEnd(12)} ${r.finalUrl.replace('http://localhost', '')}`)
    if (r.status !== 'ok') console.log(`    ${r.detail}`)
  }
  console.log(`\n在线 ${results.length - bad.length} / ${results.length}`)
  if (bad.length) console.log(`异常：${bad.map((r) => r.name).join('、')}`)
}

process.exit(results.some((r) => ['failed', 'http-error', 'stuck-at-sso', 'blank'].includes(r.status)) ? 1 : 0)
