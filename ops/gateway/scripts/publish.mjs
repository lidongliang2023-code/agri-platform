#!/usr/bin/env node
/**
 * 前端发布器 —— 实现《网关与域名规划》第三节「静态产物与灰度版本指针」。
 *
 * <p>目录契约（与 V2.0 4.7 的 `bucket:/{app}/versions/{version}/` 一致）：</p>
 * <pre>
 * bucket/{app}/
 *   ├── index.html          当前版本指针（短缓存，内容为该版本的 index.html）
 *   ├── manifest.json       当前指针元数据（app/version/builtAt/entry）
 *   └── versions/{version}/ 不可变产物目录
 * </pre>
 *
 * <p>为什么必须是「版本目录 + 指针」而不是覆盖发布：回滚 = 把指针切回上一个目录，
 * 秒级且不需要重新构建；`--repoint` 就是这个动作。版本目录一旦发布就不再改动，
 * 所以 nginx 可以对它下长缓存。</p>
 *
 * <p><b>本脚本会主动拦住一类"看起来发布成功、打开却白屏"的故障</b>：
 * index.html 里引用的资源前缀与版本目录必须一致。用默认的 `vite build` 产物
 * （资源按 `/assets/...` 绝对路径引用）放进 `versions/<v>/` 就会出现这种白屏 ——
 * 指针切过去了，资源却 404。发布前校验，不合格直接失败，而不是发上去等用户发现。</p>
 *
 * 用法：
 *   node ops/gateway/scripts/publish.mjs --app prod --version 20261011-v1 --build
 *   node ops/gateway/scripts/publish.mjs --app prod --repoint 20261010-9f8e7d   # 回滚
 */
import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const GATEWAY_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BUCKET_DIR = path.join(GATEWAY_DIR, 'bucket')

/** 已登记子系统 → 前端工程目录（相对仓库根）。新增子系统时在这里加一行。 */
const APPS = {
  prod: { frontendDir: path.join('agri-production', 'frontend'), title: '生产管理系统' },
  mdm: { frontendDir: path.join('agri-master-data', 'web'), title: '主数据管理平台' },
  trade: { frontendDir: path.join('agri-trade', 'frontend'), title: '交易撮合平台' },
  finance: { frontendDir: path.join('agri-finance', 'frontend'), title: '供应链金融平台' },
  // S2B2C 一个子系统有四个端（渠道/消费者/平台运营/供应商），按端各出一份产物。
  // 生产环境它们同属 mall 子域（按路径区分端），本地为了能直接点开，各给一个端口。
  'mall-consumer': { frontendDir: path.join('agri-s2b2c', 'frontend-consumer'), title: 'S2B2C 商城（消费者端）' },
  'mall-supplier': { frontendDir: path.join('agri-s2b2c', 'frontend-supplier'), title: 'S2B2C 商城（供应商端）' },
  'mall-channel': { frontendDir: path.join('agri-s2b2c', 'frontend-channel'), title: 'S2B2C 商城（渠道端）' },
  sso: { frontendDir: path.join('agri-sso', 'frontend'), title: '统一认证中心登录页' },
  // 注意：agri-s2b2c/frontend-platform 未登记 —— 它当前构建不过（既有源码缺陷，见 ops/workspace/README.md），
  // 发布器对「未登记子系统」会直接拒绝，这里保持拒绝状态而不是登记一个发布不出来的应用。
}

const USAGE = `用法：
  publish.mjs --app <slug> --version <标签> [--build] [--force]
  publish.mjs --app <slug> --repoint <标签>          # 回滚/切指针

参数：
  --app <slug>        子系统代号（当前已登记：${Object.keys(APPS).join('、')}）
  --version <标签>    版本目录名，建议 日期-短哈希，如 20261011-a1b2c3
  --build             先执行 tsc 与 vite build（带 --base=/{app}/versions/{version}/）
  --dist <目录>       直接发布现成产物目录（不构建）；与 --build 互斥
  --force             版本目录已存在时也覆盖（正常发布**不应**用到，版本目录不可变）
  --repoint <标签>    只切换指针到已存在的版本目录
`

