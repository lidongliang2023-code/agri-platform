/**
 * 主数据运营端 · 按钮级权限点的前端显隐端到端验证
 *
 * 上一轮企业端接完时留了一条：运营端只有超管能进，而超管永不受权限点约束，
 * 所以"运营端按钮隐藏"这件事根本没有账号能验。本轮先用
 * `scripts/provision-mdm-operator-access.mjs` 造出一个**非超管运营账号**（MARKET_OPS + masterdata 读写码），
 * 再验四件事：
 *   1. 收紧后该账号看不到按钮，且**接口同时 403**（隐藏不是前端自己演的）；
 *   2. 按点判、不按页判 —— 同一张字典页里，被收紧的「新增/删除」消失，没被收紧的「编辑」还在；
 *   3. 超管在同样收紧下按钮一个不少（否则运营端会把自己关在门外）；
 *   4. 矩阵页的授权格子是"改不动"而不是"看不见" —— ● / — 是授权事实，不能因为看的人没权限就消失。
 *
 * 用法：node scripts/e2e-mdm-permission-ops-buttons.mjs
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
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'mdm-permission-ops-buttons-20261102')
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

const CREATE_DICT = 'POST /admin/masterdata/standard/dict'
const DELETE_DICT = 'DELETE /admin/masterdata/standard/dict/{id}'
const UPDATE_DICT = 'PUT /admin/masterdata/standard/dict/{id}'
const GRANT_POINTS = 'PUT /admin/masterdata/permission/role/{id}/points'
const GRANT_MENUS = 'PUT /admin/masterdata/permission/role/{id}/menus'
/** 运营端页面也会调 /api/** 这一族（区划、商品属性），它们同样在目录里 */
const REGION_CREATE = 'POST /api/master-data/address/regions'
const REGION_UPDATE = 'PUT /api/master-data/address/regions/{regionId}'
const ATTR_CREATE = 'POST /api/product/attribute'
const ATTR_UPDATE = 'PUT /api/product/attribute/{id}'
const CODES = [CREATE_DICT, DELETE_DICT, UPDATE_DICT, GRANT_POINTS, GRANT_MENUS,
  REGION_CREATE, REGION_UPDATE, ATTR_CREATE, ATTR_UPDATE]

const suffix = String(Date.now()).slice(-8)
const LOCAL_USER_ID = `92${suffix}03`
const created = { restrictRole: '', ownRole: '', userRoleId: '', ids: {} }
let adminToken = ''
let opsToken = ''

