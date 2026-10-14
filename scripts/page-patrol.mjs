/**
 * 生产管理模块「页面运行时巡检台」（浏览器真实巡检）
 *
 * 用途
 * ----
 * 用真实浏览器（Chromium / Puppeteer）逐条打开 `agri-production/frontend` 的路由，
 * 记录每个页面：`路径 / 是否白屏 / console 错误数 / 首条错误文本 / 是否出现演示数据横幅 / 截图路径`。
 *
 * 设计原则
 * --------
 * 1. **路由自动提取**：路由清单从 `src/router/routes.tsx` 实时解析，禁止手写路径清单，
 *    避免路由表增删后巡检清单漂移。
 * 2. **只观测、不修复**：本脚本不修改任何被测页面源码，不 mock 任何接口，不跳过失败页面。
 *    跑不通就如实记录「跑不通」，这是本脚本存在的全部价值。
 * 3. **轻量 / 深度两档**：
 *    - `light`（默认）：对全部路由执行 goto + 网络空闲 + 收集 console error / pageerror。
 *    - `deep` ：在 light 基础上额外截图 + 判定「是否有真实内容」+ 判定演示数据横幅。
 *    pilot 阶段建议 `--mode deep --limit 10`。
 * 4. **截图出仓库**：截图默认落 `/tmp/agri-patrol-shots`（可用 `--shots` 覆盖），绝不写入仓库。
 *
 * 用法
 * ----
 *   node scripts/page-patrol.mjs --base http://localhost:5199
 *   node scripts/page-patrol.mjs --mode deep --limit 10
 *   node scripts/page-patrol.mjs --only-user          # 只跑用户端
 *   node scripts/page-patrol.mjs --filter farms       # 只跑路径含 farms 的路由
 *
 * 依赖
 * ----
 * puppeteer 未写入 package.json（用 `npm i puppeteer --no-save` 安装），
 * 因此本脚本在缺失 puppeteer 时会给出明确的安装指引并退出，而不是静默降级。
 *
 * @module scripts/page-patrol
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

/* ============================ 常量 ============================ */

/**
 * 仓库根目录（本文件位于 <repo>/scripts/ 下）。
 *
 * 必须用 `fileURLToPath` 而非 `new URL().pathname`：仓库路径含中文，
 * `pathname` 会保留百分号转义，直接拼路径会找不到路由文件。
 */
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

/** 前端根目录 */
const FRONTEND_ROOT = path.join(REPO_ROOT, 'agri-production', 'frontend')

/** 路由注册表（唯一路由配置源） */
const ROUTES_FILE = path.join(FRONTEND_ROOT, 'src', 'router', 'routes.tsx')

/** 用户端父级路径前缀（见 src/router/index.tsx） */
const USER_PREFIX = '/production'

/** 运营端父级路径前缀（见 src/router/index.tsx） */
const ADMIN_PREFIX = '/admin/production'

/** localStorage 中访问令牌的键（见 src/store/auth.ts 的 TOKEN_KEY） */
const TOKEN_KEY = 'agri_token'

/** localStorage 中刷新令牌的键 */
const REFRESH_TOKEN_KEY = 'agri_refresh_token'

/** localStorage 中用户信息的键 */
const USER_INFO_KEY = 'agri_user_info'

/** 视为「演示数据横幅」的文案关键词（实测页面上存在「【演示】xxx」租户标签与「演示数据」横幅两种形态） */
const DEMO_BANNER_KEYWORDS = ['演示数据', '【演示】', '示例数据', '演示环境', 'mock 数据', 'Mock数据']

/**
 * 视为「框架噪声」的 console error 特征（antd/React 弃用告警等）。
 *
 * 这些文本会污染错误计数，但并非被测页面的缺陷，因此单独统计一栏 `consoleErrorsReal`，
 * 原始 `consoleErrors` 仍保留，两栏都进报告，不做任何隐藏。
 */
const CONSOLE_NOISE_PATTERNS = [
  /\[antd[^\]]*\][\s\S]*deprecated/i,
  /\bdeprecated\b/i,
  /Download the React DevTools/i,
  /favicon/i,
]

