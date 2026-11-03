/**
 * 生产监控相关页面的浏览器冒烟（真实渲染，不是接口层）
 *
 * 为什么需要它：前面几轮所有验证都停在接口层 —— 接口 200、body.code=0，
 * 但页面照样可能白屏：路由没切、组件抛错、字段口径对不上（例如 `onlineStatus`
 * 给了字符串而页面按数字判断）。这一类只有真开浏览器才看得见。
 *
 * 覆盖页面：
 *   · /production/monitor            用户端「生产监控看板」
 *   · /production/iot                用户端「设备列表」
 *   · /production/iot/bindings       用户端「设备绑定管理」
 *   · /admin/production/monitor      运营端「生产监控中心」
 *   · /admin/production/monitor/iot  运营端「IoT设备监控」
 *
 * 判据（每页三条）：
 *   ① 页面出现预期标题文案（说明路由 + 组件都活着）
 *   ② 没有 JS 运行时错误（console error / pageerror）
 *   ③ 没有接口返回业务错误（body.code != 0），已知的 silent 降级端点除外
 *
 * 用法：
 *   node scripts/smoke-production-monitor-ui.mjs [--base=http://localhost] [--user=admin] [--password=...] [--headful]
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/**
 * 用 playwright-core + 本机已装的 Chrome，而不是 puppeteer。
 *
 * 原因：本仓库没有装 puppeteer（旧的 e2e 脚本 require 它会直接 MODULE_NOT_FOUND），
 * 而 playwright 自带浏览器又要额外下 150MB。playwright-core 不带浏览器，
 * 指定本机 Chrome 的 executablePath 即可，装一次（隔离工作区）就能长期用。
 */
const require2 = createRequire(
  path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'),
)
const { chromium } = require2('playwright-core')

/** 本机 Chrome / Edge 的候选路径（先 Chrome 后 Edge） */
const BROWSER_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const BASE_URL = arg('base', 'http://localhost')
const USER = arg('user', 'admin')
const PASSWORD = arg('password', 'Admin@123')
const HEADFUL = process.argv.includes('--headful')

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 外部第三方脚本的域名白名单：这些脚本的报错不算本系统的问题。
 *
 * 实测：运营端监控中心会加载天地图 SDK（api.tianditu.gov.cn），离线/无网环境下
 * 它自己抛 `Cannot read properties of undefined (reading 'extend')`，
 * 栈顶就在 `military.js` 里 —— 与本仓库代码无关，但会把"无 JS 错误"这条判死。
 * 这类错误单独列出来当提示，不参与失败判定。
 */
const EXTERNAL_SCRIPT_HOSTS = ['api.tianditu.gov.cn', 'tianditu.gov.cn', 'map.baidu.com', 'webapi.amap.com']

/** 判断一条错误信息是否来自外部脚本 */
function isExternalError(text) {
  return EXTERNAL_SCRIPT_HOSTS.some((host) => String(text ?? '').includes(host))
}

/** 接口返回业务错误时的白名单（页面本身对它们做了降级，不该算失败） */
const SILENT_ENDPOINTS = [
  '/api/v1/production/admin/monitor/overview',
  '/api/v1/production/admin/monitor/alerts',
  '/api/v1/production/admin/monitor/tasks',
]

/* ==================== 0) 接口登录 + 取权限 ==================== */
const login = await (await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
})).json()
check(login.code === 0, `登录（${USER}）`, `code=${login.code}`)
if (login.code !== 0) process.exit(1)
const token = login.data.accessToken

