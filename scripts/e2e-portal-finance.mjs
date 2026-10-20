#!/usr/bin/env node
/** 官网门户 · 供应链金融页回归（2026-10-20）。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const BASE = 'http://localhost:8098/portal/'
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(`${BASE}#/finance`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.fin-hero', { timeout: 20000 })
  await sleep(500)

  const text = await page.evaluate(() => document.body.innerText)
  const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(text.includes('让每一笔订单') && text.includes('都能快速拿到钱'), '供应链金融 Hero 已渲染')
  check(desktopOverflow <= 1, '桌面端无横向溢出', String(desktopOverflow))
  const activeNav = await page.$$eval('.main-nav a.active', (items) => items.map((item) => (item.textContent ?? '').trim()))
  check(activeNav.includes('供应链金融'), '门户导航「供应链金融」处于选中态', activeNav.join(' / '))
  check((await page.$$eval('.fin-hero-stat', (items) => items.length)) === 4, 'Hero 四项金融指标已展示')
  check(text.includes('页面额度、利率、时效与机构数据均为原型示例'), 'Hero 明确标注示例数据口径')
  check((await page.$$eval('.fin-stat-grid > div', (items) => items.length)) === 5, '平台数据条展示 5 项指标')
  check(text.includes('原型示例数据'), '平台数据条标注为原型示例')
  check((await page.$$eval('.fin-product', (items) => items.length)) === 6, '五大产品与核心企业赋能卡片已展示')
  check(['订单融资', '应收账款质押', '存货质押融资', '农机 / 设备贷', '农资采购贷', '核心企业赋能']
    .every((label) => text.includes(label)), '金融产品矩阵内容完整')
  check(text.includes('年化 4.5%') && text.includes('年化 6.0%'), '产品利率明确标注')
  const applyLinks = await page.$$eval('.fin-product a.btn-primary', (items) => items.map((item) => item.getAttribute('href') ?? ''))
  check(applyLinks.length === 5 && applyLinks.every((href) => href.includes(':8086/member/seller?tab=fund')),
    '申请入口统一指向会员中心资金服务', applyLinks[0] ?? '')
  check((await page.$$eval('.fin-risk-grid .card', (items) => items.length)) === 4, '三角链风控四项能力已展示')
  check((await page.$$eval('.fin-partner', (items) => items.length)) === 8, '合作机构示例区展示 8 家')
  check(text.includes('非平台正式合作名单') && text.includes('尚未开放资金方线上入驻'),
    '合作机构与资金方入驻口径如实标注')
  check(text.includes('正式申请在会员中心办理'), 'CTA 说明正式申请办理位置')

  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.fin-product button')]
      .find((item) => (item.textContent ?? '').includes('咨询合作'))
    button?.click()
  })
  await sleep(700)
  const partnerTop = await page.$eval('#fin-partner', (element) => element.getBoundingClientRect().top)
  check(Math.abs(partnerTop) < 180, '核心企业「咨询合作」可定位到合作机构区', String(Math.round(partnerTop)))

  await page.evaluate(() => window.scrollTo(0, 0))
  await sleep(300)
  await page.screenshot({ path: path.join(OUT, 'portal-finance.png'), fullPage: true })

  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${BASE}#/finance`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.fin-hero', { timeout: 20000 })
  await sleep(500)
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(mobileOverflow <= 1, '390px 移动端无横向溢出', String(mobileOverflow))
  await page.screenshot({ path: path.join(OUT, 'portal-finance-mobile-top.png') })
  await page.screenshot({ path: path.join(OUT, 'portal-finance-mobile.png'), fullPage: true })
  check(errors.length === 0, '供应链金融页无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '供应链金融页回归脚本未抛异常', String(error).slice(0, 220))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
