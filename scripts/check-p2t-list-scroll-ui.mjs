/**
 * 产销对接列表页「按内容宽出滚动条」真机点检（生产管理模块 · 用户端）
 *
 * 用法：node scripts/check-p2t-list-scroll-ui.mjs
 * 前置：core-platform(:8093)、agri-production 后端(:8092)、网关(:80，prod 产物) 在跑
 *
 * 这一支验的是**渲染宽度**而不是数据。列表页原先有两种坏形态，两种都只在真机 + 真数据下才暴露：
 *   1) 写死 `scroll={{ x: 1100 }}`：rc-table 把布局切成 fixed，数字与日期列被压成竖排
 *      （`1250 kg` 变两行），容器放得下也照样拖一条滚动条；
 *   2) 完全不写 scroll：列一多就任由长文本列（备注 / 建议 / 等级规则）把表顶到几千 px，
 *      末列（操作）滑不到也看不全。
 *
 * 收口后的判据全部取 DOM 实测（不看代码、不看断言意图）：
 *   - 每张有数据的表，表元素行内样式是 `max-content`，计算布局仍是 auto；
 *   - 数字 / 日期 / 编码类单元格**零换行**（Range 取行盒顶边去重，多顶边才算换行）；
 *   - 列名单元格不出现两行（列被压扁的第一现场就在表头）；
 *   - 被裁掉的单元格必须带省略号，且 title 里有全文（否则信息是真丢了）；
 *   - 长文本列宽落在收口上限内（既没摊开、也没被收成 0）；
 *   - 出横向滚动条时滚到底能让末列完整进入视口；表宽不超过容器却溢出 = 假滚动区，判红；
 *   - 认购率进度条有实际宽度（max-content 下空的 div 会被收成 0）；
 *   - 每页都能读到接口返回的真值（改宽度不许顺手把列数据改丢）。
 *
 * 差异工单表演示库是 0 行（空表不渲染滚动容器，判据会假绿），
 * 所以先证明"开场确实没有"，再用本主体租户预置一条长备注工单，验完按唯一工单号物理清掉。
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')
const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const CORE = 'http://localhost:8093'
const PROD = 'http://localhost:8092'
const PROD_UI = 'http://localhost'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const MARK = 'E2E产销对接列宽'
const REMARK_LONG = `${MARK}：本单为脚本预置的差异工单，处置说明这一列故意写得很长（超过 60 个汉字），`
  + '用来检查列表页收口列宽后会不会被长文本顶破整张表——收口生效的话这里应该用省略号收住，全文放进悬停提示。'

/** 长文本列的收口上限（与前端 wideTextCell 的入参一致，超上限=没收住，远小于=被压扁） */
const CLAMP = { 处置说明: 260, 排产建议: 280, 等级规则: 240, 标准规格: 180 }

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const sql = (q) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' }).replace(/\r/g, '').trim()
  } catch (e) { return `ERR ${String(e?.message ?? e).slice(0, 70)}` }
}

let token = ''
let seededTicketNo = ''

