#!/usr/bin/env node
/**
 * 联调：移动端**写链路**（建任务 / 建采收 / 登记投入品使用）真的落库吗？
 *
 * <p>{@code e2e-mobile-mvp.mjs} 只证明"页面渲染 + 读链路通"，本脚本补上写入侧，
 * 并顺带把 PRD §4.4.2 的**休药期硬拦截**做成一条可复现的断言：</p>
 *
 * <ol>
 *   <li>用移动端页面登记一条**农药**使用记录（地块 A区-地块1，安全间隔期 21 天，日期今天）；</li>
 *   <li>同地块新建采收 → 应被休药期拦截（按钮变灰、不发 POST）；</li>
 *   <li>换地块 A区-地块2 新建采收 → 放行并落库（直连 MySQL 复核）；</li>
 *   <li>新建任务 → 落库（直连 MySQL 复核）；</li>
 *   <li>清理本次造的三条数据（采收批次 / 使用记录 / 任务），并复核查询侧回到基线。</li>
 * </ol>
 *
 * 用法：node scripts/e2e-mobile-writes.mjs [--base=http://localhost:5300] [--user=farmer]
 *       [--password=Admin@123] [--plot-block=A区-地块1] [--plot-ok=A区-地块2] [--headful]
 * 退出码：0 = 全绿；1 = 有断言失败。
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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
const API_URL = arg('api', 'http://localhost')
const USER = arg('user', 'farmer')
const PASSWORD = arg('password', 'Admin@123')
/**
 * 用来登农药使用记录、随后应被休药期拦下的地块。
 *
 * <p>⚠️ 为什么不是随便挑一块地：移动端 H5 的 picker 是**滚轮**，没有循环，
 * 从索引 0 起以固定步长（-100px ≈ 4 项）只能走到 0 / 4 / 6 这几个索引（到底会卡住）。
 * 所以用例选的是**滚轮可达**的两块地：E区休耕地（索引 4）与 A区-地块2（索引 6）。
 * 脚本每步都会读回"当前选中项"并在不一致时直接报错，列表改了会立刻暴露，不会静默写错地块。</p>
 */
const BLOCK_PLOT = arg('plot-block', 'E区休耕地')
/** 另一块地：没有近期用药，应当放行并落库 */
const OK_PLOT = arg('plot-ok', 'A区-地块2')
/** 农药名（安全间隔期 21 天，库里真实存在） */
const PESTICIDE = arg('pesticide', '稻瘟灵乳油')
/** 采收人（本农场成员） */
const OPERATOR = arg('operator', '陈志强')
const MYSQL_BIN = arg(
  'mysql',
  existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
    ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
    : '',
)
const DB = 'agri_production'
const HEADFUL = process.argv.includes('--headful')

const stamp = Date.now().toString().slice(-6)
const taskName = `移动端联调任务-${stamp}`
const harvestRemark = `移动端联调采收-${stamp}`
const usageMethod = `移动端联调-${stamp}`
const harvestQuantity = 318.6
const usageDosage = 2

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const mysqlQuery = (sql) => {
  if (!MYSQL_BIN) return null
  try {
    // --default-character-set=utf8mb4：否则 Windows 控制台会把中文列输出成乱码，
    // 断言就会变成"数据明明对、脚本却说不对"
    return execFileSync(
      MYSQL_BIN,
      ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', sql],
      { encoding: 'utf8' },
    ).trim()
  } catch (err) {
    // SQL 写错（列名变更之类）时不要把整个脚本带崩：返回可读的错误文本，交给断言去报
    return `SQL_ERROR ${String(err?.stderr ?? err?.message ?? err).replace(/\s+/g, ' ').slice(0, 120)}`
  }
}

/** 脚本侧令牌：用于落库复核与清理（不依赖页面内部状态） */
const loginBody = await (
  await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
  })
).json()
const token = loginBody?.data?.accessToken ?? ''
check(Boolean(token), '脚本侧登录拿令牌')

