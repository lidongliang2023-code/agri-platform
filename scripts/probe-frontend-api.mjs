#!/usr/bin/env node
/**
 * 扫雷之三：**前端真的会发出的请求** vs 目标后端有没有处理器。
 *
 * 为什么需要它：前两把扫雷脚本盯的是"表列 vs 实体"（check-entity-columns /
 * check-notnull-columns），那是**后端自己内部**的一致性。但切流（把某个域从
 * core-platform 换到独立服务）碎掉页面的方式完全是另一类：路径根本没有处理器。
 * 这一类靠点页面很难发现全 —— 一次只看得见当前这一页，而"哪些页会碎"是全域问题。
 *
 * 做法：把前端 api 层里的每条 `http.get/post/...('<path>')` 抓出来（`${BASE}` 之类的
 * 常量就近解析，其余占位符替换成可解析的值），逐条打到目标后端，然后**按提示语区分**
 * 两种 404：
 *   · `接口不存在` —— Spring 的 NoResourceFoundException 兜底，意思是"后端没有这个处理器"；
 *   · 业务里的"不存在"（如"种养计划不存在"）—— 处理器在，只是这条数据没有。
 * 只认前者为"缺口"，否则任何一条查不到的演示数据都会被误报成缺接口。
 *
 * 用法：
 *   node scripts/probe-frontend-api.mjs <api 目录> <目标 baseURL> <访问令牌> [占位符]
 * 例：
 *   TOKEN=$(curl -s -X POST http://localhost/api/v1/auth/login \
 *     -H 'Content-Type: application/json' \
 *     -d '{"username":"admin","password":"Admin@123","marketId":1}' | ... )
 *   node scripts/probe-frontend-api.mjs agri-production/frontend/src/api \
 *     http://localhost:8092/api/v1/production "$TOKEN"
 *
 * 退出码：0 = 没有缺口；1 = 有缺口（切流前应当归零）。
 */
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const [apiDir, baseUrl, token, placeholder = '1'] = args
/**
 * 默认**不发 DELETE**。
 *
 * 为什么单独给它一个开关：GET/POST/PUT/PATCH 都可以靠"故意空的请求体"让处理器在写库前失败
 * （既证明了处理器存在，又不动数据），而 DELETE 没有请求体可用来"让它失败" —— 一发就是真删。
 * 实测代价：探针打到 agri-production 时把既有的演示投入品 M001 逻辑删掉了，
 * 后续所有 /inputs/1/** 调用都变成"投入品不存在"，看起来像后端坏了。
 * 需要 DELETE 覆盖时显式加 --include-deletes，并确认目标库是可丢弃的。
 *
 * 还有一类**不需要请求体就能跑完整个动作**的端点（"空体也会真执行"）：
 *   · POST /trace/batches/{id}/generate —— 给批次生成溯源码。路径参数就有全部所需信息，
 *     空体照样生成，实测连跑几次就在演示库里留下 4 条 generated 码（AG0120261015xxxx），
 *     看起来像"演示数据变多了"，实际是探针留下的垃圾。
 * 这类按前缀列在 SIDE_EFFECT_PATHS 里，同样默认跳过，需要时加 --include-side-effects。
 * 新增发现就往这个清单里加一条，而不是每次跑完手动去库里删。
 */
const includeDeletes = process.argv.slice(2).includes('--include-deletes')
const includeSideEffects = process.argv.slice(2).includes('--include-side-effects')
if (!apiDir || !baseUrl || !token) {
  console.error('用法：node scripts/probe-frontend-api.mjs <api 目录> <目标 baseURL> <访问令牌> [占位符] [--include-deletes] [--include-side-effects]')
  process.exit(2)
}

/**
 * "不带请求体也会真的改库"的动作端点前缀。
 *
 * 判据：路径里已经把动作所需的标识给全了，空体只是走个过场 —— 探针一发就生效。
 * 与 DELETE 同样处理：默认跳过，避免"只是扫个雷"却留下演示数据。
 */
