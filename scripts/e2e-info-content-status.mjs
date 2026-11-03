/**
 * agri-info · 内容审核状态机与存证归属端到端
 *
 * 修的是两件"看起来能用、其实没有门"的事：
 *   1. 内容状态：新建时 `status` 直接取请求体 —— 传 `published` 就**跳过审核直接上线**；
 *      审核 `UPDATE ... WHERE id=?` 不看当前状态 —— 已下架/已驳回的稿子能被重新 approve 上线，
 *      已发布的还能再审一次把 published_at 刷成现在；「退回修改」写入 `draft`，
 *      而页签与计数都没有 draft —— 点一次这条稿子就从四个页签里**全部消失**（数据还在，没人看得见）。
 *   2. 内容存证：`attestations(String user)` 的形参**根本没进 SQL**，
 *      「内容存证」页把别人单位、别人作者的存证编号与哈希全量列了出来（那张表本来就有 owner 列）。
 *
 * 所以这条脚本要在每一个"不该让过"的入口上断言被拒，并且断言库里状态没被改动；
 * 再看一次"退回修改"之后草稿到底看不看得见。
 *
 * 用法：node scripts/e2e-info-content-status.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
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
const INFO = 'http://localhost:8096'
const OPS = 'http://localhost:8113/info-ops/'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'outputs', 'info-content-status-20261102')
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

const PASSWORD = 'Admin@123'
const MARK = `E2E资讯状态机${String(Date.now()).slice(-8)}`
/** 库里真实存在的两个存证归属（owner 列，3 个不同值） */
const OWNER_A = '政策研究部'
const OWNER_B = '平台行情数据中心'

let token = ''

/**
 * @param rawUser 传 null 表示不带 X-Agri-User；传字符串时按前端约定 URL 编码
 *                （浏览器对非 ASCII 请求头值支持不一致，后端 owner() 会 decode）
 */
