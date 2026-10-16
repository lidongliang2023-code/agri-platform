#!/usr/bin/env node
/**
 * 联调：用户端「新建农场 → 落库 → 详情页回显」全链路（真浏览器 → 网关 → 生产服务 → MySQL）。

 *
 * <p><b>为什么要真浏览器</b>：2026-10-16 连续两个问题都只有这条链路能照出来 ——
 * ① 表单发的字段名（areaTotal / managerName / managerPhone）与后端 DTO 不一致，值被静默丢掉；
 * ② `POST /farms` 返回的是实体对象而契约要 id 字符串，页面拿它去跳转会拼出 `/farms/[object Object]`。
 * 用 curl 直打后端两种都"看起来正常"（我用正常 id 打什么都是 200）。</p>
 *
 * <p><b>登录态怎么给</b>（照 scripts/page-patrol.mjs 的成熟做法，别再走 localStorage 令牌那条死路）：
 * 前端已按 V2.0 §4.3 把访问令牌改成"只在内存 + HttpOnly Cookie 静默续签"，
 * 往 localStorage 写 agri_token 既不生效、启动时还会被清掉 —— 表现为全程 401 并跳登录页。
 * 正确做法：先落到**同源静态文件**（/prod/manifest.json，落 /login 会被送去统一认证中心那个源），
 * 在页面上下文里发一次登录请求（credentials: include，凭据进 HttpOnly Cookie），
 * 再用 evaluateOnNewDocument 写入**非凭证的界面态**（agri_user_info / agri_roles /
 * agri_permissions / agri_market_id）—— 少写这几项，应用会认定"没登录过"而跳过续签。</p>
 *
 * <p><b>为什么必须驱动真实表单、不能在页面里裸 fetch</b>：访问令牌只存在于
 * `store/auth` 的内存里，由 axios 请求拦截器注入 `Authorization: Bearer …`。
 * 在页面上下文里手写 fetch 不经过该拦截器，于是**请求不带令牌**，
 * 后端按「登录已过期」返回 `HTTP 200 + code 401`（不会进 4xx 统计，很容易被漏看）。
 * 所以本脚本走真 UI：填表 → 点「保存并查看详情」→ 断言跳到 /production/farms/{id}。</p>
 *
 * 用法：node scripts/e2e-farm-create.mjs [--user=farmer] [--base=http://localhost] [--headful]
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
const HEADFUL = process.argv.includes('--headful')

/** 联调数据：字段名与「新增农场」页表单完全一致（不是后端 DTO 名，这正是历史 bug 的源头） */
const stamp = Date.now().toString().slice(-6)
const farmName = `联调农场-${stamp}`
const areaTotal = '66.6'
const managerName = '联调负责人'
const managerPhone = '13900001234'
/** 省市区级联（取自 Create.tsx 的 REGION_OPTIONS：河南省 > 郑州市 > 中牟县） */
const regionPath = ['河南省', '郑州市', '中牟县']
const address = '中牟县联调路 1 号'

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
/**
 * 按文案点按钮。
 *
 * ⚠️ antd 对「两个汉字」的按钮会自动插一个空格（"搜索" 渲染成 "搜 索"），
 * 所以比较前必须去掉所有空白字符，否则永远找不到。
 */
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

const login = await (await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
})).json()
check(login.code === 0, `登录（${USER}）`, `code=${login.code}`)
if (login.code !== 0) process.exit(1)

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
const badResponses = []
/** 页面自己发出的 POST /farms 的响应体（用来核对契约，而不是靠我们手写请求） */
let createCall = null
page.on('response', async (res) => {
  if (res.status() >= 400) {
    let body = ''
    try { body = (await res.text()).slice(0, 120) } catch { /* 忽略 */ }
    badResponses.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE_URL, '')} ${body}`)
  }
  if (/\/api\/v1\/production\/farms$/.test(res.url()) && res.request().method() === 'POST') {
    try { createCall = { status: res.status(), json: await res.json() } } catch { /* 忽略 */ }
  }
})

// 从这里开始的所有步骤都包在 try 里：中途断言/选择器失败时也要把浏览器关掉，
// 否则一个异常退出会留下孤儿 Chrome 进程（实测过一次）。
try {

// 登录：先落同源静态文件，再在页面里发登录请求（凭据进 HttpOnly Cookie）
await page.goto(`${BASE_URL}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 20000 })
await page.evaluate(async (creds) => {
  try {
    await fetch('/api/v1/auth/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      credentials: 'include', body: JSON.stringify(creds),
    })
  } catch { /* 由后续页面表现反映 */ }
}, { username: USER, password: PASSWORD, marketId: 1 })

// 界面态（非凭证）：不写这几项，应用会认为"没登录过"而跳过续签，页面全程 401
await page.evaluateOnNewDocument((state) => {
  try {
    localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
    localStorage.setItem('agri_roles', JSON.stringify(state.roles ?? []))
    localStorage.setItem('agri_permissions', JSON.stringify([]))
    localStorage.setItem('agri_market_id', String(state.marketId ?? 1))
  } catch { /* localStorage 不可用则忽略 */ }
}, { userInfo: login.data.user ?? {}, roles: ['FARMER'], marketId: 1 })

