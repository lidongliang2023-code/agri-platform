#!/usr/bin/env node
/** 交易大厅优质供应商推荐进入公开主页回归（2026-10-22）。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
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
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto('http://localhost:8098/portal/#/hall', { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.portal-hall-embed iframe', { timeout: 20000 })
  let hallFrame = null
  for (let i = 0; i < 30; i += 1) {
    hallFrame = page.frames().find((frame) => frame.url().includes('/hall?embed=1'))
    if (hallFrame) break
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  check(Boolean(hallFrame), '门户交易大厅内嵌页面已加载')
  await hallFrame.waitForSelector('.hall-supplier', { timeout: 20000 })
  const suppliers = await hallFrame.$$eval('.hall-supplier', (items) =>
    items.map((item) => ({
      name: item.querySelector('strong')?.textContent?.trim() ?? '',
      text: item.textContent?.replace(/\s+/g, ' ').trim(),
      href: item.getAttribute('href'),
    })))
  check(suppliers.length > 0 && suppliers.every((item) => item.href?.startsWith('/shop/')),
    '优质供应商推荐卡片包含供应商主页地址', suppliers.map((item) => item.href).join(','))
  const firstSupplier = suppliers[0]
  await hallFrame.click('.hall-supplier')
  await page.waitForFunction(() => window.location.pathname.startsWith('/shop/'), { timeout: 20000 })
  await page.waitForSelector('.ant-card', { timeout: 20000 })
  await page.waitForFunction((name) => document.body.innerText.includes(name),
    { timeout: 15000 }, firstSupplier.name)
  const pageText = await page.evaluate(() => document.body.innerText)
  check(pageText.includes('在售货源') && !page.url().includes('/login'),
    '点击推荐卡片免登录进入供应商主页', page.url())
  check(pageText.includes(firstSupplier.name),
    '供应商主页显示对应供应商信息', firstSupplier.name)
  await page.screenshot({ path: path.join(OUT, 'hall-supplier-home.png'), fullPage: true })
  check(errors.length === 0, '供应商主页跳转无未捕获脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '供应商主页回归未抛异常', String(error).slice(0, 280))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
