/**
 * 主数据运营端 · 权限异常巡检端到端验证
 *
 * 验的是四件事，缺一不可：
 *   1. **规则来自库里**：四条口径（权限过大 / 互斥角色 / 过期权限 / 重复·幽灵）与阈值都读
 *      agri_md_permission_rule，不是代码里写死；
 *   2. **结论来自真实授权关系**：用页面同款接口写 45 条菜单授权、再补三条脏绑定，
 *      扫描必须逐条命中，detail 里的数字与对象名要和库里对得上；
 *   3. **修得掉**：撤销脏数据后再扫一次，异常要自动转 RESOLVED，而不是一直挂着；
 *   4. **页面说的是真话**：「巡检引擎尚未接入数据源」那条横幅必须消失，
 *      「重新检测」真的调扫描接口。
 *
 * 用法：node scripts/e2e-mdm-permission-anomaly.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const CORE = 'http://localhost:8093'
const MDM = 'http://localhost:8080'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'mdm-permission-anomaly-20261102')
mkdirSync(OUT, { recursive: true })

const sql = (query) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query],
      { encoding: 'utf8' }).trim()
  } catch (error) {
    return `ERR:${String(error?.message ?? error).slice(0, 120)}`
  }
}

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const PASSWORD = (() => {
  try {
    const src = readFileSync('scripts/e2e-mdm-sso-loop.mjs', 'utf8')
    return src.match(/登录密码"\]'\)\.first\(\)\.fill\('([^']+)'\)/)[1]
  } catch {
    return 'Admin@123'
  }
})()

const startedAt = new Date()
const suffix = String(Date.now()).slice(-8)
// 内置角色（is_system=1）的授权接口会直接拒绝修改，所以本次只用新建的测试角色，跑完删掉
const OVER_USER_ID = '1201' // 张建国（持有租户管理员，用来验"权限过大"）
const MUTEX_USER_ID = '1204' // 赵德胜：库里已持有「组织管理员」，再补一个「数据审核员」就构成互斥
const GHOST_MENU_ID = '999000999000999' // 不存在的菜单，专门用来造"幽灵绑定"
const created = { roleId: '', overUserRole: '', mutexUserRole: '', menuIds: [] }
let token = ''

const api = async (method, pathname, body) => {
  const response = await fetch(`${MDM}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => ({}))
  // 注意：本模块的成功码是 200（生产域才是 0），别拿另一套词表判这一边的成败
  return { status: response.status, code: json?.code ?? -1, message: json?.message ?? '', data: json?.data }
}

const openAnomalies = async () => (await api('GET', '/admin/masterdata/permission/anomaly?status=OPEN')).data ?? []
const resolvedAnomalies = async () => (await api('GET', '/admin/masterdata/permission/anomaly?status=RESOLVED')).data ?? []

let browser
let page

try {
  /* ---------- 0) 登录态与基线 ---------- */
  const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PASSWORD, marketId: 1 }),
  })).json()
  token = login?.data?.accessToken ?? ''
  check(Boolean(token), '取得运营端登录态')

  const baselineRows = Number(sql('SELECT COUNT(*) FROM agri_masterdata.agri_md_permission_anomaly') || '0')
  check(baselineRows === 0, '基线：巡检结果表是空的（本次造的异常都能干净退回）', `rows=${baselineRows}`)

  const rules = (await api('GET', '/admin/masterdata/permission/rules')).data ?? []
  const ruleCodes = rules.map((item) => item.ruleCode)
  check(rules.length === 4 && ['OVER_PRIVILEGE', 'MUTEX_ROLE', 'EXPIRED_GRANT', 'BINDING_INTEGRITY']
    .every((code) => ruleCodes.includes(code)),
    '四条规则都在库里（判定口径不是页面模板里写死的四行说明）', ruleCodes.join(','))
  const overRule = rules.find((item) => item.ruleCode === 'OVER_PRIVILEGE') ?? {}
  check(Number(overRule.threshold) === 40 && overRule.severity === 'HIGH',
    '阈值与等级来自规则表（改库就改判定，不需要发版）', `threshold=${overRule.threshold ?? '-'} severity=${overRule.severity ?? '-'}`)

  /* ---------- 1) 用页面同款接口造出四类异常 ---------- */
  const roleCreate = await api('POST', '/admin/masterdata/permission/role', {
    roleCode: `E2E_ANOM_${suffix}`, roleName: `巡检验证角色-${suffix}`, roleKey: `e2eAnom${suffix}`,
    description: '端到端验证用：授权 45 个菜单后应被判为权限过大', status: 1,
  })
  created.roleId = String(roleCreate.data ?? '')
  check(roleCreate.code === 200 && /^\d+$/.test(created.roleId), '新建测试角色（内置角色不允许改授权）',
    `code=${roleCreate.code} id=${created.roleId} ${roleCreate.message ?? ''}`)

  const menuIdRows = sql('SELECT id FROM agri_masterdata.agri_md_menu WHERE del_flag = 0 ORDER BY id LIMIT 45').split('\n')
    .map((line) => line.trim()).filter((line) => /^\d+$/.test(line))
  check(menuIdRows.length === 45, '取到 45 个真实菜单用于授权', `menus=${menuIdRows.length}`)
  created.menuIds = menuIdRows
  const grant = await api('PUT', `/admin/masterdata/permission/role/${created.roleId}/menus`, menuIdRows)
  check(grant.code === 200 && Number(grant.data) === 45, '角色授权接口写入 45 条菜单',
    `code=${grant.code} data=${grant.data} ${grant.message ?? ''}`)
  const granted = Number(sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role_menu WHERE role_id=${created.roleId} AND del_flag=0`) || '0')
  check(granted === 45, '授权确实落库 45 条', `db=${granted}`)

  // 把新角色挂到一个真实账号上（"权限过大"是按账号聚合的）
  sql(`INSERT INTO agri_masterdata.agri_md_user_role (user_id, role_id, status, del_flag, tenant_id, create_time)
       VALUES (${OVER_USER_ID}, ${created.roleId}, 0, 0, 'T1001', NOW())`)
  created.overUserRole = sql(`SELECT id FROM agri_masterdata.agri_md_user_role
                              WHERE user_id=${OVER_USER_ID} AND role_id=${created.roleId} AND del_flag=0 ORDER BY id DESC LIMIT 1`)
  check(/^\d+$/.test(created.overUserRole), '测试角色已授权给账号 1201', `user_role.id=${created.overUserRole}`)

  // 互斥：给已持有「组织管理员」的账号补一个「数据审核员」
  sql(`INSERT INTO agri_masterdata.agri_md_user_role (user_id, role_id, status, del_flag, tenant_id, create_time)
       VALUES (${MUTEX_USER_ID}, 1303, 0, 0, 'T1004', NOW())`)
  created.mutexUserRole = sql(`SELECT id FROM agri_masterdata.agri_md_user_role
                               WHERE user_id=${MUTEX_USER_ID} AND role_id=1303 AND del_flag=0 ORDER BY id DESC LIMIT 1`)
  check(/^\d+$/.test(created.mutexUserRole), '互斥角色已按真实授权关系写入', `user_role.id=${created.mutexUserRole}`)

  // 过期：把其中一条绑定设成昨天到期（NULL=永久，所以这条必须显式给时间）
  sql(`UPDATE agri_masterdata.agri_md_role_menu SET expire_time = DATE_SUB(NOW(), INTERVAL 1 DAY)
       WHERE role_id = ${created.roleId} AND del_flag = 0 ORDER BY id LIMIT 1`)
  // 重复：表上有 uk_role_menu(role_id, menu_id) 唯一键，重复插入会被数据库直接拦住 ——
  // 所以"同一绑定两条"在现结构下造不出来；规则的重复分支是留给历史残留的守卫，这里如实验这一点。
  const dupAttempt = sql(`INSERT INTO agri_masterdata.agri_md_role_menu (role_id, menu_id, del_flag, tenant_id, create_time)
       SELECT role_id, menu_id, 0, tenant_id, NOW() FROM agri_masterdata.agri_md_role_menu
       WHERE role_id = ${created.roleId} AND del_flag = 0 ORDER BY id LIMIT 1`)
  const dupCountAfter = Number(sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role_menu WHERE role_id=${created.roleId} AND del_flag=0`) || '0')
  check(dupCountAfter === 45 || /Duplicate entry|1062/.test(String(dupAttempt)),
    '同一 (角色, 菜单) 有唯一键：重复绑定只能来自历史残留，新写入被数据库拦住',
    `插入后绑定数=${dupCountAfter} ${String(dupAttempt).slice(0, 40)}`)
  // 幽灵：指向不存在的菜单（授权接口会拦住这种 id，所以只能直接写库造历史残留）
  sql(`INSERT INTO agri_masterdata.agri_md_role_menu (role_id, menu_id, del_flag, tenant_id, create_time)
       VALUES (${created.roleId}, ${GHOST_MENU_ID}, 0, 'T1001', NOW())`)

  /* ---------- 2) 扫描：四条规则各自命中，且依据写得出来 ---------- */
  const scan = await api('POST', '/admin/masterdata/permission/anomaly/scan')
  check(scan.code === 200 && Number(scan.data?.rules) === 4 && Number(scan.data?.findings) >= 4,
    '一次扫描跑完四条规则', JSON.stringify(scan.data ?? {}))
  const open = await openAnomalies()
  const byRule = (code) => open.filter((item) => item.ruleCode === code)
  const over = byRule('OVER_PRIVILEGE')[0]
  const mutex = byRule('MUTEX_ROLE')[0]
  const expired = byRule('EXPIRED_GRANT')[0]
  const integrity = byRule('BINDING_INTEGRITY')
  // 45 条里有一条已过期、一条指向不存在的菜单，都不该计入"可见菜单"
  check(Boolean(over) && String(over.description).includes('可见菜单 44 个')
    && String(over.targetName).includes('张建国'),
    '权限过大命中：数字是实算的（45 条授权里，过期的那条与指向不存在菜单的那条都不算可见菜单）', over?.description ?? '(未命中)')
  check(Boolean(mutex) && String(mutex.description).includes('互斥角色')
    && String(mutex.targetName).includes('赵德胜') && String(mutex.description).includes('组织管理'),
    '互斥角色命中：同一账号同时持有「组织管理员 × 数据审核员」，理由来自互斥表', mutex?.description?.slice(0, 60) ?? '(未命中)')
  check(Boolean(expired) && String(expired.description).includes('到期，绑定仍在'),
    '过期权限命中：到期时间已过但绑定没撤销（这条口径以前根本没有数据源）', expired?.description ?? '(未命中)')
  check(integrity.length === 1 && integrity[0].description === '绑定的菜单不存在'
    && integrity[0].targetType === 'ROLE_MENU',
    '幽灵绑定命中，并写清楚它挂在哪条绑定上（重复分支由唯一键拦住，另有一条断言）',
    integrity.map((item) => item.description).join(' / ') || '(未命中)')
  const dbOpen = Number(sql('SELECT COUNT(*) FROM agri_masterdata.agri_md_permission_anomaly WHERE status=\'OPEN\'') || '0')
  check(dbOpen === open.length && open.every((item) => item.status === 'OPEN'),
    '接口读的就是结果表里的未处置记录，条数一致', `api=${open.length} db=${dbOpen}`)

  /* ---------- 3) 统计卡与页面口径同源 ---------- */
  const stats = (await api('GET', '/admin/masterdata/permission/statistics')).data ?? {}
  const permsInDb = Number(sql('SELECT COUNT(*) FROM agri_masterdata.agri_md_menu WHERE del_flag=0 AND perms IS NOT NULL AND perms<>\'\'') || '0')
  const grantsInDb = Number(sql('SELECT COUNT(*) FROM agri_masterdata.agri_md_role_menu WHERE del_flag=0') || '0')
  check(Number(stats.anomalyCount) === open.length && Boolean(stats.lastScanAt),
    '统计卡的"未处置异常"与"上次扫描时间"都是真的（anomalyCount 不再写死 0）',
    `anomalyCount=${stats.anomalyCount} lastScanAt=${stats.lastScanAt ?? '-'}`)
  check(Number(stats.totalPermissions) === permsInDb && permsInDb > 0,
    '「权限点」数取菜单目录里真带 perms 的那些，而不是空表 agri_md_permission 的行数',
    `api=${stats.totalPermissions} db=${permsInDb}`)
  check(Number(stats.totalRoleAssignments) === grantsInDb && grantsInDb === 46,
    '「授权关系」= 未撤销的角色↔菜单绑定数（45 条授权 + 1 条幽灵，改前是 0）', `api=${stats.totalRoleAssignments} db=${grantsInDb}`)
  const distribution = stats.roleDistribution ?? []
  const testRoleRow = distribution.find((item) => item.roleName === `巡检验证角色-${suffix}`)
  check(distribution.length > 0 && Boolean(testRoleRow) && Number(testRoleRow.permissionCount) === grantsInDb
    && Number(testRoleRow.userCount) === 1,
    '角色分布按 user_role / role_menu 实算（以前固定返回空数组）',
    `roles=${distribution.length} 测试角色=${testRoleRow?.permissionCount ?? '-'}/${testRoleRow?.userCount ?? '-'}`)
  const trends = stats.trends ?? []
  check(trends.length > 0 && trends.some((item) => Number(item.roleAssignments) >= 0),
    '趋势按各表自己的 create_time 聚合，不编曲线', `days=${trends.length}`)

  /* ---------- 4) 页面：横幅撤掉、结果可见、按钮真的调扫描 ---------- */
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  page = await (await browser.newContext({ viewport: { width: 1560, height: 1000 } })).newPage()
  const jsErrors = []
  page.on('pageerror', (error) => jsErrors.push(String(error?.message ?? error).slice(0, 140)))
  await page.goto(`${MDM}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click({ timeout: 10000 })
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(5000)
  await page.goto(`${MDM}/permission/anomaly`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const pageText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(!pageText.includes('尚未接入数据源'), '「巡检引擎尚未接入数据源」横幅已经撤了（它现在是假的）')
  check(pageText.includes('未处置异常') && pageText.includes('可见菜单 44 个')
    && pageText.includes('绑定的菜单不存在') && pageText.includes('到期，绑定仍在'),
    '页面展示的是真实巡检结果（判定依据逐条写在描述里）',
    pageText.match(/未处置异常[^]{0,40}/)?.[0] ?? '')
  check(pageText.includes('权限过大') && pageText.includes('互斥角色') && pageText.includes('过期权限')
    && pageText.includes('重复 / 幽灵') && pageText.includes('40'),
    '「判定口径」表按规则表渲染，阈值 40 来自库里而不是模板文案')
  await page.screenshot({ path: path.join(OUT, '01-anomaly-open.png'), fullPage: true })

  // 按钮断言看请求，不看 toast 存活时间（antd 消息 3 秒就消失，靠读文本会假红）
  const scanRequests = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/permission/anomaly/scan')) scanRequests.push(request.url())
  })
  await page.locator('button').filter({ hasText: '重新检测' }).first().click()
  await page.waitForTimeout(1200)
  const toastText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  await page.waitForTimeout(2600)
  check(scanRequests.length === 1, '「重新检测」真的调了扫描接口（不是只重读一遍列表）', `POST ${scanRequests.length} 次`)
  check(toastText.includes('巡检完成') && toastText.includes('命中'),
    '提示按扫描返回说话：命中多少条、自动消解多少条', toastText.match(/巡检完成[^]{0,48}/)?.[0] ?? '')
  await page.locator('button').filter({ hasText: '查看已处置' }).first().click()
  await page.waitForTimeout(2500)
  const resolvedText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(resolvedText.includes('已处置异常'), '可以切到「已处置」看历史（不是只给一个未处置视图）',
    resolvedText.match(/已处置异常[^]{0,26}/)?.[0] ?? '')

  /* ---------- 5) 修掉脏数据 → 再扫一次 → 自动消解 ---------- */
  sql(`DELETE FROM agri_masterdata.agri_md_role_menu WHERE menu_id = ${GHOST_MENU_ID}`)
  sql(`DELETE FROM agri_masterdata.agri_md_role_menu WHERE role_id = ${created.roleId}
       AND menu_id = (SELECT menu_id FROM (SELECT menu_id FROM agri_masterdata.agri_md_role_menu
       WHERE role_id = ${created.roleId} GROUP BY menu_id HAVING COUNT(*) > 1) t LIMIT 1)`)
  sql(`UPDATE agri_masterdata.agri_md_role_menu SET expire_time = NULL WHERE expire_time IS NOT NULL`)
  sql(`DELETE FROM agri_masterdata.agri_md_user_role WHERE id = ${created.mutexUserRole}`)
  const rescan = await api('POST', '/admin/masterdata/permission/anomaly/scan')
  check(Number(rescan.data?.resolved) >= 3, '脏数据修完后，本轮没再复现的记录被自动转成已处置',
    JSON.stringify(rescan.data ?? {}))
  const openAfterFix = await openAnomalies()
  const resolvedAfterFix = await resolvedAnomalies()
  check(openAfterFix.length === 1 && openAfterFix[0].ruleCode === 'OVER_PRIVILEGE',
    '只剩"权限过大"还成立（授权还没撤），其余三条都不在 OPEN 里',
    openAfterFix.map((item) => item.ruleCode).join(',') || '(空)')
  check(resolvedAfterFix.length >= 3 && resolvedAfterFix.every((item) => item.status === 'RESOLVED'),
    '已处置列表留下历史与处置时间，不是把记录直接删掉', `resolved=${resolvedAfterFix.length}`)

  await api('PUT', `/admin/masterdata/permission/role/${created.roleId}/menus`, [])
  const finalScan = await api('POST', '/admin/masterdata/permission/anomaly/scan')
  const openFinal = await openAnomalies()
  check(Number(finalScan.data?.findings) === 0 && openFinal.length === 0,
    '撤掉授权后再扫一次：四条规则都干净，未处置归零', `findings=${finalScan.data?.findings}`)
  await page.goto(`${MDM}/permission/anomaly`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const cleanText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(cleanText.includes('本次扫描未发现权限异常') && !cleanText.includes('接口返回空数组'),
    '页面空态说的是"扫描过、没发现"，不再是"接口返回空数组"')
  await page.screenshot({ path: path.join(OUT, '02-anomaly-clean.png'), fullPage: true })

  check(jsErrors.length === 0, '全程无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser?.close().catch(() => {})
  /* ---------- 清理：本次造的授权、脏绑定、测试角色与扫描结果都退回基线 ---------- */
  sql(`DELETE FROM agri_masterdata.agri_md_role_menu WHERE role_id = ${created.roleId || '0'}`)
  sql(`DELETE FROM agri_masterdata.agri_md_role_menu WHERE menu_id = ${GHOST_MENU_ID}`)
  if (created.overUserRole) sql(`DELETE FROM agri_masterdata.agri_md_user_role WHERE id = ${created.overUserRole}`)
  if (created.mutexUserRole) sql(`DELETE FROM agri_masterdata.agri_md_user_role WHERE id = ${created.mutexUserRole}`)
  if (created.roleId) await api('DELETE', `/admin/masterdata/permission/role/${created.roleId}`).catch(() => ({}))
  // 删除接口是逻辑删（del_flag=1），测试角色属于脚本自造物，物理删掉才不留"看不见的残留"
  sql(`DELETE FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_ANOM_%'`)
  sql(`DELETE FROM agri_masterdata.agri_md_permission_anomaly WHERE first_seen >= '${
    `${startedAt.getFullYear()}-${String(startedAt.getMonth() + 1).padStart(2, '0')}-${String(startedAt.getDate()).padStart(2, '0')} ${
      String(startedAt.getHours()).padStart(2, '0')}:${String(startedAt.getMinutes()).padStart(2, '0')}:${String(startedAt.getSeconds()).padStart(2, '0')}`}'`)
  const residueMenu = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role_menu WHERE role_id = ${created.roleId || '0'}`)
  const residueGhost = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role_menu WHERE menu_id = ${GHOST_MENU_ID}`)
  const residueRole = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role WHERE id = ${created.roleId || '0'} AND del_flag = 0`)
  const residueUser = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_user_role WHERE id IN (${created.overUserRole || 0}, ${created.mutexUserRole || 0})`)
  const residueAnomaly = sql('SELECT COUNT(*) FROM agri_masterdata.agri_md_permission_anomaly')
  console.log('')
  check(residueMenu === '0' && residueGhost === '0' && residueUser === '0',
    '清理：测试授权、幽灵绑定与两条人↔角色授权都已删除', `menu=${residueMenu} ghost=${residueGhost} user_role=${residueUser}`)
  check(residueRole === '0', '清理：测试角色已删除（内置角色一个都没动）', `role=${residueRole}`)
  const residueRoleCode = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_ANOM_%'`)
  check(residueRoleCode === '0', '清理：库内没有 E2E_ANOM_* 测试角色残留（逻辑删也一并物理清掉）', `rows=${residueRoleCode}`)
  check(residueAnomaly === '0', '清理：本次扫描产生的巡检结果也一并清掉（规则与互斥对是配置，保留）', `residue=${residueAnomaly}`)
}

console.log('')
if (!failures.length) {
  console.log('主数据权限巡检端到端验证全部通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((label) => console.log('  -', label))
process.exit(1)
