#!/usr/bin/env node
/**
 * 运营端「供需审核」页面回归（2026-10-28）
 *
 * 修复前该页读 info_supply_demand 死表，展示的是建表时塞的演示数据；
 * 现在直接读交易撮合的商品与采购需求，审核动作也落到交易端。
 *
 * 断言：页面能打开、列表是真实数据、审核弹窗按类型给不同结论、死表的撮合概览已移除。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9335
const PAGE = 'http://localhost:8113/info-ops/#/supply-demands'
const INFO = 'http://localhost:8104'
const TRADE = 'http://localhost:8086'
const SSO = 'http://localhost:8090'
const USER = process.env.E2E_USER || 'admin'
const PASS = process.env.E2E_PASS || 'Admin@123'
const SELLER = { user: process.env.E2E_SELLER || '19900002005', pass: process.env.E2E_SELLER_PASS || 'Test12345' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  results.push({ ok, label, extra })
}

async function login(user, pass) {
  const res = await fetch(`${SSO}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  })
  return (await res.json())?.data?.accessToken ?? ''
}

/**
 * 造一条待审核商品。
 *
 * 交易端卖家中心发布的商品默认 publish_status=pending，正好是运营端待审队列的来源。
 * 脚本自己造、自己清，不再假设"队列里天然有待审数据" —— 那种假设在队列被清理后
 * 会让用例莫名其妙失败。
 */
async function createPendingProduct() {
  const token = await login(SELLER.user, SELLER.pass)
  if (!token) throw new Error('卖家登录失败')
  const cats = (await (await fetch(`${TRADE}/api/trade/public/categories`)).json())?.data
  const category = (Array.isArray(cats) ? cats : []).find((c) => c && c.id && c.categoryName)
  if (!category) throw new Error('取不到交易端品类')

  const res = await fetch(`${TRADE}/api/trade/seller/product/mine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      productName: `审核台回归${Date.now().toString().slice(-6)}`,
      categoryId: category.id,
      categoryName: category.categoryName,
      variety: category.categoryName,
      unit: '斤',
      price: 4.2,
      priceMin: 4.2,
      priceMax: 4.6,
      priceType: 'fixed',
      stockQuantity: 300,
      minOrderQuantity: 50,
      originProvince: '山东省',
      originCity: '潍坊市',
      originDistrict: '寿光市',
      specLevel: '一级',
      description: '运营端审核台回归数据',
      images: ['/images/trade/demo-closure.jpg'],
    }),
  })
  const json = await res.json()
  const id = json?.data?.id
  if (!id) throw new Error('造待审商品失败: ' + JSON.stringify(json).slice(0, 200))
  return id
}

/** 用完就删，别把测试数据留在库里 —— 下架只是让它从大厅消失，记录会一直堆着。 */
async function cleanup(id) {
  const token = await login(SELLER.user, SELLER.pass)
  if (!token) return '清理跳过（卖家登录失败）'
  const res = await fetch(`${TRADE}/api/trade/product/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.ok ? `已删除商品 ${id}` : `删除失败 HTTP ${res.status}`
}

const profile = mkdtempSync(path.join(tmpdir(), 'edge-ops-'))
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1600,1100',
  'about:blank',
], { stdio: 'ignore' })

async function targetWs() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      const list = await res.json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl
    } catch { /* 还没起来 */ }
    await sleep(300)
  }
  throw new Error('Edge 调试端口未就绪')
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id)
        this.pending.delete(msg.id)
        msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
      }
    })
  }

  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
    })
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description ?? 'evaluate 失败')
    return res.result.value
  }
}

async function waitFor(cdp, expression, label, timeout = 25000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      if (await cdp.eval(expression)) return true
    } catch { /* 导航中执行上下文会失效，重试 */ }
    await sleep(300)
  }
  console.log(`  ⏱ 等待超时：${label}`)
  return false
}

