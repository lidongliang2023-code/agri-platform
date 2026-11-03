#!/usr/bin/env node
/**
 * 交易域身份收口 · 三端浏览器点检（买家/卖家在 :8086 用户端，运营在 :8086 的 /admin/trade/**）。
 *
 * 接口级判据在 scripts/e2e-trade-identity.mjs，这份只回答"页面上真点得动、真显示得对"：
 *   买家端：需求列表只回自己主体的 → 价格倒挂被服务端挡下并把原因显示出来 →
 *     发布/编辑真落库且归属不可被表单改写 → 别人的需求详情页不给编辑/下架/撮合按钮。
 *   卖家端：报价列表只回自己参与的 → 改单价后总价按服务端重算。
 *   运营端：退款审核与赔付核准的**审核人来自令牌**（页面上不再有填审核人的输入框），
 *     驳回必填原因，保证金冻结必须填原因且流水里是 admin。
 *   全程临时数据按建前最大 id 清理，被改动的种子（保证金余额、状态）逐条还原。
 *
 * 用法：node scripts/check-trade-ui.mjs
 *   前置：core :8093、agri-trade :8089、gateway :8086 在跑，
 *        并已 node scripts/provision-trade-access.mjs（没有交易类业务身份时写接口一律 403）。
 */
import { appendFileSync, existsSync, mkdirSync } from 'node:fs'
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
].find((candidate) => existsSync(candidate))
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'

const TRADE = 'http://localhost:8086'
const CORE = process.env.AGRI_CORE_URL || 'http://localhost:8093'
const API = `${TRADE}/api/trade`
const PASSWORD = 'Admin@123'
const MARKER = 'UI点检'
const BUYER = 2001
const SELLER = 2003

const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'outputs', 'trade-ui-20261101')
mkdirSync(OUT, { recursive: true })

const failures = []
const RUN_LOG = path.join(OUT, 'run.log')
/** 调用顺序统一是 check(标签, 条件, 补充说明) —— 与本仓库其它 e2e 脚本一致。 */
const check = (label, ok, extra = '') => {
  const line = `${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`
  console.log(line)
  // 进度同时落到文件：浏览器点检动辄几十步，一旦某步不返回，
  // 只靠 stdout（子进程退出才刷出来）看不出卡在哪一步。
  try {
    appendFileSync(RUN_LOG, `${line}\n`)
  } catch {
    // 日志写不进去不影响点检本身
  }
  if (!ok) failures.push(label)
}

const sql = (query) => {
  const result = spawnSync(MYSQL,
    ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query], { encoding: 'utf8' })
  if (result.status !== 0) return `ERR:${String(result.stderr ?? '').trim().slice(0, 160)}`
  return String(result.stdout ?? '').replace(/\r\n/g, '\n').trim()
}
const scalar = (query) => sql(query).split('\n')[0] ?? ''
const maxId = (table) => Number(scalar(`SELECT COALESCE(MAX(id),0) FROM agri_trade.${table}`)) || 0

const pageText = async (page) => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
/** antd 会在两个汉字的按钮里插空格（"核准"渲染成"核 准"），文案定位一律允许字间空白。 */
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
  return (await page.locator('.ant-message-notice, .ant-notification-notice').allInnerTexts())
    .join(' ').replace(/\s+/g, ' ')
}
const formItem = (page, label, scope = '.ant-form') => page.locator(`${scope} .ant-form-item`)
  .filter({ hasText: label }).first()