async function api(pathname) {
  const res = await fetch(`${PROD}/api/v1/production${pathname}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  return res.json().catch(() => null)
}

/**
 * 页面里逐张表取实测值。所有判据都从这里出发，避免"脚本以为改了、页面其实没改"。
 */
const MEASURE = (clampMap) => {
  /* 一个单元格里有几个"行顶边"= 渲染成几行（Range 对同一行的多个内联盒会给多个矩形，所以按顶边去重） */
  const lineTops = (el) => {
    const range = document.createRange()
    range.selectNodeContents(el)
    return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size
  }
  const dash = (t) => (t === '—' || t === '-')
  return [...document.querySelectorAll('.ant-table table')].map((table) => {
    let container = table.parentElement
    while (container && container.parentElement
      && !/ant-table-(content|body)/.test(container.className ?? '')
      && getComputedStyle(container).overflowX !== 'auto') {
      container = container.parentElement
    }
    if (!/ant-table-(content|body)/.test(container?.className ?? '')) container = table.closest('.ant-table')
    const headers = [...table.querySelectorAll('thead th')]
    const bodyRows = [...table.querySelectorAll('tbody tr.ant-table-row')]

    const wrappedRigid = []
    for (const td of table.querySelectorAll('tbody tr.ant-table-row td')) {
      const text = td.innerText.trim()
      if (!text || text.length > 30) continue
      if (/[一-鿿]/.test(text)) continue
      if (td.querySelector('button, .ant-progress, .ant-tag')) continue
      if (lineTops(td) > 1) wrappedRigid.push(text)
    }
    const clipped = []
    const ellipsisNoTitle = []
    for (const td of table.querySelectorAll('tbody tr.ant-table-row td')) {
      if (td.scrollWidth - td.clientWidth <= 1) continue
      if (getComputedStyle(td).textOverflow !== 'ellipsis') clipped.push(td.innerText.trim().slice(0, 20))
      else if (!td.getAttribute('title')) ellipsisNoTitle.push(td.innerText.trim().slice(0, 20))
    }

    /* 末列可达性：滚到最右后最后一个表头是否完整落在容器视口内 */
    const beforeLeft = container ? container.scrollLeft : 0
    if (container) container.scrollLeft = 999999
    const crect = container ? container.getBoundingClientRect() : null
    const lastRect = headers.length ? headers[headers.length - 1].getBoundingClientRect() : null
    const lastColumnReachable = Boolean(crect && lastRect
      && lastRect.right <= crect.right + 1 && lastRect.left >= crect.left - 1)
    if (container) container.scrollLeft = beforeLeft

    const progress = table.querySelector('.ant-progress-inner')
    /* 整列都是横杠 = 前端读的键接口没回（本项目反复栽过的"常年显示横杠"），只报实测不断言：
       有的列（如未建品的商品、无窗口的上市窗口）合法为空，键位对应要靠下面的接口真值核对。 */
    const allDashColumns = headers
      .map((th, i) => ({ name: th.innerText.trim().replace(/\s+/g, ''), cells: bodyRows.map((tr) => (tr.children[i]?.innerText ?? '').trim()) }))
      .filter((c) => c.cells.length >= 2 && c.cells.every((v) => v === '' || dash(v)))
      .map((c) => c.name)
    const headerWidths = headers.map((th) => ({ name: th.innerText.trim().replace(/\s+/g, ''), w: Math.round(th.getBoundingClientRect().width) }))
    const clampedOutOfRange = Object.entries(clampMap)
      .map(([name, max]) => ({ name, max, w: headerWidths.find((h) => h.name === name)?.w }))
      .filter((h) => h.w !== undefined && (h.w > h.max + 24 || h.w < 60))
      .map((h) => `${h.name} ${h.w}px（上限 ${h.max}）`)
    return {
      styleWidth: table.style.width || '(空)',
      layout: getComputedStyle(table).tableLayout,
      tableWidth: Math.round(table.getBoundingClientRect().width),
      clientWidth: container ? Math.round(container.clientWidth) : 0,
      overflow: container ? Math.round(container.scrollWidth - container.clientWidth) : 0,
      columns: headers.length,
      rows: bodyRows.length,
      wrappedHeaders: headers.filter((th) => lineTops(th) > 1).map((th) => th.innerText.trim().replace(/\s+/g, '↩')),
      wrappedRigidCells: wrappedRigid.slice(0, 4),
      clippedCells: clipped.slice(0, 4),
      ellipsisNoTitle: ellipsisNoTitle.slice(0, 4),
      allDashColumns,
      clampedOutOfRange,
      headers: headerWidths.map((h) => `${h.name}:${h.w}`),
      lastColumnReachable,
      progressWidth: progress ? Math.round(progress.getBoundingClientRect().width) : null,
    }
  })
}

try {
  const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'farmer', password: 'Admin@123' }),
  })).json()
  token = login?.data?.accessToken ?? ''
  check(Boolean(token), '以农场属主账号（farmer）登录，列表读的是本主体的数据')

  /* 演示库现状先取证：空表不渲染滚动容器，不先证明"没有"，后面的预置就可能是假绿 */
  const diffsBefore = await api('/p2t/diffs?page=1&size=10')
  check((diffsBefore?.data?.records ?? []).length === 0,
    '预置前：差异工单接口是 0 行（本页判据必须自建数据，不能靠演示库恰好有行）',
    `接口返回 ${(diffsBefore?.data?.records ?? []).length} 行`)

  const tenantId = sql("SELECT tenant_id FROM agri_production.agri_p2t_offer WHERE deleted = 0 ORDER BY id LIMIT 1")
  check(/^[0-9]+$/.test(tenantId), '预置工单挂在本主体下（租户号取自属主自己的供给单）', tenantId)
  seededTicketNo = `E2EP2TSCROLL${Date.now()}`
  sql(`INSERT INTO agri_production.agri_p2t_diff_ticket
       (tenant_id, ticket_no, diff_type, offer_no, order_no, diff_qty, discovered_at, owner_side, status, handle_remark, deleted)
       VALUES ('${tenantId}', '${seededTicketNo}', 'SHORT_SHIP', 'OFFER20261103001', 'SO1793684332850', 12.5, NOW(), 'PRODUCTION', 'PENDING', '${REMARK_LONG}', 0)`)
  const seededRow = (await api('/p2t/diffs?page=1&size=10'))?.data?.records
    ?.find((r) => r.ticketNo === seededTicketNo)
  check(Boolean(seededRow) && String(seededRow.handleRemark ?? '').length > 60,
    '预置的长备注工单能从接口读到（差异工单页读的是 agri_p2t_diff_ticket，不是页面自造）',
    `备注 ${String(seededRow?.handleRemark ?? '').length} 字`)

  /*
   * 会话 Cookie 必须按子系统取：core 的 /authorize 只认 `agri_sso_session_<clientId>`，
   * 用全局 Cookie 注入会让生产端一路跳回登录页（看着像页面坏了，其实是凭据口径错）。
   */
  const cookies = (await fetch(`${CORE}/api/v1/sso/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: 'farmer', password: 'Admin@123', clientId: 'prod',
      redirectUri: `${PROD_UI}/sso/callback`, state: 'patrol',
      codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', codeChallengeMethod: 'S256',
    }),
  })).headers.getSetCookie?.() ?? []
  check(cookies.some((x) => x.startsWith('agri_sso_session_prod=')),
    '取到生产端子系统自己的 SSO 会话（点检脚本的登录凭据口径）')

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1560, height: 900 } })
  await context.addCookies(cookies.map((x) => {
    const pair = x.split(';')[0]
    return { name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), domain: 'localhost', path: '/' }
  }))
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 140)))

  const PAGES = [
    ['总览', '/production/p2t'],
    ['采收批次与可售量', '/production/p2t/batches'],
    ['供给意向发布', '/production/p2t/offers'],
    ['认购台账', '/production/p2t/subscriptions'],
    ['品种对接表', '/production/p2t/variety'],
    ['需求反哺与排产建议', '/production/p2t/demand'],
    ['差异与异常处置', '/production/p2t/diffs'],
    ['全链路追踪', '/production/p2t/trace?batchNo=H20260601'],
  ]

  /* 接口侧真值：DOM 里必须找得到，证明"改成按内容宽"没把列数据弄丢 */
  const [batchRes, offerRes, flowRes, demandRes, varietyRes] = await Promise.all([
    api('/p2t/batches?page=1&size=10'), api('/p2t/offers?page=1&size=10'),
    api('/p2t/subscriptions/flows?page=1&size=10'), api('/p2t/demand-signals'),
    api('/p2t/varieties?page=1&size=10'),
  ])
  const b0 = (batchRes?.data?.records ?? [])[0] ?? {}
  const o0 = (offerRes?.data?.records ?? [])[0] ?? {}
  const f0 = (flowRes?.data?.records ?? [])[0] ?? {}
  const d0 = (demandRes?.data ?? [])[0] ?? {}
  const v0 = (varietyRes?.data?.records ?? [])[0] ?? {}
  const needles = {
    总览: [o0.offerNo],
    采收批次与可售量: [b0.batchNo, b0.harvestDate, `${b0.publishableQty} ${b0.unit}`],
    供给意向发布: [o0.offerNo, o0.batchNo, `${o0.windowStart} ~ ${o0.windowEnd}`],
    认购台账: [f0.orderNo, `${f0.lockFrom ?? '—'} ~ ${f0.lockTo ?? '—'}`, o0.cropName],
    品种对接表: [v0.cropName, v0.categoryCode, v0.specStandard],
    需求反哺与排产建议: [d0.judgement, String(d0.suggestion ?? '').slice(0, 12)],
    差异与异常处置: [seededTicketNo, f0.orderNo],
    全链路追踪: ['H20260601', String(b0.quantity), f0.orderNo],
  }

  const summary = []
  for (const pass of [1560, 1100]) {
    await page.setViewportSize({ width: pass, height: 900 })
    for (const [name, path] of PAGES) {
      await page.goto(`${PROD_UI}${path}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
      await sleep(3800)
      const tables = await page.evaluate(MEASURE, CLAMP)
      const bodyText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
      const miss = (needles[name] ?? []).filter((n) => n && !bodyText.includes(String(n)))
      summary.push({ pass, name, tables, miss })
      if (pass === 1560 && (name === '差异与异常处置' || name === '供给意向发布' || name === '采收批次与可售量')) {
        await page.screenshot({ path: `outputs/p2t-list-scroll-${name}.png`, fullPage: false }).catch(() => null)
      }
    }
  }

  /* ── 1. 口径真的生效：有数据的表都走 max-content，且没被切成 fixed ── */
  const withData = summary.filter((s) => s.tables.some((t) => t.rows > 0))
  check(withData.length >= 14, `${withData.length}/16 个「页 × 视口」组合读到真实数据行（判据不空转）`,
    summary.filter((s) => !s.tables.some((t) => t.rows > 0)).map((s) => `${s.pass}px:${s.name}`).join(' | ') || '（无空表）')
  const nonMax = withData.flatMap((s) => s.tables.filter((t) => t.rows > 0 && t.styleWidth !== 'max-content')
    .map((t) => `${s.pass}px ${s.name} 行内宽=${t.styleWidth}`))
  check(nonMax.length === 0, '所有有数据的表按内容宽排布（行内样式 max-content，没有残留写死像素）',
    nonMax.slice(0, 3).join(' | '))
  const fixedLayout = withData.flatMap((s) => s.tables.filter((t) => t.rows > 0 && t.layout === 'fixed')
    .map((t) => `${s.pass}px ${s.name}`))
  check(fixedLayout.length === 0, '没有表被切成 fixed 布局（fixed 叠加 max-content 会把没写宽度的列压成 0）',
    fixedLayout.slice(0, 3).join(' | '))

  /* ── 2. 数字 / 日期 / 编码列不竖排，列名不被压成两行 ── */
  const wrapped = [...new Set(withData.flatMap((s) => s.tables.flatMap((t) => t.wrappedRigidCells
    .map((v) => `${s.name}:${v}`))) )]
  check(wrapped.length === 0, '数字 / 日期 / 编码类单元格全部单行（没有被压成竖排）', wrapped.slice(0, 5).join(' | '))
  const wrappedHeaders = [...new Set(withData.flatMap((s) => s.tables.flatMap((t) => t.wrappedHeaders
    .map((v) => `${s.name}:${v}`))) )]
  check(wrappedHeaders.length === 0, '所有列名单行渲染（列没被压扁到放不下列名）', wrappedHeaders.slice(0, 5).join(' | '))

  /* ── 3. 裁掉的内容一定可达 ── */
  const clipped = [...new Set(withData.flatMap((s) => s.tables.flatMap((t) => t.clippedCells
    .map((v) => `${s.name}:${v}`))) )]
  check(clipped.length === 0, '没有"被裁掉却没有省略号"的硬裁（信息不会静默丢失）', clipped.slice(0, 4).join(' | '))
  const noTitle = [...new Set(withData.flatMap((s) => s.tables.flatMap((t) => t.ellipsisNoTitle
    .map((v) => `${s.name}:${v}`))) )]
  check(noTitle.length === 0, '省略号收口的长文本单元格都带悬停全文（title）', noTitle.slice(0, 4).join(' | '))

  /* ── 4. 长文本列宽落在收口上限内（既没摊开、也没被收成 0） ── */
  const outOfClamp = [...new Set(withData.flatMap((s) => s.tables.flatMap((t) => t.clampedOutOfRange
    .map((v) => `${s.name}→${v}`))) )]
  check(outOfClamp.length === 0, '备注 / 建议 / 等级规则 / 标准规格 4 类长文本列都收在上限宽度内',
    outOfClamp.slice(0, 4).join(' | '))

  /* ── 5. 滚动条：该出就出，出了末列要可达，不该出时不能假出 ── */
  const scrolled = withData.flatMap((s) => s.tables.filter((t) => t.overflow > 1))
  check(scrolled.length > 0, `横向滚动条按内容宽度出现了（${scrolled.length} 张表溢出）`,
    scrolled.slice(0, 4).map((t) => `${t.columns}列/${t.overflow}px`).join(' | '))
  const unreachable = scrolled.filter((t) => !t.lastColumnReachable)
  check(unreachable.length === 0, '滚到最右后末列完整进入视口（末列不是滑不到的死区）',
    unreachable.map((t) => `${t.columns}列 溢出${t.overflow}px`).slice(0, 4).join(' | '))
  const phantom = withData.flatMap((s) => s.tables.filter((t) => t.rows > 0 && t.overflow > 1 && t.tableWidth <= t.clientWidth)
    .map((t) => `${s.name}@${s.pass}px 表宽${t.tableWidth} ≤ 容器${t.clientWidth} 却溢出${t.overflow}px`))
  check(phantom.length === 0, '没有"表比容器窄却拖出滚动条"的假滚动区（写死常数留下的正是这个）',
    phantom.slice(0, 3).join(' | '))

  /* ── 6. 认购率进度条要有真实宽度（空的 div 在 max-content 下会被收成 0） ── */
  const progressWidths = withData.flatMap((s) => s.tables.filter((t) => t.progressWidth !== null)
    .map((t) => `${s.name}@${s.pass}px→${t.progressWidth}px`))
  check(progressWidths.length > 0 && progressWidths.every((p) => Number(p.split('→')[1]) >= 80),
    '认购率进度条渲染出实际宽度（≥80px）', progressWidths.slice(0, 4).join(' | '))

  /* ── 7. 列数据仍来自接口 ── */
  check(summary.every((s) => s.miss.length === 0),
    '每个列表页都渲染出接口返回的真值（列字段与出参逐列对上，7 页 × 2 视口）',
    summary.filter((s) => s.miss.length).map((s) => `${s.name}@${s.pass}px 缺 ${s.miss.join(',')}`).slice(0, 4).join(' | '))

  /* ── 8. 差异工单页的长备注确实被收住（本轮自建数据才测得到这一支） ── */
  const diffTable = summary.find((s) => s.pass === 1560 && s.name === '差异与异常处置')?.tables?.[0]
  check(Boolean(diffTable) && diffTable.rows > 0, '差异工单页渲染出预置的那一行',
    diffTable ? `${diffTable.rows} 行 / 表宽 ${diffTable.tableWidth}px / 溢出 ${diffTable.overflow}px` : '(没读到表)')
  const remarkHead = (diffTable?.headers ?? []).find((h) => h.startsWith('处置说明'))
  check(Boolean(remarkHead) && Number(remarkHead.split(':')[1]) <= CLAMP.处置说明 + 24,
    '120 字备注的处置说明列按上限收口（不是整句摊开）', remarkHead ?? '(没有这一列)')

  /* 整列横杠只报实测：合法为空（未建品 / 无窗口）与"读错键"要人工分，不能盲断言 */
  const dashCols = [...new Set(withData.flatMap((s) => s.tables.flatMap((t) => t.allDashColumns)
    .map((v) => `${s.name}:${v}`)))]
  console.log(`\n〔实测观察〕整列都是横杠的列（需人工分辨合法为空还是读错键）：${dashCols.length ? dashCols.join(' | ') : '（无）'}`)

  check(pageErrors.length === 0, '全程无 JS 异常', pageErrors.slice(0, 2).join(' | '))

  console.log('\n── 逐表实测（1560px）──')
  for (const s of summary.filter((x) => x.pass === 1560)) {
    for (const t of s.tables) {
      console.log(`　${s.name}　${t.columns}列 ${t.rows}行　布局=${t.layout} 行内宽=${t.styleWidth}　表宽${t.tableWidth}/容器${t.clientWidth} 溢出${t.overflow}px`)
      console.log(`　　　列宽：${t.headers.join(' ')}`)
    }
  }
  console.log('── 逐表实测（1100px，末列可达性）──')
  for (const s of summary.filter((x) => x.pass === 1100)) {
    for (const t of s.tables) {
      console.log(`　${s.name}　${t.columns}列 ${t.rows}行　表宽${t.tableWidth}/容器${t.clientWidth} 溢出${t.overflow}px${t.lastColumnReachable ? '' : '　← 末列不可达'}`)
    }
  }
  await context.close()
  await browser.close()
} catch (error) {
  check(false, '脚本异常中断', String(error?.stack ?? error).slice(0, 240))
} finally {
  if (seededTicketNo) {
    /* 工单没有属主可用的删除接口（写入口在交易侧事件里），用例自己插的行按本次唯一工单号物理清掉；
       计数不过滤 deleted，否则软删行会被当成"已清理"（假绿）。 */
    sql(`DELETE FROM agri_production.agri_p2t_diff_ticket WHERE ticket_no = '${seededTicketNo}'`)
    const left = sql(`SELECT COUNT(*) FROM agri_production.agri_p2t_diff_ticket WHERE ticket_no = '${seededTicketNo}'`)
    check(left === '0', '清理：预置的差异工单已从库里删除（含逻辑删除行）', `剩余 ${left}`)
  }
}

console.log(`\n失败 ${failures.length} 项`)
process.exit(failures.length > 0 ? 1 : 0)
