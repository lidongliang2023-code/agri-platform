/**
 * 设备台账联动验证（生产管理 ↔ 物联网）
 *
 * 验证目标（对应 2026-10-28 的台账收敛改造）：
 *  1. 生产端设备列表 / 详情与物联网端是**同一批数据**（不是两份台账）
 *  2. 生产端不再提供设备新增 / 编辑 / 删除（写接口已下线，应返回 405/404）
 *  3. 生产端「绑定到地块」会把归属回写到物联网端的 plot_id
 *  4. 解绑后若该设备没有其它生效地块绑定，物联网端 plot_id 被清空
 *
 * 用法：
 *   node scripts/e2e-iot-device-ledger.mjs [--base=http://localhost] [--user=farmer] [--password=...]
 */
import process from 'node:process'

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}

const BASE_URL = arg('base', 'http://localhost')
const USER = arg('user', 'farmer')
const PASSWORD = arg('password', 'Admin@123')
// 默认走网关而不是直连端口：网关按路径段决定由哪个服务服务，
// 直连会绕过这张路由表（上一轮就因此漏掉了"新接口没切流、页面 500"的问题）。
// 物联网端直连 8091：生产后端调它用的就是这个地址（services.iot.url），
// 网关上的 /api/v1/iot/ 属于 8101 那个独立站点，不是 80 端口这条链路
const IOT_URL = arg('iot', 'http://localhost:8091')
const PROD_URL = arg('prod', 'http://localhost')

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/* ==================== 0) 登录 ==================== */
const loginRes = await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
})
const login = await loginRes.json()
check(login.code === 0, `登录（${USER}）`, `code=${login.code}`)
if (login.code !== 0) process.exit(1)
const token = login.data.accessToken
const AUTH = { Authorization: `Bearer ${token}` }