const call = async (method, pathname, { body, user = OWNER_A } = {}) => {
  const headers = { Authorization: `Bearer ${token}` }
  if (user !== null) headers['X-Agri-User'] = encodeURIComponent(user)
  if (body) headers['Content-Type'] = 'application/json'
  const response = await fetch(`${INFO}${pathname}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json().catch(() => ({}))
  return { status: response.status, code: json?.code ?? -1, message: json?.message ?? '', data: json?.data }
}

const statusOf = (id) => sql(`SELECT status FROM agri_info.info_article WHERE id = ${id}`)
const publishedAtOf = (id) => sql(`SELECT published_at FROM agri_info.info_article WHERE id = ${id}`)
const articleId = (title) => sql(
  `SELECT id FROM agri_info.info_article WHERE title = '${title}' ORDER BY id DESC LIMIT 1`)

let browser
let page

try {
  /* ---------- 0) 登录态与基线 ---------- */
  const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: PASSWORD, marketId: 1 }),
  })).json().catch(() => ({}))
  token = login?.data?.accessToken ?? ''
  check(Boolean(token), '取得运营端超管登录态（info:admin）')
  check(sql(`SELECT COUNT(*) FROM agri_info.info_article WHERE title LIKE '${MARK}%'`) === '0',
    `基线：本次标记（${MARK}）没有历史内容残留`)

  /* ---------- 1) 新建不能跳过审核 ---------- */
  const sneaky = await call('POST', '/api/v1/info/ops/contents', {
    body: { title: `${MARK}-直接发布`, channel: '行情分析', contentType: '图文',
      summary: '端到端', content: '端到端正文', status: 'published' },
  })
  check(sneaky.status === 400 && String(sneaky.message).includes('不能直接'),
    '新建内容传 status=published 被拒（修前这一步会直接上线，审核环节整段被绕过）',
    String(sneaky.message).slice(0, 46))
  check(articleId(`${MARK}-直接发布`) === '', '   ↳ 被拒的那一条没有落库')

  const draft = await call('POST', '/api/v1/info/ops/contents', {
    body: { title: `${MARK}-草稿`, channel: '行情分析', contentType: '图文',
      summary: '端到端草稿', content: '端到端正文', status: 'draft' },
  })
  const draftId = String(draft.data?.id ?? '')
  check(draft.status === 200 && /^\d+$/.test(draftId) && statusOf(draftId) === 'draft',
    '新建为草稿（draft）', `id=${draftId} status=${statusOf(draftId)}`)

  /* ---------- 2) 草稿不能直接通过审核 ---------- */
  const earlyApprove = await call('POST', `/api/v1/info/ops/contents/${draftId}/audit`, { body: { action: 'approve' } })
  check(earlyApprove.status === 400 && String(earlyApprove.message).includes('只有待审核'),
    '草稿点「通过并发布」被拒：上线必须先经过待审核', String(earlyApprove.message).slice(0, 52))
  check(statusOf(draftId) === 'draft' && publishedAtOf(draftId) === '',
    '   ↳ 状态与发布时间都没被改动', `status=${statusOf(draftId)}`)

  /* ---------- 3) 提交审核 → 通过 → 发布 ---------- */
  const submit = await call('POST', `/api/v1/info/ops/contents/${draftId}/audit`, { body: { action: 'submit' } })
  check(submit.status === 200 && statusOf(draftId) === 'pending',
    '「提交审核」把草稿送进待审核', `status=${statusOf(draftId)}`)
  const approve = await call('POST', `/api/v1/info/ops/contents/${draftId}/audit`, { body: { action: 'approve' } })
  check(approve.status === 200 && statusOf(draftId) === 'published' && publishedAtOf(draftId) !== '',
    '待审核的内容审核通过并写下发布时间',
    `status=${statusOf(draftId)} publishedAt=${publishedAtOf(draftId)}`)

  /* ---------- 4) 重复审核与已下架重新上线 ---------- */
  const publishedAt = publishedAtOf(draftId)
  const twice = await call('POST', `/api/v1/info/ops/contents/${draftId}/audit`, { body: { action: 'approve' } })
  check(twice.status === 400 && String(twice.message).includes('无需重复'),
    '已发布的稿子不能再审一次（修前会把 published_at 刷成现在，审计时间就不可信了）',
    String(twice.message).slice(0, 44))
  check(publishedAtOf(draftId) === publishedAt, '   ↳ 发布时间没有被刷新', publishedAtOf(draftId))

  const unknownAction = await call('POST', `/api/v1/info/ops/contents/${draftId}/audit`, { body: { action: 'whatever' } })
  check(unknownAction.status === 400 && String(unknownAction.message).includes('不认识'),
    '未知审核动作被拒（修前 default 分支会把它当成「通过并发布」—— 最坏的一种默认值）',
    String(unknownAction.message).slice(0, 40))
  check(statusOf(draftId) === 'published', '   ↳ 状态未变', statusOf(draftId))

  const offlineNoReason = await call('POST', `/api/v1/info/ops/contents/${draftId}/offline`, { body: { note: '' } })
  check(offlineNoReason.status === 400 && String(offlineNoReason.message).includes('下架原因'),
    '下架必须写原因', String(offlineNoReason.message).slice(0, 30))
  const offline = await call('POST', `/api/v1/info/ops/contents/${draftId}/offline`,
    { body: { note: '端到端：数据口径需更正' } })
  check(offline.status === 200 && statusOf(draftId) === 'offline',
    '已发布的内容可以下架', `status=${statusOf(draftId)}`)

  const backOnline = await call('POST', `/api/v1/info/ops/contents/${draftId}/audit`, { body: { action: 'approve' } })
  check(backOnline.status === 400 && String(backOnline.message).includes('已下架'),
    '已下架的稿子不能被直接 approve 放回线上（必须重新走审核）',
    String(backOnline.message).slice(0, 46))
  check(statusOf(draftId) === 'offline', '   ↳ 仍然是已下架', statusOf(draftId))
  const resubmit = await call('POST', `/api/v1/info/ops/contents/${draftId}/audit`, { body: { action: 'submit' } })
  check(resubmit.status === 200 && statusOf(draftId) === 'pending',
    '已下架的内容可以重新提交审核（不是永久封死）', `status=${statusOf(draftId)}`)

  /* ---------- 5) 退回修改 → 草稿必须看得见 ---------- */
  const reviseNoNote = await call('POST', `/api/v1/info/ops/contents/${draftId}/audit`, { body: { action: 'revise' } })
  check(reviseNoNote.status === 400 && String(reviseNoNote.message).includes('处理意见'),
    '退回修改必须写意见', String(reviseNoNote.message).slice(0, 30))
  const revise = await call('POST', `/api/v1/info/ops/contents/${draftId}/audit`,
    { body: { action: 'revise', note: '端到端：请补充数据来源' } })
  check(revise.status === 200 && statusOf(draftId) === 'draft',
    '退回修改落到 draft', `status=${statusOf(draftId)}`)

  const list = await call('GET', '/api/v1/info/ops/contents?status=draft')
  const draftRows = (list.data?.items ?? []).filter((row) => String(row.title).startsWith(MARK))
  check(list.status === 200 && draftRows.length === 1,
    '「草稿」页签查得到这条稿子（修前它写进 draft 却没有任何页签能显示 —— 等于凭空消失）',
    `命中=${draftRows.length}`)
  check(Number(list.data?.counts?.draft ?? -1) >= 1,
    '计数里也有草稿这一档', `draft=${list.data?.counts?.draft}`)

  /* ---------- 6) 编辑内容不得改变状态 ---------- */
  const edit = await call('POST', '/api/v1/info/ops/contents', {
    body: { id: Number(draftId), title: `${MARK}-草稿`, channel: '行情分析', contentType: '图文',
      summary: '改过的摘要', content: '改过的正文', status: 'published' },
  })
  check(edit.status === 200 && statusOf(draftId) === 'draft'
    && String(edit.data?.message ?? '').includes('状态仍为'),
    '编辑草稿时传 status=published 也不会被写进去（状态只能由审核动作变更）',
    `status=${statusOf(draftId)} msg=${String(edit.data?.message ?? '').slice(0, 40)}`)
  check(sql(`SELECT summary FROM agri_info.info_article WHERE id = ${draftId}`) === '改过的摘要',
    '   ↳ 正文/摘要这些内容字段确实保存了（不是整个请求被拒）')

  /* ---------- 7) 存证按归属过滤 ---------- */
  const attestA = await call('GET', '/api/v1/info/attestations', { user: OWNER_A })
  const attestB = await call('GET', '/api/v1/info/attestations', { user: OWNER_B })
  const idsOf = (rows) => (rows ?? []).map((row) => String(row.id)).sort().join(',')
  const sqlIds = (owner) => sql(
    `SELECT GROUP_CONCAT(id ORDER BY id) FROM agri_info.info_attestation WHERE owner = '${owner}'`)
  check(attestA.status === 200 && idsOf(attestA.data) === String(sqlIds(OWNER_A)),
    `存证列表只回当前归属（${OWNER_A}）的记录，与库里 owner 列逐条一致`,
    `接口=${idsOf(attestA.data)} 库里=${sqlIds(OWNER_A)}`)
  check(attestB.status === 200 && idsOf(attestB.data) === String(sqlIds(OWNER_B))
    && idsOf(attestA.data) !== idsOf(attestB.data),
    `换一个归属（${OWNER_B}）看到的是另一批，两批不重叠`,
    `接口=${idsOf(attestB.data)}`)
  check(Number(sql(`SELECT COUNT(*) FROM agri_info.info_attestation`) || '0') > idsOf(attestA.data).split(',').length,
    '库里确实还有别人单位的存证（说明过滤不是"恰好只有一条"造成的假通过）')

  /* ---------- 8) 运营端页面：草稿页签与审核默认结论 ---------- */
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
  const jsErrors = []
  page.on('pageerror', (error) => jsErrors.push(String(error?.message ?? error).slice(0, 160)))
  await page.goto(OPS, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  const tab = page.locator('button').filter({ hasText: '账号 + 密码' })
  if (await tab.count()) await tab.first().click({ timeout: 10000 })
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="密码"]').last().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForURL(`${OPS}**`, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await page.goto(OPS, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(3000)
  // 运营端是 hash 路由：进内容页要显式换 hash 并等页面自己拉完数据
  await page.evaluate(() => { window.location.hash = '#/contents' })
  await page.waitForTimeout(3500)
  const bodyText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(bodyText.includes('草稿'), '内容页有「草稿」页签（修前退回修改的稿子在任何页签里都找不到）',
    bodyText.match(/草稿 ?\d*/)?.[0] ?? '')
  const draftChip = page.locator('button.chip').filter({ hasText: '草稿' }).first()
  const chipVisible = await draftChip.count()
  if (chipVisible) {
    await draftChip.click()
    await page.waitForTimeout(2500)
    const afterClick = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
    check(afterClick.includes(MARK), '点「草稿」页签后表格真的列出这条草稿（页签不是只多个数字）',
      afterClick.includes(MARK) ? MARK : '没找到本次标题')
  } else {
    check(false, '点「草稿」页签后表格真的列出这条草稿', '页签没找到')
  }
  await page.screenshot({ path: path.join(OUT, '01-draft-tab.png'), fullPage: true })

  // 两颗都要避开：页签「待审核」也含"审核"（hasText 是子串匹配），
  // 而 antd 给两个汉字之间塞了空格，DOM 里其实是「审 核」
  const auditButton = page.locator('.ant-table button').filter({ hasText: /^审\s*核$/ }).first()
  check(await auditButton.count() === 1, '草稿行上有「审核」按钮', `count=${await auditButton.count()}`)
  await auditButton.click()
  await page.waitForTimeout(1500)
  const modalText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  const checkedValue = await page.evaluate(() => {
    const input = document.querySelector('.ant-modal input[type="radio"]:checked')
    return input ? (input.value ?? '') : ''
  })
  check(modalText.includes('当前状态') && modalText.includes('草稿'),
    '审核弹窗写明当前状态（不合法的结论由服务端拒绝，前端不复刻流转表）',
    modalText.match(/当前状态[^]{0,40}/)?.[0]?.slice(0, 60) ?? '')
  check(modalText.includes('提交审核') && checkedValue === 'submit',
    '草稿的默认结论是「提交审核」，而不是一进来就选中「通过并发布」',
    `默认=${checkedValue || '未选中'}`)
  await page.screenshot({ path: path.join(OUT, '02-audit-modal.png'), fullPage: true })

  check(jsErrors.length === 0, '全程无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 220))
} finally {
  await page?.context().close().catch(() => {})
  await browser?.close().catch(() => {})
  const ids = sql(`SELECT id FROM agri_info.info_article WHERE title LIKE '${MARK}%'`)
  const inClause = ids ? ids.split(/\s+/).filter(Boolean).join(',') : '0'
  sql(`DELETE FROM agri_info.info_audit_log WHERE target_name LIKE '${MARK}%'`)
  sql(`DELETE FROM agri_info.info_article WHERE title LIKE '${MARK}%'`)
  const residueArticle = sql(`SELECT COUNT(*) FROM agri_info.info_article WHERE title LIKE '${MARK}%'`)
  const residueLog = sql(`SELECT COUNT(*) FROM agri_info.info_audit_log WHERE target_name LIKE '${MARK}%'`)
  // 存证只读不写，验证它没被本轮改动（verify_count 不在本轮路径上）
  const residueAttest = sql(`SELECT COUNT(*) FROM agri_info.info_attestation`)
  console.log('')
  check(residueArticle === '0' && residueLog === '0',
    '清理：本次造的内容与审计日志零残留', `article=${residueArticle} audit_log=${residueLog}`)
  check(residueAttest === '4', '清理：存证表未被改动（本轮只读）', `rows=${residueAttest} in=${inClause}`)
}

console.log('')
if (!failures.length) {
  console.log('agri-info 内容状态机与存证归属端到端验证全部通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((label) => console.log('  -', label))
process.exit(1)