const api = async (method, path, body) => {
  const res = await fetch(`${API_URL}/api/v1/production${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    json = { parseError: text.slice(0, 80) }
  }
  return { status: res.status, json }
}

/** 按地块名查地块主键（用来核对库里的 plot_id 是不是页面显示的那块地） */
const plotIdByName = async (name) => {
  const res = await api('GET', '/plots?farmId=1&pageNum=1&pageSize=100')
  const rows = res.json?.data?.records ?? res.json?.data?.list ?? []
  const hit = rows.find((row) => String(row.plotName) === name)
  return hit ? String(hit.id ?? hit.plotId) : ''
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 })
const pageErrors = []
const badResponses = []
/** 页面发出的写请求（用来断言"该发的发了、不该发的没发"） */
const writes = []
page.on('pageerror', (err) => pageErrors.push(String(err?.message ?? err).slice(0, 160)))
page.on('request', (req) => {
  const method = req.method()
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && req.url().includes('/api/v1/')) {
    writes.push(`${method} ${req.url().replace(API_URL, '')}`)
  }
})
page.on('response', (res) => {
  if (res.url().includes('/api/v1/') && res.status() >= 400) {
    badResponses.push(`${res.status()} ${res.request().method()} ${res.url().replace(API_URL, '')}`)
  }
})

const open = async (route, settleMs = 1500) => {
  await page.goto(`${BASE_URL}/#/${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 500, timeout: 15000 }).catch(() => {})
  await sleep(settleMs)
}

/** 给 uni-app 受控 input 赋值（逐字符 type() 会被吃掉，见 e2e-mobile-mvp.mjs 注释） */
const setUniInput = async (index, value) => {
  await page.evaluate(
    ({ i, v }) => {
      const input = document.querySelectorAll('#app input')[i]
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, v)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    },
    { i: index, v: value },
  )
}

/**
 * 按"字段标签"给输入框赋值。
 *
 * <p>移动端页面统一用 `.field`（左标签 + 右控件）排版，所以按标签定位比按索引稳，
 * 页面加一个字段也不会让脚本错位。</p>
 */
const fillField = async (label, value, asTextArea = false) => {
  const ok = await page.evaluate(
    ({ text, val, area }) => {
      const field = [...document.querySelectorAll('#app .field')].find((el) =>
        (el.textContent ?? '').replace(/\s+/g, '').startsWith(text.replace(/\s+/g, '')),
      )
      if (!field) return false
      const input = field.querySelector(area ? 'textarea' : 'input')
      if (!input) return false
      const proto = area ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, val)
      input.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    },
    { text: label, val: value, area: asTextArea },
  )
  if (!ok) throw new Error(`未找到字段「${label}」`)
}

/** 直接给页面上第一个 textarea 赋值（作业说明这类没有 `.field` 包裹的控件） */
const fillFirstTextArea = async (value) => {
  const ok = await page.evaluate((val) => {
    const area = document.querySelector('#app textarea')
    if (!area) return false
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(area, val)
    area.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, value)
  if (!ok) throw new Error('页面上没有 textarea')
}

/** 读打开中 picker 的"当前选中项文案"与"全部选项文案" */
const readPickerState = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('.uni-picker-container')].find(
      (node) => getComputedStyle(node).display !== 'none',
    )
    if (!el) return null
    const items = [...el.querySelectorAll('.uni-picker-item')].map((item) => item.textContent.trim())
    const selected = [...el.querySelectorAll('.uni-picker-item.selected')].map((item) => item.textContent.trim())
    // 选项在 DOM 里是两段重复的（滚轮两端各一份），取前半段即可
    const half = items.slice(0, Math.max(1, items.length / 2))
    return { items: half, selected: selected[0] ?? '' }
  })

/**
 * 选择 uni-app `<picker mode="selector">` 里的某一项。
 *
 * <p>⚠️ H5 端 picker 是**滚轮**（`.uni-picker-view-wrapper` + `.uni-picker-item`），
 * 点某个选项**不会**改变选中值 —— 实测点完"完成"拿到的还是索引 0 的旧值（第一版脚本就这样把
 * 投入品使用记录落到了错误的地块上）。必须像真人那样**拖动滚轮**：拖到目标项为止，
 * 每拖一次回头核对 `.uni-picker-item.selected`，最后点「完成」再用字段文案复核一次。</p>
 *
 * @param fieldLabel 字段标签（如「采收地块」）
 * @param optionText 目标选项文案
 * @returns 选项清单（便于失败时打印诊断）
 */