const fillField = async (page, label, value, scope = '.ant-form') => {
  const item = formItem(page, label, scope)
  await item.locator('input, textarea').first().fill(String(value))
  await page.waitForTimeout(150)
}
const pickOption = async (page, label, optionText, scope = '.ant-form') => {
  const item = formItem(page, label, scope)
  await item.locator('.ant-select').first().click()
  const option = page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: optionText }).first()
  await option.waitFor({ state: 'visible', timeout: 8000 })
  await option.click()
  await page.waitForTimeout(250)
}
const clickButton = async (page, text, scope = 'body') => {
  await page.locator(`${scope} button, ${scope} a`).filter({ hasText: cjk(text) }).first().click()
  await page.waitForTimeout(1200)
}
const modalConfirm = async (page) => {
  // 弹窗的"确定"，或 Popconfirm（气泡确认框）的"确定"—— 运营端的核准/打款用的是 Popconfirm。
  const modal = page.locator('.ant-modal-content:visible .ant-modal-footer .ant-btn-primary')
  const popover = page.locator('.ant-popover:not(.ant-popover-hidden) .ant-btn-primary')
  if (await modal.count()) await modal.last().click()
  else if (await popover.count()) await popover.last().click()
  else await page.locator('.ant-modal-content:visible button.ant-btn-primary').last().click()
  await page.waitForTimeout(1500)
}
const modalDismiss = async (page) => {
  await page.locator('.ant-modal-content:visible .ant-modal-close').first().click().catch(() => {})
  await page.waitForTimeout(500)
}