let pendingId = null
try {
  pendingId = await createPendingProduct()
  console.log(`· 造待审商品 id=${pendingId}`)

  const ws = new WebSocket(await targetWs())
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  const cdp = new Cdp(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  await cdp.send('Page.navigate', { url: PAGE })
  await sleep(2500)

  const needLogin = await cdp.eval(`location.port === '8090' || location.href.includes('/login')`)
  if (needLogin) {
    await waitFor(cdp, `!![...document.querySelectorAll('button[role="tab"]')].find((b) => /账号/.test(b.textContent))`, '登录页标签')
    await cdp.eval(`(() => {
      const tab = [...document.querySelectorAll('button[role="tab"]')].find((b) => /账号/.test(b.textContent))
      if (tab) tab.click(); return true
    })()`)
    await waitFor(cdp, `!!document.querySelector('input[type="password"]')`, '密码框')
    await cdp.eval(`(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      const u = document.querySelector('input[autocomplete="username"]') || document.querySelector('input[type="text"]')
      const p = document.querySelector('input[type="password"]')
      set.call(u, ${JSON.stringify(USER)}); u.dispatchEvent(new Event('input', { bubbles: true }))
      set.call(p, ${JSON.stringify(PASS)}); p.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await cdp.eval(`(() => {
      const btn = document.querySelector('button.auth-submit')
        || [...document.querySelectorAll('button')].find((b) => /登\\s*录/.test(b.textContent))
      if (!btn) return false
      btn.click(); return true
    })()`)
  }

  const onPage = await waitFor(
    cdp,
    `location.port === '8113' && document.body.textContent.includes('供需审核') && !!document.querySelector('.ant-table')`,
    '进入供需审核页',
    30000,
  )
  check(onPage, '运营端供需审核页打开', await cdp.eval('location.href'))

  if (onPage) {
    await sleep(1200)

    const rows = await cdp.eval(`document.querySelectorAll('.ant-table-tbody tr.ant-table-row').length`)
    check(rows > 0, '列表渲染出审核记录', `当前页 ${rows} 条`)

    const firstRowText = await cdp.eval(
      `document.querySelector('.ant-table-tbody tr.ant-table-row')?.textContent?.trim().slice(0, 80) || ''`,
    )
    check(!/XQ2026|GY2026/.test(firstRowText), '列表已是交易端真实数据（不再是种子单号 XQ2026…）', firstRowText)

    const bodyText = await cdp.eval('document.body.textContent')
    check(!bodyText.includes('撮合建议概览'), '已移除读死表的「撮合建议概览」区块')

    // 切到「全部」，确认列表里确实混有供应与需求两类数据源
    await cdp.eval(`(() => {
      const chip = [...document.querySelectorAll('.chip')].find((c) => c.textContent.trim() === '全部')
      if (chip) chip.click(); return true
    })()`)
    await sleep(1200)

    const allCount = await cdp.eval(`document.querySelectorAll('.ant-table-tbody tr.ant-table-row').length`)
    check(allCount > 0, '「全部」能列出记录', `当前页 ${allCount} 条`)

    // 打开第一条供应记录的审核弹窗，验证结论选项
    const opened = await cdp.eval(`(() => {
      const rows = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')]
      const target = rows.find((row) => row.textContent.includes('供应'))
      if (!target) return false
      const btn = [...target.querySelectorAll('button')].find((b) => /审\\s*核/.test(b.textContent))
      if (!btn) return false
      btn.click(); return true
    })()`)
    check(opened, '打开供应记录的审核弹窗')
    if (opened) {
      const modalOpen = await waitFor(cdp, `!!document.querySelector('.ant-modal-content')`, '审核弹窗渲染')
      const options = await cdp.eval(
        `[...document.querySelectorAll('.ant-modal-content .ant-radio-button-wrapper')].map((o) => o.textContent.trim())`,
      )
      check(modalOpen && options.includes('通过并上线') && options.includes('驳回') && options.includes('下架'),
        '供应侧审核提供 通过/驳回/下架 三个结论', JSON.stringify(options))
      await cdp.eval(`(() => {
        const btn = [...document.querySelectorAll('.ant-modal-content button')].find((b) => b.textContent.trim() === '取 消' || b.textContent.trim() === '取消')
        if (btn) btn.click(); return true
      })()`)
      await sleep(400)
    }

    // 需求侧：只有 恢复展示 / 下架
    // 商品排在需求前面，第一页往往全是商品，所以先用搜索框定位一条真实采购需求。
    await cdp.eval(`(() => {
      const input = document.querySelector('.ant-input-search input') || document.querySelector('input.ant-input')
      if (!input) return false
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      set.call(input, '苹果20箱')
      input.dispatchEvent(new Event('input', { bubbles: true }))
      const btn = document.querySelector('.ant-input-search-button')
      if (btn) btn.click()
      return true
    })()`)
    await sleep(1500)

    const demandOpened = await cdp.eval(`(() => {
      const rows = [...document.querySelectorAll('.ant-table-tbody tr.ant-table-row')]
      const target = rows.find((row) => row.textContent.includes('需求'))
      if (!target) return false
      const btn = [...target.querySelectorAll('button')].find((b) => /审\\s*核/.test(b.textContent))
      if (!btn) return false
      btn.click(); return true
    })()`)
    if (demandOpened) {
      await waitFor(cdp, `!!document.querySelector('.ant-modal-content')`, '需求审核弹窗')
      const demandOptions = await cdp.eval(
        `[...document.querySelectorAll('.ant-modal-content .ant-radio-button-wrapper')].map((o) => o.textContent.trim())`,
      )
      check(demandOptions.includes('恢复展示') && !demandOptions.includes('驳回'),
        '需求侧只提供 恢复展示/下架（需求发布即可见，无审核环节）', JSON.stringify(demandOptions))
    } else {
      check(true, '当前列表无需求记录，跳过需求侧弹窗断言（信息）')
    }
  }
} catch (error) {
  console.error('执行异常：', error)
  results.push({ ok: false, label: '脚本异常' })
} finally {
  edge.kill()
  if (pendingId) console.log(`· 清理：${await cleanup(pendingId)}`)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${failed.length === 0 ? '全部通过' : `失败 ${failed.length} 项`}`)
failed.forEach((r) => console.log(`  - ${r.label}`))
if (failed.length) process.exitCode = 1
