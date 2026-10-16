#!/usr/bin/env node
/**
 * 联调：用户端「地块采收记录」新建 → 落库 → 查询 全链路（真浏览器 → 网关 → 生产服务 → MySQL）。
 *
 * <p>背景（2026-10-16 用户需求"联调地块采收记录的新建和查询接口，保证采收记录能落库"）。
 * 动手前实测到两个"看着像没落库"的原因，本脚本就是钉住它们：</p>
 *
 * <p>① **取数口径分叉**：新建采收 `POST /harvests` 写 `agri_prod_harvest_batch`，
 * 而本页数据源 `GET /harvests/plan` 读的是**遗留表** `agri_prod_harvest_record` ——
 * 于是从这个页面登记一条采收回本页查不到。实测：`/harvests` 3 条（batch 表）与
 * `/harvests/plan` 1 条（record 表，2024-01-15，且 quantity 为 null）互不相干。
 * 已改为两侧同读 batch 表。</p>
 *
 * <p>② **采收人字段丢**：表单下拉的 value 用了 `Member.memberId`（`DEMO-MEM-001` 这类**业务标识**），
 * 而后端 `operator_id` 是 BIGINT，`toLong("DEMO-MEM-001")` 解析失败会**返回 null 且不报错**，
 * 于是"采收人选了、库里是 NULL"。已改为提交 `Member.id`（数字主键）。</p>
 *
 * <p>登录态给法同 {@code scripts/e2e-plan-create.mjs}：落同源静态文件 → 页面上下文
 * POST /auth/login 种下 HttpOnly Cookie → evaluateOnNewDocument 写非凭证界面态（含
 * `agri_current_farm`，本页查询以当前农场为作用域）。</p>
 *
 * <p>脚本自带清理：跑完 `DELETE /harvests/{id}`（软删），并复核查询侧不再出现该批次。</p>
 *
 * 用法：node scripts/e2e-harvest-create.mjs [--user=farmer] [--base=http://localhost] [--farm=1]
 *       [--plot=A区-地块1] [--operator=陈志强] [--qty=321.5] [--mysql=<mysql.exe 路径>] [--headful]
 * 退出码：0 = 全链路通过；1 = 有断言失败。
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
const BASE_URL = arg('base', 'http://localhost')
const USER = arg('user', 'farmer')
const PASSWORD = arg('password', 'Admin@123')
/** 当前农场上下文：地块与采收都挂在它下面（默认用演示农场 1） */
const FARM = {
  farmId: arg('farm', '1'),
  farmCode: '',
  farmName: '',
}
/** 要选中并登记采收的地块名（取当前农场台账里真实存在的一条） */
const targetPlotName = arg('plot', 'A区-地块1')
/** 要选中的采收人姓名（本农场团队成员） */
const targetOperatorName = arg('operator', '陈志强')
/** 本次登记的采收数量（用来证明确实落库、且能原样查回来） */
const quantity = Number(arg('qty', '321.5'))
/** MySQL 客户端（给了才做"真落库"的直连复核，没给就只做接口层复核） */
const MYSQL_BIN = arg(
  'mysql',
  existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
    ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
    : '',
)
const MYSQL_PASSWORD = arg('mysql-password', 'root')
const DB = arg('db', 'agri_production')
const HEADFUL = process.argv.includes('--headful')

const stamp = Date.now().toString().slice(-6)
/** 备注带唯一标记：既进库也回显到列表，用来证明"就是我这条" */
const marker = `联调采收-${stamp}`

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 直连 MySQL 查一行（只读）。没配 --mysql 时返回 null，调用方按"跳过"处理。
 *
 * @param sql 要执行的查询
 * @returns 查询结果文本（-N -B 制表符分隔），未配置客户端时返回 null
 */
const mysqlQuery = (sql) => {
  if (!MYSQL_BIN) return null
  return execFileSync(MYSQL_BIN, [`-uroot`, `-p${MYSQL_PASSWORD}`, '-N', '-B', '-e', sql], {
    encoding: 'utf8',
  }).trim()
}

/* ==================== 0) 接口侧登录（同时用于查库/清理） ==================== */

