#!/usr/bin/env node
/**
 * 统一门禁入口 —— 把散落在各处的检查收成一条命令，本地与 CI 跑的是同一份。
 *
 * <p>为什么要它：在此之前，这些验证全靠人手一条条敲（跑单测、查 workspace 成员、`nginx -t`、
 * 抽查发布产物），换个人或换一天就可能漏。门禁的价值不在于"能跑"，而在于"跑不到就不算完成"。</p>
 *
 * <p>分组（可用 --only / --skip 挑选）：</p>
 * <ul>
 *   <li><b>workspace</b>：pnpm-workspace.yaml 里登记的成员是否都存在；缺失的若**已纳入版本控制**
 *       则判失败，未纳入的只提示（CI 里本就没有这些目录，见下）。</li>
 *   <li><b>shared</b>：共享包单测 + 覆盖率门禁（perFile ≥80%）。</li>
 *   <li><b>gateway</b>：`nginx -t` 校验网关配置（找不到 nginx 或 ASCII prefix 时跳过并说明原因）。</li>
 *   <li><b>bucket</b>：发布产物完整性 —— 指针 → 版本目录 → index.html 引用的资源是否真的存在。
 *       这一条专门盯"指针切过去了、资源却 404"的白屏发布。</li>
 *   <li><b>apps</b>：逐个子系统前端跑它自己的 build（默认关闭，加 --build 打开）。</li>
 *   <li><b>schema</b>：扫"NOT NULL 且无默认值、但实体没映射"的列 —— 这类列一插入就 500，
 *       而列表页一切正常，光靠点页面发现不了（见 scripts/check-notnull-columns.mjs）。
 *       没设 MYSQL_PWD 或连不上库时跳过（CI 里没有数据库，属预期）。</li>
 * </ul>
 *
 * <p><b>CI 的已知边界</b>：`agri-master-data/`、`agri-finance/`、`agri-s2b2c/` 这些目录目前
 * 尚未纳入版本控制，CI 检出后不存在，因此 CI 无法校验它们；CI 只覆盖已入库的部分
 * （共享包、网关配置、生产管理系统）。这不是配置疏漏，是依赖顺序问题 —— 等它们入库后自动被覆盖。</p>
 *
 * 用法：node ops/ci/verify.mjs [--build] [--only a,b] [--skip c]
 */
import { existsSync } from 'node:fs'
import { mkdir, readFile, readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const GATEWAY_DIR = path.join(REPO_ROOT, 'ops', 'gateway')
const BUCKET_DIR = path.join(GATEWAY_DIR, 'bucket')

// 门禁里**不调用 pnpm**：Windows 上 pnpm 是 .cmd 包装脚本，Node 20+ 出于安全考虑
// 不允许不带 shell 执行它（EINVAL），而带 shell 又会把含中文/括号的路径交给 cmd.exe 去拼。
// 直接调 vitest / vite 的 JS 入口，跨平台、无 shell、无引号地狱。

const args = { only: null, skip: [], build: false }
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i]
  if (token === '--build') args.build = true
  else if (token === '--only') args.only = (process.argv[++i] ?? '').split(',').filter(Boolean)
  else if (token === '--skip') args.skip = (process.argv[++i] ?? '').split(',').filter(Boolean)
  else if (token === '--help' || token === '-h') {
    console.log('用法：node ops/ci/verify.mjs [--build] [--only workspace,shared,gateway,bucket,apps] [--skip shared]')
    process.exit(0)
  } else {
    console.error(`✗ 无法识别的参数：${token}`)
    process.exit(1)
  }
}

const results = []
function record(group, name, status, note = '') {
  results.push({ group, name, status, note })
}

function run(command, commandArgs, options = {}) {
  return spawnSync(command, commandArgs, {
    cwd: options.cwd ?? REPO_ROOT,
    encoding: 'utf8',
    shell: false,
    env: { ...process.env, ...(options.env ?? {}) },
  })
}

function enabled(group) {
  if (args.only) return args.only.includes(group)
  return !args.skip.includes(group)
}

/**
 * 从构建输出里挑出一行人话。
 *
 * 直接取末尾几行会取到调用栈（本轮实测就是这样：报出来的全是 rollup 的 `at ...` 帧），
 * 开发看到的应该是"哪个文件、什么问题"，而不是栈帧。
 */