/**
 * 判定一条 console error 是否属于框架噪声。
 *
 * @param {string} text console 文本
 * @returns {boolean} 是噪声返回 true
 */
function isConsoleNoise(text) {
  return CONSOLE_NOISE_PATTERNS.some((re) => re.test(text))
}

/** 默认前端基址 */
const DEFAULT_BASE = 'http://localhost:5199'

/** 默认后端基址（用于取登录令牌） */
const DEFAULT_API = 'http://localhost:8099'

/* ============================ 参数解析 ============================ */

/**
 * 解析命令行参数。
 *
 * @param {string[]} argv 命令行参数数组（不含 node 与脚本名）
 * @returns {Record<string, string|boolean>} 解析后的参数表
 */
function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) continue
    const eq = token.indexOf('=')
    if (eq > 0) {
      out[token.slice(2, eq)] = token.slice(eq + 1)
      continue
    }
    const next = argv[i + 1]
    if (next && !next.startsWith('--')) {
      out[token.slice(2)] = next
      i += 1
    } else {
      out[token.slice(2)] = true
    }
  }
  return out
}

const args = parseArgs(process.argv.slice(2))

/** 前端基址 */
const BASE_URL = String(args.base ?? DEFAULT_BASE).replace(/\/+$/, '')
/** 后端基址 */
/**
 * 后端基址（取登录令牌用）。默认**与前端同源**（--base 那个地址）：页面本身就是通过它取数据
 * （部署态经网关 :80 转发 /api，dev 态由 vite 代理）。这里曾写死 core-platform 的默认端口 8099，
 * 而本机实际在 8093、网关在 :80 —— 登录必然失败，巡检静默退化成"未登录态扫描"：页面全 401、
 * 数据一律为空，汇总却照样显示"0 白屏 0 未捕获异常"，看起来像通过。需要单独指定时用 --api。
 */
const API_URL = String(args.api ?? args.base ?? DEFAULT_API).replace(/\/+$/, '')
/** 巡检模式：light | deep */
const MODE = String(args.mode ?? 'light').toLowerCase()
/** 深度巡检条数上限（0 表示不限） */
const LIMIT = Number(args.limit ?? 0) || 0
/** 只跑用户端 */
const ONLY_USER = Boolean(args['only-user'])
/** 只跑运营端 */
const ONLY_ADMIN = Boolean(args['only-admin'])
/** 路径过滤关键字（支持逗号分隔，命中任意一个即保留） */
const FILTERS = args.filter
  ? String(args.filter)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  : []
/** 截图输出目录 */
const SHOT_DIR = String(args.shots ?? path.join(os.tmpdir(), 'agri-patrol-shots'))
/** 单页超时（毫秒） */
const PAGE_TIMEOUT = Number(args.timeout ?? 45000)
/** 报告输出路径（JSON） */
const REPORT_FILE = String(args.out ?? path.join(os.tmpdir(), 'agri-patrol-report.json'))
/** 跳过登录（用于验证「未登录」状态下的真实表现） */
const NO_LOGIN = Boolean(args['no-login'])
/** 登录用户名 */
const LOGIN_USER = String(args.user ?? 'admin')
/** 登录口令；缺省时回落到 AdminUserInitializer 中的默认值 */
const LOGIN_PASS = String(args.pass ?? 'Admin@123')

/* ============================ 路由提取 ============================ */

/**
 * 从 `src/router/routes.tsx` 解析出全量页面路由。
 *
 * 解析策略（不依赖 TS 编译器，纯文本解析，避免为了取路由而执行页面导入）：
 * - 按 `export const USER_ROUTES` / `export const ADMIN_ROUTES` 切成两个块；
 * - 块内逐行匹配 `path: 'xxx'`；
 * - 路由 `path` 是**相对路径**（不以 `/` 开头），而 `meta.path` 是绝对路径（以 `/` 开头），
 *   用这一特征区分二者，避免把 meta.path 误当成路由项；
 * - `index: true` 的索引重定向没有 path，天然被跳过。
 *
 * @returns {{routes: Array<{side: string, routePath: string, fullPath: string, name: string}>, stats: {user: number, admin: number}}}
 *   路由列表与统计信息
 * @throws {Error} 路由文件不存在时抛出
 */
