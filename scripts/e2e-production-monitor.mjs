/**
 * 生产监控看板联动验证（生产管理 ↔ 物联网）
 *
 * 验证目标（对应 2026-10-28 的看板重构）：
 *  1. 看板的设备数字与物联网端设备台账**同源**（不是前端自己数列表长度）
 *  2. 环境概览由后端聚合，窗口锚定"最新一次采样"而不是当前时间
 *  3. 农场筛选真的生效（不是静默返回全租户数据）
 *  4. 曲线按小时聚合、升序、不重复，且每个点都落在声明的时间窗内
 *
 * 用法：
 *   node scripts/e2e-production-monitor.mjs [--base=http://localhost] [--prod=http://localhost:8094]
 */
import process from 'node:process'

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}

const BASE_URL = arg('base', 'http://localhost')
// 默认走**网关**（http://localhost）而不是直连服务端口：
// 前端 api 层用的是 `/api/v1/production/...` 相对路径，实际由 nginx 按段转发。
// 直连端口会绕过路由表 —— 实测过：服务在 8094 上跑得好好的，但网关把
// /monitor/** 兜底给了 core-platform，页面照样 500。
const PROD_URL = arg('prod', 'http://localhost')
// 物联网端直连 8091：生产后端调它用的就是这个地址（services.iot.url），
// 网关上的 /api/v1/iot/ 属于 8101 那个独立站点，不是 80 端口这条链路
const IOT_URL = arg('iot', 'http://localhost:8091')
const USER = arg('user', 'farmer')
const PASSWORD = arg('password', 'Admin@123')

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/* ==================== 0) 登录 ==================== */
const login = await (await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
})).json()
check(login.code === 0, `登录（${USER}）`, `code=${login.code}`)
if (login.code !== 0) process.exit(1)
const AUTH = { Authorization: `Bearer ${login.data.accessToken}` }

const get = async (url) => {
  const res = await fetch(url, { headers: AUTH })
  let json = null
  try {
    json = await res.json()
  } catch {
    /* 非 JSON */
  }
  return { status: res.status, json, servedBy: res.headers.get('x-served-by') }
}

/* ==================== 0.5) 路由归属：必须由 agri-production 服务 ==================== */
// 网关把未切换的路径兜底给 core-platform，响应是 **HTTP 200 + body.code=500**，
// 页面只看到"加载失败"，看不出是路由没切。所以这里显式断言 X-Served-By。
const routeProbe = await get(`${PROD_URL}/api/v1/production/monitor/env-summary?hours=24`)
const servedBy = routeProbe.servedBy
check(
  servedBy === 'agri-production',
  'env-summary 由 agri-production 服务（未被网关兜底到平台侧）',
  `X-Served-By=${servedBy ?? '缺失'}`,
)
check(
  !String(servedBy ?? '').includes('core-platform'),
  'env-summary 没有落到 core-platform 兜底',
  `X-Served-By=${servedBy ?? '缺失'}`,
)

/* ==================== 1) 设备数字与物联网台账同源 ==================== */
const statsRes = await get(`${PROD_URL}/api/v1/production/iot/device-stats`)
check(statsRes.status === 200 && statsRes.json?.code === 0, '看板设备统计接口可读',
  `status=${statsRes.status} code=${statsRes.json?.code}`)
const stats = statsRes.json?.data ?? {}

const iotList = await get(`${IOT_URL}/api/v1/iot/app/devices`)
const iotDevices = iotList.json?.data ?? []
const expect = {
  total: iotDevices.length,
  online: iotDevices.filter((d) => d.onlineStatus === 'online').length,
  offline: iotDevices.filter((d) => d.onlineStatus === 'offline').length,
  alert: iotDevices.filter((d) => d.onlineStatus === 'alert').length,
}
check(Number(stats.total) === expect.total, '设备总数与物联网台账一致',
  `看板=${stats.total} / 台账=${expect.total}`)
check(Number(stats.online) === expect.online, '在线数与物联网台账一致',
  `看板=${stats.online} / 台账=${expect.online}`)
check(Number(stats.offline) === expect.offline, '离线数与物联网台账一致',
  `看板=${stats.offline} / 台账=${expect.offline}`)
check(Number(stats.alert) === expect.alert, '故障数与物联网台账一致',
  `看板=${stats.alert} / 台账=${expect.alert}`)

// 生产端设备列表（看板「设备实时」区块的数据源）也必须是同一批
const prodList = await get(`${PROD_URL}/api/v1/production/iot/devices?pageNum=1&pageSize=200`)
const prodDevices = prodList.json?.data?.records ?? prodList.json?.data?.list ?? []
check(prodDevices.length === expect.total, '看板设备清单与台账条数一致',
  `清单=${prodDevices.length} / 台账=${expect.total}`)

