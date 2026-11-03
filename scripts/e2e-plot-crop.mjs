#!/usr/bin/env node
/**
 * 联调：地块的「当前作物」与作物主数据（真浏览器 → 网关 → 生产服务 → MySQL）。
 *
 * <p>口径变迁（务必按当前产品事实读这一段）：</p>
 * <ul>
 *   <li>2026-10-16：地块补 {@code crop_id} 列，新增/编辑地块表单加「当前作物」下拉。</li>
 *   <li>2026-11-02：作物录入入口从地块表单**收进**「地块详情 → 种养品种」台账
 *       （一块地可登记多个品种），地块表单只剩下「保存并添加作物」这个跳种养计划的入口。
 *       列表 / 农场缩略卡的「作物」列仍然读 {@code plot.current_crop}。</li>
 *   <li>2026-11-03：把 {@code current_crop / crop_id} 定成台账的**派生缓存**——
 *       台账增删改后由 {@code PlotCropServiceImpl.syncCurrentCropToPlot} 回写（取最早一条），
 *       地块整表更新未下发作物时也从台账回填，不再无条件清空。</li>
 * </ul>
 *
 * <p>因此本脚本断言：① 新地块表单没有作物录入项（口径迁移的显式记录）；
 * ② 详情页能从作物主数据选到作物并登记进台账；③ 登记后地块的 {@code crop_id}+{@code current_crop}
 * 两列落地、详情页与列表都显示它；④ 不碰作物的编辑不会把它抹掉；
 * ⑤ 台账清空后两列一起清掉（不留"有名字没出处"的半截状态）；
 * ⑥ 状态列中文渲染与「有在种计划不许停用」的口径。</p>
 *
 * <p>登录态给法同 {@code scripts/e2e-plan-create.mjs}（同源静态文件 + HttpOnly Cookie + 非凭证界面态）。</p>
 *
 * 用法：node scripts/e2e-plot-crop.mjs [--user=farmer] [--base=http://localhost] [--farm=1] [--crop=水稻]
 * 退出码：0 = 全链路通过；1 = 有断言失败。
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))

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
const varietyName = `联调品种-${stamp}`
const plotArea = '1'

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
const authHeader = { Authorization: `Bearer ${login.data.accessToken}` }

const browser = await chromium.launch({ headless: !HEADFUL, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
const badResponses = []
/** 第三方天地图 SDK 的失败不算本链路的错，单独计数只报不看。 */
let externalIssues = 0
let createCall = null
let updateCall = null
let cropCall = null
page.on('response', async (res) => {
  const url = res.url()
  if (res.status() >= 400) {
    if (!url.startsWith(BASE_URL) || !url.includes('/api/')) {
      externalIssues += 1
    } else {
      let body = ''
      try { body = (await res.text()).slice(0, 120) } catch { /* 忽略 */ }
      badResponses.push(`${res.status()} ${res.request().method()} ${url.replace(BASE_URL, '')} ${body}`)
    }
  }
  const method = res.request().method()
  const capture = async () => {
    try { return { status: res.status(), json: await res.json() } } catch { return null }
  }
  if (/\/api\/v1\/production\/plots$/.test(url) && method === 'POST') createCall = await capture()
  if (/\/api\/v1\/production\/plots\/\d+$/.test(url) && method === 'PUT') updateCall = await capture()
  if (/\/api\/v1\/production\/plots\/\d+\/crops$/.test(url) && method === 'POST') cropCall = await capture()
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
  // antd Select 的命中区在内层，playwright 会拒绝点外层
  const inner = await page.$(`${selector} .ant-select-selector`)
  await (inner ?? await page.$(selector)).click({ force: true })
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
const typeInto = async (selector, value) => {
  await page.waitForSelector(selector, { timeout: 15000 })
  await page.click(selector)
  await page.type(selector, value, { delay: 15 })
}
/** 点掉页面上第一个文案完全匹配的按钮（antd 两个汉字的按钮会插空格，先压缩再比）。 */
const clickButton = async (label, scope = 'button') => {
  const done = await page.evaluate(({ root, text }) => {
    const btn = [...document.querySelectorAll(root)]
      .find((b) => (b.textContent ?? '').replace(/\s+/g, '') === text && !b.disabled)
    if (!btn) return false
    btn.click()
    return true
  }, { root: scope, text: label })
  if (!done) throw new Error(`未找到按钮「${label}」（作用域 ${scope}）`)
  await sleep(400)
}
/** 在 antd DatePicker 面板里点指定日期（title 属性是 YYYY-MM-DD）。 */
const pickDate = async (dateText) => {
  await page.click('#transplantDate')
  await page.waitForSelector(`.ant-picker-cell[title="${dateText}"]`, { timeout: 10000 })
  await page.evaluate((title) => {
    document.querySelector(`.ant-picker-cell[title="${title}"]`)
      .querySelector('.ant-picker-cell-inner').dispatchEvent(new MouseEvent('click', { bubbles: true }))
  }, dateText)
  await sleep(300)
}

/**
 * 地块列表里按名字取该行文本。
 *
 * <p>列表按创建时间倒序，本轮新建的地块在第一页。</p>
 */
const plotRowText = (name) => page.evaluate((plotName) => {
  const row = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')]
    .find((tr) => (tr.innerText ?? '').includes(plotName))
  return row ? (row.innerText ?? '').replace(/\s+/g, ' ') : ''
}, name)

/**
 * 在地块列表里对某一行做启用 / 停用，返回操作后该行的文本。
 *
 * <p>停用走 Popconfirm：先点行内的「停用」，再点弹层里的「确认停用」。</p>
 */
const togglePlotStatus = async (name, action) => {
  const clicked = await page.evaluate(({ plotName: rowName, label }) => {
    const row = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')]
      .find((tr) => (tr.innerText ?? '').includes(rowName))
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
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(800)
  return plotRowText(name)
}

const detailOf = async (id) =>
  (await (await fetch(`${BASE_URL}/api/v1/production/plots/${id}`, { headers: authHeader })).json())
/** 生产域的 PageResult 出参键是 records（不是 list），两处分页读取都走这里。 */
const rowsOf = (body) => body?.data?.records ?? body?.data?.list ?? []

/**
 * 本轮新建的地块主键 + 台账记录主键。
 *
 * <p>提到 try 外面，是为了让 finally 能清理 —— 中途断言抛错时测试数据会永久留在演示农场里
 * （实测留下过一块「联调地块-266013」）。台账行要先于地块删掉，否则地块软删后
 * {@code PlotIdResolver} 换算不出来，那一行就成了看不见的孤儿。</p>
 */
let createdPlotId = ''
let createdCropRecordId = ''

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
  await page.addInitScript((state) => {
    try {
      localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
      localStorage.setItem('agri_roles', JSON.stringify(['FARMER']))
      localStorage.setItem('agri_permissions', JSON.stringify([]))
      localStorage.setItem('agri_market_id', '1')
      localStorage.setItem('agri_current_farm', JSON.stringify({ farmId: state.farmId, farmCode: '', farmName: '' }))
    } catch { /* localStorage 不可用则忽略 */ }
  }, { userInfo: login.data.user ?? {}, farmId: FARM_ID })

  // 1) 列表状态列必须渲染成中文标签，不能是"未知"
  await page.goto(`${BASE_URL}/production/plots`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await sleep(600)
  const plotListText = await page.evaluate(() => {
    const table = document.querySelector('.ant-table-tbody')
    return table ? table.innerText : document.body.innerText
  })
  check(/空闲|在种/.test(plotListText), '地块列表「状态」列渲染出中文状态',
    plotListText.replace(/\s+/g, ' ').slice(0, 100))
  check(!plotListText.includes('未知'), '地块列表「状态」列不再出现"未知"')

  // 2) 新增地块页：作物录入项已迁走，表单只留基础信息
  await page.goto(`${BASE_URL}/production/plots/create?farmId=${FARM_ID}`, {
    waitUntil: 'networkidle', timeout: 60000,
  })
  await page.waitForSelector('#plotName', { timeout: 20000 })
  await sleep(800)
  const createFormText = await page.evaluate(() => document.body.innerText)
  check(!createFormText.includes('当前作物'), '新增地块表单已无「当前作物」录入项（入口迁到详情页台账）')
  check(await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .some((b) => (b.textContent ?? '').replace(/\s+/g, '') === '保存并添加作物')),
    '「保存并添加作物」入口仍在（跳种养计划为该地块绑作物）')

  await typeInto('#plotName', plotName)
  await typeInto('#area', plotArea)
  await clickButton('保存')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
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
  if (plotId) {
    const fresh = await detailOf(plotId)
    check(fresh.code === 0 && (fresh.data?.currentCrop ?? '') === '',
      '新地块在没有品种台账前不编造「当前作物」', `currentCrop=${fresh.data?.currentCrop}`)
  }

  // 3) 详情页登记种养品种：作物下拉必须来自作物主数据
  await page.goto(`${BASE_URL}/production/plots/${plotId}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.ant-card:has-text("种养品种")', { timeout: 20000 })
  const opened = await page.evaluate(() => {
    const link = [...document.querySelectorAll('.ant-card-extra a, .ant-card-extra span')]
      .find((el) => (el.textContent ?? '').includes('添加种养品种'))
    if (!link) return false
    link.click()
    return true
  })
  check(opened, '详情页有「添加种养品种」入口')
  await page.waitForSelector('#cropId', { timeout: 15000 })
  await openSelect('#cropId')
  const cropCandidates = await readVisibleOptions()
  check(cropCandidates.length > 0, '「种类」下拉列出了作物主数据', `共 ${cropCandidates.length} 项`)
  check(cropCandidates.some((text) => text.includes(cropName)),
    `下拉里含目标作物「${cropName}」`, cropCandidates.slice(0, 5).join(' / '))
  const cropPick = await pickSelectOption(cropName)
  check(cropPick.ok, `能选中作物「${cropName}」`)
  await sleep(300)
  await typeInto('#cropVariety', varietyName)
  const today = new Date().toISOString().slice(0, 10)
  await pickDate(today)
  await clickButton('确定', '.ant-modal-footer button')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(1000)

  check(Boolean(cropCall), '页面发出了 POST /api/v1/production/plots/{id}/crops')
  if (cropCall) {
    check(cropCall.status === 200 && cropCall.json?.code === 0, '新增种养品种接口返回成功',
      `HTTP ${cropCall.status} code=${cropCall.json?.code} ${cropCall.json?.message ?? ''}`)
    createdCropRecordId = String(cropCall.json?.data?.id ?? '')
    check(Boolean(createdCropRecordId), '返回了台账记录主键', `id=${createdCropRecordId}`)
  }

  // 4) 台账写成功后，地块的 current_crop / crop_id 两列必须由台账派生出来
  if (plotId) {
    const after = await detailOf(plotId)
    check(after.data?.currentCrop === cropName, '地块的 current_crop 由台账回填为所选作物',
      `currentCrop=${after.data?.currentCrop}`)
    check(Number(after.data?.cropId) > 0, '地块的 crop_id 落的是作物主数据主键（不再为空）',
      `cropId=${after.data?.cropId}`)
    const crops = await (await fetch(`${BASE_URL}/api/v1/production/plots/${plotId}/crops`, {
      headers: authHeader,
    })).json()
    check(crops.code === 0 && (crops.data ?? []).some((item) =>
      item.cropName === cropName && item.cropVariety === varietyName),
      '台账接口按地块读回刚登记的品种', JSON.stringify(crops.data ?? []).slice(0, 120))
  }

  // 5) 详情页与列表都要显示它（同一个事实，两处都要有 DOM 证据）
  await page.goto(`${BASE_URL}/production/plots/${plotId}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await sleep(800)
  const detailText = await page.evaluate(() => document.body.innerText)
  check(detailText.includes(plotName), '详情页显示地块名称', plotName)
  check(detailText.includes(cropName) && detailText.includes(varietyName),
    '详情页「种养品种」卡展示所选作物与品种')

  await page.goto(`${BASE_URL}/production/plots`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await sleep(800)
  const rowWithCrop = await plotRowText(plotName)
  check(rowWithCrop.includes(cropName), '地块列表「作物」列显示台账里的作物（新地块不再是空）',
    rowWithCrop.slice(0, 120))

  // 6) 不碰作物的编辑（补画边界那种）不能把作物抹掉
  await page.goto(`${BASE_URL}/production/plots/create?plotId=${plotId}`, {
    waitUntil: 'networkidle', timeout: 60000,
  })
  await page.waitForSelector('#plotName', { timeout: 20000 })
  await sleep(600)
  const prefilled = await page.inputValue('#plotName')
  check(prefilled === plotName, '编辑态回填了地块名称', prefilled)
  await clickButton('保存')
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(1000)
  check(Boolean(updateCall) && updateCall.status === 200 && updateCall.json?.code === 0,
    '编辑地块接口返回成功', updateCall ? `HTTP ${updateCall.status} code=${updateCall.json?.code}` : '没有发出 PUT')
  if (plotId) {
    const kept = await detailOf(plotId)
    check(kept.data?.currentCrop === cropName, '整表更新未下发作物时，「当前作物」由台账保住',
      `currentCrop=${kept.data?.currentCrop}`)
  }

  // 7) 停用口径：先找一个「在种」的地块，接口层必须拒（status=2 由计划台账决定）
  const plotPage = await (await fetch(`${BASE_URL}/api/v1/production/plots?pageNum=1&pageSize=200`, {
    headers: authHeader,
  })).json()
  const plantingPlot = rowsOf(plotPage).find((item) => Number(item.status) === 2)
  check(Boolean(plantingPlot), '演示数据里存在「在种」地块（停用口径可验）',
    `共 ${plotPage.data?.total ?? 0} 块地`)
  if (plantingPlot) {
    const guardRes = await (await fetch(
      `${BASE_URL}/api/v1/production/plots/${plantingPlot.id}/status?status=0`,
      { method: 'PATCH', headers: authHeader },
    )).json()
    check(guardRes.code === 400 && /在种计划/.test(guardRes.message ?? ''),
      '有在种计划的地块停用被拒（400 且说明原因）',
      `code=${guardRes.code} msg=${guardRes.message} 地块=${plantingPlot.plotName}`)
  }

  // 8) 页面层：本轮新建的空闲地块能停能启
  await page.goto(`${BASE_URL}/production/plots`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {})
  await sleep(600)
  const rowAfterDisable = await togglePlotStatus(plotName, '停用')
  check(rowAfterDisable.includes('已停用'), '列表里停用后该行状态变成「已停用」', rowAfterDisable.slice(0, 100))
  const rowAfterEnable = await togglePlotStatus(plotName, '启用')
  check(!rowAfterEnable.includes('已停用'), '重新启用后该行不再是「已停用」', rowAfterEnable.slice(0, 100))

  // 9) 台账清空后两列一起清掉：派生缓存不能比它的来源活得久
  await page.goto(`${BASE_URL}/production/plots/${plotId}`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.ant-card:has-text("种养品种")', { timeout: 20000 })
  await sleep(600)
  const deleted = await page.evaluate((label) => {
    const card = [...document.querySelectorAll('.ant-card-small')]
      .find((c) => (c.textContent ?? '').includes(label))
    if (!card) return false
    const link = [...card.querySelectorAll('.ant-card-extra a, .ant-card-extra span')]
      .find((el) => (el.textContent ?? '').replace(/\s+/g, '').includes('删除'))
    if (!link) return false
    link.click()
    return true
  }, cropName)
  check(deleted, '品种卡有「删除」入口')
  await sleep(500)
  const confirmed = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('.ant-popover button, .ant-popconfirm button')]
      .find((b) => (b.textContent ?? '').replace(/\s+/g, '') === '删除')
    if (!btn) return false
    btn.click()
    return true
  })
  check(confirmed, '删除走 Popconfirm 二次确认')
  createdCropRecordId = ''
  await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {})
  await sleep(1200)
  if (plotId) {
    const cleared = await detailOf(plotId)
    check((cleared.data?.currentCrop ?? '') === '' && (cleared.data?.cropId ?? null) === null,
      '台账清空后「当前作物」两列一起清掉',
      `currentCrop=${JSON.stringify(cleared.data?.currentCrop)} cropId=${JSON.stringify(cleared.data?.cropId)}`)
  }

  check(badResponses.length === 0, '全链路没有 4xx/5xx 响应',
    `${badResponses.slice(0, 3).join(' | ')}${externalIssues ? `（另有天地图等第三方请求失败 ${externalIssues} 次，不计入）` : ''}`)
} finally {
  /* ---------------- 清理：无论断言是否失败，都把本轮造的台账行与地块删掉 ---------------- */
  if (createdCropRecordId && createdPlotId) {
    try {
      const del = await fetch(
        `${BASE_URL}/api/v1/production/plots/${createdPlotId}/crops/${createdCropRecordId}`,
        { method: 'DELETE', headers: authHeader },
      )
      const body = await del.json().catch(() => ({}))
      check(del.status === 200 && body.code === 0, '清理：删除本轮新建的种养品种台账行',
        `HTTP ${del.status} code=${body.code ?? '?'}`)
    } catch (err) {
      check(false, '清理：删除本轮新建的种养品种台账行', String(err?.message ?? err))
    }
  }
  if (createdPlotId) {
    try {
      const del = await fetch(`${BASE_URL}/api/v1/production/plots/${createdPlotId}`, {
        method: 'DELETE',
        headers: authHeader,
      })
      const delBody = await del.json().catch(() => ({}))
      check(del.status === 200 && delBody.code === 0, '清理：删除本轮新建的地块',
        `HTTP ${del.status} code=${delBody.code ?? '?'}`)
      // 软删后按主键再查一次：应当查不到（404），以此证明清理真的生效
      const after = await fetch(`${BASE_URL}/api/v1/production/plots/${createdPlotId}`, {
        headers: authHeader,
      })
      const afterBody = await after.json().catch(() => ({}))
      check(after.status !== 200 || afterBody.code !== 0, '清理后按主键查不到该地块',
        `HTTP ${after.status} code=${afterBody.code ?? '?'}`)
      const residue = await (await fetch(
        `${BASE_URL}/api/v1/production/plots?pageNum=1&pageSize=50&plotName=${encodeURIComponent(plotName)}`,
        { headers: authHeader },
      )).json()
      check(rowsOf(residue).every((item) => !String(item.plotName ?? '').includes(plotName)),
        '地块列表按名称回查已无本轮残留', `命中 ${JSON.stringify(rowsOf(residue)).slice(0, 80)}`)
    } catch (err) {
      check(false, '清理：删除本轮新建的地块', String(err?.message ?? err))
    }
  } else {
    console.log('· 本轮没有创建地块（或创建失败），无需清理地块')
  }
  await browser.close()
}

console.log(`\n== 新建地块「${plotName}」id=${createCall?.json?.data ?? '?'}，作物「${cropName}」，失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
