/**
 * 主数据运营端 · 按钮级 / API 级权限点端到端验证
 *
 * 这一轮要验的不是"接口能返回 200"，而是一条授权语义真的成立：
 *   1. **目录来自代码**：权限点由当前应用的实际端点映射同步，只登记写方法，且可重复执行；
 *   2. **勾上即收紧**：某个端点被任意角色持有后，没持有它的账号调它就是 403；
 *      取消最后一个持有者，它回到"未纳管"（谁都能调）—— 四个状态都要实测；
 *   3. **两条豁免**：平台超管不受约束（否则把自己关在门外）；主体侧账号靠用户名桥接本地角色；
 *   4. **页面说的是真话**：矩阵页的「接口权限点」块、同步按钮、单元格切换都真的打到后端。
 *
 * 用法：node scripts/e2e-mdm-permission-points.mjs
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
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'mdm-permission-points-20261102')
mkdirSync(OUT, { recursive: true })

const sql = (query) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query],
      { encoding: 'utf8' }).trim()
  } catch (error) {
    return `ERR:${String(error?.message ?? error).slice(0, 160)}`
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

/** 被测端点：主体侧的"新建客户"。它不在运营端 RBAC 的 operator-paths 里，所以拦它的只有权限点这一层。 */
const TARGET_CODE = 'POST /api/customer'
const suffix = String(Date.now()).slice(-8)
const LOCAL_USER_ID = `92${suffix}01`
const created = { grantRole: '', holderRole: '', localUserId: '', userRoleId: '', permId: '' }
let token = ''
let farmerToken = ''

