#!/usr/bin/env node
/**
 * 联调：农事任务「新建 → 落库 → 查询」全链路（真浏览器 → 网关 → 生产服务 → MySQL）。
 *
 * <p>背景（2026-10-16 用户口径）：联调农事任务的新建和查询接口，保证农事任务能落库。
 * 动手前发现入参 DTO 缺三个**页面口径的别名**，于是页面提交时这几项被静默丢掉 ——
 * 任务建出来了，却没有执行人、没有计划时段、没有描述（页面上还提示"任务创建成功"）：</p>

 *
 * <ul>
 *   <li>页面发 {@code assigneeId}（成员业务标识，如 DEMO-MEM-002），DTO 只有 {@code executorId}；</li>
 *   <li>页面发 {@code description}，DTO 只有 {@code taskDesc}；</li>
 *   <li>页面发 {@code planStartDate/planEndDate}，DTO 只有 {@code planStartTime/planEndTime}。</li>
 * </ul>

 *
 * <p>出参 {@code TaskVO} 早就用 {@code @JsonProperty} 做了这层映射（读没问题），入参一直是空的。
 * 另外 {@code POST /tasks} 原先返回实体对象，而契约（前端 {@code createTask}）是 id 字符串。</p>

 *
 * <p>本脚本断言：① 三步向导能走完并提交；② 返回的是 id 字符串；③ 落库四件套齐
 * （执行人主键+姓名、计划起止**含时分**、描述）；④ 详情接口与列表都能查回来。</p>
 *
 * 用法：node scripts/e2e-task-create.mjs [--user=farmer] [--base=http://localhost] [--farm=1] [--headful]
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
const FARM_ID = arg('farm', '1')
const HEADFUL = process.argv.includes('--headful')

const stamp = Date.now().toString().slice(-6)
const taskName = `联调任务-${stamp}`
const planStart = '2026-10-22 08:30:00'
const planEnd = '2026-10-22 11:45:00'
const description = '联调描述：上午滴灌并记录叶温'

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
  if (/\/api\/v1\/production\/tasks$/.test(res.url()) && res.request().method() === 'POST') {
    // 同时留一份请求体：page 发来的字段名与后端 DTO 对不上时，这是唯一能直接看到的地方
    try {
      createCall = { status: res.status(), json: await res.json(), body: res.request().postData() ?? '' }
    } catch { /* 忽略 */ }
  }
})

const readVisibleOptions = () =>
  page.evaluate(() => {
    const dropdowns = [...document.querySelectorAll('.ant-select-dropdown')]
      .filter((d) => !d.classList.contains('ant-select-dropdown-hidden'))
    return dropdowns
      .flatMap((d) => [...d.querySelectorAll('.ant-select-item-option')])
      .map((o) => o.textContent.trim())
  })
