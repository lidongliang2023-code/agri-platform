#!/usr/bin/env node
/**
 * 联调：地块「当前作物」走作物主数据（真浏览器 → 网关 → 生产服务 → MySQL）。
 *
 * <p>背景（2026-10-16）：地块此前**根本没有"当前作物"的录入入口** ——
 * 库里的 {@code current_crop} 只来自演示数据迁移，而列表 / 详情显示的是 {@code crop_variety}（品种）。
 * 作物升级为主数据后，地块补了 {@code crop_id} 列、表单加了「当前作物」下拉（来自作物主数据）。</p>

 *
 * <p>本脚本断言：① 表单里能从作物主数据选到作物；② 提交后落 {@code crop_id} + {@code current_crop}
 * 两列；③ 详情页「当前作物」显示的是它。</p>

 *
 * <p>2026-10-16 追加：地块列表的「状态」列曾经全是"未知" —— 接口给的是库里的文本
 * {@code active}，而页面按数字枚举渲染。现在出参是数字码（0 已停用 / 1 空闲 / 2 在种），
 * 脚本先在地块列表页把这一条钉住。</p>

 *
 * <p>同日再追加：地块支持**停用 / 启用**。停用的口径是"地块上有在种计划时不允许停用"，
 * 脚本两头都验：有在种计划的地块停用被拒（接口层），新建的空闲地块能停能启（页面层）。</p>
 *
 * <p>登录态给法同 {@code scripts/e2e-plan-create.mjs}（同源静态文件 + HttpOnly Cookie + 非凭证界面态）。</p>
 *
 * 用法：node scripts/e2e-plot-crop.mjs [--user=farmer] [--base=http://localhost] [--farm=1] [--crop=水稻]
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
/** 期望选中的作物（作物主数据里的名字） */
const cropName = arg('crop', '水稻')
const HEADFUL = process.argv.includes('--headful')

const stamp = Date.now().toString().slice(-6)
const plotName = `联调地块-${stamp}`
const plotArea = '12.5'

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
  if (/\/api\/v1\/production\/plots$/.test(res.url()) && res.request().method() === 'POST') {
    try { createCall = { status: res.status(), json: await res.json() } } catch { /* 忽略 */ }
  }
})

const inModal = (id) => id
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
  await waitForOptions()
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

/**
 * 在地块列表里对某一行做启用 / 停用，返回操作后该行的文本。

 *
 * <p>停用走 Popconfirm：先点行内的「停用」，再点弹层里的「确认停用」。
 * 行定位按地块名匹配（列表按创建时间倒序，刚建的地块在第一页）。</p>
 *
 * @param name 地块名
 * @param action '停用' 或 '启用'
 * @returns 操作后该行的文本（用于断言状态标签）
 */
const togglePlotStatus = async (name, action) => {
  const clicked = await page.evaluate(({ plotName, label }) => {
    const row = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')]
      .find((tr) => (tr.innerText ?? '').includes(plotName))
    if (!row) return false
    const link = [...row.querySelectorAll('a, button, .ant-typography')]
      .find((el) => (el.textContent ?? '').replace(/\s+/g, '') === label)
    if (!link) return false
    link.click()
    return true
  }, { plotName: name, label: action })
  if (!clicked) throw new Error(`列表里没找到「${name}」这一行的「${action}」`)
  if (action === '停用') {
    await sleep(400)
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.ant-popover button')]
        .find((b) => (b.textContent ?? '').replace(/\s+/g, '') === '确认停用')
      btn?.click()
    })
  }
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  await sleep(800)
  return page.evaluate((plotName) => {
    const row = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')]
      .find((tr) => (tr.innerText ?? '').includes(plotName))
    return row ? (row.innerText ?? '').replace(/\s+/g, ' ') : ''
  }, name)
}

/**
 * 本轮新建的地块主键。
 *
 * <p>提到 try 外面，是为了让 finally 能清理 —— 之前只在 try 里 `let plotId`，
 * 一旦中途断言抛错，finally 就看不到它，测试地块会永久留在演示农场里
 * （实测留下过一块「联调地块-266013」）。</p>
 */
