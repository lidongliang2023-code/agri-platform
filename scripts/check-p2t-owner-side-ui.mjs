/**
 * 产销对接归位点检（生产管理模块：由经营主体在用户端发起）
 *
 * 用法：node scripts/check-p2t-owner-side-ui.mjs
 * 前置：core-platform(:8093)、agri-production 后端(:8092)、网关(:80，生产端产物) 在跑
 *
 * 为什么要有这一支：产销对接的后端**一直**是按令牌解析经营主体
 * （TenantContextService → 平台主体绑定），页面却挂在运营端 `/admin/production/p2t/**`。
 * 结果就是"能力是属主的，入口是平台的"——属主在自己端里看不到、也发不起供给意向。
 * 本脚本验的是归位之后的四件事：
 *   1) 用户端菜单有「产销对接」，页面数字与后端接口同源（不是页面自己算的假数）；
 *   2) 属主能在本页**真的发起**一张供给意向（走完表单 → 列表 +1 → 后端有这一行）；
 *   3) 用例数据自清理：删掉后列表回到开场条数，库里不留残留（列表判据用**脚本自己预置的那一行**，
 *      不依赖演示库里恰好有单子；跑之前 agri_p2t_offer 是 0 行，所以那份"恰好有"本来就不成立）；
 *   4) 运营端 `/admin/production/p2t` 不再是产销对接页面（旧入口确实被摘掉，不是"两边都有"）。
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')
const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const CORE = 'http://localhost:8093'
const PROD = 'http://localhost:8092'
const PROD_UI = 'http://localhost'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

async function waitUntil(condition, { timeoutMs = 20000, everyMs = 400 } = {}) {
  const started = Date.now()
  for (;;) {
    let ok = false
    try { ok = Boolean(await condition()) } catch { ok = false }
    if (ok) return Date.now() - started
    if (Date.now() - started > timeoutMs) return -1
    await sleep(everyMs)
  }
}

let createdOfferId = ''
let seedOfferId = ''
let token = ''

async function api(pathname, options = {}) {
  const res = await fetch(`${PROD}/api/v1/production${pathname}`, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(options.headers ?? {}) },
  })
  return res.json()
}

try {
  const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'farmer', password: 'Admin@123' }),
  })).json()
  token = login?.data?.accessToken ?? ''
  check(Boolean(token), '以农场属主账号（farmer）登录，产销对接的数据范围由令牌决定')

  const overview0 = await api('/p2t/overview')
  check(overview0?.code === 0 && overview0?.data?.supplyQty !== undefined,
    '接口读到本主体的供给总览', `可供量 ${overview0?.data?.supplyQty}`)
  const batches = await api('/p2t/batches')
  const publishable = (batches?.data?.records ?? batches?.data ?? []).filter((b) => b.publishable)
  check(publishable.length > 0, '本主体有可发布的采收批次', `${publishable.length} 个`)

  /*
   * "列表页显示真实存在的供给单号"这条判据不能依赖演示库里恰好有单子——
   * 演示数据会漂移（本轮跑之前这张表就是空的），依赖它要么假红要么假绿。
   * 所以先用属主自己的接口铺一行预置数据，验完随用例一起物理清掉。
   */
  const seeded = await api('/p2t/offers', {
    method: 'POST',
    body: JSON.stringify({
      batchId: publishable[0]?.batchId, availableQty: 66, minOrderQty: 6, deliveryType: 'WAREHOUSE',
      remark: 'E2E 产销对接归位用例（预置行，脚本会删除）',
    }),
  })
  const seedOfferNo = String(seeded?.data?.offerNo ?? '')
  seedOfferId = String(seeded?.data?.id ?? '')
  check(/^OFFER/.test(seedOfferNo), '预置一行属主自己的供给单作为列表判据',
    seedOfferNo || JSON.stringify(seeded ?? {}).slice(0, 80))

  const overview = await api('/p2t/overview')
  const ov = overview?.data ?? {}
  const offersBefore = await api('/p2t/offers?page=1&size=50')
  const countBefore = (offersBefore?.data?.records ?? []).length

  /*
   * 会话 Cookie 必须按**子系统**取：core-platform 的 /authorize 只认 `agri_sso_session_<clientId>`
   * （2026-11-03 起，为的是"同一浏览器可以不同账号登录不同子系统，A 的登录态不替 B 免登"）。
   * 老的 /sso/login-standalone 只写全局 Cookie，用它注入的后果是生产端一路跳回登录页——
   * 看起来像"页面坏了"，其实是脚本取错了凭据。
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
    '能取到生产端子系统自己的 SSO 会话（脚本的登录凭据口径）', cookies.map((x) => x.split(';')[0].split('=')[0]).join(','))
  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1560, height: 980 } })
  await context.addCookies(cookies.map((x) => {
    const pair = x.split(';')[0]
    return { name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1), domain: 'localhost', path: '/' }
  }))
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 140)))

  /* ── 1. 用户端入口与同源数据 ── */
  await page.goto(`${PROD_UI}/production/p2t`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await sleep(4000)
  const menuText = await page.evaluate(() => {
    const el = document.querySelector('.ant-menu, aside, [class*="menu"]')
    return el ? el.innerText.replace(/\s+/g, ' ') : ''
  })
  check(menuText.includes('产销对接') && menuText.includes('供给意向发布'), '用户端左侧菜单出现「产销对接」组',
    (menuText.match(/产销对接[^]{0,40}/) ?? [''])[0].slice(0, 40))
  const ovText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  check(ovText.includes('产销对接总览'), '总览页渲染（不是 404 或空白）', ovText.slice(0, 60))
  check(ovText.includes(String(ov.offerCount)) && ovText.includes(String(ov.batchCount)),
    '页面上的 KPI 与后端接口同源（不是前端写死的演示数）', `供给单 ${ov.offerCount} / 批次 ${ov.batchCount}`)

  /* ── 2. 供给意向列表与后端条数一致 ── */
  await page.goto(`${PROD_UI}/production/p2t/offers`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await sleep(4000)
  const listText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  check(Boolean(seedOfferNo) && listText.includes(seedOfferNo), '列表页显示本主体真实存在的供给单号', seedOfferNo)
  check(!listText.includes('404') && !listText.includes('页面不存在'), '运营端迁走后本页没有变成死链')

  /* ── 3. 属主在本页真的发起一张意向 ── */
  await page.locator('button').filter({ hasText: /新建供给意向/ }).first().click({ timeout: 8000 }).catch(() => null)
  const modalOpen = await waitUntil(() => page.locator('.ant-modal').first().isVisible().catch(() => false), { timeoutMs: 6000 })
  check(modalOpen >= 0, '点「新建供给意向」打开表单（发起动作在属主自己端）')
  if (modalOpen >= 0) {
    await page.locator('.ant-modal .ant-form-item').filter({ hasText: '采收批次' }).locator('.ant-select').first().click({ timeout: 6000 })
    await sleep(1200)
    const optionTexts = await page.evaluate(() => [...document.querySelectorAll('.ant-select-item-option')]
      .filter((x) => x.offsetParent !== null).map((x) => x.innerText.trim()))
    check(optionTexts.length > 0 && optionTexts.some((t) => t.includes(publishable[0]?.batchNo ?? '@@')),
      '批次下拉里是本主体可发布的批次', optionTexts.slice(0, 2).join(' | '))
    await page.locator('.ant-select-item-option').filter({ hasText: publishable[0].batchNo }).first().click({ timeout: 6000 })
    await sleep(1500)
    const categoryOptions = await page.evaluate(() => {
      const items = [...document.querySelectorAll('.ant-form-item')]
      const item = items.find((x) => x.innerText.includes('交易品类'))
      return item ? item.querySelector('.ant-select')?.innerText.replace(/\s+/g, ' ').trim() : ''
    })
    await page.locator('.ant-modal .ant-form-item').filter({ hasText: '交易品类' }).locator('.ant-select').first().click({ timeout: 6000 }).catch(() => null)
    await sleep(1200)
    /*
     * antd 的下拉面板关掉了也还挂在 DOM 里（上一个是批次下拉），
     * 所以选项必须按「当前可见的那个面板」取，否则点到的是一条不可见旧节点 → 静默超时。
     */
    const visibleOption = '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option'
    const catTexts = await page.evaluate(() => [...document
      .querySelectorAll('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')]
      .map((x) => x.innerText.trim()))
    check(catTexts.length > 0, '选定批次后能选到交易品类（品种对接表真的起了作用）',
      `${catTexts.slice(0, 2).join(' / ')}｜批次当前品类：${categoryOptions.slice(0, 20)}`)
    if (catTexts.length) {
      await page.locator(visibleOption).first().click({ timeout: 6000 })
      await sleep(800)
      const qtyInput = page.locator('.ant-modal .ant-form-item').filter({ hasText: '可供量' }).locator('input').first()
      await qtyInput.fill('12.5')
      await page.locator('.ant-modal .ant-form-item').filter({ hasText: '备注' }).locator('textarea').first()
        .fill('E2E 产销对接归位用例（脚本会自行删除）').catch(() => null)
      await page.locator('.ant-modal button').filter({ hasText: /确\s*定|提\s*交/ }).first().click({ timeout: 8000 })
      /*
       * 回执要在点的当下就抓：antd 的 message 三秒自动消失，
       * 而下面那次"进台账"的轮询本身可能要几秒——先轮询再读文案会抓到"已经没有提示了"的页面（假红）。
       */
      const toastMs = await waitUntil(() => page.evaluate(() => document.body.innerText.includes('供给意向已发布')),
        { timeoutMs: 8000, everyMs: 150 })
      const toastText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
      check(toastMs >= 0 && toastText.includes('供给意向已发布'), '页面给出真实回执',
        (toastText.match(/供给意向已发布[^]{0,26}/) ?? ['(提示已消失)'])[0].slice(0, 46))
      const createdWait = await waitUntil(async () => {
        const page2 = await api('/p2t/offers?page=1&size=50')
        const recs = page2?.data?.records ?? []
        /* 备注要按"表单行"那一条精确匹配：预置行的备注也是同一个前缀，含糊匹配会认领错行。 */
        const hit = recs.find((r) => String(r.remark ?? '').includes('E2E 产销对接归位用例（脚本会自行删除）'))
        if (hit) { createdOfferId = String(hit.id); return true }
        return false
      }, { timeoutMs: 15000 })
      check(createdWait >= 0, '属主发起的供给意向进了台账', createdOfferId ? `id=${createdOfferId}` : '(没读到新建行)')
      await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => null)
      await sleep(3500)
      const afterText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
      const rows = await api('/p2t/offers?page=1&size=50')
      check((rows?.data?.records ?? []).length === countBefore + 1 && afterText.includes('E2E 产销对接归位用例') === false,
        '列表条数比开场多 1（真的写进去了，不是本地插行）', `${countBefore} → ${(rows?.data?.records ?? []).length}`)
    }
  }

  /* ── 4. 运营端旧入口已摘掉 ── */
  await page.goto(`${PROD_UI}/admin/production/p2t`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await sleep(4000)
  const adminText = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  check(!adminText.includes('产销对接总览') && !adminText.includes('供给意向发布'),
    '运营端 /admin/production/p2t 不再是产销对接页面（入口确实迁走，不是两边都有）', adminText.slice(0, 50))
  await page.screenshot({ path: 'outputs/p2t-owner-side.png', fullPage: true }).catch(() => null)
  check(pageErrors.length === 0, '全程无 JS 异常', pageErrors.slice(0, 2).join(' | '))
  await context.close()
  await browser.close()
} catch (error) {
  check(false, '脚本异常中断', String(error?.message ?? error).slice(0, 160))
} finally {
  if (token) {
    /* 预置行与表单行都要走属主自己的删除接口——"脚本自己铺的数据自己清"，不留给别人擦。 */
    for (const id of [createdOfferId, seedOfferId]) {
      if (id) await api(`/p2t/offers/${id}`, { method: 'DELETE' }).catch(() => null)
    }
    const left = await api('/p2t/offers?page=1&size=50').catch(() => null)
    const hit = (left?.data?.records ?? []).filter((r) => String(r.remark ?? '').includes('E2E 产销对接归位用例'))
    check(hit.length === 0, '清理：用例供给意向（预置行与表单行）都已删除', `剩余 ${hit.length} 条`)
  }
  const { execFileSync } = await import('node:child_process')
  const mysql = (q) => {
    try {
      return execFileSync('C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe',
        ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
        { encoding: 'utf8' }).replace(/\r/g, '').trim()
    } catch { return 'ERR' }
  }
  /*
   * `/p2t/offers/{id}` 的删除是**逻辑删除**（BaseEntity @TableLogic），接口删完行还在表里。
   * 用例数据要的是"零残留"而不是"看起来没了"，所以这里按本次唯一的备注串物理清掉
   * （预置行与表单行共用这一个前缀），再按"任何 deleted 状态"计数——
   * 只查 deleted=0 的话，软删行会被算成已清理（假绿）。
   */
  mysql("DELETE FROM agri_production.agri_p2t_offer WHERE remark LIKE 'E2E 产销对接归位用例%'")
  const dbLeft = mysql("SELECT COUNT(*) FROM agri_production.agri_p2t_offer WHERE remark LIKE 'E2E 产销对接归位用例%'")
  check(dbLeft === '0', '残留核对：库里没有遗留的用例供给单（含逻辑删除行）', `count=${dbLeft}`)
}

console.log(`\n失败 ${failures.length} 项`)
process.exit(failures.length > 0 ? 1 : 0)
