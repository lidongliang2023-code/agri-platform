/**
 * 「新增库存」页面表单 → 落库 的端到端验证
 *
 * <p>除了"能不能存进去"，这里还专门验一条**容易骗人的交互**：
 * 表单上「关联采收记录」标的是可选（无 required），但后端 `agri_prod_inventory.batch_id`
 * 是 NOT NULL —— 用户不选这一项就点保存，到底会怎样？脚本两条路径都跑一遍，
 * 把"能不能给出可理解的提示"也纳入判据。</p>
 *
 * 用法：
 *   node scripts/e2e-inventory-create-ui.mjs [--base=http://localhost] [--user=admin] [--keep] [--headful]
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const WORKSPACE = 'C:/Users/71502/.workbuddy-ai/binaries/node/workspace'
const require2 = createRequire(path.join(WORKSPACE, 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const BASE_URL = arg('base', 'http://localhost')
const USER = arg('user', 'admin')
const PASSWORD = arg('password', 'Admin@123')
const KEEP = process.argv.includes('--keep')
const HEADFUL = process.argv.includes('--headful')
const MYSQL_BIN = existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
  : ''

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const mysql = (sql) => {
  if (!MYSQL_BIN) return ''
  try {
    return execFileSync(
      MYSQL_BIN,
      ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', sql],
      { encoding: 'utf8' },
    ).trim()
  } catch (error) {
    return `ERR:${String(error?.message ?? error).slice(0, 100)}`
  }
}

/* ==================== 0) 登录 ==================== */
const login = await (
  await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
  })
).json()
check(login.code === 0, `登录（${USER}）`, `code=${login.code}`)
if (login.code !== 0) process.exit(1)
const token = login.data.accessToken
const AUTH = { Authorization: `Bearer ${token}` }

const farmsRes = await (
  await fetch(`${BASE_URL}/api/v1/production/farms?pageNum=1&pageSize=200`, { headers: AUTH })
).json()
const farm = (farmsRes?.data?.records ?? farmsRes?.data?.list ?? []).find(
  (item) => String(item.farmId) === '1',
)

/* ==================== 1) 浏览器 ==================== */
const executablePath = BROWSER_CANDIDATES.find((item) => existsSync(item))
const browser = await chromium.launch({ headless: !HEADFUL, executablePath, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()
const jsErrors = []
page.on('pageerror', (error) => jsErrors.push(String(error?.message ?? error).slice(0, 200)))

const itemByLabel = (label) =>
  page.locator('.ant-form-item').filter({ has: page.locator(`label:text-is("${label}")`) }).first()

async function fillByLabel(label, value) {
  const input = itemByLabel(label).locator('input, textarea').first()
  await input.click()
  await input.fill(String(value))
  await page.waitForTimeout(150)
}

/**
 * 填 antd DatePicker：点开输入框 → 键入 yyyy-MM-dd → 回车确认。
 *
 * @param label 表单项 label
 * @param date  日期字符串 yyyy-MM-dd
 */
async function fillDateByLabel(label, date) {
  const input = itemByLabel(label).locator('input').first()
  await input.click()
  await input.fill(date)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
}

async function selectByLabel(label, optionText, index = null) {
  await itemByLabel(label).locator('.ant-select-selector').first().click()
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 8000 })
  const options = page.locator(
    '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option',
  )
  if (index === null) {
    await options.filter({ hasText: optionText }).first().click()
  } else {
    await options.nth(index).click()
  }
  await page.waitForTimeout(300)
}

const saveButton = () => page.locator('button.ant-btn').filter({ hasText: /^保\s*存$/ }).first()

const marker = `e2e库存-${Date.now().toString().slice(-8)}`

