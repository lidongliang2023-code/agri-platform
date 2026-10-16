#!/usr/bin/env node
/**
 * 联调：作物主数据的**运营端维护**（2026-10-16 产品口径）。
 *
 * <p>口径：作物主数据放在生产管理模块，但**由运营端维护** —— 农户在用户端只能在计划 / 地块里选作物。</p>

 *
 * <p>本脚本断言三件事：</p>
 * <ol>
 *   <li>运营端 `/admin/production/crops` 能打开、能新增作物（运营账号有 {@code production:write}）；</li>
 *   <li>用户端**已经没有**维护入口（`/production/crops` 不再渲染维护页）；</li>
 *   <li>用户端仍然能读到作物（下拉用的 options 接口对农户放行）。</li>
 * </ol>

 *
 * <p>写接口的角色校验本身是平台 RBAC（{@code @OperatorOnly} → {@code production:write}），
 * 脚本里再用农户令牌打一次写接口，确认拒绝消息是可读的。</p>
 *
 * 用法：node scripts/e2e-crop-master-ops.mjs [--base=http://localhost] [--admin=admin] [--farmer=farmer]
 * 退出码：0 = 全部通过；1 = 有断言失败。
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
const BASE_URL = arg('base', 'http://localhost')
const ADMIN = arg('admin', 'admin')
const FARMER = arg('farmer', 'farmer')
const PASSWORD = arg('password', 'Admin@123')
const FARM_ID = arg('farm', '1')
const HEADFUL = process.argv.includes('--headful')

const stamp = Date.now().toString().slice(-6)
const cropName = `联调作物-${stamp}`

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 登录并返回 { token, user }（node 侧登录，用来拿身份与令牌做接口断言） */
const loginAs = async (username) => {
  const res = await (await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, marketId: 1 }),
  })).json()
  return res
}

const adminLogin = await loginAs(ADMIN)
check(adminLogin.code === 0, `运营账号登录（${ADMIN}）`, `code=${adminLogin.code}`)
const farmerLogin = await loginAs(FARMER)
check(farmerLogin.code === 0, `用户账号登录（${FARMER}）`, `code=${farmerLogin.code}`)
if (adminLogin.code !== 0 || farmerLogin.code !== 0) process.exit(1)

// 农户令牌打写接口：必须是可读的拒绝（平台 RBAC 的 production:write）
const farmerWrite = await (await fetch(`${BASE_URL}/api/v1/production/crops`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${farmerLogin.data.accessToken}` },
  body: JSON.stringify({ cropName: `农户不该建-${stamp}` }),
})).json()
check(farmerWrite.code === 403 && /production:write/.test(farmerWrite.message ?? ''),
  '农户令牌写作物被拒（403 且说明需要 production:write）', `code=${farmerWrite.code} msg=${farmerWrite.message}`)

// 农户令牌读选项：必须放行（用户端的下拉要靠它）
const farmerOptions = await (await fetch(`${BASE_URL}/api/v1/production/crops/options`, {
  headers: { Authorization: `Bearer ${farmerLogin.data.accessToken}` },
})).json()
check(farmerOptions.code === 0 && Array.isArray(farmerOptions.data),
  '农户令牌读作物下拉仍放行', `code=${farmerOptions.code} 项数=${farmerOptions.data?.length ?? 0}`)

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
const badResponses = []
let createCall = null
page.on('response', async (res) => {
  if (res.status() >= 400) {
    let body = ''
    try { body = (await res.text()).slice(0, 120) } catch { /* 忽略 */ }
    badResponses.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE_URL, '')} ${body}`)
  }
  if (/\/api\/v1\/production\/crops$/.test(res.url()) && res.request().method() === 'POST') {
    try { createCall = { status: res.status(), json: await res.json() } } catch { /* 忽略 */ }
  }
})

const clickButtonByText = async (label) => {
  const ok = await page.evaluate((text) => {
    const norm = (s) => (s ?? '').replace(/\s+/g, '')
    const btn = [...document.querySelectorAll('button')].find((b) => norm(b.textContent) === text)
    if (!btn) return false
    btn.click()
    return true
  }, label)
  if (!ok) throw new Error(`未找到按钮「${label}」`)
}