function firstMeaningfulError(text) {
  const lines = `${text ?? ''}`
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^at\s/.test(line))
  const key = lines.find((line) =>
    /not exported|Could not resolve|Cannot find|error during build|Build failed|is not defined|is not a function/.test(line),
  )
  return (key ?? lines[lines.length - 1] ?? '未知错误').slice(0, 220)
}

/** ---------- workspace：登记成员是否都存在 ---------- */
async function checkWorkspace() {
  const yamlPath = path.join(REPO_ROOT, 'pnpm-workspace.yaml')
  if (!existsSync(yamlPath)) {
    record('workspace', 'pnpm-workspace.yaml', 'fail', '文件不存在')
    return
  }
  const entries = (await readFile(yamlPath, 'utf8'))
    .split(/\r?\n/)
    .map((line) => /^\s*-\s*'?([^'\s][^']*)'?\s*$/.exec(line))
    .filter(Boolean)
    .map((m) => m[1])
    .filter((entry) => entry !== 'packages/*')

  for (const entry of entries) {
    // 通配符成员不做存在性断言（匹配不到属正常）
    if (entry.includes('*')) {
      record('workspace', entry, 'skip', '通配成员，不做存在性断言')
      continue
    }
    const dir = path.join(REPO_ROOT, entry)
    const tracked = run('git', ['ls-files', '--error-unmatch', entry]).status === 0
    if (existsSync(dir)) {
      record('workspace', entry, 'pass', tracked ? '存在且已入库' : '存在（尚未纳入版本控制）')
    } else if (tracked) {
      record('workspace', entry, 'fail', '已入库的成员目录不存在 —— 有人删了目录却没改 workspace 文件')
    } else {
      record('workspace', entry, 'skip', '目录不在本地（未纳入版本控制；CI 检出后亦不存在，属预期）')
    }
  }
}

/** ---------- shared：共享包单测与覆盖率 ---------- */
function checkShared() {
  const packageDir = path.join(REPO_ROOT, 'packages', 'agri-shared')
  if (!existsSync(path.join(packageDir, 'node_modules'))) {
    record('shared', '依赖安装', 'skip', 'packages/agri-shared/node_modules 不存在，先装依赖')
    return
  }
  const vitestEntry = path.join(packageDir, 'node_modules', 'vitest', 'vitest.mjs')
  if (!existsSync(vitestEntry)) {
    record('shared', 'test:coverage（perFile ≥80%）', 'skip', `未找到 vitest 入口：${vitestEntry}`)
    return
  }
  const result = run(process.execPath, [vitestEntry, 'run', '--coverage'], { cwd: packageDir })
  const summary = (result.stdout ?? '')
    .split(/\r?\n/)
    .filter((line) => /Tests\s+\d+|No files with missing coverage|ERROR: Coverage/.test(line))
    .map((line) => line.trim())
    .join(' / ')
  const detail = result.status === 0
    ? summary
    : summary || (result.error?.message ?? `${result.stderr ?? ''}`.trim().split(/\r?\n/).slice(-2).join(' | ')) || '无输出'
  record('shared', 'test:coverage（perFile ≥80%）', result.status === 0 ? 'pass' : 'fail', detail)
}

/** ---------- gateway：nginx 配置校验 ---------- */
async function checkGateway() {
  const nginxBin = ['C:/nginx/nginx.exe', 'C:\\nginx\\nginx.exe'].find((p) => existsSync(p)) ??
    (run('nginx', ['-v']).error ? null : 'nginx')
  if (!nginxBin) {
    record('gateway', 'nginx -t', 'skip', '本机没有 nginx（CI 里由 apt 安装后再跑）')
    return
  }
  // Windows 版 nginx 打不开含中文的路径：若仓库路径非 ASCII，改用指向它的 ASCII junction
  let prefix = GATEWAY_DIR
  if (/[^\x00-\x7F]/.test(REPO_ROOT)) {
    const junction = path.join(os.homedir(), 'agri-gw')
    if (existsSync(path.join(junction, 'conf', 'nginx.conf'))) {
      prefix = junction
    } else {
      record('gateway', 'nginx -t', 'skip', `仓库路径含非 ASCII 字符且无 ASCII junction（${junction}），Windows 版 nginx 无法加载`)
      return
    }
  }
  // nginx 只创建一级目录，prefix 下的 logs/ 与 temp/* 必须先存在
  for (const dir of ['logs', 'temp/client_body_temp', 'temp/proxy_temp', 'temp/fastcgi_temp', 'temp/uwsgi_temp', 'temp/scgi_temp', 'bucket']) {
    await mkdir(path.join(prefix, dir), { recursive: true })
  }
  const result = run(nginxBin, ['-p', prefix, '-c', 'conf/nginx.conf', '-t'])
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  const ok = result.status === 0 && /test is successful|syntax is ok/.test(output)
  record('gateway', 'nginx -t（conf/nginx.conf）', ok ? 'pass' : 'fail', output.split(/\r?\n/).slice(-2).join(' | '))
}

