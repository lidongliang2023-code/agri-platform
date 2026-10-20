#!/usr/bin/env node
/** 主数据运营中心回归（2026-10-20）。真实接口在后端/SSO 未启动时用受控 mock 验证交互。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8080'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const pageBody = (rows, total = rows.length) => ({ code: 200, message: 'ok', data: { list: rows, total, pageNum: 1, pageSize: 8, pages: Math.ceil(total / 8) } })
const users = [
  { id: 1, userCode: 'U-100238', username: 'zhang1968', realName: '张建国', phone: '13800006210', userType: 'individual', realNameStatus: 'verified', userStatus: 'active', createTime: '2026-10-19 09:12:00' },
  { id: 2, userCode: 'U-100241', username: 'ljcoop', realName: '李家村合作社', phone: '13900008802', userType: 'enterprise', realNameStatus: 'verified', userStatus: 'active', createTime: '2026-10-19 08:47:00' },
  { id: 3, userCode: 'U-100190', username: 'chen_orchard', realName: '陈志远', phone: '13300005590', userType: 'individual', realNameStatus: 'pending', userStatus: 'active', createTime: '2026-10-18 20:11:00' },
]
const roles = [
  { id: 1, roleCode: 'ROLE_PLATFORM_ADMIN', roleName: '平台管理员', roleKey: 'platform_admin', dataScope: 1, status: 1, createTime: '2026-10-01 10:00:00' },
  { id: 2, roleCode: 'ROLE_OPS_STAFF', roleName: '运营专员', roleKey: 'ops_staff', dataScope: 2, status: 1, createTime: '2026-10-02 10:00:00' },
  { id: 3, roleCode: 'ROLE_CONTENT_AUDIT', roleName: '内容审核员', roleKey: 'content_audit', dataScope: 3, status: 0, createTime: '2026-10-03 10:00:00' },
]
const products = [
  { id: 1, productCode: 'SPU-100011', productName: '富硒大米', categoryName: '粮油', unit: '25kg/袋', brand: '福康粮油', status: 1, createTime: '2026-10-18 11:20:00' },
  { id: 2, productCode: 'SPU-100024', productName: '一级压榨菜籽油', categoryName: '粮油', unit: '5L×4桶/箱', brand: '中粮油脂', status: 1, createTime: '2026-10-18 10:00:00' },
]
const customers = [
  { id: 1, customerCode: 'C-1001', customerName: '广厦供应链管理有限公司', customerType: 'enterprise', contactName: '陈立', status: 1 },
  { id: 2, customerCode: 'C-1002', customerName: '万家惠连锁超市有限公司', customerType: 'enterprise', contactName: '刘敏', status: 1 },
]
const suppliers = [
  { id: 1, supplierCode: 'S-1001', supplierName: '福康粮油食品有限公司', supplierType: 'manufacturer', contactPerson: '张伟', status: 1 },
  { id: 2, supplierCode: 'S-1002', supplierName: '赣南果业发展有限公司', supplierType: 'dealer', contactPerson: '黄强', status: 1 },
]
const dicts = [
  { id: 1, dictCode: 'MD_CATEGORY', dictName: '商品品类标准', status: 1, createTime: '2026-10-10 10:00:00' },
  { id: 2, dictCode: 'MD_REGION', dictName: '产地编码字典', status: 1, createTime: '2026-10-11 10:00:00' },
]
const codeRules = [
  { id: 1, ruleCode: 'RULE_USER', ruleName: '用户编码规则', status: 1, createTime: '2026-10-12 10:00:00' },
]
const qualityIssues = [
  { id: 1, issueCode: 'QI-1001', severity: 'high', issueType: '唯一性', description: '企业实名存在重复记录', status: 'pending', detectTime: '2026-10-20 03:02:00' },
  { id: 2, issueCode: 'QI-1002', severity: 'medium', issueType: '时效性', description: '供应商资质即将过期', status: 'processing', detectTime: '2026-10-20 03:05:00' },
]

let lastUserQuery = ''
const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    const pathname = url.pathname
    const json = (body) => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })

    if (pathname === '/api/v1/auth/refresh') {
      return json({
        code: 0,
        message: 'ok',
        data: {
          accessToken: 'e2e-token',
          expiresIn: 3600,
          user: { id: '1', username: 'e2e_admin', nickname: '运营管理员', roles: ['SUPER_ADMIN'] },
        },
      })
    }
    if (pathname === '/admin/masterdata/dashboard') {
      return json({ code: 200, message: 'ok', data: { coreMetrics: { tenantCount: 12, userCount: 386, orgCount: 27 }, pendingAudit: {}, alerts: [] } })
    }
    if (pathname === '/admin/masterdata/user/list') {
      lastUserQuery = url.search
      return json(pageBody(users, 386))
    }
    if (pathname === '/admin/masterdata/permission/role/list') return json(pageBody(roles, 3))
    if (pathname === '/admin/masterdata/product/list') return json(pageBody(products, 24))
    if (pathname === '/admin/masterdata/customer/list') return json(pageBody(customers, 6))
    if (pathname === '/admin/masterdata/customer/supplier/list') return json(pageBody(suppliers, 5))
    if (pathname === '/admin/masterdata/standard/dict/list') return json(pageBody(dicts, 4))
    if (pathname === '/admin/masterdata/standard/code-rule/list') return json(pageBody(codeRules, 3))
    if (pathname === '/admin/masterdata/quality/statistics') {
      return json({ code: 200, message: 'ok', data: { totalIssues: 12, highSeverityCount: 3, mediumSeverityCount: 5, resolutionRate: 75 } })
    }
    if (pathname === '/admin/masterdata/quality/issues') return json(pageBody(qualityIssues, 12))
    if (pathname === '/admin/masterdata/quality/rules') return json(pageBody(codeRules, 4))
    return request.continue()
  })

  await page.goto(`${BASE}/masterdata/center`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.md-center', { timeout: 20000 })
  await sleep(400)

  const text = await page.evaluate(() => document.body.innerText)
  check(text.includes('主数据运营中心') && text.includes('统一用户'), '主数据运营中心已渲染')
  check((await page.$$eval('.md-stat-card', (items) => items.length)) === 5, '顶部五项主数据指标已展示')
  check(text.includes('386') && text.includes('24') && text.includes('6') && text.includes('5'), '真实接口统计已映射到指标卡')
  check((await page.$$eval('.md-tab', (items) => items.length)) === 9, '九个主数据运营页签齐全')
  check(text.includes('138****6210'), '用户手机号已脱敏展示')

  await page.evaluate(() => {
    const input = document.querySelector('.md-panel .md-search input')
    input.value = '张'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await page.evaluate(() => document.querySelector('.md-panel .md-search button')?.click())
  await sleep(300)
  check(decodeURIComponent(lastUserQuery).includes('username=张'), '用户关键词搜索已调用接口', lastUserQuery)

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.md-tab')].find((item) => item.textContent.includes('统一权限'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('ROLE_PLATFORM_ADMIN'))
  check(page.url().includes('tab=roles') && (await page.evaluate(() => document.body.innerText)).includes('运营专员'),
    '统一权限页签可切换并加载真实角色')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.md-tab')].find((item) => item.textContent.includes('统一商品'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('SPU-100011'))
  check((await page.evaluate(() => document.body.innerText)).includes('富硒大米'), '统一商品页签展示商品主数据')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.md-tab')].find((item) => item.textContent.includes('客户 / 供应商'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('S-1001'))
  const partnerText = await page.evaluate(() => document.body.innerText)
  check(partnerText.includes('广厦供应链管理有限公司') && partnerText.includes('福康粮油食品有限公司'),
    '客户与供应商双栏数据已展示')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.md-tab')].find((item) => item.textContent.includes('数据治理'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('商品品类标准'))
  check((await page.evaluate(() => document.body.innerText)).includes('用户编码规则'), '数据治理页签展示字典与编码规则')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.md-tab')].find((item) => item.textContent.includes('主数据运营大盘'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('主数据资产分布'))
  check((await page.$$eval('.md-distribution > div', (items) => items.length)) >= 6, '运营大盘展示主数据资产分布')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.md-tab')].find((item) => item.textContent.includes('主数据模型'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('MD_ORGANIZATION'))
  const modelText = await page.evaluate(() => document.body.innerText)
  check(modelText.includes('目录只读') && modelText.includes('模型字段、版本与关系接口尚未接入'),
    '主数据模型只展示真实条目并标明未接入范围')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.md-tab')].find((item) => item.textContent.includes('数据源采集池'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('数据源采集池尚未接入'))
  check((await page.evaluate(() => document.body.innerText)).includes('不使用示例数字填充'),
    '数据源采集池未接入时如实说明')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.md-tab')].find((item) => item.textContent.includes('数据质量监控'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('QI-1001'))
  check((await page.evaluate(() => document.body.innerText)).includes('企业实名存在重复记录'), '数据质量页签展示真实问题列表')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.md-tab')].find((item) => item.textContent.includes('统一用户'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('U-100238'))
  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)
  await page.screenshot({ path: path.join(OUT, 'masterdata-center.png'), fullPage: true })

  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${BASE}/masterdata/center?tab=overview`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.md-center', { timeout: 20000 })
  await page.evaluate(() => document.querySelector('.md-center')?.scrollIntoView({ block: 'start' }))
  await sleep(300)
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(mobileOverflow <= 1, '390px 移动端无横向溢出', String(mobileOverflow))
  await page.screenshot({ path: path.join(OUT, 'masterdata-center-mobile.png'), fullPage: true })
  check(errors.length === 0, '主数据运营中心无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '主数据运营中心回归脚本未抛异常', String(error).slice(0, 240))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
