/**
 * 路由 ↔ 页面文件 一致性校验（Vue 3 版）
 *
 * 校验 userRoutes.ts 与 adminRoutes.ts 中动态 import('@/...') 的目标文件全部真实存在。
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

const routeSources = [
  readFileSync(join(SRC, 'vue', 'business', 'userRoutes.ts'), 'utf-8'),
  readFileSync(join(SRC, 'vue', 'business', 'adminRoutes.ts'), 'utf-8'),
].join('\n')

function resolveImport(spec) {
  const base = join(SRC, spec)
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}.vue`]) {
    if (existsSync(candidate)) return candidate
  }
  return base
}

const specs = [...routeSources.matchAll(/import\(['"]@\/([^'"]+)['"]\)/g)].map((m) => m[1])
const resolved = specs.map(resolveImport)
const missing = resolved.filter((f) => !existsSync(f))

console.log(`路由动态引用页面数：${specs.length}（去重后 ${new Set(specs).size}）`)
console.log(`[缺失] 路由引用但文件不存在（${missing.length}）：`)
missing.forEach((f) => console.log(`  - ${f}`))

if (missing.length > 0) {
  process.exit(1)
}
console.log('路由页面文件存在性校验全部通过 ✅')
