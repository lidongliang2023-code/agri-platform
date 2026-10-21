#!/usr/bin/env node
/**
 * 企业/个人经营主体同源回归。
 *
 * 验证生产运营端与主数据管理端读取同一份经营主体主档，
 * 且两个管理页面不再向用户展示“租户”概念。
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')

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

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
try {
  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 1000 })

  await page.goto(`${BASE}/production/login`, { waitUntil: 'networkidle2', timeout: 60000 })
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

  await page.goto(`${BASE}/admin/production/dashboard`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  const productionText = await page.evaluate(() => document.body.innerText)
  check(!productionText.includes('主体管理') && !productionText.includes('企业与个人主体'),
    '生产管理运营端不再提供主体/租户管理入口')
  check(!productionText.includes('租户'), '生产管理运营端导航不再出现“租户”')

  await page.goto(`${BASE}/admin/production/subjects`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(2000)
  check(page.url().includes('/admin/production/dashboard'),
    '生产端历史主体管理地址已重定向运营大盘', page.url())

  await page.goto(`${BASE}:8080/subject/list`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  const masterText = await page.evaluate(() => document.body.innerText)
  check(masterText.includes('企业与个人主体'), '主数据管理端显示「企业与个人主体」页面')
  check(masterText.includes('企业主体') && masterText.includes('个人主体'),
    '主数据管理端同时展示企业主体和个人主体')
  check(!masterText.includes('租户'), '主数据管理端页面不再出现“租户”')

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
