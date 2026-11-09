/**
 * 供应商端「商品绑定生产批次」真机点检（S2B2C :8084）
 *
 * 用法：node scripts/check-supplier-batch-bind-ui.mjs
 *      E2E_SUPPLIER_USER=<账号> node scripts/check-supplier-batch-bind-ui.mjs
 * 前置：商城后端(:8088)、生产后端(:8092)、认证(:8093)、网关(:80)、供应商端产物(:8084) 在跑，
 *      且已跑过 `node scripts/provision-supplier-with-batches.mjs`（造/复用夹具账号）
 *
 * 验的是"供应商在编辑页真的能绑上、能看见、能解绑"，而不是接口单测：
 *   1) 编辑页读回来的是**这个商品**的档案（以前读的是供应商档案，表单全空照样能保存）；
 *   2) 批次下拉里的候选来自生产域本主体名下（不是前端写死、不是别人的批次）；
 *   3) 选中后链路预览给出真实节点数与链上结论；
 *   4) 保存 → 库里落值 → 重新进入编辑页仍显示该批次（回读闭环）；
 *   5) 解绑 → 库里回到 NULL（不是空串）；
 *   6) 负分支：按别人的商品 id 直接进编辑页，档案读不到就锁住保存按钮，
 *      否则一次点击就把没显示的列清空。
 *
 * 数据纪律：优先复用夹具主体名下的在售商品并只改 `prod_batch_no`（收尾按开场值还原并回库核对）；
 * 该主体名下没有商品时**自建一条用例商品**，收尾物理删掉——不去动别人演示商品的档案。
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
const S2B2C = 'http://localhost:8088'
const SUPPLIER_UI = 'http://localhost:8084'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
/* 夹具账号（provision-supplier-with-batches.mjs 造的：角色 S2B2C_SUPPLIER + 主体名下有采收批次） */
const SUPPLIER_USER = process.env.E2E_SUPPLIER_USER ?? 'lvyuanshop'
const DEMO_PASSWORD = process.env.AGRI_DEMO_PASSWORD ?? 'Admin@123'
const PRODUCT_NAME = 'E2E 溯源绑定用例商品（脚本会删除）'

const sql = (q) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' }).replace(/\r/g, '').trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 90)}`
  }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/**
 * 保存之后不要"睡固定毫秒再断言"：栈刚重启时，一次商品更新要跨模块问生产域（requireOwnBatch），
 * 首请求可能 3–5 秒才回；固定 2500ms 会让"落库值还没变"被读成解绑失败（本轮就是这么红过一次）。
 * 改成轮询到条件成立或超时，并把等待时长如实打出来。
 */
async function waitUntil(label, condition, { timeoutMs = 20000, everyMs = 400 } = {}) {
  const started = Date.now()
  for (;;) {
    let ok = false
    try {
      ok = Boolean(await condition())
    } catch {
      ok = false
    }
    if (ok) return Date.now() - started
    if (Date.now() - started > timeoutMs) return -1
    await sleep(everyMs)
  }
}

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

let targetId = ''
let originalBatch = null
let batchUsed = ''
let createdProduct = false

