/**
 * 主数据 · 「申请授权」端到端验证（横幅提交 → 运营端处理 → 真的放开）
 *
 * 上一轮横幅只能"说清哪些按钮被藏了"，这一轮给它接上出口。验的不是一个按钮，是整条链：
 *   1. 企业端横幅上「申请授权」→ 勾选 → 提交，`agri_md_permission_request` 真的落库；
 *   2. **提交即查重**：同一人同一个点重复提交不产生第二条，页面把已排队的标成"已在排队"并禁止再勾；
 *   3. 运营端「角色权限矩阵」页的「授权申请」卡真的看得到这些单子（申请人 / 编码 / 页面 / 理由）；
 *   4. **同意就真授权**：点同意之后 `agri_md_role_permission` 出现该角色对该点的授权，
 *      申请人刷新页面按钮回来、接口放行 —— 三件事必须同时成立，缺一个就是"同意了但没放开"；
 *   5. **驳回必须写原因**，且不写原因时状态保持待处理；驳回后本人可以再申请一次
 *      （表上故意没有唯一键，就是为了这一条）；
 *   6. 申请人**没有绑定任何本地角色**时，同意会被服务端拒绝且**申请单保持待处理** ——
 *      不能把"授权失败"写成"已同意"，否则申请人以为开了其实没开；
 *   7. 申请入口本身不受权限点约束（`/api/user/permission-points` 从目录作用域里排除）：
 *      它的意义就是"我被拦了来要权限"，一旦被收紧就变成把人锁在门外的死循环。
 *
 * 用法：node scripts/e2e-mdm-permission-request-loop.mjs
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
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'outputs', 'mdm-permission-request-20261102')
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

/** 被测的两个按钮：企业端「组织架构」页的表头新增与行内编辑 */
const CREATE_CODE = 'POST /api/user/orgs'
const EDIT_CODE = 'PUT /api/user/orgs/{id}'
const HANDLE_CODE = 'PUT /admin/masterdata/permission/requests/{id}/handle'
const SUBMIT_PATH = '/api/user/permission-points/requests'
const HINT = '部分操作已隐藏'
/** 在本模块没有本地账号（实测 agri_md_user 里没有同名行）的平台账号 */
const NO_ROLE_ACCOUNT = 'provider'
/** 三个申请人都会产生申请单，清理与残留断言必须一起算 —— 少一个就是"谎报零残留" */
const APPLICANTS = `'farmer', '${NO_ROLE_ACCOUNT}', 'mdmops'`
const OUR_CODES = `'${CREATE_CODE}', '${EDIT_CODE}', '${HANDLE_CODE}'`

const suffix = String(Date.now()).slice(-8)
const LOCAL_USER_ID = `93${suffix}01`
const created = { restrictRole: '', holderRole: '', userRoleId: '', ids: {} }
let adminToken = ''
let farmerToken = ''
let noRoleToken = ''

const call = async (method, pathname, body, bearer = adminToken, merchant = '') => {
  const headers = { Authorization: `Bearer ${bearer}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }
  if (merchant) headers['X-Agri-Merchant'] = merchant
  const response = await fetch(`${MDM}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined })
  const json = await response.json().catch(() => ({}))
  // 本模块成功码是 200；失败也走 HTTP 200 + 业务码，判成败只看业务码
  return { status: response.status, code: json?.code ?? -1, message: json?.message ?? '', data: json?.data }
}

const farmerMine = async () =>
  (await call('GET', '/api/user/permission-points/mine', undefined, farmerToken, MERCHANT)).data ?? {}
const listOf = async (field) => ((await farmerMine())[field] ?? []).map(String)
const deniedOf = () => listOf('denied')
const pendingOf = () => listOf('pending')

/** 申请单主键一律回库查：不靠"第一条/第二条"的位置假设（提交顺序变了就会指错行） */
const requestIdOf = (applicant, permCode, status = 'PENDING') => sql(
  `SELECT id FROM agri_masterdata.agri_md_permission_request
    WHERE applicant = '${applicant}' AND perm_code = '${permCode}' AND status = '${status}'
    ORDER BY id DESC LIMIT 1`)