const login = await (await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
})).json()
check(login.code === 0, `登录（${USER}）`, `code=${login.code}`)
if (login.code !== 0) process.exit(1)
const token = login.data.accessToken
const api = async (method, path, body) => {
  const res = await fetch(`${BASE_URL}/api/v1/production${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, json: await res.json() }
}

// 补全当前农场的名称（只影响展示），取不到就给 ID —— 不编名称
try {
  const farms = await api('GET', '/farms/all')
  const hit = (farms.json.data ?? []).find((f) => String(f.farmId ?? f.id) === FARM.farmId)
  if (hit) {
    FARM.farmCode = hit.farmCode ?? ''
    FARM.farmName = hit.farmName ?? ''
  }
} catch {
  /* 名称只影响断言里的展示，取不到不阻断 */
}

/* ==================== 1) 基线：查询侧现在有多少条 ==================== */

const before = await api('GET', '/harvests/plan?pageNum=1&pageSize=100')
check(before.status === 200 && before.json.code === 0, '地块采收记录查询接口可用（GET /harvests/plan）',
  `HTTP ${before.status} total=${before.json.data?.total}`)
const baselineTotal = before.json.data?.total ?? 0

/* ==================== 2) 真浏览器走一遍新建 ==================== */

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
const badResponses = []
/** 页面自己发出的 POST /harvests 的响应体（用来核对契约） */
let createCall = null
page.on('response', async (res) => {
  if (res.status() >= 400) {
    let body = ''
    try { body = (await res.text()).slice(0, 120) } catch { /* 忽略 */ }
    badResponses.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE_URL, '')} ${body}`)
  }
  if (/\/api\/v1\/production\/harvests$/.test(res.url()) && res.request().method() === 'POST') {
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

/** 读当前展开下拉里的全部选项文案 */
const readVisibleOptions = () =>
  page.evaluate(() => {
    const dropdowns = [...document.querySelectorAll('.ant-select-dropdown')]
      .filter((d) => !d.classList.contains('ant-select-dropdown-hidden'))
    return dropdowns
      .flatMap((d) => [...d.querySelectorAll('.ant-select-item-option')])
      .map((o) => o.textContent.trim())
  })

/** 轮询等下拉出选项（选项是异步拉的，下拉先出现、选项后到） */
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

/**
 * 打开一个 Select 下拉。
 *
 * ⚠️ 必须用真实鼠标点击：antd Select 展开挂在 React 合成事件上，手工 dispatchEvent 打不开。
 */
const openSelect = async (fieldSelector) => {
  await page.click(fieldSelector)
  await waitForOptions()
}

/**
 * 在**当前展开**的下拉里按文案点一项。
 *
 * ⚠️ 只扫没被隐藏的 `.ant-select-dropdown`：antd 关掉下拉时不移除 DOM、只加
 * `ant-select-dropdown-hidden`，全量扫描会把上一个下拉的选项也算进来。
 */
const pickSelectOption = async (text) =>
  page.evaluate((label) => {
    const dropdowns = [...document.querySelectorAll('.ant-select-dropdown')]
      .filter((d) => !d.classList.contains('ant-select-dropdown-hidden'))
    const options = dropdowns.flatMap((d) => [...d.querySelectorAll('.ant-select-item-option')])
    const labels = options.map((o) => o.textContent.trim())
    const hit = options.find((o) => o.textContent.includes(label))
    if (!hit) return { ok: false, labels }
    hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    return { ok: true, labels }
  }, text)

/** 往输入框里写值（受控组件：走原生 value setter + input 事件，直接赋 value 不生效） */
const setInputValue = async (selector, value) => {
  const ok = await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel)
    if (!input) return false
    const proto = input.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype
    const setter = Object.getOwnPropertyDescriptor(proto, 'value').set
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, { sel: selector, val: value })
  if (!ok) throw new Error(`未找到输入框 ${selector}`)
}

/** 读表格行数与行文本 */
const readRows = () =>
  page.evaluate(() => {
    const rows = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')]
    return {
      count: rows.length,
      text: rows.map((r) => (r.innerText ?? '').replace(/\s+/g, ' ')).join(' || '),
    }
  })

