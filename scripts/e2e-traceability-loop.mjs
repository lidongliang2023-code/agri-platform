#!/usr/bin/env node
/**
 * S2B2C 商品绑定生产批次与消费者溯源 API 回归。
 *
 * 覆盖：
 * 1. 供应商只能看到当前经营主体的生产批次；
 * 2. 非本主体批次绑定被拒绝；
 * 3. 商品创建后按商品查询溯源链路；
 * 4. 按溯源码查询与按商品查询使用同一生产链路；
 * 5. 查无此码返回 404；
 * 6. 商品解绑、重新绑定及编辑档案回读；
 * 7. 测试商品和关联记录最终清理。
 *
 * 用法：node scripts/e2e-traceability-loop.mjs
 */
import { execFileSync } from 'node:child_process'

const CORE = process.env.E2E_CORE_URL ?? 'http://localhost:8093'
const S2B2C = process.env.E2E_S2B2C_URL ?? 'http://localhost:8088'
const PROD = process.env.E2E_PROD_URL ?? 'http://localhost:8092'
const MYSQL = process.env.E2E_MYSQL ?? 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const PASSWORD = process.env.AGRI_DEMO_PASSWORD ?? 'Admin@123'
const SUPPLIER_USER = process.env.E2E_SUPPLIER_USER ?? 'lvyuanshop'
const BATCH_NO = process.env.E2E_BATCH_NO ?? 'H20260601'
const TRACE_CODE = process.env.E2E_TRACE_CODE ?? 'AG010101202606010001'