/** ---------- bucket：发布产物完整性（指针 → 版本目录 → 资源） ---------- */
async function checkBucket() {
  if (!existsSync(BUCKET_DIR)) {
    record('bucket', '发布产物', 'skip', 'bucket 为空（尚未发布过）')
    return
  }
  const apps = (await readdir(BUCKET_DIR, { withFileTypes: true })).filter((e) => e.isDirectory())
  if (apps.length === 0) {
    record('bucket', '发布产物', 'skip', 'bucket 为空（尚未发布过）')
    return
  }
  for (const app of apps) {
    const appDir = path.join(BUCKET_DIR, app.name)
    const pointer = path.join(appDir, 'index.html')
    if (!existsSync(pointer)) {
      record('bucket', app.name, 'fail', '缺少指针文件 index.html')
      continue
    }
    const html = await readFile(pointer, 'utf8')
    const prefixMatch = /\/[A-Za-z0-9-]+\/versions\/([^/"]+)\//.exec(html)
    if (!prefixMatch) {
      record('bucket', app.name, 'fail', '指针里的资源前缀不是 /{app}/versions/{version}/ 形态')
      continue
    }
    const version = prefixMatch[1]
    const versionDir = path.join(appDir, 'versions', version)
    if (!existsSync(versionDir)) {
      record('bucket', app.name, 'fail', `指针指向的版本目录不存在：versions/${version}`)
      continue
    }
    // 指针里的引用分两类：**版本目录内的资源**缺失 = 白屏级故障（必须拦）；
    // 其余（如 index.html 里指向根路径的 /vite.svg 之类）缺失只算警告 ——
    // 它们不属于"指针切过去、资源却没跟过去"这一类，拦下来会把门禁变成噪音源。
    const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1])
    const versioned = assets.filter((asset) => asset.includes(`/versions/${version}/`))
    const other = assets.filter((asset) => !asset.includes(`/versions/${version}/`))
    const missingVersioned = versioned.filter(
      (asset) => !existsSync(path.join(versionDir, asset.replace(/^\/?[^/]+\/versions\/[^/]+\//, ''))),
    )
    if (missingVersioned.length > 0) {
      record('bucket', app.name, 'fail', `指针引用的版本内资源不存在（会白屏）：${missingVersioned.join(', ')}`)
      continue
    }
    const missingOther = other.filter((asset) => !existsSync(path.join(versionDir, asset.replace(/^\//, ''))))
    const manifestPath = path.join(appDir, 'manifest.json')
    const manifestVersion = existsSync(manifestPath) ? JSON.parse(await readFile(manifestPath, 'utf8')).version : null
    const note = `指针 → ${version}，版本内资源 ${versioned.length} 个均存在；manifest=${manifestVersion ?? '(缺失)'}` +
      (missingOther.length ? `；⚠ 非版本化引用缺失（警告，不影响门禁）：${missingOther.join(', ')}` : '')
    if (manifestVersion !== version) {
      record('bucket', app.name, 'fail', note)
    } else {
      record('bucket', app.name, missingOther.length ? 'warn' : 'pass', note)
    }
  }
}

/** ---------- apps：逐个子系统前端构建（默认关闭） ---------- */
async function checkApps() {
  const yamlPath = path.join(REPO_ROOT, 'pnpm-workspace.yaml')
  const entries = (await readFile(yamlPath, 'utf8'))
    .split(/\r?\n/)
    .map((line) => /^\s*-\s*'?([^'\s][^']*)'?\s*$/.exec(line))
    .filter(Boolean)
    .map((m) => m[1])
  for (const entry of entries) {
    if (entry.includes('*')) continue
    const dir = path.join(REPO_ROOT, entry)
    const pkgPath = path.join(dir, 'package.json')
    if (!existsSync(pkgPath)) continue
    const pkg = JSON.parse(await readFile(pkgPath, 'utf8'))
    if (!pkg.scripts?.build) {
      record('apps', entry, 'skip', '没有 build 脚本')
      continue
    }
    // 复刻各家 `tsc && vite build`，但直接调入口（同上：不经过 shell 与 pnpm 包装脚本）
    const tscEntry = path.join(dir, 'node_modules', 'typescript', 'bin', 'tsc')
    const viteEntry = path.join(dir, 'node_modules', 'vite', 'bin', 'vite.js')
    if (!existsSync(viteEntry)) {
      record('apps', entry, 'skip', '未安装 vite，跳过')
      continue
    }
    if (existsSync(tscEntry)) {
      const tsc = run(process.execPath, [tscEntry, '--noEmit'], { cwd: dir })
      if (tsc.status !== 0) {
        record('apps', `${entry} tsc`, 'fail', firstMeaningfulError((tsc.stdout ?? '') + (tsc.stderr ?? '')))
        continue
      }
    }
    const build = run(process.execPath, [viteEntry, 'build'], { cwd: dir })
    record('apps', `${entry} build`, build.status === 0 ? 'pass' : 'fail',
      build.status === 0 ? '构建通过' : firstMeaningfulError((build.stdout ?? '') + (build.stderr ?? '')))
  }
}

/** ---------- schema：表里的列和实体是否对得上 ---------- */

/**
 * 扫"NOT NULL 且没有默认值、但实体没映射"的列。
 *
 * <p>为什么单列一组：这类列的失败方式是"写接口 500、列表页完全正常"，
 * 而演示数据通常是直接写进库的，所以点页面点不出来 —— 本仓库已经栽过两次
 * （agri_trade_dispute 的发起纠纷、agri_trade_contract 的创建合同）。</p>
 *
 * <p>需要数据库，所以本地跑；CI 没有库时跳过而不是判失败。</p>
 */
function checkSchema() {
  const script = path.join(REPO_ROOT, 'scripts', 'check-notnull-columns.mjs')
  if (!existsSync(script)) {
    record('schema', '列与实体一致性', 'skip', 'scripts/check-notnull-columns.mjs 不存在')
    return
  }
  if (!process.env.MYSQL_PWD) {
    record('schema', '列与实体一致性', 'skip', '未设 MYSQL_PWD（CI 无数据库，属预期）')
    return
  }
  const result = run(process.execPath, [script])
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim()
  if (result.status === 0) {
    record('schema', '列与实体一致性', 'pass', '没有"插入即 500"的列')
  } else if (result.status === 3) {
    record('schema', '列与实体一致性', 'skip', output.split(/\r?\n/)[0])
  } else {
    // 脚本自己会把表名列名打出来，这里整段带上，别让人再去手敲一遍
    record('schema', '列与实体一致性', 'fail', output.split(/\r?\n/).filter((l) => l.includes('✗')).join(' | ').slice(0, 400))
  }
}

// ---------------- 执行 ----------------
if (enabled('workspace')) await checkWorkspace()
if (enabled('shared')) checkShared()
if (enabled('gateway')) await checkGateway()
if (enabled('bucket')) await checkBucket()
if (enabled('schema')) checkSchema()
if (args.build && enabled('apps')) await checkApps()

const icons = { pass: '✓', fail: '✗', skip: '·', warn: '⚠' }
console.log('\n===== 统一门禁 =====')
for (const r of results) {
  console.log(`  ${icons[r.status]} [${r.group}] ${r.name}${r.note ? `  —— ${r.note}` : ''}`)
}
const failed = results.filter((r) => r.status === 'fail')
const passed = results.filter((r) => r.status === 'pass').length
const skipped = results.filter((r) => r.status === 'skip').length
const warned = results.filter((r) => r.status === 'warn').length
console.log(`\n通过 ${passed} 项，警告 ${warned} 项，跳过 ${skipped} 项，失败 ${failed.length} 项\n`)
process.exit(failed.length > 0 ? 1 : 0)
