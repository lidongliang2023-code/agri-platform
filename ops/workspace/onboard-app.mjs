#!/usr/bin/env node
/**
 * 子系统前端接入器 —— 把一个已存在的前端工程接进 pnpm workspace 与共享包 `@agri/shared`。
 *
 * <p>为什么是脚本而不是手改：要接的是一批工程，手工逐个改「依赖 + 路径映射 + 别名 + 接线自检」
 * 四处，改漏一处的表现是**运行时才炸**（别名顺序写反）或**编译期才炸**（路径映射写错），
 * 工程一多迟早各犯一次。脚本化之后，机制本身能进版本库被 review，应用过程可重复且幂等。</p>
 *
 * <p><b>两种栈</b>（本仓库确实并存，不是假设）：</p>
 * <ul>
 *   <li><b>TS 栈</b>（有 tsconfig.json，如 agri-production/frontend、agri-master-data/web）：
 *       依赖 + tsconfig paths + Vite alias + `src/shared-wiring.ts` 自检（类型走 paths、运行时走 alias）。</li>
 *   <li><b>JS 栈</b>（Vue 3 / element-plus / vant，如 agri-finance、agri-s2b2c/*）：
 *       没有 tsconfig、没有 antd，共享包对它唯一可用的通道是 **设计令牌的 CSS 变量投影**
 *       （`@agri/shared/tokens/tokens.css`）。因此只做：依赖 + Vite alias + 入口 import 该 CSS。</li>
 * </ul>
 *
 * <p><b>它只做加法，且锚点对不上就停下</b>：不猜、不重排、不格式化用户文件。
 * 所有锚点按"行尾无关"匹配（这些工程里有 LF 也有 CRLF，写死 \n 会静默漏改）。</p>
 *
 * 用法：
 *   node ops/workspace/onboard-app.mjs --app agri-master-data/web --dry-run
 *   node ops/workspace/onboard-app.mjs --app agri-finance/frontend
 *   node ops/workspace/onboard-app.mjs --app agri-finance/frontend --check
 */
import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const USAGE = `用法：node ops/workspace/onboard-app.mjs --app <相对仓库根的前端目录> [--dry-run|--check]

  例：node ops/workspace/onboard-app.mjs --app agri-master-data/web --dry-run
      node ops/workspace/onboard-app.mjs --app agri-finance/frontend --check

栈由工程自身决定（有 tsconfig.json 视为 TS 栈）：
  TS 栈：package.json 依赖 + tsconfig paths + Vite alias + src/shared-wiring.ts 自检
  JS 栈：package.json 依赖 + Vite alias + 入口 import '@agri/shared/tokens/tokens.css'
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

const isTsStack = existsSync(path.join(appDir, 'tsconfig.json'))
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
    skipped.push(`${relPath}（无需改动）`)
    return
  }
  planned.push(relPath)
  if (!args.dryRun && !args.check) {
    await writeFile(target, after, 'utf8')
  }
}

/** 找一个存在的文件（用于入口文件在不同工程里叫 main.tsx / main.js / main.ts） */
function firstExisting(relPaths) {
  return relPaths.find((rel) => existsSync(path.join(appDir, rel))) ?? null
}

// 1) package.json —— 在 dependencies 块首行插入共享包依赖
await patchFile('package.json', (text) => {
  if (text.includes('"@agri/shared"')) {
    skipped.push('package.json（已有 @agri/shared）')
    return null
  }
  const anchor = /([ \t]*)"dependencies"[ \t]*:[ \t]*\{[ \t]*(\r?\n)/.exec(text)
  if (!anchor) {
    problems.push('package.json 里找不到 dependencies 块，未改动')
    return null
  }
  return text.replace(anchor[0], `${anchor[0]}${anchor[1]}  "@agri/shared": "workspace:*",${anchor[2]}`)
})

// 2) tsconfig.json（仅 TS 栈）—— 增加共享包子路径映射
if (isTsStack) {
  await patchFile('tsconfig.json', (text) => {
    if (text.includes('"@agri/shared/*"')) {
      skipped.push('tsconfig.json（已有映射）')
      return null
    }
    const anchor = /([ \t]*)"@\/\*"[ \t]*:[ \t]*\["src\/\*"\](,?)(\r?\n)/.exec(text)
    if (!anchor) {
      problems.push('tsconfig.json 里找不到 "@/*": ["src/*"] 锚点，未改动')
      return null
    }
    const [, indent, comma, eol] = anchor
    return text.replace(
      anchor[0],
      `${indent}"@/*": ["src/*"],${eol}${indent}"@agri/shared/*": ["${sharedRel}/*"]${comma}${eol}`,
    )
  })
} else {
  skipped.push('tsconfig.json（JS 栈无此文件，跳过）')
}

// 3) Vite 配置 —— 增加别名，且必须排在 '@' 之前
const viteFile = firstExisting(['vite.config.ts', 'vite.config.js', 'vite.config.mjs'])
if (!viteFile) {
  problems.push('找不到 vite 配置（vite.config.ts / .js / .mjs），未改动')
} else {
  await patchFile(viteFile, (text) => {
    if (text.includes("'@agri/shared'") || text.includes('"@agri/shared"')) {
      skipped.push(`${viteFile}（已有 alias）`)
      return null
    }
    // 同时兼容 `path.resolve(__dirname, './src')`（TS 栈）与 `resolve(__dirname, 'src')`（Vue/JS 栈）
    const anchor = /([ \t]*)(['"])@\2[ \t]*:[ \t]*(path\.resolve|resolve)\(__dirname,[ \t]*(['"])(?:\.\/)?src\4[ \t]*\),?(\r?\n)/.exec(text)
    if (!anchor) {
      if (isTsStack) {
        problems.push(
          `${viteFile} 里找不到 '@' 别名锚点，未改动。` +
            '（TS 栈必须加别名：tsc 不认 package.json 的 exports 子路径；' +
            "且 Vite 的 alias 是前缀匹配，共享包要排在 '@' 之前）",
        )
        return null
      }
      // JS 栈（Vue）：这些工程本来就没有 '@' 别名，而 Vite 会经 package.json 的 exports
      // 解析 '@agri/shared/tokens/tokens.css'。因此这里不视为错误 —— 无别名也能跑通，
      // 且强行插入 resolve 配置属于"替别人决定工程结构"，不该由接入器代劳。
      skipped.push(`${viteFile}（无 '@' 别名，经 package exports 解析，无需改动）`)
      return null
    }
    const [, indent, , resolver, , eol] = anchor
    const insert =
      `${indent}// 共享包必须排在 '@' 之前：Vite 的 alias 按插入顺序做前缀匹配，${eol}` +
      `${indent}// 否则 '@' 会先把 '@agri/shared/...' 吞成 './src/agri/shared/...'。${eol}` +
      `${indent}'@agri/shared': ${resolver}(__dirname, '${sharedRel}'),${eol}`
    return text.replace(anchor[0], `${insert}${anchor[0]}`)
  })
}

