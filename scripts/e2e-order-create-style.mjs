#!/usr/bin/env node
/** 商品详情“立即下单”页面的视觉一致性与响应式回归。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8086'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const fill = async (page, selector, value) => page.evaluate(({ target, next }) => {
  const input = document.querySelector(target)
  if (!(input instanceof HTMLInputElement)) throw new Error(`未找到输入框 ${target}`)
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, next)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}, { target: selector, next: value })

const clickSelectByLabel = async (page, label) => {
  const clicked = await page.evaluate((text) => {
    const item = [...document.querySelectorAll('.ant-form-item')]
      .find((node) => node.querySelector('.ant-form-item-label')?.textContent?.includes(text))
    const selector = item?.querySelector('.ant-select-selector')
    if (!(selector instanceof HTMLElement)) return false
    selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    selector.click()
    return true
  }, label)
  if (!clicked) throw new Error(`未找到下拉字段：${label}`)
  await sleep(250)
}

const chooseVisibleOption = async (page, text) => {
  await page.waitForSelector('.ant-select-dropdown', { timeout: 10000 })
  const selected = await page.evaluate((label) => {
    const dropdowns = [...document.querySelectorAll('.ant-select-dropdown')]
      .filter((item) => item.getBoundingClientRect().height > 0)
    const dropdown = dropdowns.at(-1)
    const option = [...(dropdown?.querySelectorAll('.ant-select-item-option') ?? [])]
      .find((item) => item.textContent?.trim() === label)
    if (!(option instanceof HTMLElement)) return false
    option.click()
    return true
  }, text)
  if (!selected) throw new Error(`下拉选项不存在：${text}`)
  await sleep(250)
}

const selectedCityText = async (page) => page.evaluate(() => {
  const item = [...document.querySelectorAll('.ant-form-item')]
    .find((node) => node.querySelector('.ant-form-item-label')?.textContent?.includes('收货城市'))
  return item?.querySelector('.ant-select-selection-item')?.textContent?.trim() ?? ''
})

const citySelectDisabled = async (page) => page.evaluate(() => {
  const item = [...document.querySelectorAll('.ant-form-item')]
    .find((node) => node.querySelector('.ant-form-item-label')?.textContent?.includes('收货城市'))
  return item?.querySelector('.ant-select-disabled') !== null
})

const selectFieldSnapshot = async (page, label) => page.evaluate((text) => {
  const item = [...document.querySelectorAll('.ant-form-item')]
    .find((node) => node.querySelector('.ant-form-item-label')?.textContent?.includes(text))
  if (!item) return null
  const select = item.querySelector('.ant-select')
  return {
    isSelect: select !== null,
    disabled: item.querySelector('.ant-select-disabled') !== null,
    value: item.querySelector('.ant-select-selection-item')?.textContent?.trim() ?? '',
  }
}, label)

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  headless: 'new',
  args: ['--no-sandbox'],
})
try {
  const page = await browser.newPage()
  const errors = []
  let createdOrderUrl = ''
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })

  // 先记录商品详情页的核心视觉参数。
  await page.goto(`${BASE}/product/detail/7011`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.pd-hero', { timeout: 20000 })
  const detailStyle = await page.evaluate(() => {
    const header = getComputedStyle(document.querySelector('.site-header'))
    const button = getComputedStyle(document.querySelector('.pd-primary'))
    const container = getComputedStyle(document.querySelector('.hall-container'))
    return {
      font: getComputedStyle(document.body).fontFamily,
      headerHeight: header.height,
      headerBackground: header.backgroundColor,
      buttonRadius: button.borderRadius,
      containerWidth: container.width,
      bodyBackground: getComputedStyle(document.querySelector('.hall-root')).backgroundColor,
    }
  })

  await page.goto(`${BASE}/order/create?productId=7011&quantity=2`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  })
  await page.waitForFunction(() => window.location.port === '8090', { timeout: 20000 })
  await page.waitForSelector('button[role="tab"]', { timeout: 20000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => item.textContent?.includes('账号 + 密码'))
    tab?.click()
  })
  await fill(page, 'input[autocomplete="username"]', '19900002005')
  await fill(page, 'input[autocomplete="current-password"]', 'Test12345')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => item.textContent?.includes('登 录'))
    button?.click()
  })
  for (let i = 0; i < 60; i += 1) {
    await sleep(400)
    if (page.url().includes('/order/create')) break
  }
  await page.waitForSelector('.oc-layout', { timeout: 30000 })
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  await sleep(500)

  const orderText = await page.evaluate(() => document.body.innerText)
  const selectedSummary = await page.$eval('.oc-product', (item) => item.textContent ?? '')
  check(orderText.includes('创建采购订单') && orderText.includes('采购商品') && orderText.includes('收货信息'),
    '下单页信息结构完整')
  check(selectedSummary.trim().length > 0 && orderText.includes('2 kg'), '商品和数量从详情页正确带入')
  check(orderText.includes('订单预览') && orderText.includes('预计订单总额'), '右侧订单预览正常展示')
  check((await page.$$eval('.oc-stepper .on', (items) => items.length)) === 1, '下单步骤条正确高亮当前步骤')
  check((await page.$$eval('.pd-crumb', (items) => items.length)) === 1, '下单页保留与详情页一致的面包屑')

  const orderStyle = await page.evaluate(() => {
    const header = getComputedStyle(document.querySelector('.site-header'))
    const button = getComputedStyle(document.querySelector('.oc-submit'))
    const container = getComputedStyle(document.querySelector('.hall-container'))
    const card = getComputedStyle(document.querySelector('.oc-form-card'))
    const summary = getComputedStyle(document.querySelector('.oc-summary'))
    return {
      font: getComputedStyle(document.body).fontFamily,
      headerHeight: header.height,
      headerBackground: header.backgroundColor,
      buttonRadius: button.borderRadius,
      buttonBackground: button.backgroundImage,
      containerWidth: container.width,
      bodyBackground: getComputedStyle(document.querySelector('.hall-root')).backgroundColor,
      cardRadius: card.borderRadius,
      cardBorder: card.borderColor,
      summaryBackground: summary.backgroundColor,
      summaryPosition: summary.position,
    }
  })
  check(orderStyle.font === detailStyle.font, '字体体系与商品详情一致')
  check(orderStyle.headerHeight === detailStyle.headerHeight
    && orderStyle.headerBackground === detailStyle.headerBackground,
  '顶部导航高度与背景和商品详情一致')
  check(orderStyle.containerWidth === detailStyle.containerWidth, '页面主内容宽度和商品详情一致')
  check(orderStyle.bodyBackground === detailStyle.bodyBackground, '页面底色和商品详情一致')
  check(orderStyle.cardRadius === '16px' && orderStyle.summaryBackground === 'rgb(255, 255, 255)',
    '表单卡片使用统一圆角与白色卡片')
  check(orderStyle.buttonBackground.includes('linear-gradient'), '主操作按钮使用统一绿色渐变')
  check(orderStyle.summaryPosition === 'sticky', '订单预览在桌面端保持吸顶')
  await page.screenshot({ path: path.join(OUT, 'order-create-styled.png'), fullPage: true })

  check(await citySelectDisabled(page), '未选择省份时城市下拉不可用')
  await clickSelectByLabel(page, '收货省份')
  await chooseVisibleOption(page, '河北省')
  check(!(await citySelectDisabled(page)), '选择省份后城市下拉启用')
  await clickSelectByLabel(page, '收货城市')
  const cityOptions = await page.evaluate(() => [...document.querySelectorAll(
    '.ant-select-dropdown .ant-select-item-option',
  )].map((item) => item.textContent?.trim()))
  check(cityOptions.includes('石家庄市') && cityOptions.includes('唐山市') && !cityOptions.includes('沈阳市'),
    '城市列表只展示河北省城市')
  await chooseVisibleOption(page, '石家庄市')
  await clickSelectByLabel(page, '收货省份')
  await chooseVisibleOption(page, '山西省')
  check((await selectedCityText(page)) === '', '切换省份后自动清空原城市')
  await clickSelectByLabel(page, '收货城市')
  const shanxiCities = await page.evaluate(() => [...document.querySelectorAll(
    '.ant-select-dropdown .ant-select-item-option',
  )].map((item) => item.textContent?.trim()))
  check(shanxiCities.includes('太原市') && !shanxiCities.includes('石家庄市'),
    '城市列表随省份联动切换')
  await chooseVisibleOption(page, '太原市')

  await page.evaluate(() => {
    const setValue = (input, value) => {
      if (!(input instanceof HTMLInputElement)) return
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      setter.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    }
    setValue(document.querySelector('input[placeholder="请输入收货人姓名"]'), '页面样式联调收货人')
    setValue(document.querySelector('input[placeholder="请输入手机号"]'), '13900000000')
    setValue(document.querySelector('input[placeholder*="新发地农产品"]'), '新发地样式联调仓 A-01')
  })
  await page.click('.oc-submit')
  for (let i = 0; i < 40; i += 1) {
    await sleep(300)
    if (page.url().includes('/order/confirm?orderId=')) break
  }
  check(page.url().includes('/order/confirm?orderId='), '新样式页面仍可正常提交并生成订单', page.url())
  createdOrderUrl = page.url()

  await page.goto(`${BASE}/order/create?productId=7011&quantity=2`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  })
  await page.waitForSelector('.oc-layout', { timeout: 30000 })
  await page.setViewport({ width: 390, height: 844 })
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.oc-layout', { timeout: 30000 })
  await sleep(400)
  const noOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)
  if (!noOverflow) {
    const offenders = await page.evaluate(() => [...document.querySelectorAll('*')]
      .filter((item) => item.getBoundingClientRect().right > window.innerWidth + 1)
      .slice(0, 10)
      .map((item) => ({
        tag: item.tagName,
        cls: item.className,
        right: Math.round(item.getBoundingClientRect().right),
        width: Math.round(item.getBoundingClientRect().width),
      })))
    console.log('移动端溢出元素：', offenders)
  }
  check(noOverflow, '390px 移动端无横向溢出')
  check(await page.$eval('.oc-summary', (item) => getComputedStyle(item).position === 'static'),
    '移动端订单预览回落为普通文档流')
  await page.screenshot({ path: path.join(OUT, 'order-create-styled-mobile.png'), fullPage: true })

  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(`${BASE}/member/buyer?tab=publish`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.demand-create-page', { timeout: 30000 })
  const demandProvince = await selectFieldSnapshot(page, '收货省份')
  const demandCity = await selectFieldSnapshot(page, '收货城市')
  check(demandProvince?.isSelect && demandCity?.isSelect, '采购需求页省份、城市均使用下拉选择')
  check(demandCity?.disabled, '采购需求页未选省份时城市禁用')

  await page.goto(`${BASE}/product/create`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.product-create-page', { timeout: 30000 })
  const originProvince = await selectFieldSnapshot(page, '产地省份')
  const originCity = await selectFieldSnapshot(page, '产地城市')
  check(originProvince?.isSelect && originCity?.isSelect, '商品资料页产地省份、城市均使用下拉选择')
  check(originCity?.disabled, '商品资料页未选省份时城市禁用')

  await page.goto(createdOrderUrl, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.ant-form', { timeout: 30000 })
  const confirmProvince = await selectFieldSnapshot(page, '收货省份')
  const confirmCity = await selectFieldSnapshot(page, '收货城市')
  check(confirmProvince?.isSelect && confirmCity?.isSelect, '确认订单页省份、城市均使用下拉选择')
  check(confirmProvince?.value === '山西省' && confirmCity?.value === '太原市',
    '确认订单页正确回显订单省市', `${confirmProvince?.value}/${confirmCity?.value}`)
  check(errors.length === 0, '下单页面无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '下单页面视觉回归未抛异常', String(error).slice(0, 300))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