try {
  // 种 Cookie（HttpOnly，页面拿不到，只能靠同源请求落地）+ 非凭证界面态
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

  // 2a) 地块采收记录页：查询侧先渲染出来
  await page.goto(`${BASE_URL}/production/harvests/plan`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const planText = await page.evaluate(() => document.body.innerText)
  check(planText.includes('地块采收记录'), '「地块采收记录」页已登录并渲染')
  const rowsBefore = await readRows()
  check(rowsBefore.count > 0, '查询侧原本就有数据（改造前该页只剩 1 条 2024 年的遗留数据）',
    `渲染 ${rowsBefore.count} 行 / 接口 total=${baselineTotal}`)
  check(rowsBefore.count === Math.min(10, baselineTotal),
    '页面行数与接口 total 一致（第一页 10 条以内）', `行 ${rowsBefore.count} vs 期望 ${Math.min(10, baselineTotal)}`)

  // 2b) 进新建页
  await clickButtonByText('新建采收')
  await page.waitForSelector('#plotId', { timeout: 20000 })
  await sleep(600)
  check(page.url().includes('/production/harvests/create'), '「新建采收」入口跳转到新建页',
    page.url().replace(BASE_URL, ''))

  // 2c) 选地块（下拉必须列得出本农场地块）
  await openSelect('#plotId')
  const plotPick = await pickSelectOption(targetPlotName)
  check(plotPick.labels.length > 0, '「地块」下拉列出了可选地块', `共 ${plotPick.labels.length} 项`)
  check(plotPick.labels.some((text) => text.includes(targetPlotName)),
    `下拉里含目标地块「${targetPlotName}」`, plotPick.labels.slice(0, 3).join(' / '))
  check(plotPick.ok, '能选中该地块')
  await sleep(1200)

  // 2d) 选采收人（这里曾是"选了但落不进库"的点）
  await openSelect('#operatorId')
  const memberPick = await pickSelectOption(targetOperatorName)
  check(memberPick.labels.length > 0, '「采收人」下拉列出了本农场成员', `共 ${memberPick.labels.length} 项`)
  check(memberPick.ok, `能选中采收人「${targetOperatorName}」`, memberPick.labels.join(' / '))

  // 2e) 填数量与备注（备注带唯一标记，用来证明列表里那条就是本次写的）
  await setInputValue('#quantity', String(quantity))
  await setInputValue('#remark', marker)
  await sleep(300)

  // 2f) 提交
  await clickButtonByText('保存')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => {})
  await sleep(1500)
  check(Boolean(createCall), '页面发出了 POST /api/v1/production/harvests')
  check(createCall?.status === 200 && createCall?.json?.code === 0,
    '新建采收接口返回成功', `HTTP ${createCall?.status} code=${createCall?.json?.code}`)
  const batchId = createCall?.json?.data
  check(typeof batchId === 'string' && /^\d+$/.test(batchId),
    '返回的是新批次主键（契约要求字符串）', `data="${batchId}"`)

  // 2g) 提交后跳详情页，详情里能看到这条记录
  const detailText = await page.evaluate(() => document.body.innerText)
  check(page.url().includes(`/production/harvests/${batchId}`), '提交后跳转到该批次详情页',
    page.url().replace(BASE_URL, ''))
  check(detailText.includes(marker), '详情页回显了备注里的唯一标记', marker)

  /* ==================== 3) 落库复核（接口 + 直连 MySQL） ==================== */

  const detail = await api('GET', `/harvests/${batchId}`)
  const batch = detail.json.data
  check(detail.json.code === 0, '批次详情接口返回成功')
  check(Number(batch.quantity) === quantity, '详情回显采收数量', `${batch.quantity}`)
  check(Boolean(batch.plotId), '详情回显地块（不是空的）', `plotId=${batch.plotId} ${batch.plotName ?? ''}`)
  check(Boolean(batch.operatorId), '详情回显采收人主键（修复前这里恒为 null）',
    `operatorId=${batch.operatorId} operatorName=${batch.operatorName ?? ''}`)
  check(batch.remark === marker, '详情回显备注', `${batch.remark}`)

  const planAfter = await api('GET', `/harvests/plan?plotId=${batch.plotId}&pageNum=1&pageSize=100`)
  const hitRow = (planAfter.json.data?.records ?? []).find((r) => String(r.recordId) === String(batchId))
  check(Boolean(hitRow), '「地块采收记录」查询能查到刚新建的这条（本轮修复的核心）',
    `total=${planAfter.json.data?.total}`)
  check(Number(hitRow?.quantity) === quantity, '聚合查询返回的采收数量与实际一致', `${hitRow?.quantity}`)
  check(Boolean(hitRow?.batchNo), '聚合查询返回批次编号', `${hitRow?.batchNo}`)
  check(String(hitRow?.operatorId) === String(batch.operatorId), '聚合查询返回采收人主键',
    `${hitRow?.operatorId}`)
  check(typeof hitRow?.inboundStatus === 'number' && typeof hitRow?.status === 'number',
    '聚合查询返回入库状态与批次状态（页面状态列用它）',
    `inbound=${hitRow?.inboundStatus} status=${hitRow?.status}`)

  // 再让真页面刷新一次：列表里要出现这条
  await page.goto(`${BASE_URL}/production/harvests/plan`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  const rowsAfter = await readRows()
  check(rowsAfter.text.includes(marker) || rowsAfter.text.includes(hitRow?.batchNo),
    '页面上能看到这条新记录（按备注标记或批次编号命中）',
    rowsAfter.text.replace(/\s+/g, ' ').slice(0, 120))
  // 数量精度：321.5 不能被格式化抹成 322（原 MetricText 默认 0 位小数会四舍五入）
  const expectedQtyText = quantity.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
  check(rowsAfter.text.includes(expectedQtyText),
    '列表里的采收数量按实际精度显示（不被抹成整数）', `期望出现「${expectedQtyText}」`)

  // 直连 MySQL：证明"真落库"，而不是接口层糊出来的
  if (!MYSQL_BIN) {
    console.log('· 未配置 --mysql，跳过直连库校验（接口层结论已足够时属预期）')
  } else {
    const dbRow = mysqlQuery(
      `SELECT batch_no, plot_id, quantity, operator_id, deleted FROM ${DB}.agri_prod_harvest_batch WHERE id = ${batchId};`,
    )
    const cells = (dbRow ?? '').split(/\s+/)
    check(Boolean(dbRow), 'MySQL 里真的落了一行（按新批次主键查到）', dbRow ?? '（查不到）')
    check(Number(cells[2]) === quantity, '库里 quantity 与提交值一致', `quantity=${cells[2]}`)
    check(Boolean(cells[3]) && cells[3] !== 'NULL', '库里 operator_id 落了数字主键（不是 NULL）',
      `operator_id=${cells[3]}`)
    check(cells[4] === '0', '库里该行 deleted=0（在库状态）', `deleted=${cells[4]}`)
  }

  /* ==================== 4) 清理：删掉本次造的批次 ==================== */

  const del = await api('DELETE', `/harvests/${batchId}`)
  check(del.status === 200 && del.json.code === 0, '清理：删除本次造的批次', `HTTP ${del.status}`)
  const afterDelete = await api('GET', '/harvests/plan?pageNum=1&pageSize=100')
  check(afterDelete.json.data?.total === baselineTotal, '清理后查询侧回到基线条数',
    `${afterDelete.json.data?.total} vs ${baselineTotal}`)
  if (MYSQL_BIN) {
    const delFlag = mysqlQuery(`SELECT deleted FROM ${DB}.agri_prod_harvest_batch WHERE id = ${batchId};`)
    check(delFlag === '1', '清理是软删（库里留痕 deleted=1，可追溯）', `deleted=${delFlag}`)
  }

  check(badResponses.length === 0, '全链路没有 4xx/5xx 响应', badResponses.slice(0, 2).join(' | '))
} finally {
  await browser.close()
}

console.log(
  `\n== 地块采收记录联调：新建批次 ${createCall?.json?.data ?? '（未创建）'}，` +
    `备注「${marker}」，失败 ${failures.length} 项 ==`,
)
process.exit(failures.length === 0 ? 0 : 1)