const call = async (method, pathname, body, bearer = adminToken) => {
  const response = await fetch(`${MDM}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${bearer}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => ({}))
  // 本模块成功码是 200（生产域才是 0）；失败也走 HTTP 200 + 业务码
  return { status: response.status, code: json?.code ?? -1, message: json?.message ?? '', data: json?.data }
}

const holdersOf = (code) => Number(sql(
  `SELECT COUNT(*) FROM agri_masterdata.agri_md_role_permission rp
     JOIN agri_masterdata.agri_md_permission p ON p.id = rp.perm_id
    WHERE p.perm_code = '${code}' AND p.del_flag = 0`) || '0')

let browser
const pages = []

/** 只有真正可见的按钮才算"没隐藏"：display:none 的元素仍然在 DOM 里 */
const visibleButton = async (page, text) => page.locator('button').filter({ hasText: text }).evaluateAll(
  (nodes) => nodes.filter((node) => node.offsetParent !== null && node.style.display !== 'none').length,
)

async function openAs(username) {
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1050 } })).newPage()
  pages.push(page)
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error?.message ?? error).slice(0, 140)))
  await page.goto(`${MDM}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click({ timeout: 10000 })
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill(username)
  await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  // 认证中心回跳是异步的：URL 没回到本站就 goto，会拿到一个还没换到令牌的空壳页面
  await page.waitForURL(`${MDM}/**`, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(3000)
  return { page, errors }
}

try {
  /* ---------- 0) 两个运营端账号：超管 admin + 非超管 mdmops ---------- */
  const adminLogin = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PASSWORD, marketId: 1 }),
  })).json()
  adminToken = adminLogin?.data?.accessToken ?? ''
  const opsLogin = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'mdmops', password: PASSWORD, marketId: 1 }),
  })).json()
  opsToken = opsLogin?.data?.accessToken ?? ''
  check(Boolean(adminToken) && Boolean(opsToken), '取得 admin（超管）与 mdmops（非超管运营）登录态',
    opsToken ? '' : '先跑 node scripts/provision-mdm-operator-access.mjs')

  const opsMine = await call('GET', '/admin/masterdata/permission/mine', undefined, opsToken)
  check(opsMine.code === 200 && opsMine.data?.superAdmin === false,
    'mdmops 能读运营端接口（masterdata:read）且明确不是超管 —— 否则这一轮验的是个假分支',
    `code=${opsMine.code} superAdmin=${opsMine.data?.superAdmin}`)

  await call('POST', '/admin/masterdata/permission/points/sync')
  const dictPoints = (await call('GET', '/admin/masterdata/permission/points?keyword=/standard/dict')).data ?? []
  CODES.slice(0, 3).forEach((code) => { created.ids[code] = String(dictPoints.find((item) => item.permCode === code)?.id ?? '') })
  const grantPoints = (await call('GET', '/admin/masterdata/permission/points?keyword=/permission/role')).data ?? []
  created.ids[GRANT_POINTS] = String(grantPoints.find((item) => item.permCode === GRANT_POINTS)?.id ?? '')
  created.ids[GRANT_MENUS] = String(grantPoints.find((item) => item.permCode === GRANT_MENUS)?.id ?? '')
  check(Object.values(created.ids).every((id) => /^\d+$/.test(id)),
    '九个按钮对应的权限点都在目录里（含 /api/** 那一族）', Object.entries(created.ids).map(([c, id]) => `${c}#${id}`).join(' '))
  check(CODES.every((code) => holdersOf(code) === 0), '基线：九个点都没有角色持有（未纳管）')

  /* ---------- 1) 基线页面：按钮都在 ---------- */
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const ops = await openAs('mdmops')
  await ops.page.goto(`${MDM}/datastandard/dict`, { waitUntil: 'networkidle', timeout: 30000 })
  // 表体渲染出来再断言：SSO 回跳后首屏还要拉字典列表，早读会读到"还没渲染"而不是"被隐藏"
  await ops.page.waitForSelector('table.mds-table tbody tr button', { timeout: 25000 }).catch(() => {})
  await ops.page.waitForTimeout(1500)
  const baseCreate = await visibleButton(ops.page, '+ 新增字典')
  const baseEdit = await visibleButton(ops.page, '编辑')
  const baseDelete = await visibleButton(ops.page, '删除')
  check(baseCreate === 1 && baseEdit >= 1 && baseDelete >= 1,
    '基线：字典页的新增 / 编辑 / 删除按钮全部可见', `新增=${baseCreate} 编辑=${baseEdit} 删除=${baseDelete}`)
  check(!(await ops.page.evaluate(() => document.body.innerText)).includes('部分操作已隐藏'),
    '基线：没有任何点被收紧时，横幅不出现（不是常驻一条"可能没权限"）')

  /* ---------- 2) 收紧：授给 mdmops 不持有的角色 ---------- */
  const restrict = await call('POST', '/admin/masterdata/permission/role', {
    roleCode: `E2E_OPS_${suffix}`, roleName: `运营端收紧方-${suffix}`, roleKey: `e2eOps${suffix}`,
    description: '端到端验证用：持有后未持有的运营账号看不到按钮', status: 1,
  })
  created.restrictRole = String(restrict.data ?? '')
  const grant = await call('PUT', `/admin/masterdata/permission/role/${created.restrictRole}/points`,
    [created.ids[CREATE_DICT], created.ids[DELETE_DICT], created.ids[GRANT_POINTS], created.ids[GRANT_MENUS]])
  check(grant.code === 200 && Number(grant.data) === 4, '把「新增字典 / 删除字典 / 两种授权保存」四个点授给收紧方',
    `saved=${grant.data}`)

  const deniedNow = ((await call('GET', '/admin/masterdata/permission/mine', undefined, opsToken)).data ?? {}).denied ?? []
  check([CREATE_DICT, DELETE_DICT, GRANT_POINTS, GRANT_MENUS].every((code) => deniedNow.includes(code))
    && !deniedNow.includes(UPDATE_DICT),
    'denied 精确到点：编辑字典没被收紧，所以不在列表里', deniedNow.join(','))

  const blocked = await call('POST', '/admin/masterdata/standard/dict',
    { dictCode: `E2E_OPS_${suffix}`, dictName: `运营端按钮验证-${suffix}` }, opsToken)
  check(blocked.code === 403 && String(blocked.message).includes('缺少权限点'),
    '接口同时 403：隐藏与拦截是同一件事的两面', `code=${blocked.code} ${String(blocked.message).slice(0, 24)}`)

  /* ---------- 3) 页面：只隐藏被收紧的那两个 ---------- */
  await ops.page.goto(`${MDM}/datastandard/dict`, { waitUntil: 'networkidle', timeout: 30000 })
  await ops.page.waitForSelector('table.mds-table tbody button', { timeout: 25000 }).catch(() => {})
  await ops.page.waitForTimeout(1500)
  const nowCreate = await visibleButton(ops.page, '+ 新增字典')
  const nowEdit = await visibleButton(ops.page, '编辑')
  const nowDelete = await visibleButton(ops.page, '删除')
  check(nowCreate === 0 && nowDelete === 0 && nowEdit >= 1,
    '按点判不按页判：新增与删除消失了，同一页的编辑仍然在（它们是两个不同的点）',
    `新增=${nowCreate} 编辑=${nowEdit} 删除=${nowDelete}`)
  check((await ops.page.locator('button').filter({ hasText: '新增字典' }).count()) > 0,
    '按钮是"看不见"而不是"被删掉"：DOM 里还在，display 由指令控制（读不到权限点时能立刻恢复）')

  /* 横幅由 v-point 自己登记，页面不维护清单 —— 所以它列的一定就是这一页真正消失的那些点 */
  const banner = (await ops.page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(banner.includes('部分操作已隐藏（2 项）')
    && banner.includes(CREATE_DICT) && banner.includes(DELETE_DICT)
    && !banner.includes(`${UPDATE_DICT}　`),
    '布局层横幅按当前页统计：只列这一页消失的两个编码，没把别页的点也算进来',
    banner.match(/部分操作已隐藏[^]{0,120}/)?.[0]?.slice(0, 120) ?? '')
  check(await visibleButton(ops.page, '申请授权') === 1,
    '横幅给的是出口而不是只说"没权限"：运营端同一颗「申请授权」按钮（整条链见 e2e-mdm-permission-request-loop.mjs）')
  await ops.page.screenshot({ path: path.join(OUT, '01-dict-hidden.png'), fullPage: true })

  /* ---------- 4) 矩阵页：格子改不动，但 ● / — 照常显示 ---------- */
  await ops.page.goto(`${MDM}/permission/matrix`, { waitUntil: 'networkidle', timeout: 30000 })
  // 矩阵要逐角色拉两份明细（10 个角色 = 20 个请求），等表体真出现再进编辑态
  await ops.page.waitForSelector('table.mds-table tbody .mark', { timeout: 40000 }).catch(() => {})
  await ops.page.locator('button').filter({ hasText: '编辑授权' }).first().click()
  await ops.page.waitForTimeout(2500)
  const toggles = await ops.page.locator('button.mark--toggle').count()
  const staticMarks = await ops.page.locator('span.mark--no, span.mark--yes').count()
  check(toggles === 0 && staticMarks > 0,
    '授权被收紧后矩阵格子全部不可点，但 ● / — 一个都没少（授权事实不该因为看的人没权限而消失）',
    `可点格子=${toggles} 静态格子=${staticMarks}`)
  await ops.page.screenshot({ path: path.join(OUT, '02-matrix-readonly.png'), fullPage: true })

  /* ---------- 5) 超管对照：同样收紧下按钮一个不少 ---------- */
  const admin = await openAs('admin')
  await admin.page.goto(`${MDM}/datastandard/dict`, { waitUntil: 'networkidle', timeout: 30000 })
  await admin.page.waitForSelector('table.mds-table tbody button', { timeout: 25000 }).catch(() => {})
  await admin.page.waitForTimeout(1500)
  const adminCreate = await visibleButton(admin.page, '+ 新增字典')
  const adminDelete = await visibleButton(admin.page, '删除')
  check(adminCreate === 1 && adminDelete >= 1,
    '超管不受这张矩阵约束：同一时刻同一张页面，按钮全部照常',
    `新增=${adminCreate} 删除=${adminDelete}`)
  check(!(await admin.page.evaluate(() => document.body.innerText)).includes('部分操作已隐藏'),
    '超管页面上也不该出现这条横幅：他什么都没被隐藏，提示跟着判据走才不会误导')

  /* ---------- 6) 授给他自己的角色 → 恢复 ---------- */
  const ownRole = await call('POST', '/admin/masterdata/permission/role', {
    roleCode: `E2E_OPF_${suffix}`, roleName: `运营端持有方-${suffix}`, roleKey: `e2eOpf${suffix}`,
    description: '端到端验证用：mdmops 桥接到这个角色', status: 1,
  })
  created.ownRole = String(ownRole.data ?? '')
  sql(`INSERT INTO agri_masterdata.agri_md_user (id, user_code, username, password, real_name, status, del_flag, create_time, remark)
       VALUES (${LOCAL_USER_ID}, 'E2E_OP_${suffix}', 'mdmops', '!', '运营端按钮显隐临时账号', 1, 0, NOW(), 'e2e 自造，跑完删除')`)
  sql(`INSERT INTO agri_masterdata.agri_md_user_role (user_id, role_id, status, del_flag, create_time)
       VALUES (${LOCAL_USER_ID}, ${created.ownRole}, 0, 0, NOW())`)
  created.userRoleId = sql(`SELECT id FROM agri_masterdata.agri_md_user_role WHERE user_id = ${LOCAL_USER_ID} LIMIT 1`)
  const grantOwn = await call('PUT', `/admin/masterdata/permission/role/${created.ownRole}/points`,
    [created.ids[CREATE_DICT], created.ids[DELETE_DICT]])
  check(grantOwn.code === 200 && Number(grantOwn.data) === 2, '把两个点授给 mdmops 所在的本地角色', `saved=${grantOwn.data}`)

  const deniedAfter = ((await call('GET', '/admin/masterdata/permission/mine', undefined, opsToken)).data ?? {}).denied ?? []
  check(!deniedAfter.includes(CREATE_DICT) && !deniedAfter.includes(DELETE_DICT)
    && deniedAfter.includes(GRANT_POINTS) && deniedAfter.includes(GRANT_MENUS),
    'denied 只剩他确实没有的两个授权端点（按人算，不按角色数量算）', deniedAfter.join(','))

  await ops.page.goto(`${MDM}/datastandard/dict`, { waitUntil: 'networkidle', timeout: 30000 })
  await ops.page.waitForSelector('table.mds-table tbody button', { timeout: 25000 }).catch(() => {})
  await ops.page.waitForTimeout(1500)
  const backCreate = await visibleButton(ops.page, '+ 新增字典')
  const backDelete = await visibleButton(ops.page, '删除')
  check(backCreate === 1 && backDelete >= 1, '重进页面：两个按钮都回来了', `新增=${backCreate} 删除=${backDelete}`)
  const afterRestore = (await ops.page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(!afterRestore.includes('部分操作已隐藏'),
    '按钮回来后横幅随之消失（引用计数在元素转可见时释放，不留一条过期提示）')

  const allowed = await call('POST', '/admin/masterdata/standard/dict',
    { dictCode: `E2E_OPS_${suffix}`, dictName: `运营端按钮验证-${suffix}` }, opsToken)
  check(allowed.code === 200, '接口同时放行', `code=${allowed.code} ${String(allowed.message).slice(0, 24)}`)

  /* ---------- 7) 另一条路径族：运营端页面调的是 /api/**，不是 /admin/masterdata/** ---------- */
  const extraPoints = (await call('GET', '/admin/masterdata/permission/points?keyword=regions')).data ?? []
  const attrPoints = (await call('GET', '/admin/masterdata/permission/points?keyword=/api/product/attribute')).data ?? []
  created.ids[REGION_CREATE] = String(extraPoints.find((item) => item.permCode === REGION_CREATE)?.id ?? '')
  created.ids[REGION_UPDATE] = String(extraPoints.find((item) => item.permCode === REGION_UPDATE)?.id ?? '')
  created.ids[ATTR_CREATE] = String(attrPoints.find((item) => item.permCode === ATTR_CREATE)?.id ?? '')
  created.ids[ATTR_UPDATE] = String(attrPoints.find((item) => item.permCode === ATTR_UPDATE)?.id ?? '')
  check([REGION_CREATE, REGION_UPDATE, ATTR_CREATE, ATTR_UPDATE].every((c) => /^\d+$/.test(created.ids[c])),
    '区划与属性这四个点也在目录里（运营端页面调的接口不止 /admin/masterdata 一条路径族）',
    [REGION_CREATE, REGION_UPDATE, ATTR_CREATE, ATTR_UPDATE].map((c) => c.split(' ')[0] + '#' + created.ids[c]).join(' '))

  await ops.page.goto(`${MDM}/system/region`, { waitUntil: 'networkidle', timeout: 30000 })
  await ops.page.waitForTimeout(3500)
  const regionBase = await visibleButton(ops.page, '编辑')
  const attrBase = await (async () => {
    await ops.page.goto(`${MDM}/product/template`, { waitUntil: 'networkidle', timeout: 30000 })
    await ops.page.waitForTimeout(3000)
    return visibleButton(ops.page, '新增属性')
  })()
  check(regionBase > 100 && attrBase === 1, '基线：区划页与属性模板页的写按钮都在',
    `区划编辑=${regionBase} 新增属性=${attrBase}`)

  await call('PUT', `/admin/masterdata/permission/role/${created.restrictRole}/points`, [
    created.ids[CREATE_DICT], created.ids[DELETE_DICT], created.ids[GRANT_POINTS], created.ids[GRANT_MENUS],
    created.ids[REGION_CREATE], created.ids[REGION_UPDATE], created.ids[ATTR_CREATE], created.ids[ATTR_UPDATE],
  ])
  const deniedExtra = ((await call('GET', '/admin/masterdata/permission/mine', undefined, opsToken)).data ?? {}).denied ?? []
  check([REGION_CREATE, REGION_UPDATE, ATTR_CREATE, ATTR_UPDATE].every((code) => deniedExtra.includes(code)),
    'denied 覆盖到 /api/** 这批点（作用域判定与目录同步本来就是同一处，前端只是把它显示出来）')

  const attrBlocked = await call('PUT', '/api/product/attribute/1', { attributeName: `按钮验证-${suffix}` }, opsToken)
  check(attrBlocked.code === 403 && String(attrBlocked.message).includes('缺少权限点'),
    '主体侧路径上的写请求同样被拦：运营端账号也躲不过 /api/** 这一族',
    `code=${attrBlocked.code} ${String(attrBlocked.message).slice(0, 26)}`)

  await ops.page.goto(`${MDM}/system/region`, { waitUntil: 'networkidle', timeout: 30000 })
  await ops.page.waitForTimeout(3500)
  const regionHidden = await visibleButton(ops.page, '编辑')
  const regionCreateHidden = await visibleButton(ops.page, '+ 新增区划')
  check(regionHidden === 0 && regionCreateHidden === 0,
    '区划页：新增与全部行内编辑一起消失（3000+ 个格子由同一条指令控制，不是逐个写死）',
    `编辑=${regionHidden} 新增=${regionCreateHidden}`)
  const regionBanner = (await ops.page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(regionBanner.includes('部分操作已隐藏（2 项）') && regionBanner.includes(REGION_CREATE)
    && regionBanner.includes(REGION_UPDATE) && !regionBanner.includes(CREATE_DICT),
    '换到区划页，横幅只列这一页的两个点（3348 个行内按钮也只算一项）—— 计数按编码不按元素',
    regionBanner.match(/部分操作已隐藏[^]{0,80}/)?.[0]?.slice(0, 80) ?? '')
  await ops.page.goto(`${MDM}/product/template`, { waitUntil: 'networkidle', timeout: 30000 })
  await ops.page.waitForTimeout(3000)
  check(await visibleButton(ops.page, '新增属性') === 0, '属性模板页：新增属性也消失了')
  await ops.page.screenshot({ path: path.join(OUT, '03-subject-path-hidden.png'), fullPage: true })

  const jsErrors = [...ops.errors, ...admin.errors]
  check(jsErrors.length === 0, '全程无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 220))
} finally {
  for (const page of pages) await page.context().close().catch(() => {})
  await browser?.close().catch(() => {})
  /* ---------- 清理：授权、账号、角色与本次建的字典全部退回基线 ---------- */
  for (const roleId of [created.restrictRole, created.ownRole]) {
    if (roleId) {
      sql(`DELETE FROM agri_masterdata.agri_md_role_permission WHERE role_id = ${roleId}`)
      sql(`DELETE FROM agri_masterdata.agri_md_role_menu WHERE role_id = ${roleId}`)
    }
  }
  if (created.userRoleId) sql(`DELETE FROM agri_masterdata.agri_md_user_role WHERE id = ${created.userRoleId}`)
  sql(`DELETE FROM agri_masterdata.agri_md_user WHERE id = ${LOCAL_USER_ID}`)
  sql(`DELETE FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_OPS%' OR role_code LIKE 'E2E_OPF%'`)
  sql(`DELETE FROM agri_masterdata.agri_md_dict WHERE dict_code LIKE 'E2E_OPS%'`)
  const residue = CODES.map(holdersOf)
  const residueRole = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_OP%'`)
  const residueUser = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_user WHERE id = ${LOCAL_USER_ID}`)
  const residueDict = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_dict WHERE dict_code LIKE 'E2E_OPS%'`)
  console.log('')
  check(residue.every((count) => count === 0), '清理：九个点都回到未纳管', `holders=${residue.join('/')}`)
  check(residueRole === '0' && residueUser === '0' && residueDict === '0',
    '清理：测试角色、本地账号与本次建的字典零残留', `role=${residueRole} user=${residueUser} dict=${residueDict}`)
}

console.log('')
if (!failures.length) {
  console.log('主数据运营端按钮显隐端到端验证全部通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((label) => console.log('  -', label))
process.exit(1)
