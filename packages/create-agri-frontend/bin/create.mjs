#!/usr/bin/env node
/**
 * create-agri-frontend —— 农业产业互联网平台 · 子系统前端脚手架
 *
 * <p>依据 V2.0 第 4.8 节「CLI 模板」：脚手架产出标准工程骨架，骨架直接依赖共享包
 * `@agri/shared`，并把「产物按 `/{app}/versions/{version}/` 发布」这条网关约定写进构建配置。</p>
 *
 * <p><b>设计取向：把容易写错、写错了却不会立刻报错的地方交给脚手架固定下来。</b>
 * 具体是三件事：① `@agri/shared` 的解析方式（tsconfig `paths` + Vite alias，且 alias 必须排在
 * `'@'` 之前）；② 构建 `base` 带版本号；③ 共享包源码的相对路径按目标目录实际深度**计算**得出，
 * 不写死 —— 写死的相对路径在新子系统换一层目录时就会静默解析到别处。</p>
 *
 * <p>本脚本无第三方依赖，只用 Node 内置模块；只写目标目录，不改目标目录以外的任何文件
 * （是否登记进 pnpm workspace 由人决定，脚本只提示）。</p>
 */
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const TEMPLATE_DIR = path.resolve(HERE, '../templates/react-spa')
const SHARED_REL_FROM_REPO = path.join('packages', 'agri-shared', 'src')

/** 只对已知文本文件做占位符替换；其余按字节复制。 */
const TEXT_EXTENSIONS = new Set(['.json', '.ts', '.tsx', '.js', '.mjs', '.html', '.md', '.less', '.css'])

const USAGE = `用法：
  create-agri-frontend <目标目录> --app <slug> [选项]

必填：
  <目标目录>            生成位置，例如 agri-iot/frontend
  --app <slug>           子系统标识，小写字母/数字/连字符，同时用作 URL 前缀与包名前缀

选项：
  --name <中文名>        显示名称，默认取 --app
  --port <端口>          开发端口，默认 5174
  --version <x.y.z>      构建版本，决定产物路径 /<app>/versions/<version>/，默认 0.1.0
  --proxy <URL>          开发代理目标，默认 http://localhost:8099
  --repo-root <目录>     仓库根（含 pnpm-workspace.yaml），默认从当前目录向上查找
  --force                目标目录非空时也继续（危险：会覆盖同名文件）
  --help                 显示本说明

例：
  create-agri-frontend agri-iot/frontend --app iot --name 农业物联网管理 --port 5174
`

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  console.error(USAGE)
  process.exit(1)
}

function parseArgs(argv) {
  const out = { positional: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      out.positional.push(token)
      continue
    }
    const key = token.slice(2)
    if (key === 'help') return { help: true }
    if (key === 'force') {
      out.force = true
      continue
    }
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) fail(`参数 --${key} 缺少取值`)
    out[key] = value
    i += 1
  }
  return out
}

/** 从起始目录向上查找含 pnpm-workspace.yaml 的仓库根。 */
function findRepoRoot(startDir) {
  let current = path.resolve(startDir)
  for (;;) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current
    const parent = path.dirname(current)
    if (parent === current) return null
    current = parent
  }
}

function assertMatch(value, pattern, message) {
  if (!pattern.test(value)) fail(message)
}

async function isNonEmptyDir(dir) {
  try {
    const info = await stat(dir)
    if (!info.isDirectory()) fail(`目标已存在且不是目录：${dir}`)
    return (await readdir(dir)).length > 0
  } catch (error) {
    if (error.code === 'ENOENT') return false
    throw error
  }
}

/** 递归复制模板，替换占位符。返回生成的文件数。 */
async function copyTemplate(fromDir, toDir, replacements) {
  await mkdir(toDir, { recursive: true })
  let count = 0
  for (const entry of await readdir(fromDir, { withFileTypes: true })) {
    const from = path.join(fromDir, entry.name)
    const to = path.join(toDir, entry.name)
    if (entry.isDirectory()) {
      count += await copyTemplate(from, to, replacements)
      continue
    }
    const raw = await readFile(from)
    if (!TEXT_EXTENSIONS.has(path.extname(entry.name))) {
      await writeFile(to, raw)
      count += 1
      continue
    }
    let text = raw.toString('utf8')
    for (const [token, value] of Object.entries(replacements)) {
      text = text.split(token).join(value)
    }
    await writeFile(to, text, 'utf8')
    count += 1
  }
  return count
}