const pickOption = async (fieldLabel, optionText) => {
  const opened = await page.evaluate((label) => {
    const field = [...document.querySelectorAll('#app .field')].find((el) =>
      (el.textContent ?? '').replace(/\s+/g, '').startsWith(label.replace(/\s+/g, '')),
    )
    if (!field) return false
    const host = field.closest('uni-picker') ?? field.parentElement
    host?.click()
    return true
  }, fieldLabel)
  if (!opened) throw new Error(`未找到字段「${fieldLabel}」`)
  await sleep(700)

  const initial = await readPickerState()
  if (!initial) throw new Error(`「${fieldLabel}」的滚轮没有打开`)
  // 选项文案各页略有差别（任务页的执行人带岗位：`陈志强（农场负责人）`，采集页只有姓名），
  // 所以先找精确匹配，找不到再退化为"包含匹配"，并以**解析出的实际选项**为拖动目标。
  const targetItem =
    initial.items.find((item) => item === optionText) ??
    initial.items.find((item) => item.includes(optionText))
  if (!targetItem) {
    throw new Error(`「${fieldLabel}」的选项里没有「${optionText}」，现有：${initial.items.join(' / ')}`)
  }

  // ⚠️ 拖之前必须把滚轮滚进视口：像「投入品录入」页这种长页面，picker 在首屏之外，
  // 直接按 getBoundingClientRect 的坐标拖等于拖在空白处（实测就是这样一直选不动）。
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.uni-picker-container')].find(
      (node) => getComputedStyle(node).display !== 'none',
    )
    el?.querySelector('.uni-picker-view-wrapper')?.scrollIntoView({ block: 'center' })
  })
  await sleep(400)
  const box = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.uni-picker-container')].find(
      (node) => getComputedStyle(node).display !== 'none',
    )
    const wrapper = el.querySelector('.uni-picker-view-wrapper')
    const rect = wrapper.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })

  /**
   * 滚轮步进：固定向上拖 100px。
   *
   * <p>实测这台机器上：位移 &lt; 90px **完全不生效**（手势阈值），100px 约走 4 项、
   * 170px 约走 6 项且会冲过 1 项；所以不做"按差值一次拖到位"的算术（会被惯性和阈值坑），
   * 而是**每步固定 -100px，拖一次读一次选中项**。7 项的地块列表按 +4 步进正好能遍历所有索引，
   * 3 项的成员列表一次就落到末尾项。</p>
   */
  const STEP_PX = -100
  const dragOnce = async () => {
    const startY = box.y - STEP_PX / 2
    await page.mouse.move(box.x, startY)
    await page.mouse.down()
    for (let i = 1; i <= 8; i += 1) {
      await page.mouse.move(box.x, startY + (STEP_PX * i) / 8)
      await sleep(20)
    }
    await page.mouse.up()
    await sleep(650)
  }
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const state = await readPickerState()
    if (!state || state.selected === targetItem) break
    await dragOnce()
  }

  const finalState = await readPickerState()
  if (!finalState || finalState.selected !== targetItem) {
    throw new Error(
      `拖动后「${fieldLabel}」仍未选中「${targetItem}」（当前 ${finalState?.selected ?? '未知'}）`,
    )
  }
  await page.evaluate(() => {
    const el = [...document.querySelectorAll('.uni-picker-container')].find(
      (node) => getComputedStyle(node).display !== 'none',
    )
    el?.querySelector('.uni-picker-action-confirm')?.click()
  })
  await sleep(400)

  // 最后按字段文案复核：改到一半没生效时，宁可这里报错也不要静默用旧值继续跑
  const shown = await page.evaluate((label) => {
    const field = [...document.querySelectorAll('#app .field')].find((el) =>
      (el.textContent ?? '').replace(/\s+/g, '').startsWith(label.replace(/\s+/g, '')),
    )
    return (field?.querySelector('.field-value')?.textContent ?? '').trim()
  }, fieldLabel)
  // 显示值不要求逐字等于选项：任务页的「执行人」字段只渲染姓名，选项里带岗位
  // （选项 `陈志强（农场负责人）` → 字段显示 `陈志强`）。只要两边互相包含就算选对了。
  const consistent =
    shown === targetItem || targetItem.includes(shown) || shown.includes(optionText)
  if (!consistent) {
    throw new Error(`「${fieldLabel}」显示为「${shown}」，与所选「${targetItem}」不一致`)
  }
  return finalState.items
}

