/**
 * 通用页面冒烟：给定路由，报告"能不能开、有没有报错、首屏有什么"。
 *
 * <p><b>为什么参数不带前导斜杠</b>：本机是 Git Bash / MSYS2 环境，命令行里以 `/`
 * 开头的参数会被当成路径做转换 —— `--route=/production/harvests` 会变成
 * `C:/Program Files/.../PortableGit/production/harvests`，请求直接打到不存在的域名。
 * 所以这里约定写成 `--route=production/harvests`（脚本内部补 `/`）。
 * 同一个坑 2026-10-28 已经在 `vite build --base=/prod/...` 上踩过一次。</p>
 *
 * <p>判据：</p>
 * <ul>
 *   <li>{@code --expect=文案}：首屏必须出现（可重复），验证路由与组件都活着；</li>
 *   <li>无自身 JS 运行时错误（外部脚本如天地图 SDK 单独归类为提示）；</li>
 *   <li>无接口业务错误（HTTP ≥500，或 HTTP 200 但 body.code ∉ {0,200}）。</li>
 * </ul>
 *
 * 用法：
 *   node scripts/smoke-pages.mjs \
 *     --route=production/harvests/plan --expect=地块采收记录 \
 *     --route=production/harvests --expect=采收记录 \
 *     --route=production/harvests/inventory --expect=库存管理
 *
 * 可选：--base=http://localhost --user=admin --password=... --headful
 */
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const WORKSPACE = 'C:/Users/71502/.workbuddy-ai/binaries/node/workspace'
const require2 = createRequire(path.join(WORKSPACE, 'noop.js'))
const { chromium } = require2('playwright-core')
const { existsSync } = require2('node:fs')

const BROWSER_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]

const argv = process.argv.slice(2)
const valuesOf = (name) =>
  argv.filter((a) => a.startsWith(`--${name}=`)).map((a) => a.split('=').slice(1).join('='))
const valueOf = (name, fallback) => valuesOf(name)[0] ?? fallback

const BASE_URL = valueOf('base', 'http://localhost')
const USER = valueOf('user', 'admin')
const PASSWORD = valueOf('password', 'Admin@123')
const HEADFUL = argv.includes('--headful')

/** 路由与期望文案按出现顺序配对 */
let routeInputs = valuesOf('route')
const expects = valuesOf('expect')

// 支持从文件批量读路由（一行一个，允许 # 注释与空行）—— 扫全站时命令行会超长
const routesFile = valueOf('routes-file', '')
if (routesFile) {
  const content = readFileSync(path.resolve(process.cwd(), routesFile), 'utf8')
  const fromFile = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
  routeInputs = [...routeInputs, ...fromFile]
}
const routes = routeInputs.map((item) => (item.startsWith('/') ? item : `/${item}`))
if (routes.length === 0) {
  console.error('至少给一个 --route=<路由，不带前导斜杠> 或 --routes-file=<文件>')
  process.exit(2)
}

const EXTERNAL_HOSTS = ['api.tianditu.gov.cn', 'tianditu.gov.cn', 'map.baidu.com', 'webapi.amap.com']

/**
 * 浏览器层面的**网络类**错误：请求根本没到服务端，属于环境/外链问题，不是本仓库的 JS 缺陷。
 * 实测：离线环境下页面里的外链图片/脚本会报 `net::ERR_NAME_NOT_RESOLVED`。
 */
const NETWORK_ERROR_HINTS = [
  'ERR_NAME_NOT_RESOLVED',
  'ERR_CONNECTION_REFUSED',
  'ERR_CONNECTION_TIMED_OUT',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_ADDRESS_UNREACHABLE',
]

const isExternal = (text) => {
  const raw = String(text ?? '')
  if (EXTERNAL_HOSTS.some((host) => raw.includes(host))) return true
  return NETWORK_ERROR_HINTS.some((hint) => raw.includes(hint))
}

/**
 * 已知的「按口径不提供」的接口：不算回归，但要在报告里看得见。
 *
 * 每一条都必须有**代码层面的依据**（后端注释或前端已做降级），
 * 否则就会变成"把真问题也登记成已知问题"的遮羞布。
 */
const EXPECTED_GAPS = [
  {
    match: '/production/settings/tenant',
    codes: [404],
    reason: '主体档案属平台域，UserSettingController 注释里明确"不实现 GET/PUT /settings/tenant"，页面已显示"未接入"提示',
  },
  {
    match: '/ai/yield-forecast',
    codes: [501],
    reason: '本部署未接入预测模型，后端按口径返回 501 而不是编造结果，页面已给空态',
  },
]

/** 判断某条接口错误是否属于已登记的口径内缺口 */
function expectedGapReason(message) {
  const gap = EXPECTED_GAPS.find(
    (item) => message.includes(item.match) && item.codes.some((code) => message.includes(`code=${code}`)),
  )
  return gap ? gap.reason : null
}

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/* ==================== 登录 + 农场上下文 ==================== */
const login = await (
  await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
  })
).json()
check(login.code === 0, `登录（${USER}）`, `code=${login.code}`)
if (login.code !== 0) process.exit(1)
const token = login.data.accessToken

const farmRes = await (
  await fetch(`${BASE_URL}/api/v1/production/farms?pageNum=1&pageSize=200`, {
    headers: { Authorization: `Bearer ${token}` },
  })
).json()
const farmList = farmRes?.data?.records ?? farmRes?.data?.list ?? []

