/**
 * API 契约一致性校验（只读，不修改任何文件）
 *
 * 目的：把「后端 Controller 方法签名」与「前端 src/api 声明」逐条比对，
 * 找出「返回类型声明与后端实际返回不符」的接口，避免类型骗人。
 *
 * 匹配方式：HTTP 方法 + 归一化后的路径（`${BASE}/${id}/x` 与 `/{id}/x` 归一成同一形态）。
 *
 * 用法：node scripts/check-api-contract.mjs [后端源码根目录 ...]
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const FRONTEND_API_DIR = 'src/api'
const DEFAULT_BACKEND_ROOTS = [
  // 新版生产模块后端（core-platform/mod-produce）
  '../../core-platform/mod-produce/src/main/java',
  // V1 存量后端（agri-production/backend）
  '../backend/src/main/java',
]

/* ====================== 后端：解析 Controller ====================== */

/**
 * 解析单个 Java Controller 文件，抽取方法签名。
 *
 * @param {string} file 文件路径
 * @returns {Array<{file: string, method: string, path: string, ret: string, fn: string}>} 方法列表
 */
function parseController(file) {
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split(/\r?\n/)
  const classBase = (src.match(/@RequestMapping\(\s*"([^"]*)"\s*\)/)?.[1] ?? '').replace(/\/$/, '')
  const result = []
  let pending = null

  for (const raw of lines) {
    const line = raw.trim()
    const map = line.match(/@(Get|Post|Put|Delete|Patch)Mapping(?:\(\s*(?:"([^"]*)")?\s*)?\)?/)
    if (map) {
      pending = { method: map[1].toUpperCase(), sub: map[2] ?? '' }
      continue
    }
    const sig = line.match(/^public\s+(?:ApiResponse<([^>]*)>|ApiResponse)\s+(\w+)\s*\(/)
    if (sig && pending) {
      result.push({
        file: path.basename(file),
        method: pending.method,
        path: normalizeJavaPath(`${classBase}${pending.sub}`),
        ret: sig[1] ?? 'void',
        fn: sig[2],
      })
      pending = null
    }
    if (line.startsWith('@')) pending = pending
  }
  return result
}

/**
 * 把 Java 路径的 `{xxx}` 占位符归一成 `{p}`。
 *
 * @param {string} p 原始路径
 * @returns {string} 归一化路径
 */
function normalizeJavaPath(p) {
  let out = p.replace(/\/{[^}/]+}/g, '/{p}')
  if (out === '') out = '/'
  return out
}

/* ====================== 前端：解析 api 模块 ====================== */

/**
 * 解析单个前端 api 文件，抽取导出函数的 HTTP 调用与声明返回类型。
 *
 * @param {string} file 文件路径
 * @returns {Array<{file: string, fn: string, method: string, path: string, ret: string}>} 函数列表
 */
function parseApiFile(file) {
  const src = fs.readFileSync(file, 'utf8')
  const lines = src.split(/\r?\n/)
  const base = src.match(/const\s+BASE\s*=\s*'([^']+)'/)?.[1] ?? ''
  const result = []

  for (let i = 0; i < lines.length; i += 1) {
    const head = lines[i].match(/^export\s+(?:async\s+)?function\s+(\w+)\s*\(/)
    if (!head) continue

    // 累积签名行直到出现 Promise<
    // 上限取 30 行：带内联 payload 类型的函数（如 inviteMember / createPlanInfo）
    // 参数字段可达十余行，窗口太小会把返回类型判成「未知」，造成误报
    let sig = lines[i]
    let j = i
    while (!/Promise</.test(sig) && j + 1 < lines.length && j - i < 30) {
      j += 1
      sig += `\n${lines[j]}`
    }
    const ret = sig.match(/Promise<(.+)>\s*\{?\s*$/)?.[1] ?? '(未知)'

    // 在函数体前若干行找 http.xxx 调用
    let call = null
    for (let k = i; k < Math.min(lines.length, j + 14); k += 1) {
      const c = lines[k].match(/http\.(get|post|put|delete|patch)\s*</)
      if (c) {
        call = { line: k, method: c[1].toUpperCase() === 'PATCH' ? 'PATCH' : c[1].toUpperCase() }
        break
      }
    }
    if (!call) continue

    // 抽取 URL：取 http.xxx<T>( 后的第一个字符串（可能是模板字符串）
    const area = lines.slice(call.line, call.line + 6).join('\n')
    const url = extractUrl(area, base)
    if (!url) continue

    result.push({
      file: path.relative(FRONTEND_API_DIR, file).replace(/\\/g, '/'),
      fn: head[1],
      method: call.method === 'PATCH' ? 'PATCH' : call.method,
      path: normalizeTsUrl(url, base),
      ret,
    })
    i = j
  }
  return result
}

/**
 * 从代码片段中抽取 http 调用的第一个 URL 字符串（支持模板字符串与拼接）。
 *
 * @param {string} area 代码片段
 * @param {string} base BASE 常量值
 * @returns {string} 原始 URL 模板
 */
function extractUrl(area, base) {
  const m = area.match(/http\.(?:get|post|put|delete|patch)<[^>]*>\s*\(\s*([^\n,]+)/)
  if (!m) return ''
  let expr = m[1].trim()
  expr = expr.replace(/`\s*$/, '').replace(/`.*$/, (s) => s)
  // 只保留反引号模板或字符串常量部分
  const tmpl = area.match(/http\.(?:get|post|put|delete|patch)<[^>]*>\s*\(\s*(`[^`]*`|'[^']*')/)
  if (tmpl) expr = tmpl[1]
  return expr.replace(/^`|`$/g, '').replace(/^'|'$/g, '')
}

/**
 * 把前端 URL 模板归一成与后端可比的路径。
 *
 * @param {string} url URL 模板，如 `${BASE}/${plotId}/soil`
 * @param {string} base BASE 常量值
 * @returns {string} 归一化路径
 */
function normalizeTsUrl(url, base) {
  let out = url.split('?')[0]
  out = out.replace(/\$\{BASE\}/g, base)
  out = out.replace(/\$\{[^}]+\}/g, '{p}')
  out = out.replace(/\/\/+/g, '/')
  if (!out.startsWith('/')) out = `/${out}`
  return out.replace(/\/$/, '') || '/'
}

/* ====================== 比对 ====================== */

/**
 * 判断后端返回泛型与前端声明是否语义一致。
 *
 * @param {string} backend 后端返回泛型，如 String / Void / PageResult<X> / XxxVO
 * @param {string} frontend 前端声明的 Promise 泛型
 * @returns {{ ok: boolean, expect: string }} 比对结果与建议声明
 */
function compare(backend, frontend) {
  const be = backend.trim()
  const fe = frontend.trim()
  if (be === 'Void' || be === 'void') {
    return { ok: fe === 'void', expect: 'void' }
  }
  if (be === 'String') {
    return { ok: fe === 'string', expect: 'string' }
  }
  if (be === 'Boolean') {
    return { ok: fe === 'boolean', expect: 'boolean' }
  }
  if (be.startsWith('PageResult') || be.startsWith('Page<')) {
    return { ok: fe.startsWith('PageResult'), expect: `PageResult<...>` }
  }
  if (be.startsWith('List<')) {
    return { ok: fe.endsWith('[]'), expect: 'Entity[]' }
  }
  return { ok: true, expect: 'Entity' }
}

/* ====================== 主流程 ====================== */

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const backendRoots = (args.length ? args : DEFAULT_BACKEND_ROOTS).filter((p) => fs.existsSync(p))
if (backendRoots.length === 0) {
  console.error(`找不到后端源码目录：${DEFAULT_BACKEND_ROOTS.join(' / ')}`)
  process.exit(1)
}

const backendRows = []
for (const root of backendRoots) {
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (e.name.endsWith('Controller.java')) backendRows.push(...parseController(p))
    }
  }
  walk(root)
}

const frontendRows = []
const walkApi = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walkApi(p)
    else if (e.name.endsWith('.ts')) frontendRows.push(...parseApiFile(p))
  }
}
walkApi(FRONTEND_API_DIR)

/** 生成可比对的候选 key：剥离 context-path 前缀后的多种形态 */
const key = (method, p) => {
  const stripped = p.replace(/^\/api\/v1\/production/, '').replace(/^\/production/, '') || '/'
  return [`${method} ${p}`, `${method} ${stripped}`]
}

const backendMap = new Map()
for (const r of backendRows) {
  for (const k of key(r.method, r.path)) {
    if (!backendMap.has(k)) backendMap.set(k, r)
  }
}

const matched = []
const unmatched = []
for (const r of frontendRows) {
  let hit = null
  for (const k of key(r.method, r.path)) {
    if (backendMap.has(k)) {
      hit = backendMap.get(k)
      break
    }
  }
  if (hit) matched.push({ fe: r, be: hit })
  else unmatched.push(r)
}

if (process.argv.includes('--debug')) {
  const pad = (s, n) => String(s).padEnd(n)
  console.log('后端示例：')
  for (const r of backendRows.slice(0, 25)) {
    console.log(`  ${pad(r.method, 7)}${pad(r.path, 44)}${pad(r.ret, 22)}${r.file}#${r.fn}`)
  }
  console.log('前端示例：')
  for (const r of frontendRows.slice(0, 10)) {
    console.log(`  ${pad(r.method, 7)}${pad(r.path, 44)}${pad(r.ret, 22)}${r.file}#${r.fn}`)
  }
  console.log('-'.repeat(110))
}

const pad = (s, n) => String(s).padEnd(n)
const problems = []
for (const m of matched) {
  const c = compare(m.be.ret, m.fe.ret)
  if (!c.ok) problems.push({ m, expect: c.expect })
}

console.log('='.repeat(110))
console.log('前端 api 声明 × 后端 Controller 签名 比对结果')
console.log('='.repeat(110))
console.log(`后端 Controller 方法：${backendRows.length} 条（来源：${backendRoots.join(', ')}）`)
console.log(`前端 api 函数：${frontendRows.length} 条`)
console.log(`成功匹配：${matched.length} 条 ｜ 未匹配：${unmatched.length} 条 ｜ 疑似不一致：${problems.length} 条`)
console.log('-'.repeat(110))
console.log(
  `${pad('方法', 7)}${pad('路径', 40)}${pad('后端返回', 26)}${pad('前端声明', 34)}建议`,
)
console.log('-'.repeat(110))
for (const p of problems) {
  console.log(
    `${pad(p.m.fe.method, 7)}${pad(p.m.fe.path, 40)}${pad(p.m.be.ret, 26)}${pad(`Promise<${p.m.fe.ret}>`, 34)}Promise<${p.expect}>  ${p.m.fe.file}#${p.m.fe.fn}`,
  )
}
if (unmatched.length > 0) {
  console.log('-'.repeat(110))
  console.log('[未匹配] 前端有声明但后端 Controller 中未找到对应端点（可能是路径不同或未实现）：')
  for (const r of unmatched) {
    console.log(`  ${pad(r.method, 7)}${pad(r.path, 40)}${pad(`Promise<${r.ret}>`, 34)}${r.file}#${r.fn}`)
  }
}
console.log('='.repeat(110))
