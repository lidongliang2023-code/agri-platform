#!/usr/bin/env node
/**
 * 农资台账合并列表联调：
 * - 投入品档案页只允许一张主表，库存总览字段与档案操作在该表内；
 * - 使用台账页只允许一张统一台账，使用记录与非领用库存业务按时间合并；
 * - 两张页面均无接口错误或页面异常。
 *
 * 用法：node scripts/check-input-ledger-merge.mjs [--base=http://127.0.0.1:5173]
 */
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

const WORKSPACE = 'C:/Users/71502/.workbuddy-ai/binaries/node/workspace'
const require2 = createRequire(path.join(WORKSPACE, 'noop.js'))
const { chromium } = require2('playwright-core')

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : fallback
}

const BASE = arg('base', 'http://127.0.0.1:5173').replace(/\/$/, '')
const SHOT_DIR = path.resolve('outputs/input-ledger-merge-20261102')
const checks = []

function check(ok, label, extra = '') {
  checks.push({ ok, label, extra })
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
}

await mkdir(SHOT_DIR, { recursive: true })

const executablePath = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))
if (!executablePath) throw new Error('未找到 Chrome/Edge')

const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox'],
})
const context = await browser.newContext({ viewport: { width: 1680, height: 1050 } })
const page = await context.newPage()
const pageErrors = []
const apiErrors = []

page.on('pageerror', (error) => pageErrors.push(String(error?.message ?? error)))
page.on('response', (response) => {
  if (!response.url().includes('/api/')) return
  if (response.status() >= 500) apiErrors.push(`${response.status()} ${response.url()}`)
})

try {
  // 先停在一个不启动 React 路由的同源资源上建立登录 Cookie，避免未登录跳 SSO 时执行上下文被销毁。
  const bootstrapPath = BASE.includes(':5173') ? '/@vite/client' : '/prod/manifest.json'
  await page.goto(`${BASE}${bootstrapPath}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  const login = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/login', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'farmer', password: 'Admin@123', marketId: 1 }),
    })
    return response.json()
  })
  check(login.code === 0, '统一认证登录成功', `code=${login.code}`)
  await page.evaluate((data) => {
    localStorage.setItem('agri_user_info', JSON.stringify(data.user ?? {}))
    localStorage.setItem('agri_roles', JSON.stringify(data.user?.roles ?? data.roles ?? []))
    localStorage.setItem('agri_permissions', JSON.stringify([]))
    localStorage.setItem('agri_market_id', '1')
  }, login.data)

  await page.goto(`${BASE}/production/inputs`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1200)
  console.log(`当前页面：${page.url()}`)
  await page.getByText(/库存总览.*投入品档案/).first().waitFor({
    timeout: 30000,
  })
  const archiveTables = await page.locator('.ant-pro-table').count()
  const archiveText = await page.locator('main').innerText()
  check(archiveTables === 1, '投入品档案只有一张合并主表', `table=${archiveTables}`)
  check(archiveText.includes('预警阈值'), '库存预警阈值已并入档案主表')
  check(archiveText.includes('最近批次效期'), '最近批次效期已并入档案主表')
  check(archiveText.includes('使用登记') && archiveText.includes('入库'), '档案行保留库存操作')
  await page.locator('.ant-pro-table').getByText('入库', { exact: true }).first().click()
  await page.getByText('投入品入库', { exact: true }).waitFor({ timeout: 10000 })
  check(true, '合并主表的行内入库操作可打开库存作业弹窗')
  await page.locator('.ant-modal-footer button').filter({ hasText: '取' }).last().click()
  await page.screenshot({ path: path.join(SHOT_DIR, '01-input-archive-merged.png'), fullPage: true })

  await page.goto(`${BASE}/production/inputs?tab=ledger`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.getByText('农资使用与库存台账', { exact: true }).waitFor({ timeout: 30000 })
  const ledgerTables = await page.locator('.ant-pro-table').count()
  const ledgerText = await page.locator('main').innerText()
  check(ledgerTables === 1, '使用台账只有一张统一列表', `table=${ledgerTables}`)
  check(ledgerText.includes('台账类型'), '统一列表提供台账类型列与筛选')
  check(ledgerText.includes('库存业务'), '库存业务已并入统一统计')
  check(!ledgerText.includes('📋 出入库流水'), '不再渲染独立出入库流水信息块')
  await page.screenshot({ path: path.join(SHOT_DIR, '02-input-ledger-merged.png'), fullPage: true })

  const [kindSelect] = await page.locator('.ant-form-item').filter({ hasText: '台账类型' }).locator('input').all()
  if (kindSelect) {
    await kindSelect.click()
    await page
      .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden)')
      .getByText('入库', { exact: true })
      .click()
    await page.waitForTimeout(500)
    console.log(`筛选后页面：${page.url()}`)
    await page.locator('.ant-form button.ant-btn-primary').click()
    await page.waitForTimeout(800)
    const filteredText = await page.locator('main').innerText()
    check(filteredText.includes('入库'), '台账类型筛选可用')
  } else {
    check(false, '台账类型筛选控件可定位')
  }

  check(pageErrors.length === 0, '页面无运行时异常', pageErrors.slice(0, 2).join(' | '))
  check(apiErrors.length === 0, '页面无接口错误', apiErrors.slice(0, 2).join(' | '))
} finally {
  await context.close()
  await browser.close()
}

const failed = checks.filter((item) => !item.ok)
console.log(`\n通过 ${checks.length - failed.length}/${checks.length}`)
console.log(`截图：${SHOT_DIR}`)
process.exit(failed.length === 0 ? 0 : 1)
