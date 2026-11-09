#!/usr/bin/env node
/**
 * 官网门户联调（2026-10-20）。
 *
 * 覆盖：
 *   1. 首页各区块与示例数据标注；
 *   2. 站内搜索 → 交易大厅（产业链频道已并入）关键词过滤；
 *   3. 交易大厅一级/二级/产地筛选与价格排序；
 *   4. 认证中心 FAQ；
 *   5. 企业认证资料登记：必填校验 → 分步填写 → 未登录提交拦截；
 *   6. 个人实名：身份证校验位 → 分步填写 → 未登录提交拦截。
 *
 * 用法：node scripts/e2e-portal.mjs [--base=http://localhost:8098] [--headful]
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const BASE = arg('base', 'http://localhost:8098')
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const fill = async (page, selector, value) => {
  await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel)
    if (!input) throw new Error(`未找到输入框 ${sel}`)
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { sel: selector, val: value })
}

const clickText = async (page, text, scope = 'button') => {
  await page.evaluate(({ label, selector }) => {
    const target = [...document.querySelectorAll(selector)]
      .find((el) => (el.textContent ?? '').replace(/\s/g, '').includes(label.replace(/\s/g, '')))
    if (!target) throw new Error(`未找到可点击元素 ${label}`)
    target.click()
  }, { label: text, selector: scope })
  await sleep(250)
}

const HALL_FRAME = 'iframe[title="丰链云交易大厅"]'

/** 生成校验位正确的 18 位测试身份证号（不对应真实人员）。 */
const testId = () => {
  const base = '11010519900101001'
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const sum = base.split('').reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0)
  return base + codes[sum % 11]
}

