/**
 * 用户中心 · 我的组织 / 注册地址级联回归
 *
 * 验证链路：
 *   1. 行政区划经门户 /api/master-data/ 反代可读（省 31 / 市 342 / 区县 2975，需平台令牌）
 *   2. 「我的组织」有组织概览卡，创建企业主体弹窗里注册地址是三段下拉 + 手工详细地址
 *   3. 选江苏省 → 城市列表更新 → 选南京市 → 区县列表更新，拼出的地址含三段
 *   4. 直辖市「市辖区」在城市下拉里显示为省级名称
 *   5. 未选区划直接提交被前端拦下，且不发创建请求
 *   6. 全程无控制台异常
 *
 * 用法：node scripts/e2e-uc-org.mjs
 */
import { existsSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const BASE = 'http://localhost'
const PORTAL = 'http://localhost:8098'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'uc-org-20261030')
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1080 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  // 只统计门户页面自身的异常：SSO 登录后 admin 会被送到生产管理运营端，那边的报错与本页无关
  if (!page.url().includes(':8098')) return
  const text = String(e?.message ?? e)
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(text)) jsErrors.push(text.slice(0, 140))
})

const optionsOf = async (label) => page.evaluate((aria) => {
  const select = [...document.querySelectorAll('select')].find((node) => node.getAttribute('aria-label') === aria)
  if (!select) return null
  return [...select.options].map((option) => ({ value: option.value, text: option.textContent.trim() }))
}, label)

