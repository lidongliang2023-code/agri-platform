/**
 * 主数据企业端 · 组织与权限五页 端到端验证
 *
 * 覆盖：组织架构 / 部门与岗位 / 成员账号 / 成员邀请 / 角色与权限。
 *
 * <p>本轮重点有两个，脚本也围绕它们设计：</p>
 * <ol>
 *   <li><b>能落库</b>：页面上新增组织/部门/岗位/角色 → 直连 MySQL 核对
 *       （编码自动生成、tenant_id 正确、父子层级正确）</li>
 *   <li><b>不重复造轮子</b>：成员与邀请以<b>用户中心</b>为权威源。
 *       成员页应显示统一认证的真实成员数（2），而不是主数据本地表的种子数据（5）；
 *       邀请页应接用户中心的加入申请，而不是自建邀请表。</li>
 * </ol>
 *
 * 用法：node scripts/e2e-mdm-org-permission.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const MYSQL = existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
  : ''
const sql = (q) => {
  if (!MYSQL) return ''
  try {
    return execFileSync(
      MYSQL,
      ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' },
    ).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 80)}`
  }
}

const BASE = 'http://localhost:8080'
const MERCHANT = '2001'
const MARK = `组织验证${Date.now().toString().slice(-5)}`
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
    return ''
  }
})()

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1560, height: 1000 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = String(e?.message ?? e)
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

const text = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
const created = { orgId: '', deptId: '', posId: '', roleId: '' }

try {
  /* ---------- 登录 ---------- */
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click({ timeout: 10000 })
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(5500)
  check(!page.url().includes(':8090'), '统一认证登录成功', page.url().replace('http://localhost', ''))

  /* ---------- 1) 组织架构：页面新增 → 落库 ---------- */
  await page.goto(`${BASE}/user/org-tree`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2500)
  check((await text()).includes('组织架构'), '「组织架构」页已打开')

  await page.locator('button', { hasText: '+ 新增组织' }).first().click()
  await page.waitForTimeout(600)
  const dialog = page.locator('.mds-dialog')
  await dialog.locator('input').first().fill(`${MARK}组织`)
  await dialog.locator('select').nth(1).selectOption({ index: 1 }) // 上级组织：选第一个（根组织）
  await dialog.locator('button', { hasText: '保存' }).click()
  await page.waitForTimeout(2500)

  const orgRow = sql(
    `SELECT id,org_code,org_name,org_level,parent_id,tenant_id FROM agri_masterdata.agri_md_organization ` +
    `WHERE org_name='${MARK}组织' LIMIT 1`,
  )
  const orgCols = orgRow.split('\t')
  created.orgId = orgCols[0] ?? ''
  check(Boolean(created.orgId) && /^\d+$/.test(created.orgId), '页面新增的组织已落库', orgRow || '(无记录)')
  check(/^ORG2001-\d{3}$/.test(orgCols[1] ?? ''), '组织编码自动生成', `code=${orgCols[1]}`)
  check(orgCols[5] === MERCHANT, 'tenant_id 由服务端写入当前主体', `tenant=${orgCols[5]}`)
  check(Number(orgCols[3]) === 2, '层级按父节点推算（根下为 2 级）', `level=${orgCols[3]}`)

  /* ---------- 2) 部门与岗位：页面新增 → 落库 ---------- */
  await page.goto(`${BASE}/user/dept`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2500)
  check((await text()).includes('部门'), '「部门与岗位」页已打开')

  await page.locator('button', { hasText: '+ 新增部门' }).first().click()
  await page.waitForTimeout(600)
  const deptDialog = page.locator('.mds-dialog').first()
  await deptDialog.locator('input').first().fill(`${MARK}部门`)
  await deptDialog.locator('button', { hasText: '保存' }).click()
  await page.waitForTimeout(2500)

  const deptRow = sql(
    `SELECT id,dept_code,dept_name,org_id FROM agri_masterdata.agri_md_department ` +
    `WHERE dept_name='${MARK}部门' LIMIT 1`,
  )
  const deptCols = deptRow.split('\t')
  created.deptId = deptCols[0] ?? ''
  check(Boolean(created.deptId) && /^\d+$/.test(created.deptId), '页面新增的部门已落库', deptRow || '(无记录)')
  check(/^DEPT2001-\d{2}$/.test(deptCols[1] ?? ''), '部门编码自动生成', `code=${deptCols[1]}`)

  await page.locator('button', { hasText: '+ 新增岗位' }).first().click()
  await page.waitForTimeout(600)
  const posDialog = page.locator('.mds-dialog').last()
  await posDialog.locator('input').first().fill(`${MARK}岗位`)
  await posDialog.locator('button', { hasText: '保存' }).click()
  await page.waitForTimeout(2500)

  const posRow = sql(
    `SELECT position_id,position_code,position_name,dept_id FROM agri_masterdata.agri_md_position ` +
    `WHERE position_name='${MARK}岗位' LIMIT 1`,
  )
  const posCols = posRow.split('\t')
  created.posId = posCols[0] ?? ''
  check(Boolean(created.posId), '页面新增的岗位已落库', posRow || '(无记录)')
  check(/^POS-P-\d{2}$/.test(posCols[1] ?? ''), '岗位编码自动生成', `code=${posCols[1]}`)

  /* ---------- 3) 角色与权限：页面新增 → 落库 ---------- */
  await page.goto(`${BASE}/user/roles`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2500)
  check((await text()).includes('角色'), '「角色与权限」页已打开')

  await page.locator('button', { hasText: '+ 新增角色' }).first().click()
  await page.waitForTimeout(600)
  const roleDialog = page.locator('.mds-dialog')
  await roleDialog.locator('input').first().fill(`${MARK}角色`)
  await roleDialog.locator('button', { hasText: '保存' }).click()
  await page.waitForTimeout(2500)

  const roleRow = sql(
    `SELECT id,role_code,role_name,tenant_id,is_system FROM agri_masterdata.agri_md_role ` +
    `WHERE role_name='${MARK}角色' LIMIT 1`,
  )
  const roleCols = roleRow.split('\t')
  created.roleId = roleCols[0] ?? ''
  check(Boolean(created.roleId) && /^\d+$/.test(created.roleId), '页面新增的角色已落库', roleRow || '(无记录)')
  check(roleCols[3] === MERCHANT, '角色 tenant_id = 当前主体', `tenant=${roleCols[3]}`)
  check(roleCols[4] === '0', '自建角色 is_system=0（不冒充内置）', `is_system=${roleCols[4]}`)

  /* ---------- 4) 成员账号：以用户中心为准，不是本地种子数据 ---------- */
  const coreMembers = await page.evaluate(async (merchant) => {
    const tok = (await (await fetch('/api/v1/auth/refresh', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: '{}',
    })).json())?.data?.accessToken ?? ''
    const res = await fetch(`/api/v1/sso/account/businesses/${merchant}/members`, {
      credentials: 'include', headers: { Authorization: `Bearer ${tok}` },
    })
    const j = await res.json().catch(() => null)
    return { code: j?.code, total: j?.data?.total, records: j?.data?.records ?? [] }
  }, MERCHANT)
  check(coreMembers.code === 0, '用户中心成员接口可用', `code=${coreMembers.code}`)

  await page.goto(`${BASE}/user/members`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  const memberText = await text()
  check(memberText.includes('用户中心'), '成员页声明数据源为用户中心')
  check(memberText.includes(`共 ${coreMembers.total} 人`), '成员数与用户中心一致',
    `页面应为 ${coreMembers.total}，实际文本含「共 ${coreMembers.total} 人」=${memberText.includes(`共 ${coreMembers.total} 人`)}`)

  const localCount = Number(
    sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_user WHERE tenant_id='${MERCHANT}' AND del_flag=0`),
  )
  check(localCount !== coreMembers.total, '本地表与用户中心成员数确实不同（证明两套数据）',
    `本地 ${localCount} / 用户中心 ${coreMembers.total}`)
  check(!memberText.includes(`共 ${localCount} 人`), '成员页没有按本地表人数展示（不拿种子数据冒充）')

  /* ---------- 5) 邀请页：接用户中心加入申请，不自建邀请表 ---------- */
  await page.goto(`${BASE}/user/invite`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2500)
  const inviteText = await text()
  check(inviteText.includes('待审批的加入申请'), '邀请页展示「待审批的加入申请」区块')
  check(inviteText.includes('用户中心'), '邀请页说明申请由用户中心受理')
  check(!inviteText.includes('邀请码'), '没有自造"邀请码"概念（不重复造轮子）')

  check(jsErrors.length === 0, '全程无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  await browser.close()
  /* 清理本次测试数据（按创建顺序反向删，避免外键/父子残留） */
  if (created.posId) sql(`DELETE FROM agri_masterdata.agri_md_position WHERE position_id='${created.posId}'`)
  if (created.deptId) sql(`DELETE FROM agri_masterdata.agri_md_department WHERE id=${created.deptId}`)
  if (created.orgId) sql(`DELETE FROM agri_masterdata.agri_md_organization WHERE id=${created.orgId}`)
  if (created.roleId) sql(`DELETE FROM agri_masterdata.agri_md_role WHERE id=${created.roleId}`)
}

const left = sql(
  `SELECT (SELECT COUNT(*) FROM agri_masterdata.agri_md_organization WHERE org_name LIKE '${MARK}%') +
          (SELECT COUNT(*) FROM agri_masterdata.agri_md_department WHERE dept_name LIKE '${MARK}%') +
          (SELECT COUNT(*) FROM agri_masterdata.agri_md_position WHERE position_name LIKE '${MARK}%') +
          (SELECT COUNT(*) FROM agri_masterdata.agri_md_role WHERE role_name LIKE '${MARK}%')`,
)
console.log(`\n清理：残留测试数据 ${left} 条（应为 0）`)
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
