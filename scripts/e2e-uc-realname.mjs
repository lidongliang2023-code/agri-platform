/**
 * 用户中心 · 个人实名认证（独立菜单）回归
 *
 * 验证链路：
 *   1. 侧栏「个人实名」是站内菜单（不再是“跳转”外部页）
 *   2. #/account/realname 打开独立页面：状态、四步进度、须知三卡
 *   3. 已认证 / 审核中 → 只读；草稿 / 未办理 → 可继续核验
 *   4. 未办理时展开表单，空提交会被前端校验拦下（不产生任何写请求）
 *   5. 身份证校验位错误的请求被后端拒绝（400/5004），资料不被改写
 *   6. 「身份与认证」页不再包含个人实名卡片，只留经营主体
 *   7. 全程无控制台异常
 *
 * 用法：node scripts/e2e-uc-realname.mjs
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
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'uc-realname-20261030')
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
  const text = String(e?.message ?? e)
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(text)) jsErrors.push(text.slice(0, 140))
})

const call = (method, url, body) =>
  page.evaluate(async ({ m, u, b }) => {
    const res = await fetch(u, {
      method: m,
      credentials: 'include',
      headers: b ? { 'Content-Type': 'application/json' } : {},
      body: b ? JSON.stringify(b) : undefined,
    })
    let json = null
    try {
      json = await res.json()
    } catch {
      /* 非 JSON */
    }
    return { status: res.status, json }
  }, { m: method, u: url, b: body })

