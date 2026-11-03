/**
 * 政府监管主链路端到端联调（主体端 + 移动执法端 + 监管运营端 + 数据库落库）
 *
 * 链路：
 *   令牌解析身份（监管主体档案 / 执法人员档案） → 三端越权与数据范围回归
 *   → 数据报送（校验分真算、不编链上哈希） → AI 合规自查（维度由真实记录算）
 *   → 信用修复申请 → 运营复核 → 主体收到结论
 *   → 运营建执法任务（点名承办人）→ 执法人员逐项打勾 → 现场取证落库 → 主体收到检查结论
 *   → 预警分派 → 立案 → 案件阶段推进 → 整改反馈 → 整改复核结案
 *   → 补贴申报（政策状态与申报期闸门）→ 项目复核
 *   → 执法事项清单启停 → 公众查询与溯源核验 → 清理与残留归零
 *
 * 用法：node scripts/e2e-government-flow.mjs
 *   前置：core-platform :8093、agri-government :8095、MySQL 3306 在跑，
 *        且已执行 node scripts/provision-gov-access.mjs（执法账号 + 两条绑定关系）。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const CORE = 'http://localhost:8093'
const GOV = 'http://localhost:8095'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const PASSWORD = 'Admin@123'
const MARKER = 'E2E监管闭环'
const SUBJECT_NAME = '绿源蔬菜专业合作社'
const OTHER_SUBJECT_NAME = '寿光绿丰农资店'
// 王磊（稻田镇网格执法人员，已绑定 inspector 账号）与赵宁（另一网格，用于越权对照）
const INSPECTOR_USER = process.env.GOV_INSPECTOR_USERNAME || 'inspector'
// 临时把第二家档案绑到 luochuan 的经营主体上，用来验"换账号看到的是另一家"；finally 还原
const OTHER_MERCHANT = 2003

const sql = (query) => {
  if (!existsSync(MYSQL)) return ''
  const result = spawnSync(MYSQL,
    ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query], { encoding: 'utf8' })
  if (result.status !== 0) return `ERR:${String(result.stderr ?? '').trim().slice(0, 200)}`
  return String(result.stdout ?? '').trim()
}

/** 清理里的每条 SQL 都要能看见失败，否则"残留为 0"会被误判成业务问题。 */
const exec = (query) => {
  const result = sql(query)
  if (String(result).startsWith('ERR')) {
    console.log(`  ! SQL 失败：${result}　← ${query.replace(/\s+/g, ' ').slice(0, 110)}`)
  }
  return result
}

const failures = []
let checked = 0
const check = (ok, label, extra = '') => {
  checked += 1
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const login = async (username) => {
  const response = await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, marketId: 1 }),
  })
  const body = await response.json().catch(() => null)
  return body?.data?.accessToken ?? ''
}

