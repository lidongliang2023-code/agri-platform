#!/usr/bin/env node
/**
 * 生产管理模块前端发布（版本目录 + 指针 + 发布后自检 + 失败自动回滚）。

 *
 * <p><b>为什么要有这个脚本</b>：2026-10-16 那次手工发布踩了两个坑，都只有"发布后真开页面"才看得见：
 * ① 构建时忘了带 base —— 产物内部按**根路径**拼懒加载 chunk（`/assets/...`），而桶根下没有这些文件，
 *    404 后被 SPA 回退成 HTML，浏览器报 `module script … MIME type of "text/html"`，
 *    表现为"页面能打开、一堆 console 错误"；入口 JS 本身是好的，所以光看资源存在性检查发现不了；
 * ② 版本目录内的 index.html 与桶根指针要**同时**改写/一致，漏一处就会出现"某些资源指向旧前缀"。</p>
 *
 * <p>因此这里把顺序固定下来：带 base 构建 → 落版本目录 → 指针与 manifest 同源 → **巡检自检** →
 * 有白屏/未捕获异常/超出已知基线的 console 错误就**把指针回滚到上一版**并以非 0 退出。
 * 发布是"能打开页面且不报错"才算成功，而不是"文件拷过去了"。</p>
 *
 * <p>已知基线（写死在这里，改动前请先确认）：用户端 57 条路由里，允许**最多 1 个页面**有 console 错误
 * —— 病虫害识别页的 `demo.example.com` 图片域名不可解析（种子数据问题，与本模块代码无关）。</p>
 *
 * 用法：
 *   node ops/deploy-prod-frontend.mjs --version=20261016-v3      # 指定版本号发布
 *   node ops/deploy-prod-frontend.mjs --dry-run                  # 只算版本号、打印将要执行的步骤
 *   node ops/deploy-prod-frontend.mjs --skip-patrol              # 跳过发布后自检（不推荐）
 */
import { execFileSync } from 'node:child_process'
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const FRONTEND = path.join(REPO_ROOT, 'agri-production', 'frontend')
const BUCKET = path.join(REPO_ROOT, 'ops', 'gateway', 'bucket', 'prod')
const VERSIONS = path.join(BUCKET, 'versions')
const PATROL_REPORT = path.join(os.tmpdir(), 'agri-patrol-report.json')
/** 允许有 console 错误的页面数上限（见文件头"已知基线"）。 */
const CONSOLE_ERROR_PAGE_BUDGET = 1

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const skipPatrol = args.includes('--skip-patrol')
const explicitVersion = (args.find((a) => a.startsWith('--version=')) ?? '').split('=')[1]

/** 版本号：默认 `<yyyyMMdd>-v<N>`，N 取当天已有版本的最大序号 + 1。 */
function nextVersion() {
  if (explicitVersion) return explicitVersion
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const used = existsSync(VERSIONS)
    ? readdirSync(VERSIONS).filter((n) => n.startsWith(`${stamp}-v`))
      .map((n) => Number.parseInt(n.split('-v')[1], 10)).filter((n) => Number.isFinite(n))
    : []
  return `${stamp}-v${(used.length ? Math.max(...used) : 0) + 1}`
}

function currentPointerVersion() {
  const manifest = path.join(BUCKET, 'manifest.json')
  if (!existsSync(manifest)) return null
  try {
    return JSON.parse(readFileSync(manifest, 'utf8')).version ?? null
  } catch {
    return null
  }
}

/** 用本地二进制而不是 npx：仓库笔记记过 `npx tsc` 会抓到同名诱饵包、以 0 退出（假绿）。 */
function run(command, commandArgs, cwd) {
  execFileSync(command, commandArgs, { cwd, stdio: 'inherit', shell: process.platform === 'win32' })
}

