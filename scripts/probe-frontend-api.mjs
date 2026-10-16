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
 *
 * ⚠️ **跑完要还原演示数据**。已知的两类残留副作用：
 *   ① 空体 PUT 会刷新 audit 时间戳 —— 增量更新类的 PUT/POST 收到 `{}` 不报错，
 *      字段全为 null 被忽略，只剩 MyBatis-Plus 的 update_time 填充落库。
 *      实测一轮下来 7 张演示表的 id=1 行 update_time 变了（业务值没变），界面看不出来，但那仍是数据。
 *      还原：`UPDATE <表> SET update_time = create_time WHERE update_time <> create_time;`
 *      （这些演示行的 update_time 初始就等于 create_time。）
 *   ② 个别创建类接口在目标服务上也可能落行 —— 跑完请对演示库做一次行级快照对比确认。
 *      快照做法（整库行级、前后对比）：
 *        mysql -uroot --batch agri_production -e "source <(show tables 生成的 SELECT '·', t.* FROM t 列表)"
 *
 *    ⚠️ 为什么"空体动作端点"不是一律跳过：那会让**缺处理器**这一列失真 ——
 *    探针的价值就是"这条路径在新服务有没有处理器"，跳过的路径既不算活也不算缺。
 *    所以只有"空体会造成不可逆后果"的（/generate 建数据、/accredit /reject 改机构状态）才跳过，
 *    其余（如 /urge 催办、/reboot 记指令）照打，由**下面这条还原**负责收尾：
 *
 *      UPDATE agri_prod_task_info SET urge_count = 0, last_urge_time = NULL, last_urge_by = NULL;
 *      UPDATE agri_prod_iot_device SET reboot_requested_at = NULL;
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
const SIDE_EFFECT_PATHS = [
  '/trace/batches/',
  // PATCH /messages/read-all —— 用户端消息中心「全部已读」。
  // 路径里没有 id、也没有请求体，探针一发就把该租户所有未读消息标成已读
  // （实测：跑一轮 probe 之后，消息中心 4 条未读全变成已读、头部角标从 4 变 0，
  //  而页面本身没有任何异常 —— 只有对着库看 read_flag 才发现）。
  '/messages/read-all',
]
/**
 * 同类的后缀匹配（路径里已带全动作标识、空体也照样执行的动作端点）。
 *
 * <p>每一条都对应一次实测出来的副作用，不是猜的：</p>
 * <ul>
 *   <li>{@code /generate} —— POST /harvests/1/generate 给批次生成溯源码并落 prod.batch.harvested 事件；
 *       POST /trace/batches/1/generate 生成溯源码；</li>
 *   <li>{@code /accredit}、{@code /reject} —— 运营端检测机构准入：实测空体 POST 会把机构状态
 *       从"合作中"改成"已终止"（跑前跑后对整库做行级快照才发现，页面看不出来）。</li>
 * </ul>
 * <p>新增同类端点就往这里加一条，并在注释里写上"空体会改什么"。</p>
 */
const SIDE_EFFECT_SUFFIXES = ['/generate', '/accredit', '/reject']

/**
 * **按口径不由本服务实现**的路径（前缀匹配）——不计入"缺口"。
 *
 * 为什么需要这份清单：判据是"切某段前该段缺口必须归零"，但有些路径**永远不该切给这个服务**，
 * 它们留在平台侧才是对的。若不排除，脚本会把"平台域路径没在卫星服务里实现"一直算成缺口，
 * 于是这条判据永远达不到 0，等于判据失效。
 *
 * 目前两条：
 *
 * 1. `/admin/tenants/**` —— 租户/市场主体是**平台域**数据（库在 agri_core），
 *    而本服务的口径是"一主体一租户"：租户由平台下发（见 TenantContextService 解析逻辑），
 *    本服务**不拥有**租户主数据。所以这里既不该建 agri_prod_tenant_info 表、也不该接这几个接口
 *    （2026-10-15 已把早先那套 Tenant 脚手架删掉：它对应的表根本不存在，当时 5 个接口一调就是 500）。
 *    对应地，将来切 /admin/ 那一段时**必须把 /admin/tenants 排除在外**（见网关 20-prod.conf 的说明）。
 *
 * 2. `/alerts/rules/**` —— 告警**规则**（2026-10-16 定）。告警记录那一半已经切到本服务，
 *    但规则不切：本服务的规则表列（rule_name/alert_type/condition_expression/threshold_min|max/
 *    notify_methods）与页面 AlertRule 的契约（metric/operator/threshold/duration/scope/notifyChannels）
 *    对不上，硬映射等于编数据。网关里用一条**排在通用正则之前**的 location 把这一族交回平台侧
 *    （见 20-prod.conf），管理端那批规则端点当时也是这么处理的。
 */
