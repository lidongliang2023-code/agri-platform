/**
 * 产销对接承接闭环（农场发布意向 → 供应商主体自己承接建品）
 *
 * 用法：node scripts/e2e-p2t-claim-loop.mjs
 *      E2E_P2T_SKIP_PUBLISH=1 node scripts/e2e-p2t-claim-loop.mjs   # 单独走"存量单"分支
 * 前置：core(:8093)、agri-production(:8092)、agri-trade(:8089)、网关(:80，trade/prod 产物) 在跑
 *
 * 这条链路以前是"平台替供应商接单"：运营端在 /admin/trade/p2t 审核意向、建品，
 * 而建出来的商品 seller_id 写的是**农场主体**的编号——供应商既改不了价也对不上账。
 * 本轮把它改成主体之间的对接，所以断言的重点就三件事：
 *   1. 承接动作只有供应商主体自己能做，商品归**承接方**（seller_id = 我的主体号，不是农场的）；
 *   2. 生产端能真实看到"谁接的、什么时候上架的"（auditor 记承接方、productCode 回写）；
 *   3. 平台的对接入口真的退掉了（旧路由 410，运营端菜单不再有供给池/建品）。
 *
 * 造的数据全部清理并回库核对（意向、商品各留一条判据）。用例的意向**优先本轮新建**；
 * 若发布被业务身份闸门拒（例如该账号没有已审核通过的农户/合作社管理员身份），脚本改用货源方
 * 存量里"已进池且未承接"的单子，并把来源与拒绝原因打印出来——绝不静默换数据，也不删存量单。
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require2 = createRequire('C:/Users/71502/.workbuddy-ai/binaries/node/workspace/noop.js')
const { chromium } = require2('playwright-core')
const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const CORE = 'http://localhost:8093'
const PROD = 'http://localhost:8092'
const TRADE = 'http://localhost:8089'
const TRADE_UI = 'http://localhost:8086' // 交易端是独立端口的 history 路由 SPA
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'

const FARMER = { user: 'farmer', password: 'Admin@123' }        // 货源方：租户 2001
const SELLER = { user: 'luochuan', password: 'Admin@123' }      // 承接方：陕西洛川果业（供货方）
const sql = (q) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' }).replace(/\r/g, '').trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 80)}`
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
async function waitUntil(condition, { timeoutMs = 15000, everyMs = 500 } = {}) {
  const started = Date.now()
  for (;;) {
    let ok = false
    try { ok = Boolean(await condition()) } catch { ok = false }
    if (ok) return Date.now() - started
    if (Date.now() - started > timeoutMs) return -1
    await sleep(everyMs)
  }
}

const login = async (account) => {
  const res = await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: account.user, password: account.password }),
  })
  const body = await res.json().catch(() => ({}))
  return body?.data?.accessToken ?? ''
}
const call = async (base, token, method, pathname, payload) => {
  const res = await fetch(`${base}/api/${pathname.replace(/^\/+/, '')}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 120) } }
  return { status: res.status, body }
}
const prod = (token, method, pathname, payload) => call(PROD, token, method, `v1/production${pathname}`, payload)
const trade = (token, method, pathname, payload) => call(TRADE, token, method, `trade${pathname}`, payload)

let offerNo = ''
let productCode = ''
let sellerMerchantId = ''
/* 用例的供给意向优先本轮新建；发布被业务身份闸门拒时改用货源方存量单，并把来源打印出来（不静默换数据）。 */
let offerCreatedByRun = false
let offerSourceNote = ''

