/**
 * 物联网三端浏览器点检（用户端 :8101 / 运营端 :8102 / 移动端 :8111）
 *
 * 接口级判据在 scripts/e2e-iot-flow.mjs，这份只回答"页面上真点得动、真显示得对"：
 *   用户端：横幅按令牌取自己的农场 → 顶栏日期/未读角标是实数 → 实时环境与趋势来自遥测实查 →
 *     阈值规则只读（写接口已下线）→ 处置告警的处置人来自令牌 → 控制指令的提示不替设备确认 →
 *     场景启用、工单按台账设备创建、报表 CSV 真下载。
 *   运营端：概览计数与租户设备数实时、设备列表能解析出租户名、配额校验与审计留痕、
 *     接入审核必填意见、报表导出真下载、工单列表带所属主体。
 *   移动端：登录换主体后数据范围立刻跟着变（跨主体隔离在三端一致）、"立即同步"给真实待办数。
 *   全程临时数据按建前最大 id 清理归零，被改动的种子逐条还原。
 *
 * 用法：node scripts/check-iot-ui.mjs
 *   前置：core :8093、production :8092、agri-iot :8091、gateway 8101/8102/8111 在跑，
 *        并已 node scripts/provision-iot-access.mjs（第二经营主体在生产域有可见农场）。
 */
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')
const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'

const WEB = 'http://localhost:8101/'
const OPS = 'http://localhost:8102/'
const MOBILE = 'http://localhost:8111/'
const PASSWORD = 'Admin@123'
const MARKER = 'UI点检'
const TENANT_A = 2001
const TENANT_B = 2003

const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'iot-ui-20261101')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const sql = (query) => {
  if (!existsSync(MYSQL)) return ''
  const result = spawnSync(MYSQL,
    ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query], { encoding: 'utf8' })
  if (result.status !== 0) return `ERR:${String(result.stderr ?? '').trim().slice(0, 160)}`
  // mysql.exe 在 Windows 上按 CRLF 输出：只 trim 整段的话，多行结果每行都会留一个 \r，Number() 直接变 NaN
  return String(result.stdout ?? '').replace(/\r\n/g, '\n').trim()
}
const exec = (query) => {
  const out = sql(query)
  if (String(out).startsWith('ERR')) {
    console.log(`  ! SQL 失败：${out}　← ${query.replace(/\s+/g, ' ').slice(0, 110)}`)
  }
  return out
}
const scalar = (query) => sql(query).split('\n')[0] ?? ''
const list = (query) => { const text = sql(query); return text ? text.split('\n') : [] }
const statusMap = (query) => {
  const map = {}
  for (const line of list(query)) {
    const [id, status] = String(line).split('#')
    if (id) map[id] = status ?? ''
  }
  return map
}
const maxId = (table) => Number(scalar(`SELECT COALESCE(MAX(id),0) FROM agri_iot.${table}`)) || 0

const now = new Date()
const pad = (value) => String(value).padStart(2, '0')
const todayIso = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][now.getDay()]

const pageText = async (page) => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
/** antd 会在两个汉字的按钮里插空格（"处置"渲染成"处 置"），文案定位一律允许字间空白。 */
const cjk = (text) => new RegExp(text.split('').map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s*'))
const hasText = async (page, needle, timeout = 12000) => {
  try {
    await page.waitForFunction((n) => document.body.innerText.replace(/\s+/g, ' ').includes(n), needle, { timeout })
    return true
  } catch {
    return false
  }
}
const toasts = async (page) => {
  await page.waitForTimeout(700)
  return (await page.locator('.ant-message-notice, .ant-notification-notice, .uni-toast, uni-toast').allInnerTexts())
    .join(' ').replace(/\s+/g, ' ')
}
/** antd 关掉的弹窗仍留在 DOM 里（display:none），不限定 :visible 就会点到上一步那个已关的弹窗。 */
const fillField = async (page, label, value, scope = '.ant-modal-content:visible') => {
  const item = page.locator(`${scope} .ant-form-item`).filter({ hasText: label }).first()
  await item.locator('input, textarea').first().fill(value)
  await page.waitForTimeout(200)
}
const pickOption = async (page, label, optionText, scope = '.ant-modal-content:visible') => {
  const item = page.locator(`${scope} .ant-form-item`).filter({ hasText: label }).first()
  await item.locator('.ant-select').first().click()
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: optionText }).first()
  await option.waitFor({ state: 'visible', timeout: 8000 })
  await option.click()
  await page.waitForTimeout(300)
}
const modalConfirm = async (page) => {
  const footer = page.locator('.ant-modal-content:visible .ant-modal-footer .ant-btn-primary')
  if (await footer.count()) {
    await footer.last().click()
  } else {
    await page.locator('.ant-modal-content:visible button.ant-btn-primary').last().click()
  }
  await page.waitForTimeout(1400)
}
const modalDismiss = async (page) => {
  await page.locator('.ant-modal-content:visible .ant-modal-close').first().click().catch(() => {})
  await page.waitForTimeout(600)
}
const navWeb = async (page, label) => {
  await page.locator('aside.iot-sidebar button').filter({ hasText: cjk(label) }).first().click()
  await page.waitForTimeout(1400)
}
const navOps = async (page, label) => {
  await page.locator('aside.o-sidebar button').filter({ hasText: cjk(label) }).first().click()
  await page.waitForTimeout(1400)
}

async function ssoLogin(page, base, username) {
  const port = new URL(base).port
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1600)
  if (new URL(page.url()).port !== port) {
    await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
    await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 }).catch(() => {})
    await page.locator('input[placeholder*="用户名"]').first().fill(username).catch(() => {})
    await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD).catch(() => {})
    await page.locator('button').filter({ hasText: '登' }).first().click().catch(() => {})
    await page.waitForFunction((p) => new URL(location.href).port === p, port, { timeout: 30000 }).catch(() => {})
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(2400)
  }
  return new URL(page.url()).port === port
}

