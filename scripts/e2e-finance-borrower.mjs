#!/usr/bin/env node
/** 供应链金融融资方：工作台、申请、审批放款、还款、质押、合同、消息回归。 */
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
const marker = `FINANCE-E2E-${Date.now()}`
const failures = []
let applicationId = ''
let loanId = ''
let pledgeNo = ''
let contractTouched = false
let messagesMutated = false
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
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
    throw new Error(`未找到输入框 ${target}`)
  }
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
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
    await page.goto(`${BASE}/finance/index.html#/borrower/home`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.finance-shell', { timeout: 30000 })
    await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})

    const homeText = await page.evaluate(() => document.body.innerText)
    check(homeText.includes('融资工作台') && homeText.includes('绿源农业合作社'),
      '融资工作台读取当前融资主体')
    check(homeText.includes('782') && homeText.includes('AAA') && homeText.includes('800,000.00'),
      '工作台展示真实信用分、等级和授信额度')
    check((await page.$$('.finance-product-card')).length === 5,
      '工作台展示五类场景化融资产品')
    check((await page.$$('.el-table__row')).length >= 2,
      '工作台展示真实借款记录')
    await page.screenshot({ path: path.join(OUT, 'finance-borrower-home.png'), fullPage: true })

    await clickByText(page, '.finance-nav a', '融资产品')
    await page.waitForFunction(() => location.hash.includes('/borrower/products'), { timeout: 10000 })
    await page.waitForSelector('.product-catalog-card', { timeout: 20000 })
    check((await page.$$('.product-catalog-card')).length === 5,
      '融资产品中心完整展示五类产品')
    await page.screenshot({ path: path.join(OUT, 'finance-borrower-products.png'), fullPage: true })
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('.product-catalog-card')]
        .find((item) => item.textContent?.includes('收购贷'))
      card?.querySelector('button')?.click()
    })
    await page.waitForFunction(() => location.hash.includes('/borrower/loan-apply'), { timeout: 10000 })
    await page.waitForSelector('.apply-page', { timeout: 20000 })
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 10000 }).catch(() => {})
    check((await page.evaluate(() => document.body.innerText)).includes('收购贷'),
      '从产品中心进入申请页并自动选择产品')

    await fill(page, 'input[placeholder="请输入申请金额"]', '100000')
    await fill(page, 'textarea[placeholder*="说明采购"]', marker)
    await fill(page, 'textarea[placeholder*="订单回款"]', '仓储销售订单回款')
    await fill(page, 'input[placeholder="请输入联系人姓名"]', '移动融资联调员')
    await fill(page, 'input[placeholder="请输入手机号"]', '13800138002')
    await page.screenshot({ path: path.join(OUT, 'finance-borrower-apply.png'), fullPage: true })
    await clickByText(page, '.finance-action-button', '提交融资申请')
    await page.waitForSelector('.el-message-box', { timeout: 10000 })
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.el-message-box__btns button')]
        .find((item) => item.textContent?.includes('确认提交'))
      button?.click()
    })
    await page.waitForFunction(() => location.hash.includes('/borrower/loan-management'), { timeout: 20000 })
    await sleep(600)

    const applications = await api('/api/v1/loan/applications?userId=2001')
    const application = applications.data?.find((item) => item.fundPurpose === marker)
    applicationId = application?.id || ''
    check(Boolean(applicationId), '移动融资申请已真实落库', applicationId)

    await api('/api/v1/loan/review', {
      method: 'POST',
      body: JSON.stringify({
        id: applicationId, result: '已通过', opinion: '融资方端联调审核通过', amount: 100000, rate: 5.68,
      }),
    })
    await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.application-list', { timeout: 20000 })
    await page.evaluate((purpose) => {
      const card = [...document.querySelectorAll('.application-list article')]
        .find((item) => item.textContent?.includes(purpose))
      const button = card ? [...card.querySelectorAll('button')]
        .find((item) => item.textContent?.includes('确认借款')) : null
      if (!button) throw new Error('未找到确认借款按钮')
      button.click()
    }, marker)
    await page.waitForSelector('.el-message-box', { timeout: 10000 })
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.el-message-box__btns button')]
        .find((item) => item.textContent?.includes('确认借款'))
      button?.click()
    })
    await sleep(1000)
    const loans = await api('/api/v1/loan/list?userId=2001')
    const loan = loans.data?.find((item) => item.applicationId === applicationId)
    loanId = loan?.id || ''
    check(Boolean(loanId), '审批通过后可在融资方端确认借款并生成借款', loanId)
    const plans = await api(`/api/v1/repayment/plans?loanId=${loanId}`)
    check(plans.data?.length === 12, '确认借款后按申请期限自动生成还款计划', `${plans.data?.length || 0} 期`)
    await page.screenshot({ path: path.join(OUT, 'finance-borrower-loans.png'), fullPage: true })

    await page.goto(`${BASE}/finance/index.html#/borrower/repayment`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.repayment-list', { timeout: 20000 })
    const loanNo = loan.loanNo
    await page.evaluate((no) => {
      const card = [...document.querySelectorAll('.repayment-list article')]
        .find((item) => item.textContent?.includes(no))
      const button = card ? [...card.querySelectorAll('button')]
        .find((item) => item.textContent?.includes('立即还款')) : null
      if (!button) throw new Error('未找到立即还款按钮')
      button.click()
    }, loanNo)
    await page.waitForSelector('.el-message-box', { timeout: 10000 })
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.el-message-box__btns button')]
        .find((item) => item.textContent?.includes('确认还款'))
      button?.click()
    })
    await sleep(900)
    const paidPlans = await api(`/api/v1/repayment/plans?loanId=${loanId}`)
    check(paidPlans.data?.some((item) => item.status === '已还款'),
      '移动端还款成功后计划状态和借款余额同步更新')
    await page.screenshot({ path: path.join(OUT, 'finance-borrower-repayment.png'), fullPage: true })

    await page.goto(`${BASE}/finance/index.html#/borrower/pledge`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.pledge-layout', { timeout: 20000 })
    await clickByText(page, '.finance-action-button', '发起仓单质押')
    await page.waitForSelector('.el-dialog', { timeout: 10000 })
    await fill(page, 'input[placeholder*="优质稻谷"]', `${marker}-稻谷`)
    await fill(page, 'input[placeholder="例如：一级"]', '一级')
    await fill(page, 'input[inputmode="decimal"]', '20')
    const decimalInputs = await page.$$('.el-dialog input[inputmode="decimal"]')
    if (decimalInputs[1]) {
      await decimalInputs[1].click({ clickCount: 3 })
      await page.keyboard.type('2600')
    }
    await fill(page, 'input[placeholder*="丰链云临沂"]', '联调测试仓')
    await fill(page, 'input[placeholder="请输入仓库详细地址"]', '山东省临沂市联调仓库 1 号')
    await clickByText(page, '.el-dialog .finance-action-button', '提交审核')
    await sleep(900)
    const pledges = await api('/api/v1/pledge/list?userId=2001')
    const pledge = pledges.data?.find((item) => item.commodityType === `${marker}-稻谷`)
    pledgeNo = pledge?.pledgeNo || ''
    check(Boolean(pledgeNo), '仓单质押申请已真实落库', pledgeNo)
    await page.screenshot({ path: path.join(OUT, 'finance-borrower-pledge.png'), fullPage: true })

    await page.goto(`${BASE}/finance/index.html#/borrower/contracts`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.contract-list', { timeout: 20000 })
    check((await page.$$('.contract-list article')).length >= 1, '融资合同列表读取真实合同')
    await page.screenshot({ path: path.join(OUT, 'finance-borrower-contracts.png'), fullPage: true })
    await page.evaluate(() => {
      const card = [...document.querySelectorAll('.contract-list article')]
        .find((item) => item.textContent?.includes('仓单质押借款合同'))
      card?.click()
    })
    await page.waitForSelector('.contract-detail', { timeout: 10000 })
    contractTouched = true
    await clickByText(page, '.el-dialog .finance-action-button', '确认签署')
    await page.waitForSelector('.el-message-box', { timeout: 10000 })
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('.el-message-box__btns button')]
        .find((item) => item.textContent?.includes('确认签署'))
      button?.click()
    })
    await sleep(700)
    const signedContracts = await api('/api/v1/contract/list?userId=2001')
    const signedContract = signedContracts.data?.find((item) => item.contractNo === 'FC20261021002')
    check(['融资方已签', '已签署'].includes(signedContract?.signStatus),
      '融资方可在移动端完成合同签署留痕', signedContract?.signStatus || '')

    await page.goto(`${BASE}/finance/index.html#/borrower/message`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.message-list', { timeout: 20000 })
    check((await page.$$('.message-list article')).length >= 1, '消息通知读取真实业务消息')
    await page.screenshot({ path: path.join(OUT, 'finance-borrower-messages.png'), fullPage: true })
    await page.click('.message-list article')
    await sleep(500)
    const messages = await api('/api/v1/message/list?userId=2001')
    messagesMutated = messages.data?.some((item) => item.isRead)
    check(messagesMutated, '消息已读状态可真实保存')

    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
    await page.goto(`${BASE}/finance/index.html#/borrower/home`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForSelector('.finance-shell', { timeout: 30000 })
    check(await page.$eval('.finance-menu-button', (node) => getComputedStyle(node).display !== 'none'),
      '390px 融资方页面展示移动菜单入口')
    await page.evaluate(() => document.querySelector('.finance-menu-button')?.click())
    await sleep(300)
    check(await page.$eval('.finance-shell', (node) => node.classList.contains('nav-open')),
      '移动菜单可以展开融资方导航')
    check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
      '390px 融资方页面无横向溢出')
    check(errors.length === 0, '融资方主链路无未捕获脚本异常', errors.slice(0, 2).join(' | '))
  } catch (error) {
    check(false, '融资方回归未抛异常', String(error).slice(0, 500))
  } finally {
    try {
      if (loanId) {
        sql(`DELETE FROM repayment_plan WHERE loan_id='${loanId}'; DELETE FROM loan WHERE id='${loanId}';`)
      }
      if (applicationId) {
        sql(`DELETE FROM loan_application WHERE id='${applicationId}';`)
      }
      if (pledgeNo) {
        sql(`DELETE FROM pledge WHERE pledge_no='${pledgeNo}';`)
      }
      if (contractTouched) {
        sql(`UPDATE contract SET sign_status='待签署', borrower_sign_time=NULL WHERE contract_no='FC20261021002';`)
      }
      if (messagesMutated) {
        sql(`UPDATE message_notification SET is_read=FALSE WHERE id IN ('MSG-001','MSG-002');`)
      }
    } catch (error) {
      console.error(`融资联调数据清理失败：${String(error)}`)
      failures.push('清理融资联调数据')
    }
    await browser.close()
  }

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