/** 按文案点按钮（页面上的按钮是 view.btn-primary / btn-ghost） */
const clickButton = async (label) => {
  const ok = await page.evaluate((text) => {
    const norm = (s) => (s ?? '').replace(/\s+/g, '')
    const el = [...document.querySelectorAll('#app .btn-primary, #app .btn-ghost, #app button')].find(
      (node) => norm(node.textContent) === norm(text),
    )
    if (!el) return false
    el.click()
    return true
  }, label)
  if (!ok) throw new Error(`未找到按钮「${label}」`)
}

const bodyText = () => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))

const created = { usageId: '', batchId: '', taskId: '', plotId: '' }
const plotName = `移动端联调地块-${stamp}`

try {
  /* ==================== 0) 登录 ==================== */

  await open('pages/login/login', 800)
  await setUniInput(0, USER)
  await setUniInput(1, PASSWORD)
  await sleep(300)
  await clickButton('登录')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => {})
  await sleep(1800)
  check((await page.evaluate(() => location.hash)).includes('workbench'), '登录后进入工作台')

  /* ==================== 1) 写链路①：登记一条农药使用记录 ==================== */

  await open('pages/inputs/scan', 1800)
  const pickedInput = await page.evaluate((name) => {
    const card = [...document.querySelectorAll('#app .card')].find((el) =>
      (el.textContent ?? '').includes(name),
    )
    if (!card) return false
    card.click()
    return true
  }, PESTICIDE)
  check(pickedInput, `投入品检索结果里选中「${PESTICIDE}」`)
  await sleep(800)

  await pickOption('使用地块', BLOCK_PLOT)
  await fillField('用量', String(usageDosage))
  await fillField('施用方式', usageMethod)
  const usageChecks = await bodyText()
  check(usageChecks.includes('库存校验'), '选中投入品后出现合规校验区')
  check(usageChecks.includes('未校验'), '禁用清单/用量标准两项如实标注「未校验」（不谎报通过）')

  const writesBefore = writes.length
  await clickButton('登记使用记录')
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 20000 }).catch(() => {})
  await sleep(1200)
  const usageWrite = writes.slice(writesBefore).find((item) => item.includes('/inputs/usages'))
  check(Boolean(usageWrite), '页面发出 POST /inputs/usages', usageWrite ?? writes.slice(writesBefore).join(' | '))

  const usageRow = MYSQL_BIN
    ? mysqlQuery(
        `SELECT id, plot_id, input_id, dosage, safety_interval_days FROM ${DB}.agri_prod_input_usage ` +
          // 用本轮唯一标记的「施用方式」定位这一行，避免"取最新一行"在别的写入发生时看错行
          `WHERE method = '${usageMethod}' ORDER BY id DESC LIMIT 1;`,
      )
    : null
  if (MYSQL_BIN) {
    const cells = (usageRow ?? '').split(/\s+/)
    created.usageId = cells[0] ?? ''
    check(Boolean(created.usageId), 'MySQL 里落了新的使用记录', usageRow ?? '（查不到）')
    const expectedPlotId = await plotIdByName(BLOCK_PLOT)
    check(cells[1] === expectedPlotId, `库里 plot_id 就是页面选中的「${BLOCK_PLOT}」`,
      `plot_id=${cells[1]} 期望=${expectedPlotId}`)
    check(Number(cells[3]) === usageDosage, '库里用量与提交值一致', `dosage=${cells[3]}`)
    check(Number(cells[4]) > 0, '库里落下了安全间隔期（休药期算法依赖它）', `interval=${cells[4]}`)
  } else {
    console.log('· 未配置 --mysql，跳过直连库校验')
  }

  /* ==================== 2) 写链路②：同地块新建采收应被休药期拦截 ==================== */

  await open('pages/harvests/create', 1800)
  await pickOption('采收地块', BLOCK_PLOT)
  await sleep(1200)
  const blockedText = await bodyText()
  check(blockedText.includes('休药期未过'), '同地块显示「休药期未过」（按最近用药 + 安全间隔期推算）',
    blockedText.slice(blockedText.indexOf('休药期校验'), blockedText.indexOf('休药期校验') + 80))
  check(blockedText.includes('不可登记'), '按钮文案切换为不可登记')

  const beforeBlockedSubmit = writes.length
  await clickButton('休药期未过，不可登记').catch(() => {})
  await sleep(1500)
  const blockedSubmit = writes.slice(beforeBlockedSubmit).some((item) => /POST .*\/harvests$/.test(item))
  check(!blockedSubmit, '拦截时**没有**发出 POST /harvests（硬拦截，不是只提示）')

  /* ==================== 3) 写链路③：换地块放行并落库 ==================== */

  await pickOption('采收地块', OK_PLOT)
  await sleep(1200)
  await fillField('采收数量', String(harvestQuantity))
  await fillField('备注', harvestRemark)
  await pickOption('质量等级', 'A')
  await pickOption('采收人', OPERATOR)
  await sleep(300)

  const beforeOk = writes.length
  await clickButton('提交采收登记')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => {})
  await sleep(2000)
  const harvestWrite = writes.slice(beforeOk).find((item) => /POST .*\/harvests$/.test(item))
  check(Boolean(harvestWrite), '放行后发出 POST /harvests', harvestWrite ?? writes.slice(beforeOk).join(' | '))
  check((await page.evaluate(() => location.hash)).includes('/pages/harvests/detail'), '提交后跳到采收详情页',
    await page.evaluate(() => location.hash))

  const detailText = await bodyText()
  check(detailText.includes(harvestRemark), '详情页回显备注（说明这条就是我刚写的）')
  const batchId = await page.evaluate(() => new URLSearchParams((location.hash.split('?')[1] ?? '')).get('id'))
  created.batchId = batchId ?? ''
  check(Boolean(created.batchId), '详情页 URL 带新批次主键', created.batchId)

  if (MYSQL_BIN && created.batchId) {
    const batchRow = mysqlQuery(
      `SELECT batch_no, plot_id, quantity, operator_id, trace_code, deleted FROM ${DB}.agri_prod_harvest_batch WHERE id = ${created.batchId};`,
    )
    const cells = (batchRow ?? '').split(/\s+/)
    check(Boolean(batchRow), 'MySQL 里落了采收批次', batchRow ?? '（查不到）')
    const expectedPlotId = await plotIdByName(OK_PLOT)
    check(cells[1] === expectedPlotId, `库里 plot_id 就是页面选中的「${OK_PLOT}」`,
      `plot_id=${cells[1]} 期望=${expectedPlotId}`)
    check(Number(cells[2]) === harvestQuantity, '库里采收数量与提交值一致', `quantity=${cells[2]}`)
    check(Boolean(cells[3]) && cells[3] !== 'NULL', '库里采收人是数字主键（不是 NULL）', `operator_id=${cells[3]}`)
    check(cells[4] && cells[4] !== 'NULL', '发起时一并生成了溯源码', `trace_code=${cells[4]}`)
  }

  /* ==================== 4) 写链路④：新建任务 ==================== */

  await open('pages/tasks/create', 1800)
  await fillField('任务名称', taskName)
  await pickOption('关联地块', OK_PLOT)
  // 任务类型同样是滚轮：7 项列表从索引 0 只能走到 0 / 4 / 6，故选「除草」（索引 4）
  await pickOption('任务类型', '除草')
  await pickOption('执行人', OPERATOR)
  // 「优先级」不驱动滚轮：4 项列表按 +4 步进会原地打转（0→末项→末项），
  // 而该页默认就是「普通」，这里改为断言"默认值原样落库"，一样能证明字段没丢。
  await fillFirstTextArea('移动端联调用例，跑完即删')

  const beforeTask = writes.length
  await clickButton('创建任务')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => {})
  await sleep(2000)
  const taskWrite = writes.slice(beforeTask).find((item) => /POST .*\/tasks$/.test(item))
  check(Boolean(taskWrite), '页面发出 POST /tasks', taskWrite ?? writes.slice(beforeTask).join(' | '))
  const taskHash = await page.evaluate(() => location.hash)
  check(taskHash.includes('/pages/tasks/detail'), '创建后跳到任务详情', taskHash)
  created.taskId = await page.evaluate(() => new URLSearchParams((location.hash.split('?')[1] ?? '')).get('id'))
  check(Boolean(created.taskId), '详情页 URL 带新任务主键', created.taskId ?? '')

  if (created.taskId) {
    const taskDetail = await api('GET', `/tasks/${created.taskId}`)
    check(taskDetail.json?.code === 0, '新任务可按主键查回', `code=${taskDetail.json?.code}`)
    check(taskDetail.json?.data?.taskName === taskName, '查回的任务名与提交一致',
      String(taskDetail.json?.data?.taskName))
    check(Boolean(taskDetail.json?.data?.assigneeName || taskDetail.json?.data?.executorName),
      '查回的任务带执行人（不是空）',
      `${taskDetail.json?.data?.assigneeName ?? ''}${taskDetail.json?.data?.executorName ?? ''}`)
    check(String(taskDetail.json?.data?.priority) === '2', '优先级默认值「普通」原样落库',
      `priority=${taskDetail.json?.data?.priority}`)
  }
  if (MYSQL_BIN && created.taskId) {
    // 列名以实际表为准：任务是 task_code / task_name / executor_id（不是 task_no）
    const taskRow = mysqlQuery(
      `SELECT task_code, task_name, plot_id, executor_id, deleted FROM ${DB}.agri_prod_task_info WHERE id = ${created.taskId};`,
    )
    check(Boolean(taskRow) && !String(taskRow).startsWith('SQL_ERROR'), 'MySQL 里落了任务', taskRow ?? '（查不到）')
    // 断言用 ASCII 的流水号：中文列即使编码显示异常，也不该让这条"落库"结论假失败
    check((taskRow ?? '').includes(stamp), '库里任务名带本轮流水号（与提交的那条一致）', taskRow ?? '')
    check(!(taskRow ?? '').split(/\s+/)[3]?.startsWith('NULL'), '库里执行人落的是主键（不是 NULL）',
      `executor_id=${(taskRow ?? '').split(/\s+/)[3]}`)
  }

  /* ==================== 5) 写链路⑤：新增地块（PRD §4.2.3 三步表单） ==================== */

  await open('pages/plots/create', 1500)
  const stepOneText = await bodyText()
  check(stepOneText.includes('Step1 · 基础信息'), '新增地块页渲染 Step1')
  check(stepOneText.includes('基础信息') && stepOneText.includes('位置定位') && stepOneText.includes('作物信息'),
    '三步指示器齐全')

  await fillField('地块名称', plotName)
  await fillField('面积(亩)', '9.9')
  // 枚举走滚轮：4 项列表一次 -100px 落到末项（壤砂土），5 项列表落到末项（其他）
  await pickOption('土壤类型', '壤砂土')
  await pickOption('灌溉方式', '其他')
  await clickButton('下一步')
  await sleep(400)
  check((await bodyText()).includes('Step2 · 位置定位'), '进入 Step2 位置定位')

  await fillField('经度', '113.61')
  await fillField('纬度', '23.52')
  await clickButton('下一步')
  await sleep(400)
  check((await bodyText()).includes('Step3 · 作物信息'), '进入 Step3 作物信息')

  await fillField('当前作物', '番茄')
  await fillField('作物品种', '中杂9号')
  const beforePlot = writes.length
  await clickButton('提交')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => {})
  await sleep(2000)
  const plotWrite = writes.slice(beforePlot).find((item) => /POST .*\/plots$/.test(item))
  check(Boolean(plotWrite), '页面发出 POST /plots', plotWrite ?? writes.slice(beforePlot).join(' | '))
  check((await bodyText()).includes('地块已创建'), '提交后进入成功页')

  // 成功页 URL 不带主键（是 redirectTo 之前的页），按唯一地块名回查主键
  const plotList = await api('GET', '/plots?farmId=1&pageNum=1&pageSize=200')
  const newPlot = (plotList.json?.data?.records ?? []).find((row) => row.plotName === plotName)
  created.plotId = newPlot ? String(newPlot.id) : ''
  check(Boolean(created.plotId), '能按地块名查回刚建的地块', `id=${created.plotId}`)

  if (created.plotId) {
    const detail = await api('GET', `/plots/${created.plotId}`)
    const plot = detail.json?.data ?? {}
    check(detail.json?.code === 0, '地块详情接口返回成功')
    check(plot.plotName === plotName, '详情回显地块名', String(plot.plotName))
    check(Number(plot.area) === 9.9, '详情回显面积', String(plot.area))
    check(plot.soilType === '壤砂土', '详情回显土壤类型（滚轮选的那项）', String(plot.soilType))
    // 这两项是本轮才补进后端 DTO 的：此前提交上去会被静默丢弃
    check(plot.irrigationType === '其他', '详情回显灌溉方式（此前后端 DTO 缺该字段、选了什么都会丢）',
      String(plot.irrigationType))
    check(plot.cropVariety === '中杂9号', '详情回显作物品种（同样此前会丢）', String(plot.cropVariety))
    check(Number(plot.centerLongitude) === 113.61, '详情回显经度', String(plot.centerLongitude))
  }

  if (MYSQL_BIN && created.plotId) {
    const plotRow = mysqlQuery(
      `SELECT plot_code, plot_name, area, soil_type, irrigation_type, crop_variety, center_longitude, deleted ` +
        `FROM ${DB}.agri_prod_plot_info WHERE id = ${created.plotId};`,
    )
    const cells = (plotRow ?? '').split(/\s+/)
    check(Boolean(plotRow) && !String(plotRow).startsWith('SQL_ERROR'), 'MySQL 里落了地块', plotRow ?? '（查不到）')
    check(cells[1] === plotName, '库里地块名与提交一致', `plot_name=${cells[1]}`)
    check(Number(cells[2]) === 9.9, '库里面积与提交一致', `area=${cells[2]}`)
    check(cells[3] === '壤砂土' && cells[4] === '其他', '库里土壤类型/灌溉方式都落了',
      `soil_type=${cells[3]} irrigation_type=${cells[4]}`)
    check(cells[5] === '中杂9号', '库里作物品种落了', `crop_variety=${cells[5]}`)
    check(Number(cells[6]) === 113.61, '库里经度落了', `center_longitude=${cells[6]}`)
    check(cells[7] === '0', '库里 deleted=0（在库）', `deleted=${cells[7]}`)
  }
  check(pageErrors.length === 0, '没有未捕获的前端异常', pageErrors.slice(0, 2).join(' | '))
  check(badResponses.length === 0, '写链路全程没有意外的 4xx/5xx', badResponses.slice(0, 3).join(' | '))
} finally {
  /* ==================== 清理（放在 finally：中途断言失败也不留脏数据） ==================== */

  for (const [label, path] of [
    ['地块', created.plotId ? `/plots/${created.plotId}` : ''],
    ['采收批次', created.batchId ? `/harvests/${created.batchId}` : ''],
    ['任务', created.taskId ? `/tasks/${created.taskId}` : ''],
    ['使用记录', created.usageId ? `/inputs/usages/${created.usageId}` : ''],
  ]) {
    if (!path) continue
    try {
      const del = await api('DELETE', path)
      check(del.status === 200 && del.json?.code === 0, `清理：删除本轮造的${label}`, `HTTP ${del.status}`)
    } catch (err) {
      check(false, `清理：删除本轮造的${label}`, String(err?.message ?? err))
    }
  }
  if (MYSQL_BIN && created.batchId && created.taskId && created.usageId && created.plotId) {
    const flags = mysqlQuery(
      `SELECT (SELECT deleted FROM ${DB}.agri_prod_harvest_batch WHERE id=${created.batchId}), ` +
        `(SELECT deleted FROM ${DB}.agri_prod_task_info WHERE id=${created.taskId}), ` +
        `(SELECT deleted FROM ${DB}.agri_prod_input_usage WHERE id=${created.usageId}), ` +
        `(SELECT deleted FROM ${DB}.agri_prod_plot_info WHERE id=${created.plotId});`,
    )
    check(flags === '1\t1\t1\t1', '四处清理都是软删（库里留痕 deleted=1）', `deleted 标记=${flags}`)
  }
  await browser.close()
}

console.log(
  `\n== 移动端写链路：任务 ${created.taskId || '（未创建）'} / 采收批次 ${created.batchId || '（未创建）'} / ` +
    `使用记录 ${created.usageId || '（未创建）'}，失败 ${failures.length} 项 ==`,
)
process.exit(failures.length === 0 ? 0 : 1)