function fail(message) {
  console.error(`\n✗ ${message}\n`)
  process.exit(1)
}

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) fail(`无法识别的参数：${token}`)
    const key = token.slice(2)
    if (key === 'build' || key === 'force') {
      out[key] = true
      continue
    }
    const value = argv[i + 1]
    if (value === undefined || value.startsWith('--')) fail(`参数 --${key} 缺少取值`)
    out[key] = value
    i += 1
  }
  return out
}

function repoRoot() {
  let current = GATEWAY_DIR
  for (;;) {
    if (existsSync(path.join(current, 'pnpm-workspace.yaml'))) return current
    const parent = path.dirname(current)
    if (parent === current) fail('未找到仓库根（含 pnpm-workspace.yaml）')
    current = parent
  }
}

async function existsAsDir(target) {
  try {
    return (await stat(target)).isDirectory()
  } catch {
    return false
  }
}

/** 发布一个版本的产物目录，并（可选）把指针切过去。 */
async function publishVersion(app, version, distDir, { force, repoint }) {
  const appBucket = path.join(BUCKET_DIR, app)
  const versionDir = path.join(appBucket, 'versions', version)

  if (repoint) {
    if (!existsSync(path.join(versionDir, 'index.html'))) {
      fail(`版本目录不存在或缺少 index.html，无法切指针：${versionDir}`)
    }
  } else {
    if (!existsAsDir(distDir)) {
      fail(`产物目录不存在：${distDir}（先构建，或加 --build）`)
    }
    if ((await readdir(distDir)).length === 0) {
      fail(`产物目录为空：${distDir}`)
    }
    if (existsSync(versionDir) && !force) {
      fail(`版本目录已存在：${versionDir}\n版本目录按约定不可变。换一个 --version，或在确认要覆盖时加 --force。`)
    }
    // 关键校验：资源前缀必须与版本目录一致，否则就是"指针切过去了、资源却 404"的白屏发布
    const distIndex = await readFile(path.join(distDir, 'index.html'), 'utf8')
    const expectedPrefix = `/${app}/versions/${version}/`
    if (!distIndex.includes(expectedPrefix)) {
      fail(
        `产物里的资源前缀与版本目录不一致，发布后必然白屏。\n` +
          `  期望包含：${expectedPrefix}\n` +
          `  实际 index.html 片段：${(distIndex.match(/src="[^"]+"/) || ['(未找到 script src)'])[0]}\n` +
          `  解法：用 --build 发布（脚本会带 --base=/${app}/versions/${version}/ 重新构建）。`,
      )
    }
    await rm(versionDir, { recursive: true, force: true })
    await mkdir(versionDir, { recursive: true })
    await cp(distDir, versionDir, { recursive: true })
  }

  // 切指针：指针文件就是该版本的 index.html（其内资源已是 /{app}/versions/{v}/ 绝对前缀）
  const versionIndex = await readFile(path.join(versionDir, 'index.html'), 'utf8')
  await mkdir(appBucket, { recursive: true })
  await writeFile(path.join(appBucket, 'index.html'), versionIndex, 'utf8')
  await writeFile(
    path.join(appBucket, 'manifest.json'),
    JSON.stringify(
      {
        app,
        version,
        repointedAt: repoint ? new Date().toISOString() : null,
        publishedAt: repoint ? undefined : new Date().toISOString(),
        entry: `versions/${version}/index.html`,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  )
  return versionDir
}

const args = parseArgs(process.argv.slice(2))
if (!args.app) fail('缺少 --app')
const appConfig = APPS[args.app]
if (!appConfig) fail(`未登记的子系统：${args.app}（已登记：${Object.keys(APPS).join('、')}）`)

const root = repoRoot()
const frontendDir = path.join(root, appConfig.frontendDir)

if (args.repoint) {
  const dir = await publishVersion(args.app, args.repoint, null, { force: false, repoint: true })
  console.log(`\n✓ 指针已切到 ${args.app}@${args.repoint}`)
  console.log(`  版本目录 ${dir}`)
  console.log(`  访问     http://localhost/${args.app}/index.html\n`)
  process.exit(0)
}

if (!args.version) fail('缺少 --version')
if (args.build && args.dist) fail('--build 与 --dist 不能同时给：前者是现场构建，后者是直接发布现成产物')
// 产物目录：默认取工程内 dist；CI 或"构建在别处、只在这里发布"时用 --dist 指定
const distDir = args.dist ? path.resolve(args.dist) : path.join(frontendDir, 'dist')

/**
 * 找 npm 包里的可执行脚本，兼容两种 node_modules 布局。
 *
 * <p>为什么需要它：npm 的扁平布局下 `<pkg>/bin/x.js` 一定在
 * `node_modules/<pkg>/bin/x.js`；而 pnpm 把真身放在
 * `node_modules/.pnpm/<pkg>@<版本>/node_modules/<pkg>/`，顶层只留软链 ——
 * 交易撮合前端（agri-trade/frontend）就是 pnpm 布局，脚本原先按写死的扁平路径去找，
 * 直接报 `Cannot find module .../node_modules/vite/bin/vite.js`，发布中止。</p>
 */
function resolveBin(frontendDir, pkg, relBin) {
  const direct = path.join(frontendDir, 'node_modules', pkg, relBin)
  if (existsSync(direct)) {
    return direct
  }
  const pnpmDir = path.join(frontendDir, 'node_modules', '.pnpm')
  if (existsSync(pnpmDir)) {
    for (const entry of readdirSync(pnpmDir)) {
      if (entry === pkg || entry.startsWith(`${pkg}@`)) {
        const candidate = path.join(pnpmDir, entry, 'node_modules', pkg, relBin)
        if (existsSync(candidate)) {
          return candidate
        }
      }
    }
  }
  return null
}

if (args.build) {
  const base = `/${args.app}/versions/${args.version}/`
  console.log(`构建 ${appConfig.title}（base=${base}）…`)
  // 类型检查只在工程真的装了 TypeScript 时才跑：Vue 系的工程没有 TS，
  // 无条件调用会因找不到 tsc 而把发布直接中止（不是类型错误，却报成失败）。
  const tscBin = resolveBin(frontendDir, 'typescript', path.join('bin', 'tsc'))
  if (tscBin) {
    const tsc = spawnSync(process.execPath, [tscBin, '--noEmit'], { cwd: frontendDir, stdio: 'inherit' })
    if (tsc.status !== 0) fail('类型检查未通过，发布中止')
  } else {
    console.log('  （该工程未使用 TypeScript，跳过类型检查）')
  }
  const viteBin = resolveBin(frontendDir, 'vite', path.join('bin', 'vite.js'))
  if (!viteBin) fail(`找不到 vite 可执行文件（${frontendDir}）：既不在 node_modules/vite/bin，也不在 pnpm 的 .pnpm 存储里`)
  const vite = spawnSync(
    process.execPath,
    [viteBin, 'build', `--base=${base}`],
    { cwd: frontendDir, stdio: 'inherit' },
  )
  if (vite.status !== 0) fail('构建失败，发布中止')
}

const versionDir = await publishVersion(args.app, args.version, distDir, {
  force: Boolean(args.force),
  repoint: false,
})
console.log(`\n✓ 已发布 ${args.app}@${args.version}`)
console.log(`  版本目录 ${versionDir}`)
console.log(`  指针     ${path.join(BUCKET_DIR, args.app, 'index.html')}`)
console.log(`  访问     http://localhost/${args.app}/index.html`)
console.log(`  回滚     node ops/gateway/scripts/publish.mjs --app ${args.app} --repoint <旧版本>\n`)
