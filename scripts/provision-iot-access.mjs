#!/usr/bin/env node
/**
 * 物联网演示环境的第二经营主体接入脚本。
 *
 * 为什么需要它：物联网用户端的数据范围完全由「当前登录账号在生产管理侧可见的农场」推导
 * （见 agri-iot/backend IotIdentityService）。演示数据里 26 个农场全部挂在经营主体 2001
 * （绿源农业合作社）名下，于是另一个主体 —— 2003 陕西洛川果业（演示账号 luochuan）
 * 打开物联网用户端只能看到"没有可见农场"，跨租户隔离也就无从验证。
 *
 * 这个脚本走的是**生产域公开接口**（不碰数据库）：
 *   POST /api/v1/production/farms   以 luochuan 的令牌创建农场，tenant 由服务端从令牌解析
 *   DELETE /api/v1/production/farms/{id}   --release 时删除，恢复到零残留
 *
 * 用法：
 *   node scripts/provision-iot-access.mjs            # 确保农场存在（幂等），打印 JSON
 *   node scripts/provision-iot-access.mjs --release  # 删除该农场
 */
import { setTimeout as sleep } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

const CORE = process.env.AGRI_CORE_URL || 'http://localhost:8093'
const PRODUCTION = process.env.AGRI_PRODUCTION_URL || 'http://localhost:8092'
const DEMO_PASSWORD = process.env.AGRI_DEMO_PASSWORD || 'Admin@123'
/** 第二个经营主体的演示账号（agri_core 里绑定 merchantId=2003 陕西洛川果业）。 */
const SECOND_TENANT_ACCOUNT = process.env.AGRI_IOT_SECOND_ACCOUNT || 'luochuan'
export const SECOND_TENANT_FARM_NAME = '【演示】洛川苹果智慧果园'

async function request(url, options = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(url, { ...options, headers })
  const text = await response.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    throw new Error(`${url} 返回非 JSON（HTTP ${response.status}）：${text.slice(0, 200)}`)
  }
  if (!response.ok || (body.code !== 0 && body.code !== 200)) {
    throw new Error(
      `${options.method || 'GET'} ${url} 失败：HTTP ${response.status} code=${body.code} message=${body.message || text.slice(0, 160)}`,
    )
  }
  return body.data
}

/** 用统一账号登录，拿访问令牌。 */
export async function login(username, password = DEMO_PASSWORD) {
  const data = await request(
    `${CORE}/api/v1/sso/login-standalone`,
    { method: 'POST', body: JSON.stringify({ username, password, marketId: 1, remember: true }) },
  )
  if (!data?.accessToken) throw new Error(`${username} 登录响应里没有 accessToken`)
  return data.accessToken
}

/** 当前令牌可见的生产农场（物联网的租户与数据范围就是从这里推导的）。 */
export async function listFarms(token) {
  return (await request(`${PRODUCTION}/api/v1/production/farms/all`, {}, token)) || []
}

/**
 * 确保第二经营主体的农场存在，返回 { farmId, created }。
 * 农场名称是幂等键：已存在就复用，不重复创建。
 */
export async function ensureSecondTenantFarm(token, farmName = SECOND_TENANT_FARM_NAME) {
  const existing = (await listFarms(token)).find((farm) => farm.farmName === farmName)
  if (existing) return { farmId: Number(existing.id), created: false }
  const created = await request(
    `${PRODUCTION}/api/v1/production/farms`,
    {
      method: 'POST',
      body: JSON.stringify({
        farmName,
        farmType: '果园',
        province: '陕西省',
        city: '延安市',
        district: '洛川县',
        address: '陕西省延安市洛川县果园示范园区',
        totalArea: 320,
        managerName: '洛川果业运维',
        managerPhone: '13800138000',
        mainProducts: '苹果',
        intro: '物联网跨主体演示农场：由 scripts/provision-iot-access.mjs 通过生产域接口创建。',
      }),
    },
    token,
  )
  // 创建接口返回的是主键或对象，两种都兼容
  const farmId = Number(typeof created === 'object' && created !== null ? created.id : created)
  if (!Number.isFinite(farmId) || farmId <= 0) {
    throw new Error(`创建农场后没有拿到主键：${JSON.stringify(created)}`)
  }
  // 生产端列表接口有极短的可见性延迟，轮询确认后再返回
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const farms = await listFarms(token)
    if (farms.some((farm) => Number(farm.id) === farmId)) return { farmId, created: true }
    await sleep(200)
  }
  throw new Error(`农场 ${farmId} 创建成功但在 ${SECOND_TENANT_ACCOUNT} 的可见列表里查不到`)
}

/** 删除第二经营主体的农场（只删得到名称匹配的那一个）。 */
export async function releaseSecondTenantFarm(token, farmName = SECOND_TENANT_FARM_NAME) {
  const target = (await listFarms(token)).find((farm) => farm.farmName === farmName)
  if (!target) return { farmId: null, released: false }
  await request(`${PRODUCTION}/api/v1/production/farms/${target.id}`, { method: 'DELETE' }, token)
  return { farmId: Number(target.id), released: true }
}

async function main() {
  const release = process.argv.includes('--release')
  const token = await login(SECOND_TENANT_ACCOUNT)
  const result = release
    ? await releaseSecondTenantFarm(token)
    : await ensureSecondTenantFarm(token)
  const farms = await listFarms(token)
  console.log(
    JSON.stringify(
      {
        mode: release ? 'release' : 'ensure',
        account: SECOND_TENANT_ACCOUNT,
        ...result,
        visibleFarmCount: farms.length,
        farmIds: farms.map((farm) => Number(farm.id)),
        tenantIds: [...new Set(farms.map((farm) => farm.tenantId))],
      },
      null,
      2,
    ),
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`[provision-iot-access] ${error.message}`)
    process.exitCode = 1
  })
}
