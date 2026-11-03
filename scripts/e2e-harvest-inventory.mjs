/**
 * 采收 → 入库 → 出库 全链路落库验证
 *
 * <p>验证目标（生产管理系统「地块采收记录 / 采收记录 / 库存管理」三个页面背后的写流程）：</p>
 * <ol>
 *   <li>新建采收批次：落库成功、可回查、冗余字段（地块名/农场/作物）由后端补齐</li>
 *   <li>生成批次溯源码：trace_code 落库、trace_generated=1</li>
 *   <li>成品入库：库存数量累加、写入入库流水</li>
 *   <li>出库：库存数量扣减、写入出库流水</li>
 * </ol>
 *
 * <p><b>为什么每一步都要查库</b>：接口返回 200 只说明"没抛异常"，
 * 逻辑删除（deleted=1）、租户写错、数量没落库这些都能返回 200。
 * 所以每条断言都配一条直连 MySQL 的复核。</p>
 *
 * <p>用法：</p>
 *   node scripts/e2e-harvest-inventory.mjs [--base=http://localhost] [--user=admin] [--password=...]
 *                                        [--farm=1] [--keep]
 *   --keep  保留本次造的数据（默认跑完清理，避免污染演示库）
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const BASE_URL = arg('base', 'http://localhost')
const USER = arg('user', 'admin')
const PASSWORD = arg('password', 'Admin@123')
const FARM_ID = arg('farm', '1')
const KEEP = process.argv.includes('--keep')
const MYSQL_BIN = existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
  : ''
const MYSQL_PASSWORD = arg('mysql-password', 'root')

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/** 直连 MySQL 查一行（只读）。返回制表符分隔的文本；未配置客户端时返回空串 */
const mysql = (sql) => {
  if (!MYSQL_BIN) return ''
  try {
    return execFileSync(
      MYSQL_BIN,
      ['-uroot', `-p${MYSQL_PASSWORD}`, '--default-character-set=utf8mb4', '-N', '-B', '-e', sql],
      { encoding: 'utf8' },
    ).trim()
  } catch (error) {
    return `ERR:${String(error?.message ?? error).slice(0, 120)}`
  }
}

/* ==================== 0) 登录 ==================== */
const login = await (
  await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
  })
).json()
check(login.code === 0, `登录（${USER}）`, `code=${login.code}`)
if (login.code !== 0) process.exit(1)
const AUTH = { Authorization: `Bearer ${login.data.accessToken}`, 'Content-Type': 'application/json' }

