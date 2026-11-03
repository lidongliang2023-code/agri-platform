#!/usr/bin/env node
/**
 * 子系统独立部署状态检查。
 *
 * 用法：
 *   node ops/modules/status.mjs
 *   node ops/modules/status.mjs production
 *   node ops/modules/status.mjs --json
 */
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const catalog = JSON.parse(await readFile(path.join(HERE, 'catalog.json'), 'utf8'))
const jsonMode = process.argv.includes('--json')
const filter = process.argv.slice(2).find((value) => !value.startsWith('--'))

function portOpen(port, timeoutMs = 700) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port })
    const finish = (value) => {
      socket.destroy()
      resolve(value)
    }
    socket.setTimeout(timeoutMs, () => finish(false))
    socket.once('connect', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

const modules = catalog.modules.filter((module) => !filter || module.id === filter)
if (modules.length === 0) {
  console.error(`未找到模块：${filter}`)
  process.exit(2)
}

const result = []
for (const module of modules) {
  const units = []
  for (const unit of module.deploymentUnits) {
    units.push({
      ...unit,
      sourceExists: existsSync(path.join(path.dirname(HERE), '..', unit.source)),
      status: await portOpen(unit.port) ? 'up' : 'down',
    })
  }
  result.push({ ...module, deploymentUnits: units })
}

if (jsonMode) {
  console.log(JSON.stringify(result, null, 2))
  process.exit(0)
}

for (const module of result) {
  const up = module.deploymentUnits.filter((unit) => unit.status === 'up').length
  console.log(`\n${module.name} (${module.id})  ${up}/${module.deploymentUnits.length} 在线`)
  for (const unit of module.deploymentUnits) {
    console.log(`  ${unit.status === 'up' ? '✓' : '✗'} ${String(unit.port).padEnd(5)} ${unit.kind.padEnd(18)} ${unit.url}`)
    console.log(`        发布=${unit.publishApp ?? '-'} 源码=${unit.sourceExists ? '存在' : '缺失'}${unit.targets ? ` 目标=${unit.targets.join('/')}` : ''}`)
    if (unit.note) console.log(`        ${unit.note}`)
  }
}
