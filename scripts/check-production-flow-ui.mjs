/**
 * 生产主链路浏览器点检：验证用户端/运营端页面真的读取刚落库的业务数据。
 *
 * 用法：node scripts/check-production-flow-ui.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
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
const CORE = 'http://localhost:8093'
const BASE = 'http://localhost'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'production-flow-20261031')
mkdirSync(OUT, { recursive: true })

const sql = (query) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query],
      { encoding: 'utf8' }).trim()
  } catch (error) {
    return `ERR:${String(error?.message ?? error).slice(0, 120)}`
  }
}
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const login = async (username) => {
  const body = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: 'Admin@123', marketId: 1 }),
  })).json()
  return body?.data ?? {}
}
const api = async (token, method, pathname, body) => {
  const response = await fetch(`${BASE}/api/v1/production${pathname}`, {
    method, headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await response.json()
  if (json?.code !== 0) throw new Error(`${pathname} ${json?.message ?? response.status}`)
  return json.data
}
const text = async (page) => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

const stamp = Date.now()
const suffix = String(stamp).slice(-8)
const ids = {
  plot: '', plan: '', stage: '', task: '', batch: '', inspection: '', approval: '',
  input: '', usage: '', chainRecords: [], qcInspections: [],
}
let browser
let farmerLogin
let adminLogin

try {
  farmerLogin = await login('farmer')
  adminLogin = await login('admin')
  check(Boolean(farmerLogin.accessToken && adminLogin.accessToken), '取得用户端与运营端登录态')

  const farms = await api(farmerLogin.accessToken, 'GET', '/farms?page=1&size=1')
  const farm = farms.records[0]
  const farmCtx = { farmId: String(farm.id), farmCode: farm.farmCode ?? '', farmName: farm.farmName ?? '' }
  ids.plot = String(await api(farmerLogin.accessToken, 'POST', '/plots', {
    plotName: `UI联调地块-${suffix}`, farmId: farm.id, area: 9, soilType: '壤土', status: 1,
  }))
  const crops = await api(farmerLogin.accessToken, 'GET', '/crops/options')
  ids.plan = String(await api(farmerLogin.accessToken, 'POST', '/plans', {
    planName: `UI联调计划-${suffix}`, farmId: String(farm.id), plotId: ids.plot,
    cropId: String(crops[0].cropId), planStartDate: '2027-02-01', planEndDate: '2027-03-31',
    expectedYield: 6000, planArea: 9,
  }))
  ids.stage = String(await api(farmerLogin.accessToken, 'POST', `/plans/${ids.plan}/stages`, {
    stageName: `UI联调阶段-${suffix}`, taskType: '施肥', planStartDate: '2027-02-01', planEndDate: '2027-02-05', status: 1,
  }))
  await api(farmerLogin.accessToken, 'POST', `/plans/${ids.plan}/submit`)
  const approvals = await api(adminLogin.accessToken, 'GET', '/admin/approvals?page=1&size=50&status=1&approvalType=PLAN')
  ids.approval = String((approvals.records ?? approvals.list ?? []).find((row) => String(row.bizId) === ids.plan)?.approvalId ?? '')
  const approvalRow = sql(`SELECT CONCAT(status,'|',title) FROM agri_production.agri_prod_approval WHERE approval_code = '${ids.approval}'`)
  check(Boolean(ids.approval) && approvalRow.startsWith('PENDING|'), '计划审批单已真实落库', approvalRow)

  ids.task = String(await api(farmerLogin.accessToken, 'POST', '/tasks', {
    taskName: `UI联调任务-${suffix}`, taskType: 'fertilizing', priority: 3,
    farmId: farm.id, plotId: ids.plot, planId: ids.plan, stageId: ids.stage,
    planStartDate: '2027-02-01 08:00:00', planEndDate: '2027-02-02 18:00:00',
  }))
  ids.batch = String(await api(farmerLogin.accessToken, 'POST', '/harvests', {
    plotId: ids.plot, planId: ids.plan, cropId: crops[0].cropId, cropName: crops[0].cropName,
    harvestDate: '2027-03-20', quantity: 88, unit: 'kg', grade: 'A', warehouseName: 'UI联调仓',
  }))
  await api(farmerLogin.accessToken, 'POST', `/harvests/${ids.batch}/generate`, { warehouseName: 'UI联调仓' })
  await api(farmerLogin.accessToken, 'POST', '/harvests/inventory/in', {
    batchId: ids.batch, warehouseName: 'UI联调仓', quantity: 88, operatorName: 'UI联调',
  })
  const batch = await api(farmerLogin.accessToken, 'GET', `/harvests/${ids.batch}`)
  check(Number(batch.inboundStatus) === 1 && Boolean(batch.traceCode), '采收批次入库与溯源码已落库',
    `inbound=${batch.inboundStatus} trace=${batch.traceCode}`)

  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error).slice(0, 160)))
  await page.goto(`${BASE}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.evaluate(async (creds) => {
    await fetch('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify(creds),
    })
  }, { username: 'farmer', password: 'Admin@123', marketId: 1 })
  await page.addInitScript((state) => {
    localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
    localStorage.setItem('agri_roles', JSON.stringify(state.roles ?? []))
    localStorage.setItem('agri_permissions', JSON.stringify([]))
    localStorage.setItem('agri_market_id', String(state.marketId ?? 1))
    localStorage.setItem('agri_current_farm', JSON.stringify(state.farm))
  }, { userInfo: farmerLogin.user ?? {}, roles: farmerLogin.user?.roles ?? ['FARMER'], marketId: 1, farm: farmCtx })

  await page.goto(`${BASE}/production/plans`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)
  let planListText = await text(page)
  check(planListText.includes(`UI联调计划-${suffix}`) && planListText.includes('待审批'),
    '用户端计划列表显示待审批计划', planListText.match(/UI联调计划[^\s]*/)?.[0] ?? '')
  await page.screenshot({ path: path.join(OUT, '01-plan-pending.png'), fullPage: false })

  /* ---------- 菜单文案（2026-11-02 改名：农场数字化管理 → 我的农场，农场列表 → 农场管理） ---------- */
  // 先进农场页再读菜单：分组是"当前路径所在的那组自动展开"，在计划页上农场组可能是折叠的
  await page.goto(`${BASE}/production/farms`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2000)
  const menuText = (await page.locator('.ant-menu').first().innerText().catch(() => ''))
    .replace(/\s+/g, ' ')
  check(menuText.includes('我的农场') && menuText.includes('农场管理')
    && !menuText.includes('农场数字化管理'),
    '侧边一级菜单显示「我的农场」、其下叶子显示「农场管理」，旧文案不再出现在导航里',
    menuText.slice(0, 60))
  const crumbText = (await page.locator('.ant-breadcrumb').first().innerText().catch(() => ''))
    .replace(/\s+/g, ' ')
  check(crumbText.includes('我的农场') && crumbText.includes('农场管理'),
    '农场页的面包屑与菜单同一处来源（面包屑读 group.label，改名后不会另说一套）', crumbText.slice(0, 48))
  await page.screenshot({ path: path.join(OUT, '25-menu-farm-rename.png'), fullPage: false })
  await page.goto(`${BASE}/production/farms/${farmCtx.farmId}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2200)
  const farmDetailText = await text(page)
  check(!farmDetailText.includes('农场列表') && farmDetailText.includes(farmCtx.farmName || '农场'),
    '农场详情页不留旧菜单名（"返回农场列表"那颗按钮一起改成"返回农场管理"，页面不再两个名字并存）',
    farmDetailText.slice(0, 40))
  await page.screenshot({ path: path.join(OUT, '26-farm-detail-rename.png'), fullPage: false })

  await page.goto(`${BASE}/production/plans/${ids.plan}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)
  const planDetailText = await text(page)
  check(planDetailText.includes(`UI联调阶段-${suffix}`) && planDetailText.includes(`UI联调任务-${suffix}`),
    '计划详情真实展示阶段与关联任务', planDetailText.slice(0, 120))
  await page.screenshot({ path: path.join(OUT, '02-plan-detail.png'), fullPage: false })

  await page.goto(`${BASE}/production/tasks/create`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)
  await page.locator('#planId').click()
  await page.waitForTimeout(900)
  const planOptionText = await page.evaluate(() => [...document.querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')]
    .map((node) => node.textContent.trim()).join(' | '))
  check(planOptionText.includes(`UI联调计划-${suffix}`), '新建任务页可选择刚创建的种养计划', planOptionText.slice(0, 160))
  await page.keyboard.press('Escape')
  await page.screenshot({ path: path.join(OUT, '03-task-create.png'), fullPage: false })

  await page.goto(`${BASE}/production/harvests/${ids.batch}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)
  const harvestText = await text(page)
  check(harvestText.includes('已入库') && harvestText.includes(batch.traceCode)
    && !harvestText.includes('入库状态未提供'), '采收详情页展示服务端真实入库与溯源码', harvestText.slice(0, 160))
  await page.screenshot({ path: path.join(OUT, '04-harvest-detail.png'), fullPage: false })

  await page.goto(`${BASE}/production/alerts`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1000)
  const alertText = await text(page)
  check(alertText.includes('告警') || alertText.includes('未处理'), '用户端告警中心正常渲染', alertText.slice(0, 100))

  const adminContext = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const adminPage = await adminContext.newPage()
  const adminErrors = []
  adminPage.on('pageerror', (error) => adminErrors.push(String(error?.message ?? error).slice(0, 160)))
  await adminPage.goto(`${BASE}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await adminPage.evaluate(async (creds) => {
    await fetch('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify(creds),
    })
  }, { username: 'admin', password: 'Admin@123', marketId: 1 })
  await adminPage.addInitScript((state) => {
    localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
    localStorage.setItem('agri_roles', JSON.stringify(state.roles ?? []))
    localStorage.setItem('agri_permissions', JSON.stringify([]))
    localStorage.setItem('agri_market_id', String(state.marketId ?? 1))
  }, { userInfo: adminLogin.user ?? {}, roles: adminLogin.user?.roles ?? ['SUPER_ADMIN'], marketId: 1 })
  await adminPage.goto(`${BASE}/admin/production/approvals`, { waitUntil: 'networkidle', timeout: 60000 })
  await adminPage.waitForTimeout(1200)
  const approvalText = await text(adminPage)
  check(approvalText.includes(`UI联调计划-${suffix}`) && !approvalText.includes('示例数据')
    && !approvalText.includes('演示模式'), '运营端审批台账展示真实计划审批且无演示数据', approvalText.slice(0, 180))
  await adminPage.screenshot({ path: path.join(OUT, '05-admin-approval.png'), fullPage: false })

  await adminPage.locator('button', { hasText: '通过' }).first().click()
  await adminPage.waitForSelector('.ant-modal-body textarea', { timeout: 10000 })
  await adminPage.locator('.ant-modal-body textarea').fill(`UI审批通过-${suffix}`)
  await adminPage.locator('.ant-modal-footer button').filter({ hasText: /通\s*过/ }).click()
  await adminPage.waitForTimeout(1500)
  const approvalAfter = sql(`SELECT status FROM agri_production.agri_prod_approval WHERE approval_code = '${ids.approval}'`)
  const planAfter = sql(`SELECT plan_status FROM agri_production.agri_prod_planting_plan WHERE id = '${ids.plan}'`)
  check(approvalAfter === 'APPROVED' && planAfter === 'active', '运营端页面审批通过并回写计划状态',
    `approval=${approvalAfter} plan=${planAfter}`)

  /* ---------- 全链路溯源页：存证状态必须逐节点来自存证表 ---------- */
  const chainAnchor = await api(farmerLogin.accessToken, 'POST', '/blockchain/anchor', {
    bizType: 'HARVEST', bizNo: batch.batchNo, bizSummary: `UI联调采收存证-${suffix}`,
  })
  ids.chainRecords.push(String(chainAnchor?.recordNo ?? ''))
  const failedNo = `CHAIN-UI-${suffix}-F`
  ids.chainRecords.push(failedNo)
  sql(`INSERT INTO agri_production.agri_prod_chain_record
       (record_no, chain_type, target_type, target_id, target_code, data_hash, chain_status,
        failed_reason, retry_count, del_flag, tenant_id, create_by, create_time, update_time)
       VALUES ('${failedNo}', 'SIMULATED', 'TRACE', NULL, '${batch.traceCode}', 'ui', 'FAILED',
        'UI点检：模拟链出块超时', 1, 0, '2001', 'ui', NOW(), NOW())`)
  check(chainAnchor?.status === 'SUCCESS' && Boolean(chainAnchor?.txHash),
    '存证写入：采收批次出块成功并返回交易哈希（页面要显示的就是这两个值）',
    `record=${chainAnchor?.recordNo} tx=${chainAnchor?.txHash}`)

  await page.goto(`${BASE}/production/trace/full-chain?batchId=${ids.batch}&code=${encodeURIComponent(batch.traceCode)}`,
    { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const chainText = await text(page)
  check(chainText.includes('已上链') && chainText.includes('交易哈希')
    && chainText.includes(String(chainAnchor?.txHash ?? '###')),
    '全链路页：采收节点显示已上链并给出真实交易哈希', chainText.match(/交易哈希 \S+/)?.[0] ?? '')
  check(chainText.includes('存证失败') && chainText.includes('UI点检：模拟链出块超时'),
    '全链路页：溯源码节点显示存证失败并给出失败原因（不写成待上链）')
  check(chainText.includes('无存证记录') && chainText.includes('存证失败 1 条'),
    '全链路页：入库节点如实为无存证记录，验证状态汇总计入失败')
  // 这三个节点的真实状态分别是"已上链 / 存证失败 / 无存证记录"：出现 ⏳ 待上链 标签就说明
  // FAILED 被降级成了 PENDING（口径说明横幅里本来就写着"待上链=PENDING"，不能拿那三个字判）。
  check(!chainText.includes('undefined') && !chainText.includes('NaN') && !chainText.includes('⏳ 待上链'),
    '全链路页文案没有 undefined/NaN，失败没有被降级显示成"待上链"', chainText.slice(0, 100))
  await page.screenshot({ path: path.join(OUT, '06-full-chain.png'), fullPage: false })

  /* ---------- 投入品存证：页面上点「上链」要真的写进存证表并回显真值 ---------- */
  ids.input = String(await api(farmerLogin.accessToken, 'POST', '/inputs', {
    inputName: `UI联调肥料-${suffix}`, inputType: 'FERTILIZER', unit: 'kg',
    stockQty: 20, warnQty: 3, safetyInterval: 7, status: 1,
  }))
  ids.usage = String(await api(farmerLogin.accessToken, 'POST', '/inputs/usages', {
    inputId: ids.input, plotId: ids.plot, farmId: farm.id, dosage: 4, unit: 'kg', method: '撒施',
    safetyIntervalDays: 7, status: 1,
  }))
  check(Boolean(ids.input) && Boolean(ids.usage), '临时投入品与使用记录已建（上链入口要有行可点）',
    `input=${ids.input} usage=${ids.usage}`)

  await page.goto(`${BASE}/production/inputs/usages`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2000)
  const usageRow = page.locator('tr', { hasText: `UI联调肥料-${suffix}` }).first()
  const beforeText = await usageRow.innerText().catch(() => '')
  check(beforeText.includes('上') && !beforeText.includes('已上链'),
    '新建的使用记录显示为"未上链"并提供上链按钮（不是假装已存证）', beforeText.replace(/\s+/g, ' ').slice(0, 60))
  await usageRow.locator('button').filter({ hasText: /上\s*链/ }).first().click()
  await page.waitForTimeout(2200)
  const toastText = await text(page)
  check(toastText.includes('模拟链 SUCCESS'),
    '点上链后提示按真实返回状态说（模拟链 SUCCESS），不再写"等待链上确认"',
    toastText.match(/已存证[^ ]{0,40}/)?.[0] ?? '')
  const afterText = await usageRow.innerText().catch(() => '')
  check(afterText.includes('已上链'), '列表行翻成"已上链"（此前 status===3 与数字/字符串主键比不上的 bug 让它永远点不亮）',
    afterText.replace(/\s+/g, ' ').slice(0, 60))
  await page.screenshot({ path: path.join(OUT, '07-input-usages-chained.png'), fullPage: false })

  const usageChainRow = sql(`SELECT CONCAT(target_type,'|',IFNULL(target_id,'-'),'|',record_no,'|',chain_status)
    FROM agri_production.agri_prod_chain_record
    WHERE del_flag=0 AND target_type='INPUT' AND target_code='${ids.usage}' ORDER BY id DESC LIMIT 1`)
  check(usageChainRow.startsWith(`INPUT|${ids.usage}|CHAIN-`) && usageChainRow.endsWith('|SUCCESS'),
    '页面点击确实落库为 INPUT 存证（业务类型是字符串词表、主键回填）', usageChainRow)

  await page.goto(`${BASE}/production/inputs/${ids.input}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2000)
  const detailText = await text(page)
  check(detailText.includes('已上链（模拟链）') && detailText.includes('CHAIN-')
    && detailText.includes('SIMU'),
    '投入品详情页展示真实存证编号与交易哈希', detailText.match(/CHAIN-[0-9-]+/)?.[0] ?? '')
  check(!detailText.includes('ECDSA') && !detailText.includes('0x')
    && !detailText.includes('链上哈希 = 链下计算哈希'),
    '详情页不再出现编造的验真话术与伪哈希（ECDSA/0x 本地生成那套已删）')
  await page.screenshot({ path: path.join(OUT, '08-input-detail-chain.png'), fullPage: false })

  /* ---------- 溯源码有效期：页面要看得见、运营端详情不能再说"未接入" ---------- */
  const expiryCode = await api(farmerLogin.accessToken, 'POST',
    `/trace/codes/generate?batchId=${ids.batch}&expireDate=2027-06-30`)
  check(Boolean(expiryCode), '为批次再生成一个带有效期的溯源码', `code=${expiryCode}`)
  await page.goto(`${BASE}/production/trace`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const codeRow = page.locator('tr', { hasText: String(expiryCode) }).first()
  const codeRowText = await codeRow.innerText().catch(() => '')
  check(codeRowText.includes('2027-06-30'),
    '用户端溯源码管理列表显示真实"有效期至"（此前入参被丢掉，这一列永远是 -）',
    codeRowText.replace(/\s+/g, ' ').slice(0, 70))
  await page.screenshot({ path: path.join(OUT, '09-trace-code-expiry.png'), fullPage: false })

  await adminPage.goto(`${BASE}/admin/production/trace/${encodeURIComponent(String(expiryCode))}`,
    { waitUntil: 'networkidle', timeout: 60000 })
  await adminPage.waitForTimeout(2500)
  const adminTraceText = await text(adminPage)
  check(adminTraceText.includes('2027-06-30') && adminTraceText.includes('首次扫码时间')
    && (adminTraceText.includes('尚未被扫码') || /\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(adminTraceText)),
    '运营端溯源详情按真实字段渲染有效期与首次扫码时间（不再读不存在的键显示"未接入"）',
    adminTraceText.match(/有效期至.{0,16}/)?.[0]?.replace(/\s+/g, ' ') ?? '')
  await adminPage.screenshot({ path: path.join(OUT, '10-admin-trace-detail.png'), fullPage: false })

  /* ---------- 存证列表：每一行要能点回它存证的那条业务 ---------- */
  await page.goto(`${BASE}/production/blockchain/records`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const anchorRow = page.locator('tr', { hasText: String(chainAnchor?.bizNo ?? batch.batchNo) }).first()
  const anchorRowText = await anchorRow.innerText().catch(() => '')
  check(anchorRowText.includes('采收') && anchorRowText.includes(String(batch.batchNo)),
    '存证列表能看到刚写入的采收存证', anchorRowText.replace(/\s+/g, ' ').slice(0, 70))
  await anchorRow.locator('a.ant-typography, .ant-typography-link').first().click()
  await page.waitForTimeout(2500)
  const jumpedUrl = page.url()
  const jumpedText = await text(page)
  check(jumpedUrl.includes(`/production/harvests/${ids.batch}`) && jumpedText.includes(String(batch.batchNo)),
    '点存证行的业务单号跳进对应采收详情（列表从"只能看"变成"能查回去"）',
    `${jumpedUrl.split('/production/')[1] ?? jumpedUrl} · ${jumpedText.includes(String(batch.batchNo)) ? '批次号对得上' : '批次号没出现'}`)
  await page.screenshot({ path: path.join(OUT, '11-chain-record-jump.png'), fullPage: false })

  /* ---------- 列表的链上状态列：运营端与用户端要给出同一个结论 ---------- */
  const codeChain = await api(farmerLogin.accessToken, 'POST', '/blockchain/anchor', {
    bizType: 'TRACE', bizNo: batch.traceCode, bizSummary: `UI点检溯源码存证-${suffix}`,
  })
  ids.chainRecords.push(String(codeChain?.recordNo ?? ''))
  await adminPage.goto(`${BASE}/admin/production/trace/codes`, { waitUntil: 'networkidle', timeout: 60000 })
  await adminPage.waitForTimeout(2500)
  const opsRow = adminPage.locator('tr', { hasText: String(batch.traceCode) }).first()
  const opsRowText = (await opsRow.innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(opsRowText.includes('已上链'),
    '运营端溯源码列表的「链上状态」列按存证表显示已上链（此前读的是没人写的死列，永远未上链）',
    opsRowText.slice(0, 70))
  await adminPage.screenshot({ path: path.join(OUT, '12-admin-chain-status-column.png'), fullPage: false })

  await page.goto(`${BASE}/production/trace`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const userRow = page.locator('tr', { hasText: String(batch.traceCode) }).first()
  const userRowText = (await userRow.innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(userRowText.includes('已上链'),
    '用户端列表同一行给出同样的"已上链"（两端同一处规则）', userRowText.slice(0, 70))
  const seedRowText = (await page.locator('tr', { hasText: 'AG010102202605280001' }).first()
    .innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(seedRowText.includes('存证失败'),
    '有存证但未出块的种子码显示"存证失败"，不与"无存证记录"混为一谈', seedRowText.slice(0, 60))
  await page.screenshot({ path: path.join(OUT, '13-user-chain-status-column.png'), fullPage: false })

  /* ---------- 筛选：条件要真的在服务端生效，而不是只筛已经拿回的那一页 ---------- */
  await page.goto(`${BASE}/production/trace`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2000)
  const allRowText = await text(page)
  const totalBefore = Number((allRowText.match(/共 (\d+) 条/) ?? [])[1] ?? '-1')
  await page.locator('input[placeholder*="搜索溯源码"]').fill(String(expiryCode))
  await page.locator('button', { hasText: /查\s*询/ }).first().click()
  await page.waitForTimeout(2200)
  const filteredText = await text(page)
  const totalAfter = Number((filteredText.match(/共 (\d+) 条/) ?? [])[1] ?? '-1')
  check(totalBefore > totalAfter && totalAfter === 1 && filteredText.includes(String(expiryCode)),
    '用户端关键字筛选走服务端：列表与总数一起收窄（旧版只筛已取回的一页，总数还是没筛的数）',
    `共 ${totalBefore} 条 → 共 ${totalAfter} 条`)
  await page.screenshot({ path: path.join(OUT, '14-trace-filter-keyword.png'), fullPage: false })

  await adminPage.goto(`${BASE}/admin/production/trace/codes`, { waitUntil: 'networkidle', timeout: 60000 })
  await adminPage.waitForTimeout(2000)
  // antd 的 label 在 .ant-select 外面，所以要从 form-item 往里定位
  await adminPage.locator('.ant-form-item:has-text("链上状态") .ant-select').first().click()
  await adminPage.waitForTimeout(600)
  await adminPage.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: '已上链' }).first().click()
  await adminPage.locator('button', { hasText: /查\s*询/ }).first().click()
  await adminPage.waitForTimeout(2200)
  const opsFilteredText = await text(adminPage)
  const opsRows = await adminPage.locator('.ant-table-tbody tr.ant-table-row').count()
  check(opsRows > 0 && !opsFilteredText.includes('无存证记录') && !opsFilteredText.includes('存证失败'),
    '运营端按"已上链"筛选后，列表里不再出现未上链/无记录的行', `rows=${opsRows}`)
  await adminPage.screenshot({ path: path.join(OUT, '15-admin-trace-filter-chain.png'), fullPage: false })

  /* ---------- 分页：翻页必须是服务端行为，而不是把 500 条搬进浏览器再切 ---------- */
  // 演示库里本主体的码不够一页，先给本批次补到 12 条（清理按 harvest_id 一起软删）
  const batchCodesBefore = await api(farmerLogin.accessToken, 'GET', `/trace/batches/${ids.batch}`)
  for (let i = batchCodesBefore.length; i < 12; i += 1) {
    await api(farmerLogin.accessToken, 'POST', `/trace/codes/generate?batchId=${ids.batch}`)
  }
  const codeRequests = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/production/trace/codes?')) codeRequests.push(request.url())
  })
  // 统计卡的计数请求也打这个路径（size=1），点分页时要看的是列表请求，别拿它当证据
  const listRequests = () => codeRequests.filter((url) => !/size=1(&|$)/.test(url))
  const lastCodeRequest = () => listRequests()[listRequests().length - 1] ?? ''
  const pageQueryMark = () => (lastCodeRequest().match(/page=\d+&size=\d+/) ?? [''])[0]
  const rowCodes = async () => {
    const lines = await page.locator('.ant-table-tbody tr.ant-table-row').allInnerTexts()
    return lines.map((line) => (line.match(/AG[0-9A-Z]{10,}/) ?? [''])[0]).filter(Boolean)
  }
  const pagerTotal = async () => Number((((await page.locator('.ant-pagination-total-text')
    .innerText().catch(() => '')).match(/共 (\d+) 条/)) ?? [])[1] ?? -1)
  const searchBy = async (keyword) => {
    await page.locator('input[placeholder*="搜索溯源码"]').fill(String(keyword))
    await page.locator('button', { hasText: /查\s*询/ }).first().click()
    await page.waitForTimeout(2200)
  }

  await page.goto(`${BASE}/production/trace`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  const firstRequest = listRequests()[0] ?? ''
  const page1Codes = await rowCodes()
  const totalAll = await pagerTotal()
  check(firstRequest.includes('page=1') && firstRequest.includes('size=10')
    && codeRequests.every((url) => !url.includes('size=500'))
    && page1Codes.length === 10 && totalAll >= 13,
    '首屏就是按 page=1&size=10 问服务端要的，也没有哪次请求再要 500 条（旧版取回 500 条由表格本地翻页，"第 2 页"只是那 500 条的第 11~20 行）',
    `${(firstRequest.split('?')[1] ?? '').slice(0, 30)} · 本页 ${page1Codes.length} 行 · 共 ${totalAll} 条`)

  await page.locator('.ant-pagination-item-2').click()
  await page.waitForTimeout(2200)
  const page2Codes = await rowCodes()
  check(lastCodeRequest().includes('page=2') && page2Codes.length === totalAll - 10
    && page2Codes.every((code) => !page1Codes.includes(code)),
    '点第 2 页真的换了一次服务端请求：两页不重叠，第 2 页条数等于总数减一页',
    `${pageQueryMark()} · 第 2 页 ${page2Codes.length} 行`)
  await page.screenshot({ path: path.join(OUT, '16-trace-server-page2.png'), fullPage: false })

  await page.locator('.ant-pagination-options .ant-select').first().click()
  await page.waitForTimeout(600)
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: /20\s*条\/页/ }).first().click()
  await page.waitForTimeout(2500)
  const rowsOn20 = await rowCodes()
  check(lastCodeRequest().includes('size=20') && rowsOn20.length === totalAll && (await pagerTotal()) === totalAll,
    '每页条数改动同样进请求：换成 20 条/页后这一页真的装下全部（不是本地把同一批数据重切）',
    `${pageQueryMark()} · ${rowsOn20.length} 行`)

  await page.goto(`${BASE}/production/trace`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2200)
  await searchBy(batch.batchNo)
  const filteredTotal = await pagerTotal()
  await page.locator('.ant-pagination-item-2').click()
  await page.waitForTimeout(2200)
  const filteredPage2 = await rowCodes()
  const seedCodes = ['AG010102202605280001', 'AG010101202606010001']
  check(filteredTotal === 12 && filteredPage2.length === 2 && lastCodeRequest().includes('page=2')
    && !filteredPage2.some((code) => seedCodes.includes(code)),
    '筛选与翻页同时生效：本批次 12 条翻到第 2 页只剩 2 条，别的码混不进来（旧版翻页只在那 500 条里走）',
    `共 ${filteredTotal} 条 · 第 2 页 ${filteredPage2.length} 行`)
  await page.screenshot({ path: path.join(OUT, '17-trace-filter-then-page2.png'), fullPage: false })

  const statText = await text(page)
  const statCards = (await page.locator('.ant-statistic').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '))
  const statTotal = Number((statCards[0] ?? '').replace(/[^\d]/g, ''))
  check(statTotal === totalAll && statText.includes('当前页累计扫码'),
    '统计卡走全量计数请求、不受当前筛选与分页影响，扫码副标题也如实写着「当前页」',
    `卡=${statTotal} 全量=${totalAll} · ${statCards[0] ?? ''}`)

  const [csvDownload] = await Promise.all([
    page.waitForEvent('download', { timeout: 40000 }),
    page.locator('button').filter({ hasText: /导\s*出/ }).first().click(),
  ])
  const csvFile = await csvDownload.path().catch(() => '')
  const csvRows = csvFile
    ? readFileSync(csvFile, 'utf8').replace(/^﻿/, '').trim().split('\n')
    : []
  check(csvRows.length - 1 === filteredTotal && csvRows[0].includes('链上状态'),
    '导出按筛选条件翻遍服务端分页：CSV 是这 12 条，不再只是当前页那 2 行（也不假装导全）',
    `数据 ${csvRows.length - 1} 行 / 筛选 ${filteredTotal} 条`)
  await page.screenshot({ path: path.join(OUT, '18-trace-export-across-pages.png'), fullPage: false })

  /* ---------- 生成日期区间：这一档以前只在运营端有，用户端连控件都没有 ---------- */
  await page.goto(`${BASE}/production/trace`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2200)
  const todayLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  const rangeInputs = page.locator('.ant-form-item:has-text("生成日期") input')
  await rangeInputs.first().click()
  await rangeInputs.first().fill('2025-01-01')
  await page.keyboard.press('Enter')
  await rangeInputs.nth(1).fill('2025-01-31')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
  await page.locator('button', { hasText: /查\s*询/ }).first().click()
  await page.waitForTimeout(2200)
  const pastRangeRequest = lastCodeRequest()
  const pastRangeTotal = await pagerTotal()
  const pastRangeRows = await page.locator('.ant-table-tbody tr.ant-table-row').count()
  check(pastRangeRequest.includes('from=2025-01-01') && pastRangeRequest.includes('to=2025-01-31')
    && pastRangeRows === 0 && (pastRangeTotal === 0 || pastRangeTotal === -1),
    '生成日期区间进请求且服务端真的筛：去年一月没有码，列表空、分页器也不再报旧的总数（空表时 antd 连分页器都不渲染）',
    `${pastRangeRequest.match(/from=[^&]+&to=[^&]+/)?.[0] ?? ''} · 行 ${pastRangeRows} · 总数 ${pastRangeTotal === -1 ? '无分页器' : pastRangeTotal}`)
  await rangeInputs.first().click()
  await rangeInputs.first().fill(todayLocal)
  await page.keyboard.press('Enter')
  await rangeInputs.nth(1).fill(todayLocal)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(700)
  await page.locator('button', { hasText: /查\s*询/ }).first().click()
  await page.waitForTimeout(2200)
  const todayRangeTotal = await pagerTotal()
  check(lastCodeRequest().includes(`from=${todayLocal}`) && lastCodeRequest().includes(`to=${todayLocal}`)
    && todayRangeTotal >= 12 && todayRangeTotal <= totalAll,
    '区间收成今天：只留下今天生成的码，总数在"今天这些"与全量之间（两端含当天）',
    `共 ${todayRangeTotal} 条 / 全量 ${totalAll} 条`)
  await page.screenshot({ path: path.join(OUT, '20-trace-date-range.png'), fullPage: false })

  /* ---------- 状态文案：到期失效与人为作废是两件事，不能都叫"已作废" ---------- */
  const expiredAgain = await api(farmerLogin.accessToken, 'POST',
    `/trace/codes/generate?batchId=${ids.batch}&expireDate=2020-02-01`)
  await api(farmerLogin.accessToken, 'PATCH', '/trace/codes/expire-overdue')
  await api(farmerLogin.accessToken, 'POST', `/trace/${expiryCode}/revoke`)
  await page.goto(`${BASE}/production/trace`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2200)
  await searchBy(expiredAgain)
  const expiredRowText = (await page.locator('tr', { hasText: String(expiredAgain) }).first()
    .innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(expiredRowText.includes('已过期') && !expiredRowText.includes('已作废')
    && expiredRowText.includes('2020-02-01'),
    '到期码在列表显示「已过期」（旧表把 revoked 与 expired 压成一档，到期码被说成人为作废）',
    expiredRowText.slice(0, 56))
  await searchBy(expiryCode)
  const revokedRowText = (await page.locator('tr', { hasText: String(expiryCode) }).first()
    .innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(revokedRowText.includes('已作废') && !revokedRowText.includes('已过期'),
    '人为作废的码显示「已作废」，与到期码在同一页各说各话', revokedRowText.slice(0, 56))
  await page.screenshot({ path: path.join(OUT, '19-trace-status-wording.png'), fullPage: false })

  /* ---------- 行内「全链路→」：批次键接通后这个入口才真的存在（以前恒为"未关联批次"） ---------- */
  await searchBy(batch.batchNo)
  const createdCell = (await page.locator('tr', { hasText: String(batch.batchNo) }).first()
    .locator('td').nth(5).innerText().catch(() => '')).replace(/\s+/g, ' ')
  check(/^\d{4}-\d{2}-\d{2}$/.test(createdCell),
    '「生成时间」列按 createdAt 出真实日期（出参以前只给 updatedAt，页面读的是 createdAt，整列是 "-"）',
    `单元格=${createdCell}`)
  const chainLink = page.locator('tr', { hasText: String(batch.batchNo) }).first()
    .locator('a.ant-typography', { hasText: '全链路' })
  const noLinkRows = (await page.locator('.ant-table-tbody tr.ant-table-row').allInnerTexts())
    .filter((line) => line.includes('未关联批次')).length
  check(await chainLink.count() > 0 && noLinkRows === 0,
    '本批次每一行都给出「全链路→」而不是"未关联批次"（出参以前没有 batchId，这一列常年是后者）',
    `链接 ${await chainLink.count()} 个 / 未关联批次 ${noLinkRows} 行`)
  await chainLink.first().click()
  await page.waitForTimeout(2800)
  const chainUrl = page.url()
  const chainPageText = await text(page)
  check(chainUrl.includes('/production/trace/full-chain') && chainUrl.includes(`batchId=${ids.batch}`)
    && chainPageText.includes(String(batch.batchNo)),
    '点进去就是该批次的全链路，页面顶部显示的批次号与列表同源',
    `${chainUrl.split('/production/')[1] ?? chainUrl} · ${chainPageText.includes(String(batch.batchNo)) ? '批次号对得上' : '批次号没出现'}`)
  await page.screenshot({ path: path.join(OUT, '22-trace-row-to-fullchain.png'), fullPage: false })

  /* ---------- 质检列表：筛选与分页同样搬到服务端（以前取 200 条本地筛 + 本地翻页） ---------- */
  // 机构下拉的取值来自机构表，所以这里用库里真的存在的两家：用不存在的名字，页面下拉里选不到，
  // 测的就不是"用户能做的事"
  const labRows = (await api(farmerLogin.accessToken, 'GET', '/quality/labs?page=1&size=10'))?.records ?? []
  const labA = String(labRows[0]?.labName ?? '')
  const labB = String(labRows[1]?.labName ?? '')
  check(Boolean(labA) && Boolean(labB), '取到两家机构用于质检列表的机构筛选', `${labA} / ${labB}`)
  const qcNos = []
  for (let i = 0; i < 12; i += 1) {
    const no = `QC-UI-${suffix}-${String(i + 1).padStart(2, '0')}`
    qcNos.push(no)
    await api(farmerLogin.accessToken, 'POST', '/quality/inspections', {
      inspectionNo: no, batchId: ids.batch, batchNo: batch.batchNo, farmId: farmCtx.farmId, plotId: ids.plot,
      cropName: batch.cropName ?? 'UI联调作物', inspectionType: 'SEND',
      labName: i < 6 ? labA : labB, sampleQty: 1,
      sampleAt: `2026-10-${String(i + 1).padStart(2, '0')} 09:00:00`,
      inspectorName: 'UI联调', remark: `UI联调质检-${suffix}`,
    })
  }
  ids.qcInspections = qcNos
  const qcRequests = []
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/production/quality/inspections?')) qcRequests.push(request.url())
  })
  const lastQcRequest = () => qcRequests.filter((u) => !/size=1(&|$)/.test(u)).pop() ?? ''
  const qcRowTexts = async () => (await page.locator('.ant-table-tbody tr.ant-table-row').allInnerTexts())
    .map((line) => line.replace(/\s+/g, ' '))
  const qcPagerTotal = async () => Number((((await page.locator('.ant-pagination-total-text')
    .innerText().catch(() => '')).match(/共 (\d+) 条/)) ?? [])[1] ?? -1)

  await page.goto(`${BASE}/production/quality`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(2500)
  await page.locator('input[placeholder*="搜索检测编号"]').fill(`QC-UI-${suffix}`)
  await page.locator('button', { hasText: /查\s*询/ }).first().click()
  await page.waitForTimeout(2200)
  const qcFirstRequest = lastQcRequest()
  const qcRows1 = await qcRowTexts()
  const qcTotalAll = await qcPagerTotal()
  check(qcFirstRequest.includes('page=1') && qcFirstRequest.includes('size=10')
    && qcTotalAll === 12 && qcRows1.length === 10,
    '质检列表首屏按 page=1&size=10 取数：关键字在服务端筛出 12 条，本页只有 10 行（旧版一次取 200 条再本地翻页）',
    `${qcFirstRequest.match(/page=\d+&size=\d+/)?.[0] ?? ''} · 本页 ${qcRows1.length} 行 · 共 ${qcTotalAll} 条`)

  await page.locator('.ant-pagination-item-2').click()
  await page.waitForTimeout(2200)
  const qcRows2 = await qcRowTexts()
  check(lastQcRequest().includes('page=2') && qcRows2.length === 2
    && qcRows2.every((line) => !qcRows1.some((first) => first === line)),
    '质检第 2 页换了一次服务端请求：剩下 2 条与第 1 页不重复',
    `${lastQcRequest().match(/page=\d+&size=\d+/)?.[0] ?? ''} · 第 2 页 ${qcRows2.length} 行`)
  await page.screenshot({ path: path.join(OUT, '23-quality-server-page2.png'), fullPage: false })

  await page.locator('.ant-form-item:has-text("结果") .ant-select').first().click()
  await page.waitForTimeout(600)
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: '待检' }).first().click()
  await page.locator('button', { hasText: /查\s*询/ }).first().click()
  await page.waitForTimeout(2200)
  const pendingRows = await qcRowTexts()
  check(lastQcRequest().includes('result=PENDING') && pendingRows.length > 0
    && !pendingRows.some((line) => line.includes('合格') || line.includes('不合格')),
    '「待检」筛的是"还没出结论"的单（库里 result 为空，按等值筛 PENDING 会一条都不剩）',
    `${lastQcRequest().match(/result=[^&]+/)?.[0] ?? ''} · ${pendingRows.length} 行`)

  await page.locator('.ant-form-item:has-text("机构") .ant-select').first().click()
  await page.waitForTimeout(600)
  await page.locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: labA }).first().click()
  await page.locator('button', { hasText: /查\s*询/ }).first().click()
  await page.waitForTimeout(2200)
  const labRowsUi = await qcRowTexts()
  check(lastQcRequest().includes('labName=') && labRowsUi.length > 0
    && labRowsUi.every((line) => line.includes(labA)) && !labRowsUi.some((line) => line.includes(labB)),
    '机构筛选走服务端：换机构后列表里只剩这一家的单（旧版只在已取回的那 200 条里比字符串，翻页就丢）',
    `${decodeURIComponent(lastQcRequest().match(/labName=[^&]*/)?.[0] ?? '')} · ${labRowsUi.length} 行`)
  await page.screenshot({ path: path.join(OUT, '24-quality-server-filter.png'), fullPage: false })

  check(pageErrors.length === 0, '用户端页面无运行时异常', pageErrors.slice(0, 2).join(' | '))
  check(adminErrors.length === 0, '运营端审批页无运行时异常', adminErrors.slice(0, 2).join(' | '))
} finally {
  await browser?.close().catch(() => {})
  // 逻辑删除写 1（与 @TableLogic 的 logic-delete-value 一致），不再写 deleted = id
  const softDelete = (table, where) =>
    sql(`UPDATE agri_production.${table} SET deleted = 1 WHERE ${where}`)
  if (ids.batch) {
    softDelete('agri_prod_inventory', `batch_id = '${ids.batch}'`)
    softDelete('agri_prod_inventory_flow', `batch_id = '${ids.batch}'`)
    softDelete('agri_prod_trace_code', `harvest_id = '${ids.batch}'`)
    softDelete('agri_prod_harvest_batch', `id = '${ids.batch}'`)
  }
  if (ids.inspection) softDelete('agri_prod_inspection', `id = '${ids.inspection}'`)
  // 质检分页那 12 张按单号清掉（只为验证服务端筛选与分页而存在）
  if (ids.qcInspections.length) {
    softDelete('agri_prod_inspection',
      `inspection_no IN (${ids.qcInspections.map((no) => `'${no}'`).join(',')})`)
  }
  if (ids.input) {
    softDelete('agri_prod_input_usage', `id = '${ids.usage}'`)
    softDelete('agri_prod_input_stock_flow', `input_id = '${ids.input}'`)
    softDelete('agri_prod_input_material', `id = '${ids.input}'`)
    // 页面点「上链」写进去的存证按业务键清掉（它不属于业务台账，留着会污染存证条数）
    sql(`DELETE FROM agri_production.agri_prod_chain_record
         WHERE target_type = 'INPUT' AND target_code = '${ids.usage}'`)
  }
  if (ids.task) softDelete('agri_prod_task_info', `id = '${ids.task}'`)
  if (ids.stage) softDelete('agri_prod_plan_stage', `id = '${ids.stage}'`)
  if (ids.plan) softDelete('agri_prod_planting_plan', `id = '${ids.plan}'`)
  if (ids.approval) softDelete('agri_prod_approval', `approval_code = '${ids.approval}'`)
  if (ids.plot) softDelete('agri_prod_plot_info', `id = '${ids.plot}'`)
  softDelete('agri_prod_message_notify', `content LIKE '%${suffix}%' OR title LIKE '%${suffix}%'`)
  softDelete('agri_prod_alert_record', `content LIKE '%${suffix}%' OR title LIKE '%${suffix}%'`)
  if (ids.chainRecords.length) {
    sql(`DELETE FROM agri_production.agri_prod_chain_record
         WHERE record_no IN (${ids.chainRecords.map((no) => `'${no}'`).join(',')})`)
  }
  const uiResidue = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_chain_record WHERE record_no LIKE 'CHAIN-UI-%'`)
  const uiQcResidue = sql(`SELECT COUNT(*) FROM agri_production.agri_prod_inspection WHERE inspection_no LIKE 'QC-UI-%' AND deleted = 0`)
  check(uiResidue === '0' && uiQcResidue === '0', '清理后库内没有 UI 存证残留、没有 UI 检测单残留',
    `存证=${uiResidue} 检测单=${uiQcResidue}`)
  console.log('\n清理：UI 联调数据已按主键逻辑删除（deleted=1），存证记录已物理删除')
}

console.log('')
if (!failures.length) {
  console.log('生产主链路浏览器点检全部通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((label) => console.log('  -', label))
process.exit(1)
