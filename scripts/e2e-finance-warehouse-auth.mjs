/** 金融仓储窄通道回归；只清理本轮精确 ID，保留现有批次和业务数据。 */
import { spawnSync } from 'node:child_process'
import { randomUUID, createHash } from 'node:crypto'

const MYSQL = process.env.MYSQL_EXE || 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const FIN = process.env.FINANCE_BASE_URL || 'http://localhost:8087'
const PROD = process.env.PRODUCTION_BASE_URL || 'http://localhost:8092'
const CORE = process.env.CORE_BASE_URL || 'http://localhost:8093'
const secret = process.env.AGRI_FINANCE_WAREHOUSE_TOKEN
if (!secret) throw new Error('请通过部署环境提供 AGRI_FINANCE_WAREHOUSE_TOKEN，不能写入脚本')
const marker = `WM-${randomUUID()}`
const receiptId = `${marker}-R`, pledgeId = `${marker}-P`, appId = `${marker}-A`, investmentId = `${marker}-I`
const uuidBytes = createHash('md5').update(`finance-approval:${appId}`).digest()
uuidBytes[6] = (uuidBytes[6] & 15) | 48
uuidBytes[8] = (uuidBytes[8] & 63) | 128
const uuidHex = uuidBytes.toString('hex')
const assetId = `ASSET-APP-${uuidHex.slice(0,8)}-${uuidHex.slice(8,12)}-${uuidHex.slice(12,16)}-${uuidHex.slice(16,20)}-${uuidHex.slice(20)}`
const deviceId = 8000000000000 + Math.floor(Math.random() * 1000000000)
const sqlString = value => `'${String(value).replaceAll("'", "''")}'`
const q = sqlString
function sql(query) {
  const p = spawnSync(MYSQL, ['-uroot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query], {
    encoding: 'utf8', timeout: 15000,
    env: { ...process.env, MYSQL_PWD: process.env.MYSQL_PASSWORD || 'root' },
  })
  if (p.error || p.status !== 0) throw new Error(`数据库操作失败：${p.error?.message || p.stderr}`)
  return p.stdout.trim()
}
let passed = 0
function check(ok, message) {
  if (!ok) throw new Error(`失败：${message}`)
  passed++; console.log(`✓ ${message}`)
}
async function request(base, path, token, { internal = false, method = 'GET', body, key = secret } = {}) {
  const r = await fetch(`${base}${path}`, {
    method, signal: AbortSignal.timeout(20000),
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(internal ? { 'X-Finance-Warehouse-Token': key } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: r.status, body: await r.json() }
}
async function login(username) {
  const r = await request(CORE, '/api/v1/auth/login', null, {
    method: 'POST', body: { username, password: process.env.E2E_PASSWORD || 'Admin@123', marketId: 1 },
  })
  const token = r.body.data?.accessToken
  if (!token) throw new Error(`${username} 登录失败`)
  return token
}
const cleanup = () => sql(`
 DELETE FROM agri_finance.pledge_monitor WHERE receipt_id=${q(receiptId)};
 DELETE FROM agri_finance.investment WHERE id=${q(investmentId)};
 DELETE FROM agri_finance.asset WHERE id=${q(assetId)};
 DELETE FROM agri_finance.pledge WHERE id=${q(pledgeId)};
 DELETE FROM agri_finance.warehouse_receipt WHERE id=${q(receiptId)};
 DELETE FROM agri_finance.loan_application WHERE id=${q(appId)};
 DELETE FROM agri_production.agri_prod_sensor_data WHERE device_id=${deviceId} AND device_code=${q(marker)};
`)
try {
  const [fund, farmer, admin] = await Promise.all([login(process.env.FINANCE_FUND_USERNAME || 'fund'), login('farmer'), login('admin')])
  const binding = await request(CORE, '/api/v1/platform/merchants/mine', fund)
  const merchant = binding.body.data?.[0]?.merchantId
  if (!merchant) throw new Error('资金方缺少主体绑定')
  const providerId = sql(`SELECT id FROM agri_finance.fund_provider WHERE merchant_id=${q(merchant)} AND del_flag=0 LIMIT 1;`)
  if (!providerId) throw new Error('资金方缺少机构绑定')
  const line = sql("SELECT id,tenant_id,batch_no,farm_id,plot_id FROM agri_production.agri_prod_harvest_batch WHERE deleted=0 AND tenant_id='2001' AND farm_id IS NOT NULL AND plot_id IS NOT NULL LIMIT 1;")
  if (!line) throw new Error('需要主体 2001 已有的农场地块批次作为只读参照')
  const [batchId, tenant, batchNo, farm, plot] = line.split('\t')
  sql(`INSERT INTO agri_finance.loan_application(id,application_no,user_id,product_type,apply_amount,apply_term,status,del_flag)
       VALUES(${q(appId)},${q(appId)},${q(tenant)},'warehouse',1000,1,'已通过',0);
       INSERT INTO agri_finance.warehouse_receipt(id,receipt_no,user_id,batch_id,batch_no,farm_id,plot_id,pledge_id,status,del_flag)
       VALUES(${q(receiptId)},${q(receiptId)},${q(tenant)},${q(batchId)},${q(batchNo)},${q(farm)},${q(plot)},${q(pledgeId)},'已质押',0);
       INSERT INTO agri_finance.pledge(id,pledge_no,user_id,receipt_id,application_id,status,del_flag)
       VALUES(${q(pledgeId)},${q(pledgeId)},${q(tenant)},${q(receiptId)},${q(appId)},'已生效',0);
       INSERT INTO agri_finance.asset(id,asset_no,asset_name,borrower_id,provider_id,del_flag)
       VALUES(${q(assetId)},${q(assetId)},${q(marker)},${q(tenant)},${q(providerId)},0);
       INSERT INTO agri_production.agri_prod_sensor_data(device_id,device_code,sensor_type,sensor_name,value,tenant_id,farm_id,plot_id,data_time)
       VALUES(${deviceId},${q(marker)},'temperature','wm-temp',23,${q(tenant)},${farm},${plot},NOW()),
             (${deviceId},${q(marker)},'humidity','wm-humidity',65,${q(tenant)},${farm},${plot},NOW()),
             (${deviceId},${q(marker)},'temperature','foreign-tenant',999,'2003',${farm},${plot},NOW()),
             (${deviceId},${q(marker)},'temperature','foreign-plot',888,${q(tenant)},${farm},${Number(plot)+999999},NOW());`)
  let r = await request(FIN, `/api/v1/warehouse-receipt/${receiptId}/monitor`, fund)
  check(r.status === 403, '无认购资金方不能读取仓单快照')
  r = await request(PROD, `/internal/finance/warehouse/${receiptId}/sensors`, fund, { internal:true })
  check(r.status === 403, '持服务密钥但无业务关系仍拒绝')
  r = await request(PROD, `/internal/finance/warehouse/${receiptId}/sensors`, admin, { internal:true, key:'forged' })
  check(r.status === 403, '错误服务密钥拒绝')
  r = await request(PROD, `/internal/finance/warehouse/${receiptId}/sensors`, null, { internal:true })
  check(r.status === 401, '仅服务密钥不能匿名读取')
  r = await request(PROD, `/internal/finance/warehouse/${receiptId}/sensors`, 'forged-token', { internal:true })
  check([401,403].includes(r.status), '伪造平台令牌拒绝')
  sql(`INSERT INTO agri_finance.investment(id,investment_no,asset_id,provider_id,investment_amount,status,del_flag)
       VALUES(${q(investmentId)},${q(investmentId)},${q(assetId)},${q(providerId)},1000,'投资中',0);`)
  r = await request(PROD, `/internal/finance/warehouse/${receiptId}/sensors`, fund, { internal:true })
  check(r.status === 200 && r.body.code === 0, '有效认购资金方获准跨主体读取指定仓单')
  const rows = r.body.data.filter(x => String(x.deviceId) === String(deviceId))
  check(rows.length === 2, '同设备温度与湿度分别取数')
  check(rows.every(x => Number(x.value) !== 999 && Number(x.value) !== 888), '其他主体与其他地块读数不混入')
  r = await request(FIN, `/api/v1/warehouse-receipt/${receiptId}/monitor/refresh`, fund, {method:'POST'})
  check(r.status === 200 && r.body.code === 200 && r.body.data.deviceNote.includes(`[warehouse-batch:${batchId}]`), '资金方实时刷新跨服务授权成功并落库')
  r = await request(FIN, `/api/v1/warehouse-receipt/${receiptId}/monitor`, farmer)
  check(r.status === 200, '融资主体可读取自己的仓单快照')
  sql(`UPDATE agri_finance.investment SET status='已完成' WHERE id=${q(investmentId)};`)
  r = await request(FIN, `/api/v1/warehouse-receipt/${receiptId}/monitor`, fund)
  check(r.status === 403, '认购完成后立即不能读已有快照')
  sql(`UPDATE agri_finance.investment SET status='投资中' WHERE id=${q(investmentId)};
       UPDATE agri_finance.warehouse_receipt SET status='已释放' WHERE id=${q(receiptId)};`)
  r = await request(FIN, `/api/v1/warehouse-receipt/${receiptId}/monitor/refresh`, fund, {method:'POST'})
  check(r.status === 403, '释放仓单后立即不能刷新')
  sql(`UPDATE agri_finance.warehouse_receipt SET status='已质押',user_id='2003' WHERE id=${q(receiptId)};`)
  r = await request(FIN, `/api/v1/warehouse-receipt/${receiptId}/monitor`, farmer)
  check(r.status === 403, '另一融资主体不能读取他人仓单')
  r = await request(PROD, '/api/v1/production/iot/sensor-data/latest', fund, {method:'POST',body:[deviceId]})
  check(r.status === 403, '资金方通用传感器接口仍需 iot:read，不因仓单授权放开')
  console.log(`通过 ${passed} 项，失败 0 项`)
} finally {
  cleanup()
  const remaining = sql(`SELECT (SELECT COUNT(*) FROM agri_finance.warehouse_receipt WHERE id=${q(receiptId)})+
    (SELECT COUNT(*) FROM agri_finance.pledge_monitor WHERE receipt_id=${q(receiptId)})+
    (SELECT COUNT(*) FROM agri_finance.investment WHERE id=${q(investmentId)})+
    (SELECT COUNT(*) FROM agri_finance.asset WHERE id=${q(assetId)})+
    (SELECT COUNT(*) FROM agri_finance.pledge WHERE id=${q(pledgeId)})+
    (SELECT COUNT(*) FROM agri_finance.loan_application WHERE id=${q(appId)})+
    (SELECT COUNT(*) FROM agri_production.agri_prod_sensor_data WHERE device_id=${deviceId} AND device_code=${q(marker)});`)
  check(remaining === '0', '本轮测试夹具残留 0 条')
}