/** 监管接口有两种失败：HTTP 4xx（RBAC 与身份解析）与 HTTP 200 + code!=200（业务判定）。 */
const api = async (token, method, path, body) => {
  const response = await fetch(`${GOV}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { code: -1, message: text.slice(0, 120), data: null }
  }
  return { status: response.status, code: parsed?.code ?? -1, message: parsed?.message ?? '', data: parsed?.data }
}

const ids = {
  report: '', reportNo: '', reportShort: '', selfCheck: '', repair: '', repairNo: '',
  task: '', taskNo: '', evidence: '', evidenceNo: '', case: '', caseNo: '',
  rectification: '', subsidy: '', subsidyNo: '', checkItem: '',
  subjectOther: '', warningUsed: null,
}
let policyBefore = ''
let otherBindingBefore = ''

/** 上一轮中断留下的带标记数据先清干净，判据才只反映本轮行为。 */
function purgePreviousRuns() {
  exec(`USE agri_government;
    DELETE c FROM agri_government.gov_task_check c
      JOIN agri_government.gov_task t ON t.id = c.task_id WHERE t.task_type LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_task WHERE task_type LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_evidence WHERE description LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_case WHERE summary LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_report WHERE title LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_credit_repair WHERE reason LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_subsidy WHERE project_name LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_self_check WHERE result_text LIKE '%${MARKER}%'`)
  // 自查记录没有标记字段；种子行的时间戳都是 10 月，今天写入的只可能是用例产物
  exec(`DELETE FROM agri_government.gov_self_check WHERE checked_at >= CURDATE()`)
  exec(`DELETE FROM agri_government.gov_check_item WHERE item_name LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_message WHERE content LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_op_log WHERE detail LIKE '%${MARKER}%'`)
}

async function main() {
  const admin = await login('admin')
  const inspector = await login(INSPECTOR_USER)
  const outsider = await login('luochuan')
  check(Boolean(admin && inspector && outsider), '三个测试账号登录成功（admin / inspector / luochuan）')

  purgePreviousRuns()

  // ---------- 1. 身份由令牌解析 ----------
  const adminIdentity = await api(admin, 'GET', '/api/v1/government/identity')
  check(adminIdentity.code === 200 && adminIdentity.data?.subjectName === SUBJECT_NAME,
    '运营账号按令牌解析到监管主体档案', `${adminIdentity.data?.subjectId} ${adminIdentity.data?.subjectName}`)
  check(adminIdentity.data?.roles?.admin === true && adminIdentity.data?.roles?.citizen === true,
    '运营账号同时具备监管运营与主体办事权限')

  const inspectorIdentity = await api(inspector, 'GET', '/api/v1/government/identity')
  check(inspectorIdentity.code === 200 && inspectorIdentity.data?.inspectorName === '王磊'
    && String(inspectorIdentity.data?.certificateNo ?? '') === '15060220240118',
    '执法账号解析成档案里的人（含执法证号）',
    `${inspectorIdentity.data?.inspectorName} / ${inspectorIdentity.data?.inspectorGrid}`)
  check(inspectorIdentity.data?.roles?.inspector === true && inspectorIdentity.data?.roles?.admin === false,
    '执法账号没有运营端权限位')

  const anonymous = await fetch(`${GOV}/api/v1/government/home`)
  check(anonymous.status === 401, '未带令牌访问主体首页返回 401', String(anonymous.status))

  const farmer = await login('farmer')
  const inspectorCitizen = await api(inspector, 'GET', '/api/v1/government/home')
  check(inspectorCitizen.status === 403, '执法账号不能以主体身份办事项', inspectorCitizen.message)
  const inspectorOps = await api(inspector, 'GET', '/api/v1/government/ops/subjects')
  check(inspectorOps.status === 403, '执法账号打不开监管运营端', inspectorOps.message)
  const outsiderHome = await api(outsider, 'GET', '/api/v1/government/home')
  check(outsiderHome.status === 403 && /绑定/.test(outsiderHome.message),
    '监管档案未登记该主体时被拒绝且原因可操作', outsiderHome.message)

  // 临时把第二家档案绑给 luochuan 的主体，用来验"换账号看到的是另一家而不是第一家"
  const outsiderSubjects = await api(admin, 'GET', '/api/v1/government/ops/subjects?keyword='
    + encodeURIComponent(OTHER_SUBJECT_NAME))
  ids.subjectOther = (outsiderSubjects.data ?? [])[0]?.id ?? ''
  otherBindingBefore = sql(`SELECT IFNULL(merchant_id,'') FROM agri_government.gov_subject WHERE id=${ids.subjectOther}`)
  const tempBind = await api(admin, 'PUT', `/api/v1/government/ops/subjects/${ids.subjectOther}/merchant-binding`,
    { merchantId: String(OTHER_MERCHANT) })
  check(tempBind.code === 200 && String(tempBind.data?.merchantId ?? '') === String(OTHER_MERCHANT),
    '临时绑定第二家监管档案（用于跨主体对照）', `id=${ids.subjectOther}`)

  // ---------- 2. 数据范围：主体端只看到自己 ----------
  const home = await api(admin, 'GET', '/api/v1/government/home')
  check(home.code === 200 && home.data?.stats?.creditScore > 0 && (home.data?.todos ?? []).length > 0,
    '主体首页读到自己的档案与真实待办', `待办 ${(home.data?.todos ?? []).length} 条`)
  check(!(home.data?.todos ?? []).some((item) => item.title === '信用修复审核中'
      && item.content === '整改完成修复申请已通过 AI 预审'),
    '待办不再是代码里写死的四条文案')

  const licenses = await api(admin, 'GET', '/api/v1/government/licenses')
  check((licenses.data ?? []).length === 4, '证照列表只含本主体的 4 本', `rows=${(licenses.data ?? []).length}`)
  const penalties = await api(admin, 'GET', '/api/v1/government/penalties')
  check((penalties.data ?? []).length === 1
    && (penalties.data ?? []).every((item) => item.subjectName === SUBJECT_NAME),
    '处罚列表不含别家的记录（原来 subject_id=1 会把别家也混进来）',
    `rows=${(penalties.data ?? []).length}`)
  const subsidies = await api(admin, 'GET', '/api/v1/government/subsidies')
  check((subsidies.data ?? []).every((item) => String(item.subjectName ?? '') !== '绿野有机农场有限公司'),
    '补贴列表不含第三家的项目', `rows=${(subsidies.data ?? []).length}`)

  const otherHome = await api(outsider, 'GET', '/api/v1/government/home')
  check(otherHome.code === 200 && otherHome.data?.subject?.subjectName === OTHER_SUBJECT_NAME,
    '换成 2003 登录后看到的是另一家档案', otherHome.data?.subject?.subjectName)
  const otherLicenses = await api(outsider, 'GET', '/api/v1/government/licenses')
  const otherLicenseCount = Number(sql(`SELECT COUNT(*) FROM agri_government.gov_license WHERE subject_id=
    (SELECT id FROM agri_government.gov_subject WHERE subject_name='${OTHER_SUBJECT_NAME}')`))
  check((otherLicenses.data ?? []).length === otherLicenseCount && otherLicenseCount > 0,
    '另一家读到的是它自己的证照、条数与库一致（跨主体隔离）',
    `接口=${(otherLicenses.data ?? []).length} 库=${otherLicenseCount}`)
  check(!(otherLicenses.data ?? []).some((item) => /食品生产许可证|排污登记回执/.test(String(item.licenseName))),
    '绿源的证照不会串到另一家', (otherLicenses.data ?? []).map((item) => item.licenseName).join('、'))
  const otherPenalties = await api(outsider, 'GET', '/api/v1/government/penalties')
  check((otherPenalties.data ?? []).every((item) => item.subjectName === OTHER_SUBJECT_NAME),
    '另一家只看到自己的处罚记录', `rows=${(otherPenalties.data ?? []).length}`)

  // ---------- 3. 数据报送：主体号来自令牌，校验分真算 ----------
  const report = await api(admin, 'POST', '/api/v1/government/reports', {
    // 故意带上别人的主体号：主体一律以令牌为准，这条是"参数能改写归属"的回归
    subjectId: 9999, reportType: '农事生产记录', title: `${MARKER} 10月生产记录报送`,
    description: `${MARKER} 本月完成定植、灌溉与植保记录归档，附件已上传至监管档案。`,
    period: '2026-10',
  })
  ids.report = report.data?.id ?? ''
  ids.reportNo = report.data?.reportNo ?? ''
  check(report.code === 200 && Boolean(ids.report), '数据报送提交成功', report.message)
  check(sql(`SELECT subject_id FROM agri_government.gov_report WHERE id=${ids.report}`) === '1',
    '报送落库的主体号来自令牌（忽略请求里的 9999）')
  check(sql(`SELECT chain_hash IS NULL FROM agri_government.gov_report WHERE id=${ids.report}`) === '1',
    '没有真的上链动作就不写链上哈希（不再编 0x…）')
  const shortReport = await api(admin, 'POST', '/api/v1/government/reports', {
    reportType: '其他数据', title: `${MARKER} 简略报送`, description: '略', period: '2026-10',
  })
  ids.reportShort = shortReport.data?.id ?? ''
  const fullScore = Number(sql(`SELECT ai_score FROM agri_government.gov_report WHERE id=${ids.report}`))
  const shortScore = Number(sql(`SELECT ai_score FROM agri_government.gov_report WHERE id=${ids.reportShort}`))
  check(fullScore > shortScore && fullScore <= 100,
    'AI 校验分由内容完整度现算（详实报送得分更高）', `${fullScore} vs ${shortScore}`)
  const badReport = await api(admin, 'POST', '/api/v1/government/reports', { title: '' })
  check(badReport.code === 400, '缺标题与说明的报送被拒', badReport.message)
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=1 AND biz_no='${ids.reportNo}'`)) >= 1, '报送受理写入主体收件箱')

  // ---------- 4. AI 合规自查：维度由真实记录计算 ----------
  const runCheck = await api(admin, 'POST', '/api/v1/government/self-check', {})
  check(runCheck.code === 200, 'AI 合规自查执行成功', runCheck.message)
  const selfCheck = await api(admin, 'GET', '/api/v1/government/self-check')
  const dimensions = selfCheck.data?.dimensions ?? []
  check(dimensions.length === 5 && dimensions.every((item) => typeof item.score === 'number'),
    '自查维度返回 5 项且带真实得分', dimensions.map((item) => item.score).join('/'))
  check(JSON.stringify(dimensions).includes('本证照中') && JSON.stringify(dimensions).includes('报送'),
    '维度明细写的是算给它看的数字', dimensions[0]?.detail ?? '')
  check(!JSON.stringify(dimensions).includes('2项记录附件待补'),
    '维度明细不再是写死的文案')
  ids.selfCheck = sql(`SELECT id FROM agri_government.gov_self_check WHERE subject_id=1 ORDER BY id DESC LIMIT 1`)
  const riskFromDb = Number(sql(`SELECT risk_count FROM agri_government.gov_self_check WHERE id=${ids.selfCheck}`))
  const riskComputed = dimensions.filter((item) => item.score < 85).length
  check(riskFromDb === riskComputed, '自查风险数与维度得分口径一致', `库=${riskFromDb} 算=${riskComputed}`)
  const otherCheck = await api(outsider, 'GET', '/api/v1/government/self-check')
  const otherQualification = (otherCheck.data?.dimensions ?? []).find((item) => item.name === '主体资质') ?? {}
  const mineQualification = dimensions.find((item) => item.name === '主体资质') ?? {}
  check(String(otherQualification.detail ?? '') !== String(mineQualification.detail ?? '')
      && String(otherQualification.detail ?? '').includes(`${otherLicenseCount} 本证照中`),
    '另一家的自查维度按它自己的档案算（不沿用绿源的数字）',
    `另一家="${otherQualification.detail}" 绿源="${mineQualification.detail}"`)

  // ---------- 5. 信用修复：申请 → 运营复核 → 主体收到结论 ----------
  const repair = await api(admin, 'POST', '/api/v1/government/credit-repairs', {
    repairType: '整改完成修复', reason: `${MARKER} 已补传供应商资质附件并完成整改`,
    attachmentName: '整改材料.pdf',
  })
  ids.repair = repair.data?.id ?? ''
  ids.repairNo = repair.data?.repairNo ?? ''
  check(repair.code === 200 && sql(`SELECT subject_id FROM agri_government.gov_credit_repair WHERE id=${ids.repair}`) === '1',
    '信用修复申请落库到当前主体', ids.repairNo)
  const earlyReview = await api(farmer, 'POST', `/api/v1/government/ops/repairs/${ids.repair}/review`,
    { status: 'approved', note: 'ok' })
  check(earlyReview.status === 403, '纯主体账号（FARMER）没有信用修复复核权限（HTTP 403）', String(earlyReview.status))
  const reviewed = await api(admin, 'POST', `/api/v1/government/ops/repairs/${ids.repair}/review`,
    { status: 'approved', note: `${MARKER} 复核通过` })
  check(reviewed.code === 200
    && sql(`SELECT status FROM agri_government.gov_credit_repair WHERE id=${ids.repair}`) === 'approved',
    '运营复核通过并落库', reviewed.message)
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=1 AND title='信用修复已通过复核'`)) === 1, '复核结论写入主体收件箱')
  const reReview = await api(admin, 'POST', `/api/v1/government/ops/repairs/${ids.repair}/review`,
    { status: 'rejected', note: '再改' })
  check(reReview.code === 409, '已复核完成的修复申请不能重复改判', reReview.message)
  const badReview = await api(admin, 'POST', `/api/v1/government/ops/repairs/${ids.repair}/review`,
    { status: '随便' })
  check(badReview.code === 400, '非法复核结论被拒', badReview.message)
  const opsRepairs = await api(admin, 'GET', '/api/v1/government/ops/repairs')
  const mine = (opsRepairs.data ?? []).find((item) => String(item.id) === String(ids.repair))
  check(mine?.subjectName === SUBJECT_NAME, '运营端修复列表显示真实主体名（不再是常量绿源）', mine?.subjectName)
  const otherRepair = await api(outsider, 'POST', '/api/v1/government/credit-repairs', {
    reason: `${MARKER} 另一家的修复申请`,
  })
  check(otherRepair.code === 200, '第二家也能提交自己的修复申请', otherRepair.data?.repairNo ?? '')
  const opsRepairList = await api(admin, 'GET', '/api/v1/government/ops/repairs')
  check((opsRepairList.data ?? []).some((item) => item.subjectName === OTHER_SUBJECT_NAME),
    '运营端能同时看到两家的修复申请（各自主体名正确）')

  // ---------- 6. 执法任务：运营点名建单 → 执法人员逐项打勾 → 主体收到结论 ----------
  const noAssignee = await api(admin, 'POST', '/api/v1/government/ops/tasks', {
    subjectId: 2, taskType: '日常巡查', address: `${MARKER} 门店`,
  })
  check(noAssignee.code === 400 && /承办/.test(noAssignee.message),
    '运营建单必须点名承办人（不再默认派给写死的"王磊"）', noAssignee.message)
  const ghostAssignee = await api(admin, 'POST', '/api/v1/government/ops/tasks', {
    subjectId: 2, assigneeId: 999999,
  })
  check(ghostAssignee.code === 404, '承办人必须是档案里真实存在的执法人员', ghostAssignee.message)

  const task = await api(admin, 'POST', '/api/v1/government/ops/tasks', {
    subjectId: 2, taskType: `${MARKER} 专项检查`, address: '寿光市稻田镇兴隆路22号',
    deadline: '明日 18:00', priority: 'high', assigneeId: 2,
  })
  ids.task = task.data?.id ?? ''
  ids.taskNo = task.data?.taskNo ?? ''
  check(task.code === 200 && Boolean(ids.task), '运营创建执法任务', ids.taskNo)
  check(sql(`SELECT CONCAT(assignee_id,'#',assigned_to,'#',subject_id) FROM agri_government.gov_task WHERE id=${ids.task}`)
    === '2#王磊#2', '任务的承办人/姓名/主体都按解析结果落库',
    sql(`SELECT CONCAT(assignee_id,'#',assigned_to) FROM agri_government.gov_task WHERE id=${ids.task}`))
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_task_check WHERE task_id=${ids.task}`)) === 8,
    '检查项按执法事项清单展开成 8 条逐项记录')
  check(Number(sql(`SELECT checklist_total FROM agri_government.gov_task WHERE id=${ids.task}`)) === 8,
    '任务总项数来自清单而不是常量')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE assignee_id=2 AND biz_no='${ids.taskNo}'`)) === 1, '分派给王磊的站内信已写入（不是发给"某个固定的人"）')

  const mobileTasks = await api(inspector, 'GET', '/api/v1/government/mobile/tasks')
  check((mobileTasks.data ?? []).some((item) => item.taskNo === ids.taskNo),
    '执法人员移动端看到自己的新任务', `rows=${(mobileTasks.data ?? []).length}`)
  const taskDetail = await api(inspector, 'GET', `/api/v1/government/mobile/tasks/${ids.task}`)
  const checklist = taskDetail.data?.checklist ?? []
  check(checklist.length === 8 && checklist.every((item) => item.done === false),
    '新任务的 8 项都未勾选（原来第一项被写死成"已完成"）',
    `${checklist.filter((item) => item.done).length}/8 已完成`)
  check(taskDetail.data?.subject?.subjectName === OTHER_SUBJECT_NAME, '任务详情带出被检查主体档案')

  const emptyChecks = await api(inspector, 'POST', `/api/v1/government/mobile/tasks/${ids.task}/submit`, { result: 'ok' })
  check(emptyChecks.code === 400, '没有逐项结论不能提交检查结果', emptyChecks.message)
  const missingResult = await api(inspector, 'POST', `/api/v1/government/mobile/tasks/${ids.task}/submit`, {
    checks: [{ itemId: 1, done: true }],
  })
  check(missingResult.code === 400, '缺检查结论不能提交', missingResult.message)
  const submit = await api(inspector, 'POST', `/api/v1/government/mobile/tasks/${ids.task}/submit`, {
    result: `${MARKER} 台账完整，未发现禁用农药`,
    checks: [
      { itemId: 1, done: true, note: '证照均在有效期' },
      { itemId: 2, done: true, note: '抽查 3 个月记录' },
      { itemId: 3, done: false, note: '仓库待整理' },
    ],
  })
  check(submit.code === 200
    && sql(`SELECT CONCAT(status,'#',checklist_done) FROM agri_government.gov_task WHERE id=${ids.task}`) === 'completed#2',
    '逐项结论落库且进度按真实勾选数计算',
    sql(`SELECT CONCAT(status,'#',checklist_done,'#',checklist_total) FROM agri_government.gov_task WHERE id=${ids.task}`))
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_task_check WHERE task_id=${ids.task} AND done=TRUE`)) === 2,
    '已勾项数与库中逐项记录一致')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=2 AND title='现场检查已结束'`)) === 1, '检查结论同步通知被检查主体')
  // 赵宁（档案 3）没有这个任务：换一个执法人员提交必须被拒
  const otherInspectorTask = await api(inspector, 'POST', '/api/v1/government/mobile/tasks/3/submit', {
    result: `${MARKER} 越权提交`, checks: [{ itemId: 1, done: true }],
  })
  check(otherInspectorTask.code === 403, '执法人员不能提交别人名下的任务', otherInspectorTask.message)

  // ---------- 7. 现场取证：真的落一条证据记录 ----------
  const evidence = await api(inspector, 'POST', '/api/v1/government/mobile/evidence', {
    taskNo: ids.taskNo, description: `${MARKER} 门店货架照片与进销存台账截图`,
    evidenceType: '现场照片', uploaded: false,
  })
  ids.evidence = evidence.data?.id ?? ''
  ids.evidenceNo = evidence.data?.evidenceNo ?? ''
  check(evidence.code === 200 && Boolean(ids.evidence), '现场取证落库', ids.evidenceNo)
  check(/^[0-9a-f]{64}$/.test(String(evidence.data?.evidenceHash ?? '')),
    '证据摘要是 SHA-256（64 位十六进制），不是字符串 hashCode',
    String(evidence.data?.evidenceHash ?? '').slice(0, 16) + '…')
  check(sql(`SELECT CONCAT(captured_by,'#',captured_by_id,'#',task_no) FROM agri_government.gov_evidence WHERE id=${ids.evidence}`)
    === '王磊#2#' + ids.taskNo, '取证记录带承办人与任务号')
  const evidenceList = await api(inspector, 'GET', '/api/v1/government/mobile/evidence')
  check((evidenceList.data ?? []).some((item) => item.evidenceNo === ids.evidenceNo),
    '移动端能查回自己的取证记录', `rows=${(evidenceList.data ?? []).length}`)
  const workbench = await api(inspector, 'GET', '/api/v1/government/mobile/workbench')
  check(Number(workbench.data?.stats?.pendingTasks ?? -1) >= 0
    && workbench.data?.inspector?.name === '王磊' && Number(workbench.data?.offlineRecords ?? 0) >= 1,
    '移动工作台按登录者统计（含未上传取证条数）',
    `待办=${workbench.data?.stats?.pendingTasks} 离线取证=${workbench.data?.offlineRecords}`)
  const noDescription = await api(inspector, 'POST', '/api/v1/government/mobile/evidence', { taskNo: ids.taskNo })
  check(noDescription.code === 400, '没有取证说明不能留证据', noDescription.message)
  const badEvidence = await api(inspector, 'POST', '/api/v1/government/mobile/evidence', {
    taskNo: 'RW-不存在', description: `${MARKER} 挂在不存在任务上的取证`,
  })
  check(badEvidence.code === 404, '挂到不存在任务号上的取证被拒', badEvidence.message)

  // ---------- 8. 预警分派 ----------
  const warnings = await api(admin, 'GET', '/api/v1/government/ops/warnings?status=pending')
  ids.warningUsed = (warnings.data ?? [])[0]?.id ?? null
  const noTarget = await api(admin, 'POST', `/api/v1/government/ops/warnings/${ids.warningUsed}/handle`,
    { note: `${MARKER} 请核查` })
  check(noTarget.code === 400, '运营分派预警必须点名承办人', noTarget.message)
  const assignOk = await api(admin, 'POST', `/api/v1/government/ops/warnings/${ids.warningUsed}/handle`,
    { note: `${MARKER} 请核查`, assigneeId: 2 })
  check(assignOk.code === 200
    && sql(`SELECT CONCAT(status,'#',IFNULL(assignee_id,0),'#',assigned_to) FROM agri_government.gov_warning WHERE id=${ids.warningUsed}`)
      === 'processing#2#王磊', '预警分派落到真实承办人',
    sql(`SELECT CONCAT(status,'#',IFNULL(assignee_id,0)) FROM agri_government.gov_warning WHERE id=${ids.warningUsed}`))
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message WHERE assignee_id=2 AND title='预警已分派给你'`)) === 1,
    '分派动作写入执法人员收件箱')
  const ghostWarning = await api(admin, 'POST', '/api/v1/government/ops/warnings/987654/handle',
    { note: 'x', assigneeId: 2 })
  check(ghostWarning.code === 404, '处置不存在的预警返回 404', ghostWarning.message)

  // ---------- 9. 立案 → 案件推进 → 整改反馈与复核 ----------
  const caseCreated = await api(inspector, 'POST', '/api/v1/government/mobile/cases', {
    subjectId: 2, caseType: '现场检查发现', summary: `${MARKER} 销售限制使用农药且台账不完整`,
    legalBasis: '《农药管理条例》第五十八条',
  })
  ids.case = caseCreated.data?.id ?? ''
  ids.caseNo = caseCreated.data?.caseNo ?? ''
  check(caseCreated.code === 200 && caseCreated.data?.handler === '王磊'
    && sql(`SELECT handler_id FROM agri_government.gov_case WHERE id=${ids.case}`) === '2',
    '执法人员立案：承办人姓名与账号号同时落库', ids.caseNo)
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=2 AND title='已对你立案调查'`)) === 1, '立案动作通知被检查主体',
  `case=${ids.case} 计数=${sql(`SELECT COUNT(*) FROM agri_government.gov_message WHERE subject_id=2`)}`)

  const advanced = await api(admin, 'POST', `/api/v1/government/ops/cases/${ids.case}/advance`,
    { status: 'decision', penaltyAmount: 8000 })
  check(advanced.code === 200 && Number(advanced.data?.progress) === 88, '案件推进到拟处罚阶段',
    `progress=${advanced.data?.progress}`)
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=2 AND title='案件进入拟处罚告知'`)) === 1, '拟处罚告知写入主体收件箱',
  `本轮主体2的全部消息=${sql(`SELECT GROUP_CONCAT(CONCAT(id,':',title)) FROM agri_government.gov_message WHERE subject_id=2`)}`)
  const closed = await api(admin, 'POST', `/api/v1/government/ops/cases/${ids.case}/advance`,
    { status: 'closed' })
  check(closed.code === 200 && String(closed.data?.closedAt ?? '') !== '',
    '案件办结写入结案日期', String(closed.data?.closedAt))
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=2 AND title='案件已办结'`)) === 1, '结案通知写入主体收件箱')
  const advanceAgain = await api(admin, 'POST', `/api/v1/government/ops/cases/${ids.case}/advance`,
    { status: 'investigating' })
  check(advanceAgain.code === 409, '已办结案件不能再推进阶段（状态机冲突按 409）', advanceAgain.message)

  const feedback = await api(admin, 'POST', '/api/v1/government/rectifications/2/feedback', {
    feedback: `${MARKER} 已补传供应商经营许可证与产品登记证`,
  })
  ids.rectification = feedback.data?.id ?? ''
  check(feedback.code === 200 && feedback.data?.status === 'feedback', '主体提交整改反馈', feedback.message)
  const foreignFeedback = await api(outsider, 'POST', '/api/v1/government/rectifications/2/feedback', {
    feedback: '冒名提交',
  })
  check(foreignFeedback.code === 404, '别的主体不能替绿源反馈整改（404，不暴露存在性）',
    foreignFeedback.message)
  const tooEarlyReview = await api(admin, 'POST', '/api/v1/government/ops/rectifications/1/review',
    { status: 'closed', note: '跳过反馈直接结案' })
  check(tooEarlyReview.code === 409, '主体未反馈的整改不能直接复核结案', tooEarlyReview.message)
  const reviewed2 = await api(admin, 'POST', `/api/v1/government/ops/rectifications/${ids.rectification}/review`,
    { status: 'closed', note: `${MARKER} 材料齐全，同意结案` })
  check(reviewed2.code === 200 && reviewed2.data?.status === 'closed', '运营复核整改并结案',
    reviewed2.message)
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE subject_id=1 AND title='整改已结案'`)) === 1, '整改结案通知写入主体收件箱')
  const badClose = await api(admin, 'POST', `/api/v1/government/ops/rectifications/${ids.rectification}/review`,
    { status: '随便', note: 'x' })
  check(badClose.code === 400, '非法复核结论被拒', badClose.message)

  // ---------- 10. 补贴申报闸门 ----------
  const ghostPolicy = await api(admin, 'POST', '/api/v1/government/subsidies', {
    policyId: 987654, projectName: `${MARKER} 项目`, amount: 50000,
  })
  check(ghostPolicy.code === 404, '申报挂到不存在的政策被拒', ghostPolicy.message)
  const noAmount = await api(admin, 'POST', '/api/v1/government/subsidies', { policyId: 2, projectName: 'x' })
  check(noAmount.code === 400, '缺申报金额被拒', noAmount.message)
  policyBefore = sql(`SELECT CONCAT(status,'#',IFNULL(deadline,'')) FROM agri_government.gov_policy WHERE id=3`)
  exec(`UPDATE agri_government.gov_policy SET status='closed' WHERE id=3`)
  const closedPolicy = await api(admin, 'POST', '/api/v1/government/subsidies', {
    policyId: 3, projectName: `${MARKER} 已关政策项目`, amount: 30000,
  })
  check(closedPolicy.code === 403 && /申报期/.test(closedPolicy.message),
    '已关闭申报的政策不能申报', closedPolicy.message)
  const subsidy = await api(admin, 'POST', '/api/v1/government/subsidies', {
    policyId: 2, projectName: `${MARKER} 数字化基地提升`, amount: 120000,
  })
  ids.subsidy = subsidy.data?.id ?? ''
  ids.subsidyNo = subsidy.data?.applicationNo ?? ''
  check(subsidy.code === 200 && sql(`SELECT subject_id FROM agri_government.gov_subsidy WHERE id=${ids.subsidy}`) === '1',
    '补贴申报落库到当前主体', ids.subsidyNo)
  const subsidyReviewed = await api(admin, 'POST', `/api/v1/government/ops/subsidies/${ids.subsidy}/review`,
    { status: 'paid', remoteCheckStatus: `${MARKER} 遥感核查通过` })
  check(subsidyReviewed.code === 200 && subsidyReviewed.data?.status === 'paid',
    '运营复核兑付并通知主体', `progress=${subsidyReviewed.data?.progress}`)
  const subsidyAgain = await api(admin, 'POST', `/api/v1/government/ops/subsidies/${ids.subsidy}/review`,
    { status: 'rejected' })
  check(subsidyAgain.code === 409, '已办结的补贴项目不能重复复核', subsidyAgain.message)

  // ---------- 11. 执法事项清单启停（新任务的项数跟着变） ----------
  const itemCreated = await api(admin, 'POST', '/api/v1/government/ops/check-items', {
    itemName: `${MARKER} 新增检查项`, note: '端到端用例创建',
  })
  ids.checkItem = itemCreated.data?.id ?? ''
  check(itemCreated.code === 200 && Boolean(ids.checkItem) && itemCreated.data?.status === 'active',
    '运营新增执法事项并回读整行', `${ids.checkItem} ${itemCreated.data?.itemName ?? ''}`)
  const tasksWithItem = await api(admin, 'POST', '/api/v1/government/ops/tasks', {
    subjectId: 2, taskType: `${MARKER} 带新清单项任务`, assigneeId: 2,
  })
  const itemTaskNo = tasksWithItem.data?.taskNo ?? ''
  check(Number(tasksWithItem.data?.checklistTotal ?? 0) === 9,
    '新任务按清单展开 9 项（8 项种子 + 新增 1 项）', `total=${tasksWithItem.data?.checklistTotal}`)
  await api(admin, 'POST', `/api/v1/government/ops/check-items/${ids.checkItem}/toggle?active=false`)
  const tasksAfterDisable = await api(admin, 'POST', '/api/v1/government/ops/tasks', {
    subjectId: 2, taskType: `${MARKER} 停用后任务`, assigneeId: 2,
  })
  check(Number(tasksAfterDisable.data?.checklistTotal ?? 0) === 8,
    '停用的检查项不再进入新任务', `total=${tasksAfterDisable.data?.checklistTotal}`)
  const reEnabled = await api(admin, 'POST', `/api/v1/government/ops/check-items/${ids.checkItem}/toggle?active=true`)
  check(reEnabled.code === 200 && reEnabled.data?.status === 'active', '清单可再启用（启停是可逆运营动作）')
  exec(`USE agri_government;
    DELETE c FROM agri_government.gov_task_check c JOIN agri_government.gov_task t ON t.id=c.task_id
    WHERE t.task_no IN ('${itemTaskNo}','${tasksAfterDisable.data?.taskNo ?? ''}')`)
  exec(`DELETE FROM agri_government.gov_task WHERE task_no IN ('${itemTaskNo}','${tasksAfterDisable.data?.taskNo ?? ''}')`)

  // ---------- 12. 消息作用域 ----------
  const adminMessages = await api(admin, 'GET', '/api/v1/government/messages')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message WHERE subject_id=1`))
      === (adminMessages.data ?? []).length,
    '主体收件箱条数与库里本主体的条数一致（不再一把捞全站）',
    `rows=${(adminMessages.data ?? []).length}`)
  const otherMessages = await api(outsider, 'GET', '/api/v1/government/messages')
  check(!(otherMessages.data ?? []).some((item) => item.title === '信用修复已通过复核'),
    '另一家读不到绿源的复核通知', `rows=${(otherMessages.data ?? []).length}`)
  const readAll = await api(admin, 'POST', '/api/v1/government/messages/read-all')
  check(readAll.code === 200 && Number(readAll.data?.updated ?? 0) > 0,
    '一键已读只影响本主体', `updated=${readAll.data?.updated}`)
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message WHERE subject_id=1 AND is_read=FALSE`)) === 0,
    '本主体未读归零')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message WHERE subject_id=2 AND is_read=FALSE`)) > 0,
    '另一家的未读不受影响')
  const inspectorMessages = await api(inspector, 'GET', '/api/v1/government/mobile/messages')
  check((inspectorMessages.data ?? []).length > 0
    && (inspectorMessages.data ?? []).every((item) => String(item.title).match(/任务|预警/)),
    '移动端收件箱只有发给自己的消息', `rows=${(inspectorMessages.data ?? []).length}`)

  // ---------- 13. 主体端留痕范围与公众查询 ----------
  const subjectLogs = await api(admin, 'GET', '/api/v1/government/op-logs')
  check((subjectLogs.data ?? []).length > 0
    && (subjectLogs.data ?? []).every((item) => item.subjectId != null),
    '主体端操作记录只含与本主体相关的行', `rows=${(subjectLogs.data ?? []).length}`)
  const opsLogs = await api(admin, 'GET', '/api/v1/government/ops/logs')
  check((opsLogs.data ?? []).length >= (subjectLogs.data ?? []).length,
    '运营端可看全站留痕（含不带主体的动作）', `rows=${(opsLogs.data ?? []).length}`)
  check((opsLogs.data ?? []).some((item) => String(item.operator) === '王磊'
      && String(item.action) === '现场取证'),
    '取证留痕记录的是真实操作人')

  // ---------- 13.5 溯源核验：数据源必须是生产域，不再是 gov_trace_event 种子 ----------
  const liveCode = String(sql(`SELECT trace_code FROM agri_production.agri_prod_trace_code
    WHERE deleted=0 AND status='active' ORDER BY id LIMIT 1`)).split('\n')[0] ?? ''
  const seedCode = String(sql(`SELECT trace_code FROM agri_government.gov_trace_event ORDER BY id LIMIT 1`))
    .split('\n')[0] ?? ''
  check(Boolean(liveCode), '生产域里有可核验的真实溯源码', liveCode)
  const trace = await api(admin, 'GET', `/api/v1/government/public/trace/${liveCode}`)
  const traceNodes = trace.data?.events ?? []
  check(trace.code === 200 && Number(trace.data?.nodeCount) > 0
      && traceNodes.length === Number(trace.data?.nodeCount),
    '核验结果按生产域真实链路节点返回（节点数与时间线条数一致）',
    `nodes=${trace.data?.nodeCount} events=${traceNodes.length}`)
  // 页面里出现过的每一条存证编号，都必须能在生产域存证表里找到，且 SUCCESS 条数与已上链数一致
  const recordNos = [...new Set(traceNodes.map((item) => item.recordNo).filter(Boolean))]
  const recordRows = recordNos.length
    ? Number(sql(`SELECT COUNT(*) FROM agri_production.agri_prod_chain_record
        WHERE del_flag=0 AND record_no IN ('${recordNos.join("','")}')`))
    : 0
  const successRows = recordNos.length
    ? Number(sql(`SELECT COUNT(*) FROM agri_production.agri_prod_chain_record
        WHERE del_flag=0 AND chain_status='SUCCESS' AND record_no IN ('${recordNos.join("','")}')`))
    : 0
  check(recordNos.length === recordRows && Number(trace.data?.onChainCount) === successRows,
    '已上链节点数与生产域存证表逐条对得上（不是本地种子的假哈希）',
    `recordNos=${recordNos.length} 命中=${recordRows} onChain=${trace.data?.onChainCount} SUCCESS=${successRows}`)
  check(traceNodes.every((item) => !item.attested || Boolean(item.recordNo))
      && traceNodes.every((item) => item.onChain === (item.chainStatus === 'SUCCESS' && Boolean(item.chainHash))),
    '每条节点自己说清有没有存证：未上链的不给哈希，SUCCESS 的必须带哈希',
    traceNodes.slice(0, 2).map((item) => `${item.chainStatus}#${item.chainHash}`).join(' '))
  const seedStillGone = await api(admin, 'GET', `/api/v1/government/public/trace/${seedCode}`)
  check(seedStillGone.code === 404,
    '本域种子表里的假码不再能"核验通过"（生产域没有这条码）',
    `${seedCode} → ${seedStillGone.code} ${seedStillGone.message}`)
  const missingTrace = await api(admin, 'GET', '/api/v1/government/public/trace/不存在-0000')
  check(missingTrace.code === 404, '查不到的溯源码返回 404', missingTrace.message)
  const anonymousTrace = await fetch(`${GOV}/api/v1/government/public/trace/${liveCode}`)
  const anonymousBody = await anonymousTrace.json().catch(() => null)
  check(anonymousTrace.status === 200 && anonymousBody?.code === 200,
    '公众溯源核验真的免登录（以前挂在 gov:citizen 下，政府人员账号反而 403）',
    `http=${anonymousTrace.status} code=${anonymousBody?.code} ${anonymousBody?.message ?? ''}`)
  const inspectorTrace = await api(inspector, 'GET', `/api/v1/government/public/trace/${liveCode}`)
  check(inspectorTrace.code === 200, '执法账号能核验（不再被监管对象端的权限拦住）', inspectorTrace.message)
  const scanned = await api(inspector, 'POST', '/api/v1/government/mobile/scan', { code: liveCode })
  check(scanned.code === 200 && scanned.data?.type === 'trace'
      && String(scanned.data?.chainedNodes ?? '').split('/')[1] === String(scanned.data?.nodeCount),
    '执法端扫码走同一份生产域数据（节点数与已上链数同口径）',
    `chained=${scanned.data?.chainedNodes} type=${scanned.data?.type} verified=${scanned.data?.verified}`)
  const inactiveCode = String(sql(`SELECT trace_code FROM agri_production.agri_prod_trace_code
    WHERE deleted=0 AND status<>'active' ORDER BY id LIMIT 1`)).split('\n')[0] ?? ''
  if (inactiveCode) {
    const inactive = await api(admin, 'GET', `/api/v1/government/public/trace/${inactiveCode}`)
    check(inactive.code === 200 && inactive.data?.verifiable === false && inactive.data?.verified === false
        && /不可核验（当前状态：未激活）/.test(String(inactive.data?.chainSummary)),
      '未激活/作废的码不显示"核验通过"，并说清当前状态',
      `${inactiveCode} verifiable=${inactive.data?.verifiable} ${inactive.data?.statusText}`)
  }
  const publicity = await api(admin, 'GET', '/api/v1/government/public/publicity')
  const publicLicenses = publicity.data?.licenses ?? []
  const licenseOwners = new Set(publicLicenses.map((item) => item.subjectName))
  check(publicity.code === 200 && publicLicenses.length > 0 && licenseOwners.size >= 2
      && publicLicenses.every((item) => item.subjectName),
    '双公示的行政许可带归属主体且跨多家（不是登录者自己的证照清单）',
    `licenses=${publicLicenses.length} 主体数=${licenseOwners.size} · ${[...licenseOwners].join('、')}`)
  const publicityOther = await api(outsider, 'GET', '/api/v1/government/public/publicity')
  check(JSON.stringify(publicityOther.data?.licenses ?? []) === JSON.stringify(publicLicenses),
    '公众公示与登录者无关（换账号看到同一份公开信息）',
    `rows=${(publicityOther.data?.licenses ?? []).length}`)
  check((publicity.data?.penalties ?? []).length > 0, '行政处罚公示有内容',
    `penalties=${(publicity.data?.penalties ?? []).length}`)
  const publicCredit = await api(admin, 'GET', '/api/v1/government/public/credit?keyword='
    + encodeURIComponent('绿源'))
  check((publicCredit.data?.items ?? []).length > 0, '公众信用查询按名称命中', `rows=${(publicCredit.data?.items ?? []).length}`)
  const noKeyword = await api(admin, 'GET', '/api/v1/government/public/credit')
  check(noKeyword.code === 400, '空关键词被拒（不再返回全量主体）', noKeyword.message)

  // ---------- 14. 运营总览：AI 指标与简报真算 ----------
  const overview = await api(admin, 'GET', '/api/v1/government/ops/overview')
  const aiExpected = Number(sql(`SELECT (SELECT COUNT(*) FROM agri_government.gov_warning
    WHERE ai_confidence IS NOT NULL) + (SELECT COUNT(*) FROM agri_government.gov_self_check)`))
  check(overview.code === 200 && Number(overview.data?.metrics?.aiAssistCount ?? -1) === aiExpected && aiExpected > 0,
    'AI 参与记录数按库中记录统计（不再是常量 146）', `aiAssist=${overview.data?.metrics?.aiAssistCount} 库=${aiExpected}`)
  check((overview.data?.aiBrief ?? []).length >= 4
    && JSON.stringify(overview.data?.aiBrief).includes('抽检不合格'),
    '值班简报由真实预警与抽检数据生成', String((overview.data?.aiBrief ?? [])[0] ?? '').slice(0, 40))
  check((overview.data?.todos ?? []).some((item) => item.route === 'rectifications'),
    '运营待办新增整改复核队列', `todos=${(overview.data?.todos ?? []).length}`)
}