let createdPlotId = ''

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

  // 1) 新增地块页（带上农场上下文，避免农场未选）
  // 1.0) 先看列表：状态列必须渲染成中文标签，不能是"未知"
  await page.goto(`${BASE_URL}/production/plots`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const plotListText = await page.evaluate(() => {
    const table = document.querySelector('.ant-table-tbody')
    return table ? table.innerText : document.body.innerText
  })
  check(/空闲|在种/.test(plotListText), '地块列表「状态」列渲染出中文状态',
    plotListText.replace(/\s+/g, ' ').slice(0, 100))
  check(!plotListText.includes('未知'), '地块列表「状态」列不再出现"未知"')

  await page.goto(`${BASE_URL}/production/plots/create?farmId=${FARM_ID}`, {
    waitUntil: 'networkidle2', timeout: 60000,
  })
  await page.waitForSelector(inModal('#plotName'), { timeout: 20000 })
  await sleep(800)
  check(true, '「新增地块」页已打开')

  // 2) 「当前作物」下拉必须来自作物主数据
  await openSelect(inModal('#cropId'))
  const cropCandidates = await readVisibleOptions()
  check(cropCandidates.length > 0, '「当前作物」下拉列出了作物主数据', `共 ${cropCandidates.length} 项`)
  check(cropCandidates.some((text) => text.includes(cropName)),
    `下拉里含目标作物「${cropName}」`, cropCandidates.slice(0, 5).join(' / '))
  const cropPick = await pickSelectOption(cropName)
  check(cropPick.ok, `能选中作物「${cropName}」`)
  await sleep(300)

  // 3) 填地块基本信息并保存
  await page.click(inModal('#plotName'))
  await page.type(inModal('#plotName'), plotName, { delay: 10 })
  await page.click(inModal('#area'))
  await page.type(inModal('#area'), plotArea, { delay: 20 })
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => (b.textContent ?? '').replace(/\s+/g, '') === '保存')
    btn?.click()
  })
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  await sleep(800)

  check(Boolean(createCall), '页面发出了 POST /api/v1/production/plots')
  let plotId = ''
  if (createCall) {
    check(createCall.status === 200 && createCall.json?.code === 0, '新增地块接口返回成功',
      `HTTP ${createCall.status} code=${createCall.json?.code} ${createCall.json?.message ?? ''}`)
    plotId = String(createCall.json?.data ?? '')
    createdPlotId = plotId
    check(/^\d+$/.test(plotId), '返回的是 id 字符串（契约要求）', `data=${JSON.stringify(createCall.json?.data)}`)
  }

  // 4) 详情接口：crop_id 与 current_crop 两列都要落
  if (plotId) {
    const detail = await (await fetch(`${BASE_URL}/api/v1/production/plots/${plotId}`, {
      headers: { Authorization: `Bearer ${login.data.accessToken}` },
    })).json()
    check(detail.code === 0, '详情接口返回成功', `code=${detail.code}`)
    check(detail.data?.currentCrop === cropName, '地块的 current_crop 落的是所选作物名',
      `currentCrop=${detail.data?.currentCrop}`)
    check(Number(detail.data?.cropId) > 0, '地块的 crop_id 落的是作物主数据主键（不再为空）',
      `cropId=${detail.data?.cropId}`)
  }

  // 5) 详情页「当前作物」显示它
  if (plotId) {
    await page.goto(`${BASE_URL}/production/plots/${plotId}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
    const detailText = await page.evaluate(() => document.body.innerText)
    check(detailText.includes(plotName), '详情页显示地块名称', plotName)
    check(detailText.includes(cropName), '详情页「当前作物」显示所选作物', cropName)
  }

  // 6) 停用口径：有在种计划的地块不能在接口层被停用（plot 1 上挂着 plan id=3 的在种计划）
  const guardRes = await (await fetch(`${BASE_URL}/api/v1/production/plots/1/status?status=0`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${login.data.accessToken}` },
  })).json()
  check(guardRes.code === 400 && /在种计划/.test(guardRes.message ?? ''),
    '有在种计划的地块停用被拒（400 且说明原因）', `code=${guardRes.code} msg=${guardRes.message}`)

  // 7) 页面层：新建的空闲地块能停能启
  await page.goto(`${BASE_URL}/production/plots`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const rowAfterDisable = await togglePlotStatus(plotName, '停用')
  check(rowAfterDisable.includes('已停用'), '列表里停用后该行状态变成「已停用」',
    rowAfterDisable.slice(0, 100))
  const rowAfterEnable = await togglePlotStatus(plotName, '启用')
  check(!rowAfterEnable.includes('已停用'), '重新启用后该行不再是「已停用」',
    rowAfterEnable.slice(0, 100))

  check(badResponses.length === 0, '全链路没有 4xx/5xx 响应', badResponses.slice(0, 3).join(' | '))
} finally {
  /* ---------------- 清理：无论断言是否失败，都把本轮造的地块软删掉 ---------------- */

  if (createdPlotId) {
    try {
      const del = await fetch(`${BASE_URL}/api/v1/production/plots/${createdPlotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${login.data.accessToken}` },
      })
      const delBody = await del.json().catch(() => ({}))
      check(del.status === 200 && delBody.code === 0, '清理：删除本轮新建的地块',
        `HTTP ${del.status} code=${delBody.code ?? '?'}`)
      // 软删后按主键再查一次：应当查不到（404），以此证明清理真的生效
      const after = await fetch(`${BASE_URL}/api/v1/production/plots/${createdPlotId}`, {
        headers: { Authorization: `Bearer ${login.data.accessToken}` },
      })
      const afterBody = await after.json().catch(() => ({}))
      check(after.status !== 200 || afterBody.code !== 0, '清理后按主键查不到该地块',
        `HTTP ${after.status} code=${afterBody.code ?? '?'}`)
    } catch (err) {
      check(false, '清理：删除本轮新建的地块', String(err?.message ?? err))
    }
  } else {
    console.log('· 本轮没有创建地块（或创建失败），无需清理')
  }
  await browser.close()
}

console.log(`\n== 新建地块「${plotName}」id=${createCall?.json?.data ?? '?'}，作物「${cropName}」，失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
