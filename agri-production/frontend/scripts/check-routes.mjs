/**
 * 路由注册表校验脚本
 *
 * 校验 src/router/routes.tsx：
 * 1. 统计用户端 / 运营端页面条目数（数值全部从路由表派生，脚本内不写任何基线数字）
 * 2. 校验同一层级下「动态段之后不得出现静态段」，避免静态路径被动态段吃掉
 * 3. 校验 create 类静态段必须排在同层动态段之前
 *
 * 用法：node scripts/check-routes.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const ROUTES_FILE = resolve(SCRIPT_DIR, '..', 'src', 'router', 'routes.tsx')
const SRC = readFileSync(ROUTES_FILE, 'utf-8')


/**
 * 抽取指定路由数组中的 path 字面量（按 4 空格缩进的 `path: '...'` 行匹配）
 * @param {string} arrayName 导出的路由数组名
 * @returns {string[]} 路由路径列表（相对父级路径）
 */
function extractPaths(arrayName) {
  const start = SRC.indexOf(`export const ${arrayName}: AppRoute[] = [`)
  if (start < 0) {
    throw new Error(`未在 routes.tsx 中找到数组 ${arrayName}`)
  }
  // 从 `= [` 之后开始找数组起始括号，避免命中 AppRoute[] 的方括号
  const eq = SRC.indexOf('= [', start)
  const open = SRC.indexOf('[', eq)
  let depth = 0
  let end = -1
  for (let i = open; i < SRC.length; i += 1) {
    if (SRC[i] === '[') {
      depth += 1
    } else if (SRC[i] === ']') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const block = SRC.slice(open, end + 1)
  // 仅匹配数组元素层（4 空格缩进）的 path，避免误匹配 meta.path；\\r? 兼容 CRLF
  return [...block.matchAll(/^ {4}path: '([^']+)',\r?$/gm)].map((m) => m[1])
}

/**
 * 校验同一层级下动态段之后不得出现静态段
 * @param {string[]} paths 路由路径列表
 * @param {string} label 分组名称，用于日志
 * @returns {number} 发现的问题数量
 */
function checkOrder(paths, label) {
  const byPrefix = new Map()
  for (const p of paths) {
    const segs = p.split('/')
    const prefix = segs.slice(0, -1).join('/')
    if (!byPrefix.has(prefix)) {
      byPrefix.set(prefix, [])
    }
    byPrefix.get(prefix).push(segs[segs.length - 1])
  }
  let problems = 0
  for (const [prefix, lasts] of byPrefix) {
    let seenDynamic = false
    for (const last of lasts) {
      if (last.startsWith(':')) {
        seenDynamic = true
      } else if (seenDynamic) {
        console.error(`  [冲突] ${label} 前缀 "${prefix}" 下静态段 "${last}" 位于动态段之后`)
        problems += 1
      }
    }
  }
  if (problems === 0) {
    console.log(`  ${label} 顺序校验通过：无「动态段后跟同层静态段」问题`)
  }
  return problems
}

const USER_PATHS = extractPaths('USER_ROUTES')
const ADMIN_PATHS = extractPaths('ADMIN_ROUTES')
const ALL_PATHS = USER_PATHS.concat(ADMIN_PATHS)

console.log(`USER_ROUTES 页面条目: ${USER_PATHS.length}（派生自路由表）`)
console.log(`ADMIN_ROUTES 页面条目: ${ADMIN_PATHS.length}（派生自路由表）`)
console.log(`合计页面条目: ${USER_PATHS.length + ADMIN_PATHS.length}（派生自路由表，无硬编码基线）`)

console.log('\n--- 路由顺序校验 ---')
let problems = checkOrder(USER_PATHS, 'USER')
problems += checkOrder(ADMIN_PATHS, 'ADMIN')

console.log('\n--- 关键顺序断言（前者必须排在后者之前） ---')
// 注意：USER_ROUTES / ADMIN_ROUTES 中的 path 为父级相对路径
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
  if (!ok) {
    problems += 1
  }
  console.log(`  ${before} [${b}] < ${after} [${a}] -> ${ok ? 'OK' : 'FAIL'}`)
}

console.log(
  problems === 0 ? '\n路由校验全部通过 ✅' : `\n路由校验发现 ${problems} 个问题 ❌`,
)
process.exit(problems === 0 ? 0 : 1)
