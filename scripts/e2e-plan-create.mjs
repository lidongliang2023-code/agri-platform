#!/usr/bin/env node
/**
 * 联调：用户端「新增种养计划 → 关联地块 → 列表可见」全链路（真浏览器 → 网关 → 生产服务 → MySQL）。
 *
 * <p>背景（2026-10-16 用户反馈"新增种养计划，能关联地块"）：新建弹窗里那一栏原先是一个
 * **自由文本框「关联地块 ID」** —— 用户不知道地块主键是几，也没法选；就算手填对了数字，
 * 也只落 {@code plot_id}、不落 {@code plot_name}，列表「地块」列照样显示 "-"，看着像没关联上。
 * 现在页面改成地块台账下拉，后端在只给 ID 时按地块表补齐地块名。</p>

 *
 * <p>本脚本断言的就是这两件事：① 下拉里真的列得出本农场的地块；② 选中后提交，
 * 列表那一行的「地块」列显示的是地块名（而不是 "-" 或 ID）。</p>
 *
 * <p>登录态给法同 {@code scripts/e2e-farm-create.mjs}：落同源静态文件 → 页面上下文 POST /auth/login
 * 种下 HttpOnly Cookie → evaluateOnNewDocument 写非凭证界面态。这里额外写
 * {@code agri_current_farm}，因为计划列表 / 地块下拉都以「当前农场」为作用域。</p>
 *
 * 用法：node scripts/e2e-plan-create.mjs [--user=farmer] [--base=http://localhost] [--farm=1] [--headful]
 * 退出码：0 = 全链路通过；1 = 有断言失败。
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
const USER = arg('user', 'farmer')
const PASSWORD = arg('password', 'Admin@123')
/** 当前农场上下文：计划与地块都挂在它下面（默认用演示农场 1，它名下有多个地块） */
const FARM = {
  farmId: arg('farm', '1'),
  farmCode: '',
  farmName: '',
}
const HEADFUL = process.argv.includes('--headful')

const stamp = Date.now().toString().slice(-6)
const planName = `联调计划-${stamp}`
const cropName = '水稻'
/** 期望被选中的地块名（取当前农场台账里的一条） */
const targetPlotName = arg('plot', 'A区连栋大棚')
const startDate = '2026-04-01'
const endDate = '2026-08-31'

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const login = await (await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
})).json()
check(login.code === 0, `登录（${USER}）`, `code=${login.code}`)
if (login.code !== 0) process.exit(1)

