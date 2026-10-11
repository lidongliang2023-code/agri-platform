#!/usr/bin/env node
/**
 * 子系统前端接入器 —— 把一个已存在的前端工程接进 pnpm workspace 与共享包 `@agri/shared`。
 *
 * <p>为什么是脚本而不是手改：要接的是一批工程（mdm、finance、s2b2c×4…），手工逐个改
 * 「依赖 + tsconfig paths + Vite alias + 接线自检」四处，改漏一处的表现是
 * **运行时才炸**（alias 顺序写反）或**编译期才炸**（paths 写错），六个工程里迟早各犯一次。
 * 脚本化之后，机制本身能进版本库被 review，应用过程可重复执行且幂等。</p>
 *
 * <p><b>它只做加法，且遇到对不上的锚点就停下</b>：所有插入都基于明确的锚点行，
 * 找不到就报错退出，不猜、不重排、不格式化用户文件（避免把整份文件改得面目全非）。</p>
 *
 * 用法：
 *   node ops/workspace/onboard-app.mjs --app agri-master-data/web --dry-run
 *   node ops/workspace/onboard-app.mjs --app agri-master-data/web          # 实际写入
 *   node ops/workspace/onboard-app.mjs --app agri-master-data/web --check   # 只检查接线是否齐全
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const USAGE = `用法：node ops/workspace/onboard-app.mjs --app <相对仓库根的前端目录> [--dry-run|--check]

  例：node ops/workspace/onboard-app.mjs --app agri-master-data/web --dry-run

它会保证四件事：
  1) package.json            增加 "@agri/shared": "workspace:*"
  2) tsconfig.json           增加 "@agri/shared/*" 路径映射（指向 packages/agri-shared/src）
  3) vite.config.ts          增加 '@agri/shared' alias，且**排在 '@' 之前**
  4) src/shared-wiring.ts    新增接线自检模块，并在入口 import 它（接线断了会当场失败）
`

const args = {}
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i]
  if (token === '--help' || token === '-h') {
    console.log(USAGE)
    process.exit(0)
  }
  if (token === '--dry-run') {
    args.dryRun = true
    continue
  }
  if (token === '--check') {
    args.check = true
    continue
  }
  if (token === '--app') {
    args.app = process.argv[++i]
    continue
  }
  console.error(`✗ 无法识别的参数：${token}\n`)
  console.error(USAGE)
  process.exit(1)
}
if (!args.app) {
  console.error(USAGE)
  process.exit(1)
}

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const appDir = path.resolve(REPO_ROOT, args.app)
if (!existsSync(path.join(appDir, 'package.json'))) {
  console.error(`✗ 目标不是前端工程（缺 package.json）：${appDir}`)
  process.exit(1)
}

// 共享包源码相对于本应用的路径（按目录深度计算，不写死）
const sharedRel = path.relative(appDir, path.join(REPO_ROOT, 'packages', 'agri-shared', 'src')).split(path.sep).join('/')
if (!sharedRel.startsWith('..')) {
  console.error(`✗ 目标位于共享包内部，会导致自引用：${appDir}`)
  process.exit(1)
}

const planned = []
const skipped = []
const problems = []

async function patchFile(relPath, apply) {
  const target = path.join(appDir, relPath)
  if (!existsSync(target)) {
    problems.push(`缺少文件：${relPath}`)
    return
  }
  const before = await readFile(target, 'utf8')
  const after = apply(before)
  if (after === null) return // apply 内部已登记 skip 或 problem
  if (after === before) {
    skipped.push(relPath)
    return
  }
  planned.push(relPath)
  if (!args.dryRun && !args.check) {
    await writeFile(target, after, 'utf8')
  }
}

// 1) package.json —— 在 dependencies 块首行插入共享包依赖
await patchFile('package.json', (text) => {
  if (text.includes('"@agri/shared"')) {
    skipped.push('package.json（已有 @agri/shared）')
    return null
  }
  const anchor = '  "dependencies": {\n'
  if (!text.includes(anchor)) {
    problems.push('package.json 里找不到 "dependencies": { 锚点（缩进可能不同），未改动')
    return null
  }
  return text.replace(anchor, `${anchor}    "@agri/shared": "workspace:*",\n`)
})

// 2) tsconfig.json —— 增加共享包子路径映射
await patchFile('tsconfig.json', (text) => {
  if (text.includes('"@agri/shared/*"')) {
    skipped.push('tsconfig.json（已有映射）')
    return null
  }
  const anchor = /(\n\s*"@\/\*":\s*\["src\/\*"\])(,?)/.exec(text)
  if (!anchor) {
    problems.push('tsconfig.json 里找不到 "@/*": ["src/*"] 锚点，未改动')
    return null
  }
  return text.replace(anchor[0], `${anchor[1]},\n      "@agri/shared/*": ["${sharedRel}/*"]${anchor[2]}`)
})

// 3) vite.config.ts —— 增加 alias，且必须排在 '@' 之前
await patchFile('vite.config.ts', (text) => {
  if (text.includes("'@agri/shared'")) {
    skipped.push('vite.config.ts（已有 alias）')
    return null
  }
  const anchor = /(\n\s*)('@':\s*path\.resolve\(__dirname,\s*'\.\/src'\),)/.exec(text)
  if (!anchor) {
    problems.push(
      "vite.config.ts 里找不到 '@': path.resolve(__dirname, './src'), 锚点，未改动。" +
        '（Vite 的 alias 是前缀匹配，共享包必须排在 @ 之前，不能简单追加到末尾）',
    )
    return null
  }
  const indent = anchor[1]
  const insert =
    `${indent}// 共享包必须排在 '@' 之前：Vite 的 alias 按插入顺序做前缀匹配，\n` +
    `${indent}// 否则 '@' 会先把 '@agri/shared/...' 吞成 './src/agri/shared/...'。\n` +
    `${indent}'@agri/shared': path.resolve(__dirname, '${sharedRel}'),`
  return text.replace(anchor[0], `${insert}${anchor[0]}`)
})

// 4) 接线自检模块 + 在入口 import 它
const wiringRelPosix = 'src/shared-wiring.ts'
const wiringPath = path.join(appDir, wiringRelPosix)
const wiringSource = `/**
 * 共享包接线自检（由 ops/workspace/onboard-app.mjs 生成，请勿手工删除）。
 *
 * 作用是把「本子系统与 @agri/shared 的接线是否成立」变成会立刻报错的事实：
 * import type 走 tsconfig 的 paths 映射（写错则编译失败）；运行时 import 走 Vite alias
 * （写错则构建失败）。两条都通过，才说明共享包真的接上了。
 *
 * 它同时把平台品牌色注入为 CSS 变量 --agri-brand-color（与共享包 global.less 同名）：
 * 即使本子系统尚未切换到统一 antd 主题，品牌色也只有一个来源，而不是各写一个色值。
 */