try {
  await page.goto(`${BASE_URL}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.evaluate(async (creds) => {
    try {
      await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(creds),
      })
    } catch {
      /* ignore */
    }
  }, { username: USER, password: PASSWORD, marketId: 1 })
  await page.addInitScript(
    (state) => {
      try {
        localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
        localStorage.setItem('agri_roles', JSON.stringify(state.roles))
        localStorage.setItem('agri_permissions', JSON.stringify([]))
        localStorage.setItem('agri_market_id', '1')
        if (state.farm) localStorage.setItem('agri_current_farm', JSON.stringify(state.farm))
      } catch {
        /* ignore */
      }
    },
    {
      userInfo: login.data.user ?? {},
      roles: login.data.user?.roles ?? login.data.roles ?? [],
      farm: farm ? { farmId: farm.farmId, farmCode: farm.farmCode, farmName: farm.farmName } : null,
    },
  )

  await page.goto(`${BASE_URL}/production/harvests/inventory/create`, {
    waitUntil: 'networkidle',
    timeout: 60000,
  })
  await page.waitForTimeout(1200)
  const pageText = await page.evaluate(() => document.body.innerText)
  check(pageText.includes('新增库存'), '「新增库存」页已打开')

  /* ---------- 路径 A：不选「关联采收记录」就保存 ---------- */
  await fillByLabel('品名', `E2E库存品-${marker}`)
  await selectByLabel('仓库', '', 0)
  await fillByLabel('入库数量', 50)
  // 「保质期至」是必填（rules required），但关联采收记录不会带出它，必须手填
  await fillDateByLabel('保质期至', '2027-06-30')
  await saveButton().click()
  await page.waitForTimeout(2200)
  const stayedOnPage = page.url().includes('/inventory/create')
  const toastText = await page.evaluate(
    () => [...document.querySelectorAll('.ant-message-notice-content')].map((e) => e.innerText).join(' || '),
  )
  const explainText = await page.evaluate(
    () =>
      [...document.querySelectorAll('.ant-form-item-has-error')]
        .map((e) => `${e.querySelector('label')?.innerText}: ${e.querySelector('.ant-form-item-explain-error')?.innerText ?? ''}`)
        .join(' | '),
  )
  check(
    stayedOnPage || toastText.length > 0,
    '未选关联采收记录时不会假装成功（停留本页或给出失败提示）',
    `toast=${toastText || '(无)'}${explainText ? ` / 校验=${explainText}` : ''}`,
  )
  // 2026-10-28 起该字段改为表单必填：应当在**前端**就拦下，而不是发一次请求再被后端拒
  check(
    explainText.includes('请选择关联采收记录'),
    '未选关联记录时由前端校验直接拦下（不再打一次接口）',
    explainText || '(无内联校验提示)',
  )

  /* ---------- 路径 B：选上关联采收记录再保存 ---------- */
  if (!stayedOnPage) {
    // 上一轮已跳走，重新进页面
    await page.goto(`${BASE_URL}/production/harvests/inventory/create`, {
      waitUntil: 'networkidle',
      timeout: 60000,
    })
    await page.waitForTimeout(1200)
  }
  await selectByLabel('关联采收记录', '', 0)
  await page.waitForTimeout(600)
  // 选了批次只会自动带出品名/品类/数量/单位/等级，「仓库」仍是空的（必填）——
  // 少了这一步就会卡在"请完整填写必填项后再提交"
  await selectByLabel('仓库', '', 0)
  // 再显式覆盖品名与数量，便于按标记定位
  await fillByLabel('品名', `E2E库存品-${marker}`)
  await fillByLabel('入库数量', 88)
  await fillDateByLabel('保质期至', '2027-06-30')
  await fillByLabel('备注', marker)
  await saveButton().click()
  await page.waitForTimeout(2800)

  const afterSave = await page.evaluate(() => document.body.innerText)
  const successHit = /已创建|库存\s*\d+\s*已创建/.test(afterSave)
  check(successHit, '提交后出现成功提示', (afterSave.match(/库存[^\n]*已创建/) ?? [''])[0])
  check(
    page.url().includes('/harvests/inventory') && !page.url().includes('/create'),
    '提交后跳转到库存列表',
    page.url().replace(BASE_URL, ''),
  )
  check(jsErrors.length === 0, '页面无 JS 运行时错误', jsErrors.slice(0, 2).join(' | '))

  /* ---------- 落库复核 ---------- */
  const listRes = await (
    await fetch(`${BASE_URL}/api/v1/production/harvests/inventory?pageNum=1&pageSize=50`, { headers: AUTH })
  ).json()
  const rows = listRes?.data?.records ?? listRes?.data?.list ?? []
  const hit = rows.find((row) => String(row.remark ?? '').includes(marker))
  check(Boolean(hit), '库存列表能查到刚创建的记录（按备注标记定位）',
    hit ? `inventoryId=${hit.inventoryId}` : `列表 ${rows.length} 条均无标记`)

  if (hit) {
    check(Number(hit.currentQty) === 88, '库内数量与表单填写值一致', `填 88 / 回查 ${hit.currentQty}`)
    const row = mysql(
      `SELECT id,batch_id,current_qty,warehouse_name,tenant_id FROM agri_production.agri_prod_inventory WHERE id=${hit.inventoryId}`,
    )
    check(row.startsWith(String(hit.inventoryId)), '库存记录已落库（直连 MySQL 复核）', row)
    const alive = mysql(
      `SELECT COUNT(*) FROM agri_production.agri_prod_inventory WHERE id=${hit.inventoryId} AND deleted=0`,
    )
    check(alive === '1', '库存记录未被逻辑删除（deleted=0）', `count=${alive}`)

    if (!KEEP) {
      const delRes = await fetch(
        `${BASE_URL}/api/v1/production/harvests/inventory/${hit.inventoryId}`,
        { method: 'DELETE', headers: AUTH },
      ).then((r) => r.json())
      console.log(`\n清理：库存 ${hit.inventoryId} delete code=${delRes?.code}`)
    } else {
      console.log(`\n已保留：库存 ${hit.inventoryId}`)
    }
  }
} catch (error) {
  check(false, '浏览器流程异常', String(error?.message ?? error).slice(0, 200))
} finally {
  await browser.close()
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log(`  - ${item}`))
process.exit(1)
