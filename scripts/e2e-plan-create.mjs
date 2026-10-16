#!/usr/bin/env node
/**
 * 联调：用户端种养计划「新建 → 落库 → 查询」全链路（真浏览器 → 网关 → 生产服务 → MySQL）。
 *
 * <p>背景（2026-10-16 用户反馈"新增种养计划，能关联地块"）：新建弹窗里那一栏原先是一个
 * **自由文本框「关联地块 ID」** —— 用户不知道地块主键是几，也没法选；就算手填对了数字，
 * 也只落 {@code plot_id}、不落 {@code plot_name}，列表「地块」列照样显示 "-"，看着像没关联上。
 * 现在页面改成地块台账下拉，后端在只给 ID 时按地块表补齐地块名。</p>

 *
 * <p>本脚本断言的就是这两件事：① 下拉里真的列得出本农场的地块；② 选中后提交，
 * 列表那一行的「地块」列显示的是地块名（而不是 "-" 或 ID）。</p>

 *
 * <p>查询侧同样覆盖：详情接口 {@code GET /plans/{id}} 的回显、详情页渲染，
 * 以及列表三个搜索框（计划名称 / 计划编号 / 作物）是否**真的把条件送到后端** ——
 * 原先只有「计划名称」转发到 keyword，另外两个填了等于没填；脚本最后还用
 * "搜一个不存在的作物应返回 0 行"反向确认过滤不是摆设。</p>
 *
 * <p>作物主数据页的断言**不在这里**：那一页已按产品口径搬到运营端
 * （{@code /admin/production/crops}，由运营账号维护），由 {@code scripts/e2e-crop-master-ops.mjs}
 * 用运营身份覆盖 —— 本脚本是用户身份，跑到那儿只会拿到 404（2026-10-16 踩过）。</p>
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
/** 预计产量（kg）：填一个数，用来证明确实落库并能原样查回来（不是只有文本字段才存得住） */
const expectedYield = 12000
/** 计划种养面积（亩）：同上，验数值字段落库回显 */
const planArea = 88.5
/** 期望被选中的负责人（本农场团队成员台账里的真实成员） */
const targetManagerName = arg('manager', '陈志强')

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
    // 「角色与权限」页会先问平台域 /api/v1/admin/roles（只有平台超管能调），
    // 非超管账号必然 403 —— 页面随后按既定口径降级到生产域 /members/roles/catalog。
    // 这是**预期内**的一次 403，不计入"链路错误"（否则本脚本一访问该页就必红）。
    if (res.status() === 403 && /\/api\/v1\/admin\/roles/.test(res.url())) return
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

/**
 * 在**当前展开**的下拉里按文案点一项。
 *
 * ⚠️ 只扫没被隐藏的 `.ant-select-dropdown`：antd 关掉下拉时不移除 DOM、只加
 * `ant-select-dropdown-hidden`，全量扫描会把上一个下拉（比如地块）的选项也算进来。
 *
 * @param text 选项文案里要包含的文字
 * @returns 是否点中，以及该下拉里所有选项的文案（用于断言"下拉真的列出来了"）
 */
