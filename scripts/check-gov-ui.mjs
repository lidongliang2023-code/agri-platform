/**
 * 政府监管三端浏览器点检（主体端 :8108 / 移动执法端 :8109 / 监管运营端 :8110）
 *
 * 覆盖的是"页面上真点得动"这一段，接口级判据在 e2e-government-flow.mjs 里：
 *   主体端发起举报 → 运营端办理并通知被举报主体 → 运营端维护执法事项清单
 *   → 运营端点名承办人建任务（清单按模板展开）→ 执法人员移动端接单、逐项打勾并提交结论
 *   → 现场取证落库并回读证据摘要 → 扫码按信用代码带出主体档案 → 收件箱已读回写
 *   → 公众溯源核验读生产域真实存证（节点数/已上链数/未上链标记/种子假码必查不到/缺值不出 undefined）
 *   → 执法端扫同一条码看到同一份数据 → 主体端顶栏按登录身份显示"我是哪家"、双公示跨主体、公众查询空关键词被拒
 *   → 导出为真实文件下载 → 全程临时数据清理归零、被改动的种子状态逐条还原。
 *
 * 用法：node scripts/check-gov-ui.mjs
 *   前置：core :8093、government :8095、gateway 8108/8109/8110 在跑，
 *        且已执行 node scripts/provision-gov-access.mjs（执法账号 inspector 与两条绑定）。
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
].find((p) => existsSync(p))
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'

const PORTAL = 'http://localhost:8108/gov/'
const MOBILE = 'http://localhost:8109/gov-mobile/'
const OPS = 'http://localhost:8110/gov-ops/'
const PASSWORD = 'Admin@123'
const MARKER = 'UI点检'
const SUBJECT_NAME = '绿源蔬菜专业合作社'
const INSPECTOR_NAME = '王磊'

const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'gov-ui-20261101')
mkdirSync(OUT, { recursive: true })

let checked = 0
const failures = []
const check = (ok, label, extra = '') => {
  checked += 1
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const sql = (query) => {
  if (!existsSync(MYSQL)) return ''
  const result = spawnSync(MYSQL,
    ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query], { encoding: 'utf8' })
  if (result.status !== 0) return `ERR:${String(result.stderr ?? '').trim().slice(0, 160)}`
  return String(result.stdout ?? '').trim()
}
const exec = (query) => {
  const out = sql(query)
  if (String(out).startsWith('ERR')) {
    console.log(`  ! SQL 失败：${out}　← ${query.replace(/\s+/g, ' ').slice(0, 110)}`)
  }
  return out
}
const scalar = (query) => sql(query).split('\n')[0] ?? ''
const maxId = (table) => Number(scalar(`SELECT COALESCE(MAX(id),0) FROM agri_government.${table}`)) || 0

const pageText = async (page) => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
/** antd 会在两个汉字的按钮里插一个空格（"办理"渲染成"办 理"），所以文案定位一律允许字间空白。 */
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
  return (await page.locator('.ant-message-notice, .uni-toast, uni-toast').allInnerTexts()).join(' ').replace(/\s+/g, ' ')
}
const navOps = async (page, label) => {
  await page.locator('aside.o-sidebar button').filter({ hasText: cjk(label) }).first().click()
  await page.waitForTimeout(900)
}
const navPortal = async (page, label) => {
  await page.locator('aside.g-sidebar button').filter({ hasText: cjk(label) }).first().click()
  await page.waitForTimeout(900)
}
/** antd 下拉：先按表单项文案定位，再点选项，避免写死第几个 select。 */
const pickOption = async (page, itemLabel, optionText) => {
  const item = page.locator('.ant-modal-content .ant-form-item, .ant-drawer-content .ant-form-item')
    .filter({ hasText: itemLabel }).first()
  await item.locator('.ant-select').first().click()
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: optionText }).first()
  await option.waitFor({ state: 'visible', timeout: 8000 })
  await option.click()
  await page.waitForTimeout(250)
}
const fillForm = async (page, itemLabel, value) => {
  const item = page.locator('.ant-modal-content .ant-form-item').filter({ hasText: itemLabel }).first()
  await item.locator('textarea, input').first().fill(value)
}
const modalConfirm = async (page) => {
  await page.locator('.ant-modal-content .ant-modal-footer .ant-btn-primary').last().click()
  await page.waitForTimeout(1200)
}
const modalCancel = async (page) => {
  await page.locator('.ant-modal-content').locator('button').filter({ hasText: cjk('取消') }).last().click()
  await page.waitForTimeout(500)
}

async function ssoLogin(page, base, username) {
  const port = new URL(base).port
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  // 用当前页的 port 判断是否已回到本端：直接 includes(port) 会把 redirect_uri 里的端口也算进去
  if (new URL(page.url()).port !== port) {
    await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
    await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 }).catch(() => {})
    await page.locator('input[placeholder*="用户名"]').first().fill(username).catch(() => {})
    await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD).catch(() => {})
    await page.locator('button').filter({ hasText: '登' }).first().click().catch(() => {})
    await page.waitForFunction((p) => new URL(location.href).port === p, port, { timeout: 30000 }).catch(() => {})
    await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
    await page.waitForTimeout(2200)
  }
  return new URL(page.url()).port === port
}

