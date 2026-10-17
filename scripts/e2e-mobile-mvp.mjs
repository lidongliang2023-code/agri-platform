#!/usr/bin/env node
/**
 * 联调：生产管理模块移动端（小程序 / H5 双端源码）MVP 全链路。
 *
 * <p>移动端工程在 {@code agri-production/miniprogram}（uni-app 3 + Vue3 + TS），
 * 一套源码同时产出微信小程序与 H5。本脚本走 H5 产物：真浏览器 → vite dev server →
 * nginx 网关 → agri-production，逐个页面断言"渲染出来了 + 取到真实数据 + 没报错"。</p>
 *
 * <p>为什么用 H5 而不是小程序做自动化：小程序需要微信开发者工具（无头跑不了），
 * 而两端共用同一份页面与请求层，H5 通过即能证明接口契约与页面逻辑成立；
 * 小程序产物由 {@code npm run build:mp-weixin} 保证能编译出 20 个页面。</p>
 *
 * 用法：node scripts/e2e-mobile-mvp.mjs [--base=http://localhost:5300] [--user=farmer]
 *       [--password=Admin@123] [--shot=<截图输出目录>] [--headful]
 * 退出码：0 = 全绿；1 = 有断言失败。
 */
import { mkdirSync } from 'node:fs'
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
const BASE_URL = arg('base', 'http://localhost:5300')
const USER = arg('user', 'farmer')
const PASSWORD = arg('password', 'Admin@123')
const SHOT_DIR = arg('shot', '')
const HEADFUL = process.argv.includes('--headful')

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const consoleErrors = []
const pageErrors = []
const badResponses = []
/** 非接口资源的 404（用来区分"业务接口挂了"与"favicon 之类的小资源缺失"） */
const asset404 = []
/** 页面发起的、打到生产域的接口调用（用来证明页面真的取数了，不是空壳） */
const apiCalls = []

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 160))
})
page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err).slice(0, 160)))
page.on('response', (res) => {
  const url = res.url()
  if (url.includes('/api/v1/')) {
    apiCalls.push({ url: url.replace(BASE_URL, ''), status: res.status() })
    if (res.status() >= 400) badResponses.push(`${res.status()} ${res.request().method()} ${url.replace(BASE_URL, '')}`)
    return
  }
  if (res.status() === 404 && !/favicon/.test(url)) asset404.push(url.replace(BASE_URL, ''))
})

/**
 * 脚本侧登录，拿一个令牌做"辅助查询"（取真实 plotId / taskId 给详情页当入参）。
 *
 * <p>刻意**不**从页面的 localStorage 里读令牌：那是页面的内部状态，
 * 脚本自己登录一次更稳，也顺便再验一遍认证中心。</p>
 */
const apiToken = await (async () => {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
  })
  const body = await res.json()
  return body?.data?.accessToken ?? ''
})()

/** 带令牌查一条记录，返回首行的 id 字段（取不到返回空串） */
const firstId = async (path, idKeys) => {
  const res = await fetch(`${BASE_URL}${path}`, { headers: { Authorization: `Bearer ${apiToken}` } })
  const text = await res.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {
    return { id: '', debug: `HTTP ${res.status} 非 JSON：${text.slice(0, 60)}` }
  }
  const rows = body?.data?.records ?? body?.data?.list ?? body?.data ?? []
  const row = Array.isArray(rows) ? rows[0] : undefined
  const id = row ? String(idKeys.map((key) => row[key]).find((value) => value !== undefined) ?? '') : ''
  return { id, debug: `HTTP ${res.status} code=${body?.code} 行数=${Array.isArray(rows) ? rows.length : '?'}` }
}

const pageText = () => page.evaluate(() => document.body.innerText)
const currentHash = () => page.evaluate(() => location.hash)

/**
 * 打开一个移动端页面并等渲染稳定。
 *
 * @param route 路由（不带 #），如 pages/tasks/tasks
 * @param settleMs 额外等待时间（接口是串行的，必要时多等一会儿）
 */
