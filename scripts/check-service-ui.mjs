/**
 * 综合服务三端浏览器点检（用户端 :8105 / 移动端 :8106 / 运营端 :8107）
 *
 * 接口级判据在 e2e-service-flow.mjs，这份只回答"页面上真点得动"：
 *   用户端：顶栏按令牌显示"我是哪家主体" → 类目来自字典 → 收藏真的落库 → 预约日期下限是明天、
 *   金额只认目录价 → 支付定金 → 培训推到 100% 由服务端发证书 → 资源落到自己主体 →
 *   问诊必须选中在册专家 → 合同要素算出 SHA-256 并真下载 → 需求匹配数=同类目在营家数 →
 *   投保按费率测算 → 一键已读只清本主体。
 *   运营端：顶栏日期是今天、待办徽标=实数合计 → 绑定不存在/被占用的主体被拒 →
 *   商品审核、派单、投诉办结、结算复核都必填且操作人来自令牌 → 审计日志真下载 CSV。
 *   移动端：工作台不带 providerId 也解析到自家档案 → 假指标消失 → 抢单指派 → 上报进度写库 →
 *   "我的"页显示真实身份与计数。
 *   全程临时数据按建前最大 id 清理归零，被改动的种子逐条还原。
 *
 * 用法：node scripts/check-service-ui.mjs
 *   前置：core :8093、agri-service :8094、gateway 8105/8106/8107 在跑，
 *        且已执行 node scripts/provision-service-access.mjs（provider 账号与档案绑定）。
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

const PORTAL = 'http://localhost:8105/service/'
const MOBILE = 'http://localhost:8106/service-mobile/'
const OPS = 'http://localhost:8107/service-ops/'
const PASSWORD = 'Admin@123'
const MARKER = 'UI点检'
const PROVIDER_NAME = '建国农机合作社'
const MERCHANT_A = '2001'
const MERCHANT_B = '2003'
const PROVIDER_MERCHANT = '2116774863340740609'

const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'service-ui-20261101')
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
const maxId = (table) => Number(scalar(`SELECT COALESCE(MAX(id),0) FROM agri_service.${table}`)) || 0
const part = (packed, index) => `SUBSTRING_INDEX(SUBSTRING_INDEX('${packed}', '#', ${index}), '#', -1)`

const pageText = async (page) => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
/** antd 会在两个汉字的按钮里插空格（"审核"渲染成"审 核"），文案定位一律允许字间空白。 */
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
const navPortal = async (page, label) => {
  await page.locator('aside.app-sidebar button').filter({ hasText: cjk(label) }).first().click()
  await page.waitForTimeout(1100)
}
const navOps = async (page, label) => {
  await page.locator('aside.ops-sidebar button').filter({ hasText: cjk(label) }).first().click()
  await page.waitForTimeout(1100)
}
/**
 * antd 关掉的弹窗仍留在 DOM 里（display:none），不限定 :visible 就会点到上一步那个已关的弹窗。
 */
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
  // 有的弹窗用默认 footer（确认在 .ant-modal-footer），预约弹窗是 footer={null}、主按钮在表单里
  const footer = page.locator('.ant-modal-content:visible .ant-modal-footer .ant-btn-primary')
  if (await footer.count()) {
    await footer.last().click()
  } else {
    await page.locator('.ant-modal-content:visible button.ant-btn-primary').last().click()
  }
  await page.waitForTimeout(1400)
}
/** 被服务端拒绝时弹窗不会自己关；不点掉它，后面的点击会被遮罩层吃掉。 */
const modalDismiss = async (page) => {
  await page.locator('.ant-modal-content:visible .ant-modal-close').first().click().catch(() => {})
  await page.waitForTimeout(600)
}
const clickByText = async (page, label, scope = 'body') => {
  await page.locator(scope).locator('button').filter({ hasText: cjk(label) }).first().click()
  await page.waitForTimeout(1100)
}