const version = nextVersion()
const previous = currentPointerVersion()
const base = `/prod/versions/${version}/`
console.log(`[deploy] 版本 ${version}（当前指针 ${previous ?? '无'}，base ${base}）`)
if (dryRun) {
  console.log('[deploy] dry-run：只打印步骤，不做任何改动')
  console.log(`  1) 在 ${FRONTEND} 执行 build（tsc + vite，--base=${base}）`)
  console.log(`  2) dist/* → ${path.join('ops/gateway/bucket/prod/versions', version)}`)
  console.log('  3) 指针 index.html 与 manifest.json 同源写入（回滚点保留为上一版本）')
  console.log('  4) 发布后巡检用户端全量路由；白屏/异常/console 错误超基线则回滚指针')
  process.exit(0)
}

// 1) 构建：必须带 base，否则产物内部按根路径拼 chunk（2026-10-16 那次事故）
const tsc = path.join(FRONTEND, 'node_modules', '.bin', process.platform === 'win32' ? 'tsc.cmd' : 'tsc')
const vite = path.join(FRONTEND, 'node_modules', '.bin', process.platform === 'win32' ? 'vite.cmd' : 'vite')
run(tsc, ['-p', '.'], FRONTEND)
run(vite, ['build', `--base=${base}`], FRONTEND)

const dist = path.join(FRONTEND, 'dist')
const entryHtml = readFileSync(path.join(dist, 'index.html'), 'utf8')
if (!entryHtml.includes(base)) {
  console.error(`[deploy] 构建产物里的资源前缀不是 ${base} —— 说明 base 没生效，已中止（避免再发一次"页面报一堆 MIME 错"的版本）`)
  process.exit(1)
}

// 2) 落版本目录 3) 指针与 manifest
const target = path.join(VERSIONS, version)
rmSync(target, { recursive: true, force: true })
mkdirSync(target, { recursive: true })
cpSync(dist, target, { recursive: true })
writeFileSync(path.join(BUCKET, 'index.html'), entryHtml, 'utf8')
writeFileSync(path.join(BUCKET, 'manifest.json'), `${JSON.stringify({
  app: 'prod',
  version,
  previous,
  repointedAt: new Date().toISOString(),
  publishedAt: new Date().toISOString(),
  entry: `versions/${version}/index.html`,
}, null, 2)}\n`, 'utf8')

// 4) 发布后自检：不通过就回滚指针（保留坏版本目录以便对照）
if (skipPatrol) {
  console.log('[deploy] 已跳过发布后巡检（--skip-patrol）')
  process.exit(0)
}
run(process.execPath, [path.join(REPO_ROOT, 'scripts', 'page-patrol.mjs'),
  '--base', 'http://localhost', '--mode', 'deep', '--only-user'], REPO_ROOT)
const summary = JSON.parse(readFileSync(PATROL_REPORT, 'utf8')).summary ?? {}
const bad = (summary.blank ?? 0) > 0 || (summary.withPageError ?? 0) > 0
  || (summary.withRealConsoleError ?? 0) > CONSOLE_ERROR_PAGE_BUDGET
if (!bad) {
  console.log(`[deploy] 发布成功：${version}（白屏 ${summary.blank ?? 0} / 未捕获异常 ${summary.withPageError ?? 0} / console 错误页 ${summary.withRealConsoleError ?? 0}）`)
  process.exit(0)
}

console.error(`[deploy] 自检未通过：白屏 ${summary.blank ?? 0} / 未捕获异常 ${summary.withPageError ?? 0} / console 错误页 ${summary.withRealConsoleError ?? 0}（上限 ${CONSOLE_ERROR_PAGE_BUDGET}）`)
if (previous && existsSync(path.join(VERSIONS, previous, 'index.html'))) {
  cpSync(path.join(VERSIONS, previous, 'index.html'), path.join(BUCKET, 'index.html'))
  const manifestPath = path.join(BUCKET, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, version: previous, repointedAt: new Date().toISOString(), rolledBackFrom: version }, null, 2)}\n`, 'utf8')
  console.error(`[deploy] 已回滚指针到 ${previous}；版本目录 ${version} 保留作对照`)
} else {
  console.error('[deploy] 没有可回滚的上一版本，请人工处理')
}
process.exit(1)