// 1) 列表页：确认登录态真的带上了（而不是"看起来在页面上、其实全程 401"）
await page.goto(`${BASE_URL}/production/farms`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
const listText = await page.evaluate(() => document.body.innerText)
check(listText.includes('农场'), '列表页已登录并渲染（含"农场"字样）')
check(!listText.includes('加载失败'), '列表页没有出现"加载失败"')

// 2) 打开「新增农场」页并填表（字段名就是页面自己的 name，不是后端 DTO 名）
await page.goto(`${BASE_URL}/production/farms/create`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForSelector('#farmName', { timeout: 20000 })
await page.click('#farmName')
await page.type('#farmName', farmName, { delay: 10 })

// 省市区级联：点开面板，逐级点选（antd Cascader 多列面板）
await page.click('#region')
const clickCascaderOption = async (text) => {
  const ok = await page.evaluate((label) => {
    const items = [...document.querySelectorAll('.ant-cascader-menu-item')]
    const hit = items.find((el) => el.textContent.trim() === label)
    if (!hit) return false
    hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    hit.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return true
  }, text)
  if (!ok) throw new Error(`级联选项未出现：${text}`)
  await sleep(400)
}
for (const level of regionPath) {
  await clickCascaderOption(level)
}

await page.click('#address')
await page.type('#address', address, { delay: 10 })
await page.click('#areaTotal')
await page.type('#areaTotal', areaTotal, { delay: 10 })
await page.click('#managerName')
await page.type('#managerName', managerName, { delay: 10 })
await page.click('#managerPhone')
await page.type('#managerPhone', managerPhone, { delay: 10 })

// 3) 点「保存并查看详情」→ 成功后页面自己会 navigate 到 /production/farms/{id}
await clickButtonByText('保存并查看详情')
let navigated = true
await page.waitForFunction(() => /^\/production\/farms\/\d+$/.test(location.pathname), { timeout: 30000 })
  .catch(() => { navigated = false })
if (!navigated) {
  const formErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.ant-form-item-explain-error')].map((e) => e.textContent.trim()))
  check(false, '保存后跳转到 /production/farms/{id}', `当前 ${new URL(page.url()).pathname}；表单报错=${JSON.stringify(formErrors.slice(0, 3))}`)
} else {
  check(true, '保存后跳转到 /production/farms/{id}', new URL(page.url()).pathname)
}

check(Boolean(createCall), '页面发出了 POST /api/v1/production/farms')
if (createCall) {
  check(createCall.status === 200 && createCall.json?.code === 0, '新建农场接口返回成功', `HTTP ${createCall.status} code=${createCall.json?.code}`)
  const newId = createCall.json?.data
  check(typeof newId === 'string' && /^\d+$/.test(newId), '返回的是 id 字符串（契约要求）', `data=${JSON.stringify(newId)}`)
  const pathId = navigated ? new URL(page.url()).pathname.split('/').pop() : null
  check(Boolean(pathId) && pathId === String(newId), '跳转用的 id 与接口返回一致（不是 [object Object]）', `path=${pathId}`)
}

// 4) 详情页：面积 / 负责人 / 联系电话必须回显（这三个字段曾被静默丢掉）
await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
const detailText = await page.evaluate(() => document.body.innerText)
check(detailText.includes(farmName), '详情页显示农场名称', farmName)
check(detailText.includes(areaTotal), '详情页显示面积（areaTotal）', areaTotal)
check(detailText.includes(managerName), '详情页显示负责人（managerName）', managerName)
check(detailText.includes(managerPhone), '详情页显示联系电话（managerPhone）', managerPhone)
check(detailText.includes(regionPath[0]) && detailText.includes(regionPath[1]), '详情页显示省/市', regionPath.join('/'))
// 表单默认勾选「有机认证」，页面会接着写一条资质（POST /farms/{id}/certs）。
// 这条子写入曾被后端 400「证书编号为必填」挡掉，而页面用 Promise.allSettled 吞掉失败 —— 勾了等于没勾。
check(detailText.includes('有机认证'), '详情页显示勾选的资质（有机认证已落库）')

// 5) 列表页用关键字搜到这条新农场（列表默认分页 9 条，不搜不保证在第一页）
await page.goto(`${BASE_URL}/production/farms`, { waitUntil: 'networkidle2', timeout: 60000 })
await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
await page.waitForSelector('input[placeholder="搜索农场名称/编号..."]', { timeout: 20000 })
await page.type('input[placeholder="搜索农场名称/编号..."]', farmName, { delay: 10 })
await clickButtonByText('搜索')
await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
const listAgain = await page.evaluate(() => document.body.innerText)
check(listAgain.includes(farmName), '列表中能查到新建的农场', farmName)

// 6) 状态列：后端一度返回库里的文本 active/inactive，而页面按数字枚举渲染 → 列表「状态」列恒显示"未知"。
//    这条断言就是那次反馈的回归守卫（同时覆盖卡片视图的标签与列表视图的列）。
check(listAgain.includes('运营中'), '卡片视图状态标签显示「运营中」（不是"未知"）')
const switched = await page.evaluate(() => {
  const item = [...document.querySelectorAll('.ant-segmented-item')].find((el) => el.textContent.includes('列表视图'))
  if (!item) return false
  item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  item.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  return true
})
check(switched, '能切到「列表视图」')
await sleep(600)
const tableText = await page.evaluate(() => document.querySelector('.ant-table-tbody')?.innerText ?? '')
check(tableText.includes(farmName), '列表视图渲染出新建的农场', farmName)
check(tableText.includes('运营中'), '列表视图「状态」列显示「运营中」')
check(!tableText.includes('未知'), '列表视图「状态」列不再出现"未知"')

check(badResponses.length === 0, '全链路没有 4xx/5xx 响应', badResponses.slice(0, 3).join(' | '))

} finally {
  await browser.close()
}

console.log(`\n== 新建农场「${farmName}」id=${createCall?.json?.data ?? '?'}，失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