function cleanup() {
  const list = (value) => String(value || '').split(',').map((item) => item.trim())
    .filter((item) => item && item !== 'NULL')

  const taskIds = list(sql(`SELECT GROUP_CONCAT(id) FROM agri_government.gov_task WHERE task_type LIKE '%${MARKER}%'`))
  if (taskIds.length) {
    exec(`DELETE FROM agri_government.gov_task_check WHERE task_id IN (${taskIds.join(',')})`)
    exec(`DELETE FROM agri_government.gov_task WHERE id IN (${taskIds.join(',')})`)
  }
  exec(`DELETE FROM agri_government.gov_evidence WHERE description LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_case WHERE summary LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_report WHERE title LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_credit_repair WHERE reason LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_subsidy WHERE project_name LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_self_check WHERE result_text LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_check_item WHERE item_name LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_message WHERE content LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_government.gov_op_log WHERE detail LIKE '%${MARKER}%'`)
  // 本轮写入的站内信与留痕带的是完整时间戳，种子里的是"今天 09:20"这类文案，按格式清掉本轮新增
  exec(`DELETE FROM agri_government.gov_message WHERE created_at REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'`)
  exec(`DELETE FROM agri_government.gov_op_log WHERE created_at REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}$'`)
  // 自查记录没有标记字段，按本轮写入时间清（种子的自查行 created 是更早的时间戳）
  if (ids.selfCheck) exec(`DELETE FROM agri_government.gov_self_check WHERE id=${ids.selfCheck}`)

  // 还原被本轮改动过的种子（整改单 2 的原始状态是 pending/30）
  if (ids.warningUsed) {
    exec(`UPDATE agri_government.gov_warning SET status='pending',assigned_to='王磊',assignee_id=2,handle_note=NULL
      WHERE id=${ids.warningUsed}`)
  }
  exec(`UPDATE agri_government.gov_rectification SET status='pending',progress=30,
    feedback_text='正在收集供应商材料。' WHERE id=2`)
  if (policyBefore) {
    const [status, deadline] = String(policyBefore).split('#')
    exec(`UPDATE agri_government.gov_policy SET status='${status}',deadline='${deadline}' WHERE id=3`)
  }
  // 第二家档案的临时绑定还原成原值
  exec(`UPDATE agri_government.gov_subject SET merchant_id=${otherBindingBefore
    ? `'${otherBindingBefore}'` : 'NULL'} WHERE id=${ids.subjectOther || 0}`)

  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_task
    WHERE task_type LIKE '%${MARKER}%'`)) === 0, '清理后执法任务残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_task_check c
    LEFT JOIN agri_government.gov_task t ON t.id=c.task_id WHERE t.id IS NULL`)) === 0,
    '清理后没有孤立的任务检查项')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_evidence
    WHERE description LIKE '%${MARKER}%'`)) === 0, '清理后取证记录残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_case
    WHERE summary LIKE '%${MARKER}%'`)) === 0, '清理后案件残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_report
    WHERE title LIKE '%${MARKER}%'`)) === 0, '清理后报送残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_message
    WHERE created_at REGEXP '^[0-9]{4}-[0-9]{2}-[0-9]{2}'`)) === 0, '清理后本轮站内信残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_subsidy
    WHERE project_name LIKE '%${MARKER}%'`)) === 0, '清理后补贴申报残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_credit_repair
    WHERE reason LIKE '%${MARKER}%'`)) === 0, '清理后信用修复申请残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_government.gov_check_item
    WHERE item_name LIKE '%${MARKER}%'`)) === 0, '清理后新增执法事项残留为 0')
  check(sql(`SELECT IFNULL(merchant_id,'') FROM agri_government.gov_subject WHERE id=${ids.subjectOther || 0}`)
    === otherBindingBefore, '第二家监管档案的临时绑定已还原', `原值=${otherBindingBefore}`)
  check(sql(`SELECT CONCAT(status,'#',IFNULL(deadline,'')) FROM agri_government.gov_policy WHERE id=3`)
    === policyBefore, '政策申报期状态已还原', policyBefore)
  check(sql(`SELECT merchant_id FROM agri_government.gov_subject WHERE subject_name='${SUBJECT_NAME}'`) === '2001',
    '本轮没有改动主测试档案的绑定', SUBJECT_NAME)
}

main()
  .catch((error) => {
    failures.push(`未捕获异常：${error.message}`)
    console.error(error)
  })
  .finally(() => {
    cleanup()
    console.log(`\n政府监管端到端回归：${checked} 条断言通过，${failures.length} 条失败`)
    if (failures.length) {
      failures.forEach((label) => console.log(`  ✗ ${label}`))
      process.exitCode = 1
    }
    process.exit(failures.length === 0 ? 0 : 1)
  })