const PLATFORM_OWNED_PATHS = ['/admin/tenants/', '/alerts/rules']

/**
 * 抓 api 层的 `http.get/post/...('<path>')`。
 *
 * <p><b>泛型那一截必须用 `[^(]*` 而不是 `[^>]*`</b>（2026-10-15 修的）：后端出参大多是分页，
 * 于是调用长这样 —— {@code http.get<PageResult<RawTraceCode>>(`/admin/trace/codes`, …)}。
 * 用 `[^>]*` 会在第一个 `>` 处停下，整条调用**一条都抓不到**：审计这条链路时实测
 * `/admin/quality/labs`、`/admin/quality/inspections`、`/admin/trace/codes`
 * 这些**页面真的在调**的端点全都不在清单里，于是"该段缺口为 0"可能是假的 ——
 * 判据漏了最典型的那些路径，比不判还危险。改成贪婪匹配到 `(` 之前的最后一个 `>`，嵌套泛型也能吃掉。</p>
 */
/**
 * 抓 api 层的 `http.get/post/...`。第一个参数支持三种写法：
 * 模板字面量 `` `${BASE}/x` ``、单引号 `'/x'`、以及**常量名**。
 *
 * <p>最后一档是 2026-10-15 补的：`http.get<PageResult<SopLibraryItem>>(SOP_BASE, params)`
 * 这种把路径放在常量里、直接传变量的写法，旧正则一条都抓不到 —— 而它是**活路径**
 * （`GET /admin/sop` 就是"SOP 管理"页在用的），漏掉它等于给这一段发一张假的通行证。</p>
 */