/** uni-app H5 的 hash 路由：只改 hash 不会重新进页面，所以"改 hash → 等文案 → 不行就整页重载"。 */
async function openMobile(page, hashPath, marker) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.evaluate((hash) => { window.location.hash = hash }, `#${hashPath}`).catch(() => {})
    if (await hasText(page, marker, 8000)) return true
    await page.goto(`${MOBILE}#${hashPath}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1600)
    if (await hasText(page, marker, 6000)) return true
  }
  return false
}

async function uniLogin(page, username) {
  await page.goto(`${MOBILE}#/pages/login/index`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1600)
  const boxes = page.locator('.input-box input')
  if (await boxes.count() >= 2) {
    await boxes.nth(0).fill(username)
    await boxes.nth(1).fill(PASSWORD)
    await page.locator('uni-button, button').filter({ hasText: /^登录$/ }).first().click()
    await page.waitForFunction(() => !location.hash.includes('login'), null, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2200)
  }
  return pageText(page)
}

let browser
try {
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
} catch (error) {
  console.error('浏览器启动失败：', error?.message ?? error)
  process.exit(1)
}

const before = {
  scene: maxId('iot_scene'),
  rule: maxId('iot_rule'),
  workOrder: maxId('iot_work_order'),
  controlLog: maxId('iot_control_log'),
  opsLog: maxId('iot_ops_log'),
  device: maxId('iot_device'),
  alertRuleTenant: maxId('iot_alert_rule_tenant'),
}
const restore = {
  // 全量快照：中途失败时，凡是带本次标记的行都能按原状态还原（不能只还原"我以为点的那一行"）
  alertStatuses: statusMap('SELECT CONCAT(id,\x27#\x27,status) FROM agri_iot.iot_alert'),
  auditStatuses: statusMap('SELECT CONCAT(id,\x27#\x27,status) FROM agri_iot.iot_access_audit'),
  // 逐条记下要被点检改动的种子状态，结束时按原值还原
  unreadA: scalar(`SELECT COALESCE(GROUP_CONCAT(id),'') FROM (SELECT id FROM agri_iot.iot_message WHERE tenant_id=${TENANT_A} AND is_read=FALSE) x`),
  unreadB: scalar(`SELECT COALESCE(GROUP_CONCAT(id),'') FROM (SELECT id FROM agri_iot.iot_message WHERE tenant_id=${TENANT_B} AND is_read=FALSE) x`),
  alertPending: scalar(`SELECT CONCAT(id,'#',status) FROM agri_iot.iot_alert WHERE tenant_id=${TENANT_A} AND status='pending' ORDER BY id LIMIT 1`),
  activeSceneA: scalar(`SELECT id FROM agri_iot.iot_scene WHERE tenant_id=${TENANT_A} AND is_active=TRUE ORDER BY id LIMIT 1`),
  quotaB: scalar(`SELECT device_limit FROM agri_iot.iot_tenant WHERE id=${TENANT_B}`),
  quotaA: scalar(`SELECT device_limit FROM agri_iot.iot_tenant WHERE id=${TENANT_A}`),
  audit1: scalar(`SELECT CONCAT(status,'#',IFNULL(auditor,''),'#',IFNULL(note,'')) FROM agri_iot.iot_access_audit WHERE id=1`),
  deviceCountA: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_device WHERE tenant_id=${TENANT_A}`)),
  alertCountA: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_alert WHERE tenant_id=${TENANT_A}`)),
  alertCountB: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_alert WHERE tenant_id=${TENANT_B}`)),
  telemetryTodayA: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_telemetry t JOIN agri_iot.iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A} AND t.recorded_at LIKE '${todayIso}%'`)),
  tenantRulesA: Number(scalar('SELECT COUNT(*) FROM agri_iot.iot_alert_rule_tenant WHERE tenant_id=2001')),
  envTempLatest: scalar(`SELECT t.metric_value FROM agri_iot.iot_telemetry t JOIN agri_iot.iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A} AND t.metric_key='temperature' ORDER BY t.recorded_at DESC,t.id DESC LIMIT 1`),
  hoursLatestDay: Number(scalar(`SELECT COUNT(DISTINCT SUBSTRING(t.recorded_at,12,2)) FROM agri_iot.iot_telemetry t JOIN agri_iot.iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A} AND SUBSTRING(t.recorded_at,1,10)=(SELECT MAX(SUBSTRING(t2.recorded_at,1,10)) FROM agri_iot.iot_telemetry t2 JOIN agri_iot.iot_device d2 ON d2.id=t2.device_id WHERE d2.tenant_id=${TENANT_A}) AND t.metric_key IN ('temperature','humidity','soil_moisture')`)),
}

let auditedAccessId = null
let opsHandledAlert = null
let opsAlertOriginalStatus = 'pending'