// 补全当前农场的编码 / 名称（下拉与计划都要它），取不到就只给 ID —— 不编名称
try {
  const farms = await (await fetch(`${BASE_URL}/api/v1/production/farms/all`, {
    headers: { Authorization: `Bearer ${login.data.accessToken}` },
  })).json()
  const hit = (farms.data ?? []).find((f) => String(f.farmId ?? f.id) === FARM.farmId)
  if (hit) {
    FARM.farmCode = hit.farmCode ?? ''
    FARM.farmName = hit.farmName ?? ''
  }
} catch {
  /* 名称只影响断言里的展示，取不到不阻断 */
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
const badResponses = []
/** 页面自己发出的 POST /plans 的响应体（用来核对契约） */
let createCall = null
page.on('response', async (res) => {
  if (res.status() >= 400) {
    let body = ''
    try { body = (await res.text()).slice(0, 120) } catch { /* 忽略 */ }
    badResponses.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE_URL, '')} ${body}`)
  }
  if (/\/api\/v1\/production\/plans$/.test(res.url()) && res.request().method() === 'POST') {
    try { createCall = { status: res.status(), json: await res.json() } } catch { /* 忽略 */ }
  }
})

/** 按文案点按钮（antd 会给两字按钮插空格，比较前去掉所有空白） */
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

/**
 * 弹窗内字段选择器。
 *
 * ⚠️ 不能直接用 `#planName` / `#cropId`：ProTable 的**搜索表单**也会为可搜索列生成同名字段
 * （计划名称 = planName、作物 = cropId），而它在 DOM 里排在弹窗之前 ——
 * `page.click('#cropId')` 会打到列表上那个输入框（实测报 "Node is either not clickable"，因为它在遮罩后）
 * 甚至把计划名称填进搜索框里。全部限定在 `.ant-modal-content` 内。
 */
const inModal = (id) => `.ant-modal-content ${id}`

try {
  await page.goto(`${BASE_URL}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.evaluate(async (creds) => {
    try {
      await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(creds),
      })
    } catch { /* 由后续页面表现反映 */ }
  }, { username: USER, password: PASSWORD, marketId: 1 })

  await page.evaluateOnNewDocument((state) => {
    try {
      localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
      localStorage.setItem('agri_roles', JSON.stringify(state.roles ?? []))
      localStorage.setItem('agri_permissions', JSON.stringify([]))
      localStorage.setItem('agri_market_id', String(state.marketId ?? 1))
      localStorage.setItem('agri_current_farm', JSON.stringify(state.farm))
    } catch { /* localStorage 不可用则忽略 */ }
  }, { userInfo: login.data.user ?? {}, roles: ['FARMER'], marketId: 1, farm: FARM })

  // 1) 计划列表页
  await page.goto(`${BASE_URL}/production/plans`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const listText = await page.evaluate(() => document.body.innerText)
  check(listText.includes('种养计划'), '计划列表页已登录并渲染')

  // 2) 打开「新增种养计划」弹窗
  await clickButtonByText('新增种养计划')
  await page.waitForSelector(inModal('#planName'), { timeout: 20000 })
  check(true, '「新增种养计划」弹窗已打开')

  // 3) 要点一：地块下拉里真的列得出本农场的地块
  await page.click(inModal('#plotId'))
  await page.waitForSelector('.ant-select-item-option', { timeout: 15000 })
  await sleep(400)
  const options = await page.evaluate(() =>
    [...document.querySelectorAll('.ant-select-item-option')].map((el) => el.textContent.trim()))
  check(options.length > 0, '「关联地块」下拉列出了可选地块', `共 ${options.length} 项`)
  check(options.some((text) => text.includes(targetPlotName)), `下拉里含目标地块「${targetPlotName}」`,
    options.slice(0, 3).join(' / '))

  const picked = await page.evaluate((label) => {
    const hit = [...document.querySelectorAll('.ant-select-item-option')]
      .find((el) => el.textContent.includes(label))
    if (!hit) return false
    hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  }, targetPlotName)
  check(picked, '能选中该地块')
  await sleep(400)

  // 4) 填其余必填项
  await page.click(inModal('#planName'))
  await page.type(inModal('#planName'), planName, { delay: 10 })
  await page.click(inModal('#cropId'))
  await page.type(inModal('#cropId'), cropName, { delay: 10 })
  for (const [id, value] of [['#planStartDate', startDate], ['#planEndDate', endDate]]) {
    await page.click(inModal(id))
    await page.type(inModal(id), value, { delay: 20 })
    await page.keyboard.press('Enter')
    await sleep(300)
  }

  // 5) 提交（ModalForm 的确定按钮）
  const submitted = await page.evaluate(() => {
    const btn = document.querySelector('.ant-modal-footer .ant-btn-primary')
    if (!btn) return false
    btn.click()
    return true
  })
  check(submitted, '点击弹窗确定按钮')

  await page.waitForFunction(
    () => !document.querySelector('.ant-modal-content, .ant-modal'),
    { timeout: 20000 },
  ).catch(() => {})
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})

  const formErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.ant-form-item-explain-error')].map((e) => e.textContent.trim()))
  check(formErrors.length === 0, '表单没有校验报错', formErrors.slice(0, 3).join(' / '))

  check(Boolean(createCall), '页面发出了 POST /api/v1/production/plans')
  if (createCall) {
    check(createCall.status === 200 && createCall.json?.code === 0, '新增计划接口返回成功',
      `HTTP ${createCall.status} code=${createCall.json?.code} ${createCall.json?.message ?? ''}`)
    const newId = createCall.json?.data
    check(typeof newId === 'string' && /^\d+$/.test(newId), '返回的是 id 字符串（契约要求）',
      `data=${JSON.stringify(newId)}`)
  }

  // 6) 要点二：列表那一行的「地块」列显示地块名，而不是 "-"
  const rowText = await page.evaluate((name) => {
    const row = [...document.querySelectorAll('.ant-table-tbody tr')]
      .find((tr) => (tr.innerText ?? '').includes(name))
    return row ? row.innerText : ''
  }, planName)
  check(rowText.includes(planName), '列表里能查到新建的计划', planName)
  check(rowText.includes(targetPlotName), '该行「地块」列显示地块名（不是 "-"）',
    rowText.replace(/\s+/g, ' ').slice(0, 120))

  check(badResponses.length === 0, '全链路没有 4xx/5xx 响应', badResponses.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n== 新建计划「${planName}」id=${createCall?.json?.data ?? '?'}，地块「${targetPlotName}」，失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