function extractRoutes() {
  if (!fs.existsSync(ROUTES_FILE)) {
    throw new Error(`路由文件不存在：${ROUTES_FILE}`)
  }
  const source = fs.readFileSync(ROUTES_FILE, 'utf8')
  const userAt = source.indexOf('export const USER_ROUTES')
  const adminAt = source.indexOf('export const ADMIN_ROUTES')
  if (userAt < 0 || adminAt < 0) {
    throw new Error('routes.tsx 中未找到 USER_ROUTES / ADMIN_ROUTES 导出，解析中止')
  }

  const userBlock = source.slice(userAt, adminAt)
  const adminBlock = source.slice(adminAt)

  /**
   * 从单个路由块中解析相对路径列表。
   *
   * @param {string} block 路由块源码
   * @returns {string[]} 相对路径数组（保持原顺序，已去重）
   */
  const parseBlock = (block) => {
    const found = []
    const re = /^\s*path:\s*'([^']+)'/gm
    let match = re.exec(block)
    while (match !== null) {
      const value = match[1]
      // 只取相对路径（路由项），跳过 meta.path 这类绝对路径
      if (!value.startsWith('/') && !found.includes(value)) {
        found.push(value)
      }
      match = re.exec(block)
    }
    return found
  }

  /**
   * 从块中提取与某个路由路径相邻的页面名称（meta.name），取不到时回落空串。
   *
   * @param {string} block 路由块源码
   * @param {string} routePath 相对路由路径
   * @returns {string} 页面名称
   */
  const parseName = (block, routePath) => {
    const idx = block.indexOf(`path: '${routePath}'`)
    if (idx < 0) return ''
    const window = block.slice(idx, idx + 400)
    const m = /name:\s*'([^']+)'/.exec(window)
    return m ? m[1] : ''
  }

  const userPaths = parseBlock(userBlock)
  const adminPaths = parseBlock(adminBlock)

  const routes = []
  for (const p of userPaths) {
    routes.push({
      side: 'user',
      routePath: p,
      fullPath: `${USER_PREFIX}/${p}`,
      name: parseName(userBlock, p),
    })
  }
  for (const p of adminPaths) {
    routes.push({
      side: 'admin',
      routePath: p,
      fullPath: `${ADMIN_PREFIX}/${p}`,
      name: parseName(adminBlock, p),
    })
  }

  return { routes, stats: { user: userPaths.length, admin: adminPaths.length } }
}

/**
 * 按命令行筛选条件过滤路由。
 *
 * @param {Array<object>} routes 全量路由
 * @returns {Array<object>} 过滤后的路由
 */
function applyFilters(routes) {
  let list = routes
  if (ONLY_USER) list = list.filter((r) => r.side === 'user')
  if (ONLY_ADMIN) list = list.filter((r) => r.side === 'admin')
  if (FILTERS.length) {
    list = list.filter((r) =>
      // 以 `=` 开头的过滤项表示全路径精确匹配（`/` 可省略，规避 MSYS/Git Bash 的参数路径转换），
      // 否则按子串匹配
      FILTERS.some((f) => {
        if (!f.startsWith('=')) return r.fullPath.includes(f)
        const want = f.slice(1).replace(/^\/+/, '')
        return r.fullPath.replace(/^\/+/, '') === want
      })
    )
  }
  // 动态段（:xxx）在巡检时必须替换成占位值，否则访问的是字面量 :xxx
  return list.map((r) => ({
    ...r,
    fullPath: r.fullPath.replace(/:([A-Za-z0-9_]+)/g, '1'),
    hasDynamicSegment: /:[A-Za-z0-9_]+/.test(r.fullPath),
  }))
}

/* ============================ 登录态 ============================ */

/**
 * 调用后端登录端点换取访问令牌。
 *
 * 登录端点：`POST /api/v1/auth/login`，响应体的 `data.accessToken` 为令牌字段名。
 * 口令来源优先级：命令行 `--pass` > 环境变量 `AGRI_ADMIN_PASSWORD` > 源码默认值。
 *
 * @returns {Promise<{ok: boolean, token?: string, refreshToken?: string, user?: object,
 *   userInfo?: object, roles?: string[], reason?: string}>}
 *   登录结果；失败时 ok=false 并给出原因
 */
