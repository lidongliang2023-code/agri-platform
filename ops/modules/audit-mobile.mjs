#!/usr/bin/env node
/**
 * 移动端独立部署审计。
 *
 * 检查每个 uni-app 工程是否具备：
 *   H5 / 微信小程序 / App 构建脚本、uni-app-plus 依赖、manifest 的 mp-weixin/app-plus、
 *   API 环境变量示例，以及独立的网关发布代号。
 */
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..', '..')
const jsonMode = process.argv.includes('--json')

const MOBILES = [
  { id: 'production', dir: 'agri-production/miniprogram', publishApp: 'prod-mobile', envKey: 'VITE_API_BASE' },
  { id: 'trade', dir: 'agri-trade/miniprogram', publishApp: 'trade-mobile', envKey: 'VITE_TRADE_API_BASE' },
  { id: 'iot', dir: 'agri-iot/miniprogram', publishApp: 'iot-mobile', envKey: 'VITE_IOT_API_BASE' },
  { id: 's2b2c-consumer', dir: 'agri-s2b2c/mobile', publishApp: 'mall-mobile', envKey: 'VITE_S2B2C_API_BASE' },
  { id: 's2b2c-channel', dir: 'agri-s2b2c/mobile-channel', publishApp: 'mall-channel-mobile', envKey: 'VITE_S2B2C_API_BASE' },
  { id: 'service', dir: 'agri-service/mobile', publishApp: 'service-mobile', envKey: 'VITE_SERVICE_API_BASE' },
  { id: 'government', dir: 'agri-government/mobile', publishApp: 'gov-mobile', envKey: 'VITE_GOVERNMENT_API_BASE' },
]

const publishSource = await readFile(path.join(ROOT, 'ops/gateway/scripts/publish.mjs'), 'utf8')
const workspaceSource = await readFile(path.join(ROOT, 'pnpm-workspace.yaml'), 'utf8')
const results = []

for (const mobile of MOBILES) {
  const directory = path.join(ROOT, mobile.dir)
  const packagePath = path.join(directory, 'package.json')
  const manifestPath = path.join(directory, 'src/manifest.json')
  const envPath = path.join(directory, '.env.example')
  const checks = {
    source: existsSync(directory),
    package: existsSync(packagePath),
    manifest: existsSync(manifestPath),
    envExample: existsSync(envPath),
    h5Script: false,
    mpWeixinScript: false,
    appScript: false,
    appPlusDependency: false,
    mpWeixinManifest: false,
    appManifest: false,
    apiEnv: false,
    workspaceListed: workspaceSource.includes(`'${mobile.dir}'`),
    publishRegistered: publishSource.includes(`'${mobile.publishApp}'`),
  }

  if (checks.package) {
    const pkg = JSON.parse(await readFile(packagePath, 'utf8'))
    const scripts = pkg.scripts || {}
    checks.h5Script = Boolean(scripts['build:h5'])
    checks.mpWeixinScript = Boolean(scripts['build:mp-weixin'])
    checks.appScript = Boolean(scripts['build:app'])
    checks.appPlusDependency = Boolean(pkg.dependencies?.['@dcloudio/uni-app-plus'])
  }
  if (checks.manifest) {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))
    checks.mpWeixinManifest = Boolean(manifest['mp-weixin'])
    checks.appManifest = Boolean(manifest['app-plus'])
  }
  if (checks.envExample) {
    checks.apiEnv = (await readFile(envPath, 'utf8')).includes(mobile.envKey)
  }

  const failed = Object.entries(checks).filter(([, value]) => !value).map(([key]) => key)
  results.push({ ...mobile, checks, ok: failed.length === 0, failed })
}

if (jsonMode) {
  console.log(JSON.stringify(results, null, 2))
} else {
  for (const item of results) {
    console.log(`\n${item.ok ? '✓' : '✗'} ${item.id}  ${item.dir}`)
    console.log(`  发布=${item.publishApp}  H5=${item.checks.h5Script}  小程序=${item.checks.mpWeixinScript}  APP=${item.checks.appScript}`)
    if (item.failed.length) console.log(`  缺失=${item.failed.join(', ')}`)
  }
}

if (results.some((item) => !item.ok)) process.exit(1)