// 4) 入口接入
const entryFile = firstExisting(['src/main.tsx', 'src/main.ts', 'src/main.js', 'src/main.jsx'])
if (!entryFile) {
  problems.push('找不到入口文件（src/main.*），未改动')
} else {
  if (isTsStack) {
    const wiringRelPosix = 'src/shared-wiring.ts'
    const wiringPath = path.join(appDir, wiringRelPosix)
    const wiringSource = `/**
 * 共享包接线自检（由 ops/workspace/onboard-app.mjs 生成，请勿手工删除）。
 *
 * 作用是把「本子系统与 @agri/shared 的接线是否成立」变成会立刻报错的事实：
 * import type 走 tsconfig 的 paths 映射（写错则编译失败）；运行时 import 走 Vite alias
 * （写错则构建失败）。两条都通过，才说明共享包真的接上了。
 *
 * 它同时把平台品牌色注入为 CSS 变量 --agri-brand-color（与共享包令牌同名）：
 * 即使本子系统尚未切换到统一 antd 主题，品牌色也只有一个来源，而不是各写一个色值。
 */
import type { Task } from '@agri/shared/types/task'
import { BRAND_COLOR } from '@agri/shared/tokens'

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
    await patchFile(entryFile, (text) => insertAfterLastImport(text, "import './shared-wiring'", 'src/main.tsx'))
  } else {
    // JS 栈：共享包唯一可用通道是设计令牌的 CSS 变量投影（无 TS、无 antd）
    await patchFile(
      entryFile,
      (text) => insertAfterLastImport(text, "import '@agri/shared/tokens/tokens.css'", entryFile),
    )
  }
}

/** 在最后一条 import 之后插入一行（幂等：已存在则跳过） */
function insertAfterLastImport(text, line, label) {
  if (text.includes(line)) {
    skipped.push(`${label}（已接入）`)
    return null
  }
  const eol = text.includes('\r\n') ? '\r\n' : '\n'
  const lines = text.split(/\r?\n/)
  let lastImport = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (/^import\s/.test(lines[i])) lastImport = i
  }
  if (lastImport < 0) {
    problems.push(`${label} 里找不到 import 语句，未改动（需手工接入）`)
    return null
  }
  lines.splice(lastImport + 1, 0, line)
  return lines.join(eol)
}

const mode = args.check ? '检查' : args.dryRun ? '干跑' : '写入'
console.log(`\n【${mode}】${args.app}   栈=${isTsStack ? 'TS（paths + alias + 接线自检）' : 'JS（仅 CSS 令牌通道）'}   共享包相对路径：${sharedRel}`)
if (planned.length) console.log(`  待处理：\n${planned.map((f) => `    - ${f}`).join('\n')}`)
if (skipped.length) console.log(`  跳过（已就绪）：\n${skipped.map((f) => `    - ${f}`).join('\n')}`)
if (problems.length) console.log(`  ⚠ 未完成项：\n${problems.map((f) => `    - ${f}`).join('\n')}`)
console.log('')
process.exit(problems.length ? 2 : 0)