try {
  await page.goto(`${BASE_URL}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.evaluate(async (creds) => {
    try {
      await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(creds),
      })
    } catch { /* 由后续页面表现反映 */ }
  }, { username: ADMIN, password: PASSWORD, marketId: 1 })
  await page.evaluateOnNewDocument((state) => {
    try {
      localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
      localStorage.setItem('agri_roles', JSON.stringify(state.roles ?? ['SUPER_ADMIN']))
      localStorage.setItem('agri_permissions', JSON.stringify([]))
      localStorage.setItem('agri_market_id', '1')
      localStorage.setItem('agri_current_farm', JSON.stringify({ farmId: state.farmId, farmCode: '', farmName: '' }))
    } catch { /* localStorage 不可用则忽略 */ }
  }, { userInfo: adminLogin.data.user ?? {}, roles: adminLogin.data.user?.roles ?? ['SUPER_ADMIN'], farmId: FARM_ID })

  // 1) 运营端维护页
  await page.goto(`${BASE_URL}/admin/production/crops`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const opsText = await page.evaluate(() => document.body.innerText)
  check(opsText.includes('作物'), '运营端「作物管理」页已渲染')
  check(opsText.includes('新增作物'), '运营端页面有「新增作物」按钮（可维护）')

  // 2) 运营端新增一个作物（应放行）
  await clickButtonByText('新增作物')
  await page.waitForSelector('.ant-modal-content #cropName', { timeout: 20000 })
  await sleep(600)
  await page.click('.ant-modal-content #cropName')
  await page.type('.ant-modal-content #cropName', cropName, { delay: 10 })
  await page.evaluate(() => {
    const btn = document.querySelector('.ant-modal-footer .ant-btn-primary')
    btn?.click()
  })
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  await sleep(800)
  check(Boolean(createCall) && createCall.json?.code === 0, '运营端新增作物成功',
    `HTTP ${createCall?.status} code=${createCall?.json?.code} msg=${createCall?.json?.message ?? ''}`)

  const listAfter = await page.evaluate(() => document.body.innerText)
  check(listAfter.includes(cropName), '新增的作物出现在运营端列表里', cropName)

  // 2b) 类别下拉必须来自后端字典：本地那份旧清单只有 6 项、没有「其他」兜底项，
  //     所以"能看到「其他」"就是"选项来自服务端"的直接证据（这条原先在计划脚本里，
  //     页面搬到运营端后跟着搬过来）。
  await clickButtonByText('新增作物')
  await page.waitForSelector('.ant-modal-content #cropName', { timeout: 20000 })
  await sleep(600)
  await page.click('.ant-modal-content #cropCategory')
  await page.waitForFunction(
    () => document.querySelectorAll('.ant-select-item-option').length > 0,
    { timeout: 15000 },
  )
  await sleep(300)
  const categoryOptions = await page.evaluate(() =>
    [...document.querySelectorAll('.ant-select-item-option')].map((el) => el.textContent.trim()))
  check(categoryOptions.includes('蔬菜') && categoryOptions.includes('其他'),
    '作物类别下拉来自后端字典（含「其他」兜底项）', categoryOptions.join(' / '))
  // 关掉弹窗，避免留下未提交的表单
  await page.keyboard.press('Escape')
  await sleep(300)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ant-modal-footer button')]
      .find((b) => (b.textContent ?? '').replace(/\s+/g, '') === '取消')
    btn?.click()
  })
  await sleep(400)

  // 3) 用户端不再有维护入口
  await page.goto(`${BASE_URL}/production/crops`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const userText = await page.evaluate(() => document.body.innerText)
  check(!userText.includes('新增作物'), '用户端 /production/crops 不再渲染维护页（入口已撤）',
    userText.replace(/\s+/g, ' ').slice(0, 80))

  // 4) 用户端仍能从下拉读到作物（计划页的作物下拉）
  await page.goto(`${BASE_URL}/production/plans`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const plansText = await page.evaluate(() => document.body.innerText)
  check(plansText.includes('种养计划'), '用户端计划页仍可访问（作物下拉数据源不变）')

  check(badResponses.length === 0, '全链路没有 4xx/5xx 响应', badResponses.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n== 运营端新增作物「${cropName}」id=${createCall?.json?.data ?? '?'}，失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