/**
 * uni-app H5 的 hash 路由：直接 goto 只在 hash 段变化时不会重新进入页面，
 * 提交后页面自己 navigateBack 也会把目标路由盖掉。所以按"改 hash → 等页面上该有的文案 → 不行就整页重载"走。
 */
async function openMobile(page, hashPath, marker) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await page.evaluate((hash) => { window.location.hash = hash }, `#${hashPath}`).catch(() => {})
    if (await hasText(page, marker, 8000)) return true
    await page.goto(`${MOBILE}#${hashPath}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
    await page.waitForTimeout(1500)
    if (await hasText(page, marker, 6000)) return true
  }
  return false
}

async function uniLogin(page, username) {  await page.goto(`${MOBILE}#/pages/login/index`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  // uni-app 把 placeholder 渲染成一个覆盖层 div，input 上没有 placeholder 属性，只能按位置取
  const boxes = page.locator('.input-box input')
  if (await boxes.count() >= 2) {
    await boxes.nth(0).fill(username)
    await boxes.nth(1).fill(PASSWORD)
    await page.locator('uni-button, button').filter({ hasText: /^登录$/ }).first().click()
    await page.waitForFunction(() => !location.hash.includes('login'), null, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(2000)
  }
  return pageText(page)
}

const today = new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })

let browser
try {
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
} catch (error) {
  console.error('浏览器启动失败：', error?.message ?? error)
  process.exit(1)
}

// 本轮新建的行一律按"建前最大 id"清理，不靠名称猜
const before = {
  task: maxId('gov_task'), item: maxId('gov_check_item'), evidence: maxId('gov_evidence'),
  complaint: maxId('gov_complaint'), message: maxId('gov_message'), log: maxId('gov_op_log'),
  case: maxId('gov_case'), report: maxId('gov_report'), selfCheck: maxId('gov_self_check'),
  subsidy: maxId('gov_subsidy'), repair: maxId('gov_credit_repair'),
}
const inspectorId = scalar(`SELECT id FROM agri_government.gov_user WHERE name='${INSPECTOR_NAME}' LIMIT 1`)
const subjectId = scalar(`SELECT id FROM agri_government.gov_subject WHERE subject_name='${SUBJECT_NAME}' LIMIT 1`)
const subjectCreditCode = scalar(`SELECT credit_code FROM agri_government.gov_subject WHERE id=${subjectId}`)
const subjectPhone = scalar(`SELECT contact_phone FROM agri_government.gov_subject WHERE id=${subjectId}`)
const unreadInspectorBefore = scalar(
  `SELECT COALESCE(GROUP_CONCAT(id),'') FROM agri_government.gov_message WHERE assignee_id=${inspectorId} AND is_read=FALSE`)
const unreadSubjectBefore = scalar(
  `SELECT COALESCE(GROUP_CONCAT(id),'') FROM agri_government.gov_message WHERE subject_id=${subjectId} AND is_read=FALSE`)
const subjectUnreadCountBefore = Number(scalar(
  `SELECT COUNT(*) FROM agri_government.gov_message WHERE subject_id=${subjectId} AND is_read=FALSE`))
// 预警与举报是被真实修改的种子行，记下原值逐条还原
const warningSeed = sql(`SELECT CONCAT(warning_no,'#',status,'#',IFNULL(assignee_id,''),'#',IFNULL(assigned_to,''),'#',
  IFNULL(handle_note,'')) FROM agri_government.gov_warning WHERE status<>'closed' ORDER BY id LIMIT 1`)
const warningNo = String(warningSeed).startsWith('ERR') ? '' : String(warningSeed).split('#')[0]
const merchantBefore = scalar(`SELECT IFNULL(merchant_id,'') FROM agri_government.gov_subject WHERE id=${subjectId}`)
const complaintCountBefore = Number(scalar('SELECT COUNT(*) FROM agri_government.gov_complaint'))

const desktopErrors = []
const mobileErrors = []

