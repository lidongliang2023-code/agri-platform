/**
 * 主数据企业端 · 按钮级权限点的**前端显隐**端到端验证
 *
 * 上一轮把"勾上即收紧"做到了服务端；这一轮验的是页面上那扇门有没有跟着关。
 * 要验的四件事：
 *   1. **口径一致**：前端隐藏按钮用的 `denied` 与服务端拦截用的是同一个方法算出来的集合，
 *      所以"按钮没了"必须与"接口 403"同时成立，"按钮回来了"必须与"接口放行"同时成立；
 *   2. **超管不受影响**：`admin`（权限码 `*`）在任何收紧下都不会看到按钮消失；
 *   3. **主体侧读得到**：企业端账号没有 `masterdata:read`，读不了运营端接口，
 *      所以 `denied` 必须在 `/api/user/**` 这一层给出；
 *   4. **隐藏要说得出原因**：不是静默少一个按钮，而是一条写明"未持有权限点"的提示。
 *
 * 顺带回归：组织架构页的「编辑」按钮原先写的是 `openEdit(row)`，而循环变量叫 `org` ——
 * 一点就 ReferenceError。本轮把它接回 `openEdit(org)` 并实测弹窗真的打开。
 *
 * 用法：node scripts/e2e-mdm-permission-button-visibility.mjs
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
const MERCHANT = '2001'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'mdm-permission-button-20261102')
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

/** 被测的两个点：企业端「组织架构」页的表头按钮与行内按钮 */
const CREATE_CODE = 'POST /api/user/orgs'
const EDIT_CODE = 'PUT /api/user/orgs/{id}'
/** 第二张页面上的两个点：部门 / 岗位的表头按钮 */
const DEPT_CODE = 'POST /api/user/depts'
const POS_CODE = 'POST /api/user/positions'
const HINT = '部分操作已隐藏'

const suffix = String(Date.now()).slice(-8)
const LOCAL_USER_ID = `92${suffix}02`
const created = { restrictRole: '', holderRole: '', userRoleId: '', ids: {} }
let token = ''
let farmerToken = ''