const requestRows = (where = '1') => Number(
  sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_permission_request WHERE ${where}`) || '0')
const requestField = (id, field) => sql(
  `SELECT IFNULL(${field}, '<NULL>') FROM agri_masterdata.agri_md_permission_request WHERE id = ${id}`)
/** 某角色对某个点的授权行数（同意必须落在这里，鉴权拦截器读的就是这张表） */
const grantRowsForRole = (roleId, permId) => Number(sql(
  `SELECT COUNT(*) FROM agri_masterdata.agri_md_role_permission
    WHERE role_id = ${roleId} AND perm_id = ${permId} AND del_flag = 0`) || '0')

/** 某个点被多少个角色持有（授权真的写进了鉴权拦截器读的那张表） */
const holdersOf = (code) => Number(sql(
  `SELECT COUNT(*) FROM agri_masterdata.agri_md_role_permission rp
     JOIN agri_masterdata.agri_md_permission p ON p.id = rp.perm_id
    WHERE p.perm_code = '${code}' AND p.del_flag = 0 AND rp.del_flag = 0`) || '0')

let browser
const pages = []

const visibleCount = (locator) => locator.evaluateAll(
  (nodes) => nodes.filter((node) => node.offsetParent !== null && node.style.display !== 'none').length,
)
const queue = (page) => page.locator('.request-queue')
const queueText = async (page) => (await queue(page).evaluate((node) => node.innerText)).replace(/\s+/g, ' ')
/** 矩阵页的授权申请卡里，按权限点编码定位到那一行（不按行号，列表顺序由后端 id 倒序决定） */
const rowOf = (page, code) => queue(page).locator('tbody tr').filter({ hasText: code }).first()
const checkedPickCount = (page) => page.locator('.mds-mask .point-hidden__pick input[type="checkbox"]')
  .evaluateAll((nodes) => nodes.filter((node) => node.checked).length)

async function openAs(username) {
  const page = await (await browser.newContext({ viewport: { width: 1680, height: 1050 } })).newPage()
  pages.push(page)
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error?.message ?? error).slice(0, 160)))
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
  /* ---------- 0) 三个登录态、目录与基线 ---------- */
  sql(`DELETE FROM agri_masterdata.agri_md_permission_request WHERE applicant IN (${APPLICANTS})`)
  // 兜一层：运营端账号提的单子 applicant 是 mdmops，但按来源页清更稳（换账号跑也不会留）
  sql("DELETE FROM agri_masterdata.agri_md_permission_request WHERE page_path = '/permission/matrix'")
  const login = async (username) => (await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, marketId: 1 }),
  })).json())?.data?.accessToken ?? ''
  adminToken = await login('admin')
  farmerToken = await login('farmer')
  noRoleToken = await login(NO_ROLE_ACCOUNT)
  check(Boolean(adminToken) && Boolean(farmerToken) && Boolean(noRoleToken),
    '取得超管、申请人（farmer）与无本地角色申请人（provider）三个登录态')

  await call('POST', '/admin/masterdata/permission/points/sync')
  const orgPoints = (await call('GET', '/admin/masterdata/permission/points?keyword=/api/user/org')).data ?? []
  created.ids[CREATE_CODE] = String(orgPoints.find((item) => item.permCode === CREATE_CODE)?.id ?? '')
  created.ids[EDIT_CODE] = String(orgPoints.find((item) => item.permCode === EDIT_CODE)?.id ?? '')
  const reqPoints = (await call('GET', `/admin/masterdata/permission/points?keyword=${encodeURIComponent('/permission/requests')}`)).data ?? []
  created.ids[HANDLE_CODE] = String(reqPoints.find((item) => item.permCode === HANDLE_CODE)?.id ?? '')
  check(/^\d+$/.test(created.ids[CREATE_CODE]) && /^\d+$/.test(created.ids[EDIT_CODE]),
    '两个业务按钮的权限点都在目录里',
    `${CREATE_CODE}#${created.ids[CREATE_CODE]} ${EDIT_CODE}#${created.ids[EDIT_CODE]}`)
  check(/^\d+$/.test(created.ids[HANDLE_CODE]),
    '「处理申请」这个运营端动作本身也进了目录（所以它和其它点一样能被收紧、被申请）',
    `id=${created.ids[HANDLE_CODE]}`)
  const excluded = (await call('GET', '/admin/masterdata/permission/points?keyword=permission-points')).data ?? []
  check(excluded.length === 0,
    '逃生通道不进目录：/api/user/permission-points/** 一条都没登记 —— 申请入口不能被它自己要的权限锁死',
    excluded.map((item) => item.permCode).join(','))

  /* ---------- 1) 收紧：farmer 一个都不持有，但他有本地角色可被授予 ---------- */
  const restrictRole = await call('POST', '/admin/masterdata/permission/role', {
    roleCode: `E2E_RQ_R_${suffix}`, roleName: `申请链收紧方-${suffix}`, roleKey: `e2eRqR${suffix}`,
    description: '端到端验证用：持有后 farmer 看不到按钮、可申请', status: 1,
  })
  created.restrictRole = String(restrictRole.data ?? '')
  const holderRole = await call('POST', '/admin/masterdata/permission/role', {
    roleCode: `E2E_RQ_H_${suffix}`, roleName: `申请链持有方-${suffix}`, roleKey: `e2eRqH${suffix}`,
    description: '端到端验证用：farmer 桥接到这个角色，同意后点落在这里', status: 1,
  })
  created.holderRole = String(holderRole.data ?? '')
  const grantRestrict = await call('PUT', `/admin/masterdata/permission/role/${created.restrictRole}/points`,
    [created.ids[CREATE_CODE], created.ids[EDIT_CODE]])
  check(grantRestrict.code === 200 && Number(grantRestrict.data) === 2,
    '把两个点授给"收紧方"角色（farmer 不持有 → 按钮消失、可申请）', `saved=${grantRestrict.data}`)

  sql(`INSERT INTO agri_masterdata.agri_md_user (id, user_code, username, password, real_name, status, del_flag, create_time, remark)
       VALUES (${LOCAL_USER_ID}, 'E2E_RQ_${suffix}', 'farmer', '!', '申请链端到端临时账号', 1, 0, NOW(), 'e2e 自造，跑完删除')`)
  sql(`INSERT INTO agri_masterdata.agri_md_user_role (user_id, role_id, status, del_flag, create_time)
       VALUES (${LOCAL_USER_ID}, ${created.holderRole}, 0, 0, NOW())`)
  created.userRoleId = sql(`SELECT id FROM agri_masterdata.agri_md_user_role WHERE user_id = ${LOCAL_USER_ID} LIMIT 1`)
  const deniedBaseline = await deniedOf()
  check([CREATE_CODE, EDIT_CODE].every((code) => deniedBaseline.includes(code)),
    '基线：farmer 的 denied 里有这两个点，且他桥接到了一个可被授予的本地角色', deniedBaseline.join(','))
  check(requestRows(`applicant IN (${APPLICANTS})`) === 0 && holdersOf(CREATE_CODE) === 1,
    '基线：没有历史申请单残留，两个点各只被收紧方持有 1 个角色')

  /* ---------- 2) 企业端：横幅上的「申请授权」提交两条 ---------- */
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const farmer = await openAs('farmer')
  await farmer.page.goto(`${MDM}/user/org-tree`, { waitUntil: 'networkidle', timeout: 30000 })
  await farmer.page.waitForTimeout(3500)
  const bannerText = (await farmer.page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(bannerText.includes(`${HINT}（2 项）`), '基线：横幅列出这一页被藏起来的两个点')
  const applyButton = farmer.page.locator('button').filter({ hasText: '申请授权' })
  check(await visibleCount(applyButton) === 1, '横幅上有「申请授权」按钮（只有真的被拦时才出现）')

  await applyButton.first().click()
  await farmer.page.waitForTimeout(1200)
  const dialog = farmer.page.locator('.mds-mask .mds-dialog')
  check(await dialog.count() === 1, '点「申请授权」弹出勾选框')
  check(await dialog.locator('.point-hidden__pick').count() === 2 && await checkedPickCount(farmer.page) === 2,
    '两个被藏的点都列出来且默认全部勾上（不用一个个手点）')

  await dialog.locator('textarea')
    .fill(`端到端验证：本月要批量建档，需要新增组织与编辑按钮-${suffix}`)
  await dialog.locator('button').filter({ hasText: '提交 2 条申请' }).click()
  await farmer.page.waitForTimeout(2500)
  check(await farmer.page.locator('.mds-mask').count() === 0, '提交成功后弹窗自动关闭')
  check(requestRows(`applicant = 'farmer'`) === 2
    && sql(`SELECT COUNT(DISTINCT perm_code) FROM agri_masterdata.agri_md_permission_request
             WHERE applicant = 'farmer' AND status = 'PENDING'`) === '2',
    '两条申请真的落库（状态 PENDING，编码就是页面上勾的那两个）',
    `POST#${requestIdOf('farmer', CREATE_CODE)} PUT#${requestIdOf('farmer', EDIT_CODE)}`)
  check(sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_permission_request
              WHERE applicant = 'farmer' AND page_path = '/user/org-tree' AND reason LIKE '%${suffix}%'`) === '2',
    '申请单带上了来源页面与理由（处理人拿得到上下文，不用猜是哪个按钮）')
  const spoof = await call('POST', SUBMIT_PATH,
    { applicant: 'admin', permCode: EDIT_CODE, reason: '替别人申请', pagePath: '/user/org-tree' },
    farmerToken, MERCHANT)
  check(spoof.code === 200 && String(spoof.data?.applicant) === 'farmer',
    '申请人只认令牌：请求体里传 applicant 也改不了归属（否则任何人都能替别人申请）',
    `applicant=${spoof.data?.applicant}`)
  await farmer.page.screenshot({ path: path.join(OUT, '01-banner-apply.png'), fullPage: true })

  /* ---------- 3) 查重：已排队的点不能再勾，重复提交也不产生第二条 ---------- */
  const pendingAfterSubmit = await pendingOf()
  check([CREATE_CODE, EDIT_CODE].every((code) => pendingAfterSubmit.includes(code)),
    '「我的权限点」把已提交的点标成 pending（前端据此显示"已在排队"）', pendingAfterSubmit.join(','))

  await applyButton.first().click()
  await farmer.page.waitForTimeout(1200)
  const pendingTags = await farmer.page.locator('.mds-mask .mds-tag').filter({ hasText: '已在排队' }).count()
  const reChecked = await checkedPickCount(farmer.page)
  const submitButton = farmer.page.locator('.mds-mask button').filter({ hasText: '提交 0 条申请' }).first()
  const submitDisabled = await submitButton.isDisabled().catch(() => false)
  check(pendingTags === 2 && reChecked === 0 && submitDisabled,
    '重开弹窗：两个点都标了"已在排队"、默认不勾、提交按钮不可点（重复申请同一个点没有意义）',
    `排队标记=${pendingTags} 默认勾选=${reChecked} disabled=${submitDisabled}`)
  await farmer.page.locator('.mds-mask .mds-dialog__close').click().catch(() => {})
  await farmer.page.waitForTimeout(800)

  const firstCreateId = requestIdOf('farmer', CREATE_CODE)
  const dup = await call('POST', SUBMIT_PATH,
    { permCode: CREATE_CODE, reason: '重复提交', pagePath: '/user/org-tree' }, farmerToken, MERCHANT)
  check(dup.code === 200 && String(dup.data?.id) === firstCreateId
    && requestRows(`applicant = 'farmer'`) === 2,
    '服务端也查重：重复提交返回那条已有的申请，不落第二条（表上没有唯一键，判重只能在服务层）',
    `id=${dup.data?.id} 行数=${requestRows(`applicant = 'farmer'`)}`)
  const ghost = await call('POST', SUBMIT_PATH,
    { permCode: 'POST /不存在的端点', reason: '假编码', pagePath: '/x' }, farmerToken, MERCHANT)
  check(ghost.code === 400 && String(ghost.message).includes('权限点不存在'),
    '目录里没有的编码不受理：给一个不存在的点排队，处理时必然失败',
    `code=${ghost.code} ${String(ghost.message).slice(0, 26)}`)

  /* ---------- 4) 运营端矩阵页看得到这些单子 ---------- */
  const admin = await openAs('admin')
  await admin.page.goto(`${MDM}/permission/matrix`, { waitUntil: 'networkidle', timeout: 30000 })
  await admin.page.waitForSelector('.request-queue tbody tr', { timeout: 45000 }).catch(() => {})
  await admin.page.waitForTimeout(2000)
  const queueShown = await queueText(admin.page)
  check(queueShown.includes('授权申请') && queueShown.includes(CREATE_CODE) && queueShown.includes(EDIT_CODE)
    && queueShown.includes('farmer') && queueShown.includes('/user/org-tree'),
    '运营端「授权申请」卡按待处理档列出这两条（申请人 + 编码 + 来源页面都在）；'
    + '本环境令牌没有昵称，所以申请人一栏退回显示用户名而不是编一个名字', queueShown.slice(0, 130))
  check(await rowOf(admin.page, CREATE_CODE).count() === 1 && await rowOf(admin.page, EDIT_CODE).count() === 1,
    '两条都是独立的一行（不是一个"申请"聚合在一起，处理是按点逐个处理的）')
  check(await rowOf(admin.page, CREATE_CODE).locator('span.mds-tag').filter({ hasText: '待处理' }).count() === 1,
    '状态标签是「待处理」')
  await admin.page.screenshot({ path: path.join(OUT, '02-ops-queue.png'), fullPage: true })

  /* ---------- 5) 驳回：不写原因被拒绝；写了原因才落库 ---------- */
  const editId = requestIdOf('farmer', EDIT_CODE)
  const rejectNoRemark = await call('PUT', `/admin/masterdata/permission/requests/${editId}/handle`, { approve: false })
  check(rejectNoRemark.code === 400 && String(rejectNoRemark.message).includes('驳回必须写原因'),
    '不写原因的驳回被服务端拒绝（否则只会让申请人再提一遍，队列变噪音）',
    String(rejectNoRemark.message).slice(0, 32))
  check(requestField(editId, 'status') === 'PENDING',
    '拒绝后申请单仍是待处理：没有把"没写原因"写成"已驳回"')

  await rowOf(admin.page, EDIT_CODE).locator('button').filter({ hasText: '驳回' }).click()
  await admin.page.waitForTimeout(900)
  const remarkInput = admin.page.locator('input[placeholder*="驳回原因"]')
  check(await visibleCount(remarkInput) === 1,
    '点「驳回」在行下展开原因输入框（不弹新窗，原因就在单子旁边写）')
  await remarkInput.fill('该按钮属于建档专员岗位，已另行安排账号处理')
  await admin.page.locator('button').filter({ hasText: '确认驳回' }).click()
  await admin.page.waitForTimeout(2500)
  check(requestField(editId, 'status') === 'REJECTED' && requestField(editId, 'handler') === 'admin'
    && String(requestField(editId, 'handle_remark')).includes('建档专员'),
    '驳回落库：REJECTED + 处理人取自令牌（不是写死的字符串）+ 原因原样存下',
    `${requestField(editId, 'status')}|${requestField(editId, 'handler')}`)
  check(await rowOf(admin.page, EDIT_CODE).count() === 0
    && (await queueText(admin.page)).includes(CREATE_CODE),
    '待处理档只剩那一条未处理的：已驳回的立即从队列里消失，不占着位置')

  /* ---------- 6) 同意：真的写授权，申请人侧三件事同时成立 ---------- */
  const createId = requestIdOf('farmer', CREATE_CODE)
  await rowOf(admin.page, CREATE_CODE).locator('button').filter({ hasText: '同意' }).click()
  await admin.page.waitForTimeout(4000)
  check(requestField(createId, 'status') === 'APPROVED' && requestField(createId, 'handler') === 'admin',
    '同意落库：APPROVED，处理人来自令牌', `${requestField(createId, 'status')}|${requestField(createId, 'handler')}`)
  check(holdersOf(CREATE_CODE) === 2 && holdersOf(EDIT_CODE) === 1,
    '「同意」真的写了 agri_md_role_permission（farmer 所在角色 + 这个点，持有数从 1 变 2）；被驳回的那个仍是 1 —— '
    + '不是只改了申请单状态',
    `POST=${holdersOf(CREATE_CODE)} PUT=${holdersOf(EDIT_CODE)}`)
  check(grantRowsForRole(created.holderRole, created.ids[CREATE_CODE]) === 1
    && grantRowsForRole(created.holderRole, created.ids[EDIT_CODE]) === 0,
    '授权落在 farmer 桥接的那个角色上（不是随便给了哪个角色）')
  const deniedAfterApprove = await deniedOf()
  check(!deniedAfterApprove.includes(CREATE_CODE) && deniedAfterApprove.includes(EDIT_CODE),
    '按点放开：新增组织回来了，被驳回的行内编辑仍然拦着', deniedAfterApprove.join(','))
  check((await pendingOf()).length === 0,
    '两条都处理完之后 pending 清空（否则弹窗会一直显示"已在排队"，第二条申请也提不了）')

  const handledText = await queueText(admin.page)
  check(handledText.includes('这一档没有授权申请') || !handledText.includes('待处理'),
    '队列清空后页面如实说"这一档没有授权申请"，不留一张空表让人以为还在加载', handledText.slice(0, 80))

  await farmer.page.goto(`${MDM}/user/org-tree`, { waitUntil: 'networkidle', timeout: 30000 })
  await farmer.page.waitForTimeout(3500)
  const createVisible = await visibleCount(farmer.page.locator('button').filter({ hasText: '+ 新增组织' }))
  const orgEditVisible = await visibleCount(farmer.page.locator('button.org-link'))
  const afterText = (await farmer.page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(createVisible === 1 && orgEditVisible === 0,
    '企业端刷新页面：同意的「新增组织」回来了，驳回的「编辑」仍然隐藏（按钮与服务端同源，不是前端自己判的）',
    `新增=${createVisible} 编辑=${orgEditVisible}`)
  check(afterText.includes(`${HINT}（1 项）`) && afterText.includes(EDIT_CODE) && !afterText.includes(CREATE_CODE),
    '横幅计数降到 1 项，且只列还没放开的那个点',
    afterText.match(/部分操作已隐藏[^]{0,80}/)?.[0]?.slice(0, 90) ?? '')
  await farmer.page.screenshot({ path: path.join(OUT, '03-after-approve.png'), fullPage: true })

  const allowed = await call('POST', '/api/user/orgs', { orgName: `申请链验证-${suffix}`, orgType: 'ENTERPRISE' },
    farmerToken, MERCHANT)
  check(allowed.code === 200, '接口同时放行：按钮回来了，服务端也放行（两面读的是同一份授权）',
    `code=${allowed.code} ${String(allowed.message).slice(0, 24)}`)
  const stillBlocked = await call('PUT', '/api/user/orgs/1', { orgName: `申请链验证-编辑-${suffix}` },
    farmerToken, MERCHANT)
  check(stillBlocked.code === 403 && String(stillBlocked.message).includes('缺少权限点'),
    '被驳回的那个点仍然 403：同意一条不会连带放开同页其它点', `code=${stillBlocked.code}`)

  /* ---------- 7) 驳回之后可以再申请（表上没有唯一键） ---------- */
  await farmer.page.locator('button').filter({ hasText: '申请授权' }).first().click()
  await farmer.page.waitForTimeout(1200)
  const rePick = await checkedPickCount(farmer.page)
  check(rePick === 1,
    '被驳回的那条不在"已在排队"里：默认重新勾上，可以再申请一次', `默认勾选=${rePick}`)
  await farmer.page.locator('.mds-mask textarea').fill(`补充说明：已确认由我负责，请重新评估-${suffix}`)
  await farmer.page.locator('.mds-mask button').filter({ hasText: '提交 1 条申请' }).click()
  await farmer.page.waitForTimeout(2500)
  check(requestRows(`applicant = 'farmer' AND perm_code = '${EDIT_CODE}'`) === 2
    && requestField(requestIdOf('farmer', EDIT_CODE), 'status') === 'PENDING'
    && String(requestField(requestIdOf('farmer', EDIT_CODE), 'reason')).includes('补充说明'),
    '同一个人同一个点可以有第二条（第一条已驳回）—— 这就是表上故意不加唯一键的原因',
    `行数=${requestRows(`applicant = 'farmer' AND perm_code = '${EDIT_CODE}'`)}`)
  await farmer.page.screenshot({ path: path.join(OUT, '04-resubmit.png'), fullPage: true })

  /* ---------- 8) 没有本地角色的申请人：同意会被拒且单子保持待处理 ---------- */
  // 申请与「我的权限点」只认令牌，不带 X-Agri-Merchant：带上就会被主体归属守卫判 3002，
  // 而被拦的人恰恰是"不知道该用哪个主体"的那个 —— 出口不能再要一次归属。
  const noRoleSubmit = await call('POST', SUBMIT_PATH,
    { permCode: CREATE_CODE, reason: '没有本地角色的账号申请', pagePath: '/user/org-tree' }, noRoleToken)
  check(noRoleSubmit.code === 200 && /^\d+$/.test(String(noRoleSubmit.data?.id)),
    `${NO_ROLE_ACCOUNT}（本模块没有本地账号）也能提交申请 —— 申请入口只验登录，不验本地角色`,
    `id=${noRoleSubmit.data?.id}`)
  const noRoleId = String(noRoleSubmit.data?.id)
  const noRoleApprove = await call('PUT', `/admin/masterdata/permission/requests/${noRoleId}/handle`, { approve: true })
  check(noRoleApprove.code === 400 && String(noRoleApprove.message).includes('还没有绑定任何角色'),
    '给没有角色的账号授权会被拒：授权只存在于"角色 ↔ 权限点"这一层，没有角色就没有授权位',
    String(noRoleApprove.message).slice(0, 44))
  check(requestField(noRoleId, 'status') === 'PENDING',
    '授权失败时申请单保持待处理（事务回滚）：不能把"没办成"写成"已同意"', `id=${noRoleId}`)
  check(holdersOf(CREATE_CODE) === 2,
    '这次失败的处理没有在 agri_md_role_permission 留下半条授权（持有数仍是 2）', `holders=${holdersOf(CREATE_CODE)}`)
  const doubleHandle = await call('PUT', `/admin/masterdata/permission/requests/${createId}/handle`,
    { approve: false, remark: '再处理一次' })
  check(doubleHandle.code === 400 && String(doubleHandle.message).includes('已经处理过'),
    '同一单不重复处理：已同意的单子再点驳回会被拒（防止把已生效的授权状态改花）',
    String(doubleHandle.message).slice(0, 34))
  const missingHandle = await call('PUT', '/admin/masterdata/permission/requests/999999999/handle', { approve: true })
  check(missingHandle.code === 404, '不存在的申请单返回 404，不是静默成功', `code=${missingHandle.code}`)

  /* ---------- 9) 非超管运营账号也看得见队列 + 申请入口对运营端同样开放 ---------- */
  const opsToken = await login('mdmops')
  const opsQueue = await call('GET', '/admin/masterdata/permission/requests?status=PENDING', undefined, opsToken)
  const opsQueueRows = opsQueue.data ?? []
  check(opsQueue.code === 200 && opsQueueRows.length >= 2
    && opsQueueRows.some((row) => row.applicant === 'farmer')
    && opsQueueRows.some((row) => row.applicant === NO_ROLE_ACCOUNT),
    'mdmops（非超管运营）能读授权申请队列 —— 处理队列不该只有超管看得见',
    `code=${opsQueue.code} 条数=${opsQueueRows.length}`)
  const opsSubmit = await call('POST', SUBMIT_PATH,
    { permCode: HANDLE_CODE, reason: '运营端按钮被藏时也要能申请', pagePath: '/permission/matrix' }, opsToken)
  check(opsSubmit.code === 200 && /^\d+$/.test(String(opsSubmit.data?.id)),
    '运营端账号也走同一个申请入口（横幅是两端共用的组件，出口也必须共用）', `id=${opsSubmit.data?.id}`)
  const opsHandle = await call('PUT', `/admin/masterdata/permission/requests/${opsSubmit.data?.id}/handle`,
    { approve: false, remark: '端到端验证：驳回运营端这条' })
  check(opsHandle.code === 200 && String(opsHandle.data?.status) === 'REJECTED',
    '运营端提的单子也在同一条链上处理掉（不留悬挂数据）', `status=${opsHandle.data?.status}`)

  const jsErrors = [...farmer.errors, ...admin.errors]
  check(jsErrors.length === 0, '全程无自身 JS 错误（弹窗、队列、行内驳回都真点过）', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 220))
} finally {
  await Promise.all(pages.map((item) => item.context().close().catch(() => {})))
  await browser?.close().catch(() => {})
  /* ---------- 清理：申请单、授权、角色、本地账号、本次建的组织全部退回基线 ---------- */
  sql(`DELETE FROM agri_masterdata.agri_md_permission_request WHERE applicant IN (${APPLICANTS})`)
  // 兜一层：运营端账号提的单子 applicant 是 mdmops，但按来源页清更稳（换账号跑也不会留）
  sql("DELETE FROM agri_masterdata.agri_md_permission_request WHERE page_path = '/permission/matrix'")
  for (const roleId of [created.restrictRole, created.holderRole]) {
    if (roleId) sql(`DELETE FROM agri_masterdata.agri_md_role_permission WHERE role_id = ${roleId}`)
  }
  if (created.userRoleId) sql(`DELETE FROM agri_masterdata.agri_md_user_role WHERE id = ${created.userRoleId}`)
  sql(`DELETE FROM agri_masterdata.agri_md_user WHERE id = ${LOCAL_USER_ID}`)
  sql(`DELETE FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_RQ_%'`)
  sql(`DELETE FROM agri_masterdata.agri_md_organization WHERE org_name LIKE '申请链验证-%'`)
  const residueRequest = requestRows(`perm_code IN (${OUR_CODES}) OR applicant IN (${APPLICANTS})`)
  const residueCreate = holdersOf(CREATE_CODE)
  const residueEdit = holdersOf(EDIT_CODE)
  const residueHandle = holdersOf(HANDLE_CODE)
  const residueRole = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_role WHERE role_code LIKE 'E2E_RQ_%'`)
  const residueUser = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_user WHERE id = ${LOCAL_USER_ID}`)
  const residueOrg = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_organization WHERE org_name LIKE '申请链验证-%'`)
  console.log('')
  check(residueRequest === 0 && residueCreate === 0 && residueEdit === 0 && residueHandle === 0,
    '清理：授权申请与角色授权零残留（三个点都回到未纳管，任何人都不再被拦）',
    `request=${residueRequest} holders=${residueCreate}/${residueEdit}/${residueHandle}`)
  check(residueRole === '0' && residueUser === '0' && residueOrg === '0',
    '清理：测试角色、本地账号与本次建的组织零残留',
    `role=${residueRole} user=${residueUser} org=${residueOrg}`)
}

console.log('')
if (!failures.length) {
  console.log('主数据「申请授权」端到端验证全部通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((label) => console.log('  -', label))
process.exit(1)