/**
 * 挑一个有数据的农场当上下文，避免页面落在空农场上把断言跑成假绿。
 *
 * 不能"按农场列表顺序找第一个有采收的"：列表是按创建时间倒序的，
 * 前面全是联调期造的「测试农场xx」（都没有采收记录），扫十几个也扫不到有数据的那一个。
 * 反过来做 —— 先取一条真实采收批次，看它属于哪个农场，再去农场列表里定位。
 */
let currentFarm = farmList[0]
const sampleBatch = await (
  await fetch(`${BASE_URL}/api/v1/production/harvests?pageNum=1&pageSize=1`, {
    headers: { Authorization: `Bearer ${token}` },
  })
).json()
const sampleFarmId = sampleBatch?.data?.records?.[0]?.farmId ?? sampleBatch?.data?.list?.[0]?.farmId
if (sampleFarmId != null) {
  const matched = farmList.find((farm) => String(farm.farmId) === String(sampleFarmId))
  if (matched) currentFarm = matched
}
if (currentFarm) {
  console.log(`当前农场：${currentFarm.farmName}（${currentFarm.farmId}）\n`)
}

/* ==================== 启动浏览器 ==================== */
const executablePath = BROWSER_CANDIDATES.find((item) => existsSync(item))
if (!executablePath) {
  console.error('找不到本机 Chrome/Edge')
  process.exit(2)
}
const browser = await chromium.launch({ headless: !HEADFUL, executablePath, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

let jsErrors = []
let externalErrors = []
let apiErrors = []
let knownGaps = []

page.on('console', (msg) => {
  if (msg.type() !== 'error') return
  const text = msg.text().slice(0, 300)
  if (isExternal(text)) externalErrors.push(text)
  else jsErrors.push(text)
})
page.on('pageerror', (error) => {
  // 必须带上栈里的第一帧：外部 SDK（如天地图 military.js）抛的错，
  // 光看 message 是 `Cannot read properties of undefined (reading 'extend')`，
  // 跟本仓库的 bug 长得一模一样，只有栈帧能区分。
  const frame = String(error?.stack ?? '')
    .split('\n')
    .slice(1, 3)
    .map((line) => line.trim())
    .join(' ')
  const text = `pageerror: ${String(error?.message ?? error).slice(0, 160)} @ ${frame.slice(0, 160)}`
  if (isExternal(text)) externalErrors.push(text)
  else jsErrors.push(text)
})
page.on('response', async (res) => {
  const url = res.url()
  if (!url.includes('/api/')) return
  if (res.status() >= 500) {
    apiErrors.push(`${res.status()} ${url.replace(BASE_URL, '')}`)
    return
  }
  if (res.status() !== 200) return
  try {
    const body = await res.json()
    if (body && typeof body.code === 'number' && body.code !== 0 && body.code !== 200) {
      const message = `code=${body.code} ${url.replace(BASE_URL, '')} ${String(body.message ?? '').slice(0, 60)}`
      const reason = expectedGapReason(message)
      if (reason) {
        knownGaps.push(`${message}　（口径内：${reason}）`)
      } else {
        apiErrors.push(message)
      }
    }
  } catch {
    /* 非 JSON */
  }
})

try {
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
      /* 由页面表现反映 */
    }
  }, { username: USER, password: PASSWORD, marketId: 1 })
  await page.addInitScript(
    (state) => {
      try {
        localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
        localStorage.setItem('agri_roles', JSON.stringify(state.roles))
        localStorage.setItem('agri_permissions', JSON.stringify([]))
        localStorage.setItem('agri_market_id', '1')
        if (state.farm) localStorage.setItem('agri_current_farm', JSON.stringify(state.farm))
      } catch {
        /* ignore */
      }
    },
    {
      userInfo: login.data.user ?? {},
      roles: login.data.user?.roles ?? login.data.roles ?? [],
      farm: currentFarm
        ? { farmId: currentFarm.farmId, farmCode: currentFarm.farmCode, farmName: currentFarm.farmName }
        : null,
    },
  )

  for (let index = 0; index < routes.length; index += 1) {
    const route = routes[index]
    const expect = expects[index]
    jsErrors = []
    externalErrors = []
    apiErrors = []
    knownGaps = []

    // 每次导航前续期会话。
    // 不续期的话，扫几十个页面要两三分钟，access token 会中途过期，
    // 之后每个页面都跳到登录页 —— 看起来像"页面全坏了"，实际是脚本自己的问题
    // （表现为 /api/v1/auth/refresh 返回 code=5003）。
    await page
      .evaluate(async (creds) => {
        try {
          await fetch('/api/v1/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify(creds),
          })
        } catch {
          /* ignore */
        }
      }, { username: USER, password: PASSWORD, marketId: 1 })
      .catch(() => {})

    await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(1200)
    const text = await page.evaluate(() => document.body.innerText)
    const compact = text.replace(/\s+/g, ' ').trim()

    console.log(`\n### ${route}`)
    if (expect) {
      check(compact.includes(expect), `${route}：出现「${expect}」`, `首屏 ${compact.slice(0, 60)}`)
    }
    check(jsErrors.length === 0, `${route}：无 JS 运行时错误`, jsErrors.slice(0, 2).join(' | '))
    check(apiErrors.length === 0, `${route}：无接口业务错误`, apiErrors.slice(0, 3).join(' | '))
    if (externalErrors.length > 0) {
      console.log(`  ⚠ 外部资源/网络报错 ${externalErrors.length} 条（不计入失败）—— ${externalErrors[0].slice(0, 80)}`)
    }
    if (knownGaps.length > 0) {
      console.log(`  ⚠ 口径内未提供 ${knownGaps.length} 条（不计入失败）—— ${knownGaps[0].slice(0, 100)}`)
    }
    console.log(`  首屏文案：${compact.slice(0, 200)}`)
  }
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
