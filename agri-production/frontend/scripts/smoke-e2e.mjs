/**
 * 端到端冒烟脚本（真机联调校验）
 *
 * 用途：后端 core-app 起来后，用它一次性校验「前端 api 层假设」与「后端真实契约」是否一致，
 * 覆盖：认证 / 分页结构 / 分页入参兼容 / create 返回 String / delete 返回 Void /
 *      状态流转 query 传参 / 土壤三个端点 / IoT 绑定与指令下发。
 *
 * 设计原则：
 * 1. **只读为主**：唯一写操作是「新建 → 改状态 → 删除」一条临时农场，且在 finally 中保证清理；
 *    指令下发会真实落一条指令记录（后端行为，不清理，避免影响他人联调数据）。
 * 2. 每条用例独立判定 PASS / FAIL / SKIP，任一条 FAIL 即 EXIT=1，便于接 CI。
 * 3. 环境解耦：BASE / 账号均可通过参数或环境变量覆盖，不写死本机端口。
 *
 * 用法：
 *   node scripts/smoke-e2e.mjs                       # 默认 http://127.0.0.1:8099
 *   node scripts/smoke-e2e.mjs http://127.0.0.1:8080 # 指定后端地址
 *   SMOKE_USER=admin SMOKE_PASS=xxx node scripts/smoke-e2e.mjs
 */
const BASE = process.argv[2] ?? process.env.SMOKE_BASE ?? 'http://127.0.0.1:8099'
const AUTH_URL = `${BASE}/api/v1/auth/login`
const API = `${BASE}/api/v1/production`
const CREDENTIALS = {
  username: process.env.SMOKE_USER ?? 'admin',
  password: process.env.SMOKE_PASS ?? 'Admin@123',
  marketId: Number(process.env.SMOKE_MARKET_ID ?? 1),
}

/** 用例结果集合 */
const results = []

/**
 * 记录一条用例结果
 * @param {'PASS'|'FAIL'|'SKIP'} status 结果
 * @param {string} name 用例名
 * @param {string} detail 说明
 * @returns {boolean} 是否 PASS
 */
function record(status, name, detail) {
  // 允许调用方直接传布尔断言结果，统一折算成 PASS / FAIL
  const normalized = typeof status === 'boolean' ? (status ? 'PASS' : 'FAIL') : status
  results.push({ status: normalized, name, detail })
  console.log(`  [${normalized}] ${name}${detail ? ` —— ${detail}` : ''}`)
  return normalized === 'PASS'
}

/**
 * 带超时与鉴权的 JSON 请求
 * @param {string} url 完整地址
 * @param {RequestInit & {raw?: boolean}} options fetch 选项
 * @param {string} [token] Bearer token
 * @returns {Promise<{ok: boolean, status: number, body: any}>} 响应
 */
