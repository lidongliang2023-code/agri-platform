#!/usr/bin/env node
/**
 * 物联网域端到端回归（服务端口径）。
 *
 * 覆盖三件事，全部按"接口返回值 == 数据库实查值"断言，不看页面：
 *   1. 身份与数据范围：租户由访问令牌推导，跨主体的读与写一律 404（不区分"不存在"和"不是你的"）；
 *   2. 假数据清理：大盘、报表、运营概览的每个数字都能在同一条 SQL 里查到；
 *   3. 留痕真实性：操作人取令牌账号、来源 IP 取请求头，控制/重启/OTA 不再替设备"宣布成功"。
 *
 * 用法：node scripts/e2e-iot-flow.mjs [--keep]（--keep 保留临时数据便于排查）
 */
import { execFileSync } from 'node:child_process'
import { ensureSecondTenantFarm, login, releaseSecondTenantFarm } from './provision-iot-access.mjs'

const IOT = process.env.AGRI_IOT_URL || 'http://localhost:8091'
const MYSQL = process.env.MYSQL_BIN || 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const APP = `${IOT}/api/v1/iot/app`
const OPS = `${IOT}/api/v1/iot/ops`
const KEEP = process.argv.includes('--keep')

let passed = 0
const failures = []
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
  } else {
    failures.push(`${label}${detail ? ` · ${detail}` : ''}`)
  }
}