const api = async (method, path, body) => {
  const res = await fetch(`${BASE_URL}/api/v1/production${path}`, {
    method,
    headers: AUTH,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* 非 JSON */
  }
  return { status: res.status, json }
}

/** 本次造的数据，便于清理与排错 */
const created = { batchId: null, inventoryId: null, batchNo: null }

/* ==================== 1) 选一个真实地块 ==================== */
const plotsRes = await api('GET', `/plots?pageNum=1&pageSize=100&farmId=${encodeURIComponent(FARM_ID)}`)
const plots = plotsRes.json?.data?.records ?? plotsRes.json?.data?.list ?? []
check(plots.length > 0, `农场 ${FARM_ID} 下有可用地块`, `plots=${plots.length}`)
if (plots.length === 0) {
  console.log('\n没有地块，无法继续')
  process.exit(1)
}
const plot = plots[0]

/* ==================== 2) 新建采收批次 ==================== */
const stamp = Date.now().toString().slice(-8)
const payload = {
  plotId: plot.plotId ?? plot.id,
  quantity: 321.5,
  unit: 'kg',
  grade: 'A',
  harvestDate: new Date().toISOString().slice(0, 10),
  remark: `e2e-采收联调-${stamp}`,
}
const createRes = await api('POST', '/harvests', payload)
check(createRes.status === 200 && createRes.json?.code === 0, '新建采收批次接口返回成功',
  `status=${createRes.status} code=${createRes.json?.code} msg=${createRes.json?.message ?? ''}`)
created.batchId = createRes.json?.data
check(Boolean(created.batchId), '接口返回了新批次主键', `batchId=${created.batchId}`)

if (!created.batchId) {
  console.log('\n批次未创建，后续步骤跳过')
  process.exit(1)
}

/* ==================== 3) 回查详情 + 冗余字段 ==================== */
const detailRes = await api('GET', `/harvests/${created.batchId}`)
const detail = detailRes.json?.data ?? {}
created.batchNo = detail.batchNo
check(detailRes.json?.code === 0, '批次详情可回查', `code=${detailRes.json?.code}`)
check(Number(detail.quantity) === payload.quantity, '数量原样回查',
  `写入 ${payload.quantity} / 回查 ${detail.quantity}`)
check(Boolean(detail.plotName), '后端补齐了地块名称（冗余列）', `plotName=${detail.plotName}`)
check(String(detail.farmId) === String(FARM_ID), '后端从地块推导出农场', `farmId=${detail.farmId}`)
check(Boolean(detail.batchNo), '后端生成了批次号', `batchNo=${detail.batchNo}`)

/* ==================== 4) 直连库复核 ==================== */
const batchRow = mysql(
  `SELECT id,batch_no,plot_id,quantity,status,inbound_status,deleted,tenant_id,remark
   FROM agri_production.agri_prod_harvest_batch WHERE id=${created.batchId}`,
)
check(batchRow.startsWith(String(created.batchId)), '批次已落库（直连 MySQL 复核）', batchRow)
const batchAlive = mysql(
  `SELECT COUNT(*) FROM agri_production.agri_prod_harvest_batch WHERE id=${created.batchId} AND deleted=0`,
)
check(batchAlive === '1', '批次未被标记逻辑删除（deleted=0）', `count=${batchAlive}`)

/* ==================== 5) 生成批次 / 溯源码 ==================== */
const genRes = await api('POST', `/harvests/${created.batchId}/generate`, { warehouseName: '主仓库' })
const genBody = genRes.json?.data ?? {}
check(genRes.json?.code === 0, '生成批次接口返回成功', `code=${genRes.json?.code}`)
check(Boolean(genBody.traceCode), '返回了溯源码', `traceCode=${genBody.traceCode}`)
const traceRow = mysql(
  `SELECT trace_code,trace_generated FROM agri_production.agri_prod_harvest_batch WHERE id=${created.batchId}`,
)
check(traceRow.includes(String(genBody.traceCode ?? '\u0000')), '溯源码已落库', traceRow)
check(traceRow.trim().endsWith('\t1'), 'trace_generated 置为 1', traceRow)

/* ==================== 6) 成品入库 ==================== */
const inQty = 300
const stockInRes = await api('POST', '/harvests/inventory/in', {
  batchId: created.batchId,
  warehouseName: '主仓库',
  quantity: inQty,
  unit: 'kg',
  operatorName: 'e2e',
})
check(stockInRes.json?.code === 0 && stockInRes.json?.data === true, '成品入库接口返回成功',
  `code=${stockInRes.json?.code} data=${stockInRes.json?.data}`)

const invListRes = await api('GET', `/harvests/inventory?pageNum=1&pageSize=50&batchId=${created.batchId}`)
const invRows = invListRes.json?.data?.records ?? invListRes.json?.data?.list ?? []
const inv = invRows.find((row) => String(row.batchId) === String(created.batchId)) ?? invRows[0]
check(Boolean(inv), '入库后能查到库存记录', `records=${invRows.length}`)
created.inventoryId = inv?.inventoryId ?? inv?.id
// 库存数量的字段是 currentQty（列名 current_qty），不是 quantity —— 别按直觉写
check(Number(inv?.currentQty) === inQty, '库存数量等于入库数量',
  `入库 ${inQty} / 库存 ${inv?.currentQty}`)

const invRow = created.inventoryId
  ? mysql(
      `SELECT id,batch_id,current_qty,warehouse_name,deleted FROM agri_production.agri_prod_inventory WHERE id=${created.inventoryId}`,
    )
  : ''
check(invRow.startsWith(String(created.inventoryId ?? '\u0000')), '库存记录已落库（直连 MySQL 复核）', invRow)
const invAlive = created.inventoryId
  ? mysql(`SELECT COUNT(*) FROM agri_production.agri_prod_inventory WHERE id=${created.inventoryId} AND deleted=0`)
  : ''
check(invAlive === '1', '库存记录未被逻辑删除（deleted=0）', `count=${invAlive}`)

const inFlow = mysql(
  `SELECT flow_type,quantity FROM agri_production.agri_prod_inventory_flow WHERE batch_id=${created.batchId} ORDER BY id`,
)
check(inFlow.length > 0, '入库流水已写入', inFlow.split('\n')[0] ?? '')

/* ==================== 7) 出库 ==================== */
const outQty = 120
const outRes = await api(
  'POST',
  `/harvests/inventory/${created.batchId}/out?qty=${outQty}&operatorName=e2e`,
)
check(outRes.json?.code === 0, '出库接口返回成功',
  `code=${outRes.json?.code} msg=${outRes.json?.message ?? ''}`)

const invAfter = await api('GET', `/harvests/inventory?pageNum=1&pageSize=50&batchId=${created.batchId}`)
const afterRows = invAfter.json?.data?.records ?? invAfter.json?.data?.list ?? []
const invAfterRow = afterRows.find((row) => String(row.batchId) === String(created.batchId)) ?? afterRows[0]
check(Number(invAfterRow?.currentQty) === inQty - outQty, '出库后库存数量正确扣减',
  `期望 ${inQty - outQty} / 实际 ${invAfterRow?.currentQty}`)

const flows = await api('GET', `/harvests/${created.batchId}/flows?pageNum=1&pageSize=50`)
const flowRows = flows.json?.data?.records ?? flows.json?.data?.list ?? []
check(flowRows.length >= 2, '批次流水至少两条（入库 + 出库）', `flows=${flowRows.length}`)

/* ==================== 8) 清理 ==================== */
if (!KEEP) {
  const delInv = created.inventoryId
    ? await api('DELETE', `/harvests/inventory/${created.inventoryId}`)
    : { json: { code: 0 } }
  const delBatch = await api('DELETE', `/harvests/${created.batchId}`)
  // 流水没有删除端点，直接按批次精确清理（只删本次造的这一批）
  mysql(`DELETE FROM agri_production.agri_prod_inventory_flow WHERE batch_id=${created.batchId}`)
  console.log(
    `\n清理：批次 ${created.batchNo}(${created.batchId}) delete code=${delBatch.json?.code}` +
      ` / 库存 delete code=${delInv.json?.code} / 流水已按 batch_id 清理`,
  )
} else {
  console.log(`\n已保留本次数据：批次 ${created.batchNo}（id=${created.batchId}）`)
}

/* ==================== 汇总 ==================== */
console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log(`  - ${item}`))
process.exit(1)
