#!/usr/bin/env node
/** 官网门户 · 物流服务页回归（2026-10-20）。 */
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
  await page.goto(`${BASE}#/logistics`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.logi-hero', { timeout: 20000 })
  await sleep(500)

  const text = await page.evaluate(() => document.body.innerText)
  check(text.includes('从田间到餐桌') && text.includes('全程温控可追溯'), '物流服务 Hero 已渲染')
  const logiHeroBackground = await page.$eval('.logi-hero', (element) => getComputedStyle(element).backgroundImage)
  const logiButtonColor = await page.$eval('.logi-btn-light', (element) => getComputedStyle(element).color)
  const homePage = await browser.newPage()
  await homePage.setViewport({ width: 1440, height: 1000 })
  await homePage.goto(BASE, { waitUntil: 'networkidle2', timeout: 60000 })
  const portalHeroBackground = await homePage.$eval('.portal-hero', (element) => getComputedStyle(element).backgroundImage)
  const portalButtonColor = await homePage.$eval('.portal-btn-light', (element) => getComputedStyle(element).color)
  await homePage.close()
  check(logiHeroBackground === portalHeroBackground, '物流 Hero 与首页使用同一品牌渐变')
  check(logiButtonColor === portalButtonColor, '物流页主按钮与首页使用同一绿色主色', `${logiButtonColor} / ${portalButtonColor}`)
  check(text.includes('物流服务') && (await page.$$eval('.main-nav a.active', (items) => items.map((item) => item.textContent))).some((item) => item.includes('物流服务')),
    '门户导航「物流服务」处于选中态')
  check((await page.$$eval('.logi-service', (items) => items.length)) === 4, '四大物流服务卡片已展示')
  check(text.includes('产地专线') && text.includes('冷链物流') && text.includes('城配末端') && text.includes('监管仓服务'), '服务矩阵内容完整')
  check(text.includes('示例运单') && text.includes('YD-20261020-004862'), '运单追踪明确标注为示例')
  check(text.includes('34') && text.includes('1,240') && text.includes('126'), '网络覆盖区块已展示并标注示例口径')

  // 货物类型切换 + 询价提交
  await page.evaluate(() => {
    const chip = [...document.querySelectorAll('.logi-field .chip')].find((el) => (el.textContent ?? '').includes('果蔬（冷藏）'))
    chip?.click()
  })
  await sleep(200)
  const cargoOn = await page.evaluate(() => [...document.querySelectorAll('.logi-field .chip')]
    .some((el) => el.classList.contains('on') && (el.textContent ?? '').includes('果蔬（冷藏）')))
  check(cargoOn, '货物类型可切换')
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((el) => (el.textContent ?? '').includes('提交询价意向'))
    btn?.click()
  })
  await page.waitForSelector('.logi-notice', { timeout: 10000 })
  const notice = await page.evaluate(() => document.querySelector('.logi-notice')?.textContent ?? '')
  check(notice.includes('尚未接入物流报价接口') && notice.includes('不会生成正式运单'),
    '询价提交后如实说明报价接口未接入', notice.slice(0, 80))

  await page.screenshot({ path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'portal-logistics.png'), fullPage: true })

  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${BASE}#/logistics`, { waitUntil: 'networkidle2' })
  await page.waitForSelector('.logi-hero', { timeout: 20000 })
  await sleep(500)
  await page.screenshot({ path: path.join('C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648', 'portal-logistics-mobile.png'), fullPage: true })
  check(errors.length === 0, '物流服务页无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '物流服务页回归脚本未抛异常', String(error).slice(0, 220))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