const args = parseArgs(process.argv.slice(2))
if (args.help) {
  console.log(USAGE)
  process.exit(0)
}

const targetArg = args.positional[0]
if (!targetArg) fail('缺少目标目录')
if (args.positional.length > 1) fail(`多余的位置参数：${args.positional.slice(1).join(' ')}`)
if (!existsSync(TEMPLATE_DIR)) fail(`模板目录不存在：${TEMPLATE_DIR}`)

const appSlug = args.app
if (!appSlug) fail('缺少必填参数 --app')
assertMatch(appSlug, /^[a-z][a-z0-9-]{0,31}$/, `--app 取值非法：${appSlug}（应形如 iot、trade-s2b2c）`)

const appName = args.name ?? appSlug
const devPort = Number(args.port ?? 5174)
if (!Number.isInteger(devPort) || devPort < 1024 || devPort > 65535) {
  fail(`--port 取值非法：${args.port}（应为 1024~65535 的整数）`)
}
const buildVersion = args.version ?? '0.1.0'
assertMatch(buildVersion, /^\d+\.\d+\.\d+(?:[-.][0-9A-Za-z.-]+)?$/, `--version 取值非法：${buildVersion}`)
const proxyTarget = args.proxy ?? 'http://localhost:8099'

const targetDir = path.resolve(process.cwd(), targetArg)
if (targetDir === path.parse(targetDir).root) fail('目标目录不能是盘符根目录')
if (await isNonEmptyDir(targetDir)) {
  if (!args.force) {
    fail(`目标目录非空：${targetDir}\n若确实要在此生成，请显式加 --force（会覆盖同名文件）`)
  }
  console.warn(`⚠ 目标目录非空，已按 --force 继续：${targetDir}`)
}

const repoRoot = path.resolve(args['repo-root'] ?? findRepoRoot(process.cwd()) ?? '')
if (!args['repo-root'] && !existsSync(path.join(repoRoot, 'pnpm-workspace.yaml'))) {
  fail('未找到 pnpm-workspace.yaml。请在本仓库内执行，或用 --repo-root 指定仓库根。')
}

const sharedSrc = path.join(repoRoot, SHARED_REL_FROM_REPO)
if (!existsSync(sharedSrc)) fail(`找不到共享包源码：${sharedSrc}`)

// 关键：按目标目录的实际深度计算相对路径，不写死层级。
const sharedSrcRel = path.relative(targetDir, sharedSrc).split(path.sep).join('/')
if (sharedSrcRel.startsWith('..') === false) {
  fail(`目标目录位于共享包内部，会导致自引用：${targetDir}`)
}

const replacements = {
  '{{APP_SLUG}}': appSlug,
  '{{APP_NAME}}': appName,
  '{{DEV_PORT}}': String(devPort),
  '{{BUILD_VERSION}}': buildVersion,
  '{{PROXY_TARGET}}': proxyTarget,
  '{{SHARED_SRC_REL}}': sharedSrcRel,
}

const fileCount = await copyTemplate(TEMPLATE_DIR, targetDir, replacements)

const packageName = `${appSlug}-frontend`
const workspaceGlob = path.relative(repoRoot, path.dirname(targetDir)).split(path.sep).join('/')
console.log(`\n✓ 已生成 ${fileCount} 个文件 → ${targetDir}`)
console.log(`  子系统标识   ${appSlug}`)
console.log(`  共享包解析   ${sharedSrcRel}（tsconfig paths + Vite alias 同源）`)
console.log(`  产物路径     /${appSlug}/versions/${buildVersion}/\n`)
console.log('下一步：')
console.log(`  1) 确认 pnpm-workspace.yaml 的 packages 列表覆盖 '${workspaceGlob}/*'`)
console.log('  2) pnpm install')
console.log(`  3) pnpm --filter ${packageName} dev`)
console.log('  4) 起后端后访问首页，页面上的「共享包接线自检」全部有值即接线正确\n')