async function login() {
  const password = process.env.AGRI_ADMIN_PASSWORD || LOGIN_PASS
  const url = `${API_URL}/api/v1/auth/login`
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: LOGIN_USER, password, marketId: 1 }),
    })
    const text = await res.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      return { ok: false, reason: `登录响应非 JSON（HTTP ${res.status}）：${text.slice(0, 200)}` }
    }
    const data = body && typeof body === 'object' && 'data' in body ? body.data : body
    const token = data && data.accessToken
    if (!token) {
      return { ok: false, reason: `登录响应缺少 accessToken（HTTP ${res.status}）：${text.slice(0, 300)}` }
    }
    return {
      ok: true,
      token,
      refreshToken: data.refreshToken ?? '',
      user: data.user ?? null,
      // 与前端 persistSession（src/api/auth.ts）完全同构地映射 userInfo / roles / permissions，
      // 避免「巡检台注入的登录态」与「真实登录页写入的登录态」形状不一致，
      // 导致页面头部把已登录误显示成「未登录」这类**巡检台自身造成的假象**。
      userInfo: {
        userId: data.user?.id ?? '',
        username: data.user?.username ?? '',
        realName: data.user?.nickname ?? data.user?.username ?? '',
        tenantId: '',
        userType: 1,
      },
      roles: data.user?.roles ?? [],
    }
  } catch (err) {
    return { ok: false, reason: `登录请求失败：${err && err.message ? err.message : String(err)}` }
  }
}

/* ============================ 巡检执行 ============================ */

/**
 * 载入 puppeteer。
 *
 * puppeteer 用 `npm i puppeteer --no-save` 装在**前端目录**的 node_modules 里，
 * 而本脚本位于仓库 `scripts/` 下，Node 的默认解析路径找不到它，
 * 因此这里显式回落到 `agri-production/frontend/node_modules/puppeteer`。
 *
 * @returns {Promise<object>} puppeteer 模块
 * @throws {Error} 驱动缺失时抛出带安装指引的错误
 */
async function loadPuppeteer() {
  // 用 createRequire 从前端目录解析，可解析到包入口的真实文件路径（ESM 不能直接 import 目录）
  const frontendRequire = createRequire(path.join(FRONTEND_ROOT, 'package.json'))
  const candidates = []
  for (const spec of ['puppeteer', 'puppeteer-core']) {
    for (const base of [import.meta.url, path.join(FRONTEND_ROOT, 'package.json')]) {
      try {
        candidates.push(createRequire(base).resolve(spec))
      } catch {
        /* 该解析基点下不可达，尝试下一个 */
      }
    }
  }
  for (const resolved of candidates) {
    try {
      const mod = await import(pathToFileURL(resolved).href)
      return mod.default ?? mod
    } catch (err) {
      console.warn(`[patrol] 驱动候选 ${resolved} 载入失败：${err && err.message ? err.message : err}`)
    }
  }
  void frontendRequire
  throw new Error(
    '未找到浏览器驱动。请在前端目录执行（务必 --no-save，不要污染 package.json）：\n' +
      '  cd agri-production/frontend && npm i puppeteer --no-save\n' +
      '若默认源失败：npm i puppeteer --no-save --registry=https://registry.npmmirror.com'
  )
}

/**
 * 判定页面是否「白屏」。
 *
 * 判据（三条同时满足才算白屏，避免把「骨架屏」误判为白屏）：
 * - body 可见文本长度 < 20；
 * - 渲染出的 DOM 节点数 < 30；
 * - 不存在 <table> / <canvas> / antd 卡片等容器节点。
 *
 * @param {object} page puppeteer 页面对象
 * @returns {Promise<{blank: boolean, textLen: number, nodeCount: number}>} 判定结果
 */
