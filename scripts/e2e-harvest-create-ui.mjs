/**
 * 「新建采收」页面表单 → 落库 的端到端验证（真开浏览器填表提交）
 *
 * <p>为什么接口 e2e（`e2e-harvest-inventory.mjs`）还不够：接口通只证明后端逻辑对，
 * 页面可能压根没把表单值组装进去、必填校验挡死、或者提交后提示成功但其实没落库。
 * 这一层只有真开浏览器点一次才能证。</p>
 *
 * <p>判据：</p>
 * <ol>
 *   <li>表单能填完并提交（出现成功提示，而不是校验警告/错误 toast）</li>
 *   <li>提交后列表接口能查到这条新批次（按备注里的唯一标记定位）</li>
 *   <li>直连 MySQL 能查到该行，且 deleted=0、数量与填写值一致</li>
 * </ol>
 *
 * 用法：
 *   node scripts/e2e-harvest-create-ui.mjs [--base=http://localhost] [--user=admin] [--password=...] [--keep] [--headful]
 *   默认跑完清理本次造的批次。
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

/* ==================== 0) 登录 + 农场 ==================== */
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

// 用有地块的农场（演示农场 1）
const plotsRes = await (
  await fetch(`${BASE_URL}/api/v1/production/plots?pageNum=1&pageSize=100&farmId=1`, { headers: AUTH })
).json()
const plots = plotsRes?.data?.records ?? plotsRes?.data?.list ?? []
check(plots.length > 0, '农场 1 下有可用地块', `plots=${plots.length}`)
if (plots.length === 0) process.exit(1)
const plotName = plots[0].plotName

const farmsRes = await (
  await fetch(`${BASE_URL}/api/v1/production/farms?pageNum=1&pageSize=200`, { headers: AUTH })
).json()
const farm = (farmsRes?.data?.records ?? farmsRes?.data?.list ?? []).find(
  (item) => String(item.farmId) === '1',
)

/* ==================== 1) 打开页面 ==================== */
const executablePath = BROWSER_CANDIDATES.find((item) => existsSync(item))
const browser = await chromium.launch({ headless: !HEADFUL, executablePath, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
const page = await context.newPage()

const jsErrors = []
page.on('pageerror', (error) => jsErrors.push(String(error?.message ?? error).slice(0, 200)))

const marker = `e2e表单采收-${Date.now().toString().slice(-8)}`
const quantity = 246.8

/** 按 label 文案定位表单项容器 */
const itemByLabel = (label) =>
  page.locator('.ant-form-item').filter({ has: page.locator(`label:text-is("${label}")`) }).first()

/** 在 antd Select 里选一个选项 */
async function selectByLabel(label, optionText) {
  const item = itemByLabel(label)
  await item.locator('.ant-select-selector').first().click()
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 8000 })
  const option = page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .filter({ hasText: optionText })
    .first()
  await option.click()
  await page.waitForTimeout(250)
}

/** 在 antd Input / TextArea 里填值（备注是 textarea，只找 input 会超时） */
async function fillByLabel(label, value) {
  const item = itemByLabel(label)
  const input = item.locator('input, textarea').first()
  await input.click()
  await input.fill(String(value))
  await page.waitForTimeout(150)
}

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

  await page.goto(`${BASE_URL}/production/harvests/create`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForTimeout(1500)
  const titleText = await page.evaluate(() => document.body.innerText)
  check(titleText.includes('新建采收') || titleText.includes('采收登记'), '「新建采收」页已打开')

  // 逐项填必填：农场 → 地块 → 采收数量 → 采收人 → 质量等级 → 备注
  await selectByLabel('农场名称', farm?.farmName ?? '华南')
  await page.waitForTimeout(500)
  await selectByLabel('地块选择', plotName)
  await fillByLabel('采收数量(kg)', quantity)

  // 采收人：取第一个选项（本农场团队成员）
  const operatorItem = itemByLabel('采收人')
  await operatorItem.locator('.ant-select-selector').first().click()
  await page.waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)', { timeout: 8000 })
  await page
    .locator('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option')
    .first()
    .click()
  await page.waitForTimeout(250)

  await selectByLabel('质量等级', 'A')
  await fillByLabel('备注', marker)

  // 提交。注意：antd 会在两个汉字的按钮文案中间插一个空格（"保 存"），
  // 所以这里用 \s* 兼容，并且用 ^...$ 锚定，避免误点「保存并继续采收」。
  const saveButton = page.locator('button.ant-btn').filter({ hasText: /^保\s*存$/ }).first()
  await saveButton.scrollIntoViewIfNeeded()
  await saveButton.click()
  await page.waitForTimeout(2500)

  // 结果判定：成功 toast / 校验警告 / 错误 toast
  const bodyAfter = await page.evaluate(() => document.body.innerText)
  const successHit = /已提交|已生成|批次\s*H\d+/.test(bodyAfter)
  const validationHit = bodyAfter.includes('请完整填写必填项') || bodyAfter.includes('请选择地块')
  check(!validationHit, '提交未被必填校验挡回')
  check(successHit, '提交后出现成功提示', bodyAfter.match(/采收登记已提交[^\n]*/)?.[0] ?? '')
  check(jsErrors.length === 0, '页面无 JS 运行时错误', jsErrors.slice(0, 2).join(' | '))

  /* ==================== 2) 列表接口回查 ==================== */
  const listRes = await (
    await fetch(`${BASE_URL}/api/v1/production/harvests?pageNum=1&pageSize=20&farmId=1`, { headers: AUTH })
  ).json()
  const rows = listRes?.data?.records ?? listRes?.data?.list ?? []
  const hit = rows.find((row) => String(row.remark ?? '').includes(marker))
  check(Boolean(hit), '列表接口能查到刚提交的批次（按备注标记定位）',
    hit ? `batchNo=${hit.batchNo}` : `列表 ${rows.length} 条均无标记 ${marker}`)
  if (hit) {
    check(Number(hit.quantity) === quantity, '提交数量与回查数量一致',
      `填 ${quantity} / 回查 ${hit.quantity}`)
    const row = mysql(
      `SELECT id,batch_no,plot_id,quantity,deleted,tenant_id FROM agri_production.agri_prod_harvest_batch WHERE id=${hit.batchId}`,
    )
    check(row.startsWith(String(hit.batchId)), '批次已落库（直连 MySQL 复核）', row)
    // 判软删用 COUNT，不要靠"行尾是不是 0"——列顺序一改断言就失效，而且会误判
    const aliveRow = mysql(
      `SELECT COUNT(*) FROM agri_production.agri_prod_harvest_batch WHERE id=${hit.batchId} AND deleted=0`,
    )
    check(aliveRow === '1', '批次未被逻辑删除（deleted=0）', `count=${aliveRow}`)
    check(row.includes(String(quantity)), '库内数量与表单填写值一致', row)

    if (!KEEP) {
      const delRes = await fetch(`${BASE_URL}/api/v1/production/harvests/${hit.batchId}`, {
        method: 'DELETE',
        headers: AUTH,
      }).then((r) => r.json())
      console.log(`\n清理：批次 ${hit.batchNo}（id=${hit.batchId}）delete code=${delRes?.code}`)
    } else {
      console.log(`\n已保留：批次 ${hit.batchNo}（id=${hit.batchId}）`)
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
