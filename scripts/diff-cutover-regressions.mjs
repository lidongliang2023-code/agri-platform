#!/usr/bin/env node
/**
 * 扫雷之四：**切流回归对照** —— 把前端会发出的每条请求，同时打到"经网关"与"直连平台侧"，
 * 找出"以前好、现在坏"的路径。
 *
 * 为什么需要它：probe-frontend-api.mjs 只回答"有没有处理器"，回答不了"切过去之后行为变没变"。
 * 而切流真正会踩的坑就长在后者上 —— 实测（整段切那一版）：
 *   agri-production 里 /plots/{id}、/farms/{id}、/iot/devices/{id}、/admin/farms/{id} 这些
 *   {id} 处理器会把 /plots/stats、/farms/all、/admin/farms/map 这类**字面量路径**接走，
 *   Long 转换失败 → HTTP 400"参数类型不匹配: id"。网关的回退只认 404，接不住 400，
 *   于是这些路径从"平台侧正常"变成"报错"，而 probe 脚本一条都看不出来（处理器都在）。
 *
 * 判据：只挑 **经网关时由新服务服务、业务码非 0，而直连平台侧是 0** 的那些。
 * 两边都非 0 的多半是探测参数问题（空请求体、占位 id），不算回归。
 *
 * ⚠️ 已知噪声（看结果时先排除）：
 *   · 跨库 id 不同 —— 脚本用占位 id（默认 1），新服务的演示数据 id 可能不是 1，
 *     于是业务码 404"xx 不存在"，而平台侧恰好有一条 id=1 的记录。换真实 id 复核即可。
 *   · 空请求体 —— 新服务有必填校验会返 400，平台侧反而可能返回 0（照插一条空记录）。
 *     这种是"新服务更严"，不是回归。
 *   · 新服务对空体抛 500 的（应当 400）—— 那是校验缺口，属真问题，但**不是切流引起的**：
 *     把脚本指向新服务直连地址（跳过网关）同样 500 即可确认。
 *
 * 用法：
 *   node scripts/diff-cutover-regressions.mjs <api 目录> <经网关 baseURL> <直连平台 baseURL> <访问令牌> [占位符]
 * 例：
 *   node scripts/diff-cutover-regressions.mjs agri-production/frontend/src/api \
 *     http://localhost/api/v1/production http://localhost:8093/api/v1/production "$TOKEN"
 *
 * ⚠️ 会真的改库的端点一律跳过（与 probe-frontend-api.mjs 同一份口径）：
 *   · DELETE —— 一发就是真删；
 *   · 路径里已经带全动作标识、空体也照样执行的 `/generate` 类端点 ——
 *     实测代价：POST /harvests/1/generate 会**真的**给批次生成溯源码并落一条
 *     prod.batch.harvested 事件，POST /trace/batches/1/generate 会真的生成溯源码。
 *     只是跑个对照，演示库里就多出一条码 + 一条事件，看起来像"数据自己长出来的"。
 *
 * 退出码：0 = 没有"新服务非 0 而平台侧 0"的路径；1 = 有（逐条分诊，别直接当回归）。
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const includeSideEffects = process.argv.slice(2).includes('--include-side-effects')
const [apiDir, gatewayBase, coreBase, token, placeholder = '1'] = args
if (!apiDir || !gatewayBase || !coreBase || !token) {
  console.error('用法：node scripts/diff-cutover-regressions.mjs <api 目录> <经网关 baseURL> <直连平台 baseURL> <访问令牌> [占位符] [--include-side-effects]')
  process.exit(2)
}

// 泛型截取用 [^(]*（贪婪到 `(` 前的最后一个 `>`）：像 http.get<PageResult<X>>(...) 这种
// 嵌套泛型，用 [^>]* 会在第一个 `>` 停下、整条调用抓不到 —— 对照脚本会因此漏掉最典型的分页接口。
// 与 probe-frontend-api.mjs 保持同一份正则，两个脚本的口径必须一致。
const CALL = /http(?:Platform)?\.(get|post|put|patch|delete)\s*(?:<[^(]*>)?\s*\(\s*(`[^`]*`|'[^']*')/g
const CONST = /const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([^']*)'/g

/** 空体也会真改库的动作端点（后缀匹配）。新增发现往这里加，别每次手动去库里删。 */
const SIDE_EFFECT_SUFFIXES = ['/generate']

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name)
    if (e.isDirectory()) walk(full, out)
    else if (e.name.endsWith('.ts')) out.push(full)
  }
  return out
}