const SIDE_EFFECT_PATHS = ['/trace/batches/']
/** 同类的后缀匹配（如 /harvests/1/generate：给批次生成溯源码 + 落 prod.batch.harvested 事件） */
const SIDE_EFFECT_SUFFIXES = ['/generate']

/**
 * **按口径不由本服务实现**的路径（前缀匹配）——不计入"缺口"。
 *
 * 为什么需要这份清单：判据是"切某段前该段缺口必须归零"，但有些路径**永远不该切给这个服务**，
 * 它们留在平台侧才是对的。若不排除，脚本会把"平台域路径没在卫星服务里实现"一直算成缺口，
 * 于是这条判据永远达不到 0，等于判据失效。
 *
 * 当前唯一一条：`/admin/tenants/**` —— 租户/市场主体是**平台域**数据（库在 agri_core），
 * 而本服务的口径是"一主体一租户"：租户由平台下发（见 TenantContextService 解析逻辑），
 * 本服务**不拥有**租户主数据。所以这里既不该建 agri_prod_tenant_info 表、也不该接这几个接口
 * （2026-10-15 已把早先那套 Tenant 脚手架删掉：它对应的表根本不存在，当时 5 个接口一调就是 500）。
 * 对应地，将来切 /admin/ 那一段时**必须把 /admin/tenants 排除在外**（见网关 20-prod.conf 的说明）。
 */
const PLATFORM_OWNED_PATHS = ['/admin/tenants/']

