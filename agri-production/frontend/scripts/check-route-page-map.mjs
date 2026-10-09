/**
 * 路由 ↔ 页面文件 一致性校验
 *
 * 检查两项：
 * 1. 路由表中 lazy(() => import('@/pages/xxx')) 引用的文件是否真实存在（防白屏 / 构建失败）
 * 2. src/pages 下的页面文件是否都被路由引用（找出孤儿页面，除 NotFound 外）
 *
 * 白名单：NON_PAGE_FILES 中的文件是「页面级组件」而非路由页面，不计入孤儿判定。
 * 该清单刻意保持极小（逐项精确匹配），以免削弱对真正孤儿页面的检出能力。
 *
 * 用法：node scripts/check-route-page-map.mjs
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const PAGES = join(SRC, 'pages')

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (full.endsWith('.tsx')) out.push(full)
  }
  return out
}

const routesSrc = readFileSync(join(SRC, 'router', 'routes.tsx'), 'utf-8')

/** 路由表中引用的页面（@/pages/... → 绝对路径） */
const imported = [...routesSrc.matchAll(/import\('@\/pages\/([^']+)'\)/g)].map((m) =>
  join(PAGES, `${m[1]}.tsx`),
)

/**
 * 非路由页面白名单（相对 src/pages 的路径，统一正斜杠）
 *
 * 目前仅一项：admin/farms/RectifyDispatchModal.tsx
 * 它是被 src/pages/admin/farms/FarmSupervisionList.tsx 引用的「页面级弹窗组件」，
 * 不是独立路由页面，因此既不登记路由、也不应被判为孤儿页面。
 *
 * 说明：之所以不把它挪到 src/components/，是因为 96 页刚全部落地、多人仍在途改动，
 * 挪文件需要同步改 import 路径，冲突风险大于整洁收益。
 * 本清单为逐项精确匹配（不做目录/前缀通配），因此对其它真正的孤儿页面不产生遮蔽。
 */
const NON_PAGE_FILES = new Set(['admin/farms/RectifyDispatchModal.tsx'])

/**
 * 判断某个文件是否命中非页面白名单
 * @param {string} file 页面文件绝对路径
 * @returns {boolean} 命中白名单返回 true
 */
function isNonPageFile(file) {
  return NON_PAGE_FILES.has(file.slice(PAGES.length + 1).split('\\').join('/'))
}

/** 磁盘上真实存在的页面文件 */
const onDisk = walk(PAGES)

/** 命中白名单的页面级组件（不计入页面统计） */
const whitelisted = onDisk.filter(isNonPageFile)

const importedSet = new Set(imported)
const diskSet = new Set(onDisk)

/** 路由引用了但不存在的页面（会导致构建失败 / 白屏） */
const missing = imported.filter((f) => !existsSync(f))
/** 磁盘存在但未被路由引用的页面（孤儿） */
const orphans = onDisk
  .filter((f) => !importedSet.has(f))
  .filter((f) => !f.endsWith('NotFound.tsx'))
  .filter((f) => !isNonPageFile(f))
/** 同一个文件被引用多次 */
const duplicated = imported.filter((f, i) => imported.indexOf(f) !== i)

const rel = (p) => p.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, '')

console.log(`路由引用页面数：${imported.length}（去重后 ${importedSet.size}）`)
console.log(`磁盘页面文件数：${onDisk.length}`)
console.log('')
console.log(`[缺失] 路由引用但文件不存在（${missing.length}）：`)
missing.forEach((f) => console.log(`  - ${rel(f)}`))
console.log(`[重复] 同一页面被多条路由引用（${duplicated.length}）：`)
;[...new Set(duplicated)].forEach((f) => console.log(`  - ${rel(f)}`))
console.log(
  `[孤儿] 文件存在但未注册路由（${orphans.length}，已排除 NotFound 与 ${whitelisted.length} 个白名单页面级组件）：`,
)
orphans.forEach((f) => console.log(`  - ${rel(f)}`))
if (whitelisted.length > 0) {
  console.log('[白名单] 已识别为页面级组件、不参与孤儿判定：')
  whitelisted.forEach((f) => console.log(`  - ${rel(f)}`))
}
console.log('')
const pageCount = onDisk.length - whitelisted.length
console.log(pageCount > 0 ? `未被引用占比：${((orphans.length / pageCount) * 100).toFixed(1)}%` : '')
