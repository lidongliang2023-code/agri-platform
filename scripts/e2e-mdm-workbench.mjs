/**
 * 主数据 · 企业工作台 端到端验证（重构后）
 *
 * 这一页重构前是"只读看板"：组织/成员/商品/客户一个都没接，顶部还挂着"后端尚未提供"。
 * 重构后接的是 `/api/user/**`（按主体隔离），并新增了可落库的写操作。
 *
 * 因此本脚本的重点不是"页面能打开"，而是**页面上的动作真的写进了数据库**：
 *   1. 统计卡与后端 tenant-summary 一致（不是写死的数字）
 *   2. 在页面上新增客户 → 直连 MySQL 确认落库、tenant_id 正确、编码自动生成
 *   3. 在页面上编辑 → 直连 MySQL 确认字段变了
 *   4. 在页面上删除 → 直连 MySQL 确认 del_flag=1，且列表不再显示
 *   5. 主体联系信息保存 → 直连 MySQL 确认落库
 *   6. 归属校验：改别家主体的客户应被拒绝（不是"能改但没生效"）
 *   7. 页面无 JS 错误；结束后清理本次测试数据
 *
 * 用法：node scripts/e2e-mdm-workbench.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const MYSQL = existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
  : ''

/** 直连数据库核对（断言"真的落库"的唯一可靠方式） */
const sql = (query) => {
  if (!MYSQL) return ''
  try {
    return execFileSync(
      MYSQL,
      ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query],
      { encoding: 'utf8' },
    ).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 80)}`
  }
}

const BASE = 'http://localhost:8080'
const MERCHANT = '2001'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const PASSWORD = (() => {
  try {
    const src = readFileSync('scripts/e2e-mdm-sso-loop.mjs', 'utf8')
    return src.match(/登录密码"\]'\)\.first\(\)\.fill\('([^']+)'\)/)[1]
  } catch {
    return ''
  }
})()

const MARK = `工作台验证${Date.now().toString().slice(-6)}`
const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1560, height: 1000 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

let createdId = ''
const text = async () => (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')

try {
  /* ---------- 登录并进入工作台 ---------- */
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2500)
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click({ timeout: 10000 })
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(5500)
  check(!page.url().includes(':8090'), '统一认证登录成功', page.url().replace('http://localhost', ''))

  await page.goto(`${BASE}/user/workbench`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(3000)
  let body = await text()
  check(body.includes('企业工作台'), '「企业工作台」已打开')
  check(!/加载失败|请求失败/.test(body), '页面无加载失败提示',
    (body.match(/加载失败|请求失败/) ?? [''])[0])

  /* ---------- 1) 统计卡与后端一致（不是写死数字） ---------- */
  const summaryRes = await page.evaluate(async (merchant) => {
    const tok = (await (await fetch('/api/v1/auth/refresh', {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' }, body: '{}',
    })).json())?.data?.accessToken ?? ''
    const res = await fetch('/api/user/tenant-summary', {
      credentials: 'include',
      headers: { Authorization: `Bearer ${tok}`, 'X-Agri-Merchant': merchant },
    })
    const j = await res.json().catch(() => null)
    return { code: j?.code, data: j?.data }
  }, MERCHANT)
  check(summaryRes.code === 200, '后端 tenant-summary 可用', `code=${summaryRes.code}`)

  const counts = summaryRes.data ?? {}
  for (const [label, key] of [['组织', 'orgCount'], ['成员', 'memberCount'], ['商品 SPU', 'productCount'], ['客户', 'customerCount']]) {
    const expected = Number(counts[key] ?? 0)
    const matched = new RegExp(`${label}\\s*${expected}(?!\\d)`).test(body)
    check(matched, `统计卡「${label}」= ${expected}（与后端一致）`, matched ? '' : '页面数字与后端不符')
  }

  /* ---------- 2) 页面新增客户 → 真落库 ---------- */
  await page.locator('button', { hasText: '+ 新增客户' }).first().click()
  await page.waitForTimeout(600)
  check((await text()).includes('新增客户'), '打开新增客户弹窗')

  await page.locator('.wb-dialog input').first().fill(MARK)
  await page.locator('.wb-dialog input').nth(2).fill('李四')
  await page.locator('.wb-dialog input').nth(3).fill('13700003333')
  await page.locator('.wb-dialog button', { hasText: '保存' }).first().click()
  await page.waitForTimeout(2500)

  const dbRow = sql(
    `SELECT id,customer_code,customer_name,tenant_id,del_flag,contact_name,contact_phone ` +
    `FROM agri_masterdata.agri_md_customer WHERE customer_name='${MARK}' ORDER BY id DESC LIMIT 1`,
  )
  check(Boolean(dbRow) && dbRow.startsWith('9') || /^\d+\t/.test(dbRow), '页面新增的客户已落库', dbRow || '(无记录)')
  const cols = dbRow.split('\t')
  createdId = cols[0] ?? ''
  check(cols[3] === MERCHANT, 'tenant_id 由服务端写成当前主体', `tenant_id=${cols[3]}`)
  check(/^CUS2001-\d{3}$/.test(cols[1] ?? ''), '客户编码自动生成', `code=${cols[1]}`)
  check(cols[4] === '0', 'del_flag=0（有效记录）', `del_flag=${cols[4]}`)
  check(cols[5] === '李四' && cols[6] === '13700003333', '联系人/电话正确落库', `${cols[5]} / ${cols[6]}`)

  body = await text()
  check(body.includes(MARK), '新增后列表立即出现该客户')

  /* ---------- 3) 页面编辑 → 真落库 ---------- */
  const targetRow = page.locator('tr', { hasText: MARK }).first()
  await targetRow.locator('button', { hasText: '编辑' }).click()
  await page.waitForTimeout(600)
  const phoneInput = page.locator('.wb-dialog input').nth(3)
  await phoneInput.fill('13900004444')
  await page.locator('.wb-dialog button', { hasText: '保存' }).first().click()
  await page.waitForTimeout(2500)
  const phoneInDb = sql(`SELECT contact_phone FROM agri_masterdata.agri_md_customer WHERE id=${createdId}`)
  check(phoneInDb === '13900004444', '页面编辑已落库（电话已更新）', `db=${phoneInDb}`)

  /* ---------- 4) 主体联系信息保存 → 真落库 ---------- */
  const orgId = await page.evaluate(() => {
    const sel = document.querySelector('.wb-card select, select.wb-input')
    return sel ? sel.value : ''
  })
  if (orgId) {
    const before = sql(`SELECT IFNULL(contact_person,'') FROM agri_masterdata.agri_md_organization WHERE id=${orgId}`)
    const personInput = page.locator('.mds-card', { hasText: '主体联系信息' }).locator('input').first()
    await personInput.fill(`联系人${MARK.slice(-4)}`)
    await page.locator('button', { hasText: '保存联系信息' }).first().click()
    await page.waitForTimeout(2200)
    const after = sql(`SELECT IFNULL(contact_person,'') FROM agri_masterdata.agri_md_organization WHERE id=${orgId}`)
    check(after === `联系人${MARK.slice(-4)}`, '主体联系信息已落库', `${before} → ${after}`)
    // 还原，别把演示库的组织联系人改成测试值
    if (before !== after) sql(`UPDATE agri_masterdata.agri_md_organization SET contact_person='${before}' WHERE id=${orgId}`)
  } else {
    check(false, '主体联系信息：未取到组织下拉框')
  }

  /* ---------- 5) 归属校验：别家客户改不动 ---------- */
  const otherId = sql(
    "SELECT id FROM agri_masterdata.agri_md_customer WHERE tenant_id IS NOT NULL AND tenant_id<>'2001' AND del_flag=0 LIMIT 1",
  )
  if (otherId) {
    const denied = await page.evaluate(async ({ merchant, id }) => {
      const tok = (await (await fetch('/api/v1/auth/refresh', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' }, body: '{}',
      })).json())?.data?.accessToken ?? ''
      const res = await fetch(`/api/user/customers/${id}`, {
        method: 'PUT', credentials: 'include',
        headers: { Authorization: `Bearer ${tok}`, 'X-Agri-Merchant': merchant, 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactName: '越权改名' }),
      })
      const j = await res.json().catch(() => null)
      return { code: j?.code, msg: j?.message }
    }, { merchant: MERCHANT, id: otherId })
    check(denied.code !== 200, '改别家主体的客户被拒绝', `code=${denied.code} ${denied.msg ?? ''}`)
  } else {
    console.log('· 跳过归属校验：库里没有别家主体的客户可测')
  }

  /* ---------- 6) 页面删除 → 真落库（逻辑删除） ---------- */
  const rowAgain = page.locator('tr', { hasText: MARK }).first()
  await rowAgain.locator('button', { hasText: '删除' }).click()
  await page.waitForTimeout(600)
  await page.locator('.wb-dialog button', { hasText: '确认删除' }).first().click()
  await page.waitForTimeout(2500)
  const delFlag = sql(`SELECT del_flag FROM agri_masterdata.agri_md_customer WHERE id=${createdId}`)
  check(delFlag === '1', '页面删除已落库（del_flag=1）', `del_flag=${delFlag}`)
  body = await text()
  check(!body.includes(MARK), '删除后列表不再显示该客户')

  /* ---------- 7) 最近操作有留痕 ---------- */
  await page.waitForTimeout(800)
  body = await text()
  check(body.includes('最近操作'), '页面有「最近操作」区块')
  const logCount = sql(
    `SELECT COUNT(*) FROM agri_masterdata.agri_md_operation_log WHERE create_time >= NOW() - INTERVAL 10 MINUTE`,
  )
  check(Number(logCount) > 0, '写操作已写入操作日志表', `近 10 分钟 ${logCount} 条`)

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  await browser.close()
  /* 清理：测试客户整行删除（逻辑删除的记录也清掉，避免堆在演示库） */
  if (createdId) sql(`DELETE FROM agri_masterdata.agri_md_customer WHERE id=${createdId}`)
  sql(`DELETE FROM agri_masterdata.agri_md_customer WHERE customer_name LIKE '${MARK}%'`)
}

console.log('')
const left = sql(`SELECT COUNT(*) FROM agri_masterdata.agri_md_customer WHERE customer_name LIKE '${MARK}%'`)
console.log(`清理：残留测试客户 ${left} 条（应为 0）`)
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