const CALL = /http(?:Platform)?\.(get|post|put|patch|delete)(?:<[^>]*>)?\(\s*(`[^`]*`|'[^']*')/g
const CONST = /const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([^']*)'/g

/** 递归收集 .ts */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else if (entry.name.endsWith('.ts')) out.push(full)
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
    const template = m[2].slice(1, -1)
    const resolved = template.replace(/\$\{([^}]+)\}/g, (_all, expr) => {
      const name = expr.trim()
      if (Object.prototype.hasOwnProperty.call(consts, name)) return consts[name]
      return name.startsWith('BASE') ? (consts.BASE ?? '') : placeholder
    })
    if (!resolved.startsWith('/')) continue
    const key = `${method} ${resolved}`
    if (!seen.has(key)) seen.set(key, { file: path.relative(apiDir, file), method, path: resolved })
  }
}

const list = [...seen.values()].sort((a, b) => a.path.localeCompare(b.path))
const isDelete = (c) => c.method === 'DELETE' && !includeDeletes
/**
 * 只对**写方法**判副作用：`GET /trace/batches/1` 什么都不改，
 * 按前缀一起跳过会把一个本来能验的读端点也放过（少验一条，却没换来任何安全）。
 */
const isSideEffect = (c) =>
  !includeSideEffects &&
  ['POST', 'PUT', 'PATCH'].includes(c.method) &&
  (SIDE_EFFECT_PATHS.some((prefix) => c.path.startsWith(prefix)) ||
    SIDE_EFFECT_SUFFIXES.some((suffix) => c.path.endsWith(suffix)))
const skipped = list.filter((c) => isDelete(c) || isSideEffect(c))
const probing = list.filter((c) => !isDelete(c) && !isSideEffect(c))
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
const missing = []
const handledButFailed = []
const ok = []

for (const c of probing) {
  let status = 0
  let body = ''
  try {
    const res = await fetch(`${baseUrl}${c.path}`, {
      method: c.method,
      headers,
      body: ['POST', 'PUT', 'PATCH'].includes(c.method) ? '{}' : undefined,
    })
    status = res.status
    body = await res.text()
  } catch (error) {
    status = -1
    body = String(error)
  }
  if (/接口不存在/.test(body) || status === 404) {
    missing.push({ ...c, status })
    continue
  }
  if (status >= 400 || status === -1) {
    handledButFailed.push({ ...c, status, note: body.slice(0, 130) })
    continue
  }
  let code = null
  let message = ''
  try {
    const parsed = JSON.parse(body)
    code = parsed.code
    message = parsed.message ?? ''
  } catch {
    message = '（响应不是 JSON）'
  }
  if (code === 0) ok.push({ ...c, status })
  else handledButFailed.push({ ...c, status, note: `code=${code} ${message}`.slice(0, 150) })
}

const segmentOf = (p) => {
  const parts = p.split('/').filter(Boolean)
  return p.startsWith('/admin/') ? `admin/${parts[1] ?? ''}` : (parts[0] ?? '')
}

/** 平台域路径从"缺口"里摘出来单列：它们本该留在平台侧，不计入本服务的切流判据。 */
const isPlatformOwned = (p) => PLATFORM_OWNED_PATHS.some((prefix) => p.startsWith(prefix))
const platformOwned = missing.filter((m) => isPlatformOwned(m.path))
const realMissing = missing.filter((m) => !isPlatformOwned(m.path))

console.log(`== 前端会发出的请求：${list.length} 条（去重后） ==`)
console.log(`== 缺口 ${realMissing.length} | 有处理器但本次调用未成功 ${handledButFailed.length} | 成功 ${ok.length} ==`)
if (platformOwned.length > 0) {
  console.log(
    `== 另 ${platformOwned.length} 条按口径不由本服务实现（平台域，应留在平台侧；不计入缺口）` +
      `：${PLATFORM_OWNED_PATHS.join('、')} ==`,
  )
}
if (skipped.length > 0) {
  const deletes = skipped.filter((c) => c.method === 'DELETE').length
  const effects = skipped.length - deletes
  console.log(
    `== 跳过 ${skipped.length} 条会真改库的请求（DELETE ${deletes} 条 / 空体也执行的动作 ${effects} 条）` +
      `—— 需要覆盖时加 --include-deletes / --include-side-effects，并确认目标库可丢 ==`,
  )
  for (const c of skipped.filter((x) => x.method !== 'DELETE')) {
    console.log(`   · ${c.method} ${c.path}（空体也执行，会留下数据）`)
  }
}

const stats = new Map()
for (const [kind, item] of [
  ...missing.map((x) => ['missing', x]),
  ...handledButFailed.map((x) => ['failed', x]),
  ...ok.map((x) => ['ok', x]),
]) {
  const seg = segmentOf(item.path)
  const row = stats.get(seg) ?? { missing: 0, failed: 0, ok: 0 }
  row[kind] += 1
  stats.set(seg, row)
}
console.log('\n== 按路径段统计 ==')
console.log('  ' + '段'.padEnd(20) + '缺处理器'.padStart(10) + '有处理器未成功'.padStart(16) + '成功'.padStart(8))
for (const [seg, row] of [...stats.entries()].sort((a, b) => b[1].missing - a[1].missing)) {
  console.log(
    `  ${seg.padEnd(18)} ${String(row.missing).padStart(10)} ${String(row.failed).padStart(16)} ${String(row.ok).padStart(8)}`,
  )
}

console.log(`\n-- 缺处理器的路径（${realMissing.length} 条） --`)
for (const m of realMissing) console.log(`  ${m.method.padEnd(6)} ${m.path.padEnd(56)} [${m.file}]`)

if (platformOwned.length > 0) {
  console.log(`\n-- 不计入缺口的平台域路径（${platformOwned.length} 条；切 /admin/ 段时必须排除） --`)
  for (const m of platformOwned) console.log(`  ${m.method.padEnd(6)} ${m.path.padEnd(56)} [${m.file}]`)
}

console.log(`\n-- 有处理器但本次调用未成功（${handledButFailed.length} 条，探测用的占位参数所致者属正常） --`)
for (const m of handledButFailed) console.log(`  ${m.method.padEnd(6)} ${m.path.padEnd(56)} ${m.note}`)

// 退出码只看**计入缺口**的那些：平台域路径不参与判据（见 PLATFORM_OWNED_PATHS 说明）
process.exit(realMissing.length > 0 ? 1 : 0)