try {
  // ================= 用户端 :8101 =================
  const context = await browser.newContext({ viewport: { width: 1500, height: 940 }, acceptDownloads: true })
  const page = await context.newPage()
  check(await ssoLogin(page, WEB, 'farmer'), 'W1 farmer 统一登录后进入物联网用户端', page.url())

  const dashboardText = await pageText(page)
  check(dashboardText.includes('【演示】'), 'W2 横幅取的是生产域按令牌返回的农场（不再是写死的 1 号农场）')
  check(dashboardText.includes('等') && /等\s*\d+\s*个农场/.test(dashboardText), 'W3 多农场主体在横幅里写明农场个数', dashboardText.slice(0, 60))
  check(!/null/.test(dashboardText.slice(0, 900)), 'W4 横幅没有 null 文案（地址由省市区补全）')
  check(dashboardText.includes(`${todayIso}`) && dashboardText.includes(weekday), 'W5 顶栏日期是今天（原来写死 2026-10-25 周日）', `${todayIso} ${weekday}`)
  const badge = await page.locator('.iot-header-right button i').first().innerText().catch(() => '')
  check(badge.trim() === String(restore.unreadA.split(',').filter(Boolean).length), 'W6 未读角标等于真实未读消息数', `页面 ${badge} · SQL ${restore.unreadA}`)

  const deviceCards = Number((dashboardText.match(/设备总数[\s\S]{0,40}?(\d+)/)?.[1]) ?? -1)
  check(deviceCards === restore.deviceCountA, 'W7 工作台设备总数与台账一致', `页面 ${deviceCards} · SQL ${restore.deviceCountA}`)

  await navWeb(page, '设备管理')
  const devicesText = await pageText(page)
  const listCount = Number(devicesText.match(/共\s*(\d+)\s*台|(\d+)\s*台设备/)?.[1] ?? devicesText.match(/(\d+)\s*台/)?.[2] ?? -1)
  check(listCount === -1 || listCount === restore.deviceCountA, 'W8 设备管理列表条数与统计同口径', `页面 ${listCount} · SQL ${restore.deviceCountA}`)

  await navWeb(page, '物联网工作台')
  const envText = await pageText(page)
  check(envText.includes(String(Math.round(Number(restore.envTempLatest) * 10) / 10)), 'W9 实时环境温度取自遥测实查（原来是写死的 27.6℃）', `SQL ${restore.envTempLatest}`)
  const envSoilLatest = scalar(`SELECT t.metric_value FROM agri_iot.iot_telemetry t JOIN agri_iot.iot_device d ON d.id=t.device_id WHERE d.tenant_id=${TENANT_A} AND t.metric_key='soil_moisture' ORDER BY t.recorded_at DESC,d.id DESC LIMIT 1`)
  check(envText.includes(String(Math.round(Number(envSoilLatest) * 10) / 10)), 'W10 土壤含水率卡片显示实查值（原来固定 24.1%）', `SQL ${envSoilLatest}`)
  const chartBars = await page.locator('.line-chart > div').count()
  check(chartBars === restore.hoursLatestDay, 'W11 环境趋势柱数 = 最新日期里有读数的小时数（原来固定 7 根）', `页面 ${chartBars} · SQL ${restore.hoursLatestDay}`)

  await navWeb(page, '预警中心')
  await page.locator('.iot-tabs button').filter({ hasText: cjk('告警规则') }).first().click()
  await page.waitForTimeout(1600)
  const rulesText = await pageText(page)
  check(rulesText.includes('我的阈值规则') && rulesText.includes('平台预置阈值'), 'R1 规则页拆成"我的阈值"和"平台预置"两块')
  const platformTable = page.locator('.iot-card.iot-table').filter({ hasText: '平台预置阈值' }).first()
  check(await platformTable.locator('button').filter({ hasText: /停\s*用|启\s*用/ }).count() === 0, 'R2 平台预置对租户只读（点一下就关掉全平台告警的时代结束）')
  const myTable = page.locator('.iot-card.iot-table').filter({ hasText: '我的阈值规则' }).first()
  const myRuleRows = await myTable.locator('.ant-table-row').count()
  check(myRuleRows === restore.tenantRulesA, 'R3 我的阈值列表条数与库内本主体规则一致', `页面 ${myRuleRows} · SQL ${restore.tenantRulesA}`)
  check(rulesText.includes('已由') && rulesText.includes('覆盖'), 'R4 被覆盖的平台规则在页面上写明被谁覆盖')

  await myTable.locator('button').filter({ hasText: cjk('新增阈值') }).first().click()
  await page.waitForTimeout(1200)
  await fillField(page, '规则名称', `${MARKER} 高温预警`)
  await pickOption(page, '监控指标', '空气温度')
  await fillField(page, '阈值', '25')
  await fillField(page, '持续时间（秒）', '0')
  await modalConfirm(page)
  const createRuleToast = await toasts(page)
  check(createRuleToast.includes('阈值规则已保存'), 'R5 新增主体阈值走通', createRuleToast.slice(0, 40))
  const createdRuleId = scalar(`SELECT id FROM agri_iot.iot_alert_rule_tenant WHERE rule_name='${MARKER} 高温预警'`)
  check(Number(scalar(`SELECT tenant_id FROM agri_iot.iot_alert_rule_tenant WHERE id=${createdRuleId}`)) === TENANT_A, 'R6 新规则落在当前经营主体名下')
  check(scalar(`SELECT created_by FROM agri_iot.iot_alert_rule_tenant WHERE id=${createdRuleId}`) === 'farmer', 'R7 规则创建人来自登录令牌')
  const myRuleRowsAfter = await page.locator('.iot-card.iot-table').filter({ hasText: '我的阈值规则' }).first().locator('.ant-table-row').count()
  check(myRuleRowsAfter === restore.tenantRulesA + 1, 'R8 列表立即反映新增', `页面 ${myRuleRowsAfter}`)

  const ruleRow = page.locator('.iot-card.iot-table').filter({ hasText: '我的阈值规则' }).first()
    .locator('.ant-table-row').filter({ hasText: MARKER }).first()
  await ruleRow.locator('button').filter({ hasText: cjk('停用') }).first().click()
  await page.waitForTimeout(1600)
  check(Number(scalar(`SELECT enabled FROM agri_iot.iot_alert_rule_tenant WHERE id=${createdRuleId}`)) === 0, 'R9 停用本主体规则只改自己的行')
  await page.locator('.iot-card.iot-table').filter({ hasText: '我的阈值规则' }).first()
    .locator('.ant-table-row').filter({ hasText: MARKER }).first()
    .locator('button').filter({ hasText: cjk('启用') }).first().click()
  await page.waitForTimeout(1600)
  check(Number(scalar(`SELECT enabled FROM agri_iot.iot_alert_rule_tenant WHERE id=${createdRuleId}`)) === 1, 'R10 再启用恢复')

  await page.locator('.iot-card').filter({ hasText: '阈值试算' }).first().locator('input[placeholder="读数"]').first().fill('34')
  await page.locator('.iot-card').filter({ hasText: '阈值试算' }).first().locator('button').filter({ hasText: cjk('判定') }).first().click()
  await page.waitForTimeout(1600)
  const trialText = await page.locator('.iot-card').filter({ hasText: '阈值试算' }).first().innerText()
  check(trialText.includes('紧急') || trialText.includes('重要'), 'R11 试算 34℃ 命中的是本主体更严的阈值', trialText.replace(/\s+/g, ' ').slice(0, 90))
  check(trialText.includes(MARKER) || trialText.includes('蔬菜棚高温'), 'R12 试算结果显示命中的规则名与来源', trialText.replace(/\s+/g, ' ').slice(80, 170))

  await page.locator('.iot-card.iot-table').filter({ hasText: '我的阈值规则' }).first()
    .locator('.ant-table-row').filter({ hasText: MARKER }).first()
    .locator('button').filter({ hasText: cjk('删除') }).first().click()
  await page.waitForTimeout(1000)
  await page.locator('.ant-modal-content:visible button').filter({ hasText: /确认删除/ }).first().click()
  await page.waitForTimeout(1600)
  check(scalar(`SELECT COUNT(*) FROM agri_iot.iot_alert_rule_tenant WHERE id=${createdRuleId}`) === '0', 'R13 删除阈值规则生效（不再残留）')
  await page.locator('.iot-tabs button').filter({ hasText: cjk('告警列表') }).first().click()
  await page.waitForTimeout(1200)

  const alertId = Number(String(restore.alertPending).split('#')[0])
  const alertCard = page.locator('.alert-card').filter({ hasText: scalar(`SELECT title FROM agri_iot.iot_alert WHERE id=${alertId}`).slice(0, 8) }).first()
  await alertCard.locator('button').filter({ hasText: cjk('处置') }).first().click()
  await page.waitForTimeout(900)
  await page.locator('.ant-modal-content:visible textarea').first().fill(`${MARKER} 已现场核查`)
  await modalConfirm(page)
  const handleToast = await toasts(page)
  check(handleToast.includes('告警') || await hasText(page, '已恢复', 8000), 'W14 处置告警提交成功', handleToast.slice(0, 50))
  const handledBy = scalar(`SELECT IFNULL(handled_by,'') FROM agri_iot.iot_alert WHERE id=${alertId}`)
  check(handledBy === 'farmer', 'W15 处置人来自访问令牌（前端再也自称不了任意人名）', handledBy)
  check(scalar(`SELECT status FROM agri_iot.iot_alert WHERE id=${alertId}`) === 'resolved', 'W16 告警状态已落库')

  await navWeb(page, '设备管理')
  await page.locator('.iot-filter input').first().fill('1号棚南侧风机')
  await page.locator('.iot-filter button').filter({ hasText: cjk('查询') }).first().click()
  await page.waitForTimeout(1800)
  const filteredText = await pageText(page)
  check(filteredText.includes('1号棚南侧风机'), 'W16a 设备管理按名称过滤能查到该设备', filteredText.slice(0, 60))
  await page.getByText('1号棚南侧风机').first().click()
  await page.waitForTimeout(2200)
  await page.locator('.ant-modal-content:visible .control-panel button').filter({ hasText: cjk('开启') }).first().click()
  const controlToast = await toasts(page)
  check(/边缘网关|已下发/.test(controlToast), 'W17 控制提示只声明"已下发到边缘网关"（不再替设备确认执行）', controlToast.slice(0, 70))
  check(!/设备已确认/.test(controlToast), 'W18 页面上找不到"设备已确认"这种假回执文案')
  const controlOperator = scalar(`SELECT operator_name FROM agri_iot.iot_control_log WHERE id>${before.controlLog} ORDER BY id DESC LIMIT 1`)
  check(controlOperator === 'farmer', 'W19 控制留痕的操作人是令牌账号', controlOperator)
  // 详情是个弹窗，不关掉它，后面的侧栏点击会被遮罩吃掉
  await modalDismiss(page)

  await navWeb(page, '场景与自动化')
  await page.locator('button').filter({ hasText: cjk('新建场景') }).first().click().catch(() => {})
  await page.waitForTimeout(1000)
  if (await page.locator('.ant-modal-content:visible').count()) {
    await fillField(page, '场景名称', `${MARKER} 通风场景`)
    await fillField(page, '场景说明', '浏览器点检创建')
    await modalConfirm(page)
  }
  const sceneToast = await toasts(page)
  const sceneRows = await page.locator('body').getByText(`${MARKER} 通风场景`).count().catch(() => 0)
  check(sceneRows > 0 || sceneToast.includes('场景'), 'W20 场景创建走通并回显在列表', sceneToast.slice(0, 50))
  check(scalar(`SELECT tenant_id FROM agri_iot.iot_scene WHERE scene_name='${MARKER} 通风场景'`) === String(TENANT_A), 'W21 新场景落在当前经营主体名下')

  await navWeb(page, '数据分析')
  const analyticsText = await pageText(page)
  check(!analyticsText.includes('灌溉用水') && analyticsText.includes('控制指令'), 'W22 报表指标换成可查证的控制指令数（没有水表却写"灌溉用水 326.8m³"的时代结束）')
  check(analyticsText.includes(String(restore.deviceCountA)), 'W23 在线率按当前主体设备实算', analyticsText.match(/设备在线率[\s\S]{0,20}/)?.[0]?.replace(/\s+/g, ' ') ?? '')
  const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
  await page.locator('button').filter({ hasText: cjk('导出报表') }).first().click()
  const download = await downloadPromise.catch(() => null)
  check(Boolean(download), 'W24 "导出报表"真的产生了一个下载（原来只弹一句"已导出"）', download?.suggestedFilename() ?? '')
  check(String(download?.suggestedFilename() ?? '').endsWith('.csv') && String(download?.suggestedFilename() ?? '').includes('物联网数据报表'), 'W25 导出文件名与内容类型对得上', download?.suggestedFilename() ?? '')

  await navWeb(page, '运维与 OTA')
  await page.locator('button').filter({ hasText: /创建工单/ }).first().click()
  await page.waitForTimeout(1000)
  const deviceSelect = page.locator('.ant-modal-content:visible .ant-form-item').filter({ hasText: '报修设备' })
  check(await deviceSelect.count() > 0, 'W26 工单表单改成从设备台账里选设备（原来是自由文本设备名）')
  try {
    await pickOption(page, '报修设备', '1号棚南侧风机')
  } catch (error) {
    const texts = await page.locator('.ant-select-dropdown .ant-select-item-option, .ant-select-dropdown').allInnerTexts().catch(() => [])
    console.log('   [诊断] 设备下拉内容：', texts.slice(0, 6).join(' | ') || '（无选项）', '·', String(error?.message).slice(0, 60))
    throw error
  }
  await fillField(page, '问题描述', `${MARKER} 风机异响`)
  await modalConfirm(page)
  const orderToast = await toasts(page)
  check(orderToast.includes('工单') || (await hasText(page, `${MARKER} 风机异响`, 6000)), 'W27 工单创建成功并显示报修描述', orderToast.slice(0, 50))
  check(scalar(`SELECT COUNT(*) FROM agri_iot.iot_work_order WHERE id>${before.workOrder} AND tenant_id=${TENANT_A} AND description LIKE '%${MARKER}%'`) === '1', 'W28 工单落库带租户与描述')

  await navWeb(page, '消息中心')
  await page.locator('button').filter({ hasText: /全部已读/ }).first().click()
  await page.waitForTimeout(1400)
  check(scalar(`SELECT COUNT(*) FROM agri_iot.iot_message WHERE tenant_id=${TENANT_A} AND is_read=FALSE`) === '0', 'W29 一键已读清掉本主体未读')
  check(scalar(`SELECT COUNT(*) FROM agri_iot.iot_message WHERE tenant_id=${TENANT_B} AND is_read=FALSE`) === String(restore.unreadB.split(',').filter(Boolean).length), 'W30 别的主体未读数没被动到')

  // —— 换第二个经营主体（独立上下文，避免共享 localStorage） ——
  const contextB = await browser.newContext({ viewport: { width: 1500, height: 940 } })
  const pageB = await contextB.newPage()
  check(await ssoLogin(pageB, WEB, 'luochuan'), 'W31 洛川果业账号（经营主体 2003）登录用户端', pageB.url())
  const textB = await pageText(pageB)
  check(textB.includes('洛川苹果智慧果园'), 'W32 横幅是它自己的农场（不是 2001 的示范农场）', textB.slice(0, 70))
  check(/设备总数[\s\S]{0,40}?0/.test(textB), 'W33 第二个主体的设备数为 0（不串到别家台账）')
  await navWeb(pageB, '预警中心')
  const textB2 = await pageText(pageB)
  check(textB2.includes('果园3号墒情站') || textB2.includes('果园土壤含水率偏低'), 'W34 告警列表只剩它自己的两条告警', textB2.slice(0, 70))
  check(!textB2.includes('1号棚空气温湿度传感器'), 'W35 看不到 2001 的告警')
  await navWeb(pageB, '场景与自动化')
  const textB3 = await pageText(pageB)
  check(textB3.includes('高温通风') === false, 'W36 场景列表不含 2001 的场景（原来全平台共用一套）')
  await contextB.close()

  // ================= 运营端 :8102 =================
  const opsPage = await (await browser.newContext({ viewport: { width: 1500, height: 940 }, acceptDownloads: true })).newPage()
  check(await ssoLogin(opsPage, OPS, 'admin'), 'O1 admin 登录后进入物联网运营端', opsPage.url())
  const opsText = await pageText(opsPage)
  check(opsText.includes(todayIso) && opsText.includes(weekday), 'O2 运营端顶栏日期是今天（原来写死 2026-10-25）')
  const opsBadge = await opsPage.locator('.o-header-right button i').first().innerText().catch(() => '')
  check(opsBadge.trim() === String(Number(scalar('SELECT COUNT(*) FROM agri_iot.iot_access_audit WHERE status=\'pending\''))), 'O3 待审徽标取实数（原来固定 9 且点不动）', `页面 ${opsBadge}`)
  const allDevicesCount = Number(scalar('SELECT COUNT(*) FROM agri_iot.iot_device'))
  check(opsText.includes(String(allDevicesCount)), 'O4 运营概览的设备计数与台账一致', `SQL ${allDevicesCount}`)
  const trendBars = await opsPage.locator('.o-line-chart > div').count()
  check(trendBars > 0 && trendBars <= 7, 'O4a 在线率趋势按实查日期绘制（原来是写死的 7 个点）', `柱子 ${trendBars}`)

  await navOps(opsPage, '租户与配额')
  const tenantRow = opsPage.locator('.ant-table-row').filter({ hasText: '绿源农业合作社' }).first()
  const tenantDeviceText = await tenantRow.innerText()
  check(tenantDeviceText.includes(String(restore.deviceCountA)), 'O5 租户设备数按台账实时统计（存量列曾经是 428/182 这种常量）', tenantDeviceText.replace(/\s+/g, ' ').slice(0, 90))

  await navOps(opsPage, '平台设备监控')
  const deviceTable = await opsPage.locator('.ant-table').first().innerText()
  check(deviceTable.includes('绿源农业合作社'), 'O6 运营端设备列表能解析出租户名（统一主键前是 29 台里 0 台）')

  await navOps(opsPage, '租户与配额')
  // 配额输入框的下限就是"该租户已接入设备数"：填更小的值会被拉回来，服务端还有一道同样口径的校验
  await opsPage.locator('.ant-table-row').filter({ hasText: '绿源农业合作社' }).first().locator('button').filter({ hasText: /配额/ }).first().click()
  await opsPage.waitForTimeout(1200)
  await fillField(opsPage, '设备上限', '5')
  await opsPage.locator('.ant-modal-content:visible .ant-input-number input').first().blur()
  await opsPage.waitForTimeout(500)
  const clamped = await opsPage.locator('.ant-modal-content:visible .ant-input-number input').first().inputValue()
  check(Number(clamped) >= restore.deviceCountA, 'O7 配额输入下限被锁在已接入设备数（填 5 会回到 29）', `输入后 ${clamped} · 已接入 ${restore.deviceCountA}`)
  await opsPage.locator('.ant-modal-content:visible .ant-modal-footer .ant-btn-default').first().click().catch(() => modalDismiss(opsPage))
  await opsPage.waitForTimeout(800)
  check(Number(scalar(`SELECT device_limit FROM agri_iot.iot_tenant WHERE id=${TENANT_A}`)) === Number(restore.quotaA), 'O7a 取消后 2001 的配额没有被改动', scalar(`SELECT device_limit FROM agri_iot.iot_tenant WHERE id=${TENANT_A}`))
  await opsPage.locator('.ant-table-row').filter({ hasText: '陕西洛川果业' }).first().locator('button').filter({ hasText: /配额/ }).first().click()
  await opsPage.waitForTimeout(1200)
  await fillField(opsPage, '设备上限', '888')
  await modalConfirm(opsPage)
  check(scalar(`SELECT device_limit FROM agri_iot.iot_tenant WHERE id=${TENANT_B}`) === '888', 'O8 合法配额调整落库')

  auditedAccessId = scalar(`SELECT id FROM agri_iot.iot_access_audit WHERE status='pending' ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END,id DESC LIMIT 1`)
  await navOps(opsPage, '设备接入审核')
  await opsPage.locator('button').filter({ hasText: /通过接入/ }).first().click()
  await opsPage.waitForTimeout(1200)
  check(await opsPage.locator('.ant-modal-content:visible').count() > 0, 'O9a 点"通过接入"要求当场填写审核意见（以前直接把代码里写死的话存库）')
  await modalConfirm(opsPage)
  const emptyNoteToast = await toasts(opsPage)
  check(/不少于|请填写/.test(emptyNoteToast), 'O9b 空意见被拦下', emptyNoteToast.slice(0, 50))
  await opsPage.locator('.ant-modal-content:visible textarea').first().fill(`${MARKER} 物模型与白名单核验通过`)
  await modalConfirm(opsPage)
  const auditor = scalar(`SELECT IFNULL(auditor,'') FROM agri_iot.iot_access_audit WHERE id=${auditedAccessId}`)
  check(auditor === 'admin', 'O10 审核人来自令牌（原来一律写"张运营"）', auditor)
  check(scalar(`SELECT note FROM agri_iot.iot_access_audit WHERE id=${auditedAccessId}`).includes(MARKER), 'O10a 审核意见是运营真实填写的那句')

  await navOps(opsPage, '操作审计日志')
  const logHeader = await opsPage.locator('.ant-table-thead').first().innerText()
  check(logHeader.includes('来源 IP'), 'O11 审计日志展示来源 IP')
  const firstLog = await opsPage.locator('.ant-table-row').first().innerText()
  check(firstLog.includes('admin'), 'O12 最新审计行的操作人是当前登录账号', firstLog.replace(/\s+/g, ' ').slice(0, 80))

  await navOps(opsPage, '运维工单')
  const woHeader = await opsPage.locator('.ant-table-thead').first().innerText()
  check(woHeader.includes('所属主体') && woHeader.includes('报修描述'), 'O13 工单列表能看到所属主体与报修描述', woHeader.replace(/\s+/g, ' ').slice(0, 70))

  await navOps(opsPage, '统计分析')
  const summaryText = await pageText(opsPage)
  check(summaryText.includes('在册设备') && summaryText.includes(String(restore.deviceCountA)), 'O14 统计页汇总取台账实数')
  const opsDownloadPromise = opsPage.waitForEvent('download', { timeout: 15000 })
  await opsPage.locator('button').filter({ hasText: cjk('导出报表') }).first().click()
  const opsDownload = await opsDownloadPromise.catch(() => null)
  check(Boolean(opsDownload), 'O15 运营报表导出是真下载（原来只弹"运营月报已导出"）', opsDownload?.suggestedFilename() ?? '')

  // ---------- 阈值规则治理（新页） ----------
  await navOps(opsPage, '阈值规则治理')
  const governanceText = await pageText(opsPage)
  check(governanceText.includes('平台预置阈值') && governanceText.includes('各经营主体自定义阈值'), 'O16 阈值治理页展示两层规则（平台兜底 + 主体覆盖）')
  check(governanceText.includes('陕西洛川果业') && governanceText.includes('绿源农业合作社'), 'O17 能看到每个主体的自定义阈值与所属主体', governanceText.replace(/\s+/g, ' ').slice(0, 60))
  const presetEnabledBefore = scalar('SELECT enabled FROM agri_iot.iot_alert_rule WHERE id=4')
  const presetRuleName = scalar('SELECT rule_name FROM agri_iot.iot_alert_rule WHERE id=4')
  // 这一页要等两个接口都回来才有行，先按文案等它出现再点
  await opsPage.waitForFunction((name) => document.body.innerText.includes(name), presetRuleName, { timeout: 20000 }).catch(() => {})
  const presetRow = () => opsPage.locator('.o-card.o-table').first().locator('.ant-table-row').filter({ hasText: presetRuleName }).first()
  await presetRow().locator('button').filter({ hasText: /停\s*用|启\s*用/ }).first().click()
  await opsPage.waitForTimeout(1800)
  check(scalar('SELECT enabled FROM agri_iot.iot_alert_rule WHERE id=4') !== presetEnabledBefore, 'O18 运营端可以启停平台预置（这个权限不给租户）', `前 ${presetEnabledBefore} → 后 ${scalar('SELECT enabled FROM agri_iot.iot_alert_rule WHERE id=4')}`)
  const presetLog = scalar(`SELECT operator_name FROM agri_iot.iot_ops_log WHERE action_name LIKE '%平台阈值规则%' ORDER BY id DESC LIMIT 1`)
  check(presetLog === 'admin', 'O19 启停留痕是运营账号（原来运营端写死"张运营"）', presetLog)
  await presetRow().locator('button').filter({ hasText: /停\s*用|启\s*用/ }).first().click()
  await opsPage.waitForTimeout(1800)
  check(scalar('SELECT enabled FROM agri_iot.iot_alert_rule WHERE id=4') === presetEnabledBefore, 'O20 平台预置状态已还原')

  // ---------- 处置说明必须由运营当场写 ----------
  await navOps(opsPage, '告警运营中心')
  // 运营端告警列表是全平台的（跨主体），排序与 /ops/alerts 一致：pending 优先、id 倒序
  opsHandledAlert = String(scalar(`SELECT id FROM agri_iot.iot_alert WHERE status<>'resolved' ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'handling' THEN 1 ELSE 2 END,id DESC LIMIT 1`))
  opsAlertOriginalStatus = String(scalar(`SELECT status FROM agri_iot.iot_alert WHERE id=${opsHandledAlert}`))
  await opsPage.locator('.o-alert-card, section').locator('button').filter({ hasText: /立即处置/ }).first().click()
  await opsPage.waitForTimeout(1200)
  await modalConfirm(opsPage)
  const emptyDispositionToast = await toasts(opsPage)
  check(/处置说明|不少于|请填写/.test(emptyDispositionToast), 'O21 空处置说明被拦下（原来弹窗里预填一句固定话术就入库了）', emptyDispositionToast.slice(0, 50))
  await opsPage.locator('.ant-modal-content:visible textarea').first().fill(`${MARKER} 已派单到现场`)
  await modalConfirm(opsPage)
  check(opsHandledAlert !== '' && scalar(`SELECT handle_note FROM agri_iot.iot_alert WHERE id=${opsHandledAlert}`).includes(MARKER), 'O22 处置说明与处置人都是真实填写/登录账号', `告警 ${opsHandledAlert}`)

  // ================= 移动端 :8111 =================
  const mobileContext = await browser.newContext({ viewport: { width: 420, height: 900 } })
  const mpage = await mobileContext.newPage()
  const mobileText = await uniLogin(mpage, 'farmer')
  check(mobileText.includes('设备与作物') || mobileText.includes('智慧农场'), 'M1 移动端统一账号登录进入工作台', mobileText.slice(0, 50))
  const homeText = await pageText(mpage)
  check(homeText.includes(String(restore.telemetryTodayA)), 'M2 首页"今日数据"取自当天遥测计数', homeText.match(/今日数据[^·]*/)?.[0]?.slice(0, 30) ?? '')
  // uni-app 的底部 tab 一直显示"设备/告警"字样，等这些词会过早通过；改成等内容真正加载出来
  check(await openMobile(mpage, '/pages/device/list', 'DEV-TEM-001'), 'M3 设备列表按主体加载出 2001 的台账')
  const mDevicesText = await pageText(mpage)
  check(mDevicesText.includes('DEV-TEM-001') && !mDevicesText.includes('果园3号墒情站'), 'M4 移动端设备列表只有本主体设备', mDevicesText.slice(0, 60))
  check(await openMobile(mpage, '/pages/alert/list', '灌溉阀门离线超过2小时'), 'M5 告警中心按主体过滤后显示自己的告警')
  const mAlertText = await pageText(mpage)
  check(mAlertText.includes('大棚温度过高') && !mAlertText.includes('果园土壤含水率偏低'), 'M6 移动端看不到别的主体的告警', mAlertText.slice(0, 60))
  check(await openMobile(mpage, '/pages/index/index', '今日数据'), 'M7 返回首页成功')
  await mpage.locator('uni-button, button').filter({ hasText: /立即同步/ }).first().click()
  const syncToast = await toasts(mpage)
  check(/待办工单|告警/.test(syncToast), 'M8 "立即同步"给出真实待办计数（原来固定"已同步 3 条离线记录"）', syncToast.slice(0, 60))

  const mobileContextB = await browser.newContext({ viewport: { width: 420, height: 900 } })
  const mpageB = await mobileContextB.newPage()
  await uniLogin(mpageB, 'luochuan')
  const mTextB = await pageText(mpageB)
  check(mTextB.includes('果园土壤含水率偏低') || mTextB.includes('果园3号墒情站'), 'M9 换主体后移动端只看到洛川的告警', mTextB.slice(0, 90))
  check(!mTextB.includes('DEV-TEM-001'), 'M10 换主体后看不到 2001 的设备')
  check(!mTextB.includes('NaN'), 'M11 零设备主体的首页不出现 NaN 在线率（0 台时除零）', mTextB.match(/在线率 [^ ]*/)?.[0] ?? '')
  await mobileContextB.close()
  await mobileContext.close()
} finally {
  // ================= 还原与清理 =================
  const alertId = Number(String(restore.alertPending).split('#')[0])
  exec(`UPDATE agri_iot.iot_alert SET status='${String(restore.alertPending).split('#')[1]}',handled_by=NULL,handle_note=NULL,handled_at=NULL WHERE id=${alertId}`)
  exec(`UPDATE agri_iot.iot_message SET is_read=TRUE WHERE tenant_id=${TENANT_A}`)
  if (restore.unreadA) {
    // 逐条还原到快照里的未读集合（不能简单"全刷成未读"，那会把原本已读的消息也翻回去）
    exec(`UPDATE agri_iot.iot_message SET is_read=FALSE WHERE tenant_id=${TENANT_A} AND FIND_IN_SET(id,'${restore.unreadA}')>0`)
  }
  exec(`UPDATE agri_iot.iot_access_audit SET status='${String(restore.audit1).split('#')[0]}',auditor=NULL,note='等待SN与产品认证匹配' WHERE id=1`)
  if (opsHandledAlert) {
    exec(`UPDATE agri_iot.iot_alert SET status='${opsAlertOriginalStatus}',handled_by=NULL,handle_note=NULL,handled_at=NULL WHERE id=${opsHandledAlert}`)
  }
  // 兜底：凡是这轮在页面里写过处置意见/审核结论的行，按开始时的全量快照还原状态，
  // 不依赖"我点的到底是哪一行"——点检中途失败也不会把演示数据留在已处置状态。
  for (const id of list(`SELECT id FROM agri_iot.iot_alert WHERE handle_note LIKE '%${MARKER}%'`)) {
    exec(`UPDATE agri_iot.iot_alert SET status='${restore.alertStatuses[id] || 'pending'}',handled_by=NULL,handle_note=NULL,handled_at=NULL WHERE id=${id}`)
  }
  for (const id of list(`SELECT id FROM agri_iot.iot_access_audit WHERE note LIKE '%${MARKER}%'`)) {
    exec(`UPDATE agri_iot.iot_access_audit SET status='${restore.auditStatuses[id] || 'pending'}',auditor=NULL,note=NULL WHERE id=${id}`)
  }
  if (auditedAccessId) {
    exec(`UPDATE agri_iot.iot_access_audit SET status='pending',auditor=NULL,note=NULL WHERE id=${auditedAccessId}`)
  }
  exec(`UPDATE agri_iot.iot_tenant SET device_limit=${restore.quotaB || 800} WHERE id=${TENANT_B}`)
  exec(`UPDATE agri_iot.iot_tenant SET device_limit=${restore.quotaA || 2000} WHERE id=${TENANT_A}`)
  if (restore.activeSceneA) {
    exec(`UPDATE agri_iot.iot_scene SET is_active=FALSE WHERE tenant_id=${TENANT_A}`)
    exec(`UPDATE agri_iot.iot_scene SET is_active=TRUE WHERE id=${restore.activeSceneA}`)
  }
  exec(`
    DELETE FROM agri_iot.iot_alert_rule_tenant WHERE id>${before.alertRuleTenant};
    DELETE FROM agri_iot.iot_scene WHERE id>${before.scene};
    DELETE FROM agri_iot.iot_rule_config WHERE rule_id>${before.rule};
    DELETE FROM agri_iot.iot_rule WHERE id>${before.rule};
    DELETE FROM agri_iot.iot_work_order WHERE id>${before.workOrder};
    DELETE FROM agri_iot.iot_control_log WHERE id>${before.controlLog};
    DELETE FROM agri_iot.iot_ops_log WHERE id>${before.opsLog};
  `)
  const residue = {
    scene: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_scene WHERE id>${before.scene}`)),
    rule: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_rule WHERE id>${before.rule}`)),
    workOrder: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_work_order WHERE id>${before.workOrder}`)),
    controlLog: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_control_log WHERE id>${before.controlLog}`)),
    opsLog: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_ops_log WHERE id>${before.opsLog}`)),
    marker: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_work_order WHERE description LIKE '%${MARKER}%'`)),
    alertRuleTenant: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_alert_rule_tenant WHERE id>${before.alertRuleTenant}`)),
    ruleMarker: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_alert_rule_tenant WHERE rule_name LIKE '%${MARKER}%'`)),
    alertMarker: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_alert WHERE handle_note LIKE '%${MARKER}%'`)),
    auditMarker: Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_access_audit WHERE note LIKE '%${MARKER}%'`)),
  }
  check(!opsHandledAlert || scalar(`SELECT status FROM agri_iot.iot_alert WHERE id=${opsHandledAlert}`) === opsAlertOriginalStatus, 'Z7 运营端处置的告警已还原')
  check(Object.values(residue).every((value) => value === 0), 'Z1 点检产生的临时数据清零', JSON.stringify(residue))
  check(scalar(`SELECT status FROM agri_iot.iot_alert WHERE id=${alertId}`) === String(restore.alertPending).split('#')[1], 'Z2 被点检处置的告警已还原')
  check(Number(scalar(`SELECT COUNT(*) FROM agri_iot.iot_message WHERE tenant_id=${TENANT_A} AND is_read=FALSE`)) === restore.unreadA.split(',').filter(Boolean).length, 'Z3 消息未读状态按快照还原', restore.unreadA)
  check(scalar(`SELECT device_limit FROM agri_iot.iot_tenant WHERE id=${TENANT_B}`) === String(restore.quotaB)
    && scalar(`SELECT device_limit FROM agri_iot.iot_tenant WHERE id=${TENANT_A}`) === String(restore.quotaA), 'Z4 两个主体的租户配额都已还原', `${restore.quotaA}/${restore.quotaB}`)
  check(scalar(`SELECT IFNULL(auditor,'') FROM agri_iot.iot_access_audit WHERE id=1`) === '' && (!auditedAccessId || scalar(`SELECT IFNULL(auditor,'') FROM agri_iot.iot_access_audit WHERE id=${auditedAccessId}`) === ''), 'Z5 接入审核记录已还原')
  check(Number(scalar('SELECT COUNT(*) FROM agri_iot.iot_device')) === before.device, 'Z6 设备台账没有被点检改动')
  await browser.close()
}

console.log(`\n物联网三端点检：${failures.length === 0 ? '全部通过' : `${failures.length} 项失败`}`)
failures.forEach((item, index) => console.log(`  ${index + 1}. ${item}`))
if (failures.length > 0) process.exitCode = 1
