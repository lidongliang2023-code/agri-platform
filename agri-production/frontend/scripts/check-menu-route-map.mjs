/**
 * 菜单 ↔ 路由 一致性校验（Vue 3 版）
 *
 * 校验 packages/agri-shared/src/production/menus.json 中的全部叶子菜单均能在 Vue 路由表中命中且不是重定向。
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(SCRIPT_DIR, '..', 'src')
const userSrc = readFileSync(join(SRC, 'vue', 'business', 'userRoutes.ts'), 'utf-8')
const adminSrc = readFileSync(join(SRC, 'vue', 'business', 'adminRoutes.ts'), 'utf-8')
const menus = JSON.parse(readFileSync(resolve(SRC, '../../../packages/agri-shared/src/production/menus.json'), 'utf-8'))

const userEntries = [...userSrc.matchAll(/\{\s*path:\s*['"]([^'"]+)['"]([^}]*)\}/g)]
  .filter((m) => m[1])
  .map((m) => ({ path: `/production/${m[1]}`, redirect: /\bredirect\s*:/.test(m[2]) }))

const adminEntries = [...adminSrc.matchAll(/\{\s*path:\s*['"]([^'"]+)['"]([^}]*)\}/g)]
  .map((m) => ({ path: m[1], redirect: /\bredirect\s*:/.test(m[2]) }))

function checkSide(label, leaves, entries) {
  const map = new Map(entries.map((e) => [e.path, e]))
  let errors = 0
  for (const leaf of leaves) {
    const hit = map.get(leaf.key)
    if (!hit) {
      console.error(`  [缺失路由] ${label} 菜单 "${leaf.label}" (${leaf.key}) 未在路由表中注册`)
      errors += 1
    } else if (hit.redirect) {
      console.error(`  [命中重定向] ${label} 菜单 "${leaf.label}" (${leaf.key}) 指向重定向路由`)
      errors += 1
    }
  }
  console.log(`${label}：菜单叶子 ${leaves.length} 项 / 路由 ${entries.length} 条 -> ${errors === 0 ? 'OK' : `FAIL (${errors})`}`)
  return errors
}

const userLeaves = menus.user.flatMap((g) => g.children)
const adminLeaves = menus.admin.flatMap((g) => g.children)

let totalErrors = 0
totalErrors += checkSide('用户端', userLeaves, userEntries)
totalErrors += checkSide('运营端', adminLeaves, adminEntries)

process.exit(totalErrors === 0 ? 0 : 1)