const pickSelectOption = async (text) => {
  return page.evaluate((label) => {
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
}

/**
 * 打开一个 Select 下拉。
 *
 * ⚠️ 必须用**真实鼠标点击**：antd Select 展开挂在 React 的合成事件上，
 * 手工 `dispatchEvent(new MouseEvent('mousedown'))` 打不开（临时探针实测：
 * 派发之后下拉数量仍是 0，真点一下就有 7 个选项）。
 *
 * <p>等待条件也不能只认 `.ant-select-item-option`：选项是异步拉的（地块/成员列表），
 * 没拉到时会渲染空状态，那样等待会一直超时。这里两种状态都接受，
 * 空不空由调用方断言。</p>
 *
 * @param fieldSelector 表单字段选择器（如 `.ant-modal-content #plotId`）
 */
const openSelect = async (fieldSelector) => {
  await page.click(fieldSelector)
  await waitForOptions()
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

/**
 * 轮询等下拉出选项。
 *
 * <p>选项多数是**异步拉的**（地块 / 成员 / 作物候选），下拉框本身先出现、选项后到；
 * 只判断"下拉已展开"会读到空列表。超时也不抛错，交给调用方断言"列了几项"，
 * 这样失败信息是"下拉是空的"而不是一个选择器超时堆栈。</p>
 */
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
 * 往列表搜索表单的某个字段里写值。
 *
 * <p>走原生 value setter + input 事件，而不是 page.type：这些输入框是受控组件，
 * 直接赋 value 不会触发 React 的 onChange，条件就带不出去（看着填了、其实没生效）。</p>
 *
 * @param label 搜索项的标签文案（计划名称 / 计划编号 / 作物）
 * @param value 要写入的值
 */
const setSearchField = async (label, value) => {
  const ok = await page.evaluate(({ text, val }) => {
    const items = [...document.querySelectorAll('.ant-form-item')]
    const item = items.find((el) => (el.innerText ?? '').startsWith(text))
    const input = item?.querySelector('input')
    if (!input) return false
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    return true
  }, { text: label, val: value })
  if (!ok) throw new Error(`未找到搜索项「${label}」`)
}

/**
 * 用给定条件检索一次列表，返回命中行数与该行的文本。
 *
 * <p>每次都先「重置」再填条件，避免上一轮的残留条件污染这一轮的结果。</p>
 *
 * @param fields 搜索条件（标签 → 值）
 * @returns 命中行数与该行文本
 */
const runSearch = async (fields) => {
  await page.goto(`${BASE_URL}/production/plans`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  await clickButtonByText('重置')
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  for (const [label, value] of Object.entries(fields)) {
    await setSearchField(label, value)
  }
  await clickButtonByText('查询')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  return page.evaluate(() => {
    const rows = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')]
    return {
      count: rows.length,
      text: rows.map((r) => (r.innerText ?? '').replace(/\s+/g, ' ')).join(' || '),
    }
  })
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

  // 1b) 菜单结构（2026-10-16 合并）：「智能种养计划」+「农事任务管理」→ 一级菜单「智能种养」
  const siderBefore = await page.evaluate(() => document.querySelector('.ant-layout-sider')?.innerText ?? '')
  check(siderBefore.includes('智能种养'), '侧边栏出现合并后的一级菜单「智能种养」')
  check(!siderBefore.includes('农事任务管理'), '旧一级菜单「农事任务管理」已不在')
  check(!siderBefore.includes('智能种养计划'), '旧一级菜单「智能种养计划」已不在')
  // 2026-10-16 二次调整：叶子「任务列表」改名为「农事任务」，「创建任务」入口撤掉
  check(siderBefore.includes('农事任务'), '菜单叶子已改名为「农事任务」')
  check(!siderBefore.includes('创建任务'), '菜单里不再有「创建任务」入口（新建走列表页按钮）')
  // 2026-10-16：任务模板库搬到运营端（模板是标准作业配置，平台运营维护、租户使用）
  check(!siderBefore.includes('任务模板库'), '用户端不再有「任务模板库」菜单（已搬到运营端）')
  // 面包屑读的就是菜单分组名（buildBreadcrumb 用 group.label），所以"任务页的面包屑是智能种养"
  // 等于证明两组子项确实挂在同一个一级菜单下 —— 比展开子菜单查 DOM 稳（子菜单折叠时不在 DOM 里）。
  await page.goto(`${BASE_URL}/production/tasks`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const taskCrumb = await page.evaluate(
    () => document.querySelector('.ant-breadcrumb')?.innerText?.replace(/\s+/g, ' ') ?? '',
  )
  check(taskCrumb.includes('智能种养'), '任务页面包屑归到「智能种养」（两组同属一个一级菜单）',
    taskCrumb || '（未找到面包屑）')

  // 1c) 菜单归属（2026-10-16 调整）：团队与人员 / 角色与权限 从「农场数字化管理」挪到「报表与设置」。
  //     面包屑读的就是菜单分组名，所以看面包屑即可确认真挂到了哪个一级菜单下。
  const crumbs = []
  for (const path of ['/production/members', '/production/members/roles']) {
    await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
    const crumb = await page.evaluate(
      () => document.querySelector('.ant-breadcrumb')?.innerText?.replace(/\s+/g, ' ') ?? '',
    )
    crumbs.push({ path, crumb })
    check(crumb.includes('报表与设置'), `${path} 的面包屑归到「报表与设置」`, crumb || '（未找到面包屑）')
  }

  // 1d) 投入品菜单去重（2026-10-16）：只保留「投入品台账」。
  //     ⚠️ 侧边栏的分组默认折叠、且这版布局里程序化展开不生效（antd 受控 openKeys），
  //     所以这里用**面包屑**证明"保留的那个叶子仍在菜单里"；
  //     "重复叶子已摘掉"由静态校验 scripts/check-menu-route-map.mjs 证明
  //     （它会列出已注册但未进菜单的路由，摘掉后 /production/inputs/ledger 出现在该清单里）。
  await page.goto(`${BASE_URL}/production/inputs`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const inputCrumb = await page.evaluate(
    () => document.querySelector('.ant-breadcrumb')?.innerText?.replace(/\s+/g, ' ') ?? '',
  )
  check(inputCrumb.includes('农资投入品管理') && inputCrumb.includes('投入品台账'),
    '「投入品台账」仍在菜单里（面包屑可证）', inputCrumb || '（未找到面包屑）')
  const ledgerText = await page.evaluate(() => document.body.innerText)
  check(ledgerText.includes('投入品'), '「投入品台账」页已渲染', ledgerText.replace(/\s+/g, ' ').slice(0, 60))
  // 打开 /production/inputs 时该分组会自动展开，所以整页文本里能看到兄弟叶子：
  // 有「投入品台账」「出入库管理」「使用记录」，但**没有**「投入品使用台账」（2026-10-16 去重）。
  check(ledgerText.includes('投入品台账') && !ledgerText.includes('投入品使用台账'),
    '侧边栏该分组下已无重复的「投入品使用台账」')

  // 回到计划页（下面要在计划页开新增弹窗）
  await page.goto(`${BASE_URL}/production/plans`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})

  // 2) 打开「新增种养计划」弹窗
  await clickButtonByText('新增种养计划')
  await page.waitForSelector(inModal('#planName'), { timeout: 20000 })
  // 等弹窗展开动画结束再点下面的控件，否则点击会落到还没定位好的位置上
  await sleep(600)
  check(true, '「新增种养计划」弹窗已打开')

  // 3) 要点一：地块下拉里真的列得出本农场的地块
  await openSelect(inModal('#plotId'))
  const plotPick = await pickSelectOption(targetPlotName)
  check(plotPick.labels.length > 0, '「关联地块」下拉列出了可选地块', `共 ${plotPick.labels.length} 项`)
  check(plotPick.labels.some((text) => text.includes(targetPlotName)),
    `下拉里含目标地块「${targetPlotName}」`, plotPick.labels.slice(0, 3).join(' / '))
  check(plotPick.ok, '能选中该地块')
  await sleep(400)

  // 3b) 负责人下拉：同样要能列人、能选人（原先这一栏是自由文本框「负责人 ID」）
  await openSelect(inModal('#ownerId'))
  const memberPick = await pickSelectOption(targetManagerName)
  check(memberPick.labels.length > 0, '「负责人」下拉列出了本农场成员', `共 ${memberPick.labels.length} 项`)
  check(memberPick.labels.some((text) => text.includes(targetManagerName)),
    `下拉里含目标负责人「${targetManagerName}」`, memberPick.labels.slice(0, 3).join(' / '))
  check(memberPick.ok, '能选中该负责人')
  await sleep(400)

  // 3c) 作物下拉：候选来自**作物主数据**（不再是自由文本，也没有"输入即用"）
  await openSelect(inModal('#cropId'))
  const cropCandidates = await readVisibleOptions()
  check(cropCandidates.length > 0, '「作物」下拉列出了作物主数据', `共 ${cropCandidates.length} 项`)
  check(cropCandidates.some((text) => text.includes(cropName)),
    `候选里含主数据里的「${cropName}」`, cropCandidates.slice(0, 5).join(' / '))
  check(!cropCandidates.some((text) => text.includes('使用「')),
    '下拉里不再出现"使用「…」"的自由输入项（作物已按主数据收口）')
  const cropPick = await pickSelectOption(cropName)
  check(cropPick.ok, `能选中主数据作物「${cropName}」`)
  await sleep(300)

  // 4) 填其余必填项
  await page.click(inModal('#planName'))
  await page.type(inModal('#planName'), planName, { delay: 10 })
  await page.click(inModal('#expectedYield'))
  await page.type(inModal('#expectedYield'), String(expectedYield), { delay: 20 })
  await page.click(inModal('#planArea'))
  await page.type(inModal('#planArea'), String(planArea), { delay: 20 })
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
  check(rowText.includes(String(planArea)), '该行「计划面积」列显示填写的面积', String(planArea))
  check(rowText.includes(targetManagerName), '该行「负责人」列显示选中的成员姓名', targetManagerName)

  // 7) 查询侧之一：详情接口（GET /plans/{id}）
  const planId = createCall?.json?.data
  let planCode = ''
  if (planId) {
    const detail = await (await fetch(`${BASE_URL}/api/v1/production/plans/${planId}`, {
      headers: { Authorization: `Bearer ${login.data.accessToken}` },
    })).json()
    check(detail.code === 0, '详情接口返回成功', `code=${detail.code}`)
    check(detail.data?.planName === planName, '详情接口回显计划名称', `name=${detail.data?.planName}`)
    check(detail.data?.plotName === targetPlotName, '详情接口回显地块名', `plotName=${detail.data?.plotName}`)
    check(Number(detail.data?.expectedYield) === expectedYield, '详情接口回显预计产量',
      `expectedYield=${detail.data?.expectedYield}`)
    check(Number(detail.data?.planArea) === planArea, '详情接口回显计划种养面积',
      `planArea=${detail.data?.planArea}`)
    check(detail.data?.managerName === targetManagerName, '详情接口回显负责人姓名（不是 ID）',
      `managerId=${detail.data?.managerId} managerName=${detail.data?.managerName}`)
    check(Number(detail.data?.cropId) > 0 && detail.data?.cropName === cropName,
      '计划的作物落的是主数据主键 + 名称（crop_id 不再为空）',
      `cropId=${detail.data?.cropId} cropName=${detail.data?.cropName}`)
    planCode = detail.data?.planNo ?? ''
  }

  // 8) 查询侧之二：详情页渲染
  await page.goto(`${BASE_URL}/production/plans/${planId}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForNetworkIdle({ idleTime: 600, timeout: 10000 }).catch(() => {})
  const detailText = await page.evaluate(() => document.body.innerText)
  check(detailText.includes(planName), '详情页显示计划名称')
  check(detailText.includes(targetPlotName), '详情页显示关联地块')
  check(detailText.includes(cropName), '详情页显示作物')
  check(detailText.includes(startDate), '详情页显示计划开始日期', startDate)
  check(detailText.includes(targetManagerName), '详情页显示负责人', targetManagerName)
  check(detailText.includes(String(planArea)), '详情页显示计划面积', String(planArea))

  // 9) 查询侧之三：列表检索（三个搜索框都必须真的把条件送到后端）
  const byName = await runSearch({ 计划名称: planName })
  check(byName.count === 1 && byName.text.includes(planName), '按「计划名称」检索筛到这条计划',
    `rows=${byName.count}`)
  const byCode = await runSearch({ 计划编号: planCode })
  check(byCode.count === 1 && byCode.text.includes(planName), '按「计划编号」检索筛到这条计划',
    `rows=${byCode.count} code=${planCode}`)
  const byCrop = await runSearch({ 作物: cropName })
  check(byCrop.count >= 1 && byCrop.text.includes(planName), '按「作物」检索筛到这条计划',
    `rows=${byCrop.count}`)
  const byNothing = await runSearch({ 作物: '不存在的作物ZZZ' })
  check(byNothing.count === 0, '按不存在的作物检索返回 0 行（过滤真的生效，不是摆设）',
    `rows=${byNothing.count}`)

  check(badResponses.length === 0, '全链路没有 4xx/5xx 响应', badResponses.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n== 新建计划「${planName}」id=${createCall?.json?.data ?? '?'}，地块「${targetPlotName}」，失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