import type { Task } from '@agri/shared/types/task'
import { BRAND_COLOR } from '@agri/shared/styles/theme'

/** 类型侧接线证明：能用共享包的类型即说明 paths 生效 */
export type WiringProbe = Pick<Task, 'taskId' | 'taskNo'>

/** 运行时侧接线证明：值取自共享包 */
export const SHARED_BRAND_COLOR: string = BRAND_COLOR

if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--agri-brand-color', BRAND_COLOR)
}
`
if (existsSync(wiringPath)) {
  skipped.push(`${wiringRelPosix}（已存在）`)
} else {
  planned.push(wiringRelPosix)
  if (!args.dryRun && !args.check) {
    await writeFile(wiringPath, wiringSource, 'utf8')
  }
}

await patchFile(path.join('src', 'main.tsx'), (text) => {
  if (text.includes("'./shared-wiring'") || text.includes('"./shared-wiring"')) {
    skipped.push('src/main.tsx（已 import 接线自检）')
    return null
  }
  const lines = text.split('\n')
  let lastImport = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (/^import\s/.test(lines[i])) lastImport = i
  }
  if (lastImport < 0) {
    problems.push('src/main.tsx 里找不到 import 语句，未改动（需手工接入自检模块）')
    return null
  }
  lines.splice(lastImport + 1, 0, "import './shared-wiring'")
  return lines.join('\n')
})

const mode = args.check ? '检查' : args.dryRun ? '干跑' : '写入'
console.log(`\n【${mode}】${args.app}   共享包相对路径：${sharedRel}`)
if (planned.length) console.log(`  待处理：\n${planned.map((f) => `    - ${f}`).join('\n')}`)
if (skipped.length) console.log(`  跳过（已就绪）：\n${skipped.map((f) => `    - ${f}`).join('\n')}`)
if (problems.length) console.log(`  ⚠ 未完成项：\n${problems.map((f) => `    - ${f}`).join('\n')}`)
console.log('')
process.exit(problems.length ? 2 : 0)
