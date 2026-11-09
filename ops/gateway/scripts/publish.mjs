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
  'trade-mobile': {
    frontendDir: path.join('agri-trade', 'miniprogram'),
    title: '交易撮合独立移动端（H5 / 微信小程序 / App）',
    accessUrl: 'http://localhost:8181/',
    builder: 'uni-app',
    distDir: path.join('dist', 'build', 'h5'),
  },
  'prod-mobile': {
    frontendDir: path.join('agri-production', 'miniprogram'),
    title: '生产管理移动端（H5 / 微信小程序 / App）',
    accessUrl: 'http://localhost:8180/',
    builder: 'uni-app',
    distDir: path.join('dist', 'build', 'h5'),
  },
  finance: {
    frontendDir: path.join('agri-finance', 'frontend'),
    title: '供应链金融平台',
    accessUrl: 'http://localhost:8081/finance/',
  },
  'iot-web': {
    frontendDir: path.join('agri-iot', 'web'),
    title: '物联网管理用户端',
    accessUrl: 'http://localhost:8101/',
  },
  'iot-admin': {
    frontendDir: path.join('agri-iot', 'ops'),
    title: '物联网管理运营端',
    accessUrl: 'http://localhost:8102/',
  },
  'iot-mobile': {
    frontendDir: path.join('agri-iot', 'miniprogram'),
    title: '物联网管理移动端',
    accessUrl: 'http://localhost:8111/',
    builder: 'uni-app',
    distDir: path.join('dist', 'build', 'h5'),
  },
  // S2B2C 一个子系统有四个端（渠道/消费者/平台运营/供应商），按端各出一份产物。
  // 生产环境它们同属 mall 子域（按路径区分端），本地为了能直接点开，各给一个端口。
  'mall-consumer': {
    frontendDir: path.join('agri-s2b2c', 'frontend-consumer'),
    title: 'S2B2C 商城（消费者端）',
    accessUrl: 'http://localhost:8082/',
  },
  'mall-channel': {
    frontendDir: path.join('agri-s2b2c', 'frontend-channel'),
    title: 'S2B2C 商城（商家端）',
    accessUrl: 'http://localhost:8085/',
  },
  's2b2c-platform': {
    frontendDir: path.join('agri-s2b2c', 'frontend-platform'),
    title: 'S2B2C 平台运营端',
    accessUrl: 'http://localhost:8103/',
  },
  'mall-mobile': {
    frontendDir: path.join('agri-s2b2c', 'mobile'),
    title: 'S2B2C 消费者移动端',
    accessUrl: 'http://localhost:8182/',
    builder: 'uni-app',
    distDir: path.join('dist', 'build', 'h5'),
  },
  'mall-channel-mobile': {
    frontendDir: path.join('agri-s2b2c', 'mobile-channel'),
    title: 'S2B2C 渠道商移动端',
    accessUrl: 'http://localhost:8184/',
    builder: 'uni-app',
    distDir: path.join('dist', 'build', 'h5'),
  },
  sso: { frontendDir: path.join('agri-sso', 'frontend'), title: '统一认证中心登录页' },
  // 用户中心运营端：与 SSO 登录页同属 agri-sso，但产物、端口、入口路径都独立。
  'user-center-ops': {
    frontendDir: path.join('agri-sso', 'ops'),
    title: '用户中心运营端',
    accessUrl: 'http://localhost:8115/user-center-ops/',
  },
  portal: { frontendDir: path.join('agri-portal', 'frontend'), title: '农产云官网门户' },
  // 信息资讯（agri-info）：独立子系统，用户端与运营端各一份产物，共用 info 后端。
  // 与综合服务（service）并列，不复用 agri-service 的包名、端口与产物目录。
  info: {
    frontendDir: path.join('agri-info', 'frontend'),
    title: '信息资讯用户端',
    accessUrl: 'http://localhost:8104/info/',
  },
  'info-ops': {
    frontendDir: path.join('agri-info', 'ops'),
    title: '信息资讯运营端',
    accessUrl: 'http://localhost:8113/info-ops/',
  },
  // 信息资讯移动端：同一套 uni-app 源码产出 H5 / 微信小程序 / App，
  // 这里只发布 H5 产物；小程序与 App 由 CI 单独取 dist/build/mp-weixin、dist/build/app。
  'info-mobile': {
    frontendDir: path.join('agri-info', 'mobile'),
    title: '信息资讯移动端',
    accessUrl: 'http://localhost:8114/',
    builder: 'uni-app',
    distDir: path.join('dist', 'build', 'h5'),
  },
  service: {
    frontendDir: path.join('agri-service', 'frontend'),
    title: '综合服务门户',
    accessUrl: 'http://localhost:8105/',
  },
  'service-mobile': {
    frontendDir: path.join('agri-service', 'mobile'),
    title: '综合服务移动端',
    accessUrl: 'http://localhost:8106/',
    builder: 'uni-app',
    distDir: path.join('dist', 'build', 'h5'),
  },
  'service-ops': {
    frontendDir: path.join('agri-service', 'ops'),
    title: '综合服务运营端',
    accessUrl: 'http://localhost:8107/',
  },
  gov: {
    frontendDir: path.join('agri-government', 'frontend'),
    title: '政府监管服务用户端',
    accessUrl: 'http://localhost:8108/',
  },
  'gov-mobile': {
    frontendDir: path.join('agri-government', 'mobile'),
    title: '政府监管移动执法端',
    accessUrl: 'http://localhost:8109/',
    builder: 'uni-app',
    distDir: path.join('dist', 'build', 'h5'),
  },
  'gov-ops': {
    frontendDir: path.join('agri-government', 'ops'),
    title: '政府监管运营端',
    accessUrl: 'http://localhost:8110/',
  },
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
    // 关键校验：资源前缀必须与版本目录一致，否则就是"指针切过去了、资源却 404"的白屏发布。
    //
    // 这里刻意**逐个比对前缀**而不是 `index.html.includes(expectedPrefix)`：
    // Git Bash / MSYS2 会把以 `/` 开头的参数当成路径做转换，`--base=/prod/versions/x/`
    // 会变成 `/Program Files/.../PortableGit/prod/versions/x/` —— 这个串**包含**
    // `/prod/versions/x/` 这段子串，于是 includes 检查放行，页面整片白屏。
    // 2026-10-28 实际踩过一次：产物发上去了，打开是空白页，控制台报
    // "Expected a JavaScript-or-Wasm module script but the server responded with text/html"。
    const distIndex = await readFile(path.join(distDir, 'index.html'), 'utf8')
    const expectedPrefix = `/${app}/versions/${version}/`
    const assetUrls = [...distIndex.matchAll(/(?:src|href)="([^"]+)"/g)]
      .map((match) => match[1])
      .filter((url) => url.startsWith('/') && !url.startsWith('//'))
    const badUrls = assetUrls.filter((url) => !url.startsWith(expectedPrefix))
    if (assetUrls.length === 0 || badUrls.length > 0) {
      fail(
        `产物里的资源前缀与版本目录不一致，发布后必然白屏。\n` +
          `  期望每个资源都以：${expectedPrefix} 开头\n` +
          `  不合格的资源：${badUrls.slice(0, 3).join(' | ') || '(未找到任何本地资源引用)'}\n` +
          `  解法一：用 --build 发布（脚本会带 --base=/${app}/versions/${version}/ 重新构建）。\n` +
          `  解法二：自己构建时在 Git Bash 下加 MSYS_NO_PATHCONV=1，否则 --base 里的 / 会被当成路径转换。`,
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
  console.log(`  访问     ${appConfig.accessUrl ?? `http://localhost/${args.app}/index.html`}\n`)
  process.exit(0)
}

if (!args.version) fail('缺少 --version')
if (args.build && args.dist) fail('--build 与 --dist 不能同时给：前者是现场构建，后者是直接发布现成产物')
// 产物目录：默认取工程内 dist；CI 或"构建在别处、只在这里发布"时用 --dist 指定
const distDir = args.dist
  ? path.resolve(args.dist)
  : path.join(frontendDir, appConfig.distDir ?? 'dist')

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
  if (appConfig.builder === 'uni-app') {
    const vueTscBin = resolveBin(frontendDir, 'vue-tsc', path.join('bin', 'vue-tsc.js'))
    if (vueTscBin) {
      const typecheck = spawnSync(process.execPath, [vueTscBin, '--noEmit'], { cwd: frontendDir, stdio: 'inherit' })
      if (typecheck.status !== 0) fail('uni-app 类型检查未通过，发布中止')
    }
    const uniBin = resolveBin(frontendDir, '@dcloudio/vite-plugin-uni', path.join('bin', 'uni.js'))
    if (!uniBin) fail(`找不到 uni-app 构建器（${frontendDir}）`)
    const build = spawnSync(
      process.execPath,
      [uniBin, 'build'],
      { cwd: frontendDir, stdio: 'inherit', env: { ...process.env, UNI_H5_BASE: base } },
    )
    if (build.status !== 0) fail('uni-app H5 构建失败，发布中止')
  } else {
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
    { cwd: frontendDir, stdio: 'inherit', env: { ...process.env, ...(appConfig.buildEnv ?? {}) } },
  )
  if (vite.status !== 0) fail('构建失败，发布中止')
  }
}

const versionDir = await publishVersion(args.app, args.version, distDir, {
  force: Boolean(args.force),
  repoint: false,
})
console.log(`\n✓ 已发布 ${args.app}@${args.version}`)
console.log(`  版本目录 ${versionDir}`)
console.log(`  指针     ${path.join(BUCKET_DIR, args.app, 'index.html')}`)
  console.log(`  访问     ${appConfig.accessUrl ?? `http://localhost/${args.app}/index.html`}`)
console.log(`  回滚     node ops/gateway/scripts/publish.mjs --app ${args.app} --repoint <旧版本>\n`)