const seen = new Map()
for (const file of walk(apiDir)) {
  const text = readFileSync(file, 'utf8')
  const consts = {}
  for (const m of text.matchAll(CONST)) consts[m[1]] = m[2]
  for (const m of text.matchAll(CALL)) {
    const method = m[1].toUpperCase()
    // DELETE 一律跳过：对照脚本会对"经网关"这一侧真的发请求，DELETE 一发就是真删
    if (method === 'DELETE') continue
    const resolved = m[2].slice(1, -1).replace(/\$\{([^}]+)\}/g, (_all, expr) => {
      const name = expr.trim()
      if (Object.prototype.hasOwnProperty.call(consts, name)) return consts[name]
      return name.startsWith('BASE') ? (consts.BASE ?? '') : placeholder
    })
    if (!resolved.startsWith('/')) continue
    // 空体也执行的动作端点（如 /**/generate）同样跳过：跑一次就多一条演示数据
    if (!includeSideEffects && SIDE_EFFECT_SUFFIXES.some((suffix) => resolved.endsWith(suffix))) continue
    const key = `${method} ${resolved}`
    if (!seen.has(key)) seen.set(key, { file: path.relative(apiDir, file), method, path: resolved })
  }
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
async function call(base, c) {
  const res = await fetch(`${base}${c.path}`, {
    method: c.method,
    headers,
    // 写操作发空体：既证明处理器存在，又尽量不动数据
    body: ['POST', 'PUT', 'PATCH'].includes(c.method) ? '{}' : undefined,
  })
  const text = await res.text()
  let code = null
  try {
    code = JSON.parse(text).code
  } catch {
    code = null
  }
  return { http: res.status, code, servedBy: res.headers.get('x-served-by') ?? '' }
}

const regressions = []
const improved = []
let servedByGateway = 0
for (const c of seen.values()) {
  const [gw, core] = await Promise.all([call(gatewayBase, c), call(coreBase, c)])
  if (gw.servedBy !== 'agri-production') continue
  servedByGateway += 1
  if (gw.code !== 0 && core.code === 0) regressions.push({ ...c, gw, core })
  else if (gw.code === 0 && core.code !== 0) improved.push({ ...c, gw, core })
}

console.log(`对照请求：${seen.size} 条（跳过 DELETE）`)
console.log(`其中由 agri-production 服务的：${servedByGateway} 条，仍走平台侧的：${seen.size - servedByGateway} 条`)
console.log(`\n== A. 待分诊（新服务非 0 而平台侧 0）：${regressions.length} 条 ==`)
console.log('   （先排除三类噪声：跨库 id 不同、空请求体被新服务校验拦下、新服务对空体抛 500）')
for (const r of regressions) {
  console.log(`  ${r.method.padEnd(5)} ${r.path.padEnd(50)} gw=${r.gw.code} core=${r.core.code}  [${r.file}]`)
}
console.log(`\n== B. 反向（新服务 0 而平台侧非 0，通常是好事）：${improved.length} 条 ==`)
for (const r of improved) {
  console.log(`  ${r.method.padEnd(5)} ${r.path.padEnd(50)} gw=${r.gw.code} core=${r.core.code}`)
}

process.exit(regressions.length > 0 ? 1 : 0)
