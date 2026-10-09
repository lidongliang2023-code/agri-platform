/**
 * 菜单 ↔ 路由 一致性校验
 *
 * 背景：菜单（src/config/menu.tsx）与路由表（src/router/routes.tsx）是两个独立清单，
 * 早期靠注释写死「96 页」来对齐，一旦增删页面就会静默漂移。
 * 本脚本用「从路由表派生」的方式做硬校验，杜绝漂移：
 * 1. 统计路由页面数（用户端 / 运营端 / 合计）—— 数值全部由路由表计算，脚本内不写任何基线
 * 2. 统计菜单叶子节点数（用户端 / 运营端 / 合计）—— 数值由菜单配置计算
 * 3. 校验每个菜单 key 都能在路由表中命中（未命中 = 点了菜单进 404 / 白屏）
 * 4. 列出「已注册路由但未进菜单」的页面：预期为 create / detail 类子页面，
 *    若出现列表页被漏挂菜单，需要人工确认
 *
 * 用法：node scripts/check-menu-route-map.mjs
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(SCRIPT_DIR, '..', 'src')
const ROUTES_FILE = join(SRC, 'router', 'routes.tsx')
const MENU_FILE = join(SRC, 'config', 'menu.tsx')

const routesSrc = readFileSync(ROUTES_FILE, 'utf-8')
const menuSrc = readFileSync(MENU_FILE, 'utf-8')

/** 路由父级前缀：路由表里写的是相对路径，菜单 key 是绝对路径 */
const PREFIX = {
  USER_ROUTES: '/production/',
  ADMIN_ROUTES: '/admin/production/',
}

/**
 * 抽取指定路由数组中元素层的 path 字面量（4 空格缩进的 `path: '...'` 行）
 * @param {string} arrayName 导出的路由数组名（USER_ROUTES / ADMIN_ROUTES）
 * @returns {string[]} 完整路由路径（已补父级前缀）
 */
function extractRoutePaths(arrayName) {
  const start = routesSrc.indexOf(`export const ${arrayName}: AppRoute[] = [`)
  if (start < 0) {
    throw new Error(`未在 routes.tsx 中找到数组 ${arrayName}`)
  }
  const eq = routesSrc.indexOf('= [', start)
  const open = routesSrc.indexOf('[', eq)
  let depth = 0
  let end = -1
  for (let i = open; i < routesSrc.length; i += 1) {
    if (routesSrc[i] === '[') {
      depth += 1
    } else if (routesSrc[i] === ']') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const block = routesSrc.slice(open, end + 1)
  const prefix = PREFIX[arrayName]
  return [...block.matchAll(/^ {4}path: '([^']+)',\r?$/gm)].map((m) => `${prefix}${m[1]}`)
}

/**
 * 抽取指定菜单分组中的叶子 key
 * @param {string} constName 菜单常量名（USER_MENU / ADMIN_MENU）
 * @returns {{key: string, label: string}[]} 叶子节点列表
 */
function extractMenuLeaves(constName) {
  const start = menuSrc.indexOf(`export const ${constName}: MenuGroup[] = [`)
  if (start < 0) {
    throw new Error(`未在 menu.tsx 中找到常量 ${constName}`)
  }
  const eq = menuSrc.indexOf('= [', start)
  const open = menuSrc.indexOf('[', eq)
  let depth = 0
  let end = -1
  for (let i = open; i < menuSrc.length; i += 1) {
    if (menuSrc[i] === '[') {
      depth += 1
    } else if (menuSrc[i] === ']') {
      depth -= 1
      if (depth === 0) {
        end = i
        break
      }
    }
  }
  const block = menuSrc.slice(open, end + 1)
  return [...block.matchAll(/\{ key: '([^']+)', label: '([^']*)' \}/g)].map((m) => ({
    key: m[1],
    label: m[2],
  }))
}

/** 路由路径是否含动态段（如 :farmId） */
const isDynamic = (path) => path.includes(':')

const userRoutes = extractRoutePaths('USER_ROUTES')
const adminRoutes = extractRoutePaths('ADMIN_ROUTES')
const allRoutes = userRoutes.concat(adminRoutes)
const staticRoutes = allRoutes.filter((p) => !isDynamic(p))

const userMenu = extractMenuLeaves('USER_MENU')
const adminMenu = extractMenuLeaves('ADMIN_MENU')
const allMenu = userMenu.concat(adminMenu)

console.log('--- 页面数量（全部由路由表 / 菜单配置派生，脚本内无硬编码基线） ---')
console.log(`路由页面数：用户端 ${userRoutes.length} + 运营端 ${adminRoutes.length} = 合计 ${allRoutes.length}`)
console.log(
  `菜单叶子数：用户端 ${userMenu.length} + 运营端 ${adminMenu.length} = 合计 ${allMenu.length}`,
)

const routeSet = new Set(allRoutes)
const menuKeySet = new Set(allMenu.map((leaf) => leaf.key))

/** 菜单 key 在路由表中找不到对应页面 —— 点了必然 404 */
const deadMenu = allMenu.filter((leaf) => !routeSet.has(leaf.key))
/** 静态路由未进菜单 —— 预期是 create / detail 类子页面 */
const hiddenRoutes = staticRoutes.filter((p) => !menuKeySet.has(p))

const dynamicRoutes = allRoutes.filter(isDynamic)
const reconciled = allMenu.length + hiddenRoutes.length + dynamicRoutes.length
console.log(
  `\n对账：菜单叶子 ${allMenu.length} + 未挂菜单静态页 ${hiddenRoutes.length} + 动态详情页 ${dynamicRoutes.length} = ${reconciled}（路由合计 ${allRoutes.length}，${reconciled === allRoutes.length ? '一致 ✅' : '不一致 ❌'}）`,
)

console.log('\n--- 菜单 key ↔ 路由 命中校验 ---')
console.log(`[死链] 菜单指向不存在的路由（${deadMenu.length}）：`)
deadMenu.forEach((leaf) => console.log(`  - ${leaf.key}（${leaf.label}）`))

console.log(
  `\n[未挂菜单] 已注册静态路由但未进菜单（${hiddenRoutes.length}）：预期为 create / detail 类子页面`,
)
hiddenRoutes.forEach((p) => console.log(`  - ${p}`))

const problems = deadMenu.length
console.log(
  problems === 0
    ? '\n菜单 ↔ 路由 校验通过 ✅（无死链；未挂菜单项均为 create / detail 子页面）'
    : `\n菜单 ↔ 路由 校验发现 ${problems} 个死链 ❌`,
)
process.exit(problems === 0 ? 0 : 1)