const open = async (route, settleMs = 1200) => {
  await page.goto(`${BASE_URL}/#/${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {})
  await sleep(settleMs)
}

const shot = async (name) => {
  if (!SHOT_DIR) return
  mkdirSync(SHOT_DIR, { recursive: true })
  await page.screenshot({ path: path.join(SHOT_DIR, `${name}.png`) })
}

/**
 * 往 uni-app 的输入框里写值。
 *
 * <p>⚠️ 不能用 `element.type()` 逐字符敲：uni-app H5 的 input 是受控组件，
 * 首字符触发 v-model 更新后组件重渲染，后续按键落不到新节点上 —— 实测密码只进了 "A"，
 * 登录因此报"用户名或密码错误"。必须走**原生 value setter + input 事件**（与仓库其它 e2e 一致）。</p>
 *
 * @param index 第几个输入框（按页面出现顺序）
 * @param value 要写入的值
 */
const setUniInput = async (index, value) => {
  const ok = await page.evaluate(
    ({ i, v }) => {
      const input = document.querySelectorAll('#app input')[i]
      if (!input) return false
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
      setter.call(input, v)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    { i: index, v: value },
  )
  if (!ok) throw new Error(`未找到第 ${index} 个输入框`)
}

try {
  /* ==================== 1) 登录页 ==================== */

  await open('pages/login/login')
  const loginText = await pageText()
  check(loginText.includes('农业生产管理'), '登录页渲染', loginText.replace(/\s+/g, ' ').slice(0, 40))
  await shot('01-login')

  const inputs = await page.$$('#app input')
  check(inputs.length >= 2, '登录表单有账号/密码/市场三个输入框', `找到 ${inputs.length} 个`)
  await setUniInput(0, USER)
  await setUniInput(1, PASSWORD)
  await sleep(300)

  // ⚠️ 不能用"文本等于登录"去找元素：H5 端导航栏标题也叫「登录」，会点到标题上（实测踩过，
  // 表现是"点了没反应、也没有请求发出"）。这里按按钮类名点，并校验它确实是登录按钮。
  const loginButtonText = await page.evaluate(
    () => document.querySelector('#app .btn-primary')?.textContent ?? '',
  )
  check(loginButtonText.replace(/\s+/g, '') === '登录', '找到登录按钮', loginButtonText.trim())
  await page.click('#app .btn-primary')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => {})
  await sleep(2000)

  const token = await page.evaluate(() => window.localStorage.getItem('agri_token'))
  check(Boolean(token), '登录成功：本地拿到访问令牌（说明认证中心可用）')
  const hashAfterLogin = await currentHash()
  check(hashAfterLogin.includes('workbench'), '登录后进入工作台', hashAfterLogin)

  /* ==================== 2) 工作台（Tab1） ==================== */

  await open('pages/workbench/workbench', 1500)
  const wbText = await pageText()
  check(wbText.includes('今日待办'), '工作台有「今日待办」卡片')
  check(wbText.includes('快捷入口'), '工作台有「快捷入口」区')
  check(wbText.includes('告警摘要'), '工作台有「告警摘要」区')
  check(wbText.includes('最近操作'), '工作台有「最近操作」区')
  check(!wbText.includes('加载失败'), '工作台没有加载失败提示')
  await shot('02-workbench')

  /* ==================== 3) 农场 / 地块（Tab2） ==================== */

  await open('pages/plots/plots', 1500)
  const plotsText = await pageText()
  check(plotsText.includes('个地块'), '地块页显示地块数量', plotsText.replace(/\s+/g, ' ').slice(0, 60))
  check(/亩/.test(plotsText), '地块卡片带面积（真实台账字段）')
  await shot('03-plots')

  // 拿一个真实地块 ID 进详情验证（不写死 id）
  const plotPick = await firstId('/api/v1/production/plots?farmId=1&pageNum=1&pageSize=1', ['id', 'plotId'])
  const plotId = plotPick.id
  check(Boolean(plotId), '取到一个真实地块 ID（用作详情页入参）', `${plotId} ${plotPick.debug}`)
  if (plotId) {
    await open(`pages/plots/detail?id=${plotId}`, 1500)
    const plotDetailText = await pageText()
    check(plotDetailText.includes('基本信息'), '地块详情渲染「基本信息」')
    check(plotDetailText.includes('最近农事记录'), '地块详情有「最近农事记录」区')
    await shot('04-plot-detail')
  }

  /* ==================== 4) 农事（Tab3） ==================== */

  await open('pages/tasks/tasks', 1800)
  const tasksText = await pageText()
  check(tasksText.includes('全部') && tasksText.includes('待执行'), '任务页有状态 Tab 筛选')
  check(tasksText.includes('新建任务'), '任务页有「新建任务」入口')
  await shot('05-tasks')

  const taskPick = await firstId('/api/v1/production/tasks?farmId=1&page=1&size=1', ['id', 'taskId'])
  const taskId = taskPick.id
  check(Boolean(taskId), '取到一个真实任务 ID', `${taskId} ${taskPick.debug}`)
  if (taskId) {
    await open(`pages/tasks/detail?id=${taskId}`, 1500)
    const taskDetailText = await pageText()
    check(taskDetailText.includes('任务编号'), '任务详情渲染「任务编号」')
    check(taskDetailText.includes('执行记录'), '任务详情有「执行记录」时间轴区')
    await shot('06-task-detail')
  }

  await open('pages/tasks/create', 1500)
  const taskCreateText = await pageText()
  check(taskCreateText.includes('地块与类型'), '新建任务页渲染第一步')
  check(taskCreateText.includes('时间与人员'), '新建任务页渲染第二步')
  await shot('07-task-create')

  /* ==================== 5) 投入品 ==================== */

  await open('pages/inputs/scan', 1800)
  const inputScanText = await pageText()
  check(inputScanText.includes('录入投入品'), '投入品录入页渲染')
  check(inputScanText.includes('没有匹配的投入品档案') || inputScanText.includes('库存'), '投入品检索有结果或明确空态')
  await shot('08-input-scan')

  /* ==================== 6) 采收 / 库存（Tab4） ==================== */

  await open('pages/harvests/harvests', 1800)
  const harvestsText = await pageText()
  check(harvestsText.includes('本月概览'), '采收页有「本月概览」（当月真实记录聚合）')
  check(harvestsText.includes('新建采收') && harvestsText.includes('库存概览'), '采收页有新建与库存入口')
  await shot('09-harvests')

  await open('pages/harvests/create', 1800)
  const harvestCreateText = await pageText()
  check(harvestCreateText.includes('Step1') && harvestCreateText.includes('Step2'), '新建采收页渲染 Step1/Step2')
  check(harvestCreateText.includes('休药期校验'), '新建采收页有 Step3 休药期校验区')
  await shot('10-harvest-create')

  await open('pages/inventory/inventory', 1500)
  const inventoryText = await pageText()
  check(inventoryText.includes('库存') || inventoryText.includes('暂无库存记录'), '库存概览页渲染')
  await shot('11-inventory')

  /* ==================== 6b) PRD §4.7 的 V1.1 页面 ==================== */

  // (1) 采收休药期拦截（多地块对比）—— 这块有真数据支撑
  await open('pages/food-safety/harvest-block', 2200)
  const blockText = await pageText()
  check(blockText.includes('计划采收日期'), '休药期对比页渲染日期选择')
  check(/✅|❌|⚠️/.test(blockText), '按地块逐个给出休药期状态（✅/❌/⚠️）',
    blockText.replace(/\s+/g, ' ').slice(0, 80))
  check(blockText.includes('块地'), '给出可采收/休药期内的计数')
  await shot('14-harvest-block')

  // (2) 投入品 AI 合规校验 —— 也是真接口（四重校验）
  await open('pages/food-safety/input-ai-check', 2200)
  check((await pageText()).includes('投入品 AI 合规校验'), '投入品合规校验页渲染')
  const pickedInput = await page.evaluate(() => {
    const card = [...document.querySelectorAll('#app .card')].find((el) =>
      (el.textContent ?? '').includes('库存'),
    )
    if (!card) return false
    card.click()
    return true
  })
  check(pickedInput, '合规校验页列出了可选的投入品')
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 15000 }).catch(() => {})
  await sleep(1500)
  const checkedText = await pageText()
  check(checkedText.includes('整体结论') && checkedText.includes('未校验'),
    '选中后给出整体结论，且未校验项如实标注', checkedText.replace(/\s+/g, ' ').slice(0, 80))
  await shot('15-input-check')

  // (3~8) 六个 AI 页面：都接真接口、如实展示 501 原文并给替代路径
  const aiPages = [
    ['pages/ai/assistant', 'AI 农艺师'],
    ['pages/ai/prescription', 'AI 种植处方'],
    ['pages/ai/remote-sensing', 'AI 遥感监测'],
    ['pages/ai/alerts', 'AI 预警中心'],
    ['pages/ai/yield-forecast', 'AI 产量预测'],
    ['pages/food-safety/ai-verify', '消费者 AI 验真'],
  ]
  for (const [route, label] of aiPages) {
    await open(route, 1600)
    const text = await pageText()
    check(
      text.includes('未接入') && text.includes('可用的替代路径'),
      `${label} 页展示后端「未接入」原文 + 替代路径`,
      text.replace(/\s+/g, ' ').slice(0, 60),
    )
  }

  /* ==================== 7) 溯源 / AI / 消息 / 告警 ==================== */

  await open('pages/trace/scan', 1200)
  const traceText = await pageText()
  check(traceText.includes('扫码溯源'), '扫码溯源页渲染')

  await open('pages/ai/pest-detection', 1200)
  const aiText = await pageText()
  check(aiText.includes('未接入'), 'AI 识病页如实标注后端「未接入」（不造假结果）')
  await shot('12-ai-pest')

  await open('pages/messages/messages', 1500)
  check((await pageText()).includes('未读'), '消息中心渲染未读数')

  await open('pages/alerts/alerts', 1500)
  check((await pageText()).includes('告警') || (await pageText()).includes('暂无告警'), '告警页渲染')

  /* ==================== 8) 我的（Tab5） ==================== */

  await open('pages/profile/profile', 1500)
  const profileText = await pageText()
  check(profileText.includes('我的农场'), '个人页有「我的农场」（可切换）')
  check(profileText.includes('设置'), '个人页有设置入口')
  await shot('13-profile')

  await open('pages/profile/settings', 1000)
  check((await pageText()).includes('通知偏好'), '设置页渲染通知偏好')

  /* ==================== 9) 横向断言 ==================== */

  const apiOk = apiCalls.filter((call) => call.status < 400)
  check(apiOk.length >= 8, '页面共发出多次生产域接口调用（页面不是空壳）', `${apiOk.length} 次 2xx`)
  check(badResponses.length === 0, '全链路没有 4xx/5xx 接口响应', badResponses.slice(0, 3).join(' | '))
  check(asset404.length === 0, '没有缺失的静态资源（404）', asset404.slice(0, 3).join(' | '))
  check(pageErrors.length === 0, '没有未捕获的前端异常', pageErrors.slice(0, 2).join(' | '))
  check(
    // "Failed to load resource" 这类由静态资源 404 触发，已由 asset404 单独断言；
    // 这里只关心真正的脚本异常类 console 错误
    consoleErrors.filter((text) => !/Failed to load resource|favicon|sass|Deprecation|vue-i18n/i.test(text))
      .length === 0,
    '没有业务相关的 console 错误',
    consoleErrors.slice(0, 3).join(' | '),
  )
} finally {
  await browser.close()
}

console.log(
  `\n== 移动端 MVP 巡检：访问接口 ${apiCalls.length} 次（2xx ${apiCalls.filter((c) => c.status < 400).length}），失败 ${failures.length} 项 ==`,
)
process.exit(failures.length === 0 ? 0 : 1)