const waitForOptions = async (timeoutMs = 15000) => {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const labels = await readVisibleOptions()
    if (labels.length > 0 || Date.now() > deadline) {
      await sleep(200)
      return labels
    }
    await sleep(300)
  }
}
const openSelect = async (selector) => {
  await page.click(selector)
  return waitForOptions()
}
const pickSelectOption = async (text) =>
  page.evaluate((label) => {
    const dropdowns = [...document.querySelectorAll('.ant-select-dropdown')]
      .filter((d) => !d.classList.contains('ant-select-dropdown-hidden'))
    const options = dropdowns.flatMap((d) => [...d.querySelectorAll('.ant-select-item-option')])
    const hit = options.find((o) => o.textContent.includes(label))
    if (!hit) return { ok: false, labels: options.map((o) => o.textContent.trim()) }
    hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { ok: true, labels: options.map((o) => o.textContent.trim()) }
  }, text)
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
/** 给日期时间控件填值：点击 → 输入 → 回车（antd 的 DatePicker 接受这种输入方式） */
const fillDateTime = async (selector, value) => {
  await page.click(selector)
  await page.type(selector, value, { delay: 20 })
  await page.keyboard.press('Enter')
  await sleep(300)
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
  }, { username: USER, password: PASSWORD, marketId: 1 })
  await page.evaluateOnNewDocument((state) => {
    try {
      localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
      localStorage.setItem('agri_roles', JSON.stringify(['FARMER']))
      localStorage.setItem('agri_permissions', JSON.stringify([]))
      localStorage.setItem('agri_market_id', '1')
      localStorage.setItem('agri_current_farm', JSON.stringify({ farmId: state.farmId, farmCode: '', farmName: '' }))
    } catch { /* localStorage 不可用则忽略 */ }
  }, { userInfo: login.data.user ?? {}, farmId: FARM_ID })

  // 1) 新建任务页（三步向导）
  await page.goto(`${BASE_URL}/production/tasks/create`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('#taskName', { timeout: 20000 })
  await sleep(800)
  check(true, '「新建任务」页已打开')

  // 步骤 1：基本信息
  await page.click('#taskName')
  await page.type('#taskName', taskName, { delay: 10 })
  // 任务类型：下拉（ProFormSelect）
  const typeOptions = await openSelect('#taskType')
  check(typeOptions.length > 0, '「任务类型」下拉有选项', `共 ${typeOptions.length} 项`)
  await pickSelectOption('灌溉')
  await sleep(300)
  // 地块：下拉（只列启用中的地块）
  const plotOptions = await openSelect('#plotId')
  check(plotOptions.length > 0, '「地块」下拉有选项', plotOptions.slice(0, 2).join(' / '))
  await pickSelectOption('A区连栋大棚')
  await sleep(300)
  await clickButtonByText('下一步')
  await sleep(600)

  // 步骤 2：执行设置（计划起止 + 执行人）
  await fillDateTime('#planStartDate', planStart)
  await fillDateTime('#planEndDate', planEnd)
  const memberOptions = await openSelect('#assigneeId')
  check(memberOptions.length > 0, '「执行人」下拉有选项', `共 ${memberOptions.length} 项：${memberOptions.slice(0, 3).join(' / ')}`)
  await pickSelectOption('刘玉华')
  await sleep(300)
  await clickButtonByText('下一步')
  await sleep(600)

  // 步骤 3：描述 + 提交
  await page.click('#description')
  await page.type('#description', description, { delay: 10 })
  // 提交前把每个控件的 DOM 取值与出现次数打出来：字段"没进 payload"时，
  // 先要分清是"控件里根本没值"还是"值在控件里、但表单没收到"（多步表单容易两者都像）。
  const domSnapshot = await page.evaluate(() => {
    const ids = ['taskName', 'taskType', 'plotId', 'planStartDate', 'planEndDate', 'assigneeId', 'description']
    return ids.map((id) => ({
      id,
      count: document.querySelectorAll(`#${id}`).length,
      value: document.querySelector(`#${id}`)?.value ?? null,
      visible: (() => {
        const el = document.querySelector(`#${id}`)
        if (!el) return false
        const rect = el.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0
      })(),
    }))
  })
  console.log('  控件快照：', JSON.stringify(domSnapshot))
  await clickButtonByText('提交')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  await sleep(1000)

  check(Boolean(createCall), '页面发出了 POST /api/v1/production/tasks')
  let taskId = ''
  if (createCall) {
    check(createCall.status === 200 && createCall.json?.code === 0, '新建任务接口返回成功',
      `HTTP ${createCall.status} code=${createCall.json?.code} ${createCall.json?.message ?? ''}`)
    if (createCall.json?.code !== 0) {
      console.log(`  请求体：${String(createCall.body).slice(0, 300)}`)
    }
    taskId = String(createCall.json?.data ?? '')
    check(/^\d+$/.test(taskId), '返回的是 id 字符串（契约要求）', `data=${JSON.stringify(createCall.json?.data)}`)
  }

  const formErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.ant-form-item-explain-error')].map((e) => e.textContent.trim()))
  check(formErrors.length === 0, '表单没有校验报错', formErrors.slice(0, 3).join(' / '))

  // 2) 查询侧：详情接口要把四件套都回显出来
  if (taskId) {
    const detail = await (await fetch(`${BASE_URL}/api/v1/production/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${login.data.accessToken}` },
    })).json()
    check(detail.code === 0, '详情接口返回成功', `code=${detail.code}`)
    check(detail.data?.taskName === taskName, '详情接口回显任务名称', `taskName=${detail.data?.taskName}`)
    check(Boolean(detail.data?.assigneeId) && detail.data?.assigneeName === '刘玉华',
      '执行人落库（assigneeId + 执行人姓名）',
      `assigneeId=${detail.data?.assigneeId} assigneeName=${detail.data?.assigneeName}`)
    check(String(detail.data?.planStartDate ?? '').includes('08:30'),
      '计划开始落库且**保留时分**（08:30）', `planStartDate=${detail.data?.planStartDate}`)
    check(detail.data?.description === description, '任务描述落库', `description=${detail.data?.description}`)

    // 3) 列表查询能查到
    const pageResp = await (await fetch(
      `${BASE_URL}/api/v1/production/tasks?pageNum=1&pageSize=10&keyword=${encodeURIComponent(taskName)}`,
      { headers: { Authorization: `Bearer ${login.data.accessToken}` } },
    )).json()
    check(pageResp.code === 0 && pageResp.data?.total >= 1
      && (pageResp.data?.records ?? []).some((t) => t.taskName === taskName),
      '列表接口按关键字能查到这条任务', `total=${pageResp.data?.total}`)

    // 4) 列表**页面**也要能看到它（接口能查到 ≠ 页面渲染得出来）
    await page.goto(`${BASE_URL}/production/tasks`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
    const listText = await page.evaluate(() => document.body.innerText)
    check(listText.includes(taskName), '「农事任务」列表页能查到新建的任务', taskName)
  }

  check(badResponses.length === 0, '全链路没有 4xx/5xx 响应', badResponses.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n== 新建任务「${taskName}」id=${createCall?.json?.data ?? '?'}，失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