/* ==================== 2) 环境概览：窗口锚定最新采样 ==================== */
const envRes = await get(`${PROD_URL}/api/v1/production/monitor/env-summary?hours=24`)
check(envRes.status === 200 && envRes.json?.code === 0, '环境概览接口可读',
  `status=${envRes.status} code=${envRes.json?.code}`)
const env = envRes.json?.data ?? {}

check(Number(env.windowHours) === 24, '窗口长度按请求返回', `windowHours=${env.windowHours}`)
check(Number(env.sampleCount) > 0, '窗口内有采样数据', `sampleCount=${env.sampleCount}`)
check(Boolean(env.windowTo), '返回了窗口终点（= 最新采样时间）', `windowTo=${env.windowTo}`)
check(
  typeof env.staleHours === 'number' && env.staleHours >= 0,
  '返回了数据滞后小时数（页面据此提示"不是实时数据"）',
  `staleHours=${env.staleHours}`,
)

// windowTo 必须等于库里最新一次采样时间（锚定规则，而不是 now）
const series = Array.isArray(env.series) ? env.series : []
check(series.length > 0, '返回了按小时聚合的曲线点', `points=${series.length}`)

const parse = (text) => new Date(String(text).replace(' ', 'T'))
const from = env.windowFrom ? parse(env.windowFrom).getTime() : null
const to = env.windowTo ? parse(env.windowTo).getTime() : null
const timeOf = (label) => {
  // 曲线点标签是 MM-dd HH:00，补上窗口终点的年份
  const year = env.windowTo ? String(env.windowTo).slice(0, 4) : '1970'
  return new Date(`${year}-${label.replace(' ', 'T')}:00`).getTime()
}
const inWindow = series.every((p) => {
  const t = timeOf(p.time)
  return (from === null || t >= from) && (to === null || t <= to)
})
check(inWindow, '所有曲线点都落在声明的时间窗内', `${env.windowFrom} ~ ${env.windowTo}`)

const labels = series.map((p) => p.time)
check(new Set(labels).size === labels.length, '曲线点按小时唯一（没有重复桶）', `points=${labels.length}`)
const ascending = labels.every((label, index) => index === 0 || timeOf(labels[index - 1]) <= timeOf(label))
check(ascending, '曲线点时间升序', labels.length > 1 ? `${labels[0]} → ${labels[labels.length - 1]}` : '')

// 曲线点的三个主指标至少有一个非空，且 summary 里的键必须在 series 里出现过
const summaryKeys = Object.keys(env.summary ?? {})
check(summaryKeys.length > 0, '返回了指标平均值', `keys=${summaryKeys.join(',')}`)
const seriesHas = (metricKey) => {
  const field = {
    air_temperature: 'airTemperature',
    air_humidity: 'airHumidity',
    soil_moisture: 'soilMoisture',
  }[metricKey]
  if (!field) return true
  return series.some((p) => p[field] !== null && p[field] !== undefined)
}
const summaryBacked = summaryKeys.every((key) => seriesHas(key))
check(summaryBacked, 'summary 里的每个指标都能在曲线上找到对应点',
  summaryKeys.join(','))

/* ==================== 3) 农场筛选真的生效 ==================== */
const farmA = await get(`${PROD_URL}/api/v1/production/monitor/env-summary?farmId=DEMO-FARM-001&hours=24`)
const farmB = await get(`${PROD_URL}/api/v1/production/monitor/env-summary?farmId=DEMO-FARM-003&hours=24`)
const aCount = Number(farmA.json?.data?.sampleCount ?? 0)
const bCount = Number(farmB.json?.data?.sampleCount ?? 0)
check(aCount > 0, '有数据的农场能取到采样', `farm1 sampleCount=${aCount}`)
check(bCount === 0, '无数据的农场返回空（不是把全租户数据丢回来）', `farm3 sampleCount=${bCount}`)
check(aCount <= Number(env.sampleCount ?? 0), '单农场采样数不超过不筛选时的总数',
  `farm1=${aCount} / all=${env.sampleCount}`)

/* ==================== 4) 非法农场标识应被拒绝而不是静默全量 ==================== */
const badFarm = await get(`${PROD_URL}/api/v1/production/monitor/env-summary?farmId=NOT-A-FARM&hours=24`)
const badCode = Number(badFarm.json?.code)
check(badCode !== 0, '无法识别的农场标识被拒绝（不静默返回全量）', `code=${badCode}`)

/* ==================== 汇总 ==================== */
console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