const CALL = /http(?:Platform)?\.(get|post|put|patch|delete)\s*(?:<[^(]*>)?\s*\(\s*(`[^`]*`|'[^']*'|[A-Za-z_$][A-Za-z0-9_$.]*)/g
const CONST = /const\s+([A-Za-z_][A-Za-z0-9_]*)\s*=\s*'([^']*)'/g

/**
 * 递归收集源码文件。
 *
 * <p>{@code exts} 必须显式给：扫 api 目录时只要 .ts，而统计"谁调用过这个函数"时
 * **必须连 .tsx 一起收** —— 页面全是 .tsx，只收 .ts 的话每个只被页面使用的函数
 * 都会被判成"没人调"，死函数判定于是把大量活路径误摘出去（第一次写就踩了：
 * 150 条被误判，连"审批管理"页在用的 listApprovalFlows 都在里面）。</p>
 */
function walk(dir, exts, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, exts, out)
    else if (exts.some((ext) => entry.name.endsWith(ext))) out.push(full)
  }
  return out
}

/**
 * 一套「这个 api 函数到底有没有页面在调」的判定，用来把**死函数**从缺口里摘出去。
 *
 * <p>为什么必须分开算：缺口清单是静态扫 api 层得来的，而 api 层里常年躺着一批
 * "定义了、没人调、后端也没实现"的函数（例如 api/trace.ts 的 listTraceScans、
 * api/admin/trace.ts 里的 labs/recalls 增删改查）。它们不算"页面会碎"，
 * 却会让某一段的缺口永远归不了零 —— 判据于是形同失效，而真正该修的那些路径混在里面也看不出来。</p>
 *
 * <p>判定方式：函数名在**整个前端 src** 里出现的次数。声明处算 1 次，
 * 有页面 import/调用就会 ≥2 次；只在声明处出现 = 没有调用方。
 * 之所以用"出现次数"而不是解析 import 图，是因为 import 的写法太多（别名、批量导出、动态 import），
 * 而这里要的是"有没有人提过这个名字"，宽松一点反而不会把活的误判成死的。</p>
 */
function buildCallerIndex(srcRoot) {
  const counts = new Map()
  let files = []
  try {
    // 只走一次：重复遍历会把每个函数名的出现次数翻倍，于是"死函数"也被算成"有人提过"，
    // 整条判定静默失效（第一次写就踩了，表现为死函数一条都没被摘出来）
    files = walk(srcRoot, ['.ts', '.tsx'])
  } catch {
    return { counts, ok: false }
  }
  for (const file of files) {
    let text = ''
    try {
      text = readFileSync(file, 'utf8')
    } catch {
      continue
    }
    for (const m of text.matchAll(/[A-Za-z_$][A-Za-z0-9_$]*/g)) {
      counts.set(m[0], (counts.get(m[0]) ?? 0) + 1)
    }
  }
  return { counts, ok: true }
}

/** 取某个字符下标之前最近的一个 `export function NAME` / `export async function NAME` */
function enclosingFunctionName(text, index) {
  const before = text.slice(0, index)
  const matches = [...before.matchAll(/export\s+(?:async\s+)?function\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)]
  return matches.length === 0 ? null : matches[matches.length - 1][1]
}

/** api 目录的父目录就是前端 src（apiDir 形如 <前端>/src/api） */
const SRC_ROOT = path.resolve(path.dirname(apiDir))
const callerIndex = buildCallerIndex(SRC_ROOT)

const seen = new Map()
/** 第一个参数既不是字面量、也不是本文件里的字符串常量 → 解析不出路径，单独记下来 */
const unresolved = []
for (const file of walk(apiDir, ['.ts'])) {
  const text = readFileSync(file, 'utf8')
  const consts = {}
  for (const m of text.matchAll(CONST)) consts[m[1]] = m[2]
  for (const m of text.matchAll(CALL)) {
    const method = m[1].toUpperCase()
    const fnName = enclosingFunctionName(text, m.index ?? 0)
    const raw = m[2]
    const isLiteral = raw.startsWith('`') || raw.startsWith("'")
    let template
    if (isLiteral) {
      template = raw.slice(1, -1)
    } else {
      // 常量名：只有它在本文件里被声明成字符串常量时才敢用，否则是拼接出来的运行时值
      const name = raw.split('.')[0]
      if (!Object.prototype.hasOwnProperty.call(consts, name)) {
        unresolved.push({ file: path.relative(apiDir, file), method, raw: raw.slice(0, 40), fnName })
        continue
      }
      template = consts[name]
    }
    const resolved = template.replace(/\$\{([^}]+)\}/g, (_all, expr) => {
      const name = expr.trim()
      if (Object.prototype.hasOwnProperty.call(consts, name)) return consts[name]
      return name.startsWith('BASE') ? (consts.BASE ?? '') : placeholder
    })
    if (!resolved.startsWith('/')) continue
    const key = `${method} ${resolved}`
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, { file: path.relative(apiDir, file), method, path: resolved, fnNames: [fnName] })
    } else if (fnName && !existing.fnNames.includes(fnName)) {
      // **同一个路径可能被多个 api 函数发出**（例：/admin/monitor/tasks 由 listMonitorTasks 与
      // listMonitorTaskStatusStats 各发一次），要把所有发起者都记下来：
      // 只记第一个的话，第一个恰好是死函数时，这条活路径会被误判成"没人调"而漏出缺口清单
      // （实测就踩到了，/admin/monitor/tasks 是 MonitorCenter 在用的）。
      existing.fnNames.push(fnName)
    }
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
/** 只有"死函数"会发出的路径（函数名在整个前端 src 里只出现在声明处）→ 不是缺口 */
const isDeadOnly = (m) =>
  callerIndex.ok &&
  m.fnNames.length > 0 &&
  // 只要有**任意一个**发起者被页面调用，这条路径就是活的
  m.fnNames.every((name) => (callerIndex.counts.get(name) ?? 0) <= 1)
const deadOnly = missing.filter((m) => !isPlatformOwned(m.path) && isDeadOnly(m))
const platformOwned = missing.filter((m) => isPlatformOwned(m.path))
const realMissing = missing.filter((m) => !isPlatformOwned(m.path) && !isDeadOnly(m))