const bodyText = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

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

  const summary = await call('GET', '/api/v1/sso/account/summary')
  const record = summary.json?.data?.realName ?? null
  const status = record?.status ?? 'none'
  check(summary.json?.code === 0, '账号 summary 可读', `realName=${status}`)

  /* ---------- 1) 侧栏菜单 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/realname`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1800)
  const navInfo = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.uc-nav-item')].find((n) => (n.textContent ?? '').includes('个人实名'))
    return {
      found: Boolean(item),
      active: Boolean(item?.classList.contains('on')),
      ext: Boolean(item?.querySelector('.uc-nav-tag.ext')),
      text: (item?.textContent ?? '').replace(/\s+/g, ''),
    }
  })
  check(navInfo.found && navInfo.active, '侧栏「个人实名」是站内菜单并处于选中态', navInfo.text)
  check(!navInfo.ext, '「个人实名」不再标记为跳转外部页')

  /* ---------- 2) 页面结构 ---------- */
  const text = await bodyText()
  check(text.includes('个人实名认证'), '独立页面已打开')
  check(['资料登记', '人脸活体', '公安比对', '提交审核'].every((label) => text.includes(label)),
    '页面渲染四步进度')
  check(['为什么需要实名认证', '信息如何保护', '办理须知'].every((label) => text.includes(label)),
    '页面渲染实名须知三卡')

  await page.screenshot({ path: path.join(OUT, '01-realname-page.png'), fullPage: true })

  const expectedTag = { none: '未办理', draft: '草稿待核验', pending: '审核中', verified: '已认证', rejected: '审核驳回' }[status]
  if (expectedTag) check(text.includes(expectedTag), `页面状态与接口一致：${expectedTag}`)

  const editable = status === 'none' || status === 'draft' || status === 'rejected'
  if (status === 'verified' || status === 'pending') {
    check(text.includes('办理记录'), '审核中/已认证显示办理记录时间线')
    check(!text.includes('提交实名审核'), '审核中/已认证不出现提交按钮')
  }

  /* ---------- 3) 空提交被前端校验拦下（仅未办理时） ---------- */
  if (status === 'none') {
    const wrapped = []
    page.on('request', (req) => {
      if (req.url().includes('/real-name')) wrapped.push(req.url())
    })
    await page.locator('button').filter({ hasText: '填写身份证资料' }).first().click()
    await page.waitForTimeout(400)
    await page.locator('button').filter({ hasText: '保存资料并进入核验' }).first().click()
    await page.waitForTimeout(700)
    const errText = await page.evaluate(() => document.querySelector('.account-error')?.textContent ?? '')
    const fieldErrors = await page.evaluate(() => document.querySelectorAll('.uc-field-error').length)
    check(errText.includes('修正') && fieldErrors >= 3, '空表单提交被前端拦下并逐项标红', `errors=${fieldErrors}`)
    check(wrapped.length === 0, '前端校验阶段没有发出写请求', `requests=${wrapped.length}`)
  }

  /* ---------- 4) 后端校验位 / 必填校验 ---------- */
  const badId = await call('POST', '/api/v1/sso/account/real-name', {
    realName: '回归测试',
    idCard: '110101199001011234',
    contactPhone: '13800000000',
    address: '回归地址',
  })
  check(badId.json?.code !== 0, '身份证校验位错误被后端拒绝', `code=${badId.json?.code} msg=${String(badId.json?.message ?? '').slice(0, 24)}`)
  const missing = await call('POST', '/api/v1/sso/account/real-name', { realName: '回归测试' })
  check(missing.json?.code !== 0, '缺少必填字段被后端拒绝', `code=${missing.json?.code}`)

  const after = await call('GET', '/api/v1/sso/account/summary')
  check((after.json?.data?.realName?.status ?? 'none') === status, '非法请求没有改动实名状态', `realName=${after.json?.data?.realName?.status ?? 'none'}`)

  /* ---------- 5) 企业实名 / 我的组织 两个独立页 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/enterprise`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  const entText = await bodyText()
  await page.screenshot({ path: path.join(OUT, '02-enterprise-page.png'), fullPage: true })
  check(entText.includes('企业实名认证'), '「企业实名」打开独立页面')
  check(entText.includes('认证需要准备什么') && entText.includes('其他主体认证状态'), '企业实名页含认证清单与主体认证列表')
  check(!entText.includes('个人实名认证已独立'), '企业实名页已删除「个人实名认证已独立」信息块')
  const entNav = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.uc-nav-item')].find((n) => (n.textContent ?? '').includes('企业实名'))
    return { active: Boolean(item?.classList.contains('on')), ext: Boolean(item?.querySelector('.uc-nav-tag.ext')) }
  })
  check(entNav.active && !entNav.ext, '侧栏「企业实名」选中且为站内菜单')

  await page.goto(`${BASE}/portal/index.html#/account/org`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1500)
  const orgText = await bodyText()
  await page.screenshot({ path: path.join(OUT, '03-org-page.png'), fullPage: true })
  check(orgText.includes('我的经营主体') && orgText.includes('申请加入经营主体'), '「我的组织」展示主体与加入申请')
  check(orgText.includes('组织协作'), '「我的组织」提供成员/角色协作入口')
  const orgNav = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.uc-nav-item')].find((n) => (n.textContent ?? '').includes('我的组织'))
    return { active: Boolean(item?.classList.contains('on')), ext: Boolean(item?.querySelector('.uc-nav-tag.ext')) }
  })
  check(orgNav.active && !orgNav.ext, '侧栏「我的组织」选中且为站内菜单')
  check(!orgText.includes('企业主体认证'), '「我的组织」不再混入企业认证弹窗内容')

  await page.goto(`${BASE}/portal/index.html#/account/business`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1200)
  const legacyText = await bodyText()
  check(legacyText.includes('我的经营主体'), '旧地址 #/account/business 回落到「我的组织」')

  check(jsErrors.length === 0, '全程无控制台异常', jsErrors[0] ?? '')
} catch (error) {
  console.error('E2E 失败:', error.message)
  process.exitCode = 1
} finally {
  await browser.close()
}

if (failures.length) {
  console.log(`\n失败 ${failures.length} 项：`)
  failures.forEach((item) => console.log(' -', item))
  process.exitCode = 1
} else if (!process.exitCode) {
  console.log('\n全部通过')
}
