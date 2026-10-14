/**
 * 写接口的"空体体检"：对每个 POST/PUT/PATCH 发一个 `{}`，要求后端给出**可读的 4xx**，
 * 而不是 500。
 *
 * 为什么单列这一类：`{}` 是客户端能发出的最恶劣输入（字段全缺），
 * 它返 500 说明这条写路径**根本没有校验** —— 用户在页面上少填一个字段、
 * 或者别处调错一次，看到的就是"系统异常，请稍后再试"，既不知道错在哪、也没法自查。
 * 而 500 还会进 ERROR 日志，把真实故障淹掉。
 *
 * 判据（两类，分开看）：
 *   · **5xx**（HTTP 5xx 或 body.code ≥ 500）→ 缺校验/异常兜底，必须修；
 *   · **空体被接受**（200 且 code == 0）→ 需要人看一眼：动作类接口（start/submit/…）
 *     不带体是正常的；但**创建类接口**接受空体往往意味着没有校验，会往库里写空壳行。
 *     这条是我自己踩出来的：`POST /quality/inspections` 一开始就属于这一类，
 *     空体体检连打十几次，演示库里留下了十几行"检测类型为空"的检测单。
 *   · 4xx（400/404/405/409…）→ 合格。
 *
 * ⚠️ 它会对目标后端**真的发写请求**：动作类接口会被真的执行（例如 start/submit 会改状态），
 *    没校验的创建类接口会真的建行。请在可丢弃的库上跑；对演示库跑完记得核对。
 *
 * 用法：node scripts/check-write-validation.mjs <api 目录> <baseURL> <令牌> [路径段前缀正则]
 * 例：
 *   node scripts/check-write-validation.mjs agri-production/frontend/src/api \
 *     http://localhost:8092/api/v1/production "" '^(/plans|/tasks|/inputs|/quality)'
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const [apiDir, baseUrl, token, prefix = ''] = process.argv.slice(2)
const CALL = /http(?:Platform)?\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*(`[^`]*`|'[^']*')/g
const CONST = /const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([^']*)'/g

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
    if (!['POST', 'PUT', 'PATCH'].includes(method)) continue
    const resolved = m[2].slice(1, -1).replace(/\$\{([^}]+)\}/g, (_all, expr) => {
      const name = expr.trim()
      if (Object.prototype.hasOwnProperty.call(consts, name)) return consts[name]
      return name.startsWith('BASE') ? (consts.BASE ?? '') : '1'
    })
    if (!resolved.startsWith('/')) continue
    if (/^\/admin\//.test(resolved)) continue
    if (prefix && !new RegExp(prefix).test(resolved)) continue
    const key = `${method} ${resolved}`
    if (!seen.has(key)) seen.set(key, { file: path.relative(apiDir, file), method, path: resolved })
  }
}

const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const bad = []
const accepted = []
const fine = []
for (const c of seen.values()) {
  let http = 0
  let body = ''
  try {
    const res = await fetch(`${baseUrl}${c.path}`, { method: c.method, headers, body: '{}' })
    http = res.status
    body = await res.text()
  } catch (error) {
    http = -1
    body = String(error)
  }
  let code = null
  try {
    code = JSON.parse(body).code
  } catch {
    code = null
  }
  // 业务码 >=500 也算"缺校验"：平台把未处理异常统一包成 code=500
  const isFive = http >= 500 || (typeof code === 'number' && code >= 500)
  const note = `HTTP ${http} code ${code} ${(JSON.parse(body || '{}').message ?? '').toString().slice(0, 60)}`
  if (isFive) bad.push({ ...c, note })
  else if (code === 0) accepted.push({ ...c, note })
  else fine.push({ ...c, note })
}

console.log(`写接口空体体检：共 ${seen.size} 条（跳过 /admin/**）`)
console.log(`\n== ✗ 空体返 5xx（缺校验，应当是可读的 4xx）：${bad.length} 条 ==`)
for (const b of bad) console.log(`  ${b.method.padEnd(5)} ${b.path.padEnd(48)} ${b.note}   [${b.file}]`)
console.log(`\n== ? 空体被接受（动作类属正常；创建类要人看一眼）：${accepted.length} 条 ==`)
for (const a of accepted) console.log(`  ${a.method.padEnd(5)} ${a.path.padEnd(48)} ${a.note}   [${a.file}]`)
console.log(`\n== ✓ 合格（返 4xx）：${fine.length} 条 ==`)
process.exit(bad.length > 0 ? 1 : 0)