const call = async (method, pathname, body, bearer = token) => {
  const response = await fetch(`${MDM}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => ({}))
  // 本模块成功码是 200（生产域才是 0）；失败也走 HTTP 200 + 业务码，判成败只看业务码
  return { status: response.status, code: json?.code ?? -1, message: json?.message ?? '', data: json?.data }
}

/** 权限点拦不拦，只看这句文案 —— 403 与 400 在这一层是两回事，别用状态码混着判。 */
const blockedByPoint = (result) => String(result.message ?? '').includes('缺少权限点')
const holdersOfTarget = () => Number(sql(
  `SELECT COUNT(*) FROM agri_masterdata.agri_md_role_permission rp
     JOIN agri_masterdata.agri_md_permission p ON p.id = rp.perm_id
    WHERE p.perm_code = '${TARGET_CODE}' AND p.del_flag = 0`) || '0')

let browser
let page

try {
  /* ---------- 0) 两个登录态：超管 + 一个没有主数据权限的普通账号 ---------- */
  const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PASSWORD, marketId: 1 }),
  })).json()
  token = login?.data?.accessToken ?? ''
  check(Boolean(token), '取得运营端超管登录态')

  const farmerLogin = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'farmer', password: PASSWORD, marketId: 1 }),
  })).json()
  farmerToken = farmerLogin?.data?.accessToken ?? ''
  check(Boolean(farmerToken), '取得主体侧账号（farmer）登录态 —— 它不是超管，才会被权限点拦')

  check(holdersOfTarget() === 0, `基线：${TARGET_CODE} 没有任何角色持有（未纳管）`, `holders=${holdersOfTarget()}`)

  /* ---------- 1) 目录由真实端点同步 ---------- */
  const sync = await call('POST', '/admin/masterdata/permission/points/sync')
  check(sync.code === 200 && Number(sync.data?.scanned) > 300, '同步接口读到当前应用的实际端点映射',
    JSON.stringify(sync.data ?? {}))
  check(Number(sync.data?.created ?? 0) + Number(sync.data?.updated ?? 0) > 0,
    '目录写进 agri_md_permission（这张表本轮之前一直是 0 行）',
    `created=${sync.data?.created ?? 0} updated=${sync.data?.updated ?? 0}`)

  const rows = Number(sql('SELECT COUNT(*) FROM agri_masterdata.agri_md_permission WHERE del_flag = 0') || '0')
  check(rows > 100, '库里确有一百多个接口权限点', `rows=${rows}`)
  const badVerb = Number(sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_permission
    WHERE del_flag = 0 AND http_method NOT IN ('POST','PUT','DELETE','PATCH')`) || '0')
  check(badVerb === 0, '目录里只有写方法：读接口不会被"勾一个点"整片锁死', `非写方法=${badVerb}`)
  const authRows = Number(sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_permission
    WHERE perm_code LIKE '%/api/auth%'`) || '0')
  check(authRows === 0, '登录相关端点不参与权限点（误勾也不会把人锁在门外）', `rows=${authRows}`)
  const distinct = Number(sql('SELECT COUNT(DISTINCT perm_code) FROM agri_masterdata.agri_md_permission') || '0')
  const total = Number(sql('SELECT COUNT(*) FROM agri_masterdata.agri_md_permission') || '0')
  check(distinct === total && total > 0, 'perm_code 唯一：同一端点不会同步出第二条', `${distinct}/${total}`)

  const resync = await call('POST', '/admin/masterdata/permission/points/sync')
  check(resync.code === 200 && Number(resync.data?.created) === 0 && Number(resync.data?.retired) === 0,
    '再同步一次是幂等的：不新增、不下线，只刷新已有行',
    `created=${resync.data?.created} updated=${resync.data?.updated} retired=${resync.data?.retired}`)

  const points = (await call('GET', '/admin/masterdata/permission/points')).data ?? []
  check(points.length === rows, '页面读的 /points 与库里行数一致（没有第二份口径）', `api=${points.length} db=${rows}`)
  const target = points.find((item) => item.permCode === TARGET_CODE)
  created.permId = String(target?.id ?? '')
  check(Boolean(target) && target.granted === false && Number(target.roleCount) === 0,
    `目录里能查到 ${TARGET_CODE}，且当前未纳管`, `id=${created.permId} granted=${target?.granted} roleCount=${target?.roleCount}`)
  const searched = (await call('GET', '/admin/masterdata/permission/points?keyword=customer')).data ?? []
  check(searched.length > 0 && searched.length < points.length,
    'keyword 是服务端筛的（命中编码 / 名称 / 路径），不是页面本地过滤当前一屏',
    `${searched.length}/${points.length}`)

  /* ---------- 2) 旧权限点接口：不再"看着能用"，显式 410 ---------- */
  const goneTree = await call('GET', '/api/master-data/permissions/tree')
  check(goneTree.code === 410 && String(goneTree.message).includes('旧权限点接口已下线'),
    'GET /api/master-data/permissions/tree 明确 410（它不在 RBAC 覆盖内、且一调就抛 Invalid bound statement）',
    `code=${goneTree.code} ${String(goneTree.message).slice(0, 30)}`)
  const goneAssign = await call('PUT', '/api/master-data/roles/1/permissions', ['x'])
  check(goneAssign.code === 410, 'PUT /api/master-data/roles/{id}/permissions 同样 410（不留敞着的写入口）',
    `code=${goneAssign.code}`)

  /* ---------- 3) 授权接口本身 ---------- */
  const grantRoleCreate = await call('POST', '/admin/masterdata/permission/role', {
    roleCode: `E2E_PPG_${suffix}`, roleName: `权限点收紧方-${suffix}`, roleKey: `e2ePpg${suffix}`,
    description: '端到端验证用：持有该点后，端点即被纳管', status: 1,
  })
  created.grantRole = String(grantRoleCreate.data ?? '')
  const holderRoleCreate = await call('POST', '/admin/masterdata/permission/role', {
    roleCode: `E2E_PPH_${suffix}`, roleName: `权限点持有方-${suffix}`, roleKey: `e2ePph${suffix}`,
    description: '端到端验证用：farmer 桥接到这个角色', status: 1,
  })
  created.holderRole = String(holderRoleCreate.data ?? '')
  check(grantRoleCreate.code === 200 && holderRoleCreate.code === 200 && /^\d+$/.test(created.holderRole),
    '建两个测试角色（内置角色不允许改授权）', `grant=${created.grantRole} holder=${created.holderRole}`)

  const bogus = await call('PUT', `/admin/masterdata/permission/role/${created.grantRole}/points`, ['999999999999'])
  check(bogus.code === 400 && String(bogus.message).includes('不在目录里'),
    '给一个目录里不存在的权限点会被拒绝（不会造出永远匹配不上的授权）', `code=${bogus.code} ${bogus.message}`)

  /* ---------- 4) 四个状态：未纳管 → 收紧 → 放开 ---------- */
  const baseline = await call('POST', '/api/customer', {}, farmerToken)
  check(!blockedByPoint(baseline), '状态①：没人持有时不拦（未纳管 ≠ 拒绝）',
    `code=${baseline.code} ${String(baseline.message).slice(0, 40)}`)

  const grant1 = await call('PUT', `/admin/masterdata/permission/role/${created.grantRole}/points`, [created.permId])
  check(grant1.code === 200 && Number(grant1.data) === 1, '把端点授给"收紧方"角色：勾上即开始管',
    `code=${grant1.code} saved=${grant1.data}`)
  check(holdersOfTarget() === 1, '库里确有一条角色↔权限点授权（写进了 agri_md_role_permission.perm_id）')

  const readBack = await call('GET', `/admin/masterdata/permission/role/${created.grantRole}/points`)
  check(Array.isArray(readBack.data) && readBack.data.includes(created.permId),
    '角色权限点明细能回读（矩阵页格子读的就是这个接口）', JSON.stringify(readBack.data ?? []))

  const after = (await call('GET', '/admin/masterdata/permission/points?keyword=/api/customer')).data ?? []
  const targetAfter = after.find((item) => item.permCode === TARGET_CODE)
  check(targetAfter?.granted === true && Number(targetAfter?.roleCount) === 1,
    '目录行按真实授权显示 granted / roleCount（不是页面自己算的）',
    `granted=${targetAfter?.granted} roleCount=${targetAfter?.roleCount}`)

  const denied = await call('POST', '/api/customer', {}, farmerToken)
  check(blockedByPoint(denied) && denied.code === 403 && String(denied.message).includes(TARGET_CODE),
    '状态②：别人被拦了 —— 403 文案里带着缺的那个点', `code=${denied.code} ${String(denied.message).slice(0, 26)}`)

  const superOk = await call('POST', '/api/customer', {})
  check(!blockedByPoint(superOk), '平台超管（权限码含 *）不受这张矩阵约束',
    `code=${superOk.code} ${String(superOk.message).slice(0, 30)}`)

  // 取消 → 再勾上：uk_role_perm(role_id, perm_id) 下必须真的能重来
  const ungrant = await call('PUT', `/admin/masterdata/permission/role/${created.grantRole}/points`, [])
  const regrant = await call('PUT', `/admin/masterdata/permission/role/${created.grantRole}/points`, [created.permId])
  check(ungrant.code === 200 && regrant.code === 200 && Number(regrant.data) === 1,
    '取消后重新勾选能保存（逻辑删除旧行会撞唯一键，这里必须是物理删）',
    `ungrant=${ungrant.code}/${ungrant.message} regrant=${regrant.code}/${regrant.message}`)

  /* ---------- 5) 用户名桥接：本地账号 + 角色 ---------- */
  sql(`INSERT INTO agri_masterdata.agri_md_user (id, user_code, username, password, real_name, status, del_flag, create_time, remark)
       VALUES (${LOCAL_USER_ID}, 'E2E_PP_${suffix}', 'farmer', '!', '权限点端到端临时账号', 1, 0, NOW(), 'e2e 自造，跑完删除')`)
  const noRole = await call('POST', '/api/customer', {}, farmerToken)
  check(blockedByPoint(noRole), '状态③：本地有账号但一个角色都没绑 —— 仍按"没有授权"处理',
    `code=${noRole.code} ${String(noRole.message).slice(0, 24)}`)

  sql(`INSERT INTO agri_masterdata.agri_md_user_role (user_id, role_id, status, del_flag, create_time)
       VALUES (${LOCAL_USER_ID}, ${created.holderRole}, 0, 0, NOW())`)
  created.userRoleId = sql(`SELECT id FROM agri_masterdata.agri_md_user_role WHERE user_id = ${LOCAL_USER_ID} LIMIT 1`)
  const wrongRole = await call('POST', '/api/customer', {}, farmerToken)
  check(blockedByPoint(wrongRole), '状态③′：绑了角色但不持有该点 —— 还是拦（授权看的是点，不是有没有角色）',
    `code=${wrongRole.code} ${String(wrongRole.message).slice(0, 24)}`)

  const grant2 = await call('PUT', `/admin/masterdata/permission/role/${created.holderRole}/points`, [created.permId])
  const allowed = await call('POST', '/api/customer', {}, farmerToken)
  check(grant2.code === 200 && !blockedByPoint(allowed),
    '状态④：把点授给他所在的角色 → 立刻放行（主体侧账号靠用户名桥到本地角色）',
    `grant=${grant2.code} call=${allowed.code} ${String(allowed.message).slice(0, 30)}`)
  check(holdersOfTarget() === 2, '两个角色同时持有同一个点', `holders=${holdersOfTarget()}`)

  const mineAsFarmer = await call('GET', '/admin/masterdata/permission/mine', undefined, farmerToken)
  check(mineAsFarmer.code === 403 && !blockedByPoint(mineAsFarmer)
    && String(mineAsFarmer.message).includes('masterdata:read'),
    '两层拦截不打架：主体侧账号读运营端「我的权限点」是被 RBAC 权限码挡的，不是被权限点挡的',
    `code=${mineAsFarmer.code} ${String(mineAsFarmer.message).slice(0, 34)}`)
  const mine = await call('GET', '/admin/masterdata/permission/mine')
  check(mine.code === 200 && mine.data?.superAdmin === true && mine.data?.username === 'admin'
    && Array.isArray(mine.data?.granted),
    '「我的权限点」出参带 username / superAdmin / granted 三项，超管明确标成不受约束（不是显示一张空表）',
    JSON.stringify(mine.data ?? {}).slice(0, 110))

  /* ---------- 6) 取消最后一个持有者 → 回到未纳管 ---------- */
  await call('PUT', `/admin/masterdata/permission/role/${created.holderRole}/points`, [])
  const stillHeld = await call('POST', '/api/customer', {}, farmerToken)
  check(blockedByPoint(stillHeld) && holdersOfTarget() === 1,
    '撤掉一个持有者后仍被拦：还有别的角色持有，端点就还在管', `holders=${holdersOfTarget()}`)
  await call('PUT', `/admin/masterdata/permission/role/${created.grantRole}/points`, [])
  const released = await call('POST', '/api/customer', {}, farmerToken)
  check(!blockedByPoint(released) && holdersOfTarget() === 0,
    '撤掉最后一个持有者 → 回到未纳管，谁都能调（不需要"启用/停用"开关列）',
    `holders=${holdersOfTarget()} call=${released.code}`)

  const stats = await call('GET', '/admin/masterdata/permission/statistics')
  check(stats.code === 200 && Number(stats.data?.totalApiPoints) > 100,
    '权限统计里的「接口权限点」计数来自同一张目录表', `totalApiPoints=${stats.data?.totalApiPoints}`)

  /* ---------- 7) 页面：矩阵块、同步按钮、单元格切换 ---------- */
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
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

  await page.goto(`${MDM}/permission/matrix`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3500)
  const headText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(headText.includes('接口权限点（按钮级 / API 级）') && headText.includes('同步端点目录'),
    '矩阵页出现「接口权限点（按钮级 / API 级）」块与同步按钮', headText.match(/接口权限点（[^]{0,20}/)?.[0] ?? '')
  check(headText.includes('勾上即收紧') && !headText.includes('巡检引擎尚未接入'),
    '页面上写清了这条语义（勾上就收紧、取消最后一个持有者即放开），操作员不会把 403 当故障',
    headText.match(/勾上即收紧[^]{0,30}/)?.[0] ?? '')

  const syncRequests = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/permission/points/sync')) syncRequests.push(request.url())
  })
  await page.locator('button').filter({ hasText: '同步端点目录' }).first().click()
  await page.waitForTimeout(3000)
  const syncToast = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(syncRequests.length === 1, '「同步端点目录」真的打了同步接口（不是只重新读列表）', `POST ${syncRequests.length} 次`)
  check(syncToast.includes('端点目录已同步') && /新增 \d+，刷新 \d+/.test(syncToast),
    '提示按同步返回说话：扫了多少、新增/刷新/下线各多少', syncToast.match(/端点目录已同步[^]{0,48}/)?.[0] ?? '')

  await page.locator('input[placeholder*="搜索角色名称"]').first().fill(`权限点`)
  await page.waitForTimeout(1500)
  await page.locator('input[placeholder*="搜索接口路径"]').first().fill('/api/customer')
  await page.waitForTimeout(1500)
  const filtered = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(filtered.includes('POST /api/customer') && filtered.includes('权限点收紧方') && filtered.includes('权限点持有方'),
    '两张搜索框分别筛角色列与权限点行，筛到的正是本次的测试对象', filtered.match(/POST \/api\/customer[^]{0,24}/)?.[0] ?? '')
  await page.screenshot({ path: path.join(OUT, '01-matrix-points.png'), fullPage: true })

  await page.locator('button').filter({ hasText: '编辑授权' }).first().click()
  await page.waitForTimeout(1200)
  const saveRequests = []
  let saveCode = 0
  page.on('request', (request) => {
    if (request.method() === 'PUT' && /\/permission\/role\/\d+\/points$/.test(new URL(request.url()).pathname))
      saveRequests.push(request.url())
  })
  page.on('response', (response) => {
    if (response.request().method() === 'PUT'
      && /\/permission\/role\/\d+\/points$/.test(new URL(response.url()).pathname)) {
      response.json().then((body) => { saveCode = Number(body?.code ?? 0) }).catch(() => {})
    }
  })
  const firstToggle = page.locator('tr').filter({ hasText: TARGET_CODE }).locator('button.mark--toggle').first()
  await firstToggle.click({ timeout: 15000 })
  await page.waitForTimeout(700)
  const cellText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  await page.waitForTimeout(3500)
  check(saveRequests.length === 1, '点单元格真的调了覆盖式保存接口', `PUT ${saveRequests.length} 次`)
  check(saveCode === 200, '保存接口回的是后端业务码，不是前端自己标的成功', `code=${saveCode}`)
  // 提示条只活 3 秒，所以它在"点完 700ms"时读；落库与否看下面的重进页面
  check(/已授予|已取消/.test(cellText), '提示按后端结果说话：写的是哪个角色、哪个点',
    cellText.match(/(已授予|已取消)[^]{0,34}/)?.[0] ?? '')
  await page.screenshot({ path: path.join(OUT, '02-cell-toggle.png'), fullPage: true })

  const uiHolders = holdersOfTarget()
  check(uiHolders >= 1, '页面点的那一格在库里就是一条真实授权（点的是 POST /api/customer 这一行）',
    `holders=${uiHolders}`)

  // 刷新页面再验格子还在（只在内存里改过的话，这里就会退回 —）
  await page.goto(`${MDM}/permission/matrix`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3500)
  await page.locator('button').filter({ hasText: '编辑授权' }).first().click()
  await page.waitForTimeout(1500)
  await page.locator('input[placeholder*="搜索接口路径"]').first().fill('/api/customer')
  await page.waitForTimeout(2000)
  const persisted = await page.locator('tr').filter({ hasText: TARGET_CODE })
    .locator('button.mark--toggle').filter({ hasText: '●' }).count()
  check(persisted >= 1, '重进页面后格子仍是 ●（授权确实落了库，不是前端状态）', `●=${persisted}`)

  check(jsErrors.length === 0, '全程无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 220))
} finally {
  await browser?.close().catch(() => {})
  /* ---------- 清理：本次造的账号、角色、授权全部退回基线；目录是合法配置，保留 ---------- */
  if (created.userRoleId) sql(`DELETE FROM agri_masterdata.agri_md_user_role WHERE id = ${created.userRoleId}`)
  sql(`DELETE FROM agri_masterdata.agri_md_user_role WHERE user_id = ${LOCAL_USER_ID}`)
  sql(`DELETE FROM agri_masterdata.agri_md_user WHERE id = ${LOCAL_USER_ID}`)
  for (const roleId of [created.grantRole, created.holderRole]) {
    if (roleId) {
      sql(`DELETE FROM agri_masterdata.agri_md_role_permission WHERE role_id = ${roleId}`)
      sql(`DELETE FROM agri_masterdata.agri_md_role_menu WHERE role_id = ${roleId}`)
    }
  }
  // 删除接口是逻辑删（del_flag=1），测试角色属于脚本自造物，物理删掉才不留看不见的残留
  sql(`DELETE FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_PPG_%' OR role_code LIKE 'E2E_PPH_%'`)
  const residueGrant = holdersOfTarget()
  const residueRp = Number(sql(
    `SELECT COUNT(*) FROM agri_masterdata.agri_md_role_permission
      WHERE role_id IN (${created.grantRole || 0}, ${created.holderRole || 0})`) || '0')
  const residueUser = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_user WHERE id = ${LOCAL_USER_ID}`)
  const residueRole = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_PP%'`)
  const catalogKept = Number(sql('SELECT COUNT(*) FROM agri_masterdata.agri_md_permission WHERE del_flag = 0') || '0')
  console.log('')
  check(residueGrant === 0, `清理：${TARGET_CODE} 已回到未纳管（本次授的点全部收回）`, `holders=${residueGrant}`)
  check(residueRp === 0 && residueUser === '0' && residueRole === '0',
    '清理：测试账号、人↔角色绑定、测试角色与其授权都无残留',
    `role_permission=${residueRp} user=${residueUser} role=${residueRole}`)
  check(catalogKept > 100, '清理：权限点目录本身保留（它是从代码同步出来的合法配置，不是本次造的数据）',
    `points=${catalogKept}`)
}

console.log('')
if (!failures.length) {
  console.log('主数据按钮级权限点端到端验证全部通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((label) => console.log('  -', label))
process.exit(1)
