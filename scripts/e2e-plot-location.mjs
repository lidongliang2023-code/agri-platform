#!/usr/bin/env node
/**
 * 联调：PC 端「新增地块」页的位置字段**真的落库了吗**。
 *
 * <p>背景（2026-10-17）：这个页面过去把经度/纬度/边界打包成一个自造的 `geoBoundary` 键提交，
 * 而后端 `PlotSaveDTO` 只认 `centerLongitude` / `centerLatitude` / `boundary` —— 结果是
 * **填了位置也一直没落库**，编辑回填永远是空（后端返回的是 `boundary`，页面却读 `geoBoundary`）。
 * 修复后本脚本盯两件事：① 表单提交的请求体里出现真实字段；② MySQL 里中心点与边界都有值。</p>
 *
 * 用法：node scripts/e2e-plot-location.mjs [--base=http://localhost] [--headful]
 * 退出码：0 = 全绿；1 = 有断言失败。
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
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
const HEADFUL = process.argv.includes('--headful')
const MYSQL_BIN = existsSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe')
  ? 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
  : ''

const stamp = Date.now().toString().slice(-6)
const plotName = `联调地块位置-${stamp}`
const longitude = 113.6123
const latitude = 23.5234

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const mysqlQuery = (sql) => {
  if (!MYSQL_BIN) return null
  try {
    return execFileSync(
      MYSQL_BIN,
      ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', sql],
      { encoding: 'utf8' },
    ).trim()
  } catch (err) {
    return `SQL_ERROR ${String(err?.stderr ?? err).slice(0, 120)}`
  }
}

const login = await (await fetch(`${BASE_URL}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: USER, password: PASSWORD, marketId: 1 }),
})).json()
check(login.code === 0, '登录')
const token = login.data.accessToken

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1600, height: 1000 })
/** 捕获页面发出的新建地块请求体（这是本脚本的核心证据） */
let createBody = ''
const badResponses = []
page.on('request', (req) => {
  if (req.method() === 'POST' && /\/api\/v1\/production\/plots$/.test(req.url())) {
    createBody = req.postData() ?? ''
  }
})
page.on('response', (res) => {
  if (res.url().includes('/api/v1/') && res.status() >= 400) {
    badResponses.push(`${res.status()} ${res.request().method()} ${res.url().replace(BASE_URL, '')}`)
  }
})