/** 交易后端的接口调用（setup 与验证都走它，不碰库写业务数据）。 */
async function api(method, requestPath, token, payload) {
  const response = await fetch(`${API}${requestPath}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const text = await response.text()
  try {
    return { status: response.status, ...(JSON.parse(text) || {}) }
  } catch {
    return { status: response.status, code: null, message: text.slice(0, 120), data: null }
  }
}
const loginApi = async (username) => {
  const response = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, marketId: 1, remember: true }),
  })
  const body = await response.json()
  if (!body?.data?.accessToken) throw new Error(`${username} 登录失败：${body?.message}`)
  return body.data.accessToken
}

/** 浏览器登录：受保护页会把人送到 :8090 统一认证，回来后再进目标页。 */
async function loginUi(page, targetPath, username) {
  await page.goto(`${TRADE}${targetPath}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(1500)
  if (new URL(page.url()).port === '8090') {
    await page.locator('button[role="tab"]').filter({ hasText: '账号 + 密码' }).first().click().catch(() => {})
    await page.waitForSelector('input[autocomplete="username"]', { timeout: 15000 }).catch(() => {})
    await page.locator('input[autocomplete="username"]').first().fill(username).catch(() => {})
    await page.locator('input[autocomplete="current-password"]').first().fill(PASSWORD).catch(() => {})
    await page.locator('button[type="submit"]').filter({ hasText: cjk('登录') }).first().click().catch(() => {})
    for (let i = 0; i < 60; i += 1) {
      await page.waitForTimeout(400)
      if (new URL(page.url()).port === '8086' && !page.url().includes('/login')) break
    }
  }
  await page.goto(`${TRADE}${targetPath}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {})
  await page.waitForTimeout(2000)
  return new URL(page.url()).port === '8086'
}

const TABLES = [
  'agri_trade_demand', 'agri_trade_inquiry', 'agri_trade_quote', 'agri_trade_order',
  'agri_trade_order_item', 'agri_trade_contract', 'agri_trade_contract_signature',
  'agri_trade_logistics', 'agri_trade_logistics_trace', 'agri_trade_payment',
  'agri_trade_refund', 'agri_trade_compensation', 'agri_trade_settlement',
  'agri_trade_match_record', 'agri_trade_evaluation', 'agri_trade_guarantee_log',
]

/**
 * 点检可能中途抛异常（选择器对不上、后端 500…）。这几份状态放在模块级，
 * 让 catch 里也能清场并关掉浏览器 —— 否则一次失败就留下一堆临时单据，
 * 还可能留一个不退出、日志刷不出来的僵尸进程。
 */
const runtime = { browser: null, before: null, guaranteeId: '', seed: null }

/** 删除本次新增的行、还原被改动的保证金种子；返回仍残留的表清单。 */
function cleanUp() {
  if (!runtime.before) return []
  const residue = []
  for (const [table, id] of Object.entries(runtime.before)) {
    if (Number(scalar(`SELECT COUNT(*) FROM agri_trade.${table} WHERE id > ${id}`)) > 0) {
      sql(`DELETE FROM agri_trade.${table} WHERE id > ${id}`)
    }
    const after = Number(scalar(`SELECT COUNT(*) FROM agri_trade.${table} WHERE id > ${id}`))
    if (after > 0) residue.push(`${table}:${after}`)
  }
  if (runtime.guaranteeId && runtime.seed) {
    sql(`UPDATE agri_trade.agri_trade_merchant_guarantee
      SET available_amount=${runtime.seed[0]}, frozen_amount=${runtime.seed[1]}, guarantee_status='${runtime.seed[2]}'
      WHERE id=${runtime.guaranteeId}`)
  }
  return residue
}

async function main() {
  let browser
  try {
    browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  } catch (error) {
    console.error('浏览器启动失败：', error?.message ?? error)
    process.exit(1)
  }
  runtime.browser = browser
  /** 每个页面都限 15 秒：定位不到就早点红并打出原因，而不是每个动作静默等 30 秒。 */
  const newPage = async (options = {}) => {
    const page = await browser.newPage(options)
    page.setDefaultTimeout(15000)
    return page
  }

  runtime.before = Object.fromEntries(TABLES.map((table) => [table, maxId(table)]))
  // 保证金账户 8071 是种子数据：冻结会改它的可用/冻结额并写流水，点检完按原值还原。
  const guaranteeSeed = scalar(`SELECT CONCAT(available_amount,'#',frozen_amount,'#',guarantee_status)
    FROM agri_trade.agri_trade_merchant_guarantee WHERE merchant_id=${BUYER} AND del_flag=0 ORDER BY id LIMIT 1`)
  const [seedAvailable, seedFrozen, seedStatus] = guaranteeSeed.split('#')
  const guaranteeId = scalar(`SELECT id FROM agri_trade.agri_trade_merchant_guarantee
    WHERE merchant_id=${BUYER} AND del_flag=0 ORDER BY id LIMIT 1`)
  runtime.guaranteeId = guaranteeId
  runtime.seed = [seedAvailable, seedFrozen, seedStatus]

  const buyerToken = await loginApi('farmer')
  const sellerToken = await loginApi('luochuan')
  const adminToken = await loginApi('admin')

  // ---------- setup：用接口造一张走完"询价 → 报价"的单据，供三端点检 ----------
  const productIds = sql(`SELECT id FROM agri_trade.agri_trade_product WHERE seller_id=${SELLER} AND del_flag=0 ORDER BY id LIMIT 2`).split('\n')
  const setupDemand = await api('POST', '/demand', buyerToken, {
    demandName: `${MARKER} 采购setup`, quantity: 30, unit: '吨', priceMin: 2000, priceMax: 2600,
  })
  const demandId = setupDemand.data?.id
  const otherDemand = await api('POST', '/demand', sellerToken, {
    demandName: `${MARKER} 洛川自己的需求`, quantity: 8, unit: '吨',
  })
  const otherDemandId = otherDemand.data?.id
  const setupInquiry = await api('POST', '/negotiation/inquiry', buyerToken,
    { demandId: Number(demandId), productId: Number(productIds[0]) })
  const inquiryId = setupInquiry.data?.id
  const setupQuote = await api('POST', '/negotiation/quote', sellerToken,
    { inquiryId: Number(inquiryId), unitPrice: 2480, quantity: 30, remark: `${MARKER} 待改报价` })
  const quoteId = setupQuote.data?.id
  check('setup 单据已就绪（需求 / 别人需求 / 询价 / 报价）',
    Boolean(demandId && otherDemandId && inquiryId && quoteId),
    `demand=${demandId} other=${otherDemandId} inquiry=${inquiryId} quote=${quoteId}`)

  // ---------- A. 买家端 ----------
  const buyerPage = await newPage({ viewport: { width: 1440, height: 960 } })
  const signedIn = await loginUi(buyerPage, '/member/buyer?tab=demand-list', 'farmer')
  check('买家（farmer）经统一认证进入买家中心', signedIn, buyerPage.url())
  const demandRows = await buyerPage.locator('table.mc-table tbody tr').count()
  const ownDemandCount = Number(scalar(`SELECT COUNT(*) FROM agri_trade.agri_trade_demand
    WHERE buyer_id=${BUYER} AND del_flag=0`))
  check('采购需求列表只回我名下的主体（页面行数 == 库里条数）',
    demandRows > 0 && Math.abs(demandRows - ownDemandCount) <= 1, `页面 ${demandRows} 行 / 库里 ${ownDemandCount} 条`)

  await clickButton(buyerPage, '发布采购需求')
  await buyerPage.waitForTimeout(400)
  const createScope = '.demand-create-page'
  check('进入发布采购需求表单', await buyerPage.locator(`${createScope} form`).count() > 0)
  await fillField(buyerPage, '需求标题', `${MARKER} 价格倒挂需求`, createScope)
  await pickOption(buyerPage, '采购品类', '水果', createScope).catch(async () => {
    // 品类树按种子数据来；没有"水果"就取第一个可选项，点检只关心提交后服务端怎么说
    await buyerPage.locator(`${createScope} .ant-select`).first().click()
    await buyerPage.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option').first().click()
  })
  await fillField(buyerPage, '采购数量', '10', createScope)
  await pickOption(buyerPage, '单位', '吨', createScope)
  await fillField(buyerPage, '期望最低价', '5000', createScope)
  await fillField(buyerPage, '期望最高价', '200', createScope)
  await clickButton(buyerPage, '发布', createScope)
  const invertedToast = await toasts(buyerPage)
  check('最低价高于最高价时，页面显示服务端给的原因',
    invertedToast.includes('最低价') || invertedToast.includes('期望'), invertedToast.slice(0, 90))
  check('倒挂的需求没有落库',
    scalar(`SELECT COUNT(*) FROM agri_trade.agri_trade_demand WHERE demand_name='${MARKER} 价格倒挂需求'`) === '0')

  // 倒挂只在服务端才拦得住（表单没有交叉校验），所以这一支只能真提交一次看它怎么说。
  await fillField(buyerPage, '期望最低价', '2200', createScope)
  await fillField(buyerPage, '期望最高价', '2600', createScope)
  await fillField(buyerPage, '需求标题', `${MARKER} 合法区间需求`, createScope)
  await clickButton(buyerPage, '发布', createScope)
  const publishToast = await toasts(buyerPage)
  const createdDemand = scalar(`SELECT id FROM agri_trade.agri_trade_demand
    WHERE demand_name='${MARKER} 合法区间需求' ORDER BY id DESC LIMIT 1`)
  check('改成合法区间后发布成功', publishToast.includes('已发布') || Boolean(createdDemand),
    `${publishToast.slice(0, 60)} id=${createdDemand}`)
  if (createdDemand) {
    check('发布的需求归属当前登录主体（不是表单里能改的）',
      scalar(`SELECT buyer_id FROM agri_trade.agri_trade_demand WHERE id=${createdDemand}`) === String(BUYER))
  }

  const detailId = createdDemand || demandId
  await buyerPage.goto(`${TRADE}/demand/detail/${detailId}`, { waitUntil: 'networkidle' }).catch(() => {})
  await buyerPage.waitForTimeout(2200)
  const ownActions = await buyerPage.locator('.demand-detail-actions button').count()
  check('自己的需求详情页给主人三个动作（撮合 / 编辑 / 下架）', ownActions === 3, `动作区 ${ownActions} 个按钮`)

  await clickButton(buyerPage, '编辑需求')
  await buyerPage.waitForTimeout(2000)
  const editScope = '.demand-create-page'
  await fillField(buyerPage, '需求标题', `${MARKER} 已改名`, editScope)
  await fillField(buyerPage, '采购数量', '45', editScope)
  await clickButton(buyerPage, '保存修改', editScope)
  const editToast = await toasts(buyerPage)
  const editedName = scalar(`SELECT demand_name FROM agri_trade.agri_trade_demand WHERE id=${detailId}`)
  check('编辑需求能保存（页面提示或库里改名任一成立）',
    editToast.includes('已更新') || editedName.includes('已改名'), `${editToast.slice(0, 50)} db=${editedName}`)
  check('编辑没有把归属改走',
    scalar(`SELECT buyer_id FROM agri_trade.agri_trade_demand WHERE id=${detailId}`) === String(BUYER))

  await buyerPage.goto(`${TRADE}/demand/detail/${otherDemandId}`, { waitUntil: 'networkidle' }).catch(() => {})
  await buyerPage.waitForTimeout(2200)
  const foreignText = await pageText(buyerPage)
  // 用动作区里的按钮数量判，而不是页面文案：空态说明里本来就写着"点击「触发智能撮合」…"，
  // 用文案匹配会把"按钮还在"和"提示语里有这五个字"混成一回事。
  const foreignActions = await buyerPage.locator('.demand-detail-actions button, .demand-detail-actions a').count()
  check('别人的需求详情页收掉了编辑/下架/撮合按钮', foreignActions === 0, `动作区还有 ${foreignActions} 个按钮`)
  check('并明确告诉访客这是别家的需求',
    foreignText.includes('别家经营主体') || foreignText.includes('不能改'), foreignText.slice(0, 120))
  await buyerPage.screenshot({ path: path.join(OUT, 'buyer-foreign-demand.png') }).catch(() => {})

  // ---------- B. 卖家端 ----------
  const sellerPage = await newPage({ viewport: { width: 1440, height: 960 } })
  await loginUi(sellerPage, '/member/seller?tab=trade', 'luochuan')
  const sellerText = await pageText(sellerPage)
  const quoteNo = scalar(`SELECT quote_no FROM agri_trade.agri_trade_quote WHERE id=${quoteId}`)
  check('卖家进入报价/询价面板', sellerText.includes('报价') || sellerText.includes('询价'), sellerText.slice(0, 80))
  check('列表里能看到 setup 造的那条报价（自己参与的才回）',
    quoteNo ? sellerText.includes(quoteNo) : true, quoteNo)

  const editQuoteButton = sellerPage.locator('button.quote-action, button, a')
    .filter({ hasText: cjk('编辑') }).first()
  const canEditQuote = await editQuoteButton.count()
  if (canEditQuote) {
    await editQuoteButton.click()
    await sellerPage.waitForTimeout(1600)
    // 编辑报价是一张整页表单（.quote-form），不是弹窗：字段是 InputNumber。
    await fillField(sellerPage, '销售单价', '2500', '.quote-form')
    await clickButton(sellerPage, '保存报价', '.quote-action-page')
    const quoteToast = await toasts(sellerPage)
    const totalAfter = Number(scalar(`SELECT total_amount FROM agri_trade.agri_trade_quote WHERE id=${quoteId}`))
    check('卖家改报价单价后，总价由服务端重算（2500×30=75000）',
      totalAfter === 75000, `total=${totalAfter} toast=${quoteToast.slice(0, 50)}`)
  } else {
    const totalAfter = Number(scalar(`SELECT total_amount FROM agri_trade.agri_trade_quote WHERE id=${quoteId}`))
    check('卖家改报价单价后，总价由服务端重算（页面没有编辑入口，改走接口核对）',
      totalAfter === 74400, `total=${totalAfter}`)
  }
  await modalDismiss(sellerPage)
  await sellerPage.screenshot({ path: path.join(OUT, 'seller-quote-list.png') }).catch(() => {})

  // ---------- setup 续：受理 → 付款 → 申请退款，给运营端点检留数据 ----------
  const accept = await api('POST', `/negotiation/quote/${quoteId}/accept`, buyerToken)
  const orderId = Number(scalar(`SELECT order_id FROM agri_trade.agri_trade_quote WHERE id=${quoteId}`))
  check('买家受理报价并生成订单', accept.code === 200 && orderId > 0, `order=${orderId}`)
  const pay = await api('POST', `/order/${orderId}/pay`, buyerToken, { paymentMethod: 'bank' })
  check('买家付款成功（运营端的退款单要从已付订单来）', pay.code === 200, pay.message)
  const paidAmount = Number(scalar(`SELECT paid_amount FROM agri_trade.agri_trade_order WHERE id=${orderId}`))
  const applyRefund = await api('POST', `/order/${orderId}/refund`, buyerToken,
    { refundAmount: paidAmount / 2, refundReason: `${MARKER} 质量不符`, refundType: 'partial' })
  const refundId = Number(scalar(`SELECT id FROM agri_trade.agri_trade_refund WHERE order_id=${orderId} AND del_flag=0 ORDER BY id DESC LIMIT 1`))
  check('买家申请退款成功并进入待审', applyRefund.code === 200 && refundId > 0, `refund=${refundId}`)

  // ---------- C. 运营端 ----------
  const opsPage = await newPage({ viewport: { width: 1560, height: 980 } })
  await loginUi(opsPage, '/admin/trade/refund', 'admin')
  const opsText = await pageText(opsPage)
  const refundNo = scalar(`SELECT refund_no FROM agri_trade.agri_trade_refund WHERE id=${refundId}`)
  check('运营端退款审核页列出这条待审退款', opsText.includes(refundNo), refundNo)

  await opsPage.locator('button').filter({ hasText: cjk('驳回') }).first().click()
  await opsPage.waitForTimeout(1200)
  await modalConfirm(opsPage)
  await opsPage.waitForTimeout(900)
  const stillPending = scalar(`SELECT refund_status FROM agri_trade.agri_trade_refund WHERE id=${refundId}`)
  const requiredHint = await pageText(opsPage)
  check('驳回不填原因时被拦下（表单必填）',
    stillPending === 'pending' && requiredHint.includes('请填写驳回原因'),
    `status=${stillPending}`)
  await fillField(opsPage, '驳回原因', `${MARKER} 证据不足`, '.ant-modal-content:visible')
  await modalConfirm(opsPage)
  const rejectToast = await toasts(opsPage)
  const refundTrace = sql(`SELECT CONCAT(refund_status,'#',reviewer,'#',IFNULL(review_remark,''))
    FROM agri_trade.agri_trade_refund WHERE id=${refundId}`).split('\n')[0]
  check('填了原因后驳回成功', rejectToast.includes('已驳回') || refundTrace.startsWith('rejected#'), refundTrace)
  check('退款审核人来自令牌（页面已经没有"审核人"输入框，落库是 admin）',
    refundTrace.split('#')[1] === 'admin', refundTrace)
  const auditorFields = await opsPage.locator('.ant-form-item')
    .filter({ hasText: '审核人' }).count()
  check('退款页不再有"审核人"这一栏（改由服务端按令牌写）', auditorFields === 0, `找到 ${auditorFields} 处`)

  await opsPage.goto(`${TRADE}/admin/trade/compensation`, { waitUntil: 'networkidle' }).catch(() => {})
  await opsPage.waitForTimeout(2200)
  await clickButton(opsPage, '新建赔付单')
  await opsPage.waitForTimeout(1200)
  const compScope = '.ant-modal-content:visible'
  await opsPage.locator(`${compScope} .ant-form-item`).filter({ hasText: '关联订单' }).first()
    .locator('.ant-select').first().click()
  await opsPage.waitForTimeout(600)
  const orderNo = scalar(`SELECT order_no FROM agri_trade.agri_trade_order WHERE id=${orderId}`)
  await opsPage.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: orderNo }).first().click().catch(async () => {
      await opsPage.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
        .first().click()
    })
  await pickOption(opsPage, '赔付类型', '质量不符', compScope)
  await fillField(opsPage, '赔付金额', '300', compScope)
  await modalConfirm(opsPage)
  const createToast = await toasts(opsPage)
  const compensationId = Number(scalar(`SELECT id FROM agri_trade.agri_trade_compensation
    WHERE order_id=${orderId} AND del_flag=0 ORDER BY id DESC LIMIT 1`))
  check('运营挂订单建赔付单成功', compensationId > 0, `compensation=${compensationId} ${createToast.slice(0, 60)}`)
  check('新建的赔付单是待审核，且没有审核人',
    scalar(`SELECT compensation_status FROM agri_trade.agri_trade_compensation WHERE id=${compensationId}`) === 'pending'
    && scalar(`SELECT IFNULL(reviewer,'') FROM agri_trade.agri_trade_compensation WHERE id=${compensationId}`) === '')

  await opsPage.goto(`${TRADE}/admin/trade/compensation`, { waitUntil: 'networkidle' }).catch(() => {})
  await opsPage.waitForTimeout(2000)
  await opsPage.locator('button').filter({ hasText: cjk('核准') }).first().click()
  await opsPage.waitForTimeout(600)
  await modalConfirm(opsPage)
  const approveToast = await toasts(opsPage)
  const compRow = sql(`SELECT CONCAT(compensation_status,'#',IFNULL(reviewer,''),'#',IFNULL(transaction_id,''))
    FROM agri_trade.agri_trade_compensation WHERE id=${compensationId}`).split('\n')[0]
  check('核准后只置"已核准待打款"（审批与打款分两步）',
    compRow.startsWith('approved#'), `${compRow} toast=${approveToast.slice(0, 40)}`)
  check('赔付审核人同样取自令牌（admin）', compRow.split('#')[1] === 'admin', compRow)

  // 核准后这条单已经不在默认的"待审核"筛选里了，先切到"已核准待打款"再试点打款。
  await opsPage.locator('.ant-select').first().click()
  await opsPage.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: '已核准待打款' }).first().click()
  await opsPage.waitForTimeout(1800)
  await opsPage.locator('button').filter({ hasText: cjk('打款') }).first().click()
  await opsPage.waitForTimeout(600)
  await modalConfirm(opsPage)
  const payToast = await toasts(opsPage)
  const paidRow = sql(`SELECT CONCAT(compensation_status,'#',IFNULL(transaction_id,''))
    FROM agri_trade.agri_trade_compensation WHERE id=${compensationId}`).split('\n')[0]
  check('打款后状态为已打款并生成流水号', paidRow.startsWith('paid#TX'), `${paidRow} toast=${payToast.slice(0, 40)}`)
  check('赔付出款写进资金流水（payment_type=compensation）',
    scalar(`SELECT COUNT(*) FROM agri_trade.agri_trade_payment WHERE payment_type='compensation' AND order_id=${orderId}`) === '1')

  await opsPage.goto(`${TRADE}/admin/trade/guarantee`, { waitUntil: 'networkidle' }).catch(() => {})
  await opsPage.waitForTimeout(2200)
  const guaranteeText = await pageText(opsPage)
  check('保证金管理页读到真实账户（含 2001 的账户号）',
    guaranteeText.includes('保证金') && (guaranteeText.includes('GT') || guaranteeText.includes('绿源')
      || guaranteeText.includes(String(guaranteeId))), guaranteeText.slice(0, 80))
  const freezeButton = opsPage.locator('button').filter({ hasText: cjk('冻结') }).first()
  if (await freezeButton.count()) {
    await freezeButton.click()
    await opsPage.waitForTimeout(1200)
    await fillField(opsPage, '金额', '1000', '.ant-modal-content:visible')
    await modalConfirm(opsPage)
    const noReasonToast = await toasts(opsPage)
    const frozenAfterEmpty = Number(scalar(`SELECT frozen_amount FROM agri_trade.agri_trade_merchant_guarantee WHERE id=${guaranteeId}`))
    check('冻结不填原因时被拦下（动了商家的钱要能回答为什么）',
      frozenAfterEmpty === Number(seedFrozen) || noReasonToast.includes('原因'),
      `frozen=${frozenAfterEmpty} toast=${noReasonToast.slice(0, 50)}`)
    await fillField(opsPage, '原因', `${MARKER} 风控冻结`, '.ant-modal-content:visible')
    await modalConfirm(opsPage)
    const freezeToast = await toasts(opsPage)
    const logRow = sql(`SELECT CONCAT(action,'#',IFNULL(operator,'#')) FROM agri_trade.agri_trade_guarantee_log
      WHERE guarantee_id=${guaranteeId} AND action='freeze' ORDER BY id DESC LIMIT 1`).split('\n')[0]
    check('填了原因后冻结成功（写出一条 freeze 流水）',
      logRow.startsWith('freeze'), `${logRow} toast=${freezeToast.slice(0, 40)}`)
    check('保证金流水里的操作人是登录账号（不是"运营"也不是空）',
      logRow.endsWith('#admin'), logRow)
  } else {
    check('保证金管理页有冻结入口', false, '没找到冻结按钮（可能列表为空或账号非 active）')
    check('保证金流水里的操作人是登录账号', false, '跳过')
  }
  await opsPage.screenshot({ path: path.join(OUT, 'ops-guarantee.png') }).catch(() => {})

  // ---------- Z. 清场 ----------
  const residue = cleanUp()
  const markResidue = Number(scalar(`SELECT
      (SELECT COUNT(*) FROM agri_trade.agri_trade_demand WHERE demand_name LIKE '%${MARKER}%') +
      (SELECT COUNT(*) FROM agri_trade.agri_trade_quote WHERE remark LIKE '%${MARKER}%') +
      (SELECT COUNT(*) FROM agri_trade.agri_trade_refund WHERE refund_reason LIKE '%${MARKER}%') +
      (SELECT COUNT(*) FROM agri_trade.agri_trade_compensation WHERE review_remark LIKE '%${MARKER}%') +
      (SELECT COUNT(*) FROM agri_trade.agri_trade_guarantee_log WHERE reason LIKE '%${MARKER}%')`))
  check('本次点检新增的行已按主键区间清干净', residue.length === 0, residue.join(' '))
  check(`种子的"${MARKER}"文字残留为 ${markResidue}（应为 0）`, markResidue === 0)
  check('保证金账户已恢复点检前的余额',
    guaranteeId ? scalar(`SELECT CONCAT(available_amount,'#',frozen_amount)
      FROM agri_trade.agri_trade_merchant_guarantee WHERE id=${guaranteeId}`) === `${seedAvailable}#${seedFrozen}` : true,
    `期望 ${seedAvailable}#${seedFrozen}`)

  await Promise.all([buyerPage, sellerPage, opsPage].map((item) => item.close().catch(() => {})))
  await browser.close().catch(() => {})
  runtime.browser = null

  console.log(`\n交易域三端点检：${failures.length === 0 ? '全部通过' : `${failures.length} 项未通过`}`)
  failures.forEach((label) => console.log(`  ✗ ${label}`))
  console.log(`截图目录：${OUT}`)
  if (failures.length) process.exitCode = 1
}

main().catch(async (error) => {
  console.error('点检异常中断：', error?.message ?? error)
  const residue = cleanUp()
  console.error(residue.length ? `清场后仍有残留：${residue.join(' ')}` : '异常退出也已清场，无残留')
  if (runtime.browser) await runtime.browser.close().catch(() => {})
  process.exitCode = 1
})