const permRes = await (
  await fetch(`${BASE_URL}/api/v1/platform/permissions/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  })
).json()
const permissions = permRes?.data?.permissions ?? permRes?.data ?? []
const permissionList = Array.isArray(permissions)
  ? permissions.map((item) => (typeof item === 'string' ? item : item?.code)).filter(Boolean)
  : []

const farmRes = await (
  await fetch(`${BASE_URL}/api/v1/production/farms?pageNum=1&pageSize=100`, {
    headers: { Authorization: `Bearer ${token}` },
  })
).json()
const farmList = farmRes?.data?.records ?? farmRes?.data?.list ?? []

/**
 * 挑一个**真的有设备**的农场作为当前农场。
 *
 * 为什么不能直接用第一个：农场列表里混着一批"测试农场"，设备数是 0，
 * 页面显示 0/0 也会让"数字对得上"这条断言无条件通过（假绿）。
 */
let firstFarm = farmList[0]
for (const farm of farmList.slice(0, 12)) {
  const probe = await (
    await fetch(`${BASE_URL}/api/v1/production/iot/device-stats?farmId=${encodeURIComponent(farm.farmId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).json()
  if (Number(probe?.data?.total ?? 0) > 0) {
    firstFarm = farm
    break
  }
}
if (firstFarm) {
  console.log(`当前农场：${firstFarm.farmName}（${firstFarm.farmId}）`)
}

/* ==================== 1) 启动浏览器 ==================== */
const { existsSync } = require2('node:fs')
const executablePath = BROWSER_CANDIDATES.find((item) => existsSync(item))
if (!executablePath) {
  console.error('找不到本机 Chrome/Edge，无法做浏览器冒烟')
  process.exit(2)
}
const browser = await chromium.launch({
  headless: !HEADFUL,
  executablePath,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
})
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

/** 当前页的运行时错误与业务错误收集器 */
let consoleErrors = []
let externalErrors = []
let apiErrors = []
let currentPage = ''

page.on('console', (msg) => {
  if (msg.type() !== 'error') return
  const text = msg.text().slice(0, 300)
  if (isExternalError(text)) {
    externalErrors.push(text)
  } else {
    consoleErrors.push(text)
  }
})
page.on('pageerror', (error) => {
  const text = `pageerror: ${String(error?.message ?? error).slice(0, 200)} @ ${String(error?.stack ?? '')
    .split('\n')[1]
    ?.trim() ?? ''}`
  if (isExternalError(text)) {
    externalErrors.push(text)
  } else {
    consoleErrors.push(text)
  }
})
page.on('response', async (res) => {
  const url = res.url()
  if (!url.includes('/api/')) return
  if (SILENT_ENDPOINTS.some((item) => url.includes(item))) return
  if (res.status() >= 500) {
    apiErrors.push(`${res.status()} ${url.replace(BASE_URL, '')}`)
    return
  }
  if (res.status() !== 200) return
  try {
    const body = await res.json()
    if (body && typeof body.code === 'number' && body.code !== 0 && body.code !== 200) {
      apiErrors.push(`code=${body.code} ${url.replace(BASE_URL, '')} ${String(body.message ?? '').slice(0, 80)}`)
    }
  } catch {
    /* 非 JSON 响应忽略 */
  }
})

try {
  // 种 Cookie（HttpOnly，页面拿不到）+ 非凭证界面态
  await page.goto(`${BASE_URL}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.evaluate(async (creds) => {
    try {
      await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(creds),
      })
    } catch {
      /* 由后续页面表现反映 */
    }
  }, { username: USER, password: PASSWORD, marketId: 1 })
  await page.addInitScript(
    (state) => {
      try {
        localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
        localStorage.setItem('agri_roles', JSON.stringify(state.roles ?? []))
        localStorage.setItem('agri_permissions', JSON.stringify(state.permissions ?? []))
        localStorage.setItem('agri_market_id', String(state.marketId ?? 1))
        if (state.farm) localStorage.setItem('agri_current_farm', JSON.stringify(state.farm))
      } catch {
        /* localStorage 不可用则忽略 */
      }
    },
    {
      userInfo: login.data.user ?? {},
      roles: login.data.user?.roles ?? login.data.roles ?? [],
      permissions: permissionList,
      marketId: 1,
      farm: firstFarm
        ? { farmId: firstFarm.farmId, farmCode: firstFarm.farmCode, farmName: firstFarm.farmName }
        : null,
    },
  )

  /** 打开一个页面并做三项检查 */
  const visit = async (route, expectTexts, label) => {
    currentPage = route
    consoleErrors = []
    externalErrors = []
    apiErrors = []
    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
    await sleep(800)
    const text = await page.evaluate(() => document.body.innerText)
    const url = page.url().replace(BASE_URL, '')

    for (const expect of expectTexts) {
      check(text.includes(expect), `${label}：出现「${expect}」`, `url=${url}`)
    }
    const realConsole = consoleErrors.filter((item) => !item.includes('favicon'))
    check(realConsole.length === 0, `${label}：无 JS 运行时错误`,
      realConsole.length ? realConsole.slice(0, 2).join(' | ') : '')
    if (externalErrors.length > 0) {
      console.log(`  ⚠ ${label}：外部脚本报错 ${externalErrors.length} 条（不计入失败）—— ${externalErrors[0].slice(0, 90)}`)
    }
    check(apiErrors.length === 0, `${label}：无接口业务错误`,
      apiErrors.length ? apiErrors.slice(0, 3).join(' | ') : '')
  }

  await visit('/production/monitor', ['生产监控看板', '在线设备', '环境概览', '设备实时'], '用户端看板')
  await visit('/production/iot', ['IoT设备管理', '设备编码'], '设备列表')
  await visit('/production/iot/bindings', ['设备绑定管理'], '设备绑定')
  await visit('/admin/production/monitor', ['生产监控中心'], '运营端监控中心')
  await visit('/admin/production/monitor/iot', ['IoT设备监控'], '运营端IoT监控')

  /* ==================== 2) 用户端看板的数字要真的出来 ==================== */
  await page.goto(`${BASE_URL}/production/monitor`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(800)
  const boardText = await page.evaluate(() => document.body.innerText)

  // 看板按「当前农场」取数，所以断言也要用同一个口径 —— 拿全租户的 29 去比会假失败
  const farmId = firstFarm?.farmId
  const statsRes = await (
    await fetch(
      `${BASE_URL}/api/v1/production/iot/device-stats${farmId ? `?farmId=${encodeURIComponent(farmId)}` : ''}`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
  ).json()
  const expectOnline = Number(statsRes?.data?.online ?? -1)
  const expectTotal = Number(statsRes?.data?.total ?? -1)
  check(
    boardText.includes(`${expectOnline}`) && boardText.includes(`${expectTotal}`),
    '看板「在线设备」数字与当前农场的设备统计一致',
    `农场 ${farmId ?? '(全部)'}：期望页面含 ${expectOnline} / ${expectTotal}`,
  )
  check(!boardText.includes('环境数据加载失败'), '看板环境概览未报加载失败')
  check(!boardText.includes('设备数据加载失败'), '看板设备实时未报加载失败')
} catch (error) {
  check(false, `冒烟执行异常（${currentPage}）`, String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log(`  - ${item}`))
process.exit(1)
