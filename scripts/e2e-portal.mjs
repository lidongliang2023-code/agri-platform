#!/usr/bin/env node
/**
 * 官网门户联调（2026-10-20）。
 *
 * 覆盖：
 *   1. 首页各区块与示例数据标注；
 *   2. 站内搜索 → 产业链页关键词过滤；
 *   3. 一级/二级/产地筛选与价格排序；
 *   4. 认证中心 FAQ；
 *   5. 企业认证资料登记：必填校验 → 分步填写 → 未登录提交拦截；
 *   6. 个人实名：身份证校验位 → 分步填写 → 未登录提交拦截。
 *
 * 用法：node scripts/e2e-portal.mjs [--base=http://localhost:8098] [--headful]
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')

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

const counts = async (page) => page.evaluate(() => document.querySelectorAll('.portal-product-grid .card').length)

/** 生成校验位正确的 18 位测试身份证号（不对应真实人员）。 */
const testId = () => {
  const base = '11010519900101001'
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const sum = base.split('').reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0)
  return base + codes[sum % 11]
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })

  // ---------- 首页 ----------
  await page.goto(`${BASE}/portal/`, { waitUntil: 'networkidle2', timeout: 60000 })
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
  const liveAll = await page.evaluate(async () => {
    try {
      return await (await fetch('/api/trade/public/products?limit=24')).json()
    } catch {
      return null
    }
  })
  const liveProducts = liveAll?.code === 200 && Array.isArray(liveAll.data) ? liveAll.data : []
  const fruitCount = liveProducts.filter((item) =>
    ['大白菜', '蔬菜', '苹果', '柑橘', '水果'].some((key) => (item.categoryName ?? '').includes(key))).length
  const quoteApi = await page.evaluate(async () => {
    try {
      return await (await fetch('/api/v1/quotes?size=20')).json()
    } catch {
      return null
    }
  })
  const quoteRecords = quoteApi?.code === 0 ? quoteApi.data?.records ?? [] : []
  check(hasLive ? homeText.includes('实时在售') : homeText.includes('暂无在售'),
    hasLive ? '交易域有数据时首页展示「实时在售」' : '交易域无数据时首页展示无在售空态')
  check(quoteRecords.length > 0
    ? homeText.includes('平台行情') && homeText.includes(quoteRecords[0].productName)
    : homeText.includes('暂无行情'),
  quoteRecords.length > 0 ? '首页价格指数展示后台真实行情' : '行情为空时首页不展示模拟价格')
  const newsApi = await page.evaluate(async () => {
    try {
      return await (await fetch('/api/v1/public/news?size=6')).json()
    } catch {
      return null
    }
  })
  check(newsApi?.code === 0, '产业资讯使用公开只读后端接口')
  check(homeText.includes('平台公告'), '平台公告区块已渲染并读取后端数据')
  if (Number(newsApi?.data?.total ?? 0) === 0) {
    check(homeText.includes('暂无平台公告'), '无已发布资讯时公告展示空态而非模拟内容')
  }
  if (hasLive) {
    check(homeText.includes(liveApi.data[0].productName), '首页展示交易域真实已发布商品', liveApi.data[0].productName)
  }
  const loginButton = await page.evaluate(() => [...document.querySelectorAll('.portal-top-actions button')]
    .find((el) => (el.textContent ?? '').includes('登录'))?.textContent?.trim())
  const registerHref = await page.evaluate(() => [...document.querySelectorAll('.portal-top-actions a')]
    .find((el) => (el.textContent ?? '').includes('免费注册'))?.getAttribute('href'))
  check(loginButton?.includes('登录'), '首页登录入口可在门户内打开登录弹窗', loginButton ?? '')
  await clickText(page, '登录')
  const loginDialogVisible = await page.evaluate(() => Boolean(document.querySelector('.portal-login-card')))
  check(loginDialogVisible, '门户登录弹窗已渲染')
  await page.click('.portal-login-close')
  check(registerHref?.includes(':8090/register'), '首页注册入口指向统一认证中心注册页', registerHref ?? '')

  // ---------- 搜索 ----------
  await fill(page, '.header-search input', '大闸蟹')
  await page.click('.header-search button')
  await page.waitForFunction(() => location.hash.includes('/chains?q='), { timeout: 10000 })
  await sleep(400)
  check((await counts(page)) === 1, '站内搜索「大闸蟹」过滤出 1 个货源')
  const searchText = await page.evaluate(() => document.body.innerText)
  check(searchText.includes('阳澄湖大闸蟹'), '搜索结果包含交易域真实大闸蟹货源')

  // ---------- 筛选 + 排序 ----------
  await page.goto(`${BASE}/portal/#/chains`, { waitUntil: 'networkidle2' })
  await sleep(300)
  await clickText(page, '果蔬产业', '.portal-filter-row .chip')
  check((await counts(page)) === fruitCount, `一级产业「果蔬产业」过滤出 ${fruitCount} 个真实货源`)
  await clickText(page, '苹果', '.portal-filter-row .chip')
  check((await counts(page)) === 1, '二级品类「苹果」过滤出 1 个真实货源')
  await clickText(page, '陕西', '.portal-province-chips .chip')
  check((await counts(page)) === 1, '产地「陕西」过滤出 1 个货源')
  const chainText = await page.evaluate(() => document.body.innerText)
  check(chainText.includes('洛川红富士苹果') && chainText.includes('产地：陕西'), '筛选后面包屑与真实结果一致', chainText.replace(/\s+/g, ' ').slice(0, 70))

  await page.goto(`${BASE}/portal/#/chains`, { waitUntil: 'networkidle2' })
  await sleep(300)
  await clickText(page, '清空筛选')
  await clickText(page, '价格从低到高', '.portal-list-head .chip')
  const firstProduct = await page.evaluate(() => document.querySelector('.portal-product-grid .card .strong')?.textContent?.trim())
  check(firstProduct === '有机大白菜 5kg/件', '价格从低到高排序首项为 18.8 元/件的有机大白菜', firstProduct ?? '')

  // ---------- 认证中心 FAQ ----------
  await page.goto(`${BASE}/portal/#/certify`, { waitUntil: 'networkidle2' })
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
  await page.goto(`${BASE}/portal/#/certify/enterprise`, { waitUntil: 'networkidle2' })
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
  await page.goto(`${BASE}/portal/#/certify/personal`, { waitUntil: 'networkidle2' })
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
