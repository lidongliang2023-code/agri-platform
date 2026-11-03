#!/usr/bin/env node
/**
 * 供需详情页「联系方式」回归（2026-10-28）
 *
 * 背景：信息资讯改成跳转交易端发布后，交易端发布的商品不会写 info_sd_contact，
 * 详情页原来会渲染成「某某公司 · 」（尾随一个空电话），点"查看联系方式"弹出一串空白。
 *
 * 现在：
 *   - 有电话：正常展示，按钮可点
 *   - 无电话：明确写"未公开电话，请通过站内沟通联系"，按钮置灰
 *   - 信息资讯自己发布的老数据，电话能从商品描述的「联系人：x　电话：x」里兜底解析回来
 *
 * 依赖两条已知数据：7015（交易端发布，无电话）、7049（信息端发布，有电话）。
 * 用法：node scripts/e2e-info-sd-detail-contact.mjs
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9337
const BASE = 'http://localhost:8104/info/#/sd-detail/'
const INFO = 'http://localhost:8104'
const TRADE = 'http://localhost:8086'
const SSO = 'http://localhost:8090'
const USER = process.env.E2E_USER || '19900002005'
const PASS = process.env.E2E_PASS || 'Test12345'

/** 卖家中心直接发布、没有 info_sd_contact 记录的历史样本；失效时跳过该场景。 */
const TRADE_ONLY = 7015
const PHONE = '13900001111'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  results.push({ ok, label, extra })
}
const skip = (label, why) => console.log(`- 跳过 ${label}（${why}）`)

/**
 * 造一条「信息资讯端发布、描述里带电话」的商品。
 *
 * 原来这里硬编码 7049，那条数据一旦被清掉脚本就永远失败 —— 测试不该依赖
 * 某个历史行号，自己造自己验。
 */
async function createInfoPosted() {
  const loginRes = await fetch(`${SSO}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USER, password: PASS }),
  })
  const token = (await loginRes.json())?.data?.accessToken
  if (!token) throw new Error('登录失败，无法造测试数据')

  const catRes = await fetch(`${TRADE}/api/trade/public/categories`)
  const cats = (await catRes.json())?.data
  const category = (Array.isArray(cats) ? cats : []).find((c) => c && c.id && c.categoryName)
  if (!category) throw new Error('取不到交易端品类，无法造测试数据')

  const res = await fetch(`${INFO}/api/v1/info/supply-demands`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'X-Agri-User': encodeURIComponent(USER),
    },
    body: JSON.stringify({
      sdType: 'supply',
      title: `联系方式回归${Date.now().toString().slice(-6)}`,
      category: category.categoryName,
      quantity: '500斤',
      price: 12.5,
      contactName: '联系方式回归联系人',
      contactPhone: PHONE,
      orgName: '联系方式回归合作社',
      orgType: '合作社',
      origin: '山东省济宁市金乡县',
      spec: '一级',
    }),
  })
  const json = await res.json()
  const id = json?.data?.id
  if (!id) throw new Error('造数据失败: ' + JSON.stringify(json).slice(0, 200))
  return { id: String(id), token }
}

/**
 * 用完就把商品删掉。
 *
 * 之前这个脚本只造不清，每跑一次就在大厅里多一条「联系方式回归xxxx」的已上架商品，
 * 跑几轮演示库就被污染了。删除走交易端的 DELETE /api/trade/product/{id}（软删）。
 *
 * 注意：交易端删除不会通知信息端，`info_sd_contact` 里那条联系方式会成为孤儿记录。
 * 它不影响任何展示（商品都查不到了），但会缓慢累积 —— 见 MEMORY 里的已知问题。
 */
async function cleanupProduct(id, token) {
  const res = await fetch(`${TRADE}/api/trade/product/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  })
  return res.ok ? `已删除商品 ${id}` : `删除失败 HTTP ${res.status}`
}

const profile = mkdtempSync(path.join(tmpdir(), 'edge-detail-'))
const edge = spawn(EDGE, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1440,1000',
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

/** 取「联系人」那一行的文本，以及联系方式按钮的文案/禁用态。 */
const probe = `(() => {
  const rows = [...document.querySelectorAll('.kv')]
  const row = rows.find((r) => r.textContent.includes('联系人'))
  const btn = [...document.querySelectorAll('button')]
    .find((b) => /联系方式|未公开电话/.test(b.textContent))
  return {
    contact: row ? row.textContent.replace(/\\s+/g, ' ').trim() : '',
    btnText: btn ? btn.textContent.trim() : '',
    btnDisabled: btn ? btn.disabled : null,
  }
})()`

let created = null
try {
  // 先造一条「信息端发布、带电话」的数据，脚本不再依赖任何历史行号
  created = await createInfoPosted()
  const infoPostedId = created.id
  console.log(`· 造测试数据 id=${infoPostedId}`)

  const ws = new WebSocket(await targetWs())
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  const cdp = new Cdp(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  // ---------- 登录 ----------
  await cdp.send('Page.navigate', { url: `${BASE}${infoPostedId}?type=supply` })
  await sleep(2500)
  if (await cdp.eval(`location.port === '8090'`)) {
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

  // ---------- 场景二：信息资讯发布的商品，有电话（登录后即在此页） ----------
  const onSecond = await waitFor(cdp, `location.hash.includes('sd-detail') && !!document.querySelector('.kv')`, '详情页渲染', 30000)
  check(onSecond, '详情页打开（信息资讯发布的商品）', `id=${infoPostedId}`)
  if (onSecond) {
    await sleep(600)
    const info = await cdp.eval(probe)
    check(new RegExp(PHONE).test(info.contact), '有电话时正常展示号码', info.contact)
    check(info.btnDisabled === false, '联系方式按钮可点击', `disabled=${info.btnDisabled}`)
  }

  // ---------- 场景一：交易端发布的商品，没有电话 ----------
  await cdp.send('Page.navigate', { url: `${BASE}${TRADE_ONLY}?type=supply` })
  const onDetail = await waitFor(cdp, `location.hash.includes('sd-detail') && !!document.querySelector('.kv')`, '第二条详情页', 15000)
  if (onDetail) {
    check(true, '详情页打开（交易端发布的商品）', await cdp.eval('location.href'))
    await sleep(600)
    const info = await cdp.eval(probe)
    check(/未公开电话/.test(info.contact), '联系人行明确说明未公开电话', info.contact)
    check(!/·\s*$/.test(info.contact), '联系人行不再以空电话收尾')
    check(info.btnDisabled === true, '联系方式按钮置灰', `disabled=${info.btnDisabled}`)
    check(/未公开电话/.test(info.btnText), '按钮文案改为「未公开电话」', info.btnText)
  } else {
    skip('场景一（交易端发布、无电话）', `样本 ${TRADE_ONLY} 已不存在`)
  }
} catch (error) {
  console.error('执行异常：', error)
  results.push({ ok: false, label: '脚本异常' })
} finally {
  edge.kill()
  if (created) console.log(`· 清理：${await cleanupProduct(created.id, created.token)}`)
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${failed.length === 0 ? '全部通过' : `失败 ${failed.length} 项`}`)
failed.forEach((r) => console.log(`  - ${r.label}`))
if (failed.length) process.exitCode = 1