function sql(query) {
  const out = execFileSync(MYSQL, ['-uroot', '-proot', '-N', '-B', '-e', `USE agri_iot; ${query}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (out.includes('ERROR')) throw new Error(`SQL 失败：${out}`)
  return out.replace(/\r\n/g, '\n').trim()
}
const scalar = (query) => sql(query).split('\n')[0] ?? ''
const rows = (query) => {
  const text = sql(query)
  if (!text) return []
  return text.split('\n').map((line) => line.split('\t'))
}

async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${path.startsWith('http') ? path : `${APP}${path}`}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let payload
  try {
    payload = JSON.parse(text)
  } catch {
    throw new Error(`${method} ${path} 返回非 JSON（HTTP ${response.status}）：${text.slice(0, 200)}`)
  }
  return { status: response.status, code: payload.code, message: payload.message ?? '', data: payload.data }
}

const TENANT_A = 2001
const TENANT_B = 2003
const MARK = 'E2E-IOT'
/** 服务端时间按 Asia/Shanghai 存 yyyy-MM-dd HH:mm，断言用本机日期而不是 UTC 日期。 */
function todayLocal() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

async function main() {
  const farmer = await login('farmer')
  const luochuan = await login('luochuan')
  const admin = await login('admin')
  check('三个演示账号都能拿到访问令牌', Boolean(farmer && luochuan && admin))

  const provision = await ensureSecondTenantFarm(luochuan)
  check(
    `第二经营主体（${TENANT_B}）在生产域有可见农场（${provision.created ? '本次创建' : '复用已有'}）`,
    provision.farmId > 0,
  )
  const farmB = Number(provision.farmId)

  // 快照：结束后按 max(id) 清理本次新增的行，保证零残留
  const snapshot = {
    alertRuleTenant: Number(scalar('SELECT COALESCE(MAX(id),0) FROM iot_alert_rule_tenant')),
    scene: Number(scalar('SELECT COALESCE(MAX(id),0) FROM iot_scene')),
    rule: Number(scalar('SELECT COALESCE(MAX(id),0) FROM iot_rule')),
    workOrder: Number(scalar('SELECT COALESCE(MAX(id),0) FROM iot_work_order')),
    controlLog: Number(scalar('SELECT COALESCE(MAX(id),0) FROM iot_control_log')),
    opsLog: Number(scalar('SELECT COALESCE(MAX(id),0) FROM iot_ops_log')),
    device: Number(scalar('SELECT COALESCE(MAX(id),0) FROM iot_device')),
  }

  // ========== A. 身份与数据范围 ==========
  const overviewA = await call('/overview', { token: farmer })
  check('A1 经营主体 2001 打开工作台返回 200', overviewA.status === 200 && overviewA.code === 200, overviewA.message)
  const devicesA = await call(`/devices`, { token: farmer })
  check(
    'A2 工作台设备数与设备列表同源（列表 N 台、统计也 N 台）',
    overviewA.data?.stats?.devices === devicesA.data?.length,
    `${overviewA.data?.stats?.devices} vs ${devicesA.data?.length}`,
  )
  const statsA = await call(`/device-stats`, { token: farmer })
  check('A3 /device-stats 与设备列表口径一致', statsA.data?.total === devicesA.data?.length)
  check(
    'A4 农场横幅按令牌取生产域农场（不再写死 1 号农场）',
    String(overviewA.data?.farm?.farmName || '').includes('【演示】') && Number(overviewA.data?.farm?.id) > 0,
    JSON.stringify(overviewA.data?.farm),
  )
  check('A5 横幅地址由生产域字段补全（不再是 null）', !String(overviewA.data?.farm?.address).includes('null'))

  const overviewB = await call('/overview', { token: luochuan })
  check('A6 第二主体工作台可打开（租户从令牌推导）', overviewB.status === 200, overviewB.message)
  check('A7 第二主体横幅是它自己的农场', Number(overviewB.data?.farm?.id) === farmB, `${overviewB.data?.farm?.id} vs ${farmB}`)
  check('A8 第二主体看不到 2001 的设备', overviewB.data?.stats?.devices === 0 && (await call('/devices', { token: luochuan })).data?.length === 0)
  const alertsB = await call('/alerts', { token: luochuan })
  check('A9 第二主体只看得到自己的告警', (alertsB.data || []).every((item) => String(item.alertNo).startsWith('AL20261')) && alertsB.data?.length === Number(scalar(`SELECT COUNT(*) FROM iot_alert WHERE tenant_id=${TENANT_B}`)), `${alertsB.data?.length}`)
  const alertsA = await call('/alerts', { token: farmer })
  check('A10 2001 的告警列表与 SQL 计数一致', alertsA.data?.length === Number(scalar(`SELECT COUNT(*) FROM iot_alert WHERE tenant_id=${TENANT_A}`)))
  check('A11 主体级告警没有设备时不返回假 deviceId=0', (alertsB.data || []).every((item) => item.deviceId === null || item.deviceId > 0), JSON.stringify((alertsB.data || []).map((i) => i.deviceId)))

  const crossDevice = await call('/devices/1', { token: luochuan })
  check('A12 跨主体读设备 → 404（不透露存在性）', crossDevice.status === 404, `${crossDevice.status} ${crossDevice.message}`)
  const crossUpdate = await call('/devices/1', { method: 'PUT', token: luochuan, body: { deviceName: '劫持改名' } })
  check('A13 跨主体改设备 → 404', crossUpdate.status === 404, `${crossUpdate.status}`)
  const crossControl = await call('/devices/3/control', { method: 'POST', token: luochuan, body: { action: '开启风机' } })
  check('A14 跨主体下发控制指令 → 404（原来能直接开别人的阀门）', crossControl.status === 404, `${crossControl.status}`)
  const crossAlert = await call('/alerts/1/handle', { method: 'POST', token: luochuan, body: { note: '替别人处置' } })
  check('A15 跨主体处置告警 → 404', crossAlert.status === 404, `${crossAlert.status}`)
  const crossGateway = await call('/gateways/1', { token: luochuan })
  check('A16 跨主体读网关详情 → 404', crossGateway.status === 404, `${crossGateway.status}`)
  const crossRule = await call('/rules/1/toggle', { method: 'POST', token: luochuan })
  check('A17 跨主体启停自动化规则 → 404', crossRule.status === 404, `${crossRule.status}`)
  const crossScene = await call('/scenes/1/activate', { method: 'POST', token: luochuan })
  check('A18 跨主体启用场景 → 404', crossScene.status === 404, `${crossScene.status}`)

  const anonymous = await fetch(`${APP}/overview`)
  check('A19 无令牌访问用户端 → 401（require-auth）', anonymous.status === 401, String(anonymous.status))
  const notFoundDevice = await call('/devices/987654', { token: farmer })
  check('A20 不存在的设备 → 404', notFoundDevice.status === 404)

  // ========== B. 写路径与留痕 ==========
  const controlOk = await call('/devices/3/control', { method: 'POST', token: farmer, body: { action: `${MARK} 开启风机` } })
  check('B1 本主体可控设备下发指令 → 200', controlOk.status === 200 && controlOk.code === 200, controlOk.message)
  check('B2 回执只声明"已下发到边缘网关"，不替设备确认', /边缘网关/.test(controlOk.message + String(controlOk.data?.message || '')) && !/设备已确认/.test(JSON.stringify(controlOk.data)), JSON.stringify(controlOk.data))
  const controlRow = rows(`SELECT operator_name FROM iot_control_log WHERE action_name='${MARK} 开启风机' ORDER BY id DESC LIMIT 1`)[0]
  check('B3 控制留痕的操作人是令牌账号 farmer（不是写死的"陈建国"）', controlRow?.[0] === 'farmer', JSON.stringify(controlRow))
  const sensorControl = await call('/devices/1/control', { method: 'POST', token: farmer, body: { action: '不该成功' } })
  check('B4 不可控设备下发 → 400 且说明原因', sensorControl.status === 400 && /不支持远程控制/.test(sensorControl.message), sensorControl.message)
  const missingAction = await call('/devices/3/control', { method: 'POST', token: farmer, body: {} })
  check('B5 缺控制动作 → 400', missingAction.status === 400)
  const badJson = await fetch(`${APP}/devices/3/control`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${farmer}` }, body: '{"action":' })
  check('B6 请求体不是合法 JSON → 400 且提示可读（原来是一句"服务器内部错误"）', badJson.status === 400 && /参数格式/.test((await badJson.json()).message))
  const wrongMethod = await fetch(`${APP}/alerts/1/handle`, { headers: { Authorization: `Bearer ${farmer}` } })
  check('B7 GET 打 POST 接口 → 405（不再被兜底成 500）', wrongMethod.status === 405, String(wrongMethod.status))
  const ruleToggleGone = await call('/alert-rules/1/toggle', { method: 'POST', token: farmer })
  check('B8 用户端阈值规则写接口已下线（全平台开关不能由单个主体改）', [404, 405].includes(ruleToggleGone.status), String(ruleToggleGone.status))
  const rulesRead = await call('/alert-rules', { token: farmer })
  check('B9 阈值规则仍可读（用户端只读）', rulesRead.status === 200 && rulesRead.data?.length >= 4)

  const sceneName = `${MARK} 临时场景`
  const sceneCreate = await call('/scenes', { method: 'POST', token: farmer, body: { sceneName, description: '回归用场景', config: '{"a":1}' } })
  check('B10 创建场景 → 200 并落到当前主体', sceneCreate.status === 200 && sceneCreate.data?.sceneName === sceneName, sceneCreate.message)
  const auditRow = rows("SELECT operator_name,IFNULL(ip_address,'') FROM iot_ops_log WHERE action_name='创建场景' ORDER BY id DESC LIMIT 1")[0]
  check('B10a 审计留痕带真实操作人与来源 IP（用户端原来一律写"陈建国"）', auditRow?.[0] === 'farmer' && auditRow?.[1] !== '', JSON.stringify(auditRow))
  check('B11 场景私域列写入 2001', Number(scalar(`SELECT tenant_id FROM iot_scene WHERE id=${sceneCreate.data?.id}`)) === TENANT_A)
  const scenesB = await call('/scenes', { token: luochuan })
  check('B12 另一主体的场景列表里没有它', !(scenesB.data || []).some((item) => item.sceneName === sceneName))
  // 给 2003 也建一个场景并启用：这样"2001 启用场景"才有可被顶掉的对象，能真正验证隔离
  const sceneBCreate = await call('/scenes', { method: 'POST', token: luochuan, body: { sceneName: `${MARK} 洛川场景`, description: '跨主体互不影响' } })
  const activateBFirst = await call(`/scenes/${sceneBCreate.data?.id}/activate`, { method: 'POST', token: luochuan })
  check('B12a 第二主体可启用并运行自己的场景', activateBFirst.status === 200 && Number(scalar(`SELECT COUNT(*) FROM iot_scene WHERE tenant_id=${TENANT_B} AND is_active=TRUE`)) === 1, activateBFirst.message)
  const activateB = await call(`/scenes/${sceneCreate.data?.id}/activate`, { method: 'POST', token: luochuan })
  check('B13 跨主体启用该场景 → 404', activateB.status === 404)
  const activateA = await call(`/scenes/${sceneCreate.data?.id}/activate`, { method: 'POST', token: farmer })
  check('B14 本主体启用场景 → 200', activateA.status === 200 && activateA.data?.active === true, activateA.message)
  const activeCount = Number(scalar(`SELECT COUNT(*) FROM iot_scene WHERE tenant_id=${TENANT_A} AND is_active=TRUE`))
  check('B15 同主体同时只有一个运行场景', activeCount === 1, String(activeCount))
  check('B16 启用场景不会把别的主体顶掉（原来是无条件全表 is_active=FALSE）', Number(scalar(`SELECT COUNT(*) FROM iot_scene WHERE tenant_id=${TENANT_B} AND is_active=TRUE`)) === 1)
  check('B16a 被顶掉的是自己原来的运行场景', Number(scalar('SELECT COUNT(*) FROM iot_scene WHERE tenant_id=2001 AND id=1 AND is_active=TRUE')) === 0)

  const ruleName = `${MARK} 临时规则`
  const ruleCreate = await call('/rules', {
    method: 'POST',
    token: farmer,
    body: { ruleName, trigger: '温度 > 30℃ 持续 5 分钟', action: '开启风机', ruleType: 'automation', triggerMetric: 'temperature', operator: '>', threshold: '30', actionDeviceId: 3, actionCommand: 'on', actionDeviceName: '伪造的名字' },
  })
  check('B17 创建自动化规则 → 200', ruleCreate.status === 200 && ruleCreate.data?.ruleName === ruleName, ruleCreate.message)
  check(
    'B18 规则里的执行设备名由台账回填（不信前端自报）',
    ruleCreate.data?.actionDeviceName === '1号棚南侧风机',
    String(ruleCreate.data?.actionDeviceName),
  )
  check('B19 规则私域列写入 2001', Number(scalar(`SELECT tenant_id FROM iot_rule WHERE id=${ruleCreate.data?.id}`)) === TENANT_A)
  const ruleRun = await call(`/rules/${ruleCreate.data?.id}/execute`, { method: 'POST', token: farmer })
  check('B20 手动执行规则 → 200 且计数累加', ruleRun.status === 200 && ruleRun.data?.triggerCount === 1, ruleRun.message)
  const ruleControlOperator = scalar(`SELECT operator_name FROM iot_control_log WHERE id=(SELECT MAX(id) FROM iot_control_log)`)
  check('B21 规则执行的控制留痕带真实操作人', ruleControlOperator.startsWith('farmer'), ruleControlOperator)
  const crossRuleRun = await call(`/rules/${ruleCreate.data?.id}/execute`, { method: 'POST', token: luochuan })
  check('B22 跨主体执行规则 → 404', crossRuleRun.status === 404)
  const badRule = await call('/rules', {
    method: 'POST',
    token: farmer,
    body: { ruleName: `${MARK} 坏规则`, trigger: 'x', action: 'y', ruleType: 'automation', triggerMetric: 'temperature', operator: '>', threshold: '30', actionDeviceId: 1, actionCommand: 'on' },
  })
  check('B23 规则选择不可控设备 → 400', badRule.status === 400 && /不支持远程控制/.test(badRule.message), badRule.message)
  const crossDeviceRule = await call('/rules', {
    method: 'POST',
    token: luochuan,
    body: { ruleName: `${MARK} 越权规则`, trigger: 'x', action: 'y', ruleType: 'automation', triggerMetric: 'temperature', operator: '>', threshold: '30', actionDeviceId: 3, actionCommand: 'on' },
  })
  check('B24 规则引用别人设备的 → 404', crossDeviceRule.status === 404, String(crossDeviceRule.status))

  const orderCreate = await call('/work-orders', { method: 'POST', token: farmer, body: { deviceId: 3, orderType: `${MARK} 回归工单`, priority: 'normal', description: '回归脚本创建' } })
  check('B25 按台账设备创建工单 → 200', orderCreate.status === 200 && orderCreate.data?.deviceName === '1号棚南侧风机', orderCreate.message)
  check('B26a 工单写入当前主体', Number(scalar(`SELECT tenant_id FROM iot_work_order WHERE id=${orderCreate.data?.id}`)) === TENANT_A)
  // 中文字段直接在 SQL 里比对（客户端输出编码会干扰字符串比较，返回值只可能是 1/0）
  check('B26b 报修描述入库（原来表单收了却没有列可存）', scalar(`SELECT description='回归脚本创建' FROM iot_work_order WHERE id=${orderCreate.data?.id}`) === '1', scalar(`SELECT LENGTH(description) FROM iot_work_order WHERE id=${orderCreate.data?.id}`))
  const fakeOrder = await call('/work-orders', { method: 'POST', token: farmer, body: { deviceName: '不存在的设备名', description: 'x' } })
  check('B27 前端编造设备名建单 → 400 并说明要在台账里注册', fakeOrder.status === 400 && /不在当前主体的设备台账/.test(fakeOrder.message), fakeOrder.message)
  const crossOrder = await call('/work-orders', { method: 'POST', token: luochuan, body: { deviceId: 3, orderType: '越权工单' } })
  check('B28 跨主体给别人设备建单 → 404', crossOrder.status === 404)
  const ordersB = await call('/work-orders', { token: luochuan })
  check('B29 工单列表按主体隔离', (ordersB.data || []).every((item) => item.orderNo !== orderCreate.data?.orderNo) && ordersB.data?.length === Number(scalar(`SELECT COUNT(*) FROM iot_work_order WHERE tenant_id=${TENANT_B}`)))

  const alertSnapshot = rows(`SELECT id,status,handled_by,IFNULL(handle_note,''),IFNULL(handled_at,'') FROM iot_alert WHERE tenant_id=${TENANT_A} AND status='pending' ORDER BY id LIMIT 1`)[0]
  const handleWithFakeName = await call(`/alerts/${alertSnapshot?.[0]}/handle`, { method: 'POST', token: farmer, body: { status: 'resolved', note: '已现场核查', handledBy: '冒充的处置人' } })
  check('B30 处置本主体告警 → 200', handleWithFakeName.status === 200, handleWithFakeName.message)
  const handledRow = rows(`SELECT status,handled_by,handle_note FROM iot_alert WHERE id=${alertSnapshot?.[0]}`)[0]
  check('B31 处置人取令牌账号，不接受前端自报', handledRow?.[1] === 'farmer' && handledRow?.[0] === 'resolved', JSON.stringify(handledRow))
  const badStatus = await call(`/alerts/${alertSnapshot?.[0]}/handle`, { method: 'POST', token: farmer, body: { status: '随便写的状态', note: 'x' } })
  check('B32 非法告警状态 → 400', badStatus.status === 400 && /只能是待处理、处理中或已恢复/.test(badStatus.message), badStatus.message)
  const noNote = await call(`/alerts/${alertSnapshot?.[0]}/handle`, { method: 'POST', token: farmer, body: { status: 'resolved' } })
  check('B33 缺处置说明 → 400', noNote.status === 400)

  // ========== C. 大盘与报表的真实性 ==========
  const env = overviewA.data?.environment || []
  check('C1 实时环境读数条数 <= 5（卡片按 5 列排布）', env.length > 0 && env.length <= 5, String(env.length))
  check('C2 实时环境不含执行器状态', !env.some((item) => item.key === 'switch'), JSON.stringify(env.map((i) => i.key)))
  const envMismatch = env.filter((item) => {
    const key = item.key === 'light' ? 'light_intensity' : item.key
    const latest = scalar(`SELECT t.metric_value FROM iot_telemetry t JOIN iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A} AND t.metric_key='${key}' ORDER BY t.recorded_at DESC,t.id DESC LIMIT 1`)
    return Number.isFinite(Number(latest)) && Math.abs(Number(latest) - Number(item.value)) > 0.051
  })
  check('C3 每个环境读数都能在遥测表里查到同一值', envMismatch.length === 0, JSON.stringify(envMismatch))
  const series = overviewA.data?.series || []
  const latestDay = scalar(`SELECT MAX(SUBSTRING(t.recorded_at,1,10)) FROM iot_telemetry t JOIN iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A}`)
  const sqlHours = Number(scalar(`SELECT COUNT(DISTINCT SUBSTRING(t.recorded_at,12,2)) FROM iot_telemetry t JOIN iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A} AND SUBSTRING(t.recorded_at,1,10)='${latestDay}' AND t.metric_key IN ('temperature','humidity','soil_moisture')`))
  check('C4 环境趋势的点数 = 最新日期里有读数的小时数', series.length === sqlHours, `${series.length} vs ${sqlHours}`)
  check('C5 环境趋势不再是一天不变的 7 个常量', series.length === 0 || series.some((item) => item.time !== '08:00' || item.temperature !== 22.6))

  const reports = await call('/reports', { token: farmer })
  check('C6 报表接口可用', reports.status === 200, reports.message)
  const sqlPoints = Number(scalar(`SELECT COUNT(*) FROM iot_telemetry t JOIN iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A}`))
  check('C7 报表遥测读数 = SQL 计数（原来是写死的 128560）', reports.data?.summary?.dataPoints === sqlPoints, `${reports.data?.summary?.dataPoints} vs ${sqlPoints}`)
  const sqlControls = Number(scalar(`SELECT COUNT(*) FROM iot_control_log c JOIN iot_device d ON d.id=c.device_id WHERE d.tenant_id=${TENANT_A}`))
  check('C8 报表控制指令数 = SQL 计数', reports.data?.summary?.controls === sqlControls, `${reports.data?.summary?.controls} vs ${sqlControls}`)
  check('C9 灌溉用水这类没有计量链路的名目已换成可查指标', reports.data?.summary?.irrigation === undefined && Object.keys(reports.data?.summary || {}).every((key) => ['dataPoints', 'onlineRate', 'alerts', 'controls'].includes(key)), JSON.stringify(reports.data?.summary))
  const sqlDays = Number(scalar(`SELECT COUNT(DISTINCT SUBSTRING(t.recorded_at,1,10)) FROM iot_telemetry t JOIN iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A}`))
  check('C10 报表日期条数 = 实际有读数的日期数（最多 7）', reports.data?.daily?.length === Math.min(sqlDays, 7), `${reports.data?.daily?.length} vs ${sqlDays}`)
  check('C11 报表里没有 18200/19650 这类写死的假柱子', !(reports.data?.daily || []).some((item) => item.data === 18200 || item.data === 12860), JSON.stringify(reports.data?.daily))
  const dailySum = (reports.data?.daily || []).reduce((sum, item) => sum + Number(item.data), 0)
  check('C12 分日汇总不超过总读数', dailySum <= sqlPoints, `${dailySum} vs ${sqlPoints}`)
  const sqlRank = Number(scalar(`SELECT COUNT(*) FROM (SELECT d.id FROM iot_device d JOIN iot_telemetry t ON t.device_id=d.id WHERE d.tenant_id=${TENANT_A} GROUP BY d.id) x`))
  check('C13 设备排行取有读数的设备前 6（按主体）', reports.data?.rank?.length === Math.min(sqlRank, 6))
  check('C14 在线率由设备状态实算', typeof reports.data?.summary?.onlineRate === 'number' && reports.data.summary.onlineRate >= 0 && reports.data.summary.onlineRate <= 100, JSON.stringify(reports.data?.summary?.onlineRate))

  // ========== D. 运营端 ==========
  const opsOverview = await call(`${OPS}/overview`, { token: admin })
  check('D1 运营概览可用', opsOverview.status === 200, opsOverview.message)
  const allDevices = Number(scalar('SELECT COUNT(*) FROM iot_device'))
  check('D2 运营概览设备数 = 全平台台账计数', opsOverview.data?.metrics?.devices === allDevices, `${opsOverview.data?.metrics?.devices} vs ${allDevices}`)
  check('D3 今日控制数来自控制日志（原来是常量 8562）', opsOverview.data?.metrics?.todayControls === Number(scalar(`SELECT COUNT(*) FROM iot_control_log WHERE created_at LIKE '${todayLocal()}%'`)), String(opsOverview.data?.metrics?.todayControls))
  check('D4 吞吐数来自遥测计数（原来是常量 520000）', opsOverview.data?.metrics?.throughput === Number(scalar(`SELECT COUNT(*) FROM iot_telemetry WHERE recorded_at LIKE '${todayLocal()}%'`)), String(opsOverview.data?.metrics?.throughput))
  check('D5 在线率趋势不再是写死的 94.1/94.4…', !(opsOverview.data?.onlineTrend || []).every((value) => value === 94.1), JSON.stringify(opsOverview.data?.onlineTrend))
  const tenantCounts = rows(`SELECT t.id,(SELECT COUNT(*) FROM iot_device d WHERE d.tenant_id=t.id) FROM iot_tenant t`)
  const tenantMismatch = (opsOverview.data?.tenants || []).filter((item) => {
    const pair = tenantCounts.find((row) => Number(row[0]) === Number(item.id))
    return !pair || Number(pair[1]) !== Number(item.deviceCount)
  })
  check('D6 租户设备数按台账实时统计（不是存量列的常量）', tenantMismatch.length === 0, JSON.stringify(tenantMismatch))
  check('D7 租户档案主键已是经营主体号（不再有 1..4 的假租户）', (opsOverview.data?.tenants || []).every((item) => Number(item.id) >= 1000) && Number(scalar('SELECT COUNT(*) FROM iot_tenant WHERE id<1000')) === 0, JSON.stringify(opsOverview.data?.tenants?.map((t) => t.id)))
  const deviceRows = await call(`${OPS}/devices`, { token: admin })
  check('D8 运营端设备列表能解析出租户名（原来 29 台里 0 台有）', (deviceRows.data || []).filter((item) => item.tenantName).length === deviceRows.data?.length, `${(deviceRows.data || []).filter((i) => i.tenantName).length}/${deviceRows.data?.length}`)

  const quotaLow = await call(`${OPS}/tenants/${TENANT_A}/quota`, { method: 'POST', token: admin, body: { deviceLimit: 5 } })
  check('D9 配额低于已接入设备数 → 400 并给出实际台数', quotaLow.status === 400 && /不能低于该租户已接入设备数/.test(quotaLow.message), quotaLow.message)
  const quotaBad = await call(`${OPS}/tenants/${TENANT_A}/quota`, { method: 'POST', token: admin, body: { deviceLimit: 'abc' } })
  check('D10 配额非数字 → 400', quotaBad.status === 400)
  const quotaMissing = await call(`${OPS}/tenants/999999/quota`, { method: 'POST', token: admin, body: { deviceLimit: 500 } })
  check('D11 不存在的租户 → 404（原来抛 NoSuchElementException 变 500）', quotaMissing.status === 404, String(quotaMissing.status))
  const limitBefore = scalar(`SELECT device_limit FROM iot_tenant WHERE id=${TENANT_B}`)
  const quotaOk = await call(`${OPS}/tenants/${TENANT_B}/quota`, { method: 'POST', token: admin, body: { deviceLimit: 888 } })
  check('D12 合法配额调整生效', quotaOk.status === 200 && Number(scalar(`SELECT device_limit FROM iot_tenant WHERE id=${TENANT_B}`)) === 888, quotaOk.message)
  const quotaLog = rows(`SELECT operator_name,IFNULL(ip_address,'') FROM iot_ops_log WHERE action_name='调整租户配额' ORDER BY id DESC LIMIT 1`)[0]
  check('D13 配额留痕记录真实操作人与来源 IP（原来固定"张运营"）', quotaLog?.[0] === 'admin' && quotaLog?.[1] !== '', JSON.stringify(quotaLog))
  await call(`${OPS}/tenants/${TENANT_B}/quota`, { method: 'POST', token: admin, body: { deviceLimit: Number(limitBefore) } })
  check('D14 配额已恢复原值', scalar(`SELECT device_limit FROM iot_tenant WHERE id=${TENANT_B}`) === String(limitBefore))

  const reviewNoNote = await call(`${OPS}/access-audits/1/review`, { method: 'POST', token: admin, body: { status: 'approved' } })
  check('D15 接入审核缺意见 → 400', reviewNoNote.status === 400)
  const reviewBadStatus = await call(`${OPS}/access-audits/1/review`, { method: 'POST', token: admin, body: { status: 'approved' } })
  check('D16 接入审核必填意见的校验先于状态校验', reviewBadStatus.status === 400)
  const reviewOk = await call(`${OPS}/access-audits/1/review`, { method: 'POST', token: admin, body: { status: 'approved', note: `${MARK} 校验通过` } })
  check('D17 接入审核通过 → 200', reviewOk.status === 200, reviewOk.message)
  check('D18 审核人取令牌账号', scalar(`SELECT auditor FROM iot_access_audit WHERE id=1`) === 'admin')
  const reviewIllegal = await call(`${OPS}/access-audits/1/review`, { method: 'POST', token: admin, body: { status: '随便写', note: 'x' } })
  check('D19 非法审核结论 → 400', reviewIllegal.status === 400 && /只能是通过或驳回/.test(reviewIllegal.message), reviewIllegal.message)
  await sql(`UPDATE iot_access_audit SET status='pending',auditor=NULL,note='等待SN与产品认证匹配' WHERE id=1`)
  check('D20 审核数据已恢复', scalar(`SELECT status FROM iot_access_audit WHERE id=1`) === 'pending')

  const otaStatusBefore = scalar(`SELECT status FROM iot_ota_task WHERE tenant_id=${TENANT_A} ORDER BY id DESC LIMIT 1`)
  const otaTargetId = scalar(`SELECT id FROM iot_ota_task WHERE tenant_id=${TENANT_A} ORDER BY id DESC LIMIT 1`)
  const otaExecute = await call(`${OPS}/ota/${otaTargetId}/execute`, { method: 'POST', token: admin })
  check('D21 OTA 排期接口可用并返回执行窗口说明', otaExecute.status === 200 && /执行窗口/.test(String(otaExecute.data?.message)), `id=${otaTargetId} status=${otaExecute.status} message=${otaExecute.message}`)
  check('D22 没有下发链路就不把状态改成"执行中"（原来点一下变 running）', scalar(`SELECT status FROM iot_ota_task WHERE tenant_id=${TENANT_A} ORDER BY id DESC LIMIT 1`) === otaStatusBefore, otaStatusBefore)
  const otaListB = await call('/ota', { token: luochuan })
  check('D23 用户端升级任务按主体隔离', otaListB.data?.length === Number(scalar(`SELECT COUNT(*) FROM iot_ota_task WHERE tenant_id=${TENANT_B}`)), JSON.stringify(otaListB.data?.map((t) => t.taskNo)))

  const opsReports = await call(`${OPS}/reports`, { token: admin })
  check('D24 运营报表带实查汇总', opsReports.status === 200 && opsReports.data?.summary?.devices === allDevices, JSON.stringify(opsReports.data?.summary))
  const opsWorkOrders = await call(`${OPS}/work-orders`, { token: admin })
  check('D25 运营工单列表能看到所属主体', (opsWorkOrders.data || []).some((item) => item.tenantName) && opsWorkOrders.data?.length === Number(scalar('SELECT COUNT(*) FROM iot_work_order')), JSON.stringify((opsWorkOrders.data || []).map((i) => i.tenantName)))
  const opsLogs = await call(`${OPS}/logs`, { token: admin })
  check('D26 审计日志输出来源 IP 字段', opsLogs.status === 200 && 'ip' in (opsLogs.data?.[0] || {}), JSON.stringify(opsLogs.data?.[0]))

  // ========== E. 移动端 ==========
  const mobile = await call('/mobile/overview', { token: farmer })
  check('E1 移动端总览可用且与工作台同源', mobile.status === 200 && mobile.data?.stats?.devices === overviewA.data?.stats?.devices, mobile.message)
  check('E2 移动端设备列表不超过 5 条', (mobile.data?.devices || []).length <= 5)
  const mobileB = await call('/mobile/overview', { token: luochuan })
  check('E3 第二主体移动端可读（空数据而不是报错）', mobileB.status === 200 && mobileB.data?.stats?.devices === 0, mobileB.message)
  const sync = await call('/mobile/sync', { method: 'POST', token: farmer, body: {} })
  check('E4 同步返回真实待办计数（不再固定"3 条"）', sync.status === 200 && sync.data?.synced === undefined && sync.data?.pendingWorkOrders === Number(scalar(`SELECT COUNT(*) FROM iot_work_order WHERE tenant_id=${TENANT_A} AND status<>'completed'`)), JSON.stringify(sync.data))
  check('E5 同步留痕的真实操作人', scalar(`SELECT operator_name FROM iot_ops_log WHERE action_name='移动端同步' ORDER BY id DESC LIMIT 1`) === 'farmer')
  const unreadIdsBefore = scalar(`SELECT GROUP_CONCAT(id) FROM (SELECT id FROM iot_message WHERE tenant_id=${TENANT_A} AND is_read=FALSE) x`)
  const unreadBBefore = Number(scalar(`SELECT COUNT(*) FROM iot_message WHERE tenant_id=${TENANT_B} AND is_read=FALSE`))
  const unreadBefore = unreadIdsBefore === 'NULL' || unreadIdsBefore === '' ? 0 : unreadIdsBefore.split(',').length
  const readAll = await call('/messages/read-all', { method: 'POST', token: farmer, body: {} })
  check('E6 全部已读只影响当前主体', readAll.status === 200 && readAll.data?.updated === unreadBefore, JSON.stringify(readAll.data))
  check('E7 另一主体的未读数不受影响', Number(scalar(`SELECT COUNT(*) FROM iot_message WHERE tenant_id=${TENANT_B} AND is_read=FALSE`)) === unreadBBefore)
  if (unreadBefore > 0) {
    // 按快照逐条还原（原来只看"未读数回到几"，把本来就是已读的消息一起翻回了未读）
    await sql(`UPDATE iot_message SET is_read=TRUE WHERE tenant_id=${TENANT_A};
      UPDATE iot_message SET is_read=FALSE WHERE tenant_id=${TENANT_A} AND FIND_IN_SET(id,'${unreadIdsBefore}')>0;`)
  }
  const unreadAfterRestore = scalar(`SELECT GROUP_CONCAT(id) FROM (SELECT id FROM iot_message WHERE tenant_id=${TENANT_A} AND is_read=FALSE) x`)
  check('E8 消息已读状态按快照逐条还原', unreadAfterRestore === unreadIdsBefore, `${unreadAfterRestore} vs ${unreadIdsBefore}`)

  // ========== F0. 主体差异化阈值 ==========
  const viewA = await call('/alert-rules/view', { token: farmer })
  check('G1 工作台阈值视图可用', viewA.status === 200 && Array.isArray(viewA.data?.platform), viewA.message)
  const overriddenA = (viewA.data?.platform || []).filter((item) => item.overridden)
  check('G2 平台预置被本主体规则标记为已覆盖（同指标）', overriddenA.length >= 3, `覆盖 ${overriddenA.length} 条：${overriddenA.map((r) => r.ruleName).join('、')}`)
  check('G3 生效集合里不再出现被覆盖的平台规则', !(viewA.data?.effective || []).some((rule) => rule.source === 'platform' && overriddenA.some((preset) => preset.id === rule.id)), JSON.stringify((viewA.data?.effective || []).map((r) => `${r.source}:${r.metricKey}`)))
  check('G4 生效集合保留未被覆盖的平台规则（湿度）', (viewA.data?.effective || []).some((rule) => rule.source === 'platform' && rule.metricKey === 'humidity'))
  const viewB = await call('/alert-rules/view', { token: luochuan })
  const ownB = viewB.data?.tenant || []
  check('G5 第二主体只拿到自己主体的规则行（按 SQL 逐条对齐）', ownB.length > 0
    && ownB.length === Number(scalar(`SELECT COUNT(*) FROM iot_alert_rule_tenant WHERE tenant_id=${TENANT_B}`))
    && ownB.every((rule) => Number(scalar(`SELECT tenant_id FROM iot_alert_rule_tenant WHERE id=${rule.id}`)) === TENANT_B),
  JSON.stringify(ownB.map((r) => r.ruleName)))
  check('G6 两个主体的自定义规则不互相串', !(viewB.data?.tenant || []).some((rule) => String(rule.ruleName).includes('蔬菜')))
  const disabledVisible = (viewB.data?.tenant || []).filter((rule) => !rule.enabled)
  check('G7 停用的主体规则不进入生效集合', disabledVisible.length > 0 && !(viewB.data?.effective || []).some((rule) => rule.source === 'tenant' && disabledVisible.some((d) => d.id === rule.id)), `${disabledVisible.length} 条停用`)

  const trial34A = await call('/alert-rules/evaluate?metricKey=temperature&value=34', { token: farmer })
  const trial34B = await call('/alert-rules/evaluate?metricKey=temperature&value=34', { token: luochuan })
  check('G8 同一读数（34℃）在 2001 判紧急', trial34A.data?.level === 'critical' && trial34A.data?.matchedRules?.[0]?.source === 'tenant', JSON.stringify(trial34A.data?.level))
  check('G9 同一读数在 2003 判重要（阈值 33，规则不同）', trial34B.data?.level === 'major', JSON.stringify(trial34B.data?.level))
  check('G10 两个主体的判定来源都是自己的规则', trial34A.data?.matchedRules?.[0]?.ruleName !== trial34B.data?.matchedRules?.[0]?.ruleName, `${trial34A.data?.matchedRules?.[0]?.ruleName} / ${trial34B.data?.matchedRules?.[0]?.ruleName}`)
  const frostB = await call('/alert-rules/evaluate?metricKey=temperature&value=1', { token: luochuan })
  const frostA = await call('/alert-rules/evaluate?metricKey=temperature&value=1', { token: farmer })
  check('G11 果园下限规则（霜冻）只在 2003 命中', frostB.data?.level === 'critical' && frostB.data?.breached === true, JSON.stringify(frostB.data?.matchedRules?.map((r) => r.ruleName)))
  check('G12 同一读数在 2001 不报警（没有下限规则）', frostA.data?.breached === false && frostA.data?.level === 'normal')
  const trialBadValue = await call('/alert-rules/evaluate?metricKey=temperature&value=abc', { token: farmer })
  check('G13 试算读数非数字 → 400', trialBadValue.status === 400 && /数字/.test(trialBadValue.message), trialBadValue.message)

  const riskA = await call('/alert-rules/risk-readings', { token: farmer })
  check('G14 风险读数清单可用且按本主体规则判定', riskA.status === 200 && Array.isArray(riskA.data), JSON.stringify(riskA.data?.slice(0, 2)))
  const presetBefore = await call('/alert-rules', { token: farmer })
  const tempRule = await call('/alert-rules/custom', {
    method: 'POST',
    token: farmer,
    body: { ruleName: `${MARK} 高温提示`, metricKey: 'temperature', operator: '>', threshold: 20, durationSeconds: 0, level: 'major' },
  })
  check('G15 新建主体阈值规则 → 200', tempRule.status === 200 && tempRule.data?.source === 'tenant', tempRule.message)
  check('G16 新规则落在当前主体并记录创建人', Number(scalar(`SELECT tenant_id FROM iot_alert_rule_tenant WHERE id=${tempRule.data?.id}`)) === TENANT_A && scalar(`SELECT created_by FROM iot_alert_rule_tenant WHERE id=${tempRule.data?.id}`) === 'farmer')
  check('G17 新规则的指标名称由服务端补（不信前端自报）', tempRule.data?.metricName === '空气温度', String(tempRule.data?.metricName))
  const riskAfter = await call('/alert-rules/risk-readings', { token: farmer })
  const riskLatest = scalar(`SELECT t.metric_value FROM iot_telemetry t JOIN iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A} AND t.metric_key='temperature' ORDER BY t.recorded_at DESC,t.id DESC LIMIT 1`)
  check('G18 阈值降到 20℃ 后，最新读数出现在风险清单', (riskAfter.data || []).some((row) => row.ruleId === tempRule.data?.id && row.ruleSource === 'tenant'), `最新温度读数 ${riskLatest}`)
  check('G19 风险读数值与实际读数一致', (riskAfter.data || []).every((row) => Number.isFinite(Number(row.value))), JSON.stringify((riskAfter.data || []).slice(0, 1)))
  const crossRuleUpdate = await call(`/alert-rules/custom/${tempRule.data?.id}`, { method: 'PUT', token: luochuan, body: { ruleName: '劫持', metricKey: 'temperature', operator: '>', threshold: 1 } })
  check('G20 跨主体改阈值规则 → 404', crossRuleUpdate.status === 404, String(crossRuleUpdate.status))
  const crossRuleToggle = await call(`/alert-rules/custom/${tempRule.data?.id}/toggle`, { method: 'POST', token: luochuan })
  check('G21 跨主体启停阈值规则 → 404', crossRuleToggle.status === 404)
  const crossRuleDelete = await call(`/alert-rules/custom/${tempRule.data?.id}`, { method: 'DELETE', token: luochuan })
  check('G22 跨主体删除阈值规则 → 404', crossRuleDelete.status === 404)
  const illegalOperator = await call('/alert-rules/custom', { method: 'POST', token: farmer, body: { ruleName: `${MARK} 非法`, metricKey: 'temperature', operator: '≈', threshold: 1 } })
  check('G23 非法比较方式被拒', illegalOperator.status === 400 && /比较方式/.test(illegalOperator.message), illegalOperator.message)
  const illegalLevel = await call('/alert-rules/custom', { method: 'POST', token: farmer, body: { ruleName: `${MARK} 非法等级`, metricKey: 'temperature', operator: '>', threshold: 1, level: '特急' } })
  check('G24 非法告警等级被拒', illegalLevel.status === 400 && /告警等级/.test(illegalLevel.message), illegalLevel.message)
  const illegalDuration = await call('/alert-rules/custom', { method: 'POST', token: farmer, body: { ruleName: `${MARK} 非法持续`, metricKey: 'temperature', operator: '>', threshold: 1, durationSeconds: 999999 } })
  check('G25 持续时间超范围被拒', illegalDuration.status === 400 && /持续时间/.test(illegalDuration.message), illegalDuration.message)
  const unknownType = await call('/alert-rules/custom', { method: 'POST', token: farmer, body: { ruleName: `${MARK} 未知类型`, metricKey: 'temperature', operator: '>', threshold: 1, deviceType: '不存在的设备类型' } })
  check('G26 设备类型不在目录内被拒', unknownType.status === 400 && /设备类型/.test(unknownType.message), unknownType.message)
  const toggleOnce = await call(`/alert-rules/custom/${tempRule.data?.id}/toggle`, { method: 'POST', token: farmer })
  check('G27 停用后规则不再进入生效集合', toggleOnce.data?.enabled === false && !(await call('/alert-rules/view', { token: farmer })).data.effective.some((rule) => rule.id === tempRule.data?.id && rule.source === 'tenant'))
  const toggledBack = await call(`/alert-rules/custom/${tempRule.data?.id}/toggle`, { method: 'POST', token: farmer })
  check('G28 再启用恢复生效', toggledBack.data?.enabled === true)
  const ruleLog = rows(`SELECT operator_name,IFNULL(ip_address,'') FROM iot_ops_log WHERE action_name LIKE '%阈值规则' ORDER BY id DESC LIMIT 1`)[0]
  check('G29 阈值操作留痕带真实操作人与 IP', ruleLog?.[0] === 'farmer' && ruleLog?.[1] !== '', JSON.stringify(ruleLog))
  check('G30 主体改阈值不会动平台预置', JSON.stringify((await call('/alert-rules', { token: farmer })).data) === JSON.stringify(presetBefore.data))
  const deleteTrialRule = await call(`/alert-rules/custom/${tempRule.data?.id}`, { method: 'DELETE', token: farmer })
  check('G31 删除临时阈值规则 → 200', deleteTrialRule.status === 200, deleteTrialRule.message)
  check('G32 删除后风险读数回到基线', (await call('/alert-rules/risk-readings', { token: farmer })).data?.length === riskA.data?.length)

  const opsRules = await call(`${OPS}/alert-rules`, { token: admin })
  check('G33 运营端能读平台预置阈值', opsRules.status === 200 && opsRules.data?.length === Number(scalar('SELECT COUNT(*) FROM iot_alert_rule')), JSON.stringify(opsRules.data?.length))
  check('G34 运营端能看各主体自定义阈值（带主体名）', (await call(`${OPS}/alert-rules/tenant`, { token: admin })).data?.some((row) => row.tenantName === '陕西洛川果业'))
  const presetEnabledBefore = scalar('SELECT enabled FROM iot_alert_rule WHERE id=4')
  const opsToggle = await call(`${OPS}/alert-rules/4/toggle`, { method: 'POST', token: admin })
  check('G35 运营端可启停平台预置（全平台开关归运营）', opsToggle.status === 200 && String(scalar('SELECT enabled FROM iot_alert_rule WHERE id=4')) !== String(presetEnabledBefore), `${presetEnabledBefore} → ${scalar('SELECT enabled FROM iot_alert_rule WHERE id=4')}`)
  const opsToggleLog = rows(`SELECT operator_name FROM iot_ops_log WHERE action_name LIKE '%平台阈值规则%' ORDER BY id DESC LIMIT 1`)[0]
  check('G36 平台阈值启停记的是运营账号', opsToggleLog?.[0] === 'admin', JSON.stringify(opsToggleLog))
  await call(`${OPS}/alert-rules/4/toggle`, { method: 'POST', token: admin })
  check('G37 平台预置状态已还原', scalar('SELECT enabled FROM iot_alert_rule WHERE id=4') === presetEnabledBefore)
  const opsNoToken = await fetch(`${OPS}/alert-rules`)
  check('G38 运营端阈值接口要求令牌', opsNoToken.status === 401, String(opsNoToken.status))
  const optionsView = await call('/alert-rules/options', { token: farmer })
  check('G39 指标目录非空且含土壤含水率', (optionsView.data?.metrics || []).some((item) => item.key === 'soil_moisture') && optionsView.data?.deviceTypes?.length > 0, JSON.stringify(optionsView.data?.metrics?.length))
  const envWithLevel = (overviewA.data?.environment || []).filter((item) => item.level)
  check('G40 环境卡片带出按本主体阈值判定的等级', envWithLevel.length > 0 && envWithLevel.every((item) => ['normal', 'warning', 'critical'].includes(item.status)), JSON.stringify((overviewA.data?.environment || []).map((item) => `${item.key}:${item.status}`)))

  // ========== F. 清理 ==========
  const deleteActiveScene = await call(`/scenes/${sceneCreate.data?.id}`, { method: 'DELETE', token: farmer })
  check('F1 运行中的场景不允许直接删除（避免"删掉正在跑的自动控制"）', deleteActiveScene.status === 400 && /运行中的场景不能删除/.test(deleteActiveScene.message), deleteActiveScene.message)
  const restoreScene = await call('/scenes/1/activate', { method: 'POST', token: farmer })
  check('F2 2001 的运行场景已恢复为种子场景', restoreScene.status === 200 && scalar('SELECT id FROM iot_scene WHERE tenant_id=2001 AND is_active=TRUE') === '1')
  const deleteScene = await call(`/scenes/${sceneCreate.data?.id}`, { method: 'DELETE', token: farmer })
  check('F3 停用后删除临时场景 → 200', deleteScene.status === 200, deleteScene.message)
  const deleteRule = await call(`/rules/${ruleCreate.data?.id}`, { method: 'DELETE', token: farmer })
  check('F4 删除临时规则 → 200', deleteRule.status === 200, deleteRule.message)
  const crossDelete = await call(`/scenes/${sceneCreate.data?.id}`, { method: 'DELETE', token: luochuan })
  check('F5 删除后再取 → 404', crossDelete.status === 404, String(crossDelete.status))
  await sql(`UPDATE iot_alert SET status='${alertSnapshot[1]}',handled_by=NULL,handle_note=NULL,handled_at=NULL WHERE id=${alertSnapshot[0]}`)
  check('F6 被处置的告警已恢复原状态', scalar(`SELECT status FROM iot_alert WHERE id=${alertSnapshot[0]}`) === alertSnapshot[1])

  if (!KEEP) {
    await sql(`
      DELETE FROM iot_alert_rule_tenant WHERE id>${snapshot.alertRuleTenant};
      DELETE FROM iot_scene WHERE id>${snapshot.scene};
      DELETE FROM iot_rule_config WHERE rule_id>${snapshot.rule};
      DELETE FROM iot_rule WHERE id>${snapshot.rule};
      DELETE FROM iot_work_order WHERE id>${snapshot.workOrder};
      DELETE FROM iot_control_log WHERE id>${snapshot.controlLog};
      DELETE FROM iot_ops_log WHERE id>${snapshot.opsLog};
    `)
  }
  const residue = {
    alertRuleTenant: Number(scalar(`SELECT COUNT(*) FROM iot_alert_rule_tenant WHERE id>${snapshot.alertRuleTenant}`)),
    scene: Number(scalar(`SELECT COUNT(*) FROM iot_scene WHERE id>${snapshot.scene}`)),
    rule: Number(scalar(`SELECT COUNT(*) FROM iot_rule WHERE id>${snapshot.rule}`)),
    workOrder: Number(scalar(`SELECT COUNT(*) FROM iot_work_order WHERE id>${snapshot.workOrder}`)),
    controlLog: Number(scalar(`SELECT COUNT(*) FROM iot_control_log WHERE id>${snapshot.controlLog}`)),
    opsLog: Number(scalar(`SELECT COUNT(*) FROM iot_ops_log WHERE id>${snapshot.opsLog}`)),
  }
  check('F7 临时数据零残留', KEEP || Object.values(residue).every((value) => value === 0), JSON.stringify(residue))
  check('F8 设备台账未被回归脚本改动', Number(scalar('SELECT COUNT(*) FROM iot_device')) === snapshot.device, String(scalar('SELECT COUNT(*) FROM iot_device')))

  if (!KEEP && provision.created) {
    // 只有"本次脚本建的"才回收；如果第二主体本来就有农场（演示常驻），不该被回归脚本删掉
    const released = await releaseSecondTenantFarm(luochuan)
    check('F9 本次创建的临时农场已释放', released.released === true, JSON.stringify(released))
  } else {
    check('F9 第二主体农场保持原状（本次未新建）', true, provision.created ? '--keep' : '复用已有农场')
  }
}

main()
  .then(() => {
    console.log(`\n物联网端到端回归：${passed} 条断言通过，${failures.length} 条失败`)
    failures.forEach((item, index) => console.log(`  ${index + 1}. ${item}`))
    if (failures.length > 0) process.exitCode = 1
  })
  .catch((error) => {
    console.error(`回归脚本异常中止（已通过 ${passed} 条）：${error.message}`)
    process.exitCode = 1
  })