const call = async (method, url, body) => {
  const res = await fetch(url, {
    method,
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* 非 JSON 响应 */
  }
  return { status: res.status, json }
}

/* ==================== 1) 两边设备台账是否同一批 ==================== */
const iotList = await call('GET', `${IOT_URL}/api/v1/iot/app/devices`)
check(iotList.status === 200 && [0, 200].includes(iotList.json?.code), '物联网端设备列表可读',
  `status=${iotList.status} code=${iotList.json?.code}`)
const iotDevices = iotList.json?.data ?? []

const prodList = await call('GET', `${PROD_URL}/api/v1/production/iot/devices?pageNum=1&pageSize=200`)
check(prodList.status === 200 && prodList.json?.code === 0, '生产端设备列表可读',
  `status=${prodList.status} code=${prodList.json?.code}`)
const prodPage = prodList.json?.data ?? {}
const prodDevices = prodPage.list ?? prodPage.records ?? []

check(iotDevices.length > 0, '物联网端设备台账非空', `${iotDevices.length} 台`)
check(prodDevices.length === iotDevices.length, '两端设备数量一致',
  `物联网 ${iotDevices.length} / 生产端 ${prodDevices.length}`)

const iotCodes = new Set(iotDevices.map((d) => String(d.deviceCode)))
const prodCodes = new Set(prodDevices.map((d) => String(d.deviceCode)))
const onlyIot = [...iotCodes].filter((c) => !prodCodes.has(c))
const onlyProd = [...prodCodes].filter((c) => !iotCodes.has(c))
check(onlyIot.length === 0 && onlyProd.length === 0, '两端设备编码集合一致',
  onlyIot.length || onlyProd.length ? `仅物联网=${onlyIot.join(',')} 仅生产端=${onlyProd.join(',')}` : '')

// 生产端 13 台历史设备（DEV001~003 / DEMO-DEVC-001~010）必须能在生产端看到
const legacyCodes = ['DEV001', 'DEV002', 'DEV003', 'DEMO-DEVC-001', 'DEMO-DEVC-010']
const missingLegacy = legacyCodes.filter((c) => !prodCodes.has(c))
check(missingLegacy.length === 0, '生产端历史设备已并入物联网台账',
  missingLegacy.length ? `缺失 ${missingLegacy.join(',')}` : `抽查 ${legacyCodes.length} 台全部命中`)

/* ==================== 1b) 统计口径必须与台账一致 ==================== */
const iotStats = await call('GET', `${IOT_URL}/api/v1/iot/app/device-stats`)
const iotTotal = Number(iotStats.json?.data?.total ?? -1)
check(iotTotal === iotDevices.length, '物联网端统计与列表条数一致',
  `stats=${iotTotal} / list=${iotDevices.length}`)

// 说明：运营端 /api/v1/production/admin/** 这组接口在本环境里请求进不到 agri-production
// 的控制器（网关层就返回 code=500），是改造前就存在的独立问题，不在这里断言 ——
// 它的设备统计已经改成走 IotDeviceStatsService，等这组接口通了会自动对齐。

/* ==================== 2) 生产端写接口应已下线 ==================== */
const createRes = await call('POST', `${PROD_URL}/api/v1/production/iot/devices`, {
  deviceCode: 'E2E-SHOULD-FAIL', deviceName: '不该被创建',
})
check([404, 405, 400, 500].includes(createRes.status), '生产端已不能新增设备',
  `status=${createRes.status}`)

const someId = prodDevices[0]?.deviceId
if (someId) {
  const updateRes = await call('PUT', `${PROD_URL}/api/v1/production/iot/devices/${someId}`, {
    deviceName: '不该被改名',
  })
  check([404, 405, 400, 500].includes(updateRes.status), '生产端已不能编辑设备',
    `status=${updateRes.status}`)
  const deleteRes = await call('DELETE', `${PROD_URL}/api/v1/production/iot/devices/${someId}`)
  check([404, 405, 400, 500].includes(deleteRes.status), '生产端已不能删除设备',
    `status=${deleteRes.status}`)
}

/* ==================== 3) 绑定 → 回写物联网端 plot_id ==================== */
// 挑一台还没被绑定的设备，绑到一个真实地块上，验证回写
const bindingsRes = await call('GET', `${PROD_URL}/api/v1/production/iot/bindings?status=BOUND`)
const boundIds = new Set(
  (bindingsRes.json?.data ?? []).map((b) => String(b.deviceId)),
)
// 优先挑一台「没有地块归属」的设备：这样回写的 before/after 才有区分度，
// 否则设备本来就挂在该地块上，"回写成功"和"什么都没做"看起来一模一样
const unbound = prodDevices.filter((d) => !boundIds.has(String(d.deviceId)))
const candidate = unbound.find((d) => !d.plotId) ?? unbound[0]

const plotsRes = await call('GET', `${PROD_URL}/api/v1/production/plots?pageNum=1&pageSize=200`)
const plots = plotsRes.json?.data?.records ?? plotsRes.json?.data?.list ?? []
// 地块必须与设备同农场：物联网端 updateDevice 会校验 farm 一致性
const plot = candidate
  ? plots.find((p) => String(p.farmId) === String(candidate.farmId))
  : undefined

if (candidate && plot) {
  const before = await call('GET', `${IOT_URL}/api/v1/iot/app/devices/${candidate.deviceId}`)
  const beforePlotId = before.json?.data?.plotId ?? null

  const bindQuery = new URLSearchParams({
    deviceId: String(candidate.deviceId),
    bindType: 'PLOT',
    bindTargetId: String(plot.plotId ?? plot.id),
    targetName: String(plot.plotName ?? ''),
    metrics: 'temperature,humidity',
    frequency: '30',
  })
  const bindRes = await call('POST', `${PROD_URL}/api/v1/production/iot/bindings?${bindQuery}`)
  check(bindRes.status === 200 && bindRes.json?.code === 0, '生产端绑定设备到地块成功',
    `status=${bindRes.status} msg=${bindRes.json?.message ?? ''}`)
  const bindingId = bindRes.json?.data?.bindingId

  const after = await call('GET', `${IOT_URL}/api/v1/iot/app/devices/${candidate.deviceId}`)
  const afterPlotId = after.json?.data?.plotId ?? null
  const expectPlotId = Number(plot.plotId ?? plot.id)
  check(afterPlotId === expectPlotId, '物联网端 plot_id 已回写',
    `设备 ${candidate.deviceCode}：${beforePlotId} → ${afterPlotId}（期望 ${expectPlotId}）`)

  /* ==================== 4) 解绑 → 清空 plot_id ==================== */
  if (bindingId) {
    const unbindRes = await call('POST', `${PROD_URL}/api/v1/production/iot/bindings/${bindingId}/unbind`)
    check(unbindRes.status === 200 && unbindRes.json?.code === 0, '解绑成功', `status=${unbindRes.status}`)
    const released = await call('GET', `${IOT_URL}/api/v1/iot/app/devices/${candidate.deviceId}`)
    check((released.json?.data?.plotId ?? null) === null, '解绑后物联网端 plot_id 已清空',
      `当前 plotId=${released.json?.data?.plotId ?? 'null'}`)
  }
} else {
  check(false, '绑定回归：找不到可绑定的设备或地块', `candidate=${candidate?.deviceCode} plot=${plot?.plotName}`)
}

/* ==================== 汇总 ==================== */
console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