try {
  /*
   * 会话要按子系统取：core-platform 的 /authorize 只认 `agri_sso_session_<clientId>`
   * （2026-11-03 起，为了让"同一浏览器以不同账号登录不同子系统"互不免登）。
   * 只拿全局 Cookie 的话，卖家端会一路跳回统一认证登录页，表单读出来是空的——
   * 看着像产品坏了，其实是脚本取错了凭据。
   *
   * 账号也不再写死 supplier1：`/api/supplier/production-batches` 只回**当前主体名下**的批次，
   * supplier1 的主体被改绑后名下 0 个批次，下拉合法为空（那是数据事实，不是缺陷）。
   * 默认用 `scripts/provision-supplier-with-batches.mjs` 造出来的夹具账号——
   * 角色 S2B2C_SUPPLIER、绑在主体 2001（有 3 个在册采收批次）、入驻单已审核通过。
   */
  const login = await fetch(`${CORE}/api/v1/sso/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username: SUPPLIER_USER, password: DEMO_PASSWORD, clientId: 'mall-supplier',
      redirectUri: `${SUPPLIER_UI}/sso/callback`, state: 'supplier-bind-patrol',
      codeChallenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM', codeChallengeMethod: 'S256',
    }),
  })
  const cookiePairs = (login.headers.getSetCookie?.() ?? []).map((x) => x.split(';')[0])
  check(cookiePairs.some((p) => p.startsWith('agri_sso_session_mall-supplier=')),
    `${SUPPLIER_USER} 取得**卖家端自己的**统一认证会话`, cookiePairs.map((p) => p.split('=')[0]).join(','))

  const accessToken = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: SUPPLIER_USER, password: DEMO_PASSWORD }),
  })).json().then((b) => b?.data?.accessToken ?? '').catch(() => '')

  /* 商品从"这个账号自己的入驻主体"里取；一家都没有就建一条用例商品，收尾删掉（不动演示商品）。 */
  const supplierRowId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = (SELECT id FROM agri_core.platform_user WHERE username = '${SUPPLIER_USER}') LIMIT 1`)
  check(/^\d+$/.test(String(supplierRowId)), `${SUPPLIER_USER} 的商城入驻主体行已就绪`, `supplier=${supplierRowId}`)
  targetId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id = '${supplierRowId}' ORDER BY id LIMIT 1`)
  if (!/^\d+$/.test(String(targetId))) {
    const created = await (await fetch(`${S2B2C}/api/supplier/product/create`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        name: PRODUCT_NAME, categoryId: 11, price: 15.9, stock: 20, unit: '份',
        origin: '广东深圳', detail: '溯源绑定用例商品（脚本会删除）',
      }),
    })).json().catch(() => null)
    targetId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE name = '${PRODUCT_NAME}' ORDER BY id DESC LIMIT 1`)
    createdProduct = /^\d+$/.test(String(targetId))
    check(Boolean(created?.success) && createdProduct, '没有现成商品时自建一条用例商品',
      `product=${targetId} msg=${String(created?.message ?? '请求失败').slice(0, 40)}`)
  } else {
    check(true, '复用该主体名下的在售商品', `product=${targetId}`)
  }
  check(/^\d+$/.test(String(targetId)), '取到要操作的商品 id', `product=${targetId}`)
  originalBatch = sql(`SELECT IFNULL(prod_batch_no,'<NULL>') FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}'`) === '<NULL>'
    ? null
    : sql(`SELECT prod_batch_no FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}'`)
  const productName = sql(`SELECT name FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}'`)

  const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  const context = await browser.newContext({ viewport: { width: 1500, height: 950 } })
  await context.addCookies(cookiePairs.map((p) => ({
    name: p.slice(0, p.indexOf('=')), value: p.slice(p.indexOf('=') + 1), domain: 'localhost', path: '/',
  })))
  const page = await context.newPage()
  const dialogs = []
  const updateBodies = []
  page.on('request', (req) => {
    if (req.url().includes('/supplier/product/update')) updateBodies.push(req.postData() ?? '')
  })
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.accept().catch(() => null) })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e?.message ?? e).slice(0, 120)))

  /* ── 1. 编辑页读回来的是这个商品自己 ── */
  await page.goto(`${SUPPLIER_UI}/product-edit/${targetId}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await sleep(3500)
  const nameValue = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.el-form-item')].find((x) => x.innerText.includes('商品名称'))
    return item ? (item.querySelector('input')?.value ?? '') : ''
  })
  check(nameValue === productName, '编辑页表单里是这条商品自己的档案', `表单=${nameValue} / 库里=${productName}`)
  const loadBanner = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.batch-error')].find((x) => x.offsetParent !== null)
    return el ? el.innerText.slice(0, 60) : ''
  })
  check(loadBanner === '', '正常进入时不该出现"档案没有读到"的横幅', loadBanner)

  /* ── 2. 批次下拉的候选来自生产域 ── */
  const selectItem = page.locator('.el-form-item').filter({ hasText: '溯源批次' })
  await selectItem.locator('.el-select').first().click({ timeout: 10000 })
  await sleep(1800)
  const optionTexts = await page.evaluate(() => [...document.querySelectorAll('.el-select-dropdown__item')]
    .filter((x) => x.offsetParent !== null).map((x) => x.innerText.trim()))
  /* 比对基准也要按**这个账号的主体**取：拿全库批次去比，别人家的批次也算"对得上"，判据就松了。 */
  const subjectIds = sql(`SELECT um.merchant_id FROM agri_core.platform_user u
    JOIN agri_core.platform_user_merchant um ON um.user_id = u.id
    WHERE u.username = '${SUPPLIER_USER}' AND um.status = 1`).split('\n').filter((x) => /^\d+$/.test(x))
  const productionBatches = subjectIds.length === 0 ? [] : sql(`SELECT DISTINCT batch_no FROM agri_production.agri_prod_harvest_batch
    WHERE batch_no IS NOT NULL AND deleted = 0 AND tenant_id IN (${subjectIds.join(',')})`)
    .split('\n').filter(Boolean)
  check(optionTexts.length > 0 && productionBatches.some((b) => optionTexts.some((t) => t.includes(b))),
    '下拉里的批次确实是生产域登记过的编号', optionTexts.slice(0, 2).join(' | '))
  /* 空数组的 every() 恒真是假绿：候选一条都没有时必须明说"没候选"，而不是报"都带作物信息"。 */
  check(optionTexts.length > 0 && optionTexts.every((t) => /采收|·/.test(t)),
    '候选带作物/采收信息（选错人有依据可核对）', `可见候选 ${optionTexts.length} 条`)
  batchUsed = productionBatches.find((b) => optionTexts.some((t) => t.startsWith(b))) ?? ''
  check(Boolean(batchUsed), '能定位到要选的那个批次', batchUsed)
  await page.locator('.el-select-dropdown__item').filter({ hasText: batchUsed }).first().click({ timeout: 8000 })
  await sleep(2200)

  /* ── 3. 链路预览给出真实节点数 ── */
  const hintText = await page.evaluate(() => {
    const el = document.querySelector('.batch-hint')
    return el ? el.innerText.replace(/\s+/g, ' ').slice(0, 200) : ''
  })
  check(/节点|种植|加工/.test(hintText), '选中后预览说清了这个批次有什么', hintText.slice(0, 90))
  await page.screenshot({ path: 'outputs/supplier-batch-bind.png', fullPage: true }).catch(() => null)

  /* ── 4. 保存 → 落库 → 再进入仍显示 ── */
  const dialogsBeforeBind = dialogs.length
  await page.locator('button').filter({ hasText: /保\s*存\s*修\s*改/ }).first().click({ timeout: 8000 })
  const bindWait = await waitUntil('绑定落库',
    () => sql(`SELECT IFNULL(prod_batch_no,'<NULL>') FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}'`) === batchUsed)
  check(bindWait >= 0, '保存后库里真的写入所选批次',
    bindWait >= 0 ? `${batchUsed}（等 ${bindWait}ms）` : `等满 20s 仍是 ${sql(`SELECT IFNULL(prod_batch_no,'<NULL>') FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}'`)}`)
  check(await waitUntil('绑定回执', () => dialogs.length > dialogsBeforeBind) >= 0,
    '页面用真实提示告知保存结果', dialogs.slice(-1)[0] ?? '(没有弹窗)')

  await page.goto(`${SUPPLIER_UI}/product-edit/${targetId}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await sleep(3500)
  const shownBatch = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.el-form-item')].find((x) => x.innerText.includes('溯源批次'))
    return item ? item.innerText.replace(/\s+/g, ' ').slice(0, 120) : ''
  })
  check(shownBatch.includes(batchUsed), '重新进入编辑页仍显示已绑批次（回读闭环）', shownBatch.slice(0, 70))

  /* ── 5. 负分支：别人的商品读不到就锁住保存 ── */
  const foreignId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id <> 1 ORDER BY id LIMIT 1`)
  await page.goto(`${SUPPLIER_UI}/product-edit/${foreignId}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await sleep(3000)
  const foreignBanner = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.batch-error')].find((x) => x.offsetParent !== null)
    return el ? el.innerText.replace(/\s+/g, ' ').slice(0, 80) : ''
  })
  check(foreignBanner.includes('没有读到'), '别人的商品：页面说明读不到档案', foreignBanner)
  const saveDisabled = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((x) => /保存修改/.test(x.innerText))
    return btn ? btn.disabled : null
  })
  check(saveDisabled === true, '档案没读到时「保存修改」是禁用的（不给人清空列的机会）', String(saveDisabled))

  /* ── 6. 解绑回到 NULL（而不是空串） ── */
  await page.goto(`${SUPPLIER_UI}/product-edit/${targetId}`, { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null)
  await sleep(3000)
  /*
   * 先证明"档案确实重新读回来了"：上一步停在别人商品的编辑页（同一路由换参数），
   * 组件不重新挂载的话表单还是空的、保存按钮还是禁用的，
   * 那时"清空后不再显示批次"会是句空话——看着通过，其实一次提交都没发生。
   */
  const reloadedName = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.el-form-item')].find((x) => x.innerText.includes('商品名称'))
    return item ? (item.querySelector('input')?.value ?? '') : ''
  })
  check(reloadedName === productName, '换 id 再进编辑页时档案重新读回来了', `表单=${reloadedName}`)
  /*
   * 清空这一步不能"点了就算"：Element Plus 的清除图标只在 hover 选择框时出现，
   * 直接 click 一个隐藏图标会静默 no-op（本项目已经踩过一次），
   * 于是"清空后不再显示批次"看着通过，实际提交的还是老批次。
   * 这里先 hover、再等图标可见、再点，最后用"送出的请求体"和"库里的值"两处复核。
   */
  const selectBox = page.locator('.el-form-item').filter({ hasText: '溯源批次' }).locator('.el-select').first()
  await selectBox.hover({ timeout: 5000 })
  const clearIcon = selectBox.locator('[class*="clear"]').first()
  await clearIcon.waitFor({ state: 'visible', timeout: 5000 })
  await clearIcon.click({ timeout: 5000 })
  await sleep(600)
  const afterClearText = (await selectBox.innerText()).replace(/\s+/g, ' ').trim()
  check(!afterClearText.includes(batchUsed), '清空后选择框不再显示该批次', afterClearText.slice(0, 40) || '(空白)')
  const hintAfterClear = await page.evaluate(() => {
    const el = document.querySelector('.batch-hint')
    return el ? el.innerText.replace(/\s+/g, ' ').slice(0, 60) : ''
  })
  check(!hintAfterClear.includes(batchUsed), '清空后链路预览也跟着撤掉（不留一个没选上的批次的说明）', hintAfterClear.slice(0, 40))
  const dialogsBefore = dialogs.length
  await page.locator('button').filter({ hasText: /保\s*存\s*修\s*改/ }).first().click({ timeout: 8000 })
  const unbindWait = await waitUntil('解绑落库',
    () => sql(`SELECT IFNULL(prod_batch_no,'<NULL>') FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}'`) === '<NULL>')
  const lastBody = updateBodies[updateBodies.length - 1] ?? ''
  const sentBatch = lastBody.includes('"prodBatchNo"')
    ? (lastBody.match(/"prodBatchNo":("[^"]*"|null)/)?.[1] ?? '解析不到')
    : '请求体里没有 prodBatchNo 这个键（清空后不提交该列）'
  check(await waitUntil('解绑回执', () => dialogs.length > dialogsBefore) >= 0,
    '解绑这次保存真的发出去了（页面有回执）', dialogs.slice(-1)[0] ?? '(没有弹窗)')
  check(unbindWait >= 0, '解绑落库是 NULL（库里"未绑定"只有这一个写法）',
    unbindWait >= 0
      ? `库里=NULL（等 ${unbindWait}ms）送出=${sentBatch} 共 ${updateBodies.length} 次保存`
      : `等满 20s 库里仍是 ${sql(`SELECT IFNULL(prod_batch_no,'<NULL>') FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}'`)} 送出=${sentBatch} 共 ${updateBodies.length} 次保存`)

  check(pageErrors.length === 0, '供应商端全程无 JS 异常', pageErrors.slice(0, 2).join(' | '))
  await context.close()
  await browser.close()
} catch (error) {
  check(false, '脚本异常中断', String(error?.message ?? error).slice(0, 160))
} finally {
  if (/^\d+$/.test(String(targetId))) {
    if (createdProduct) {
      /* 用例商品是自建的，就该删掉而不是"还原绑定"——留一条演示里没有的商品就是残留。 */
      sql(`DELETE FROM agri_s2b2c.s2b2c_footprint WHERE product_id = '${targetId}'`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}' AND name = '${PRODUCT_NAME}'`)
      const left = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}'`)
      check(left === '0', '清理：用例商品已删除（不留在演示库里）', `product=${targetId} 剩余 ${left}`)
    } else {
      const restore = originalBatch === null ? 'NULL' : `'${originalBatch.replace(/'/g, "''")}'`
      sql(`UPDATE agri_s2b2c.s2b2c_product SET prod_batch_no = ${restore} WHERE id = '${targetId}'`)
      const nowBatch = sql(`SELECT IFNULL(prod_batch_no,'<NULL>') FROM agri_s2b2c.s2b2c_product WHERE id = '${targetId}'`)
      const want = originalBatch === null ? '<NULL>' : originalBatch
      check(nowBatch === want, '还原：商品的绑定回到开场状态', `${nowBatch}（开场 ${want}）`)
    }
  }
}

console.log(`\n失败 ${failures.length} 项`)
process.exit(failures.length > 0 ? 1 : 0)