try {
  /* ─────────── 0. 两个主体的身份必须先立起来 ─────────── */
  const farmerToken = await login(FARMER)
  const sellerToken = await login(SELLER)
  check(Boolean(farmerToken) && Boolean(sellerToken), '货源方(farmer) 与承接方(luochuan) 都能登录')

  const bindings = await trade(sellerToken, 'GET', '/seller/p2t/pool?pageNum=1&pageSize=1')
  const myMerchants = bindings?.body?.data?.merchants ?? []
  sellerMerchantId = String(myMerchants[0]?.merchantId ?? '')
  check(bindings?.body?.code === 200 && myMerchants.length > 0,
    '承接方账号确实绑定了经营主体（承接后商品归这家主体）', myMerchants.map((m) => m.merchantName).join('、'))

  /* ─────────── 1. 用例的供给意向：本轮新建，新建不通就明确改用存量单 ─────────── */
  const batches = await prod(farmerToken, 'GET', '/p2t/batches')
  const publishable = (batches?.body?.data?.records ?? []).filter((b) => b.publishable)
  check(publishable.length > 0, '货源方有可发布的采收批次', `${publishable.length} 个`)
  const batch = publishable[0]
  /*
   * E2E_P2T_SKIP_PUBLISH=1 用来单独验"发布被闸门拒 → 改用存量单"这条分支：
   * 真实环境里这条分支只在账号没开通农户身份时才出现，靠撤身份去复现会动别人的数据，
   * 所以这里用开关跳过发布，分支本身走的还是同一套选单逻辑。
   */
  const skipPublish = process.env.E2E_P2T_SKIP_PUBLISH === '1'
  const created = batch && !skipPublish
    ? await prod(farmerToken, 'POST', '/p2t/offers', {
        batchId: batch.batchId, availableQty: 8, minOrderQty: 1, deliveryType: 'WAREHOUSE',
        remark: 'E2E 承接闭环用例（脚本会删除）',
      })
    : null
  offerNo = String(created?.body?.data?.offerNo ?? '')
  offerCreatedByRun = created?.body?.code === 0 && /^OFFER/.test(offerNo)
  if (offerCreatedByRun) {
    offerSourceNote = `本轮新建 ${offerNo}`
    console.log(`· 意向来源：${offerSourceNote}`)
  } else {
    const publishMessage = skipPublish ? '开关 E2E_P2T_SKIP_PUBLISH=1，本轮不发布'
      : String(created?.body?.message ?? '没有可发布的批次').slice(0, 60)
    console.log(`· 发布供给意向未通过（${publishMessage}），改用货源方存量单`)
    const poolProbe = await trade(sellerToken, 'GET', '/seller/p2t/pool?pageNum=1&pageSize=50')
    const unclaimed = (poolProbe?.body?.data?.records ?? [])
      .filter((r) => r.claimed === false).map((r) => String(r.offerNo))
    const mineRes = await prod(farmerToken, 'GET', '/p2t/offers?page=1&size=50')
    const mine = (mineRes?.body?.data?.records ?? []).filter((r) => r.tradeStatus !== 'LISTED')
    const candidate = mine.find((r) => unclaimed.includes(String(r.offerNo)))
    offerNo = String(candidate?.offerNo ?? '')
    offerSourceNote = `存量单 ${offerNo}（发布被拒：${publishMessage}）`
    check(Boolean(candidate), '发布被拒时货源方仍有"已进入供应商池且未承接"的存量意向可用',
      `本人意向 ${mine.length} 张 / 池中未承接 ${unclaimed.length} 张`)
  }
  check(/^OFFER/.test(offerNo), '拿到一张可用于承接用例的供给意向', offerSourceNote)

  const found = await waitUntil(async () => {
    const res = await trade(sellerToken, 'GET', '/seller/p2t/pool?pageNum=1&pageSize=50')
    return (res?.body?.data?.records ?? []).some((r) => r.offerNo === offerNo)
  })
  check(found >= 0, '供应商侧意向池能立刻看到这张单（跨模块通道通）', `等 ${found}ms`)
  const poolRow = ((await trade(sellerToken, 'GET', '/seller/p2t/pool?pageNum=1&pageSize=50'))?.body?.data?.records ?? [])
    .find((r) => r.offerNo === offerNo) ?? {}
  check(poolRow.claimed === false && poolRow.claimedByMe === false,
    '承接前这张单在供应商侧是"未承接"（状态由交易域商品表实查，不是猜的）',
    `claimed=${poolRow.claimed} remaining=${poolRow.availableQty}/${poolRow.reservedQty}`)

  /* ─────────── 2. 供应商自己承接：建品归属必须是承接方 ─────────── */
  const claimed = await trade(sellerToken, 'POST', `/seller/p2t/pool/${offerNo}/claim`, { listedQty: 5, price: 12.5 })
  productCode = String(claimed?.body?.data?.productCode ?? '')
  check(claimed?.body?.code === 200 && /^SPU/.test(productCode), '承接成功并由本主体建品', productCode)
  const productRow = sql(`SELECT CONCAT(seller_id,'|',IFNULL(seller_name,''),'|',IFNULL(source_offer_no,''),'|',IFNULL(audit_remark,'')) FROM agri_trade.agri_trade_product WHERE product_code = '${productCode}'`)
  check(productRow.startsWith(`${sellerMerchantId}|`),
    '商品的 seller_id 是**承接方主体号**（不再是农场主体号）', productRow.slice(0, 70))
  check(productRow.includes(`|${offerNo}|`), '商品带来源供给单号（可回溯到农场）')
  check(productRow.includes('在卖家中心承接'), '留痕写清"由谁承接"而不是"平台自动通过"', productRow.split('|').pop()?.slice(0, 46))
  check(sql(`SELECT CONCAT(seller_id,'|',IFNULL(seller_name,'')) FROM agri_trade.agri_trade_product WHERE product_code='${productCode}'`).split('|')[1] !== '示范农场',
    '承接方名称不是农场名（避免商品又挂回货源主体）')

  const offerAfter = await prod(farmerToken, 'GET', `/p2t/offers?page=1&size=50&keyword=${offerNo}`)
  const offerRow = (offerAfter?.body?.data?.records ?? []).find((r) => r.offerNo === offerNo) ?? {}
  check(offerRow.tradeStatus === 'LISTED' && String(offerRow.productCode ?? '') === productCode,
    '生产端真实看到"已上架 + 承接方形成的商品编号"', `tradeStatus=${offerRow.tradeStatus} productCode=${offerRow.productCode}`)
  check(String(offerRow.auditor ?? '').includes('供应商承接'),
    '供给侧留痕写的是承接动作由供应商做出', String(offerRow.auditor ?? ''))

  /* ─────────── 3. 负分支：重复承接、冒用别人主体、平台旧入口 ─────────── */
  const productId = String(claimed?.body?.data?.id ?? '')
  const repriced = await trade(sellerToken, 'PUT', `/seller/p2t/products/${productId}/price`, { price: 13.8 })
  check(repriced?.body?.code === 200 && String(repriced?.body?.data?.price) === '13.8',
    '承接方能改自己商品的挂牌价（归属决定权限）', `id=${productId || '未取到'} price=${repriced?.body?.data?.price}`)
  const persistedPrice = sql(`SELECT price FROM agri_trade.agri_trade_product WHERE id = ${productId || '0'}`)
  check(persistedPrice.startsWith('13.8'), '改价真的落库，不是只回显在响应里', `DB=${persistedPrice}`)
  const zeroPrice = await trade(sellerToken, 'PUT', `/seller/p2t/products/${productId}/price`, { price: 0 })
  check(zeroPrice?.body?.code !== 200 && String(zeroPrice?.body?.message ?? '').includes('大于 0'),
    '负分支：挂牌价 0 被服务端拒', String(zeroPrice?.body?.message ?? '').slice(0, 40))

  const again = await trade(sellerToken, 'POST', `/seller/p2t/pool/${offerNo}/claim`, { listedQty: 1, price: 9.9 })
  check(again?.body?.code !== 200 && String(again?.body?.message ?? '').includes('已被承接'),
    '同一张单不能被重复承接（回写失败也不会造出第二件商品）', String(again?.body?.message ?? '').slice(0, 40))
  const impersonate = await trade(sellerToken, 'POST', `/seller/p2t/pool/${offerNo}/claim`, { sellerId: '990000000000000001', listedQty: 1, price: 9.9 })
  check(impersonate?.body?.code !== 200 && /无权|绑定/.test(String(impersonate?.body?.message ?? '')),
    '负分支：指定一个不属于自己的主体承接被拒', String(impersonate?.body?.message ?? '').slice(0, 44))
  const adminPool = await trade(await login({ user: 'admin', password: 'Admin@123' }), 'GET', '/admin/p2t/pool')
  check(adminPool?.status === 410, '平台侧旧的供给池入口返回 410（不是静默 500）', `HTTP ${adminPool?.status}`)
  const adminBuild = await trade(await login({ user: 'admin', password: 'Admin@123' }), 'POST', '/admin/p2t/build', { offerNo })
  check(adminBuild?.status === 410 && String(adminBuild?.body?.message ?? '').includes('卖家中心'),
    '平台侧旧的建品入口同样 410 并说明去哪承接', `HTTP ${adminBuild?.status}`)

  /* ─────────── 4. 卖家中心页面：池子里显示"已由我承接" ─────────── */
  /*
   * 交易端的登录闸门走的是统一认证中心页面（:8090/login?client_id=trade…），
   * 塞 cookie 不算登录——那一站要的是自己的会话。所以这里必须真的把登录表单填一遍，
   * 和 e2e-buyer-full-journey-ui 用的是同一套驱动（先切"账号 + 密码"页签）。
   */
  const fill = (page, target, next) => page.evaluate(({ selector, value }) => {
    const input = document.querySelector(selector)
    if (!(input instanceof HTMLInputElement)) throw new Error(`未找到输入框 ${selector}`)
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { selector: target, value: next })
  const loginAndOpen = async (page, targetPath, account) => {
    await page.goto(`${TRADE_UI}${targetPath}`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => null)
    await page.waitForFunction(() => window.location.port === '8090', undefined, { timeout: 25000 })
    await page.waitForSelector('button[role="tab"]', { timeout: 20000 })
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll('button[role="tab"]')]
        .find((item) => item.textContent?.includes('账号 + 密码'))
      tab?.click()
    })
    await fill(page, 'input[autocomplete="username"]', account.user)
    await fill(page, 'input[autocomplete="current-password"]', account.password)
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button[type="submit"]')]
        .find((item) => item.textContent?.includes('登 录'))
      button?.click()
    })
    for (let i = 0; i < 60; i += 1) {
      await sleep(400)
      if (page.url().includes(':8086') && !page.url().includes('/login')) break
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => null)
    await sleep(1500)
  }

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const pageErrors = []
  const watch = (p, tag) => p.on('pageerror', (e) => pageErrors.push(`${tag}: ${String(e?.message ?? e).slice(0, 120)}`))

  const sellerCtx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  const sellerPage = await sellerCtx.newPage()
  watch(sellerPage, '卖家中心')
  await loginAndOpen(sellerPage, '/member/seller?tab=p2t', SELLER)
  const sellerText = await sellerPage.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  check(sellerText.includes('可承接的供给意向'), '卖家中心出现「产销对接（承接）」面板', sellerText.slice(0, 60))
  check(sellerText.includes(offerNo), '池子里能看到这张单')
  check(sellerText.includes('已由我承接') && sellerText.includes(productCode),
    '承接结果在页面上可见（商品编号回显，不是只存在库里）')
  check(sellerText.includes('我承接出来的商品'), '「我的承接商品」区块渲染')
  await sellerPage.screenshot({ path: 'outputs/p2t-claim-seller.png', fullPage: true }).catch(() => null)
  await sellerCtx.close()

  const adminCtx = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  const adminPage = await adminCtx.newPage()
  watch(adminPage, '运营端')
  await loginAndOpen(adminPage, '/admin/trade/p2t/boundary', { user: 'admin', password: 'Admin@123' })
  const adminText = await adminPage.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
  /* 文案判据要用页面真实写出的字面（旧脚本用的"供给池审核"这一串在页面上根本不存在，是脚本自己的错）。 */
  check(adminText.includes('生产直供供给池（审核）') && adminText.includes('410') && adminText.includes('卖家中心'),
    '运营端边界页明确写出"审核与建品已下线、承接在卖家中心"', adminText.slice(0, 70))
  /*
   * 菜单是否下线必须先看"展开后到底渲染了什么"：antd 的子菜单项是点击才进 DOM 的，
   * 不展开就断言"菜单里没有供给池"永远成立——那是假绿。先展开、先证明治理项在，再判旧的没了。
   */
  await adminPage.evaluate(() => {
    const title = [...document.querySelectorAll('.ant-menu-submenu-title')]
      .find((el) => el.textContent?.includes('产销对接'))
    title?.click()
  })
  const expandMs = await waitUntil(() => adminPage.evaluate(() => [...document.querySelectorAll('.ant-menu-title-content')]
    .some((el) => el.textContent?.includes('产销对账'))), { timeoutMs: 10000 })
  check(expandMs >= 0, '运营端「产销对接」子菜单展开后渲染出平台治理项（正控）', `等 ${expandMs}ms`)
  const menuLabels = await adminPage.evaluate(() => [...document.querySelectorAll('.ant-menu-title-content')]
    .map((el) => (el.textContent ?? '').trim()).filter(Boolean))
  check(!menuLabels.some((t) => t.includes('供给池') || t.includes('建品')),
    '运营端菜单不再有供给池 / 建品两个入口',
    `现存 ${menuLabels.length} 项：${menuLabels.filter((t) => /产销|对账|回写|追踪|规则|差异|边界/.test(t)).join('、')}`)
  check(pageErrors.length === 0, '两端页面均无 JS 异常', pageErrors.slice(0, 2).join(' | '))
  await adminCtx.close()
  await browser.close()
} catch (error) {
  check(false, '脚本异常中断', String(error?.message ?? error).slice(0, 170))
} finally {
  if (productCode) {
    sql(`DELETE FROM agri_trade.agri_trade_product WHERE product_code = '${productCode}' AND source_offer_no = '${offerNo}'`)
  }
  /* 只有本轮真的建过意向才删；用存量单跑用例时不能把演示数据删掉。 */
  if (offerNo && offerCreatedByRun) {
    sql(`DELETE FROM agri_production.agri_p2t_offer WHERE offer_no = '${offerNo}' AND remark LIKE 'E2E 承接闭环用例%'`)
  }
  const leftOffer = sql(`SELECT COUNT(*) FROM agri_production.agri_p2t_offer WHERE offer_no = '${offerNo}'`)
  const leftProduct = sql(`SELECT COUNT(*) FROM agri_trade.agri_trade_product WHERE source_offer_no = '${offerNo}'`)
  const expectOffer = offerCreatedByRun ? leftOffer === '0' : leftOffer === '1'
  check(Boolean(offerNo) && expectOffer && leftProduct === '0',
    '清理：承接商品归零，意向按来源处置（本轮新建→删掉；存量单→原样留着）',
    `${offerSourceNote} offer=${leftOffer}（期望 ${offerCreatedByRun ? 0 : 1}）product=${leftProduct}`)
}

console.log(`\n失败 ${failures.length} 项`)
process.exit(failures.length > 0 ? 1 : 0)
