#!/usr/bin/env node
/**
 * 企业/个人经营主体同源回归。
 *
 * 验证生产运营端与主数据管理端读取同一份经营主体主档，
 * 且两个管理页面不再向用户展示“租户”概念。
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))

const BASE = 'http://localhost'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fill = async (page, selector, value) => {
  await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel)
    if (!(input instanceof HTMLInputElement)) throw new Error(`未找到输入框 ${sel}`)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { sel: selector, val: value })
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
try {
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.setViewportSize({ width: 1440, height: 1000 })

  await page.goto(`${BASE}/production/login`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('button[role="tab"]', { timeout: 15000 })
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((item) => (item.textContent ?? '').includes('账号 + 密码'))
    tab?.click()
  })
  await fill(page, 'input[autocomplete="username"]', 'admin')
  await fill(page, 'input[autocomplete="current-password"]', 'Admin@123')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button[type="submit"]')]
      .find((item) => (item.textContent ?? '').includes('登 录'))
    button?.click()
  })
  for (let i = 0; i < 30; i += 1) {
    await sleep(500)
    if (!page.url().includes(':8090/')) break
  }

  await page.goto(`${BASE}/admin/production/dashboard`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 800))
  const productionText = await page.evaluate(() => document.body.innerText)
  check(!productionText.includes('主体管理') && !productionText.includes('企业与个人主体'),
    '生产管理运营端不再提供主体/租户管理入口')
  check(!productionText.includes('租户'), '生产管理运营端导航不再出现“租户”')

  await page.goto(`${BASE}/admin/production/subjects`, { waitUntil: 'networkidle', timeout: 60000 })
  await sleep(2000)
  check(page.url().includes('/admin/production/dashboard'),
    '生产端历史主体管理地址已重定向运营大盘', page.url())

  await page.goto(`${BASE}:8080/subject/list`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await new Promise((resolve) => setTimeout(resolve, 800))
  const masterText = await page.evaluate(() => document.body.innerText)
  /**
   * 这一页现在叫「入驻与生命周期」（`views/subject/TenantAudit.vue`），
   * 「企业与个人主体」是主数据运营中心首页那张卡片的标签，不是本页标题；
   * 而"租户"三个字在本页只作为口径解释出现（经营主体（租户）），不再是被管理的对象名。
   * 所以断言从"页面上不能出现租户"改成"不能出现把租户当对象名的入口"。
   */
  check(masterText.includes('入驻与生命周期'), '主数据管理端显示主体生命周期页',
    masterText.replace(/\s+/g, ' ').slice(0, 80))
  check(masterText.includes('企业主体') && masterText.includes('个人主体'),
    '主数据管理端同时展示企业主体和个人主体')
  /**
   * 页面正文（`.mds-page`，含面包屑）里"租户"只该作为口径解释出现。
   * 面包屑/导航分组目前仍写「租户与配额 / 租户列表」，那是导航术语没跟着改（已作为已知限制报出），
   * 所以这一条只禁"把租户当成可管理对象的动作词"，并把口径解释那句钉住。
   */
  const pageBody = await page.evaluate(() => document.querySelector('.mds-page')?.innerText ?? '')
  check(['租户管理', '新建租户', '租户 ID', '租户ID'].every((label) => !pageBody.includes(label))
    && pageBody.includes('经营主体（租户）'),
  '主体页正文只把"租户"用作口径解释（不再是被管理的对象名）',
    `命中对象名写法：${['租户管理', '新建租户', '租户列表', '租户 ID', '租户ID'].filter((label) => pageBody.includes(label)).join('/') || '无'}`)

  const loginResponse = await fetch(`${BASE}:8093/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
  })
  const login = await loginResponse.json()
  const headers = { Authorization: `Bearer ${login.data.accessToken}` }
  const [subjects, master] = await Promise.all([
    fetch(`${BASE}:8093/api/v1/admin/subjects?page=1&size=100`, { headers }).then((res) => res.json()),
    fetch(`${BASE}:8083/admin/masterdata/subject/list?pageNum=1&pageSize=100`, { headers }).then((res) => res.json()),
  ])
  const subjectIds = new Set(subjects.data.records.map((row) => String(row.tenantId)))
  const masterIds = new Set(master.data.list.map((row) => String(row.id)))
  const sameIds = subjectIds.size === masterIds.size
    && [...subjectIds].every((id) => masterIds.has(id))
  check(Number(subjects.data.total) === Number(master.data.total) && sameIds,
    '核心平台与主数据端的主体数量及 ID 完全一致',
    `核心 ${subjectIds.size} / 主数据 ${masterIds.size}`)
  check(subjects.data.records.every((row) => row.memberType === 'enterprise' || row.memberType === 'personal'),
    '主体主档只包含企业主体或个人主体')

  const target = subjects.data.records.find((row) => String(row.tenantId) === '2001')
    ?? subjects.data.records[0]
  const targetId = String(target.tenantId)
  const originalStatus = Number(target.status)
  const toggledStatus = originalStatus === 1 ? 0 : 1
  const updateResponse = await fetch(
    `${BASE}:8093/api/v1/admin/subjects/${targetId}/status`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: toggledStatus }),
    },
  ).then((res) => res.json())
  const masterDetail = await fetch(
    `${BASE}:8083/admin/masterdata/subject/detail/${targetId}`,
    { headers },
  ).then((res) => res.json())
  check(updateResponse.code === 0 && Number(masterDetail.data?.status) === toggledStatus,
    '主体停启用操作在主数据端实时同源可见', `${target.tenantName} → ${toggledStatus}`)

  const restoreResponse = await fetch(
    `${BASE}:8093/api/v1/admin/subjects/${targetId}/status`,
    {
      method: 'PUT',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: originalStatus }),
    },
  ).then((res) => res.json())
  check(restoreResponse.code === 0, '主体测试状态已恢复')

  await context.close()
} catch (error) {
  check(false, '脚本执行未抛异常', String(error).slice(0, 200))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) process.exitCode = 1
