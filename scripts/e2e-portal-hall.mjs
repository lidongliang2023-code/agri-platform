#!/usr/bin/env node
/** 门户交易大厅回归（2026-10-20）：大厅并入门户、无独立菜单、原入口重定向。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
  await page.goto('http://localhost:8098/portal/#/hall', { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('iframe[title="农产云交易大厅"]', { timeout: 20000 })
  await sleep(1800)

  const portal = await page.evaluate(() => ({
    active: document.querySelector('.main-nav a.active')?.textContent?.trim() ?? '',
    iframeHeight: document.querySelector('.portal-hall-embed iframe')?.getBoundingClientRect().height ?? 0,
    url: location.href,
  }))
  check(portal.active === '交易大厅', '门户导航「交易大厅」处于选中态', portal.active)
  check(portal.url.endsWith('#/hall'), '交易大厅使用门户路由', portal.url)
  check(portal.iframeHeight >= 900, '交易大厅内容高度已展开', `${portal.iframeHeight}px`)

  const frame = page.frames().find((item) => item.url().includes('/hall?embed=1'))
  if (!frame) throw new Error('未找到嵌入的交易大厅 frame')
  const frameInfo = await frame.evaluate(() => ({
    products: document.querySelectorAll('.hall-product').length,
    topbar: getComputedStyle(document.querySelector('.topbar')).display,
    header: getComputedStyle(document.querySelector('.site-header')).display,
    footer: getComputedStyle(document.querySelector('.hall-footer')).display,
  }))
  check(frameInfo.products === 5, '门户交易大厅展示 5 条实时在售商品', `${frameInfo.products} 条`)
  check(frameInfo.topbar === 'none' && frameInfo.header === 'none' && frameInfo.footer === 'none',
    '交易大厅独立顶栏、菜单和页脚已隐藏')

  await page.screenshot({ path: path.join(OUT, 'portal-hall-integrated.png'), fullPage: true })

  await frame.evaluate(() => {
    const button = [...document.querySelectorAll('.hall-tabs button')].find((item) => item.textContent?.includes('采购需求'))
    button?.click()
  })
  await sleep(700)
  const demandRows = await frame.$$eval('.hall-table tbody tr', (rows) => rows.length)
  check(demandRows === 4, '采购需求页签可用', `${demandRows} 条`)
  await page.screenshot({ path: path.join(OUT, 'portal-hall-demand.png'), fullPage: true })

  const home = await browser.newPage()
  await home.setViewport({ width: 1440, height: 1000 })
  await home.goto('http://localhost:8098/portal/#/', { waitUntil: 'networkidle2', timeout: 60000 })
  await home.evaluate(() => {
    const link = [...document.querySelectorAll('.main-nav a')].find((item) => item.textContent?.trim() === '交易大厅')
    link?.click()
  })
  await home.waitForFunction(() => location.hash === '#/hall', { timeout: 20000 })
  check(true, '门户首页点击交易大厅进入同门户页面')
  await home.close()

  const direct = await browser.newPage()
  await direct.goto('http://localhost:8086/hall', { waitUntil: 'networkidle2', timeout: 60000 })
  await direct.waitForFunction(() => location.port === '8098' && location.hash === '#/hall', { timeout: 20000 })
  check(direct.url().includes('localhost:8098/portal/#/hall'), '原 8086 大厅入口重定向到门户', direct.url())
  await direct.close()

  check(errors.length === 0, '门户交易大厅无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '门户交易大厅回归脚本未抛异常', String(error).slice(0, 240))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