async function ssoLogin(page, base, username) {
  const port = new URL(base).port
  await page.goto(base, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  // 用当前页 port 判断是否已回到本端：includes(port) 会把 redirect_uri 里的端口也算进去
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

/** uni-app H5 的 hash 路由：只改 hash 不会重新进页面，所以"改 hash → 等文案 → 不行就整页重载"。 */
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

async function uniLogin(page, username) {
  await page.goto(`${MOBILE}#/pages/login/index`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  // uni-app 把 placeholder 渲染成覆盖层 div，input 上没有 placeholder 属性，只能按位置取
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

const tomorrow = (() => {
  const date = new Date(Date.now() + 86400000)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
})()
const todayIso = new Date().toISOString().slice(0, 10)
const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date().getDay()]

let browser
try {
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
} catch (error) {
  console.error('浏览器启动失败：', error?.message ?? error)
  process.exit(1)
}

const before = {
  order: maxId('service_order'), demand: maxId('service_demand'), message: maxId('service_message'),
  log: maxId('service_op_log'), consultation: maxId('service_consultation'),
  policy: maxId('insurance_policy'), enrollment: maxId('service_enrollment'),
  resource: maxId('service_resource'), favorite: maxId('service_favorite'), provider: maxId('service_provider'),
}
const restore = {
  provider1Merchant: scalar('SELECT IFNULL(merchant_id,\'\') FROM agri_service.service_provider WHERE id=1'),
  itemBefore: scalar(`SELECT CONCAT(audit_status,'#',status) FROM agri_service.service_item
    WHERE audit_status='pending' ORDER BY id LIMIT 1`),
  settlementBefore: scalar(`SELECT CONCAT(status,'#',IFNULL(reviewed_by,''),'#',IFNULL(reviewed_at,''))
    FROM agri_service.service_settlement WHERE id=1`),
  complaintBefore: scalar(`SELECT CONCAT(status,'#',progress,'#',IFNULL(handler,''),'#',IFNULL(resolution,''))
    FROM agri_service.service_complaint WHERE id=2`),
  unreadA: scalar(`SELECT COALESCE(GROUP_CONCAT(id),'') FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND is_read=FALSE`),
  unreadB: scalar(`SELECT COALESCE(GROUP_CONCAT(id),'') FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_B} AND is_read=FALSE`),
}
const itemId = Number(String(restore.itemBefore).split('#').length ? scalar(`SELECT id FROM agri_service.service_item
  WHERE audit_status='pending' ORDER BY id LIMIT 1`) : 0) || 6
const targetProviderId = Number(scalar(`SELECT id FROM agri_service.service_provider WHERE name='${PROVIDER_NAME}' LIMIT 1`))
const catalog = String(scalar(`SELECT CONCAT(name,'#',price) FROM agri_service.service_item
  WHERE provider_id=${targetProviderId} AND audit_status='approved' AND status='enabled' ORDER BY id LIMIT 1`)
  .split('\n')[0]).split('#')
const catalogName = catalog[0]
const catalogPrice = Number(catalog[1])

const desktopErrors = []
const opsErrors = []
const mobileErrors = []

try {
  /* ==================== A. 用户端 ==================== */
  const desktop = await browser.newContext({ viewport: { width: 1500, height: 980 }, acceptDownloads: true })
  const portal = await desktop.newPage()
  portal.on('pageerror', (e) => portal.url().includes(':8105') && desktopErrors.push(String(e.message)))
  check(await ssoLogin(portal, PORTAL, 'farmer'), '用户端 farmer 统一登录成功回到 :8105')

  const headerText = await pageText(portal)
  check(headerText.includes('绿源农业合作社'), '顶栏经营主体由令牌解析（不是写死"陈先生"）',
    headerText.match(/经营主体：\S+/)?.[0] ?? '')
  const unreadDbA = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND is_read=FALSE`))
  const bellBadge = await portal.locator('.header-icon .ant-badge-count').first().innerText().catch(() => '')
  check(String(bellBadge).includes(String(unreadDbA)), '顶栏未读徽标=本主体真实未读数', `页面=${bellBadge || 0} 库=${unreadDbA}`)

  await navPortal(portal, '服务超市')
  await hasText(portal, '服务超市')
  const chips = await portal.locator('.category-tabs button').allInnerTexts()
  const dbCategories = sql(`SELECT DISTINCT category FROM agri_service.service_provider WHERE status='available'`)
    .split('\n').filter(Boolean)
  check(chips.length === dbCategories.length + 1, '类目筛选来自字典接口（全部 + 库中类目）', `页面=${chips.length} 库=${dbCategories.length}`)
  const listCount = await portal.locator('.provider-grid article').count()
  const dbProviders = Number(scalar("SELECT COUNT(*) FROM agri_service.service_provider WHERE status='available'"))
  check(listCount === dbProviders, '服务超市条数与库一致', `${listCount} / ${dbProviders}`)

  await portal.locator('.provider-card').filter({ hasText: cjk(PROVIDER_NAME) }).first().click()
  await hasText(portal, PROVIDER_NAME)
  const favBefore = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_favorite
    WHERE merchant_id=${MERCHANT_A} AND provider_id=${targetProviderId}`))
  await clickByText(portal, '收藏服务商')
  const favAfter = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_favorite
    WHERE merchant_id=${MERCHANT_A} AND provider_id=${targetProviderId}`))
  check(favBefore === 0 && favAfter === 1, '点收藏真的写进 service_favorite（此前只弹 toast）', `${favBefore}→${favAfter}`)
  check((await pageText(portal)).includes('已收藏'), '收藏按钮文案跟随服务端结果')
  await clickByText(portal, '已收藏')
  check(Number(scalar(`SELECT COUNT(*) FROM agri_service.service_favorite
    WHERE merchant_id=${MERCHANT_A} AND provider_id=${targetProviderId}`)) === 0, '取消收藏同样落库')

  await portal.locator('.service-item-row').first().locator('button').filter({ hasText: cjk('立即预约') }).click()
  await hasText(portal, '预约服务')
  const dateMin = await portal.locator('.ant-modal-content:visible input[type="date"]').first().getAttribute('min')
  check(dateMin === tomorrow, '预约日期下限=明天（不再写死 2026-10-27）', String(dateMin))
  await fillField(portal, '服务地址', `${MARKER} 3 号田`)
  await modalConfirm(portal)
  const blocked = (await toasts(portal)) + (await pageText(portal))
  check(blocked.includes('请输入联系电话') || blocked.includes('11 位手机号'), '空联系电话被表单拦住（不会静默提交）')
  await fillField(portal, '联系电话', '13800001234')
  await fillField(portal, '数量', '10')
  await fillField(portal, '补充要求', `${MARKER} 履带式`)
  await modalConfirm(portal)
  await portal.waitForTimeout(1500)
  const orderRow = scalar(`SELECT CONCAT(status,'#',unit_price,'#',total_amount,'#',IFNULL(merchant_id,0),'#',IFNULL(contact_name,''),
    '#',IFNULL(deposit_amount,0)) FROM agri_service.service_order ORDER BY id DESC LIMIT 1`)
  const [orderStatus, orderUnit, orderTotal, orderMerchant, orderContact, orderDeposit] = String(orderRow).split('#')
  check(orderStatus === 'pending_payment' && orderMerchant === MERCHANT_A,
    'UI 下单落在"待支付定金"且归属令牌主体', `${orderStatus} / ${orderMerchant}`)
  check(Number(orderUnit) === catalogPrice && Number(orderTotal) === catalogPrice * 10
    && Number(orderDeposit) === Math.round(catalogPrice * 10 * 0.2),
    '金额与定金按服务商目录价实算（前端不再自报价）',
    `目录=${catalogPrice} 落库 ${orderUnit}×10=${orderTotal} 定金=${orderDeposit}`)
  check(Boolean(orderContact) && orderContact !== '陈先生', '联系人默认取解析出的主体名', orderContact)
  check(await hasText(portal, '支付定金', 8000), '订单详情给出"支付定金"这一步动作')
  await clickByText(portal, '支付定金')
  check(await hasText(portal, '已确认', 8000) || (await pageText(portal)).includes('待服务'),
    '支付定金后状态按状态机推进')

  await navPortal(portal, '培训课堂')
  await hasText(portal, '培训课堂')
  const courseRowRaw = scalar(`SELECT CONCAT(c.id,'#',c.title) FROM agri_service.service_course c
    WHERE NOT EXISTS (SELECT 1 FROM agri_service.service_enrollment e
      WHERE e.course_id=c.id AND e.merchant_id IN (${MERCHANT_A},${MERCHANT_B})) ORDER BY c.id LIMIT 1`)
  const [courseId, ...courseTitleParts] = String(courseRowRaw).split('#')
  const courseTitle = courseTitleParts.join('#')
  check(Boolean(courseId) && Number.isFinite(Number(courseId)), '找到一门两家公司都没报名过的课程', courseTitle)
  await portal.locator('.course-card').filter({ hasText: cjk(courseTitle.slice(0, 8)) }).first()
    .locator('button').filter({ hasText: cjk('免费报名') }).click()
  const modalOpen = await hasText(portal, '我的学习笔记', 10000)
  check(modalOpen, '报名后学习弹窗打开（进度与笔记都挂在这条报名记录上）')
  for (let step = 0; step < 4; step += 1) {
    await clickByText(portal, '推进 25%')
  }
  const enrollmentRow = scalar(`SELECT CONCAT(progress,'#',IFNULL(cert_no,'')) FROM agri_service.service_enrollment
    WHERE course_id=${courseId} AND merchant_id=${MERCHANT_A}`)
  check(String(enrollmentRow).startsWith('100#') && String(enrollmentRow).split('#')[1].length > 4,
    '进度到 100% 后由服务端签发结业证书', `${enrollmentRow} 课程=${courseTitle}`)
  await modalDismiss(portal)
  const issuedCert = String(enrollmentRow).split('#')[1]
  check(issuedCert && (await pageText(portal)).includes(issuedCert),
    '证书区显示的是刚签发的真实证书号（不是写死三张）', issuedCert ?? '')

  await navPortal(portal, '土地·用工·法律')
  await hasText(portal, '产业资源对接')
  const landDb = Number(scalar("SELECT COUNT(*) FROM agri_service.service_resource WHERE resource_type='land'"))
  const landUi = await portal.locator('.land-list article').count()
  check(landUi === landDb, '土地流转条数与库一致（不再是三段常量）', `${landUi} / ${landDb}`)
  await clickByText(portal, '发布资源')
  await hasText(portal, '发布产业资源')
  await fillField(portal, '标题', `${MARKER} 40 亩水田流转`)
  await fillField(portal, '所在地', `${MARKER} 团头湖村`)
  await fillField(portal, '面积', '40')
  await fillField(portal, '价格', '520')
  await fillField(portal, '联系电话', '13800001234')
  await modalConfirm(portal)
  const resourceRow = scalar(`SELECT CONCAT(title,'#',IFNULL(merchant_id,0)) FROM agri_service.service_resource ORDER BY id DESC LIMIT 1`)
  check(String(resourceRow).endsWith(`#${MERCHANT_A}`), '资源发布归属令牌主体', resourceRow)
  check((await pageText(portal)).includes('我发布的'), '列表按主体标注"我发布的"')

  await navPortal(portal, '农技问诊')
  await hasText(portal, '可接诊专家')
  const expertDb = Number(scalar("SELECT COUNT(*) FROM agri_service.service_expert WHERE status='available'"))
  const expertUi = await portal.locator('.expert-card').count()
  check(expertUi === expertDb && expertDb > 0, '专家列表读 service_expert（不再是页面常量三位）', `${expertUi} / ${expertDb}`)
  await portal.locator('.expert-card').first().locator('button').filter({ hasText: cjk('图文问诊') }).click()
  await hasText(portal, '发起问诊')
  await fillField(portal, '问诊主题', `${MARKER} 叶片红褐色斑点`)
  await fillField(portal, '症状描述', '下部叶片出现红褐色斑点，近期连续阴雨。')
  await modalConfirm(portal)
  const consultRow = scalar(`SELECT CONCAT(IFNULL(expert_name,''),'#',IFNULL(merchant_id,0))
    FROM agri_service.service_consultation ORDER BY id DESC LIMIT 1`)
  check(String(consultRow).endsWith(`#${MERCHANT_A}`), '问诊记录归属本主体', consultRow)
  check(Boolean(String(consultRow).split('#')[0]) && String(consultRow).split('#')[0] !== 'undefined',
    '接诊人取自所选专家档案', String(consultRow).split('#')[0])

  await navPortal(portal, '服务合同')
  await hasText(portal, '服务合同要素')
  const hashCell = (await portal.locator('.contract-table-row .hash').first().innerText().catch(() => '')).replace('…', '')
  check(/^[0-9a-f]{16}$/.test(hashCell), '合同要素摘要按字段算出 SHA-256', hashCell)
  const contractDownload = portal.waitForEvent('download', { timeout: 15000 })
  await portal.locator('.contract-table-row').first().locator('button').filter({ hasText: cjk('下载要素清单') }).first().click()
  const contractFile = await contractDownload.catch(() => null)
  if (contractFile) {
    await contractFile.saveAs(path.join(OUT, `contract-${todayIso}.txt`))
    check(contractFile.suggestedFilename().startsWith('HT-FW'), '合同要素清单是真文件下载', contractFile.suggestedFilename())
  } else {
    check(false, '合同要素清单是真文件下载', '未触发下载')
  }

  await navPortal(portal, '需求大厅')
  await hasText(portal, '需求大厅')
  await pickOption(portal, '服务类型', '农机作业', '.demand-form-card')
  await fillField(portal, '需求标题', `${MARKER} 50 亩晚稻机收`, '.demand-form-card')
  await fillField(portal, '详细描述', `${MARKER} 需要履带式收割机`, '.demand-form-card')
  await fillField(portal, '服务地点', `${MARKER} 乔口镇`, '.demand-form-card')
  await fillField(portal, '面积', '50亩', '.demand-form-card')
  await fillField(portal, '最低预算', '55', '.demand-form-card')
  await fillField(portal, '联系电话', '13800001234', '.demand-form-card')
  const demandBefore = maxId('service_demand')
  await portal.locator('button').filter({ hasText: cjk('发布需求并智能匹配') }).first().click()
  await portal.waitForTimeout(1800)
  const demandCreated = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_demand WHERE id>${demandBefore}`))
  check(demandCreated === 1, '点"发布需求"真的新增了一条需求', `新增=${demandCreated}`)
  const formErrors = (await portal.locator('.ant-form-item-explain-error').allInnerTexts()).join(' / ')
  check(demandCreated === 1 && !formErrors, '发布表单没有未通过的必填项', formErrors.slice(0, 60))
  const demandRow = scalar(`SELECT CONCAT(category,'#',match_count,'#',IFNULL(merchant_id,0))
    FROM agri_service.service_demand WHERE id>${demandBefore} ORDER BY id DESC LIMIT 1`)
  const [demandCategory, demandMatch, demandMerchant] = String(demandRow).split('#')
  const expectMatch = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_provider
    WHERE status='available' AND category='${demandCategory}'`))
  check(demandMerchant === MERCHANT_A && Number(demandMatch) === expectMatch && expectMatch > 0,
    '匹配数=该类目在营服务商数（不再是标题哈希）', `${demandCategory}: 页=${demandMatch} 库=${expectMatch}`)

  await navPortal(portal, '农险服务')
  await hasText(portal, '在售险种')
  const productRow = scalar(`SELECT CONCAT(name,'#',premium_rate,'#',coverage_per_mu)
    FROM agri_service.insurance_product WHERE premium_rate>0 ORDER BY id LIMIT 1`)
  const [productName, rateText, perUnitText] = String(productRow).split('#')
  await portal.locator('.insurance-product-card').filter({ hasText: cjk(String(productName).slice(0, 6)) }).first()
    .locator('button').filter({ hasText: cjk('测算并投保') }).click()
  await hasText(portal, '测算并投保 ·')
  await fillField(portal, '投保数量', '20')
  await portal.waitForTimeout(600)
  const expectPremium = String(Number((Number(rateText) * 20).toFixed(2)))
  check((await pageText(portal)).includes(expectPremium), '弹窗按险种费率测算保费', `¥${rateText} × 20 = ${expectPremium}`)
  await modalConfirm(portal)
  const policyRow = scalar(`SELECT CONCAT(premium,'#',coverage_amount,'#',IFNULL(merchant_id,0))
    FROM agri_service.insurance_policy ORDER BY id DESC LIMIT 1`)
  const [policyPremium, policyCoverage, policyMerchant] = String(policyRow).split('#')
  check(policyMerchant === MERCHANT_A && Number(policyPremium) === Number(rateText) * 20
    && Number(policyCoverage) === Number(perUnitText) * 20,
    '保单保费与保额由服务端按费率实算并归属本主体', policyRow)

  await navPortal(portal, '消息中心')
  await hasText(portal, '消息')
  await clickByText(portal, '全部已读')
  const unreadANow = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND is_read=FALSE`))
  const unreadBNow = scalar(`SELECT COALESCE(GROUP_CONCAT(id),'') FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_B} AND is_read=FALSE`)
  check(unreadANow === 0, '一键已读清掉本主体未读')
  check(unreadBNow === restore.unreadB, '别家主体的未读不受影响', `B 未读=${unreadBNow || '无'}`)
  await portal.screenshot({ path: path.join(OUT, `portal-${todayIso}.png`) })

  /* ==================== B. 运营端 ==================== */
  const opsCtx = await browser.newContext({ viewport: { width: 1500, height: 980 }, acceptDownloads: true })
  const ops = await opsCtx.newPage()
  ops.on('pageerror', (e) => ops.url().includes(':8107') && opsErrors.push(String(e.message)))
  check(await ssoLogin(ops, OPS, 'admin'), '运营端 admin 登录成功回到 :8107')
  const opsHeader = await pageText(ops)
  check(opsHeader.includes(todayIso) && opsHeader.includes(weekday),
    '顶栏日期是今天（不再固定"2026-10-25 周日"）', `${todayIso} ${weekday}`)
  const todoSum = Number(scalar(`SELECT
    (SELECT COUNT(*) FROM agri_service.service_provider WHERE status='pending') +
    (SELECT COUNT(*) FROM agri_service.service_item WHERE audit_status='pending') +
    (SELECT COUNT(*) FROM agri_service.service_complaint WHERE status<>'resolved') +
    (SELECT COUNT(*) FROM agri_service.service_settlement WHERE status='pending') +
    (SELECT COUNT(*) FROM agri_service.service_policy_application WHERE status NOT IN ('paid','rejected')) +
    (SELECT COUNT(*) FROM agri_service.insurance_claim WHERE status NOT IN ('paid','closed')) +
    (SELECT COUNT(*) FROM agri_service.service_provider WHERE merchant_id IS NULL)`))
  const badgeText = await ops.locator('.ops-bell .ant-badge-count').first().innerText().catch(() => '0')
  check(Number(badgeText.replace('+', '')) === todoSum, '待办徽标=各项实数合计', `页面=${badgeText} 库=${todoSum}`)

  await navOps(ops, '入驻审核与列表')
  await hasText(ops, '服务商管理')
  const boundDb = Number(scalar('SELECT COUNT(*) FROM agri_service.service_provider WHERE merchant_id IS NOT NULL'))
  const boundUi = await ops.locator('.ant-table-row').filter({ hasText: cjk('已绑定') }).count()
  check(boundUi === Math.min(boundDb, 8), '"平台主体"列按真实绑定显示', `页=${boundUi} 库=${boundDb}`)
  await ops.locator('.ant-table-row').filter({ hasText: cjk(PROVIDER_NAME) }).first()
    .locator('button').filter({ hasText: cjk('主体绑定') }).click()
  await hasText(ops, '平台经营主体号')
  await fillField(ops, '平台经营主体号', '999999999999')
  await modalConfirm(ops)
  check((await toasts(ops)).includes('不存在'), '绑一个平台不存在的主体号被当场拒绝（不等登录时才炸）')
  await modalDismiss(ops)
  // 换一个"平台存在、但已挂在别家档案上"的主体号：建国农机已绑 2116774863340740609
  const otherProviderName = scalar(`SELECT name FROM agri_service.service_provider
    WHERE id<>${targetProviderId} AND merchant_id IS NULL ORDER BY id LIMIT 1`)
  check(Boolean(otherProviderName) && !String(otherProviderName).startsWith('ERR'),
    '找到一家尚未绑定主体的档案用于冲突用例', otherProviderName)
  // 表格分页只有 8 行，先用页面自己的搜索把目标行带到眼前，不去猜它在第几页
  await ops.locator('.ops-filter input').first().fill(String(otherProviderName))
  await clickByText(ops, '查询', '.ops-filter')
  await hasText(ops, String(otherProviderName))
  await ops.locator('.ant-table-row').filter({ hasText: cjk(String(otherProviderName)) }).first()
    .locator('button').filter({ hasText: cjk('主体绑定') }).click()
  await hasText(ops, '平台经营主体号')
  await fillField(ops, '平台经营主体号', PROVIDER_MERCHANT)
  await modalConfirm(ops)
  check((await toasts(ops)).includes('一个主体只能对应一家服务商'),
    '已被别家档案占用的主体号会被拒', `目标=${otherProviderName}`)
  await modalDismiss(ops)
  await ops.locator('.ops-filter input').first().fill('')
  await clickByText(ops, '查询', '.ops-filter')
  await hasText(ops, PROVIDER_NAME)
  await ops.locator('.ant-table-row').filter({ hasText: cjk(PROVIDER_NAME) }).first()
    .locator('button').filter({ hasText: cjk('主体绑定') }).click()
  await fillField(ops, '平台经营主体号', PROVIDER_MERCHANT)
  await modalConfirm(ops)
  await ops.waitForTimeout(900)
  check(scalar(`SELECT IFNULL(merchant_id,'') FROM agri_service.service_provider WHERE id=${targetProviderId}`) === PROVIDER_MERCHANT,
    '重复保存同一绑定仍然生效（幂等，便于纠错）')

  await navOps(ops, '品类与商品审核')
  await hasText(ops, '服务商品审核')
  await ops.locator('.ant-table-row').first().locator('button').filter({ hasText: cjk('审核') }).first().click()
  await hasText(ops, '商品审核')
  await modalConfirm(ops)
  check((await toasts(ops)).includes('请填写审核意见'), '不写意见无法审核（此前预填一句"已核验"）')
  await fillField(ops, '审核意见', `${MARKER} 材料与报价已核对`)
  const reasonBack = await ops.locator('.ant-modal-content:visible textarea').first().inputValue().catch(() => '<无可见弹窗>')
  const openModals = await ops.locator('.ant-modal-content:visible').count()
  check(reasonBack.includes(MARKER), '审核意见确实写进了当前可见弹窗的输入框', `${reasonBack} 可见弹窗=${openModals}`)
  await modalConfirm(ops)
  const reviewToast = await toasts(ops)
  const stillOpen = await ops.locator('.ant-modal-content:visible').count()
  const itemNow = scalar(`SELECT CONCAT(audit_status,'#',status) FROM agri_service.service_item WHERE id=${itemId}`)
  check(itemNow === 'approved#enabled', '通过后商品真正上架', `${itemNow} 弹窗=${stillOpen} toast=${reviewToast.slice(0, 50)}`)
  const itemLog = scalar(`SELECT CONCAT(operator_name,'#',ip_address) FROM agri_service.service_op_log
    WHERE action_name='服务商品审核' ORDER BY id DESC LIMIT 1`)
  check(String(itemLog).startsWith('admin'), '审核留痕的操作人来自登录令牌', itemLog)

  await navOps(ops, '全量订单')
  await hasText(ops, '全量订单')
  const dispatchRow = String(scalar(`SELECT CONCAT(id,'#',order_no) FROM agri_service.service_order
    WHERE merchant_id=${MERCHANT_A} AND status='confirmed' ORDER BY id DESC LIMIT 1`)
    .split('\n')[0]).split('#')
  const [dispatchOrderId, dispatchOrderNo] = dispatchRow
  check(Boolean(dispatchOrderId) && Number.isFinite(Number(dispatchOrderId)),
    '本轮有一张已确认订单可用于派单', dispatchOrderNo ?? '')
  await ops.locator('.ant-table-row').filter({ hasText: cjk(String(dispatchOrderNo)) }).first()
    .locator('button').filter({ hasText: cjk('派单') }).click()
  await hasText(ops, '指派服务商')
  await modalConfirm(ops)
  check((await toasts(ops)).includes('请点名目标服务商'), '不点名服务商无法派单（不再缺省给 1 号）')
  await pickOption(ops, '指派服务商', '绿翼飞防')
  await modalConfirm(ops)
  check((await toasts(ops)).includes('请填写派单说明'), '不写派单说明同样被拦')
  await fillField(ops, '派单说明', `${MARKER} 按机况改派`)
  await modalConfirm(ops)
  const dispatched = scalar(`SELECT CONCAT(provider_name,'#',dispatch_status) FROM agri_service.service_order WHERE id=${dispatchOrderId}`)
  check(dispatched === '绿翼飞防服务队#dispatched', '派单结果真正写库并通知下单主体', dispatched)

  await navOps(ops, '投诉与仲裁')
  await hasText(ops, '投诉与仲裁')
  await ops.locator('section.ops-card').filter({ hasText: 'TS20261023011' }).first()
    .locator('button').filter({ hasText: cjk('处理工单') }).click()
  await hasText(ops, '处理投诉')
  await modalConfirm(ops)
  check((await toasts(ops)).includes('请填写处理结论'), '空结论无法办结')
  await fillField(ops, '处理结论', `${MARKER} 返工并核减作业费用 ¥120`)
  await modalConfirm(ops)
  const complaintNow = scalar(`SELECT CONCAT(status,'#',IFNULL(handler,'')) FROM agri_service.service_complaint WHERE id=2`)
  check(complaintNow === 'resolved#admin', '办结状态与处理人都取真实登录账号', complaintNow)

  await navOps(ops, '结算与分账')
  await hasText(ops, '结算与分账')
  await ops.locator('.ant-table-row').filter({ hasText: 'ST20261023' }).first()
    .locator('button').filter({ hasText: cjk('复核') }).click()
  await hasText(ops, '结算批次复核')
  await modalConfirm(ops)
  check((await toasts(ops)).includes('请填写复核说明'), '结算复核必须写说明')
  await fillField(ops, '复核说明', `${MARKER} 抽查 20 笔无差异`)
  await modalConfirm(ops)
  const settleNow = scalar(`SELECT CONCAT(status,'#',reviewed_by) FROM agri_service.service_settlement WHERE id=1`)
  check(settleNow === 'approved#admin', '复核人与结论来自真实登录态（不再自称"刘结算"）', settleNow)

  await navOps(ops, '操作审计日志')
  await hasText(ops, '操作审计日志')
  const logDownloadPromise = ops.waitForEvent('download', { timeout: 15000 })
  await clickByText(ops, '导出当前日志', 'div.ops-page')
  const logFile = await logDownloadPromise.catch(() => null)
  if (logFile) {
    await logFile.saveAs(path.join(OUT, `op-log-${todayIso}.csv`))
    check(logFile.suggestedFilename().startsWith('service-op-log-'), '审计日志为真实 CSV 下载', logFile.suggestedFilename())
  } else {
    check(false, '审计日志为真实 CSV 下载', '未触发下载')
  }
  const topLog = scalar(`SELECT CONCAT(action_name,'#',operator_name) FROM agri_service.service_op_log ORDER BY id DESC LIMIT 1`)
  check(topLog.includes('#admin'), '最新一条日志操作人是 admin', topLog)
  await ops.screenshot({ path: path.join(OUT, `ops-${todayIso}.png`) })

  /* ==================== C. 移动端（服务商） ==================== */
  const mobileCtx = await browser.newContext({ viewport: { width: 420, height: 900 }, isMobile: true, hasTouch: true })
  const mobile = await mobileCtx.newPage()
  mobile.on('pageerror', (e) => mobile.url().includes(':8106') && mobileErrors.push(String(e.message)))
  const homeText = await uniLogin(mobile, 'provider')
  check(!mobile.url().includes('pages/login'), '移动端 provider 登录成功离开登录页', homeText.slice(0, 40))

  check(await openMobile(mobile, '/pages/workbench/index', '当前服务身份'), '服务商工作台页面进入')
  const wbText = await pageText(mobile)
  check(wbText.includes(PROVIDER_NAME), '工作台身份由令牌解析（URL 与请求里都没有 providerId）',
    wbText.match(/当前服务身份[^\n]{0,24}/)?.[0] ?? '')
  check(!wbText.includes('今日接单率'), '假指标"今日接单率 96%"已移除')
  const myOrdersDb = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_order WHERE provider_id=${targetProviderId}`))
  check(wbText.includes(String(myOrdersDb)), '累计工单数与库一致', `库=${myOrdersDb}`)
  const poolLines = (await mobile.locator('.grab-card .tiny').allInnerTexts()).filter((line) => line.includes('需求方'))
  check(poolLines.every((line) => line.includes('****')),
    '抢单池里的需求方号码已脱敏', poolLines[0] ?? '池内暂无需求')

  const grabbable = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_demand d
    JOIN agri_service.service_provider p ON p.category=d.category AND p.id=${targetProviderId}
    WHERE d.status='matching' AND d.accepted_provider_id IS NULL`))
  if (grabbable > 0) {
    await mobile.locator('.grab-card').first().locator('uni-button, button').filter({ hasText: cjk('抢单') }).click()
    await mobile.waitForTimeout(1000)
    await mobile.locator('.uni-modal__btn').filter({ hasText: '确定' }).first().click().catch(() => {})
    await mobile.waitForTimeout(2000)
    const accepted = scalar(`SELECT CONCAT(status,'#',IFNULL(accepted_provider_name,'')) FROM agri_service.service_demand
      WHERE accepted_provider_id=${targetProviderId} ORDER BY id DESC LIMIT 1`)
    check(String(accepted) === `accepted#${PROVIDER_NAME}`, '抢单后需求真正指派给本服务商', accepted)
    const newestRow = scalar(`SELECT CONCAT(order_no,'#',provider_name,'#',status) FROM agri_service.service_order
      WHERE provider_id=${targetProviderId} ORDER BY id DESC LIMIT 1`)
    const newestOrderNo = String(newestRow).split('#')[0]
    check(String(newestRow).includes(PROVIDER_NAME) && String(newestRow).endsWith('#confirmed'),
      '抢单同时生成工单', newestRow)
    const progressBefore = Number(scalar(`SELECT progress FROM agri_service.service_order WHERE order_no='${newestOrderNo}'`))
    await openMobile(mobile, '/pages/workbench/index', '进行中工单')
    // 工单卡片按到期日排序，未必刚好是刚抢的那一张；用单号锁定同一张，才不会拿别家的进度来比
    await mobile.locator('.work-order').filter({ hasText: cjk(newestOrderNo) }).first()
      .locator('uni-button, button').filter({ hasText: cjk('上报服务进度') }).click()
    await mobile.waitForTimeout(2000)
    const progressAfter = scalar(`SELECT CONCAT(progress,'#',status) FROM agri_service.service_order
      WHERE order_no='${newestOrderNo}'`)
    check(Number(String(progressAfter).split('#')[0]) > progressBefore,
      '上报进度真实写库（进度只前进）', `${progressBefore} → ${progressAfter}`)
  } else {
    check(false, '抢单与上报进度', '当前没有同品类可抢需求（先跑 provision 与种子）')
  }

  check(await openMobile(mobile, '/pages/profile/index', '全部订单'), '"我的"页面进入')
  // 身份那一行要等 /identity 回来；"全部订单"这个标签是同步渲染的，只等它会读到半成品
  await hasText(mobile, '服务商身份', 8000).catch(() => {})
  await mobile.waitForTimeout(600)
  const profileText = await pageText(mobile)
  check(profileText.includes('服务商身份'), '"我的"显示令牌解析出的服务商身份',
    profileText.match(/(服务商身份|消费者身份)：?\S{0,16}/)?.[0] ?? profileText.slice(0, 60))
  const orderCountDb = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_order WHERE merchant_id=${PROVIDER_MERCHANT}`))
  // 服务商账号只有 service:provider，消费侧计数拿不到时应说明原因，而不是整页空白
  const consumerDenied = profileText.includes('没有消费侧权限')
  check(consumerDenied || profileText.includes(String(orderCountDb)),
    '"我的"订单计数：有权限时对得上库，无权限时给出原因',
    consumerDenied ? '已按权限降级说明' : `库=${orderCountDb}`)
  check(!profileText.includes('在线客服') && !profileText.includes('关怀模式'),
    '无效菜单（在线客服/关怀模式等点不动的项）已移除')
  await mobile.screenshot({ path: path.join(OUT, `mobile-${todayIso}.png`) })

  /* ==================== D. 控制台错误 ==================== */
  check(desktopErrors.length === 0, '用户端无页面脚本错误', desktopErrors.slice(0, 2).join(' | '))
  check(opsErrors.length === 0, '运营端无页面脚本错误', opsErrors.slice(0, 2).join(' | '))
  check(mobileErrors.length === 0, '移动端无页面脚本错误', mobileErrors.slice(0, 2).join(' | '))

  /* ==================== E. 清理与还原 ==================== */
  exec(`USE agri_service;
    DELETE e FROM service_order_event e JOIN service_order o ON o.id=e.order_id WHERE o.id>${before.order}`)
  for (const [table, snapshot] of Object.entries({
    service_order: before.order, service_demand: before.demand, service_consultation: before.consultation,
    insurance_policy: before.policy, service_enrollment: before.enrollment, service_resource: before.resource,
    service_favorite: before.favorite, service_message: before.message, service_op_log: before.log,
    service_provider: before.provider,
  })) {
    exec(`DELETE FROM agri_service.${table} WHERE id>${snapshot}`)
  }
  if (restore.itemBefore && !String(restore.itemBefore).startsWith('ERR')) {
    exec(`USE agri_service; UPDATE service_item SET audit_status=${part(restore.itemBefore, 1)},
      status=${part(restore.itemBefore, 2)} WHERE id=${itemId}`)
  }
  if (restore.settlementBefore && !String(restore.settlementBefore).startsWith('ERR')) {
    exec(`USE agri_service; UPDATE service_settlement SET status=${part(restore.settlementBefore, 1)},
      reviewed_by=NULLIF(${part(restore.settlementBefore, 2)},''),
      reviewed_at=NULLIF(${part(restore.settlementBefore, 3)},'') WHERE id=1`)
  }
  if (restore.complaintBefore && !String(restore.complaintBefore).startsWith('ERR')) {
    exec(`USE agri_service; UPDATE service_complaint SET status=${part(restore.complaintBefore, 1)},
      progress=${part(restore.complaintBefore, 2)}, handler=NULLIF(${part(restore.complaintBefore, 3)},''),
      resolution=NULLIF(${part(restore.complaintBefore, 4)},'') WHERE id=2`)
  }
  exec(`USE agri_service; UPDATE service_provider SET merchant_id=NULLIF('${restore.provider1Merchant}','') WHERE id=1`)
  exec(`USE agri_service; UPDATE service_message SET is_read=FALSE WHERE FIND_IN_SET(id,'${restore.unreadA}')>0`)
  exec(`USE agri_service; UPDATE service_message SET is_read=FALSE WHERE FIND_IN_SET(id,'${restore.unreadB}')>0`)

  const residue = {}
  for (const [table, snapshot] of Object.entries(before)) {
    residue[table] = Number(scalar(`SELECT COUNT(*) FROM agri_service.${
      { order: 'service_order', demand: 'service_demand', message: 'service_message', log: 'service_op_log',
        consultation: 'service_consultation', policy: 'insurance_policy', enrollment: 'service_enrollment',
        resource: 'service_resource', favorite: 'service_favorite', provider: 'service_provider' }[table]
    } WHERE id>${snapshot}`))
  }
  residue.markerAnywhere = Number(scalar(`SELECT
    (SELECT COUNT(*) FROM agri_service.service_order WHERE service_name LIKE '%${MARKER}%' OR notes LIKE '%${MARKER}%') +
    (SELECT COUNT(*) FROM agri_service.service_resource WHERE title LIKE '%${MARKER}%') +
    (SELECT COUNT(*) FROM agri_service.service_demand WHERE service_name LIKE '%${MARKER}%') +
    (SELECT COUNT(*) FROM agri_service.service_consultation WHERE subject LIKE '%${MARKER}%')`))
  check(Object.values(residue).every((value) => value === 0), '清理后本轮临时数据残留为 0', JSON.stringify(residue))
  check(scalar(`SELECT IFNULL(merchant_id,'') FROM agri_service.service_provider WHERE id=1`) === restore.provider1Merchant,
    '服务商绑定已还原', `merchant=${restore.provider1Merchant}`)
  check(scalar(`SELECT CONCAT(audit_status,'#',status) FROM agri_service.service_item WHERE id=${itemId}`) === restore.itemBefore,
    '被审核商品的原始状态已还原', restore.itemBefore)
  check(scalar(`SELECT CONCAT(status,'#',IFNULL(reviewed_by,''),'#',IFNULL(reviewed_at,'')) FROM agri_service.service_settlement WHERE id=1`)
    === restore.settlementBefore, '结算批次原始状态已还原', restore.settlementBefore)
  check(scalar(`SELECT CONCAT(status,'#',progress,'#',IFNULL(handler,''),'#',IFNULL(resolution,'')) FROM agri_service.service_complaint WHERE id=2`)
    === restore.complaintBefore, '投诉工单原始状态已还原', restore.complaintBefore)
} catch (error) {
  check(false, '点检过程抛出异常', String(error?.message ?? error).slice(0, 220))
} finally {
  await browser.close().catch(() => {})
}

console.log(`\n浏览器点检完成：${failures.length === 0 ? '全部通过' : `失败 ${failures.length} 项`}`)
failures.forEach((item) => console.log(`  - ${item}`))
process.exit(failures.length === 0 ? 0 : 1)
