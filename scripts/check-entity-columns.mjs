#!/usr/bin/env node
/**
 * 扫雷之二：实体映射的列 vs 数据库真实列。
 *
 * 为什么需要它：与 check-notnull-columns.mjs 是同一类坑的两面 ——
 *   · 那边查"表里有 NOT NULL、实体没有"（插入即 500）；
 *   · 这边查"实体有、表里没有"：写进 WHERE/ORDER BY 就是 Unknown column（SQL 直接报错），
 *     只出现在 SELECT 结果里则表现为"接口 200、页面有行没值"。
 * 生产管理模块实测：设备表与实体交集 12/22 列、传感器数据 5/12、质量检测更是只有 4/19 ——
 * 六张表与实体是两套设计，靠人肉比对根本看不出来。
 *
 * 用法：
 *   MYSQL_PWD=<口令> node scripts/check-entity-columns.mjs <库名> <实体目录> [实体类名...]
 * 例：
 *   MYSQL_PWD=root node scripts/check-entity-columns.mjs agri_production \
 *     agri-production/backend/src/main/java/com/agri/production/entity IoTDevice SensorData
 * 不给实体类名则检查目录下全部实体。
 * 退出码：0 = 没问题，1 = 有缺口，2 = 缺 MYSQL_PWD，3 = 连不上库。
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const db = process.argv[2]
const entityDir = process.argv[3]
const only = process.argv.slice(4)
if (!db || !entityDir) {
  console.error('用法：node scripts/check-entity-columns.mjs <库名> <实体目录> [实体类名...]')
  process.exit(2)
}
const pwd = process.env.MYSQL_PWD
if (!pwd) {
  console.error('必须显式传 MYSQL_PWD（脚本里不写任何口令字面量）')
  process.exit(2)
}

const defaultMysql =
  process.platform === 'win32' ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe' : 'mysql'
const mysqlBin = process.env.MYSQL_BIN || (existsSync(defaultMysql) ? defaultMysql : 'mysql')

const toSnake = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase()

function query(sql) {
  let out
  try {
    out = execFileSync(mysqlBin, ['-uroot', `-p${pwd}`, '-N', '-B', '-e', sql],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (error) {
    console.error(`连不上 MySQL（${mysqlBin}）：${error.stderr?.toString().trim().split('\n')[0] ?? error.message}`)
    process.exit(3)
  }
  return out.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split('\t').map((c) => c.trim()))
}

const tables = new Map()
for (const [table, column] of query(
  `SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA='${db}'`)) {
  if (!tables.has(table)) tables.set(table, new Set())
  tables.get(table).add(column)
}

const files = (only.length ? only.map((n) => `${n}.java`) : readdirSync(entityDir).filter((f) => f.endsWith('.java')))
let problems = 0
for (const file of files) {
  const full = path.join(entityDir, file)
  if (!existsSync(full)) continue
  const text = readFileSync(full, 'utf8')
  const tableName = text.match(/@TableName\("([^"]+)"\)/)
  if (!tableName) continue
  const table = tableName[1]
  if (!tables.has(table)) {
    console.log(`✗ ${file}: 表 ${table} 在库 ${db} 里不存在`)
    problems += 1
    continue
  }
  const mapped = new Set()
  // @TableField(exist = false) 的字段是**非数据库字段**（例如树形结构的 children、按流水聚合出的
  // nearestExpireDate），先整段剔除，否则会被误报成"表里没有这一列"。
  const withoutTransient = text.replace(/@TableField\([^)]*exist\s*=\s*false[^)]*\)\s*\n\s*private[^;]+;/g, '')
  // **一个字段只产出一个列名**：显式声明的（@TableId / @TableField）优先，没有声明的才按驼峰推。
  //
  // 早先这里是"先收一遍 @TableField 的值，再把每个字段名的驼峰值也加一遍"，
  // 于是 inputCode（显式映射到 material_code）会同时算出 material_code 与 input_code，
  // 后者表里当然没有 —— 一个字段名与列名不同的**完全对得上**的实体会被判成"表里没有这一列"。
  // 老实体恰好都没踩到（它们的字段名转驼峰后正好等于真实列名），所以一直没暴露。
  const fieldRe = /((?:@[\w.]+(?:\([^)]*\))?\s*)*)private\s+[\w<>,.\s]+?\s+(\w+);/g
  for (const m of withoutTransient.matchAll(fieldRe)) {
    const annotations = m[1] ?? ''
    // 值后面可能还有别的属性：@TableId(value = "id", type = IdType.AUTO) —— 少了 [^)]* 就抓不到，
    // 于是主键字段名回落成驼峰，凭空多出一个 stage_id / record_id 之类的"缺列"。
    const declared = annotations.match(/@Table(?:Field|Id)\(\s*(?:value\s*=\s*)?"([^"]+)"[^)]*\)/)
    mapped.add(declared ? declared[1] : toSnake(m[2]))
  }
  const real = tables.get(table)
  const missing = [...mapped].filter((c) => !real.has(c) && c !== 'id')
  if (missing.length) {
    problems += 1
    console.log(`✗ ${table}: 实体映射了表里没有的列 —— ${missing.sort().join(', ')}`)
  }
}
console.log(problems === 0
  ? `库 ${db}：实体与表列一致 ✅`
  : `发现 ${problems} 处不一致（写进 SQL 会报 Unknown column，或页面有行没值）`)
process.exit(problems === 0 ? 0 : 1)