const browser = await chromium.launch({ headless: !HEADFUL, executablePath: BROWSER, args: ['--no-sandbox'] })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error)))

  // ---------- 首页 ----------
  await page.goto(`${BASE}/portal/`, { waitUntil: 'networkidle', timeout: 60000 })
  await sleep(500)
  const homeText = await page.evaluate(() => document.body.innerText)
  check(homeText.includes('从田间到餐桌') && homeText.includes('产业链频道') && homeText.includes('价格指数')
    && homeText.includes('产业资讯') && homeText.includes('平台公告'), '首页五个核心区块齐全')
  const liveApi = await page.evaluate(async () => {
    try {
      const response = await fetch('/api/trade/public/products?limit=1')
      return await response.json()
    } catch {
      return null
    }
  })
  const hasLive = liveApi?.code === 200 && Array.isArray(liveApi.data) && liveApi.data.length > 0
  const marketApi = await page.evaluate(async () => {
    try {
      return await (await fetch('/api/v1/info/public/markets')).json()
    } catch {
      return null
    }
  })
  const quoteRecords = Array.isArray(marketApi?.data?.quotes) ? marketApi.data.quotes : []
  check(hasLive ? homeText.includes('实时在售') : homeText.includes('暂无在售'),
    hasLive ? '交易域有数据时首页展示「实时在售」' : '交易域无数据时首页展示无在售空态')
  check(quoteRecords.length > 0
    ? homeText.includes('平台行情') && homeText.includes(quoteRecords[0].name)
    : homeText.includes('暂无行情'),
  quoteRecords.length > 0 ? '首页价格指数展示资讯域真实行情' : '行情为空时首页不展示模拟价格')
  const channelApi = await page.evaluate(async () => {
    try {
      return await (await fetch('/api/v1/info/public/channels')).json()
    } catch {
      return null
    }
  })
  const channelList = Array.isArray(channelApi?.data) ? channelApi.data : []
  check(channelApi?.code === 200 && channelList.length > 0, '产业资讯 tab 来自资讯域公开栏目接口',
    `共 ${channelList.length} 个栏目`)
  const announcementApi = await page.evaluate(async () => {
    try {
      return await (await fetch('/api/master-data/public/announcements?limit=5')).json()
    } catch {
      return null
    }
  })
  const announcementList = Array.isArray(announcementApi?.data) ? announcementApi.data : []
  check(announcementApi?.code === 200, '平台公告来自主数据公开只读接口')
  check(announcementList.length === 0
    ? homeText.includes('运营端暂无已发布的平台公告')
    : homeText.includes(announcementList[0].title),
  announcementList.length === 0 ? '无已发布公告时公告块如实展示空态' : '公告块渲染最新一条已发布公告')
  check(!homeText.replace(/\s+/g, '').includes('1268亿'), '首页大盘不再使用写死的成交金额')
  if (hasLive) {
    check(homeText.includes(liveApi.data[0].productName), '首页展示交易域真实已发布商品', liveApi.data[0].productName)
  }
  const loginButton = await page.evaluate(() => [...document.querySelectorAll('.portal-top-actions button')]
    .find((el) => (el.textContent ?? '').includes('登录'))?.textContent?.trim())
  const registerHref = await page.evaluate(() => [...document.querySelectorAll('.portal-top-actions a')]
    .find((el) => (el.textContent ?? '').includes('免费注册'))?.getAttribute('href'))
  check(loginButton?.includes('登录'), '未登录时首页显示登录入口', loginButton ?? '')
  await clickText(page, '登录')
  await page.waitForFunction(() => location.href.includes('client_id=portal'), undefined, { timeout: 10000 })
    .catch(() => {})
  const ssoUrl = page.url()
  check(ssoUrl.startsWith('http://localhost:8090/') && ssoUrl.includes('client_id=portal')
    && ssoUrl.includes('code_challenge=') && ssoUrl.includes('code_challenge_method=S256')
    && ssoUrl.includes('state=') && decodeURIComponent(ssoUrl).includes('redirect_uri=http://localhost:8098/portal/'),
  '登录入口进入统一认证并带上 PKCE 参数（未登录时 /authorize 会先落到认证中心的登录页）', ssoUrl)
  await page.goto(`${BASE}/portal/index.html`, { waitUntil: 'networkidle', timeout: 60000 })
  await sleep(400)
  check(registerHref?.includes(':8090/register'), '首页注册入口指向统一认证中心注册页', registerHref ?? '')

  // ---------- 搜索 ----------
  await fill(page, '.header-search input', '大闸蟹')
  await page.click('.header-search button')
  await page.waitForFunction(() => location.hash.includes('/hall?q='), undefined, { timeout: 10000 })
  const hallFrame = page.frameLocator(HALL_FRAME)
  await hallFrame.locator('.hall-product').first().waitFor({ state: 'visible', timeout: 20000 })
  await sleep(300)
  check((await hallFrame.locator('.hall-product').count()) === 1, '站内搜索「大闸蟹」在交易大厅过滤出 1 个货源')
  const searchText = await hallFrame.locator('body').innerText()
  check(searchText.includes('阳澄湖大闸蟹'), '搜索结果包含交易域真实大闸蟹货源')

  // ---------- 筛选 + 排序 ----------
  await page.goto(`${BASE}/portal/#/hall`, { waitUntil: 'networkidle' })
  await hallFrame.locator('.hall-product').first().waitFor({ state: 'visible', timeout: 20000 })
  await hallFrame.locator('.hall-chips button').filter({ hasText: '果蔬产业' }).first().click()
  await sleep(600)
  const hallTrail = await hallFrame.locator('.hall-trail').innerText()
  const hallTotal = Number(/匹配\s*(\d+)\s*个货源/.exec(hallTrail)?.[1] ?? '-1')
  const shownCards = await hallFrame.locator('.hall-product').count()
  check(hallTotal >= 0 && shownCards === Math.min(9, hallTotal),
    '一级产业「果蔬产业」声明的货源数与列表一致', `卡片=${shownCards} 总数=${hallTotal}`)
  check(hallTotal <= 9 || (await hallFrame.locator('.hall-pager').count()) > 0,
    '结果超过一页时分页器出现', `总数=${hallTotal}`)
  await hallFrame.locator('.hall-chips button').filter({ hasText: '苹果' }).first().click()
  await sleep(600)
  const appleTrail = await hallFrame.locator('.hall-trail').innerText()
  check(appleTrail.includes('苹果') && (await hallFrame.locator('.hall-product').count()) > 0,
    '二级品类「苹果」筛选出真实货源')
  await hallFrame.locator('.hall-province-group button').filter({ hasText: '陕西' }).first().click()
  await sleep(600)
  const provinceTrail = await hallFrame.locator('.hall-trail').innerText()
  const provinceText = await hallFrame.locator('.hall-list').innerText()
  check(provinceTrail.includes('产地：陕西') && provinceText.includes('陕西'),
    '产地「陕西」筛选后列表展示陕西货源')

  await page.goto(`${BASE}/portal/#/hall`, { waitUntil: 'networkidle' })
  await hallFrame.locator('.hall-product').first().waitFor({ state: 'visible', timeout: 20000 })
  // 地址栏 hash 未变时 iframe 不会重载，上一轮的产业/产地筛选仍在 iframe 内生效，先清空
  await hallFrame.locator('.hall-reset').first().click()
  await sleep(600)
  await hallFrame.locator('.hall-toolbar .hall-chips button').filter({ hasText: '价格从低到高' }).first().click()
  await sleep(600)
  const priceColumn = await hallFrame.locator('.hall-price').evaluateAll((nodes) => nodes
    .map((node) => Number((/¥\s*([\d,.]+)/.exec(node.textContent ?? '')?.[1] ?? 'NaN').replace(/,/g, '')))
    .filter((value) => !Number.isNaN(value)))
  check(priceColumn.length > 1 && priceColumn.every((value, index) => index === 0 || value >= priceColumn[index - 1]),
    '价格升序在整页上单调不减', priceColumn.join(' ≤ '))

  // ---------- 认证中心 FAQ ----------
  await page.goto(`${BASE}/portal/#/certify`, { waitUntil: 'networkidle' })
  await sleep(300)
  const faqBefore = await page.evaluate(() => document.querySelectorAll('.portal-faq-item.open').length)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.portal-faq-item button')].find((el) => (el.textContent ?? '').includes('企业认证审核需要多久'))
    btn?.click()
  })
  await sleep(200)
  const faqAfter = await page.evaluate(() => [...document.querySelectorAll('.portal-faq-item.open')]
    .map((el) => el.textContent ?? '').join(' '))
  check(faqBefore === 1 && faqAfter.includes('1-3 个工作日'), '认证 FAQ 可展开并显示审核时效')

  // ---------- 企业认证资料登记 ----------
  await page.goto(`${BASE}/portal/#/certify/enterprise`, { waitUntil: 'networkidle' })
  await sleep(300)
  await clickText(page, '下一步')
  const entError = await page.evaluate(() => document.querySelector('.portal-form-error')?.textContent ?? '')
  check(entError.includes('企业名称'), '企业认证：空表提交被必填校验拦下')

  await fill(page, 'input[placeholder="与营业执照一致"]', '联调测试农业科技有限公司')
  await fill(page, 'input[placeholder="15-18 位字母数字"]', '91370700MA3D5K8N2X')
  await fill(page, 'input[placeholder="省 / 市 / 区 / 详细地址"]', '山东省潍坊市寿光市测试路 88 号')
  await clickText(page, '下一步')
  await fill(page, 'input[placeholder="与营业执照一致"]', '王建国')
  await fill(page, 'input[placeholder="用于接收审核通知"]', '王建国')
  await fill(page, 'input[placeholder="11 位手机号"]', '13900001111')
  await clickText(page, '下一步')
  await page.evaluate(() => document.querySelector('.portal-agree input')?.click())
  await clickText(page, '提交认证审核')
  const entErrorText = await page.evaluate(() => document.querySelector('.portal-form-error')?.textContent ?? '')
  check(entErrorText.includes('登录') || entErrorText.includes('会话'),
    '企业认证：未登录时不写本地草稿，提示先登录', entErrorText.slice(0, 40))

  // ---------- 个人实名资料登记 ----------
  await page.goto(`${BASE}/portal/#/certify/personal`, { waitUntil: 'networkidle' })
  await sleep(300)
  await fill(page, 'input[placeholder="与身份证一致"]', '联调实名用户')
  await fill(page, 'input[placeholder="18 位身份证号"]', '110105199001010011')
  await clickText(page, '下一步')
  const idError = await page.evaluate(() => document.querySelector('.portal-form-error')?.textContent ?? '')
  check(idError.includes('校验位'), '个人实名：错误身份证校验位被拦下')
  await fill(page, 'input[placeholder="18 位身份证号"]', testId())
  await clickText(page, '下一步')
  await fill(page, 'input[placeholder="11 位手机号"]', '13900002222')
  await fill(page, 'input[placeholder="省 / 市 / 区 / 详细地址"]', '山东省潍坊市寿光市测试路 99 号')
  await clickText(page, '下一步')
  await page.evaluate(() => document.querySelector('.portal-agree input')?.click())
  await clickText(page, '提交实名认证')
  const personalErrorText = await page.evaluate(() => document.querySelector('.portal-form-error')?.textContent ?? '')
  check(personalErrorText.includes('登录') || personalErrorText.includes('会话'),
    '个人实名：未登录时不写本地草稿，提示先登录', personalErrorText.slice(0, 40))
  check(pageErrors.length === 0, '门户页面无未捕获脚本异常', pageErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '门户联调脚本未抛异常', String(error).slice(0, 200))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