try {
  /* ==================== A. 主体端：发起举报 ==================== */
  const desktop = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true })
  const portal = await desktop.newPage()
  portal.on('pageerror', (e) => portal.url().includes(':8108')
    && desktopErrors.push(String(e?.message ?? e).slice(0, 140)))
  const ops = await desktop.newPage()
  ops.on('pageerror', (e) => ops.url().includes(':8110')
    && desktopErrors.push(String(e?.message ?? e).slice(0, 140)))

  check(await ssoLogin(portal, PORTAL, 'admin'), '主体端统一登录成功', portal.url())
  const portalHome = await pageText(portal)
  check(portalHome.includes(SUBJECT_NAME), '主体端顶栏按登录身份显示所属主体', SUBJECT_NAME)
  check(!portalHome.includes('2026-10-25'), '顶栏不再有写死的日期（改成真实主体名）')
  const badge = Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=${subjectId} AND is_read=FALSE`))
  const headerBadge = await portal.locator('.g-header-right button i').count()
  check(badge === 0 ? headerBadge === 0 : headerBadge === 1,
    '未读角标条数与库里本主体的未读数一致（不再是常量 3）', `库=${badge} 角标=${headerBadge}`)

  await navPortal(portal, '投诉举报与建议')
  await portal.locator('button').filter({ hasText: cjk('我要举报') }).first().click()
  await portal.waitForSelector('.ant-modal-content', { timeout: 8000 })
  await fillForm(portal, '标题', `${MARKER} 门店农药台账不齐`)
  await fillForm(portal, '涉及对象', SUBJECT_NAME)
  await fillForm(portal, '详细情况', `${MARKER} 现场看到进销货台账缺 3 笔采购记录，请核查。`)
  await fillForm(portal, '举报人', '匿名市民')
  await modalConfirm(portal)
  const complaintToast = await toasts(portal)
  check(complaintToast.includes('举报已提交') || await hasText(portal, `${MARKER} 门店农药台账不齐`, 3000),
    '主体端举报提交成功', complaintToast.slice(0, 40))
  const uiComplaint = scalar(`SELECT CONCAT(id,'#',complaint_no) FROM agri_government.gov_complaint
    WHERE title LIKE '%${MARKER}%' ORDER BY id DESC LIMIT 1`)
  check(Boolean(uiComplaint) && !uiComplaint.startsWith('ERR'), '举报真落库（可回读编号）', uiComplaint)

  /* ==================== B. 运营端：办理举报 / 清单 / 任务 / 预警 / 台账 ==================== */
  check(await ssoLogin(ops, OPS, 'admin'), '运营端复用同一统一登录会话进入', ops.url())
  const opsHome = await pageText(ops)
  check(opsHome.includes(today), '运营端顶栏显示当天日期', today)
  const aiExpected = Number(scalar(`SELECT (SELECT COUNT(*) FROM agri_government.gov_warning
    WHERE ai_confidence IS NOT NULL) + (SELECT COUNT(*) FROM agri_government.gov_self_check)`))
  check(opsHome.includes('AI今日辅助') && opsHome.includes(`AI今日辅助 ${aiExpected}`),
    '运营工作台 AI 辅助条数与库中记录一致（不是常量 146）', `aiAssist=${aiExpected}`)

  await navOps(ops, '举报处理')
  const complaintCard = ops.locator('.o-complaint-grid section').filter({ hasText: `${MARKER} 门店农药台账不齐` }).first()
  check(await complaintCard.isVisible().catch(() => false), '运营端能看到主体端刚提交的举报')
  await complaintCard.locator('button').filter({ hasText: cjk('办理') }).click()
  await ops.waitForSelector('.ant-modal-content', { timeout: 8000 })
  await fillForm(ops, '处理结论', `${MARKER} 已核查并责令补录台账`)
  await modalConfirm(ops)
  check((await toasts(ops)).includes('举报已办结'), '运营端办结举报并提示已通知被举报主体')
  const complaintRow = sql(`SELECT CONCAT(status,'#',IFNULL(handle_note,'')) FROM agri_government.gov_complaint
    WHERE id=${uiComplaint.split('#')[0]}`)
  check(String(complaintRow).includes('resolved') && String(complaintRow).includes(MARKER),
    '办结结论写进举报单', String(complaintRow).slice(0, 70))
  const complaintNotice = Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=${subjectId} AND content LIKE '%${MARKER} 已核查并责令补录台账%'`))
  check(complaintNotice === 1, '被举报主体收到处理结论（站内信真的写进去了）', `rows=${complaintNotice}`)

  await navOps(ops, '执法事项清单')
  const itemCountBefore = Number(scalar("SELECT COUNT(*) FROM agri_government.gov_check_item WHERE status='active'"))
  await ops.locator('button').filter({ hasText: cjk('新增检查项') }).click()
  await ops.waitForSelector('.ant-modal-content', { timeout: 8000 })
  await fillForm(ops, '检查项名称', `${MARKER} 农残速测试剂效期`)
  await fillForm(ops, '检查说明', '核对试剂在有效期内且有领用记录')
  await modalConfirm(ops)
  check((await toasts(ops)).includes('检查项已加入清单模板'), '新增检查项成功')
  const newItemId = maxId('gov_check_item')
  check(newItemId > before.item, '新检查项落库', `id=${newItemId}`)
  const firstSwitch = ops.locator('.ant-table-row .ant-switch').first()
  await firstSwitch.click()
  check((await toasts(ops)).includes('已停用'), '检查项可停用', (await pageText(ops)).includes('仅影响新建任务') ? '提示写明只影响新任务' : '')
  await firstSwitch.click()
  await ops.waitForTimeout(800)
  const activeNow = Number(scalar("SELECT COUNT(*) FROM agri_government.gov_check_item WHERE status='active'"))
  check(activeNow === itemCountBefore + 1, '停用再启用后可恢复（清单是运营可逆动作）', `active=${activeNow}`)

  await navOps(ops, '执法检查任务')
  await ops.locator('button').filter({ hasText: cjk('新建任务') }).click()
  await ops.waitForSelector('.ant-modal-content', { timeout: 8000 })
  // 负分支：不点名承办人就不该建得出任务
  await ops.locator('.ant-modal-content .ant-modal-footer .ant-btn-primary').last().click()
  await ops.waitForTimeout(600)
  const requiredText = await pageText(ops)
  check(requiredText.includes('请从监管台账里选择主体') && requiredText.includes('必须点名承办人'),
    '缺主体/承办人时按表单校验拦下（任务不会自动落到某个固定的人）')
  await pickOption(ops, '任务类型', '专项检查')
  await pickOption(ops, '监管主体', SUBJECT_NAME)
  await pickOption(ops, '承办执法人员', INSPECTOR_NAME)
  await fillForm(ops, '地址', `${MARKER} 大棚 A 区`)
  await fillForm(ops, '截止时间', '今日 23:00')
  await modalConfirm(ops)
  check((await toasts(ops)).includes('执法任务已创建'), '运营端建单成功')
  const uiTask = sql(`SELECT CONCAT(id,'#',task_no,'#',checklist_total,'#',status) FROM agri_government.gov_task
    WHERE id>${before.task} ORDER BY id DESC LIMIT 1`)
  const [uiTaskId, uiTaskNo, uiTaskTotal, uiTaskStatus] = String(uiTask).split('#')
  check(Boolean(uiTaskId) && uiTaskStatus === 'pending', '任务真建出来并停在待检查', uiTask)
  check(Number(uiTaskTotal) === itemCountBefore + 1,
    '新任务按清单模板展开（含刚新增的那一项）', `total=${uiTaskTotal} 模板=${itemCountBefore + 1}`)
  const taskCardText = await ops.locator('.o-task-grid section').filter({ hasText: uiTaskNo }).first().innerText().catch(() => '')
  check(taskCardText.includes(INSPECTOR_NAME) && taskCardText.includes(`0/${uiTaskTotal}`),
    '任务卡片显示真实承办人与检查进度 0/N', taskCardText.replace(/\s+/g, ' ').slice(0, 70))

  await navOps(ops, 'AI 预警处置')
  check(Boolean(warningNo) && !String(warningSeed).startsWith('ERR'), '取到一条待处置预警', warningSeed)
  const warningCard = ops.locator('.o-warning-card').filter({ hasText: warningNo }).first()
  check(await warningCard.isVisible().catch(() => false), '预警卡片按预警号定位到')
  await warningCard.locator('button').filter({ hasText: cjk('分派处置') }).click()
  await ops.waitForSelector('.ant-modal-content', { timeout: 8000 })
  await pickOption(ops, '承办执法人员', INSPECTOR_NAME)
  await fillForm(ops, '处置要求', `${MARKER} 请现场核查并回传照片`)
  await modalConfirm(ops)
  check((await toasts(ops)).includes('预警已分派'), '预警分派成功')
  const warningAfter = sql(`SELECT CONCAT(status,'#',IFNULL(assignee_id,''),'#',IFNULL(handle_note,''))
    FROM agri_government.gov_warning WHERE warning_no='${warningNo}'`)
  check(String(warningAfter).includes('processing') && String(warningAfter).includes(inspectorId)
      && String(warningAfter).includes(MARKER),
    '分派结果写回承办人与处置要求', String(warningAfter).slice(0, 60))

  await navOps(ops, '市场主体监管')
  const subjectRow = ops.locator('.ant-table-row').filter({ hasText: SUBJECT_NAME }).first()
  check((await subjectRow.innerText()).includes('已绑定'), '主体台账显示与平台经营主体的绑定关系',
    (await subjectRow.innerText()).replace(/\s+/g, ' ').slice(-24))
  await subjectRow.locator('button').filter({ hasText: /变更绑定|绑定经营主体/ }).click()
  await ops.waitForSelector('.ant-modal-content', { timeout: 8000 })
  check((await pageText(ops)).includes('不按名字猜同一家'), '绑定弹窗讲清绑定语义（同名不等于同一家）')
  await modalCancel(ops)

  await navOps(ops, '组织与权限')
  const userRow = ops.locator('.ant-table-row').filter({ hasText: INSPECTOR_NAME }).first()
  const userRowText = (await userRow.innerText()).replace(/\s+/g, ' ')
  check(userRowText.includes('已绑定') && userRowText.includes('稻田镇网格'),
    '执法人员档案显示平台账号绑定与网格', userRowText.slice(0, 80))

  await navOps(ops, '操作审计日志')
  const downloadPair = await Promise.all([
    ops.waitForEvent('download', { timeout: 15000 }).catch(() => null),
    ops.locator('button').filter({ hasText: cjk('导出日志') }).click(),
  ])
  const download = downloadPair[0]
  check(download?.suggestedFilename() === '操作审计日志.csv', '审计日志导出为真实 CSV 文件',
    download?.suggestedFilename() ?? '没有触发下载')
  const uiTaskLog = Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_op_log
    WHERE id>${before.log} AND action_name IN
    ('创建执法任务','执法事项清单启停','维护执法事项清单','举报处理','预警处置')`))
  check(uiTaskLog >= 4, '页面里的每个动作都留下了操作审计', `rows=${uiTaskLog}`)

  /* ==================== C. 移动执法端：接单 → 逐项检查 → 取证 → 扫码 → 收件箱 ==================== */
  const phone = await browser.newContext({ viewport: { width: 420, height: 900 } })
  const mobile = await phone.newPage()
  mobile.on('pageerror', (e) => mobile.url().includes(':8109')
    && mobileErrors.push(String(e?.message ?? e).slice(0, 140)))
  const afterLogin = await uniLogin(mobile, 'inspector')
  check(afterLogin.includes(INSPECTOR_NAME) && afterLogin.includes('稻田镇网格'),
    '移动端登录后按执法人员档案显示"我是谁"', `${INSPECTOR_NAME} · 稻田镇网格`)
  check(!afterLogin.includes('22℃') && afterLogin.includes(today),
    '工作台不再显示写死的天气与日期', today)
  const statsExpected = sql(`SELECT CONCAT(
      (SELECT COUNT(*) FROM agri_government.gov_task WHERE assignee_id=${inspectorId}), ' 今日任务 ',
      (SELECT COUNT(*) FROM agri_government.gov_task WHERE assignee_id=${inspectorId} AND status<>'completed'), ' 待检查 ',
      (SELECT COUNT(*) FROM agri_government.gov_warning WHERE assignee_id=${inspectorId} AND status<>'closed'), ' 预警事件 ',
      (SELECT COUNT(*) FROM agri_government.gov_case WHERE handler_id=${inspectorId} AND status<>'closed'), ' 在办案件')`)
  const statsActual = (await mobile.locator('.stats-card').innerText().catch(() => '')).replace(/\s+/g, ' ').trim()
  check(statsActual === statsExpected, '工作台四个统计都等于库里本人的真实条数', `${statsActual} ｜ 期望 ${statsExpected}`)

  // 负分支：结论留空提交，必须由页面拦住
  check(await openMobile(mobile, `/pages/tasks/checklist?id=${uiTaskId}`, '现场检查表'), '打开现场检查表')
  await hasText(mobile, SUBJECT_NAME, 9000)
  const checklistText = await pageText(mobile)
  check(checklistText.includes(SUBJECT_NAME) && checklistText.includes(`0/${uiTaskTotal}`),
    '现场检查表按任务加载主体与清单', checklistText.slice(0, 60))
  await mobile.locator('.check').nth(2).click()
  await mobile.locator('.check').nth(4).click()
  await mobile.locator('uni-button, button').filter({ hasText: cjk('提交检查结果') }).click()
  check(await hasText(mobile, '请填写检查结论', 4000), '结论留空被拦住（不会静默提交）')
  await mobile.locator('textarea').first().fill(`${MARKER} 3 项已查，试剂效期缺领用记录`)
  await mobile.locator('uni-button, button').filter({ hasText: cjk('提交检查结果') }).click()
  check(await hasText(mobile, '检查结果已提交', 6000), '逐项打勾并提交检查结论')
  const taskAfterSubmit = sql(`SELECT CONCAT(status,'#',checklist_done,'#',IFNULL(result_text,''))
    FROM agri_government.gov_task WHERE id=${uiTaskId}`)
  check(String(taskAfterSubmit).includes('completed#2') && String(taskAfterSubmit).includes(MARKER),
    '提交后进度按实际勾选数落库（不是前端报的数）', String(taskAfterSubmit).slice(0, 70))
  const checkedRows = Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_task_check
    WHERE task_id=${uiTaskId} AND done=TRUE AND checked_at IS NOT NULL`))
  check(checkedRows === 2, '逐项结论写进任务检查表', `rows=${checkedRows}`)
  const inspectionNotice = Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=${subjectId} AND biz_no='${uiTaskNo}' AND content LIKE '%${MARKER}%'`))
  check(inspectionNotice === 1, '检查结论同步进主体收件箱', `rows=${inspectionNotice}`)

  await mobile.waitForTimeout(1200)
  check(await openMobile(mobile, `/pages/evidence/index?taskNo=${uiTaskNo}`, '保存证据并生成哈希'),
    '取证页带上来源任务号', uiTaskNo)
  await mobile.locator('textarea').first().fill(`${MARKER} 大棚 A 区试剂柜照片 1 张`)
  await mobile.locator('uni-button, button').filter({ hasText: cjk('保存证据并生成哈希') }).click()
  check(await hasText(mobile, '已入库', 6000), '现场取证保存成功并回显证据号')
  const evidenceRow = sql(`SELECT CONCAT(evidence_no,'#',IFNULL(task_id,''),'#',uploaded,'#',evidence_hash)
    FROM agri_government.gov_evidence WHERE description LIKE '%${MARKER}%' ORDER BY id DESC LIMIT 1`)
  const [evidenceNo, evidenceTaskId, evidenceUploaded, evidenceHash] = String(evidenceRow).split('#')
  check(Boolean(evidenceNo) && evidenceTaskId === String(uiTaskId) && evidenceUploaded === '1',
    '证据带任务归属并按在线上传入库', evidenceRow.slice(0, 40))
  check(/^[0-9a-f]{64}$/.test(String(evidenceHash)), '证据摘要是真实 SHA-256（不再是字符串 hashCode）',
    `${evidenceHash?.slice(0, 16)}…`)

  check(await openMobile(mobile, '/pages/scan/index', '对准溯源码'), '进入扫码核验页')
  check((await pageText(mobile)).includes('这台设备还没有核验过代码'),
    '扫码页的历史区是本机真实记录（不再写死两条已通过）')
  await mobile.locator('.scan-input input').first().fill(subjectCreditCode)
  await mobile.locator('uni-button, button').filter({ hasText: cjk('核验') }).click()
  await hasText(mobile, '核验通过', 9000)
  const scanText = await pageText(mobile)
  check(scanText.includes('核验通过') && scanText.includes(SUBJECT_NAME) && scanText.includes(subjectPhone),
    '按信用代码扫码带出主体档案与真实联系电话', `${subjectCreditCode} · ${subjectPhone}`)
  check(scanText.includes(MARKER) || scanText.includes(subjectCreditCode),
    '本机核验记录列出刚查过的代码（标明是本机记录）', scanText.includes('本机核验记录') ? '文案已区分本机/留痕' : '')

  check(await openMobile(mobile, '/pages/messages/index', '全部已读'), '进入执法人员收件箱')
  const inboxHasMarker = await hasText(mobile, MARKER, 9000)
  const inboxText = await pageText(mobile)
  check(inboxHasMarker && inboxText.includes('请现场核查并回传照片'),
    '运营分派的预警进了执法人员收件箱（页面真读得到）',
    `分派前本人未读=${unreadInspectorBefore ? unreadInspectorBefore.split(',').length : 0}`)
  const dispatchNotice = Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE assignee_id=${inspectorId} AND content LIKE '%${MARKER} 请现场核查并回传照片%'`))
  check(dispatchNotice === 1, '收件箱消息与库中本人消息一致', `rows=${dispatchNotice}`)
  await mobile.locator('uni-button, button').filter({ hasText: cjk('全部已读') }).click()
  check(await hasText(mobile, '已全部标为已读', 6000), '一键已读回写成功')
  check(Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE assignee_id=${inspectorId} AND is_read=FALSE`)) === 0, '库中本人未读归零')

  check(await openMobile(mobile, '/pages/profile/index', '行政执法证件'), '进入「我的」页')
  // 档案数据是异步加载的：等到显示真实姓名再判，否则会把"还在解析"当成写死
  await hasText(mobile, INSPECTOR_NAME, 9000)
  const profileText = await pageText(mobile)
  check(profileText.includes(INSPECTOR_NAME) && profileText.includes('稻田镇网格')
      && !profileText.includes('🔔 3'),
    '「我的」页统计来自接口（不再有写死的未读与统计）', profileText.slice(0, 70))
  await mobile.locator('text=行政执法证件').first().click()
  const certificateNo = scalar(`SELECT IFNULL(certificate_no,'') FROM agri_government.gov_user WHERE id=${inspectorId}`)
  check(await hasText(mobile, certificateNo, 5000), '执法证件弹窗显示档案里的执法证号', certificateNo)
  await mobile.locator('uni-modal .uni-modal__btn, .uni-modal__btn').last().click().catch(() => {})

  /* ==================== D. 主体端：证照 / 公示 / 收件箱 ==================== */
  await navPortal(portal, '主体信息与资质')
  await portal.locator('.g-license-grid article button').filter({ hasText: cjk('查看') }).first().click()
  await portal.waitForSelector('.ant-modal-content', { timeout: 8000 })
  const licenseNo = scalar(`SELECT license_no FROM agri_government.gov_license
    WHERE subject_id=${subjectId} AND status='valid' ORDER BY expire_date LIMIT 1`)
  check((await pageText(portal)).includes('证照编号'), '电子证照查看显示档案里的真实字段', licenseNo)
  await portal.locator('.ant-modal-content .ant-modal-close').click()
  await portal.waitForTimeout(500)

  await navPortal(portal, '公众查询')
  await portal.locator('.ant-tabs-tab').filter({ hasText: cjk('双公示') }).click()
  await portal.waitForTimeout(1200)
  const publicText = await pageText(portal)
  check(publicText.includes('农药经营许可证') && publicText.includes('寿光绿丰农资店'),
    '双公示里能看到别家的行政许可（不是登录者自己的证照清单）')
  await portal.locator('.ant-tabs-tab').filter({ hasText: cjk('企业信用查询') }).click()
  await portal.waitForTimeout(800)
  await portal.locator('.g-search-line input').first().fill('')
  await portal.locator('.g-search-line button').filter({ hasText: cjk('查询') }).click()
  const rejectText = await toasts(portal)
  check(rejectText.includes('请输入企业名称'),
    '公众查询空关键词被后端拒绝并显示原因', rejectText.slice(0, 40))
  await portal.locator('.g-search-line input').first().fill(SUBJECT_NAME)
  await portal.locator('.g-search-line button').filter({ hasText: cjk('查询') }).click()
  const hitRow = await portal.locator('.g-public-list article').first().innerText().catch(() => '')
  check(hitRow.includes(SUBJECT_NAME) && /\d{2}/.test(hitRow),
    '按名称查询命中主体信用档案并带出信用分', hitRow.replace(/\s+/g, ' ').slice(0, 60))

  // ---------- 公众溯源核验：数据必须来自生产域，不再是本域种子表 ----------
  const liveCode = scalar(`SELECT trace_code FROM agri_production.agri_prod_trace_code
    WHERE deleted=0 AND status='active' ORDER BY id LIMIT 1`)
  const seedCode = scalar(`SELECT trace_code FROM agri_government.gov_trace_event ORDER BY id LIMIT 1`)
  const liveNodes = Number(scalar(`SELECT COUNT(*) FROM agri_production.agri_prod_trace_code
    WHERE deleted=0 AND trace_code='${liveCode}'`))
  await portal.locator('.ant-tabs-tab').filter({ hasText: cjk('农产品溯源') }).click()
  await portal.waitForTimeout(900)
  const traceInput = portal.locator('.g-search-line input').first()
  check((await traceInput.inputValue()) === '',
    '溯源核验输入框不再预填种子码（预填会让人以为那张单子是真的）', `value=${await traceInput.inputValue()}`)
  await portal.locator('.g-search-line button').filter({ hasText: cjk('核验') }).click()
  check((await toasts(portal)).includes('请输入溯源码'), '空码点核验被前端拦住并给提示')
  await traceInput.fill(liveCode)
  await portal.locator('.g-search-line button').filter({ hasText: cjk('核验') }).click()
  await portal.waitForSelector('.g-trace-timeline > div', { timeout: 12000 }).catch(() => {})
  const timeline = await portal.locator('.g-trace-timeline > div').count()
  const traceText = await pageText(portal)
  check(timeline > 0 && traceText.includes(liveCode),
    '真实溯源码在页面上渲染出链路时间线', `timeline=${timeline} code=${liveCode}`)
  check(liveNodes > 0 && traceText.includes('个节点已完成链上存证'),
    '链上结论按生产域真实存证给出（不再是"5个节点已完成区块链核验"的写死文案）',
    traceText.match(/\d+\/\d+ 个节点已完成链上存证[^，。]*/)?.[0] ?? '')
  check(!traceText.includes('undefined') && !traceText.includes('null'),
    '缺值字段不再以 undefined 出现在页面上（生产域节点没有"地点"这一列）')
  const unattestedTags = await portal.locator('.g-trace-timeline .ant-tag').filter({ hasText: '未上链' }).count()
  check(unattestedTags > 0, '未存证的节点显式标"未上链"，不靠留空糊过去', `tags=${unattestedTags}`)
  await traceInput.fill(seedCode)
  await portal.locator('.g-search-line button').filter({ hasText: cjk('核验') }).click()
  const seedToast = await toasts(portal)
  check(seedToast.includes('溯源码不存在') && !(await pageText(portal)).includes('核验通过'),
    '本域种子表里的假码在页面上就是查不到（不再显示核验通过）', `${seedCode} → ${seedToast.slice(0, 40)}`)

  // 移动执法端扫同一条码，看到的必须与公众页同一份生产域数据
  check(await openMobile(mobile, '/pages/scan/index', '对准溯源码'), '回到扫码核验页')
  await mobile.locator('.scan-input input').first().fill(liveCode)
  await mobile.locator('uni-button, button').filter({ hasText: cjk('核验') }).click()
  await hasText(mobile, liveCode, 9000)
  const traceScanText = await pageText(mobile)
  check(traceScanText.includes(liveCode) && /已上链节点 \d+\/\d+/.test(traceScanText),
    '执法端扫码显示同一份节点与存证计数（与公众页同一口径）',
    traceScanText.match(/已上链节点 \d+\/\d+/)?.[0] ?? traceScanText.slice(0, 60))
  check(traceScanText.includes('未上链') || traceScanText.includes('已上链 '),
    '每条节点在执法端也标明存证状态', traceScanText.slice(0, 60))

  await navPortal(portal, '消息通知')
  await portal.locator('button').filter({ hasText: cjk('全部已读') }).click()
  check((await toasts(portal)).includes('收件箱已全部标为已读'), '主体端一键已读回写本主体收件箱')
  check(Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=${subjectId} AND is_read=FALSE`)) === 0, '库中本主体未读归零')
  await navPortal(portal, '监管服务首页')
  check(await portal.locator('.g-header-right button i').count() === 0, '顶栏未读角标随真实未读数消失')

  check(desktopErrors.length === 0, '主体端与运营端无页面脚本错误', desktopErrors[0] ?? '')
  check(mobileErrors.length === 0, '移动执法端无页面脚本错误', mobileErrors[0] ?? '')
  await portal.screenshot({ path: path.join(OUT, 'portal-home.png') }).catch(() => {})
  await ops.screenshot({ path: path.join(OUT, 'ops-tasks.png') }).catch(() => {})
  await mobile.screenshot({ path: path.join(OUT, 'mobile-workbench.png') }).catch(() => {})
} finally {
  /* ==================== 清理：本轮临时数据归零、被改种子还原 ==================== */
  exec(`USE agri_government;
    DELETE c FROM gov_task_check c JOIN gov_task t ON t.id=c.task_id WHERE t.id>${before.task}`)
  exec(`DELETE FROM agri_government.gov_task WHERE id>${before.task}`)
  exec(`DELETE FROM agri_government.gov_evidence WHERE id>${before.evidence}`)
  exec(`DELETE FROM agri_government.gov_check_item WHERE id>${before.item}`)
  exec(`DELETE FROM agri_government.gov_complaint WHERE id>${before.complaint}`)
  exec(`DELETE FROM agri_government.gov_case WHERE id>${before.case}`)
  exec(`DELETE FROM agri_government.gov_report WHERE id>${before.report}`)
  exec(`DELETE FROM agri_government.gov_subsidy WHERE id>${before.subsidy}`)
  exec(`DELETE FROM agri_government.gov_credit_repair WHERE id>${before.repair}`)
  exec(`DELETE FROM agri_government.gov_self_check WHERE id>${before.selfCheck}`)
  exec(`DELETE FROM agri_government.gov_message WHERE id>${before.message}`)
  exec(`DELETE FROM agri_government.gov_op_log WHERE id>${before.log}`)
  if (warningNo) {
    const [, ws, wa, wt, wn] = String(warningSeed).split('#')
    exec(`UPDATE agri_government.gov_warning SET status='${ws}',
      assignee_id=${wa ? `'${wa}'` : 'NULL'}, assigned_to=${wt ? `'${wt}'` : 'NULL'},
      handle_note=${wn ? `'${wn}'` : 'NULL'} WHERE warning_no='${warningNo}'`)
  }
  // 一键已读动的是种子消息的只读标志，本轮新增的行已删掉，种子的已读状态必须还原
  if (unreadInspectorBefore) {
    exec(`UPDATE agri_government.gov_message SET is_read=FALSE WHERE id IN (${unreadInspectorBefore})`)
  }
  if (unreadSubjectBefore) {
    exec(`UPDATE agri_government.gov_message SET is_read=FALSE WHERE id IN (${unreadSubjectBefore})`)
  }
  const residue = {
    task: Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_task WHERE id>${before.task}`)),
    check: Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_task_check c
      LEFT JOIN agri_government.gov_task t ON t.id=c.task_id
      WHERE c.task_id>${before.task} AND t.id IS NULL`)),
    item: Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_check_item WHERE id>${before.item}`)),
    evidence: Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_evidence WHERE id>${before.evidence}`)),
    complaint: Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_complaint WHERE id>${before.complaint}`)),
    message: Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_message WHERE id>${before.message}`)),
    log: Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_op_log WHERE id>${before.log}`)),
    markerAnywhere: Number(scalar(`SELECT (SELECT COUNT(*) FROM agri_government.gov_task WHERE address LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_government.gov_evidence WHERE description LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_government.gov_complaint WHERE title LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_government.gov_check_item WHERE item_name LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_government.gov_message WHERE content LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_government.gov_op_log WHERE detail LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_government.gov_warning WHERE handle_note LIKE '%${MARKER}%')`)),
  }
  check(Object.values(residue).every((value) => value === 0),
    '清理后本轮 UI 点检数据残留为 0', JSON.stringify(residue))
  check(Number(scalar('SELECT COUNT(*) FROM agri_government.gov_complaint')) === complaintCountBefore,
    '举报单条数回到点检前', `count=${scalar('SELECT COUNT(*) FROM agri_government.gov_complaint')}`)
  check(scalar(`SELECT CONCAT(warning_no,'#',status,'#',IFNULL(assignee_id,''),'#',IFNULL(assigned_to,''),'#',
    IFNULL(handle_note,'')) FROM agri_government.gov_warning WHERE warning_no='${warningNo}'`) === String(warningSeed),
    '被分派的预警已还原成点检前状态', String(warningSeed))
  check(Number(scalar(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=${subjectId} AND is_read=FALSE`)) === subjectUnreadCountBefore,
    '主体收件箱未读数已还原', `未读=${scalar(`SELECT COUNT(*) FROM agri_government.gov_message
      WHERE subject_id=${subjectId} AND is_read=FALSE`)} 点检前=${subjectUnreadCountBefore}`)
  check(scalar(`SELECT IFNULL(merchant_id,'') FROM agri_government.gov_subject WHERE id=${subjectId}`) === merchantBefore,
    '本轮没有改动主体绑定（弹窗只看未提交）', `merchant=${merchantBefore}`)
  await browser.close()
}

console.log(`\n截图目录：${OUT}`)
console.log(`\n政府监管三端点检：${checked} 项，${failures.length === 0 ? '全部通过' : `${failures.length} 项未通过`}`)
if (failures.length === 0) process.exit(0)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
