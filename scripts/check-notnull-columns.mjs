#!/usr/bin/env node
/**
 * 扫雷：找出「表里 NOT NULL 且没有默认值，但实体没映射」的列。
 *
 * 为什么需要这个脚本：这类列一插入就报
 *   Field 'xxx' doesn't have a default value
 * 表现为接口 500，而**列表页一切正常**（数据是直接写进库的），
 * 所以很容易被当成"功能已经做完了"。本仓库已经撞过两次：
 *   - agri_trade_dispute.applicant_id   → 发起纠纷从来没成功过
 *   - agri_trade_contract.goods_name    → 创建合同会直接 500
 * 根因都是"表列 ≠ 实体字段"：换设计时新列加了，老列的 NOT NULL 没摘掉。
 *
 * 用法：
 *   MYSQL_PWD=<本机 mysql 口令> node scripts/check-notnull-columns.mjs [库名] [实体目录...]
 *   mysql 客户端不在 PATH 时用 MYSQL_BIN 指定绝对路径
 * 默认库名 agri_trade，默认实体目录 agri-trade/backend/src/main/java/com/agri/trade/entity
 * 退出码：0 = 没发现，1 = 发现（可直接用在 CI 里），2 = 缺 MYSQL_PWD，3 = 连不上库
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const db = process.argv[2] || 'agri_trade'
const entityDirs = process.argv.slice(3)
if (entityDirs.length === 0) {
  entityDirs.push('agri-trade/backend/src/main/java/com/agri/trade/entity')
}

const pwd = process.env.MYSQL_PWD
if (!pwd) {
  console.error('必须显式传 MYSQL_PWD（脚本里不写任何口令字面量）')
  process.exit(2)
}

/** 驼峰转下划线：实体里的字段名不写 @TableField 时 MyBatis-Plus 就是这么映射的。 */
const toSnake = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

/** 实体类 -> 它映射到的列集合 */
function collectEntities(dirs) {
  const result = new Map()
  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.java'))) {
      const text = readFileSync(path.join(dir, file), 'utf8')
      const tableName = text.match(/@TableName\("([^"]+)"\)/)
      if (!tableName) continue
      const cols = new Set()
      for (const m of text.matchAll(/@TableField\("([^"]+)"\)/g)) cols.add(m[1])
      for (const m of text.matchAll(/^\s*private\s+[\w<>[\],.]+\s+(\w+);/gm)) cols.add(toSnake(m[1]))
      result.set(tableName[1], { file, cols })
    }
  }
  return result
}

// mysql 客户端不一定在 PATH 里（Windows 上默认装在 Program Files），所以留一个覆盖口
const defaultMysql =
  process.platform === 'win32' ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe' : 'mysql'
const mysqlBin = process.env.MYSQL_BIN || (existsSync(defaultMysql) ? defaultMysql : 'mysql')

function query(sql) {
  let out
  try {
    out = execFileSync(
      mysqlBin,
      ['-uroot', `-p${pwd}`, '-N', '-B', '-e', sql],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
    )
  } catch (error) {
    // 连不上库不算"发现隐患"，单独用 3 退出，让调用方（门禁）判成 skip 而不是 fail
    console.error(`连不上 MySQL（${mysqlBin}）：${error.stderr?.toString().trim().split('\n')[0] ?? error.message}`)
    process.exit(3)
  }
  // 注意：Windows 上 mysql 客户端的输出是 CRLF，单元格末尾会带 \r，
  // 不 trim 的话列名永远匹配不上实体映射（会满屏误报）。
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split('\t').map((cell) => cell.trim()))
}

const entities = collectEntities(entityDirs)
if (process.env.DEBUG_SCAN) {
  console.log(`[debug] entity dirs = ${JSON.stringify(entityDirs)}`)
  console.log(`[debug] entities = ${entities.size}`)
  const sample = entities.get('agri_trade_order')
  console.log(`[debug] agri_trade_order cols(${sample ? sample.cols.size : 'n/a'}) = ${sample ? [...sample.cols].slice(0, 6).join(',') : ''}`)
}
const rows = query(
  `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA='${db}' AND IS_NULLABLE='NO' AND COLUMN_DEFAULT IS NULL
     AND EXTRA NOT LIKE '%auto_increment%' ORDER BY TABLE_NAME, ORDINAL_POSITION;`
)

const byTable = new Map()
for (const [table, column] of rows) {
  if (!byTable.has(table)) byTable.set(table, [])
  byTable.get(table).push(column)
}

let hits = 0
console.log(`库 ${db}：NOT NULL 且无默认值的列，逐个对照实体映射`)
for (const [table, columns] of [...byTable].sort()) {
  const entity = entities.get(table)
  if (!entity) continue
  const missing = columns.filter((c) => !entity.cols.has(c))
  if (missing.length === 0) continue
  hits += 1
  console.log(`  ✗ ${table}: ${missing.join(', ')}   （实体 ${path.basename(entity.file)} 未映射，插入会 500）`)
}
console.log(hits === 0 ? '没发现问题 ✅' : `发现 ${hits} 张表存在隐患 —— 要么把老列的 NOT NULL 摘掉，要么让实体和插入逻辑补上这些列`)
process.exit(hits === 0 ? 0 : 1)
