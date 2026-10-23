#!/usr/bin/env node
/** 供应链金融资金方端与运营风控端核心业务回归。 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8081'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const marker = `FIN-OPS-E2E-${Date.now()}`
const failures = []
let applicationId = ''
let investmentId = ''
let productTouched = false
let ruleTouched = false
let overdueTouched = false
let pledgeTouched = false
let blacklistTouched = false
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const api = async (requestPath, options) => {
  const response = await fetch(`${BASE}${requestPath}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
  })
  return response.json()
}
const sql = (statement) => execFileSync(MYSQL, [
  '--default-character-set=utf8mb4', '-uroot', '-proot', 'agri_finance', '-e', statement,
], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const fill = async (page, selector, value) => page.evaluate(({ target, next }) => {
  const input = document.querySelector(target)
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) throw new Error(`未找到输入框 ${target}`)
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, next)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}, { target: selector, next: value })
const clickByText = async (page, selector, text) => page.evaluate(({ target, content }) => {
  const element = [...document.querySelectorAll(target)]
    .find((item) => item.textContent?.replace(/\s+/g, '').includes(content.replace(/\s+/g, '')))
  if (!(element instanceof HTMLElement)) throw new Error(`未找到按钮：${content}`)
  element.click()
}, { target: selector, content: text })
const confirmBox = async (page, label) => {
  await page.waitForSelector('.el-message-box', { timeout: 10000 })
  await page.evaluate((text) => {
    const button = [...document.querySelectorAll('.el-message-box__btns button')]
      .find((item) => item.textContent?.includes(text))
    if (!button) throw new Error(`未找到确认按钮：${text}`)
    button.click()
  }, label)
}

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000, deviceScaleFactor: 1 })
  await page.goto(`${BASE}/finance/index.html#/fund/workbench`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.ops-shell', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  const fundHome = await page.evaluate(() => document.body.innerText)
  check(fundHome.includes('丰链云合作银行') && fundHome.includes('累计投资'), '资金方工作台读取认证机构与投资组合')
  check(fundHome.includes('AI 推荐资产') && fundHome.includes('优质稻谷收购周转资产'),
    '资金方工作台展示真实推荐资产')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '资金方桌面页面无横向溢出')
  await page.screenshot({ path: path.join(OUT, 'finance-fund-workbench.png'), fullPage: true })

  await page.goto(`${BASE}/finance/index.html#/fund/asset-market`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.market-asset-grid', { timeout: 20000 })
  check((await page.$$('.market-asset-grid article')).length >= 4, '资产市场读取真实可投资产')
  await page.click('.market-asset-grid article .finance-action-button')
  await page.waitForSelector('.el-dialog', { timeout: 10000 })
  await fill(page, 'input[placeholder="请输入投资金额"]', '1000')
  await page.screenshot({ path: path.join(OUT, 'finance-fund-market.png'), fullPage: true })
  await clickByText(page, '.el-dialog .finance-action-button', '确认配置')
  await confirmBox(page, '确认投资')
  await sleep(900)
  const investments = await api('/api/v1/investment/provider/PROVIDER-BANK-001')
  const createdInvestment = investments.data?.find((item) => Number(item.investmentAmount) === 1000 && item.investmentTime > new Date(Date.now() - 60000).toISOString())
  const allInvestments = investments.data || []
  const tempInvestment = allInvestments.find((item) => Number(item.investmentAmount) === 1000)
  investmentId = tempInvestment?.id || ''
  check(Boolean(investmentId), '资金方可从资产市场完成投资并落库', investmentId)

  await api('/api/v1/loan/apply', {
    method: 'POST',
    body: JSON.stringify({
      userId: '2001', userName: '绿源农业合作社', productType: 'purchase', applyAmount: 80000,
      applyTerm: 6, repaymentMethod: '等额本息', fundPurpose: marker, repaymentSource: '订单销售回款',
      contactName: '联调融资人', contactPhone: '13800138003',
    }),
  })
  const applicationsBefore = await api('/api/v1/loan/applications?userId=2001')
  applicationId = applicationsBefore.data?.find((item) => item.fundPurpose === marker)?.id || ''
  check(Boolean(applicationId), '资金方审批联调申请已创建', applicationId)

  await page.goto(`${BASE}/finance/index.html#/fund/approval`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.el-table__row', { timeout: 20000 })
  await page.evaluate((purpose) => {
    const row = [...document.querySelectorAll('.el-table__row')].find((item) => item.textContent?.includes(purpose))
    const button = row ? [...row.querySelectorAll('button')].find((item) => item.textContent?.includes('审批')) : null
    if (!button) throw new Error('未找到审批按钮')
    button.click()
  }, marker)
  await page.waitForSelector('.review-layout', { timeout: 10000 })
  await clickByText(page, '.el-dialog .finance-action-button', '通过审批')
  await sleep(700)
  const applicationsAfter = await api('/api/v1/loan/applications?userId=2001')
  check(applicationsAfter.data?.find((item) => item.id === applicationId)?.status === '已通过',
    '资金方审批通过后申请状态真实更新')
  await page.screenshot({ path: path.join(OUT, 'finance-fund-approval.png'), fullPage: true })

  await page.goto(`${BASE}/finance/index.html#/fund/product-config`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.el-table__row', { timeout: 20000 })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.el-table__row:first-child button')]
      .find((item) => item.textContent?.includes('编辑'))
    button?.click()
  })
  await page.waitForSelector('.el-dialog', { timeout: 10000 })
  productTouched = true
  await page.evaluate(() => {
    const input = document.querySelector('.el-dialog input')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '5.99')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await clickByText(page, '.el-dialog .finance-action-button', '保存配置')
  await sleep(700)
  const products = await api('/api/v1/product-config')
  check(Number(products.data?.find((item) => item.productCode === 'agri')?.rate) === 5.99,
    '资金方产品参数可维护并落库')

  await page.goto(`${BASE}/finance/index.html#/fund/risk-strategy`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.el-table__row', { timeout: 20000 })
  await page.evaluate(() => {
    const row = document.querySelector('.el-table__row')
    const button = row ? [...row.querySelectorAll('button')].find((item) => item.textContent?.includes('停用')) : null
    button?.click()
  })
  ruleTouched = true
  await sleep(600)
  const rules = await api('/api/v1/risk-control/rules')
  check(rules.data?.find((item) => item.id === 'RULE-001')?.status === '禁用',
    '资金方风控规则可启停并落库')

  await page.goto(`${BASE}/finance/index.html#/admin/workbench`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.ops-shell', { timeout: 20000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  const opsHome = await page.evaluate(() => document.body.innerText)
  check(opsHome.includes('供应链金融风控运营中心') && opsHome.includes('逾期金额'),
    '运营风控工作台读取真实业务与风险数据')
  await page.screenshot({ path: path.join(OUT, 'finance-ops-workbench.png'), fullPage: true })

  await page.goto(`${BASE}/finance/index.html#/admin/overdue`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.el-table__row', { timeout: 20000 })
  overdueTouched = true
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.el-table__row')].find((item) => item.textContent?.includes('FOD20261023001'))
    const button = row ? [...row.querySelectorAll('button')].find((item) => item.textContent?.includes('分配')) : null
    if (!button) throw new Error('未找到逾期分配按钮')
    button.click()
  })
  await page.waitForSelector('.el-dialog', { timeout: 10000 })
  await page.click('.el-dialog .el-select__wrapper')
  await page.waitForSelector('.el-select-dropdown__item', { timeout: 10000 })
  await page.evaluate(() => {
    const option = [...document.querySelectorAll('.el-select-dropdown__item')]
      .find((item) => item.textContent?.includes('陈风控'))
    option?.click()
  })
  await clickByText(page, '.el-dialog .finance-action-button', '确认分配')
  await sleep(700)
  const overdue = await api('/api/v1/overdue/list')
  check(overdue.data?.find((item) => item.id === 'OVERDUE-001')?.collectorName === '陈风控',
    '运营端可分配逾期催收负责人并落库')
  await page.screenshot({ path: path.join(OUT, 'finance-ops-overdue.png'), fullPage: true })

  await page.goto(`${BASE}/finance/index.html#/admin/credit-management`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.credit-profile-hero', { timeout: 20000 })
  const creditText = await page.evaluate(() => document.body.innerText)
  check(creditText.includes('782') && creditText.includes('绿源农业合作社'),
    '运营端信用查询读取真实信用画像')
  await page.screenshot({ path: path.join(OUT, 'finance-ops-credit.png'), fullPage: true })

  await page.goto(`${BASE}/finance/index.html#/admin/pledge`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.el-table__row', { timeout: 20000 })
  pledgeTouched = true
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.el-table__row')].find((item) => item.textContent?.includes('FP20261021002'))
    const button = row ? [...row.querySelectorAll('button')].find((item) => item.textContent?.includes('审核通过')) : null
    if (!button) throw new Error('未找到质押审核按钮')
    button.click()
  })
  await confirmBox(page, '审核通过')
  await sleep(600)
  const pledges = await api('/api/v1/pledge/list?userId=2001')
  check(pledges.data?.find((item) => item.pledgeNo === 'FP20261021002')?.status === '已生效',
    '运营端可审核仓单质押并更新状态')
  await page.screenshot({ path: path.join(OUT, 'finance-ops-pledge.png'), fullPage: true })

  await page.goto(`${BASE}/finance/index.html#/admin/blacklist`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.el-table__row', { timeout: 20000 })
  blacklistTouched = true
  await page.evaluate(() => {
    const row = [...document.querySelectorAll('.el-table__row')].find((item) => item.textContent?.includes('FB2026002'))
    const button = row ? [...row.querySelectorAll('button')].find((item) => item.textContent?.includes('审核通过')) : null
    if (!button) throw new Error('未找到黑名单审核按钮')
    button.click()
  })
  await confirmBox(page, '审核通过')
  await sleep(600)
  const blacklist = await api('/api/v1/blacklist/list')
  check(blacklist.data?.find((item) => item.id === 'BLACKLIST-002')?.reviewStatus === '已通过',
    '运营端可审核黑名单并阻断高风险主体')
  await page.screenshot({ path: path.join(OUT, 'finance-ops-blacklist.png'), fullPage: true })

  await page.goto(`${BASE}/finance/index.html#/admin/report`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.report-layout', { timeout: 20000 })
  check((await page.evaluate(() => document.body.innerText)).includes('报表中心'),
    '运营端报表中心正常打开')

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.goto(`${BASE}/finance/index.html#/fund/workbench`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.finance-menu-button', { timeout: 20000 })
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '资金方 390px 页面无横向溢出')
  check(errors.length === 0, '资金方与运营端主链路无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '资金方/运营端回归未抛异常', String(error).slice(0, 500))
} finally {
  try {
    if (investmentId) {
      sql(`DELETE FROM investment WHERE id='${investmentId}'; UPDATE asset SET available_amount=300000,invested_amount=0,status='可投资' WHERE id='ASSET-002';`)
    }
    if (applicationId) {
      sql(`DELETE FROM loan_application WHERE id='${applicationId}';`)
    }
    if (productTouched) {
      sql(`UPDATE finance_product_config SET rate=5.68 WHERE product_code='agri';`)
    }
    if (ruleTouched) {
      sql(`UPDATE risk_control_rule SET status='启用' WHERE id='RULE-001';`)
    }
    if (overdueTouched) {
      sql(`UPDATE overdue_record SET collector_id='collector-01',collector_name='王催收' WHERE id='OVERDUE-001';`)
    }
    if (pledgeTouched) {
      sql(`UPDATE pledge SET status='待审核',release_date=NULL WHERE pledge_no='FP20261021002';`)
    }
    if (blacklistTouched) {
      sql(`UPDATE blacklist SET review_status='待复核',reviewer_id=NULL,reviewer_name=NULL WHERE id='BLACKLIST-002';`)
    }
  } catch (error) {
    console.error(`资金/运营测试数据清理失败：${String(error)}`)
    failures.push('清理资金/运营测试数据')
  }
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
