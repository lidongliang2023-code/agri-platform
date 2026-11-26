/**
 * 路由注册表校验脚本（Vue Router 版）
 *
 * 校验 src/vue/business/userRoutes.ts 与 adminRoutes.ts：
 * 1. 统计用户端 / 运营端路由条目数
 * 2. 校验同一层级下「动态段之后不得出现静态段」
 * 3. 校验关键静态段必须排在同层动态段之前
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const USER_SRC = readFileSync(resolve(SCRIPT_DIR, '..', 'src', 'vue', 'business', 'userRoutes.ts'), 'utf-8')
const ADMIN_SRC = readFileSync(resolve(SCRIPT_DIR, '..', 'src', 'vue', 'business', 'adminRoutes.ts'), 'utf-8')

function extractUserPaths() {
  return [...USER_SRC.matchAll(/\{\s*path:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]).filter(Boolean)
}

function extractAdminPaths() {
  return [...ADMIN_SRC.matchAll(/\{\s*path:\s*['"]\/admin\/production\/([^'"]+)['"]/g)].map((m) => m[1]).filter(Boolean)
}

function checkOrder(paths, label) {
  const byPrefix = new Map()
  for (const p of paths) {
    const segs = p.split('/')
    const prefix = segs.slice(0, -1).join('/')
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, [])
    byPrefix.get(prefix).push(segs[segs.length - 1])
  }
  let problems = 0
  for (const [prefix, lasts] of byPrefix) {
    let seenDynamic = false
    for (const last of lasts) {
      if (last.startsWith(':')) seenDynamic = true
      else if (seenDynamic) {
        console.error(`  [冲突] ${label} 前缀 "${prefix}" 下静态段 "${last}" 位于动态段之后`)
        problems += 1
      }
    }
  }
  if (problems === 0) console.log(`  ${label} 顺序校验通过：无「动态段后跟同层静态段」问题`)
  return problems
}

const USER_PATHS = extractUserPaths()
const ADMIN_PATHS = extractAdminPaths()
const ALL_PATHS = USER_PATHS.concat(ADMIN_PATHS)

console.log(`USER_ROUTES 页面条目: ${USER_PATHS.length}（派生自 userRoutes.ts）`)
console.log(`ADMIN_ROUTES 页面条目: ${ADMIN_PATHS.length}（派生自 adminRoutes.ts）`)
console.log(`合计页面条目: ${USER_PATHS.length + ADMIN_PATHS.length}`)

console.log('\n--- 路由顺序校验 ---')
let problems = checkOrder(USER_PATHS, 'USER')
problems += checkOrder(ADMIN_PATHS, 'ADMIN')

console.log('\n--- 关键顺序断言（前者必须排在后者之前） ---')
const ORDER_ASSERTIONS = [
  ['harvests/create', 'harvests/:harvestId'],
  ['harvests/inventory/create', 'harvests/inventory/:inventoryId'],
  ['trace/codes', 'trace/:code'],
  ['food-safety', 'food-safety/circulation'],
]
for (const [before, after] of ORDER_ASSERTIONS) {
  const b = ALL_PATHS.indexOf(before)
  const a = ALL_PATHS.indexOf(after)
  const ok = b >= 0 && a >= 0 && b < a
  if (!ok) problems += 1
  console.log(`  ${before} [${b}] < ${after} [${a}] -> ${ok ? 'OK' : 'FAIL'}`)
}

console.log(problems === 0 ? '\n路由校验全部通过 ✅' : `\n路由校验发现 ${problems} 个问题 ❌`)
process.exit(problems === 0 ? 0 : 1)
