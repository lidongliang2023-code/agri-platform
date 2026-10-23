#!/usr/bin/env node
/** 交易撮合移动端公开浏览、登录、采购发布和主要页面回归。 */
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8086'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const marker = `MOBILE-TRADE-E2E-${Date.now()}`
const failures = []
let createdOrderId = null
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const sql = (statement) => {
  const output = execFileSync(MYSQL, [
    '--default-character-set=utf8mb4', '-uroot', '-proot', '-N', '-B', '-e', statement,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  return output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('\t'))
}
const fill = async (page, selector, value) => page.evaluate(({ target, next }) => {
  const input = document.querySelector(target)
  if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLTextAreaElement)) {
    throw new Error(`未找到输入框 ${target}`)
  }
  const prototype = input instanceof HTMLTextAreaElement
    ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, next)
  input.dispatchEvent(new Event('input', { bubbles: true }))
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
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
  await page.goto(`${BASE}/mobile/trade`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.mt-app', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})

  const initialUrl = page.url()
  check(/\/mobile\/trade$/.test(initialUrl), '未登录用户可直接进入移动端交易首页', initialUrl)
  check(await page.$$eval('.mt-tabbar button', (buttons) => buttons.length === 5),
    '底部导航包含首页、市场、智能撮合、订单、我的')
  check((await page.evaluate(() => document.body.innerText)).includes('好货源，找丰链云'),
    '首页展示移动端品牌主视觉')
  check((await page.$$('.mt-product-card')).length > 0, '首页读取到真实在架货源')
  check((await page.$$('.mt-demand-card')).length > 0, '首页读取到真实采购需求')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '390px 首页无横向溢出')
  await page.screenshot({ path: path.join(OUT, 'mobile-trade-home.png'), fullPage: true })

  await clickByText(page, '.mt-tabbar button', '市场')
  await page.waitForSelector('.mt-market-products .mt-product-card', { timeout: 20000 })
  check((await page.$$('.mt-market-products .mt-product-card')).length > 0,
    '市场页读取公开货源列表')
  await clickByText(page, '.mt-segment button', '找采购')
  check((await page.$$('.mt-demand-full')).length > 0, '市场页可切换到公开采购需求')
  await clickByText(page, '.mt-segment button', '找货源')
  await page.waitForSelector('.mt-market-products .mt-product-card', { timeout: 10000 })
  await page.screenshot({ path: path.join(OUT, 'mobile-trade-market.png'), fullPage: true })

  await page.click('.mt-market-products .mt-product-card')
  await page.waitForSelector('.mt-detail-summary', { timeout: 30000 })
  const detailText = await page.evaluate(() => document.body.innerText)
  check(detailText.includes('立即采购') && detailText.includes('发布采购需求'),
    '商品详情提供直采和发布需求两个交易入口')
  check(detailText.includes('供应商') && detailText.includes('商品信息'),
    '商品详情展示供应商与商品规格')
  check(await page.$eval('.mt-detail-visual', (node) => {
    const glyph = node.querySelector(':scope > span')
    return Boolean(glyph) && getComputedStyle(glyph).display !== 'none'
  }), '无效或占位商品图会降级为可见品类图形')
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '390px 商品详情无横向溢出')
  await page.screenshot({ path: path.join(OUT, 'mobile-trade-product.png'), fullPage: true })

  await clickByText(page, '.mt-detail-actions button', '立即采购')
  await page.waitForFunction(() => window.location.port === '8090', { timeout: 20000 })
  await page.waitForSelector('button[role="tab"]', { timeout: 20000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => item.textContent?.includes('账号 + 密码'))
    tab?.click()
  })
  await fill(page, 'input[autocomplete="username"]', 'farmer')
  await fill(page, 'input[autocomplete="current-password"]', 'Admin@123')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => item.textContent?.includes('登 录'))
    button?.click()
  })
  for (let i = 0; i < 80; i += 1) {
    await sleep(400)
    if (page.url().includes(':8086/mobile/trade')) break
  }
  await page.waitForSelector('.mt-app', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  check(page.url().includes(':8086/mobile/trade'), '统一认证登录后回到移动端交易入口', page.url())

  await clickByText(page, '.mt-tabbar button', '市场')
  await page.waitForSelector('.mt-market-products .mt-product-card', { timeout: 20000 })
  await page.click('.mt-market-products .mt-product-card')
  await page.waitForSelector('.mt-detail-summary', { timeout: 20000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  await sleep(400)
  await clickByText(page, '.mt-detail-actions button', '立即采购')
  await page.waitForSelector('.mt-form-page', { timeout: 20000 })
  const checkoutText = await page.evaluate(() => document.body.innerText)
  check(checkoutText.includes('采购信息') && checkoutText.includes('收货信息')
    && checkoutText.includes('订单预估'), '登录后可从商品详情进入移动端采购下单表单')
  check((await page.$$('.mt-form-card select')).length >= 2,
    '移动端下单表单包含省市联动选择')
  await page.screenshot({ path: path.join(OUT, 'mobile-trade-checkout.png'), fullPage: true })
  await page.evaluate(({ contactMarker }) => {
    const labels = [...document.querySelectorAll('.mt-form-card label')]
    const getLabel = (text) => labels.find((item) => item.textContent?.includes(text))
    const setInput = (text, value) => {
      const input = getLabel(text)?.querySelector('input, textarea')
      if (!input) throw new Error(`未找到字段：${text}`)
      const prototype = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setInput('收货人', contactMarker)
    setInput('联系电话', '13800138000')
    setInput('详细地址', '北京市新发地农产品批发市场移动端联调库')
    const province = getLabel('省份')?.querySelector('select')
    if (!province) throw new Error('未找到省份')
    province.value = '北京市'
    province.dispatchEvent(new Event('change', { bubbles: true }))
  }, { contactMarker: marker })
  await sleep(150)
  await page.evaluate(() => {
    const label = [...document.querySelectorAll('.mt-form-card label')]
      .find((item) => item.textContent?.includes('城市'))
    const city = label?.querySelector('select')
    if (!city) throw new Error('未找到城市')
    city.value = '北京市'
    city.dispatchEvent(new Event('change', { bubbles: true }))
  })
  await clickByText(page, '.mt-submit-button', '确认采购')
  await page.waitForSelector('.mt-order-status-hero', { timeout: 25000 })
  await sleep(500)
  createdOrderId = Number(sql(`
    SELECT id FROM agri_trade.agri_trade_order
    WHERE delivery_contact='${marker}' AND del_flag=0 ORDER BY id DESC LIMIT 1
  `)[0]?.[0] ?? 0) || null
  check(Boolean(createdOrderId), '移动端提交采购后订单真实落库', String(createdOrderId ?? ''))
  check((await page.evaluate(() => document.body.innerText)).includes('商品明细'),
    '下单成功后可进入移动端订单详情')
  await page.click('.mt-topbar-sub button[aria-label="返回"]')
  await page.waitForSelector('.mt-tabbar', { timeout: 10000 })
  await clickByText(page, '.mt-tabbar button', '首页')

  await clickByText(page, '.mt-quick-grid button', '发布采购')
  await page.waitForSelector('.mt-form-page', { timeout: 20000 })
  check((await page.evaluate(() => document.body.innerText)).includes('发布采购需求'),
    '登录后可进入移动端采购需求发布表单')
  await page.evaluate(({ title }) => {
    const labels = [...document.querySelectorAll('.mt-form-card label')]
    const setInput = (labelText, value) => {
      const label = labels.find((item) => item.textContent?.includes(labelText))
      const input = label?.querySelector('input, textarea')
      if (!input) throw new Error(`未找到字段：${labelText}`)
      const prototype = input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setInput('需求标题', title)
    setInput('商品名称', '移动端联调番茄')
    setInput('品种', '普罗旺斯')
    setInput('采购数量', '20')
    setInput('期望最低价', '5')
    setInput('期望最高价', '8')
    setInput('收货地址', '北京市新发地农产品批发市场')
    const category = labels.find((item) => item.textContent?.includes('采购品类'))?.querySelector('select')
    const categoryOption = category ? [...category.options].find((option) => option.value) : null
    if (!category || !categoryOption) throw new Error('未找到采购品类')
    category.value = categoryOption.value
    category.dispatchEvent(new Event('change', { bubbles: true }))
  }, { title: marker })
  await page.screenshot({ path: path.join(OUT, 'mobile-trade-demand-create.png'), fullPage: true })
  await clickByText(page, '.mt-submit-button', '发布采购需求')
  await page.waitForFunction(() => document.body.innerText.includes('智能撮合助手'), { timeout: 20000 })
  await sleep(800)
  const demandCount = Number(sql(`
    SELECT COUNT(*) FROM agri_trade.agri_trade_demand
    WHERE demand_name='${marker}' AND del_flag=0
  `)[0]?.[0] ?? 0)
  check(demandCount === 1, '移动端发布的采购需求已真实落库', marker)

  await clickByText(page, '.mt-match-button', '开始智能撮合')
  await sleep(1500)
  const matchText = await page.evaluate(() => document.body.innerText)
  check(matchText.includes('推荐货源'), '智能撮合页可触发服务端匹配流程')
  await page.screenshot({ path: path.join(OUT, 'mobile-trade-match.png'), fullPage: true })

  await clickByText(page, '.mt-tabbar button', '订单')
  await page.waitForFunction(() => document.body.innerText.includes('我的订单'), { timeout: 20000 })
  check((await page.evaluate(() => document.body.innerText)).includes('我买到的'),
    '订单页支持买家与卖家视角切换')

  await clickByText(page, '.mt-tabbar button', '我的')
  await page.waitForFunction(() => document.body.innerText.includes('当前经营主体'), { timeout: 20000 })
  const profileText = await page.evaluate(() => document.body.innerText)
  check(profileText.includes('资金与保证金') && profileText.includes('我的合同')
    && profileText.includes('物流跟踪'), '个人中心提供资金、合同和物流入口')
  check(profileText.includes('买家中心') && profileText.includes('卖家中心'),
    '个人中心保留买家/卖家完整工作台入口')
  await page.screenshot({ path: path.join(OUT, 'mobile-trade-profile.png'), fullPage: true })

  await clickByText(page, '.mt-profile-menu button', '我的合同')
  await page.waitForFunction(() => document.body.innerText.includes('我的合同'), { timeout: 20000 })
  check((await page.evaluate(() => document.body.innerText)).includes('查看采购与销售合同'),
    '移动端合同列表入口可正常打开')
  await page.click('.mt-topbar-sub button[aria-label="返回"]')
  await page.waitForSelector('.mt-profile-menu', { timeout: 10000 })
  await clickByText(page, '.mt-profile-menu button', '物流跟踪')
  await page.waitForFunction(() => document.body.innerText.includes('查看承运商、当前位置和签收状态'), { timeout: 20000 })
  check((await page.evaluate(() => document.body.innerText)).includes('物流跟踪'),
    '移动端物流跟踪入口可正常打开')

  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 1 })
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.mt-app', { timeout: 30000 })
  check(page.url().includes('/mobile/trade'), '移动设备访问交易端根地址自动进入移动端', page.url())
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '375px 交易端根入口无横向溢出')

  check(errors.length === 0, '移动端主链路无未捕获脚本异常', errors.slice(0, 2).join(' | '))
  check(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    '登录后移动端页面无横向溢出')
} catch (error) {
  check(false, '移动端回归未抛异常', String(error).slice(0, 480))
} finally {
  if (createdOrderId) {
    try {
      sql(`
        DELETE FROM agri_trade.agri_trade_order_item WHERE order_id=${createdOrderId};
        DELETE FROM agri_trade.agri_trade_order WHERE id=${createdOrderId};
      `)
    } catch (error) {
      console.error(`移动端订单测试数据清理失败：${String(error)}`)
      failures.push('清理移动端订单测试数据')
    }
  }
  try {
    sql(`
      DELETE FROM agri_trade.agri_trade_match_record
      WHERE demand_id IN (SELECT id FROM agri_trade.agri_trade_demand WHERE demand_name='${marker}');
      DELETE FROM agri_trade.agri_trade_demand WHERE demand_name='${marker}';
    `)
  } catch (error) {
    console.error(`移动端测试数据清理失败：${String(error)}`)
    failures.push('清理移动端测试数据')
  }
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