async function call(url, options = {}, token = '') {
  const headers = { 'Content-Type': 'application/json', ...(options.headers ?? {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal })
    const text = await res.text()
    let body = null
    try {
      body = JSON.parse(text)
    } catch {
      body = text
    }
    return { ok: res.ok, status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * 从分页响应中取第一条记录的业务主键
 * @param {any} body 响应体
 * @param {string[]} idKeys 候选主键字段
 * @returns {string} 主键，取不到返回空串
 */
function pickFirstId(body, idKeys) {
  const records = body?.data?.records
  if (!Array.isArray(records) || records.length === 0) return ''
  for (const key of idKeys) {
    if (records[0][key]) return String(records[0][key])
  }
  return ''
}

async function main() {
  console.log(`端到端冒烟：${BASE}\n`)

  console.log('--- 认证 ---')
  const login = await call(AUTH_URL, { method: 'POST', body: JSON.stringify(CREDENTIALS) })
  const token = login.body?.data?.accessToken ?? ''
  if (!record(token ? 'PASS' : 'FAIL', '登录获取 accessToken', token ? '' : JSON.stringify(login.body))) {
    return false
  }

  console.log('\n--- 分页契约 ---')
  const page1 = await call(`${API}/farms?pageNum=1&pageSize=3`, {}, token)
  const data1 = page1.body?.data
  record(
    page1.body?.code === 0 && Array.isArray(data1?.records),
    'pageNum/pageSize 入参 + records 结构',
    `total=${JSON.stringify(data1?.total)}（运行时类型 ${typeof data1?.total}）`,
  )
  record(
    typeof data1?.total === 'string' || typeof data1?.total === 'number',
    'total/page/size 可被 normalizePageData 强转',
    `page=${JSON.stringify(data1?.page)} size=${JSON.stringify(data1?.size)}`,
  )

  const page2 = await call(`${API}/farms?page=2&size=7`, {}, token)
  const data2 = page2.body?.data
  record(
    String(data2?.size) === '7' && String(data2?.page) === '2',
    'page/size 入参同样被后端接受（兼容层无需改名）',
    `page=${JSON.stringify(data2?.page)} size=${JSON.stringify(data2?.size)}`,
  )

  console.log('\n--- create / 状态流转 / delete 契约（临时数据，finally 清理） ---')
  const farmCode = `SMOKE-${Date.now()}`
  let createdId = ''
  try {
    const created = await call(
      `${API}/farms`,
      {
        method: 'POST',
        body: JSON.stringify({
          farmCode,
          farmName: '冒烟临时农场',
          province: '湖北省',
          city: '武汉市',
          area: 10,
          status: 1,
        }),
      },
      token,
    )
    createdId = typeof created.body?.data === 'string' ? created.body.data : ''
    record(
      created.body?.code === 0 && typeof created.body?.data === 'string',
      'create 返回 String 主键（A 类契约）',
      `data=${JSON.stringify(created.body?.data)}`,
    )

    if (createdId) {
      const patched = await call(
        `${API}/farms/${createdId}/status?status=2`,
        { method: 'PATCH' },
        token,
      )
      record(
        patched.body?.code === 0 && patched.body?.data?.farmId === createdId,
        'PATCH 状态用 query 传参（P0 修复点）',
        `data.farmId=${patched.body?.data?.farmId ?? 'null'}`,
      )

      const patchedByBody = await call(
        `${API}/farms/${createdId}/status`,
        { method: 'PATCH', body: JSON.stringify({ status: 3 }) },
        token,
      )
      record(
        patchedByBody.body?.code !== 0,
        'PATCH 状态用 body 传参应失败（对照组）',
        `code=${patchedByBody.body?.code} message=${patchedByBody.body?.message ?? ''}`,
      )
    }
  } finally {
    if (createdId) {
      const removed = await call(`${API}/farms/${createdId}`, { method: 'DELETE' }, token)
      record(
        removed.body?.code === 0 && removed.body?.data === null,
        'delete 返回 Void / null（B 类契约）',
        `data=${JSON.stringify(removed.body?.data)}`,
      )
      const left = await call(`${API}/farms?pageNum=1&pageSize=50`, {}, token)
      const leftover = (left.body?.data?.records ?? []).some((r) => r.farmCode === farmCode)
      record(!leftover, '临时农场已清理，无脏数据残留', `farmCode=${farmCode}`)
    }
  }

  console.log('\n--- 地块土壤端点 ---')
  const plotId = pickFirstId((await call(`${API}/plots?pageNum=1&pageSize=1`, {}, token)).body, [
    'plotId',
  ])
  if (!plotId) {
    record('SKIP', '土壤三个端点', '无地块数据，跳过')
  } else {
    const soilPage = await call(`${API}/plots/${plotId}/soil?pageNum=1&pageSize=3`, {}, token)
    record(
      soilPage.body?.code === 0 && Array.isArray(soilPage.body?.data?.records),
      'GET /plots/{id}/soil 返回分页结构',
      `plotId=${plotId}`,
    )
    const soilLatest = await call(`${API}/plots/${plotId}/soil/latest`, {}, token)
    record(
      soilLatest.body?.code === 0 && (soilLatest.body?.data === null || typeof soilLatest.body?.data === 'object'),
      'GET /plots/{id}/soil/latest 无记录时返回 null',
      `data=${soilLatest.body?.data === null ? 'null' : 'object'}`,
    )
    const soilTests = await call(`${API}/plots/${plotId}/soil-tests`, {}, token)
    record(
      soilTests.body?.code === 0 && Array.isArray(soilTests.body?.data),
      'GET /plots/{id}/soil-tests 返回裸数组（不走分页归一化）',
      `isArray=${Array.isArray(soilTests.body?.data)}`,
    )
  }

  console.log('\n--- IoT ---')
  const bindings = await call(`${API}/iot/bindings`, {}, token)
  record(
    bindings.body?.code === 0 && Array.isArray(bindings.body?.data),
    'GET /iot/bindings 返回裸数组（破坏性变更已对齐）',
    `条数=${Array.isArray(bindings.body?.data) ? bindings.body.data.length : '-'}`,
  )

  const deviceId = pickFirstId(
    (await call(`${API}/iot/devices?pageNum=1&pageSize=1`, {}, token)).body,
    ['deviceId'],
  )
  if (!deviceId) {
    record('SKIP', 'IoT 指令下发', '无设备数据，跳过')
  } else {
    const command = await call(
      `${API}/iot/devices/${deviceId}/commands?commandType=REBOOT&operator=smoke-e2e`,
      { method: 'POST' },
      token,
    )
    const cmd = command.body?.data
    record(
      command.body?.code === 0 && typeof cmd?.commandId === 'string',
      'POST /iot/devices/{id}/commands（query 传参）落库指令',
      `status=${cmd?.status ?? '-'} receipt=${cmd?.receipt ?? '-'}`,
    )
    const list = await call(`${API}/iot/devices/${deviceId}/commands?limit=3`, {}, token)
    record(
      list.body?.code === 0 && Array.isArray(list.body?.data),
      'GET /iot/devices/{id}/commands 返回裸数组',
      `条数=${Array.isArray(list.body?.data) ? list.body.data.length : '-'}`,
    )
  }

  const failed = results.filter((r) => r.status === 'FAIL')
  const skipped = results.filter((r) => r.status === 'SKIP')
  console.log(
    `\n合计：${results.length} 条 ｜ PASS ${results.length - failed.length - skipped.length} ｜ FAIL ${failed.length} ｜ SKIP ${skipped.length}`,
  )
  return failed.length === 0
}

main()
  .then((ok) => {
    console.log(ok ? '\n冒烟全部通过 ✅' : '\n冒烟存在失败项 ❌')
    process.exit(ok ? 0 : 1)
  })
  .catch((error) => {
    console.error('\n冒烟脚本异常：', error?.message ?? error)
    process.exit(1)
  })