const failures = []
let createdProductId = ''
const check = (ok, label, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${extra ? ` [${extra}]` : ''}`)
  if (!ok) failures.push(label)
}

const sql = (statement) => {
  try {
    return execFileSync(MYSQL, [
      '-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', statement,
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
  } catch (error) {
    throw new Error(`MySQL 查询失败：${String(error?.message ?? error).slice(0, 180)}`)
  }
}

const request = async (base, path, options = {}, token = '') => {
  const headers = {
    Accept: 'application/json',
    ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers ?? {}),
  }
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal ?? AbortSignal.timeout(20000),
  })
  const text = await response.text()
  let body
  try { body = text ? JSON.parse(text) : {} } catch { body = { raw: text.slice(0, 200) } }
  return { status: response.status, body }
}

const login = async (username) => {
  const result = await request(CORE, '/api/v1/auth/login', {
    method: 'POST',
    body: { username, password: PASSWORD, marketId: 1 },
  })
  return result.body?.data?.accessToken ?? ''
}

const recordsOf = (body) => body?.records ?? body?.data?.records ?? body?.data?.list ?? body?.list ?? []
const responseMessage = (result) => String(result.body?.message ?? result.body?.data?.message ?? result.body?.raw ?? '')
const productName = `E2E 溯源回归商品-${Date.now()}`

try {
  console.log('== 登录与当前主体批次 ==')
  const supplierToken = await login(SUPPLIER_USER)
  const adminToken = await login('admin')
  check(Boolean(supplierToken), `${SUPPLIER_USER} 登录成功（供应商账号身份校验）`)
  check(Boolean(adminToken), 'admin 登录成功（平台运营与消费者端读取）')
  if (!supplierToken || !adminToken) throw new Error('登录失败，无法继续')

  const supplySourceId = process.env.E2E_SUPPLY_SOURCE_ID
    ?? sql("SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE credit_code = '91440300MA5XXXXX0X' ORDER BY id LIMIT 1")
  check(/^\d+$/.test(String(supplySourceId)), '找到主体 2001 对应货源档案', String(supplySourceId))
  if (!/^\d+$/.test(String(supplySourceId))) throw new Error('未找到货源档案，无法执行平台供货接口')
  const supplyHeaders = { 'X-Supply-Source-Id': String(supplySourceId) }
  const supply = (path, options = {}) => request(S2B2C, path,
    { ...options, headers: { ...supplyHeaders, ...(options.headers ?? {}) } }, adminToken)

  const batchResult = await supply('/api/platform/supply/production-batches')
  const batches = recordsOf(batchResult.body)
  check(batchResult.status === 200 && Array.isArray(batches), '供应商读取可绑定生产批次', `HTTP ${batchResult.status} / ${batches.length} 条`)
  check(batches.some((row) => String(row.batchNo) === BATCH_NO), '候选批次包含目标真实批次', BATCH_NO)
  check(batches.every((row) => row.cropName !== undefined), '批次候选带作物字段')

  console.log('\n== 跨主体绑定拦截 ==')
  const foreign = await supply('/api/platform/supply/product/create', {
    method: 'POST',
    body: {
      name: `E2E 越权绑定-${Date.now()}`,
      categoryId: 11,
      price: 9.9,
      stock: 10,
      unit: 'kg',
      origin: '测试产地',
      prodBatchNo: 'H_NOT_MINE_9999',
    },
  })
  check(foreign.status === 400 && /不在你所属经营主体|批次不存在|只能绑定/.test(responseMessage(foreign)),
    '不属于当前主体的批次绑定被拒绝', `HTTP ${foreign.status} ${responseMessage(foreign).slice(0, 80)}`)

  console.log('\n== 创建绑定商品并读取溯源 ==')
  const created = await supply('/api/platform/supply/product/create', {
    method: 'POST',
    body: {
      name: productName,
      categoryId: 11,
      price: 12.9,
      stock: 50,
      unit: 'kg',
      origin: '陕西洛川',
      prodBatchNo: BATCH_NO,
      sellingPoint: '溯源回归测试',
      detail: '测试结束后自动清理',
    },
  })
  createdProductId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE name = '${productName}' ORDER BY id DESC LIMIT 1`)
  check(created.status === 200 && created.body?.success === true && /^\d+$/.test(createdProductId),
    '创建商品并绑定生产批次', `HTTP ${created.status} product=${createdProductId}`)
  check(sql(`SELECT prod_batch_no FROM agri_s2b2c.s2b2c_product WHERE id = '${createdProductId}'`) === BATCH_NO,
    '商品表真实落库绑定批次', BATCH_NO)

  const productTrace = await request(S2B2C, `/api/consumer/trace/${createdProductId}`, {}, adminToken)
  const productTraceBody = productTrace.body
  check(productTrace.status === 200 && productTraceBody.bound === true && productTraceBody.matched === true,
    '按商品查询命中生产溯源链路', `HTTP ${productTrace.status}`)
  check(String(productTraceBody.batchNo) === BATCH_NO, '商品溯源返回绑定批次号', String(productTraceBody.batchNo))
  const productStages = Array.isArray(productTraceBody.stages) ? productTraceBody.stages : []
  check(productStages.includes('planting'), '商品链路包含种植节点', productStages.join(','))
  check(productStages.includes('harvest'), '商品链路包含采收节点', productStages.join(','))
  check(Array.isArray(productTraceBody.nodes) && productTraceBody.nodes.length > 0,
    '商品链路返回真实节点', `节点 ${productTraceBody.nodes?.length ?? 0}`)

  const codeTrace = await request(S2B2C, `/api/consumer/trace/code/${TRACE_CODE}`, {}, adminToken)
  const codeBody = codeTrace.body
  check(codeTrace.status === 200 && codeBody.bound === true && codeBody.matched === true,
    '按溯源码查询命中生产链路', `HTTP ${codeTrace.status}`)
  check(String(codeBody.batchNo) === BATCH_NO, '按码查询返回同一批次', String(codeBody.batchNo))
  const codeStages = Array.isArray(codeBody.stages) ? codeBody.stages : []
  // 按码接口会额外补一个 trace 展示节点；它不是生产环节，比较时只核对生产节点集合。
  const comparableCodeStages = codeStages.filter((stage) => stage !== 'trace')
  const sameStages = comparableCodeStages.length === productStages.length
    && comparableCodeStages.every((stage) => productStages.includes(stage))
  check(sameStages, '按商品与按码的环节集合一致', `${productStages.join(',')} / ${codeStages.join(',')}`)
  check((codeBody.codes ?? []).some((item) => String(item.code) === TRACE_CODE),
    '按码结果带回目标溯源码')

  const missingCode = await request(S2B2C, '/api/consumer/trace/code/AG_NOT_A_REAL_CODE', {}, adminToken)
  check(missingCode.status === 404 && missingCode.body?.matched === false,
    '不存在的溯源码返回 404 且 matched=false', `HTTP ${missingCode.status}`)

  const unbound = await request(S2B2C, '/api/consumer/trace/3', {}, adminToken)
  check(unbound.status === 200 && unbound.body?.bound === false && Array.isArray(unbound.body?.nodes),
    '未绑定商品明确返回 bound=false', String(unbound.body?.reason ?? '').slice(0, 60))

  console.log('\n== 解绑、回绑与编辑档案 ==')
  const ownSupplier = sql(`SELECT supplier_id FROM agri_s2b2c.s2b2c_product WHERE id = '${createdProductId}'`)
  const updateBody = (batchNo) => ({
    id: String(createdProductId),
    supplierId: String(ownSupplier),
    name: productName,
    categoryId: 11,
    price: 12.9,
    stock: 50,
    unit: 'kg',
    origin: '陕西洛川',
    prodBatchNo: batchNo,
  })
  const unbind = await supply('/api/platform/supply/product/update', {
    method: 'PUT', body: updateBody(''),
  })
  const storedAfterUnbind = sql(`SELECT COALESCE(prod_batch_no, '<NULL>') FROM agri_s2b2c.s2b2c_product WHERE id = '${createdProductId}'`)
  check(unbind.status === 200 && unbind.body?.success === true && storedAfterUnbind === '<NULL>',
    '解绑后商品表批次为空', `${storedAfterUnbind} / ${responseMessage(unbind)}`)

  const rebound = await supply('/api/platform/supply/product/update', {
    method: 'PUT', body: updateBody(BATCH_NO),
  })
  check(rebound.status === 200 && rebound.body?.success === true && String(rebound.body?.prodBatchNo) === BATCH_NO,
    '重新绑定并在响应中回显批次', `prodBatchNo=${rebound.body?.prodBatchNo}`)

  const detail = await supply(`/api/platform/supply/product/${createdProductId}`)
  check(detail.status === 200 && String(detail.body?.id) === String(createdProductId)
    && String(detail.body?.prodBatchNo) === BATCH_NO,
    '编辑页读取商品自身档案并带回批次', `HTTP ${detail.status}`)

  const foreignId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id <> '${ownSupplier}' ORDER BY id LIMIT 1`)
  if (foreignId) {
    const foreignDetail = await supply(`/api/platform/supply/product/${foreignId}`)
    check(foreignDetail.status === 404, '读取其他主体商品返回 404', `HTTP ${foreignDetail.status}`)
  } else {
    check(true, '无可用的其他主体商品，跳过跨主体详情探测')
  }

  console.log('\n== 生产公开接口冒烟 ==')
  const publicBatch = await request(PROD, `/api/v1/production/trace/public/batch/${BATCH_NO}`)
  check(publicBatch.status === 200 && publicBatch.body?.code === 0,
    '生产侧公开批次核验接口可用', `HTTP ${publicBatch.status}`)
  const publicCode = await request(PROD, `/api/v1/production/trace/public/verify/${TRACE_CODE}`)
  check(publicCode.status === 200 && publicCode.body?.code === 0,
    '生产侧公开溯源码核验接口可用', `HTTP ${publicCode.status}`)
} catch (error) {
  check(false, '溯源回归脚本未发生未处理异常', String(error?.message ?? error).slice(0, 240))
} finally {
  if (/^\d+$/.test(createdProductId)) {
    try {
      sql(`DELETE FROM agri_s2b2c.s2b2c_footprint WHERE product_id = '${createdProductId}';`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${createdProductId}';`)
      const left = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_product WHERE id = '${createdProductId}'`)
      check(left === '0', '清理本次测试商品', `剩余 ${left} 行`)
    } catch (error) {
      check(false, '清理本次测试商品', String(error?.message ?? error).slice(0, 160))
    }
  }
}

console.log(`\n失败 ${failures.length} 项`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