console.log(`== 前端会发出的请求：${list.length} 条（去重后） ==`)
console.log(`== 缺口 ${realMissing.length} | 有处理器但本次调用未成功 ${handledButFailed.length} | 成功 ${ok.length} ==`)
if (platformOwned.length > 0) {
  console.log(
    `== 另 ${platformOwned.length} 条按口径不由本服务实现（平台域，应留在平台侧；不计入缺口）` +
      `：${PLATFORM_OWNED_PATHS.join('、')} ==`,
  )
}
if (deadOnly.length > 0) {
  console.log(
    `== 另 ${deadOnly.length} 条只由"没有页面调用"的 api 函数发出（不计入缺口）` +
      `${callerIndex.ok ? '' : '；⚠️ 无法读取前端 src，本次未做死函数判定'} ==`,
  )
}
if (unresolved.length > 0) {
  // 不静默：解析不出路径的调用意味着**可能**有活路径没进清单，判据的完整性要打折
  console.log(
    `== ⚠️ 另有 ${unresolved.length} 处调用的 URL 不是字面量也不是本文件内的字符串常量，` +
      `未能解析（清单可能不全；如需覆盖请把这类路径改成常量或模板字面量） ==`,
  )
  for (const u of unresolved.slice(0, 8)) {
    console.log(`   · ${u.method} ${u.raw}${u.fnName ? '  ' + u.fnName + '()' : ''} [${u.file}]`)
  }
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
  // 缺处理器一列只统计**计入缺口**的（真实缺口）：死函数与平台域路径单独一列，
  // 否则这一列会把"没人调、后端也没实现"的路径混进来，看着像一大堆待办
  ...realMissing.map((x) => ['missing', x]),
  ...[...deadOnly, ...platformOwned].map((x) => ['excluded', x]),
  ...handledButFailed.map((x) => ['failed', x]),
  ...ok.map((x) => ['ok', x]),
]) {
  const seg = segmentOf(item.path)
  const row = stats.get(seg) ?? { missing: 0, excluded: 0, failed: 0, ok: 0 }
  row[kind] += 1
  stats.set(seg, row)
}
console.log('\n== 按路径段统计 ==')
console.log(
  '  ' +
    '段'.padEnd(18) +
    '缺处理器'.padStart(10) +
    '不计入缺口'.padStart(12) +
    '有处理器未成功'.padStart(16) +
    '成功'.padStart(8),
)
for (const [seg, row] of [...stats.entries()].sort((a, b) => b[1].missing - a[1].missing)) {
  console.log(
    `  ${seg.padEnd(18)} ${String(row.missing).padStart(10)} ${String(row.excluded).padStart(12)}` +
      ` ${String(row.failed).padStart(16)} ${String(row.ok).padStart(8)}`,
  )
}

console.log(`\n-- 缺处理器的路径（${realMissing.length} 条） --`)
for (const m of realMissing) console.log(`  ${m.method.padEnd(6)} ${m.path.padEnd(56)} [${m.file}]`)

if (platformOwned.length > 0) {
  console.log(`\n-- 不计入缺口的平台域路径（${platformOwned.length} 条；切 /admin/ 段时必须排除） --`)
  for (const m of platformOwned) console.log(`  ${m.method.padEnd(6)} ${m.path.padEnd(56)} [${m.file}]`)
}

if (deadOnly.length > 0) {
  console.log(
    `\n-- 只由无页面调用的 api 函数发出（${deadOnly.length} 条；不计入缺口）` +
      `—— 要做这些功能就是新页面 + 新端点，届时把函数接上自然会重新计数 --`,
  )
  for (const m of deadOnly) {
    console.log(
      `  ${m.method.padEnd(6)} ${m.path.padEnd(56)} [${m.file}] ` +
        m.fnNames.filter(Boolean).map((name) => name + '()').join(' / '),
    )
  }
}

console.log(`\n-- 有处理器但本次调用未成功（${handledButFailed.length} 条，探测用的占位参数所致者属正常） --`)
for (const m of handledButFailed) console.log(`  ${m.method.padEnd(6)} ${m.path.padEnd(56)} ${m.note}`)

// 退出码只看**计入缺口**的那些：平台域路径不参与判据（见 PLATFORM_OWNED_PATHS 说明）
process.exit(realMissing.length > 0 ? 1 : 0)