async function evaluateBlank(page) {
  return page.evaluate(() => {
    const body = document.body
    const text = (body && body.innerText ? body.innerText : '').replace(/\s+/g, ' ').trim()
    const nodeCount = body ? body.querySelectorAll('*').length : 0
    const hasContainer =
      document.querySelectorAll('table,canvas,.ant-card,.ant-table,.ant-list,.ant-statistic,.ant-descriptions')
        .length > 0
    return {
      blank: text.length < 20 && nodeCount < 30 && !hasContainer,
      textLen: text.length,
      nodeCount,
    }
  })
}

/**
 * 判定页面是否出现「演示数据」横幅。
 *
 * @param {object} page puppeteer 页面对象
 * @returns {Promise<{demo: boolean, snippet: string}>} 判定结果与命中片段
 */
async function evaluateDemoBanner(page) {
  return page.evaluate((keywords) => {
    const text = (document.body && document.body.innerText ? document.body.innerText : '')
    for (const kw of keywords) {
      const at = text.indexOf(kw)
      if (at >= 0) {
        return { demo: true, snippet: text.slice(Math.max(0, at - 30), at + 60).replace(/\s+/g, ' ') }
      }
    }
    return { demo: false, snippet: '' }
  }, DEMO_BANNER_KEYWORDS)
}

/**
 * 巡检单个路由。
 *
 * @param {object} ctx 上下文 { browser, token, shotDir }
 * @param {object} route 路由对象 { side, routePath, fullPath, name, hasDynamicSegment }
 * @param {boolean} deep 是否深度巡检（截图 + 内容判定）
 * @returns {Promise<object>} 该页面的巡检记录
 */
