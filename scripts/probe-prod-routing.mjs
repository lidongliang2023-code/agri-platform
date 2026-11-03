#!/usr/bin/env node
/**
 * 生产域「路由归属」探针 —— 前端真的会发的 GET 请求，到底由谁服务。
 *
 * <p><b>为什么需要这个脚本</b>：`/api/v1/production/**` 由 nginx **按路径段**逐个切流
 * （见 `ops/gateway/conf/conf.d/20-prod.conf` 的白名单正则）。没切的段会落到
 * `core-platform` 兜底，而兜底返回的是 <b>HTTP 200 + body.code=500</b> ——
 * 页面上只显示"加载失败"，看不出是路由没切。2026-10-28 生产监控看板就踩过这个坑：
 * 服务在 8092 上跑得好好的，`/monitor/env-summary` 却被兜底给了平台侧。
 *
 * <p><b>与 `probe-frontend-api.mjs` 的分工</b>：那个脚本探的是"目标后端有没有处理器"
 * （打直连端口、会发 POST/PUT，跑完要还原数据）；本脚本只打 <b>GET</b>，
 * 目的是"经网关时这条请求落到谁身上、能不能拿到数据"，**不改数据**，可以随便反复跑。</p>
 *
 * <p><b>判据</b>（按 X-Served-By 响应头 + body.code）：</p>
 * <ul>
 *   <li>{@code agri-production} + code=0 → ✅ 正常</li>
 *   <li>{@code agri-production} + code=403 → ✅ 处理器在，只是当前账号没权限（路由没问题）</li>
 *   <li>{@code agri-production} + 其它 code → ⚠️ 处理器在，业务/参数问题（不算路由缺口）</li>
 *   <li>{@code core-platform} + code=0 → ⚠️ 平台侧在服务（该段尚未切流，页面可用）</li>
 *   <li>{@code core-platform} + code=500 → ❌ <b>路由缺口</b>：两边都没有处理器</li>
 * </ul>
 *
 * 用法：
 *   node scripts/probe-prod-routing.mjs [--base=http://localhost] [--user=farmer] [--password=...]
 *
 * 退出码：0 = 无路由缺口；1 = 有缺口。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const API_DIR = path.join(REPO_ROOT, 'agri-production/frontend/src/api')

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const BASE_URL = arg('base', 'http://localhost')
const USER = arg('user', 'farmer')
const PASSWORD = arg('password', 'Admin@123')

/* ==================== 1) 从前端 api 层抽取 GET 路径 ==================== */

/** 递归列出目录下所有 .ts 文件 */
function listTsFiles(dir) {
  const out = []
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full))
    } else if (name.endsWith('.ts')) {
      out.push(full)
    }
  }
  return out
}

/**
 * 抽取一个文件里所有 GET 请求的路径。
 *
 * @param file 文件绝对路径
 * @returns 路径数组（已拼上该文件的 BASE 常量）
 */
function extractGetPaths(file) {
  const source = readFileSync(file, 'utf8')
  const baseMatch = source.match(/const BASE = '([^']*)'/)
  const base = baseMatch ? baseMatch[1] : ''
  const result = []
  // http.get<...>(`${BASE}/xxx`  /  http.get(`/xxx`
  const pattern = /http\.get(?:<[^>]*>)?\(\s*`([^`]*)`/g
  let match
  while ((match = pattern.exec(source)) !== null) {
    let raw = match[1]
    if (!raw.includes('${BASE}') && !raw.startsWith('/')) {
      continue
    }
    let url = raw.replace('${BASE}', base)
    // 路径参数统一替换成 1：只关心"路由能不能到处理器"，不关心具体数据
    url = url.replace(/\$\{[^}]+\}/g, '1')
    if (!url.startsWith('/')) {
      continue
    }
    result.push(url)
  }
  return result
}

const allPaths = new Set()
for (const file of listTsFiles(API_DIR)) {
  for (const p of extractGetPaths(file)) {
    allPaths.add(p)
  }
}
const paths = [...allPaths].sort()

/* ==================== 2) 逐条探测 ==================== */

const login = await (await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
})).json()
if (login.code !== 0) {
  console.error(`登录失败（${USER}）：code=${login.code} ${login.message ?? ''}`)
  process.exit(2)
}
const AUTH = { Authorization: `Bearer ${login.data.accessToken}` }

const rows = []
for (const p of paths) {
  const url = `${BASE_URL}/api/v1/production${p}`
  let status = 0
  let servedBy = null
  let code = null
  try {
    const res = await fetch(url, { headers: AUTH })
    status = res.status
    servedBy = res.headers.get('x-served-by')
    try {
      const body = await res.json()
      code = body?.code ?? null
    } catch {
      code = null
    }
  } catch (error) {
    status = -1
    code = String(error?.message ?? error)
  }

  let verdict
  if (status === 404 || status === -1) {
    verdict = 'MISSING'
  } else if (String(servedBy ?? '').includes('core-platform')) {
    verdict = code === 0 ? 'PLATFORM_OK' : 'GAP'
  } else if (servedBy === 'agri-production') {
    verdict = code === 0 ? 'OK' : code === 403 ? 'AUTH' : 'BIZ'
  } else {
    verdict = 'UNKNOWN'
  }
  rows.push({ path: p, status, servedBy: servedBy ?? '-', code, verdict })
}

/* ==================== 3) 输出 ==================== */

const LABEL = {
  OK: '✅ 正常',
  AUTH: '✅ 无权限(路由正常)',
  BIZ: '⚠️ 业务/参数',
  PLATFORM_OK: '⚠️ 平台侧服务(未切流)',
  GAP: '❌ 路由缺口',
  MISSING: '❌ 处理器缺失',
  UNKNOWN: '❓ 未知',
}

const ORDER = ['GAP', 'MISSING', 'UNKNOWN', 'BIZ', 'PLATFORM_OK', 'AUTH', 'OK']
rows.sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict) || a.path.localeCompare(b.path))

console.log(`共 ${rows.length} 条 GET 请求（来源：agri-production/frontend/src/api）\n`)
for (const row of rows) {
  console.log(
    `${LABEL[row.verdict].padEnd(22)} http=${String(row.status).padEnd(4)} ` +
      `served=${row.servedBy.padEnd(24)} code=${String(row.code).padEnd(5)} ${row.path}`,
  )
}

const counts = rows.reduce((acc, row) => {
  acc[row.verdict] = (acc[row.verdict] ?? 0) + 1
  return acc
}, {})
console.log('\n汇总：')
for (const key of ORDER) {
  if (counts[key]) {
    console.log(`  ${LABEL[key]}：${counts[key]}`)
  }
}

const gaps = rows.filter((row) => row.verdict === 'GAP' || row.verdict === 'MISSING')
console.log('')
if (gaps.length === 0) {
  console.log('没有路由缺口 ✅')
  process.exit(0)
}
console.log(`发现 ${gaps.length} 条缺口（页面会表现为"加载失败"，实际是路由没切或后端无处理器）：`)
for (const gap of gaps) {
  console.log(`  - ${gap.path}　served=${gap.servedBy} code=${gap.code}`)
}
process.exit(1)