const call = async (method, pathname, body, bearer = token, merchant = '') => {
  const headers = { Authorization: `Bearer ${bearer}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }
  if (merchant) headers['X-Agri-Merchant'] = merchant
  const response = await fetch(`${MDM}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const json = await response.json().catch(() => ({}))
  // 本模块成功码是 200（生产域才是 0）；失败也走 HTTP 200 + 业务码，判成败只看业务码
  return { status: response.status, code: json?.code ?? -1, message: json?.message ?? '', data: json?.data }
}

const mine = async (bearer, pathname = '/api/user/permission-points/mine') =>
  (await call('GET', pathname, undefined, bearer, MERCHANT)).data ?? {}
const deniedOf = async (bearer) => ((await mine(bearer)).denied ?? []).map(String)
const holdersOf = (code) => Number(sql(
  `SELECT COUNT(*) FROM agri_masterdata.agri_md_role_permission rp
     JOIN agri_masterdata.agri_md_permission p ON p.id = rp.perm_id
    WHERE p.perm_code = '${code}' AND p.del_flag = 0`) || '0')

let browser
let page

/**
 * 按钮一律按"真的可见"数，不看文案也不看 DOM 存在性 ——
 * 文案会撞口径说明横幅，而 `v-point` 是 `display:none`，元素仍然留在 DOM 里。
 */
const visibleCount = (locator) => locator.evaluateAll(
  (nodes) => nodes.filter((node) => node.offsetParent !== null && node.style.display !== 'none').length,
)
const countButton = async (text) => visibleCount(page.locator('button').filter({ hasText: text }))
const countOrgLinks = async () => visibleCount(page.locator('button.org-link'))
const bodyText = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

try {
  /* ---------- 0) 两个登录态 + 目录就绪 ---------- */
  const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PASSWORD, marketId: 1 }),
  })).json()
  token = login?.data?.accessToken ?? ''
  const farmerLogin = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'farmer', password: PASSWORD, marketId: 1 }),
  })).json()
  farmerToken = farmerLogin?.data?.accessToken ?? ''
  check(Boolean(token) && Boolean(farmerToken), '取得超管与主体侧账号（farmer，主体 2001 的 owner）两个登录态')

  await call('POST', '/admin/masterdata/permission/points/sync')
  const points = (await call('GET', '/admin/masterdata/permission/points?keyword=/api/user/orgs')).data ?? []
  created.ids[CREATE_CODE] = String(points.find((item) => item.permCode === CREATE_CODE)?.id ?? '')
  created.ids[EDIT_CODE] = String(points.find((item) => item.permCode === EDIT_CODE)?.id ?? '')
  const deptPoints = (await call('GET', '/admin/masterdata/permission/points?keyword=/api/user/dept')).data ?? []
  const posPoints = (await call('GET', '/admin/masterdata/permission/points?keyword=/api/user/position')).data ?? []
  created.ids[DEPT_CODE] = String(deptPoints.find((item) => item.permCode === DEPT_CODE)?.id ?? '')
  created.ids[POS_CODE] = String(posPoints.find((item) => item.permCode === POS_CODE)?.id ?? '')
  check(Object.values(created.ids).every((id) => /^\d+$/.test(id)),
    '四个按钮对应的权限点都在目录里（表头按钮与行内按钮分开管，不是一个点管一页）',
    Object.entries(created.ids).map(([code, id]) => `${code}#${id}`).join(' '))
  check([CREATE_CODE, EDIT_CODE, DEPT_CODE, POS_CODE].every((code) => holdersOf(code) === 0),
    '基线：四个点都没有任何角色持有（未纳管）')

  /* ---------- 1) 主体侧读得到 denied，且超管不受约束 ---------- */
  const farmerMine = await mine(farmerToken)
  check(farmerMine.superAdmin === false && Array.isArray(farmerMine.denied) && farmerMine.denied.length === 0,
    '主体侧账号读自己的权限点：不是超管，且未纳管时 denied 为空', JSON.stringify(farmerMine).slice(0, 120))
  const adminMine = await call('GET', '/admin/masterdata/permission/mine').then((response) => response.data ?? {})
  check(adminMine.superAdmin === true && (adminMine.denied ?? []).length === 0,
    '运营端超管的 denied 恒为空（收紧与否都不会把运营端页面自己关掉）',
    `superAdmin=${adminMine.superAdmin} denied=${(adminMine.denied ?? []).length}`)

  /* ---------- 2) 浏览器基线：按钮都在，编辑按钮真的能开弹窗 ---------- */
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
  const jsErrors = []
  page.on('pageerror', (error) => jsErrors.push(String(error?.message ?? error).slice(0, 140)))
  await page.goto(`${MDM}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click({ timeout: 10000 })
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('farmer')
  await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(5000)

  await page.goto(`${MDM}/user/org-tree`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const orgRows = await countOrgLinks()
  check(await countButton('+ 新增组织') === 1 && orgRows >= 1,
    '基线：未纳管时表头「新增组织」与行内「编辑」都照常显示', `编辑按钮=${orgRows} 个`)
  check(!(await bodyText()).includes(HINT), '基线：页面上没有"部分操作已隐藏"的提示')

  await page.locator('button.org-link').first().click()
  await page.waitForTimeout(800)
  const dialogText = await bodyText()
  check(dialogText.includes('编辑组织'),
    '「编辑」按钮真的打开弹窗（原先写的是 openEdit(row)，循环变量却叫 org —— 一点就 ReferenceError）',
    dialogText.match(/编辑组织[^]{0,18}/)?.[0] ?? '')
  await page.keyboard.press('Escape')
  await page.locator('button.mds-dialog__close').first().click().catch(() => {})
  await page.waitForTimeout(600)
  await page.screenshot({ path: path.join(OUT, '01-baseline-visible.png'), fullPage: true })

  /* ---------- 3) 收紧：授给一个 farmer 不持有的角色 ---------- */
  const restrictRole = await call('POST', '/admin/masterdata/permission/role', {
    roleCode: `E2E_BVR_${suffix}`, roleName: `按钮收紧方-${suffix}`, roleKey: `e2eBvr${suffix}`,
    description: '端到端验证用：持有这些点后，未持有的账号看不到按钮也调不动接口', status: 1,
  })
  created.restrictRole = String(restrictRole.data ?? '')
  const grant = await call('PUT', `/admin/masterdata/permission/role/${created.restrictRole}/points`,
    [created.ids[CREATE_CODE], created.ids[EDIT_CODE], created.ids[DEPT_CODE], created.ids[POS_CODE]])
  check(grant.code === 200 && Number(grant.data) === 4, '把四个点授给"收紧方"角色（farmer 不持有）',
    `saved=${grant.data}`)

  const deniedNow = await deniedOf(farmerToken)
  check([CREATE_CODE, EDIT_CODE, DEPT_CODE, POS_CODE].every((code) => deniedNow.includes(code)),
    '主体侧 denied 立刻列出这四个点（与服务端拦截同一处计算）', deniedNow.join(','))

  const blocked = await call('POST', '/api/user/orgs', { orgName: `按钮验证-${suffix}`, orgType: 'ENTERPRISE' },
    farmerToken, MERCHANT)
  check(blocked.code === 403 && String(blocked.message).includes('缺少权限点'),
    '接口侧同样拒绝：按钮隐藏与 403 是同一件事的两面，不是前端自己演出来的',
    `code=${blocked.code} ${String(blocked.message).slice(0, 26)}`)
  check(sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_organization WHERE org_name = '按钮验证-${suffix}'`) === '0',
    '被拦的那次写入确实没有落库（不是先写后拒）')

  /* ---------- 4) 页面：按钮消失 + 说得出原因 ---------- */
  await page.goto(`${MDM}/user/org-tree`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const hiddenText = await bodyText()
  const orgHidden = await countOrgLinks()
  check(await countButton('+ 新增组织') === 0 && orgHidden === 0,
    '重进组织架构页：表头与行内按钮都不可见（元素仍在 DOM 里，由指令 display 控制）', `org-link=${orgHidden}`)
  check(hiddenText.includes(`${HINT}（2 项）`) && hiddenText.includes(CREATE_CODE) && hiddenText.includes(EDIT_CODE),
    '不是静默少一个按钮：横幅由 v-point 自己登记这一页消失的两个编码（与运营端同一个组件、同一份计数）',
    hiddenText.match(/部分操作已隐藏[^]{0,60}/)?.[0] ?? '')
  check(await visibleCount(page.locator('button').filter({ hasText: '申请授权' })) === 1,
    '横幅给的是出口而不是只说"没权限"：被拦的人当场就能发起申请（整条链见 e2e-mdm-permission-request-loop.mjs）')
  check((await page.locator('td .mds-hint').filter({ hasText: '未授权该操作' }).count()) >= 1,
    '行内按钮位置留了「未授权该操作」，不会被误读成"这条数据不能改"')
  await page.screenshot({ path: path.join(OUT, '02-buttons-hidden.png'), fullPage: true })

  await page.goto(`${MDM}/user/dept`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  check(await countButton('+ 新增部门') === 0 && await countButton('+ 新增岗位') === 0,
    '同一份 denied 也管住了部门页的两个表头按钮（不是只给一页接了线）',
    `部门=${await countButton('+ 新增部门')} 岗位=${await countButton('+ 新增岗位')}`)

  /* ---------- 5) 授给他所在的角色：按钮回来，接口也放行 ---------- */
  const holderRole = await call('POST', '/admin/masterdata/permission/role', {
    roleCode: `E2E_BVH_${suffix}`, roleName: `按钮持有方-${suffix}`, roleKey: `e2eBvh${suffix}`,
    description: '端到端验证用：farmer 桥接到这个角色', status: 1,
  })
  created.holderRole = String(holderRole.data ?? '')
  sql(`INSERT INTO agri_masterdata.agri_md_user (id, user_code, username, password, real_name, status, del_flag, create_time, remark)
       VALUES (${LOCAL_USER_ID}, 'E2E_BV_${suffix}', 'farmer', '!', '按钮显隐端到端临时账号', 1, 0, NOW(), 'e2e 自造，跑完删除')`)
  sql(`INSERT INTO agri_masterdata.agri_md_user_role (user_id, role_id, status, del_flag, create_time)
       VALUES (${LOCAL_USER_ID}, ${created.holderRole}, 0, 0, NOW())`)
  created.userRoleId = sql(`SELECT id FROM agri_masterdata.agri_md_user_role WHERE user_id = ${LOCAL_USER_ID} LIMIT 1`)
  const grantSelf = await call('PUT', `/admin/masterdata/permission/role/${created.holderRole}/points`,
    [created.ids[CREATE_CODE], created.ids[EDIT_CODE]])
  check(grantSelf.code === 200, '建本地账号并把他所在的角色授上这两个点', `saved=${grantSelf.data}`)

  const deniedAfter = await deniedOf(farmerToken)
  check(!deniedAfter.includes(CREATE_CODE) && !deniedAfter.includes(EDIT_CODE)
    && deniedAfter.includes(DEPT_CODE) && deniedAfter.includes(POS_CODE),
    'denied 只减掉他持有的两个，另外两个仍然列出（按点判，不是按页面判）', deniedAfter.join(','))

  await page.goto(`${MDM}/user/org-tree`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const backText = await bodyText()
  const orgBack = await countOrgLinks()
  check(await countButton('+ 新增组织') === 1 && orgBack >= 1,
    '重进页面：两个按钮都回来了', `org-link=${orgBack}`)
  check(!backText.includes(HINT), '提示随之消失（不是留着一条过期的"已隐藏"）')

  await page.goto(`${MDM}/user/dept`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  check(await countButton('+ 新增部门') === 0 && await countButton('+ 新增岗位') === 0,
    '部门页仍然隐藏：他持有的点不包括这两个（同页不同按钮也分开判）')

  const allowed = await call('POST', '/api/user/orgs', { orgName: `按钮验证-${suffix}`, orgType: 'ENTERPRISE' },
    farmerToken, MERCHANT)
  check(allowed.code === 200, '接口同时放行（页面与服务端不会给出两个答案）', `code=${allowed.code} ${allowed.message}`)

  /* ---------- 6) 超管视角不受这张矩阵约束 ---------- */
  const adminDenied = ((await call('GET', '/admin/masterdata/permission/mine').then((r) => r.data ?? {})).denied ?? [])
  const adminOrgs = (await call('GET', '/admin/masterdata/permission/role/list?pageNum=1&pageSize=1')).code
  check(adminDenied.length === 0 && adminOrgs === 200,
    '收紧期间运营端仍然一切正常：超管 denied 为空、运营端接口照常可读', `denied=${adminDenied.length} code=${adminOrgs}`)

  check(jsErrors.length === 0, '全程无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 220))
} finally {
  await browser?.close().catch(() => {})
  /* ---------- 清理：本次造的授权、账号、角色与那条组织记录都退回基线 ---------- */
  for (const roleId of [created.restrictRole, created.holderRole]) {
    if (roleId) sql(`DELETE FROM agri_masterdata.agri_md_role_permission WHERE role_id = ${roleId}`)
  }
  if (created.userRoleId) sql(`DELETE FROM agri_masterdata.agri_md_user_role WHERE id = ${created.userRoleId}`)
  sql(`DELETE FROM agri_masterdata.agri_md_user WHERE id = ${LOCAL_USER_ID}`)
  sql(`DELETE FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_BV%'`)
  sql(`DELETE FROM agri_masterdata.agri_md_organization WHERE org_name LIKE '按钮验证-%'`)
  const residueCodes = [CREATE_CODE, EDIT_CODE, DEPT_CODE, POS_CODE].map(holdersOf)
  const residueOrg = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_organization WHERE org_name LIKE '按钮验证-%'`)
  const residueRole = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_BV%'`)
  const residueUser = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_user WHERE id = ${LOCAL_USER_ID}`)
  console.log('')
  check(residueCodes.every((count) => count === 0),
    '清理：四个点都回到未纳管（任何角色都不持有，按钮对所有人恢复可见）', `holders=${residueCodes.join('/')}`)
  check(residueOrg === '0' && residueRole === '0' && residueUser === '0',
    '清理：本次新增的组织、测试角色与本地账号零残留', `org=${residueOrg} role=${residueRole} user=${residueUser}`)
}

console.log('')
if (!failures.length) {
  console.log('主数据按钮显隐端到端验证全部通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((label) => console.log('  -', label))
process.exit(1)