let plotId = ''
try {
  // 种 Cookie + 界面态（与其它 e2e 一致）
  await page.goto(`${BASE_URL}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.evaluate(async (creds) => {
    await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(creds),
    })
  }, { username: USER, password: PASSWORD, marketId: 1 })
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('agri_user_info', JSON.stringify({ username: 'farmer', realName: '张农户' }))
      localStorage.setItem('agri_roles', JSON.stringify(['FARMER']))
      localStorage.setItem('agri_permissions', JSON.stringify([]))
      localStorage.setItem('agri_market_id', '1')
      localStorage.setItem(
        'agri_current_farm',
        JSON.stringify({ farmId: '1', farmName: '【演示】华南绿色蔬菜示范农场' }),
      )
    } catch {
      /* 忽略 */
    }
  })

  await page.goto(`${BASE_URL}/production/plots/create`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('#plotName', { timeout: 20000 })
  await sleep(800)

  const setInput = async (selector, value) => {
    const ok = await page.evaluate(
      ({ sel, val }) => {
        const input = document.querySelector(sel)
        if (!input) return false
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
        setter.call(input, String(val))
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
        return true
      },
      { sel: selector, val: value },
    )
    if (!ok) throw new Error(`未找到输入框 ${selector}`)
  }

  /**
   * 选 antd Select 的一项（所属农场必填，不选的话点保存只会弹校验错误、请求根本不会发）。
   *
   * @param selectSelector 选择器（antd 的搜索输入框，如 #farmId）
   * @param text 选项文案（含匹配即可；传空则取第一项）
   */
  const pickSelect = async (selectSelector, text) => {
    await page.click(selectSelector)
    await page
      .waitForSelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option', {
        timeout: 10000,
      })
      .catch(() => {})
    const picked = await page.evaluate((label) => {
      const dropdowns = [...document.querySelectorAll('.ant-select-dropdown')].filter(
        (el) => !el.classList.contains('ant-select-dropdown-hidden'),
      )
      const options = dropdowns.flatMap((el) => [...el.querySelectorAll('.ant-select-item-option')])
      const hit = options.find((el) => (el.textContent ?? '').includes(label)) ?? options[0]
      if (!hit) return ''
      hit.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
      hit.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      return (hit.textContent ?? '').trim()
    }, text)
    if (!picked) throw new Error(`「${selectSelector}」的下拉里没有选项`)
    await sleep(500)
    return picked
  }

  const farmText = await pickSelect('#farmId', '农场')
  check(Boolean(farmText), '已选择所属农场', farmText)
  await setInput('#plotName', plotName)
  await setInput('#area', 3.3)
  await setInput('#longitude', longitude)
  await setInput('#latitude', latitude)
  await sleep(400)
  const validationErrors = await page.evaluate(() =>
    [...document.querySelectorAll('.ant-form-item-explain-error')].map((el) => el.textContent.trim()),
  )
  check(validationErrors.length === 0, '提交前表单没有校验错误', validationErrors.join(' / '))
  check(true, '已填写地块名称 / 面积 / 经度 / 纬度')

  // 保存（页面底部「保存」按钮）
  const clicked = await page.evaluate(() => {
    const norm = (s) => (s ?? '').replace(/\s+/g, '')
    const btn = [...document.querySelectorAll('button')].find((b) => norm(b.textContent) === '保存')
    if (!btn) return false
    btn.click()
    return true
  })
  check(clicked, '点了「保存」')
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 20000 }).catch(() => {})
  await sleep(2000)

  // ① 请求体：必须出现真实字段，且不再出现自造的 geoBoundary
  check(Boolean(createBody), '页面发出了 POST /plots', createBody.slice(0, 120))
  const payload = createBody ? JSON.parse(createBody) : {}
  check(Number(payload.centerLongitude) === longitude, '请求体带 centerLongitude', String(payload.centerLongitude))
  check(Number(payload.centerLatitude) === latitude, '请求体带 centerLatitude', String(payload.centerLatitude))
  check(!('geoBoundary' in payload), '请求体不再出现后端不认的 geoBoundary 键')
  check(Boolean(payload.boundary), '请求体带 boundary（GeoJSON）', String(payload.boundary ?? '').slice(0, 60))

  // ② 落库：按唯一名称查出主键，核对经纬度
  const rows = await (await fetch(`${BASE_URL}/api/v1/production/plots?farmId=1&pageNum=1&pageSize=200`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json()
  const hit = (rows?.data?.records ?? []).find((row) => row.plotName === plotName)
  plotId = hit ? String(hit.id ?? hit.plotId) : ''
  check(Boolean(plotId), '按名称查回新建的地块', `id=${plotId}`)
  if (plotId) {
    const detail = await (await fetch(`${BASE_URL}/api/v1/production/plots/${plotId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })).json()
    check(Number(detail?.data?.centerLongitude) === longitude, '详情接口回显经度', String(detail?.data?.centerLongitude))
    check(Number(detail?.data?.centerLatitude) === latitude, '详情接口回显纬度', String(detail?.data?.centerLatitude))
  }
  if (MYSQL_BIN && plotId) {
    const db = mysqlQuery(
      `SELECT center_longitude, center_latitude, boundary FROM agri_production.agri_prod_plot_info WHERE id = ${plotId};`,
    )
    const cells = String(db ?? '').split(/\s+/)
    check(Number(cells[0]) === longitude, 'MySQL 里 center_longitude 落了', `lng=${cells[0]}`)
    check(Number(cells[1]) === latitude, 'MySQL 里 center_latitude 落了', `lat=${cells[1]}`)
    check(Boolean(cells[2]) && cells[2] !== 'NULL', 'MySQL 里 boundary 落了', String(cells[2] ?? '').slice(0, 40))
  }
  check(badResponses.length === 0, '没有意外的 4xx/5xx', badResponses.slice(0, 2).join(' | '))
} finally {
  if (plotId) {
    try {
      await fetch(`${BASE_URL}/api/v1/production/plots/${plotId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      check(true, '清理：删除本轮造的地块')
    } catch (err) {
      check(false, '清理：删除本轮造的地块', String(err))
    }
  }
  await browser.close()
}

console.log(`\n== 地块位置落库联调：${plotName}（${longitude}, ${latitude}），失败 ${failures.length} 项 ==`)
process.exit(failures.length === 0 ? 0 : 1)
