/**
 * 供应链金融浏览器点检：三个端（融资方 / 资金方 / 运营风控）真的按登录身份读数，并能把主链路点完。
 *
 * 覆盖：融资工作台与合同（页面签名写库）→ 换账号看另一家 → 资金方签署并放款 →
 *   仓单链路（选已入库批次 → 核对库存与链上存证 → 生成仓单 → 按仓单发起质押 → 仓储读数抽屉）→
 *   运营端仓单台账与质押审核 → 质押物目录（停用/启用回环）→ 逾期、信用、资金机构绑定与换绑。
 *
 * 用法：node scripts/check-finance-ui.mjs
 *   前置：core-platform :8093、agri-finance :8087、agri-production :8092（仓单要读批次）、
 *        nginx 网关 :8081（finance 前端已发布）。
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
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
const CORE = 'http://localhost:8093'
const FIN = 'http://localhost:8087'
const APP = 'http://localhost:8081/finance/'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'outputs', 'finance-ui-20261101')
const MARKER = 'UI点检金融'
const FUND_USERNAME = process.env.FINANCE_FUND_USERNAME || 'fund'

mkdirSync(OUT, { recursive: true })

const sql = (query) => {
  if (!existsSync(MYSQL)) return ''
  const result = spawnSync(MYSQL,
    ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query], { encoding: 'utf8' })
  if (result.status !== 0) return `ERR:${String(result.stderr ?? '').trim().slice(0, 200)}`
  return String(result.stdout ?? '').trim()
}
const exec = (query) => {
  const result = sql(query)
  if (String(result).startsWith('ERR')) console.log(`  ! SQL 失败：${result}`)
  return result
}
const failures = []
/** 业务行删掉之后，站内信与资产会留下"指向不存在单据"的孤儿行，收尾统一扫一遍。 */
const SWEEP_ORPHANS = `
  USE agri_finance;
    DELETE IGNORE a FROM agri_finance.asset a
    LEFT JOIN agri_finance.loan_application la ON la.id = SUBSTRING(a.id, 11)
    WHERE a.id LIKE 'ASSET-APP-%' AND la.id IS NULL;
    DELETE IGNORE m FROM agri_finance.message_notification m
    LEFT JOIN agri_finance.loan_application la ON la.id = m.related_biz_id
    LEFT JOIN agri_finance.loan l ON l.id = m.related_biz_id
    LEFT JOIN agri_finance.contract c ON c.id = m.related_biz_id
    LEFT JOIN agri_finance.asset ast ON ast.id = m.related_biz_id
    LEFT JOIN agri_finance.overdue_record od ON od.id = m.related_biz_id
    LEFT JOIN agri_finance.blacklist b ON b.id = m.related_biz_id
    LEFT JOIN agri_finance.investment iv ON iv.id = m.related_biz_id
    LEFT JOIN agri_finance.pledge p ON p.id = m.related_biz_id
    LEFT JOIN agri_finance.repayment_plan rp ON rp.id = m.related_biz_id
    WHERE m.related_biz_type IN ('LOAN_APPLICATION','LOAN','CONTRACT','ASSET','OVERDUE_RECORD',
      'BLACKLIST','INVESTMENT','PLEDGE','REPAYMENT_PLAN')
      AND la.id IS NULL AND l.id IS NULL AND c.id IS NULL AND ast.id IS NULL AND od.id IS NULL
      AND b.id IS NULL AND iv.id IS NULL AND p.id IS NULL AND rp.id IS NULL;`
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const login = async (username) => {
  const body = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'Admin@123', marketId: 1 }),
  })).json().catch(() => ({}))
  return body?.data ?? {}
}
const api = async (token, method, pathname, body) => {
  const response = await fetch(`${FIN}${pathname}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return response.json().catch(() => ({ code: -1, message: '响应不是 JSON' }))
}
const text = async (page) => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

/** 表里现有的主键集合：页面点检产生的新行按"点检前后的差集"认定，不靠测试自己写标记。 */
const idSet = (table) => new Set(String(sql(`SELECT GROUP_CONCAT(id) FROM agri_finance.${table}`) ?? '')
  .split(',').map((id) => id.trim()).filter((id) => id && id !== 'NULL'))

const newestId = (table, before) => Array.from(idSet(table)).find((id) => !before.has(id)) ?? ''

/** 打开 finance SPA：先用上下文请求拿到 SSO Cookie，再由应用自身的 refreshSession 建立会话。 */
async function openApp(browser, username) {
  const context = await browser.newContext({ viewport: { width: 1680, height: 1000 } })
  const errors = []
  const session = await context.request.post('http://localhost:8081/api/v1/auth/login', {
    headers: { 'Content-Type': 'application/json' },
    data: { username, password: 'Admin@123', marketId: 1 },
  })
  check(session.ok(), `${username} 在网关同源建立登录会话`, String(session.status()))
  const page = await context.newPage()
  page.on('pageerror', (error) => errors.push(String(error?.message ?? error).slice(0, 160)))
  await page.goto(`${APP}#/borrower/home`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  return { context, page, errors }
}

const ids = {
  application: '', contract: '', applicationB: '', contractB: '', loan: '',
  receipt: '', receiptNo: '', pledge: '', pledgeNo: '',
}
// 资金机构当前绑定的主体（由 scripts/provision-finance-fund-account.mjs 开通），页面点检要拿它对照
const FUND_MERCHANT_ID = sql(`SELECT IFNULL(merchant_id,'') FROM agri_finance.fund_provider WHERE id='PROVIDER-BANK-001'`)
const FUND_MERCHANT_NAME = FUND_MERCHANT_ID
  ? sql(`SELECT name FROM agri_core.platform_merchant WHERE id='${FUND_MERCHANT_ID}'`)
  : ''
let certBefore = ''
let browser

try {
  check(Boolean(BROWSER), '找到可用的浏览器内核', BROWSER ?? '')
  const adminLogin = await login('admin')
  const fundLogin = await login(FUND_USERNAME)
  check(Boolean(adminLogin.accessToken && fundLogin.accessToken),
    '取得运营与资金方两个登录态', adminLogin.accessToken ? 'admin ok' : 'admin fail')

  // 造一条待签合同，让"资金方签署 → 自动放款"这一步可以在页面上点出来
  certBefore = sql(`SELECT CONCAT(id,'#',IFNULL(cert_status,'')) FROM agri_core.platform_merchant_certification
    WHERE merchant_id=2001 AND deleted=0 ORDER BY id DESC LIMIT 1`)
  exec(`UPDATE agri_core.platform_merchant_certification SET cert_status='approved' WHERE id=${certBefore.split('#')[0]}`)

  const apply = await api(adminLogin.accessToken, 'POST', '/api/v1/loan/apply', {
    productType: 'agri', applyAmount: 40000, applyTerm: 3, repaymentMethod: '到期一次还本付息',
    fundPurpose: `${MARKER} 植保服务`, repaymentSource: '服务回款',
  })
  ids.application = apply.data?.id ?? ''
  await api(fundLogin.accessToken, 'POST', '/api/v1/loan/review', {
    id: ids.application, result: '已通过', amount: 40000, rate: 6, opinion: `${MARKER} 审批`,
  })
  const accepted = await api(adminLogin.accessToken, 'POST', `/api/v1/loan/${ids.application}/accept`)
  ids.contract = accepted.data?.id ?? ''

  // 第二份：融资方这一半边已在接口里签掉，页面只点"资金方签署 → 自动放款"
  const applyB = await api(adminLogin.accessToken, 'POST', '/api/v1/loan/apply', {
    productType: 'agri', applyAmount: 50000, applyTerm: 3, repaymentMethod: '到期一次还本付息',
    fundPurpose: `${MARKER} 仓储改造`, repaymentSource: '仓储收入',
  })
  ids.applicationB = applyB.data?.id ?? ''
  await api(fundLogin.accessToken, 'POST', '/api/v1/loan/review', {
    id: ids.applicationB, result: '已通过', amount: 50000, rate: 6, opinion: `${MARKER} 审批B`,
  })
  const acceptedB = await api(adminLogin.accessToken, 'POST', `/api/v1/loan/${ids.applicationB}/accept`)
  ids.contractB = acceptedB.data?.id ?? ''
  await api(adminLogin.accessToken, 'POST', '/api/v1/contract/sign', { id: ids.contractB })

  check(Boolean(ids.contract) && Boolean(ids.contractB),
    '已造出两份合同（一份待融资方签、一份待资金方签）', `${ids.contract} / ${ids.contractB}`)

  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })

  // 上一轮中断留下的仓单会挡住本轮"同一批货只有一张未释放仓单"这道闸门。
  // 仓单与读数快照两张表都没有种子数据；由仓单发起的质押也一律是本脚本造的（种子的两条质押没有 receipt_id）。
  exec('DELETE FROM agri_finance.pledge_monitor')
  exec('DELETE FROM agri_finance.warehouse_receipt')
  exec('DELETE FROM agri_finance.pledge WHERE receipt_id IS NOT NULL')

  // ---------- 融资方端（admin = 主体 2001） ----------
  const borrower = await openApp(browser, 'admin')
  const homeText = await text(borrower.page)
  check(homeText.includes('绿源农业合作社'), '融资工作台按令牌显示当前融资主体', homeText.slice(0, 60))
  check(!/Request failed|加载失败/.test(homeText), '融资工作台没有接口失败提示')
  await borrower.page.screenshot({ path: path.join(OUT, '01-borrower-home-admin.png'), fullPage: true })

  await borrower.page.goto(`${APP}#/borrower/contracts`, { waitUntil: 'networkidle' })
  await borrower.page.waitForTimeout(1200)
  const contractsText = await text(borrower.page)
  check(contractsText.includes('FC20260928001'), '融资合同页读到自己的合同（主体 2001）',
    contractsText.match(/FC2026\d+/)?.[0] ?? '')

  // 在页面上把自己名下的待签合同点掉"确认签署"——这一步必须是浏览器真实写入，不靠接口预置
  const contractNoA = sql(`SELECT contract_no FROM agri_finance.contract WHERE id='${ids.contract}'`)
  await borrower.page.locator('article').filter({ hasText: contractNoA }).first().click()
  await borrower.page.waitForTimeout(700)
  const dialogSign = borrower.page.locator('.el-dialog').getByRole('button', { name: /确认签署/ })
  check(await dialogSign.count() > 0, `合同 ${contractNoA} 的详情给出"确认签署"入口`, `count=${await dialogSign.count()}`)
  await dialogSign.first().click()
  await borrower.page.waitForTimeout(700)
  await borrower.page.locator('.el-message-box').getByRole('button', { name: /确认签署/ }).click()
  await borrower.page.waitForTimeout(1800)
  check(sql(`SELECT borrower_sign_time IS NOT NULL FROM agri_finance.contract WHERE id='${ids.contract}'`) === '1',
    '页面签署动作把融资方签名写进合同表', ids.contract)
  await borrower.page.screenshot({ path: path.join(OUT, '02-borrower-contracts.png'), fullPage: true })

  // ---------- 换一个账号登录：必须看到另一家的数据 ----------
  const other = await openApp(browser, 'luochuan')
  const otherHome = await text(other.page)
  check(otherHome.includes('陕西洛川果业'), '换成 luochuan 登录后显示它自己的主体', otherHome.slice(0, 60))
  await other.page.goto(`${APP}#/borrower/contracts`, { waitUntil: 'networkidle' })
  await other.page.waitForTimeout(1200)
  const otherContracts = await text(other.page)
  check(!otherContracts.includes('FC20260928001'),
    '别人（2001）的合同不会出现在 2003 的页面上', otherContracts.slice(0, 70))
  await other.page.screenshot({ path: path.join(OUT, '03-borrower-home-luochuan.png'), fullPage: true })
  check(other.errors.length === 0, '换成 2003 的账号没有页面脚本错误', other.errors.join(' | '))
  await other.context.close()

  // ---------- 资金方端：真实资金方账号（fund）签署并放款 ----------
  const fund = await openApp(browser, FUND_USERNAME)
  await fund.page.goto(`${APP}#/fund/approval`, { waitUntil: 'networkidle' })
  await fund.page.waitForTimeout(1500)
  const approvalText = await text(fund.page)
  check(approvalText.includes('待签署借款合同'), '审批管理页出现"待签署借款合同"区块',
    approvalText.match(/待签署借款合同[^。]{0,40}/)?.[0] ?? '')
  const contractNoB = sql(`SELECT contract_no FROM agri_finance.contract WHERE id='${ids.contractB}'`)
  const lenderRow = fund.page.locator('tr').filter({ hasText: contractNoB })
  const lenderButton = lenderRow.getByRole('button', { name: /签署并放款/ })
  check(await lenderButton.count() > 0, `合同 ${contractNoB} 给出"签署并放款"按钮`, `count=${await lenderButton.count()}`)
  await fund.page.screenshot({ path: path.join(OUT, '04-fund-approval.png'), fullPage: true })
  await lenderButton.first().click()
  await fund.page.waitForTimeout(800)
  await fund.page.locator('.el-message-box').getByRole('button', { name: /确认签署/ }).click()
  // 放款是页面动作之后的异步落库，轮询等到它出现为止（最多 10 秒）
  for (let attempt = 0; attempt < 12 && !ids.loan; attempt++) {
    await fund.page.waitForTimeout(800)
    ids.loan = sql(`SELECT id FROM agri_finance.loan WHERE application_id='${ids.applicationB}'`)
  }
  check(Boolean(ids.loan) && !String(ids.loan).startsWith('ERR'),
    '页面点击"签署并放款"后借款真实落库', ids.loan)
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.repayment_plan WHERE loan_id='${ids.loan}'`)) === 1,
    '放款同时生成还款计划（1 期）')
  await fund.page.screenshot({ path: path.join(OUT, '05-fund-after-sign.png'), fullPage: true })

  // ---------- 仓单链路：批次 → 开仓单 → 质押 → 仓储读数，全部在页面上点出来 ----------
  const receiptsBefore = idSet('warehouse_receipt')
  const pledgesBefore = idSet('pledge')
  const batchRows = await api(adminLogin.accessToken, 'GET', '/api/v1/warehouse-receipt/batches')
  const targetBatch = (batchRows.data ?? [])[0] ?? {}
  const goodsRows = await api(adminLogin.accessToken, 'GET', '/api/v1/pledge-goods/enabled')
  const targetGoods = (goodsRows.data ?? []).find((item) => item.goodsName === '番茄') ?? {}
  check(Boolean(targetBatch.batchNo) && Boolean(targetGoods.goodsCode),
    '本轮点检用的批次与品种都来自接口（不写死）',
    `${targetBatch.batchNo ?? '无批次'} / ${targetGoods.goodsName ?? '无品种'}`)

  await borrower.page.goto(`${APP}#/borrower/pledge`, { waitUntil: 'networkidle' })
  await borrower.page.waitForTimeout(2200)
  const pledgePageText = await text(borrower.page)
  check(/可开单批次/.test(pledgePageText) && !/加载失败|请求失败/.test(pledgePageText),
    '仓单与质押页按生产域批次读数', pledgePageText.match(/可开单批次 \d+ 个/)?.[0] ?? '')
  check(!pledgePageText.includes('优质稻谷 / 180 吨'), '页面不再展示手填的假仓单口径')
  await borrower.page.screenshot({ path: path.join(OUT, '06-borrower-receipt-empty.png'), fullPage: true })

  await borrower.page.getByRole('button', { name: '从批次开仓单' }).click()
  await borrower.page.waitForTimeout(800)
  await borrower.page.locator('.el-dialog').locator('.el-select__wrapper').first().click()
  await borrower.page.waitForTimeout(900)
  await borrower.page.locator('.el-select-dropdown__item').filter({ hasText: targetBatch.batchNo }).first().click()
  await borrower.page.waitForTimeout(2600)
  const previewText = await text(borrower.page)
  check(previewText.includes('在库可用量') && /SIMU[0-9A-F]+/.test(previewText),
    '开单前页面核对到在库可用量与链上存证', previewText.match(/SIMU[0-9A-F]+/)?.[0] ?? '')
  check(previewText.includes(String(targetBatch.warehouseName ?? '——')),
    '分仓库存明细来自生产域', String(targetBatch.warehouseName ?? ''))

  await borrower.page.locator('.el-dialog').locator('.el-select__wrapper').nth(1).click()
  await borrower.page.waitForTimeout(900)
  await borrower.page.locator('.el-select-dropdown__item').filter({ hasText: targetGoods.goodsName }).first().click()
  await borrower.page.waitForTimeout(500)
  await borrower.page.locator('.el-dialog').getByRole('textbox').nth(0).fill('200')
  await borrower.page.locator('.el-dialog').getByRole('textbox').nth(1).fill('6.8')
  await borrower.page.screenshot({ path: path.join(OUT, '07-borrower-receipt-form.png'), fullPage: true })
  await borrower.page.locator('.el-dialog').getByRole('button', { name: '生成仓单' }).click()
  await borrower.page.waitForTimeout(2600)
  ids.receipt = newestId('warehouse_receipt', receiptsBefore)
  ids.receiptNo = sql(`SELECT receipt_no FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt}'`)
  check(Boolean(ids.receipt), '页面"生成仓单"真实落库', ids.receiptNo)
  check(sql(`SELECT CONCAT(status,'#',IFNULL(batch_no,''),'#',IFNULL(user_id,''),'#',IFNULL(quantity,''),'#',IFNULL(unit,'')) FROM
      agri_finance.warehouse_receipt WHERE id='${ids.receipt}'`)
      === `待质押#${targetBatch.batchNo}#2001#200.000#${targetBatch.unit}`,
    '仓单状态/批次/归属主体/数量/单位都按服务端口径',
    sql(`SELECT CONCAT(status,'|',IFNULL(batch_no,''),'|',user_id,'|',quantity,'|',IFNULL(unit,'')) FROM
      agri_finance.warehouse_receipt WHERE id='${ids.receipt}'`))
  check(Number(sql(`SELECT total_value FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt}'`)) === 1360,
    '货值 = 页面填的数量 × 单价', String(sql(`SELECT total_value FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt}'`)))
  const batchPreview = await api(adminLogin.accessToken, 'GET',
    `/api/v1/warehouse-receipt/batch-preview?batchId=${targetBatch.batchId}`)
  check(sql(`SELECT IFNULL(blockchain_hash,'') FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt}'`)
      === String(batchPreview.data?.chain?.txHash ?? ''),
    '仓单存证哈希来自生产域链上记录（不是页面填的）',
    String(sql(`SELECT IFNULL(blockchain_hash,'') FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt}'`)))
  const receiptText = await text(borrower.page)
  check(receiptText.includes(ids.receiptNo), '新建仓单立刻出现在"我的仓单"列表', ids.receiptNo)

  await borrower.page.locator('article').filter({ hasText: ids.receiptNo })
    .getByRole('button', { name: '发起质押' }).click()
  await borrower.page.waitForTimeout(900)
  const pledgeDialogText = await text(borrower.page)
  check(pledgeDialogText.includes(`折算率（上限 ${targetGoods.pledgeRateMax}%）`),
    '质押弹窗按字典上限约束折算率', pledgeDialogText.match(/折算率（上限[^）]*）/)?.[0] ?? '')
  await borrower.page.locator('.el-dialog').getByRole('button', { name: '提交审核' }).click()
  await borrower.page.waitForTimeout(2600)
  ids.pledge = newestId('pledge', pledgesBefore)
  ids.pledgeNo = sql(`SELECT pledge_no FROM agri_finance.pledge WHERE id='${ids.pledge}'`)
  check(Boolean(ids.pledge), '页面发起的质押真实落库', ids.pledgeNo)
  check(sql(`SELECT CONCAT(p.status,'#',r.status) FROM agri_finance.pledge p
      JOIN agri_finance.warehouse_receipt r ON r.id=p.receipt_id WHERE p.id='${ids.pledge}'`) === '待审核#已质押',
    '提交质押后仓单同步进入已质押（同一批货不能被再押一次）')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.message_notification
      WHERE related_biz_id='${ids.pledge}'`)) >= 1, '质押受理写入站内信')

  await borrower.page.locator('article').filter({ hasText: ids.receiptNo })
    .getByRole('button', { name: '仓储读数' }).click()
  await borrower.page.waitForTimeout(1400)
  await borrower.page.getByRole('button', { name: /从生产管理模块取最新读数/ }).click()
  await borrower.page.waitForTimeout(3200)
  const monitorText = await text(borrower.page)
  check(/温度 [\d.]+ ℃/.test(monitorText), '仓储读数抽屉显示生产域回来的温度',
    monitorText.match(/温度 [\d.]+ ℃/)?.[0] ?? monitorText.slice(0, 60))
  check(/(实时重量|气体浓度) —/.test(monitorText), '没有采集通道的字段显示「—」而不是 0',
    monitorText.match(/实时重量 [^ ]+/)?.[0] ?? '')
  check(monitorText.includes('读数来源'), '抽屉里写明读数出自哪台设备', monitorText.match(/读数来源[^\n]{0,24}/)?.[0] ?? '')
  await borrower.page.screenshot({ path: path.join(OUT, '08-borrower-monitor.png'), fullPage: true })
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.pledge_monitor WHERE receipt_id='${ids.receipt}'`)) === 1,
    '页面刷新读数存成一条快照')
  await borrower.page.keyboard.press('Escape')
  await borrower.page.waitForTimeout(600)
  check(borrower.errors.length === 0, '融资方端（含仓单链路）没有页面脚本错误', borrower.errors.join(' | '))
  await borrower.context.close()

  // ---------- 运营风控端（另开 admin 会话）：仓单台账、质押审核、质押物目录、逾期、信用、资金机构 ----------
  const ops = await openApp(browser, 'admin')
  await ops.page.goto(`${APP}#/admin/pledge`, { waitUntil: 'networkidle' })
  await ops.page.waitForTimeout(2200)
  const opsPledgeText = await text(ops.page)
  check(opsPledgeText.includes(ids.receiptNo) && opsPledgeText.includes(targetBatch.batchNo),
    '运营端仓单台账看到融资方本轮仓单与来源批次', `${ids.receiptNo} / ${targetBatch.batchNo}`)
  const receiptRowText = await ops.page.locator('tr').filter({ hasText: ids.receiptNo }).first().innerText()
  check(/SIMU/.test(receiptRowText), '台账直接展示链上存证哈希',
    receiptRowText.replace(/\s+/g, ' ').match(/SIMU[0-9A-F…]+/)?.[0] ?? '')
  await ops.page.screenshot({ path: path.join(OUT, '09-admin-receipts.png'), fullPage: true })

  await ops.page.locator('tr').filter({ hasText: ids.pledgeNo }).first()
    .getByRole('button', { name: '审核通过' }).click()
  await ops.page.waitForTimeout(800)
  await ops.page.locator('.el-message-box').getByRole('button', { name: /审核通过/ }).click()
  await ops.page.waitForTimeout(2400)
  check(sql(`SELECT status FROM agri_finance.pledge WHERE id='${ids.pledge}'`) === '已生效',
    '运营页面审核质押生效', ids.pledgeNo)
  const pledgeRowText = await ops.page.locator('tr').filter({ hasText: ids.pledgeNo }).first().innerText()
  check(pledgeRowText.includes(ids.receiptNo), '质押列表带出来源仓单号（运营能核对押的是哪张单）',
    pledgeRowText.replace(/\s+/g, ' ').slice(0, 70))

  await ops.page.goto(`${APP}#/admin/pledge-goods`, { waitUntil: 'networkidle' })
  await ops.page.waitForTimeout(2000)
  const goodsText = await text(ops.page)
  check(goodsText.includes('优质稻谷') && /在册品种 \d+ 个/.test(goodsText),
    '质押物目录页读到字典与上限', goodsText.match(/在册品种 \d+ 个/)?.[0] ?? '')
  const shrimpRowText = await ops.page.locator('tr').filter({ hasText: '冷冻水产' }).first().innerText()
  check(shrimpRowText.includes('已停用'), '字典能看出哪些品种已被停用', shrimpRowText.replace(/\s+/g, ' ').slice(0, 50))
  await ops.page.locator('tr').filter({ hasText: '冷冻猪肉' }).first().getByRole('button', { name: '停用' }).click()
  await ops.page.waitForTimeout(700)
  await ops.page.locator('.el-message-box').getByRole('button', { name: /确认停用/ }).click()
  await ops.page.waitForTimeout(2400)
  check(sql(`SELECT status FROM agri_finance.pledge_goods WHERE goods_code='PG-PORK'`) === '禁用',
    '页面停用品种后字典状态真的改了')
  await ops.page.locator('tr').filter({ hasText: '冷冻猪肉' }).first().getByRole('button', { name: '启用' }).click()
  await ops.page.waitForTimeout(700)
  await ops.page.locator('.el-message-box').getByRole('button', { name: /确认启用/ }).click()
  await ops.page.waitForTimeout(2400)
  check(sql(`SELECT status FROM agri_finance.pledge_goods WHERE goods_code='PG-PORK'`) === '启用',
    '再启用回原状态（字典维护是可逆的运营动作）')
  await ops.page.screenshot({ path: path.join(OUT, '10-admin-goods-dictionary.png'), fullPage: true })

  await ops.page.goto(`${APP}#/admin/overdue`, { waitUntil: 'networkidle' })
  await ops.page.waitForTimeout(1500)
  const overdueText = await text(ops.page)
  check(/FOD2026\d+|逾期/.test(overdueText), '逾期管理页读取到逾期台账', overdueText.slice(0, 70))

  await ops.page.goto(`${APP}#/admin/credit-management`, { waitUntil: 'networkidle' })
  await ops.page.waitForTimeout(1800)
  const creditText = await text(ops.page)
  check(creditText.includes('绿源农业合作社') && /AAA|AA|评分|综合信用/.test(creditText),
    '信用查询页的主体来自后端主体列表并读到评分', creditText.slice(0, 80))
  await ops.page.screenshot({ path: path.join(OUT, '11-admin-credit.png'), fullPage: true })

  // 「资金机构与主体绑定」页：真实点一次解绑 + 换绑回原主体，
  // 证明这条绑定关系运营在页面上就能维护，不需要有人去改库。
  await ops.page.goto(`${APP}#/admin/fund-provider`, { waitUntil: 'networkidle' })
  await ops.page.waitForTimeout(2000)
  const providerText = await text(ops.page)
  check(providerText.includes('丰链云合作银行') && providerText.includes(FUND_MERCHANT_ID),
    '资金机构页显示机构与已绑定经营主体', `${FUND_MERCHANT_ID} ${FUND_MERCHANT_NAME}`)

  const bankRow = () => ops.page.locator('tr').filter({ hasText: '丰链云合作银行' }).first()
  await bankRow().getByRole('button', { name: '解绑' }).click()
  await ops.page.waitForTimeout(700)
  await ops.page.locator('.el-message-box').getByRole('button', { name: /确认解绑/ }).click()
  await ops.page.waitForTimeout(2400)
  check(sql(`SELECT IFNULL(merchant_id,'') FROM agri_finance.fund_provider WHERE id='PROVIDER-BANK-001'`) === '',
    '页面解绑后绑定关系真的清空')

  await ops.page.locator('tr').filter({ hasText: '未绑定' }).first()
    .getByRole('button', { name: '绑定主体' }).click()
  await ops.page.waitForTimeout(900)
  await ops.page.locator('.el-dialog').getByRole('combobox').click()
  await ops.page.locator('.el-dialog').getByRole('combobox').type(FUND_MERCHANT_NAME, { delay: 40 })
  await ops.page.waitForTimeout(2600)
  await ops.page.locator('.el-select-dropdown__item').filter({ hasText: FUND_MERCHANT_NAME }).first().click()
  await ops.page.waitForTimeout(500)
  await ops.page.locator('.el-dialog').getByRole('button', { name: '确认绑定' }).click()
  await ops.page.waitForTimeout(2600)
  check(sql(`SELECT IFNULL(merchant_id,'') FROM agri_finance.fund_provider WHERE id='PROVIDER-BANK-001'`)
    === FUND_MERCHANT_ID, '页面重新绑定后资金方账号又能进工作台')
  await ops.page.screenshot({ path: path.join(OUT, '12-admin-fund-provider.png'), fullPage: true })

  check(ops.errors.length === 0 && fund.errors.length === 0,
    '资金方与运营端都没有页面脚本错误', ops.errors.concat(fund.errors).join(' | '))
  await ops.context.close()
  await fund.context.close()
} catch (error) {
  failures.push(`未捕获异常：${error.message}`)
  console.error(error)
} finally {
  if (browser) await browser.close().catch(() => {})
  const apps = [ids.application, ids.applicationB].filter(Boolean)
  const contracts = [ids.contract, ids.contractB].filter(Boolean)
  const loans = String(ids.loan || '').split(',').filter(Boolean)
  const bizIds = [...apps, ...contracts, ...loans]
  if (bizIds.length) {
    exec(`DELETE FROM agri_finance.message_notification WHERE related_biz_id IN (${
      bizIds.map((id) => `'${id}'`).join(',')})`)
  }
  if (loans.length) {
    const quotedLoans = loans.map((id) => `'${id}'`).join(',')
    exec(`DELETE FROM agri_finance.repayment_plan WHERE loan_id IN (${quotedLoans})`)
    exec(`DELETE FROM agri_finance.overdue_record WHERE loan_id IN (${quotedLoans})`)
    exec(`DELETE FROM agri_finance.loan WHERE id IN (${quotedLoans})`)
  }
  if (apps.length) {
    const quotedApps = apps.map((id) => `'${id}'`).join(',')
    exec(`DELETE FROM agri_finance.contract WHERE application_id IN (${quotedApps})`)
    exec(`DELETE FROM agri_finance.finance_approval_record WHERE application_id IN (${quotedApps})`)
    exec(`DELETE FROM agri_finance.asset WHERE id IN (${apps.map((id) => `'ASSET-APP-${id}'`).join(',')})`)
    exec(`DELETE FROM agri_finance.loan_application WHERE id IN (${quotedApps})`)
  }
  exec(`DELETE FROM agri_finance.loan_application WHERE fund_purpose LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_finance.message_notification WHERE content LIKE '%${MARKER}%'`)
  // 仓单链路本轮产生的行：监控快照 → 质押 → 站内信 → 仓单
  if (ids.receipt) {
    exec(`DELETE FROM agri_finance.pledge_monitor WHERE receipt_id='${ids.receipt}'`)
    exec(`DELETE FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt}'`)
  }
  if (ids.pledge) {
    exec(`DELETE FROM agri_finance.message_notification WHERE related_biz_id='${ids.pledge}'`)
    exec(`DELETE FROM agri_finance.pledge WHERE id='${ids.pledge}'`)
  }
  if (certBefore) {
    exec(`UPDATE agri_core.platform_merchant_certification SET cert_status='${certBefore.split('#')[1]}' WHERE id=${certBefore.split('#')[0]}`)
  }
  // 绑定关系不靠 SQL 还原：页面最后一步已经把它换绑回原主体；这里只兜底异常中断的情况
  if (FUND_MERCHANT_ID
    && sql(`SELECT IFNULL(merchant_id,'') FROM agri_finance.fund_provider WHERE id='PROVIDER-BANK-001'`) === '') {
    exec(`UPDATE agri_finance.fund_provider SET merchant_id='${FUND_MERCHANT_ID}' WHERE id='PROVIDER-BANK-001'`)
  }
  exec(SWEEP_ORPHANS)
  // 字典的停用/启用是页面上点出来的，正常路径末尾已回到原状态；异常中断时在这里兜底
  exec(`UPDATE agri_finance.pledge_goods SET status='启用' WHERE goods_code='PG-PORK'`)
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.loan_application WHERE fund_purpose LIKE '%${MARKER}%'`)) === 0,
    '清理后 UI 点检数据残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.warehouse_receipt`)) === 0, '清理后仓单残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.pledge_monitor`)) === 0, '清理后仓储读数快照残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.pledge WHERE receipt_id IS NOT NULL`)) === 0,
    '清理后由仓单发起的质押残留为 0（种子数据没有仓单，receipt_id 为空）')
  console.log(`\n截图目录：${OUT}`)
  console.log(`断言 ${failures.length === 0 ? '全部通过' : `失败 ${failures.length} 项：${failures.join(' / ')}`}`)
  process.exit(failures.length === 0 ? 0 : 1)
}