async function patrolOne(ctx, route, deep) {
  const { browser, token } = ctx
  const record = {
    path: route.fullPath,
    routePath: route.routePath,
    side: route.side,
    name: route.name,
    dynamicSegment: Boolean(route.hasDynamicSegment),
    ok: false,
    httpStatus: null,
    blank: null,
    textLen: null,
    nodeCount: null,
    consoleErrors: 0,
    pageErrors: 0,
    consoleErrorsReal: 0,
    firstError: '',
    firstRealError: '',
    /** 首条未捕获异常的**原始完整堆栈**（不截断、不转述），供人工定位源码坐标 */
    firstPageErrorStack: '',
    demoBanner: null,
    demoSnippet: '',
    screenshot: '',
    note: '',
  }

  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  /** @type {string[]} 收集到的 console error 文本 */
  const consoleErrors = []
  /** @type {string[]} 收集到的未捕获异常文本 */
  const pageErrors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
  /** @type {string[]} 失败请求（URL 级）：只有"页面出错"没有"哪个 URL 出错"时，排查只能靠猜 */
  const failedUrls = []
  // 实测教训：巡检台一度显示"0 白屏 0 未捕获异常"，而页面其实停在登录页、
  // 每条路由两个 401 —— 但报告里只有一句通用文案，不知道 401 打在哪个端点上。
  page.on('requestfailed', (req) => {
    const err = req.failure && req.failure() ? req.failure().errorText : ''
    failedUrls.push(`REQFAIL ${req.method()} ${req.url()} ${err}`)
  })
  /** @type {string[]} 所有 /api/ 调用的状态（用来回答"页面到底调了谁、结果如何"） */
  const apiCalls = []
  page.on('response', (res) => {
    const url = res.url()
    if (url.includes('/api/')) {
      apiCalls.push(`${res.status()} ${res.request().method()} ${url.replace('http://localhost', '')}`)
    }
  })
  page.on('response', (res) => {
    if (res.status() >= 400) {
      failedUrls.push(`${res.status()} ${res.request().method()} ${res.url()}`)
    }
  })
  page.on('pageerror', (err) => {
    // 优先保留完整 stack（含源码坐标），退化为 message
    pageErrors.push(err && err.stack ? err.stack : err && err.message ? err.message : String(err))
  })

  // 登录态：**在页面里调一次登录接口**，让浏览器把刷新令牌收进 HttpOnly Cookie。
  // 注意落点必须是**静态同源 URL**：落 /login 会整页送去统一认证中心（另一个源），
  // 于是这次登录会把刷新 Cookie 种到**认证中心的域**上，应用源上没有 Cookie（实测踩到）；
  // 落应用路由则会先以未登录态启动应用、触发 401 链。manifest.json 是桶里的静态文件，两者都不是。
  //
  // 为什么不往 localStorage 写令牌（这版之前就是这么写的，一直没登进去）：前端按
  // V2.0 4.3 已把访问令牌改成"只在内存 + HttpOnly Cookie 静默续签"，
  // src/store/auth.ts 启动时还会主动**删掉** localStorage 里的 agri_token/agri_refresh_token，
  // 所以写进去既不生效、还会被清掉 —— 表现为页面全程 401 并跳登录页，而汇总表只显示
  // "0 白屏 0 异常"，看起来像通过。
  // 现在的做法与真实用户一致：先落到本域，再在页面上下文里发一次登录请求（凭据走 Cookie），
  // 随后 page.goto 目标路由时，应用的 bootstrapAuthRefresh 会用 Cookie 换回访问令牌。
  if (token) {
    try {
      await page.goto(`${BASE_URL}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    } catch {
      /* 登录页本身加载失败也继续：后面 goto 目标路由会如实报错 */
    }
    try {
      await page.evaluate(
        async (creds) => {
          try {
            await fetch('/api/v1/auth/login', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify(creds),
            })
          } catch {
            /* 网络失败不在此处报错，由目标页面的表现反映 */
          }
        },
        {
          username: LOGIN_USER,
          password: process.env.AGRI_ADMIN_PASSWORD || LOGIN_PASS,
          marketId: 1,
        },
      )
    } catch {
      /* 页面已导航走的竞态：忽略，目标路由仍会重新加载应用 */
    }
  }
  // 还要写入**非凭证的界面态**（用户资料 / 角色 / 权限 / 市场），与真实登录页的 persistSession 一致。
  //
  // 为什么不能只拿 Cookie：bootstrapAuthRefresh() 有一道门槛 ——
  // 「只有本机上次确实登录过的痕迹（本地留有 userInfo）才值得跑续签，未登录访客直接跳过」。
  // 少写这一项，应用就认定"没登录过" -> 根本不发 /auth/refresh -> authReady=true 但 token=null
  // -> 布局（农场切换器 / 消息铃铛）带空令牌发请求 -> 401 -> 全局 401 处理清登录态并跳登录页，
  // 而页面自己的接口一个都没来得及调。实测：7 条路由的调用列表里只有
  // farms/all(401)、messages/unread-count(401)、auth/logout(200)，被测页面自己的接口从未被调用。
  //
  // 这几项按 src/store/auth.ts 的设计本来就**不是凭证**（令牌始终只在内存 + HttpOnly Cookie），
  // 写它们不绕过任何安全机制，只是把"这个浏览器上次登录过"这一事实告诉应用。
  // 界面态用 evaluateOnNewDocument 写：它在**应用脚本之前**执行，不参与导航竞态。
  //
  // 为什么不能用 page.evaluate 写（上一版就是这么写的，实测失败）：`/login` 这个路由会立刻
  // 把整页送去统一认证中心，evaluate 与那次导航抢同一个执行上下文 —— 写入被丢掉。
  // 现场回读的证据：目标页最终停在 /login、正文是「统一认证中心 …」，而
  // localStorage 的 agri_user_info 长度为 0（我的写入没落盘）。
  if (token && ctx.userInfo) {
    await page.evaluateOnNewDocument(
      (state) => {
        try {
          localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
          localStorage.setItem('agri_roles', JSON.stringify(state.roles ?? []))
          localStorage.setItem('agri_permissions', JSON.stringify(state.permissions ?? []))
          localStorage.setItem('agri_market_id', String(state.marketId ?? 1))
        } catch {
          /* localStorage unavailable: ignore */
        }
      },
      { userInfo: ctx.userInfo, roles: ctx.roles ?? [], permissions: [], marketId: 1 },
    )
  }
  const target = `${BASE_URL}${route.fullPath}`
  try {
    const resp = await page.goto(target, {
      waitUntil: 'networkidle2',
      timeout: PAGE_TIMEOUT,
    })
    record.httpStatus = resp ? resp.status() : null
  } catch (err) {
    record.note = `goto 失败：${err && err.message ? err.message : String(err)}`
  }
  // 网络空闲后再给 React 一帧时间完成懒加载组件的渲染
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 800))

  try {
    const blank = await evaluateBlank(page)
    record.blank = blank.blank
    record.textLen = blank.textLen
    record.nodeCount = blank.nodeCount
  } catch (err) {
    record.note += ` | 白屏判定失败：${err && err.message ? err.message : String(err)}`
  }

  // 回读现场：注入的界面态到底有没有生效、页面最终停在哪、正文前 160 字是什么。
  // 这一步是给"注入没生效"这种自我欺骗留的自证手段 —— 光看"0 异常"永远发现不了。
  try {
    const diag = await page.evaluate(() => {
      let userInfoLen = 0
      try {
          userInfoLen = (localStorage.getItem('agri_user_info') || '').length
      } catch {
        /* localStorage unavailable */
      }
      return {
        userInfoLen,
        path: location.pathname,
        text: (document.body && document.body.innerText ? document.body.innerText : '')
          .replace(/\s+/g, ' ')
          .slice(0, 160),
      }
    })
    record.userInfoLen = diag.userInfoLen
    record.finalPath = diag.path
    record.bodyText = diag.text
  } catch (err) {
    record.note += ` | 回读失败：${err && err.message ? err.message : String(err)}`
  }
  record.consoleErrors = consoleErrors.length
  record.pageErrors = pageErrors.length
  const all = [...pageErrors, ...consoleErrors]
  record.firstError = all.length ? String(all[0]).slice(0, 300) : ''
  const realConsole = consoleErrors.filter((t) => !isConsoleNoise(t))
  record.consoleErrorsReal = realConsole.length
  const realAll = [...pageErrors, ...realConsole]
  record.firstRealError = realAll.length ? String(realAll[0]).slice(0, 300) : ''
  // 原始堆栈不截断：转述过的「文件:行号」属于二手信息，会误导修复者，这里必须留原文
  record.firstPageErrorStack = pageErrors.length ? String(pageErrors[0]) : ''
  // 失败请求按 URL 落进报告（最多 10 条，够定位即可）
  record.failedUrls = failedUrls.slice(0, 10)
  record.apiCalls = apiCalls.slice(0, 40)
  record.ok = record.httpStatus !== null && record.blank === false

  if (deep) {
    try {
      const demo = await evaluateDemoBanner(page)
      record.demoBanner = demo.demo
      record.demoSnippet = demo.snippet
    } catch {
      record.demoBanner = null
    }
    const safeName = route.routePath.replace(/[^A-Za-z0-9]+/g, '_')
    const shotPath = path.join(SHOT_DIR, `${route.side}__${safeName}.png`)
    try {
      await page.screenshot({ path: shotPath, fullPage: false })
      record.screenshot = shotPath
    } catch (err) {
      record.note += ` | 截图失败：${err && err.message ? err.message : String(err)}`
    }
  }

  await page.close().catch(() => {})
  return record
}

/* ============================ 报告 ============================ */

/**
 * 把巡检记录渲染为 Markdown 表格。
 *
 * @param {Array<object>} records 巡检记录
 * @returns {string} Markdown 表格文本
 */
function renderTable(records) {
  const head =
    '| # | 路径 | 页面名 | 白屏 | console错误(真实) | 未捕获异常 | 演示数据横幅 | 首条真实错误（截断） | 截图 |\n' +
    '|---|------|--------|------|-------------------|------------|--------------|----------------------|------|'
  const rows = records.map((r, i) => {
    const blank = r.blank === null ? '未知' : r.blank ? '**是**' : '否'
    const demo = r.demoBanner === null ? '-' : r.demoBanner ? '**有**' : '无'
    const err = r.firstRealError ? r.firstRealError.replace(/\|/g, '\\|').slice(0, 120) : ''
    const shot = r.screenshot ? '有' : '-'
    const ce = `${r.consoleErrors}(${r.consoleErrorsReal})`
    return `| ${i + 1} | \`${r.path}\` | ${r.name || '-'} | ${blank} | ${ce} | ${r.pageErrors} | ${demo} | ${err} | ${shot} |`
  })
  return [head, ...rows].join('\n')
}

/* ============================ 主流程 ============================ */

/**
 * 主流程。
 *
 * @returns {Promise<void>}
 */
async function main() {
  fs.mkdirSync(SHOT_DIR, { recursive: true })

  const { routes, stats } = extractRoutes()
  const all = applyFilters(routes)
  console.log(`[patrol] 路由解析：用户端 ${stats.user} 条 / 运营端 ${stats.admin} 条 / 合计 ${stats.user + stats.admin} 条`)
  console.log(`[patrol] 本次待巡检：${all.length} 条（mode=${MODE}${LIMIT ? `, limit=${LIMIT}` : ''}）`)

  // deep 模式下，对前 LIMIT 条做深度巡检；未设 limit 时全部深检
  const deepCount = MODE === 'deep' ? (LIMIT > 0 ? Math.min(LIMIT, all.length) : all.length) : 0
  const deepSet = new Set(all.slice(0, deepCount).map((r) => r.fullPath))
  console.log(`[patrol] 深度巡检（含截图）：${deepCount} 条`)

  let auth = { ok: false, reason: '未尝试登录（--no-login）' }
  if (!NO_LOGIN) {
    auth = await login()
    if (auth.ok) {
      console.log(`[patrol] 登录成功：${LOGIN_USER} @ ${API_URL}`)
    } else {
      console.warn(`[patrol] 登录失败，将以未登录态巡检（结果会反映真实跳转行为）：${auth.reason}`)
    }
  }

  const puppeteer = await loadPuppeteer()
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--no-proxy-server'],
  })

  // 驱动自检：确认浏览器真的能启动
  const probe = await browser.newPage()
  await probe.goto('about:blank')
  await probe.close()
  console.log('[patrol] 浏览器自检通过（about:blank）')

  const ctx = {
    browser,
    token: auth.ok ? auth.token : null,
    refreshToken: auth.ok ? auth.refreshToken : null,
    userInfo: auth.ok ? auth.userInfo : null,
    roles: auth.ok ? auth.roles : [],
  }

  const records = []
  for (let i = 0; i < all.length; i += 1) {
    const route = all[i]
    const deep = deepSet.has(route.fullPath)
    const rec = await patrolOne(ctx, route, deep)
    records.push(rec)
    const flag = rec.blank ? '白屏' : rec.ok ? 'OK' : '异常'
    console.log(
      `[${i + 1}/${all.length}] ${flag} ${rec.path} (console=${rec.consoleErrors}, pageerror=${rec.pageErrors}${rec.demoBanner ? ', 演示数据' : ''})`
    )
  }

  await browser.close().catch(() => {})

  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    apiUrl: API_URL,
    mode: MODE,
    loginOk: auth.ok,
    loginReason: auth.ok ? '' : auth.reason,
    routeStats: stats,
    total: all.length,
    deepCount,
    summary: {
      blank: records.filter((r) => r.blank === true).length,
      withConsoleError: records.filter((r) => r.consoleErrors > 0).length,
      withRealConsoleError: records.filter((r) => r.consoleErrorsReal > 0).length,
      withPageError: records.filter((r) => r.pageErrors > 0).length,
      withDemoBanner: records.filter((r) => r.demoBanner === true).length,
      gotoFailed: records.filter((r) => r.note.includes('goto 失败')).length,
    },
    records,
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf8')

  console.log('\n===== 巡检汇总 =====')
  console.log(
    `总数 ${report.total} / 白屏 ${report.summary.blank} / 有console错误 ${report.summary.withConsoleError}（其中非框架噪声 ${report.summary.withRealConsoleError}） / 有未捕获异常 ${report.summary.withPageError} / goto失败 ${report.summary.gotoFailed}`
  )
  if (MODE === 'deep') {
    console.log(`演示数据横幅命中：${report.summary.withDemoBanner}`)
  }
  console.log(`JSON 报告：${REPORT_FILE}`)
  console.log(`截图目录：${SHOT_DIR}`)
  console.log('\n===== 明细表 =====')
  console.log(renderTable(records))
}

main().catch((err) => {
  console.error('[patrol] 巡检台执行失败：', err && err.stack ? err.stack : err)
  process.exit(1)
})