try {
  /* ---------- 登录 ---------- */
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  check(!page.url().includes('/sso/index.html'), 'SSO 登录成功')

  /* ---------- 1) 区划接口（经门户反代 + 平台令牌） ---------- */
  await page.goto(`${PORTAL}/portal/index.html#/account/org`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  const levelCounts = await page.evaluate(async () => {
    const tokenRes = await fetch('/api/v1/auth/refresh', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    const tokenBody = await tokenRes.json().catch(() => null)
    const token = tokenBody?.data?.accessToken
    if (!token) return { error: 'no-token' }
    const read = async (level) => {
      const res = await fetch(`/api/master-data/address/regions/level/${level}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const body = await res.json()
      return { code: body.code, count: (body.data ?? []).length }
    }
    return { l1: await read(1), l2: await read(2), l3: await read(3) }
  })
  check(levelCounts.error !== 'no-token', '门户拿到平台令牌')
  check(levelCounts.l1?.count === 31, '省级 31 条', String(levelCounts.l1?.count))
  check(levelCounts.l2?.count >= 340, '地级 ≥340 条', String(levelCounts.l2?.count))
  check(levelCounts.l3?.count >= 2900, '区县 ≥2900 条', String(levelCounts.l3?.count))

  /* ---------- 2) 我的组织页结构 ---------- */
  const text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('我的组织') && text.includes('我的经营主体'), '「我的组织」页已打开')
  check(Boolean(await page.evaluate(() => document.querySelector('.uc-org-hero'))), '页面顶部有组织概览卡')
  await page.waitForSelector('.uc-id-list li', { timeout: 15000 })
  const identityCount = await page.evaluate(() => document.querySelectorAll('.uc-id-list li').length)
  check(identityCount === 6, '「业务身份」区块展示 6 类身份', `rows=${identityCount}`)
  const identityText = (await page.evaluate(() => document.querySelector('.uc-org-identity')?.innerText ?? '')).replace(/s+/g, ' ')
  check(identityText.includes('批发商') && identityText.includes('不改变主体权限'), '业务身份与主体身份的区别有说明')
  const identityNav = await page.evaluate(() => {
    const texts = [...document.querySelectorAll('.uc-nav-item')].map((n) => (n.textContent ?? '').replace(/s+/g, ''))
    return {
      switchItem: texts.filter((t) => t.includes('身份切换')).length,
      manageItem: texts.filter((t) => t.includes('身份管理')).length,
      orgItem: texts.filter((t) => t.includes('我的组织')).length,
      applyItem: texts.filter((t) => t.includes('身份申请')).length,
    }
  })
  check(identityNav.switchItem === 0 && identityNav.manageItem === 0, '「身份切换 / 身份管理」重复入口已移除')
  check(identityNav.orgItem === 1, '「我的组织」保留且只有一个')
  check(identityNav.applyItem === 0, '「身份申请」已并入我的组织，侧栏不再单列')
  await page.screenshot({ path: path.join(OUT, '01-org-page.png'), fullPage: true })

  /* ---------- 3) 创建企业主体：地址级联 ---------- */
  await page.locator('button').filter({ hasText: '创建企业主体' }).first().click()
  await page.waitForTimeout(800)
  const provinceOptions = await optionsOf('省份')
  check((provinceOptions?.length ?? 0) >= 32, '省份下拉已加载', `${provinceOptions?.length ?? 0} 项`)

  await page.selectOption('select[aria-label="省份"]', '320000')
  await page.waitForTimeout(400)
  const cityOptions = await optionsOf('城市')
  check((cityOptions ?? []).some((item) => item.text === '南京市'), '选省后城市列表更新', `cities=${cityOptions?.length ?? 0}`)

  await page.selectOption('select[aria-label="城市"]', '320100')
  await page.waitForTimeout(400)
  const districtOptions = await optionsOf('区县')
  check((districtOptions ?? []).some((item) => item.text === '鼓楼区'), '选市后区县列表更新', `districts=${districtOptions?.length ?? 0}`)

  await page.selectOption('select[aria-label="区县"]', '320106')
  await page.locator('input[placeholder*="详细地址"]').scrollIntoViewIfNeeded()
  await page.locator('input[placeholder*="详细地址"]').fill('中山北路 100 号')
  await page.waitForTimeout(300)
  const hint = await page.evaluate(() => {
    const node = [...document.querySelectorAll('.uc-field-hint')].find((n) => (n.textContent ?? '').includes('将保存为'))
    return node?.textContent ?? ''
  })
  check(hint.includes('江苏省') && hint.includes('南京市') && hint.includes('鼓楼区') && hint.includes('中山北路'),
    '省市区 + 详细地址拼成完整地址', hint.slice(0, 60))

  /* ---------- 4) 直辖市：市辖区显示为省级名称 ---------- */
  await page.selectOption('select[aria-label="省份"]', '110000')
  await page.waitForTimeout(400)
  const bjCities = await optionsOf('城市')
  check((bjCities ?? []).some((item) => item.text === '北京市'), '直辖市市级节点显示为「北京市」而不是「市辖区」',
    JSON.stringify((bjCities ?? []).slice(1, 3)))

  /* ---------- 5) 未选区划提交被拦下 ---------- */
  await page.selectOption('select[aria-label="省份"]', '')
  await page.locator('input[placeholder*="营业执照一致"]').fill('回归测试企业')
  await page.locator('input[placeholder*="15-18 位字母数字"]').fill('91320100MA1TEST8X')
  await page.locator('input[placeholder*="用于接收重要通知"]').fill('测试联系人')
  const wrapped = []
  page.on('request', (req) => {
    if (req.url().endsWith('/api/v1/sso/account/businesses') && req.method() === 'POST') wrapped.push(req.url())
  })
  await page.locator('.account-modal button').filter({ hasText: '创建主体' }).first().click()
  await page.waitForTimeout(600)
  const errorText = await page.evaluate(() => document.querySelector('.account-error')?.textContent ?? '')
  check(errorText.includes('省份') || errorText.includes('注册地址'), '未选区划提交被前端拦下', errorText.slice(0, 30))
  check(wrapped.length === 0, '校验失败时没有发出创建请求', `requests=${wrapped.length}`)

  await page.screenshot({ path: path.join(OUT, '02-create-modal.png'), fullPage: false })
  await page.locator('.account-modal button').filter({ hasText: '取消' }).first().click()

  await page.goto(`${PORTAL}/portal/index.html#/account/identityApply`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  const legacy = (await page.evaluate(() => document.body.innerText)).replace(/s+/g, ' ')
  check(legacy.includes('我的组织') && legacy.includes('业务身份'), '旧地址 #/account/identityApply 回落到我的组织')

  check(jsErrors.length === 0, '门户页无控制台异常', jsErrors[0] ?? '')
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
