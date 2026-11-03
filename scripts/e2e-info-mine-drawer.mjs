#!/usr/bin/env node
/**
 * 供需大厅「我的发布」抽屉回归（2026-10-28）
 *
 * 修复前的问题：抽屉只请求了供应一侧（后端 mine 不传 type 默认按供应查），
 * 需求侧发布的东西在抽屉里根本看不到；而且状态写死成 online，待审核也显示"在线"。
 *
 * 这里用 Edge headless + CDP 真实点一遍：登录 → 供需大厅 → 我的发布 → 断言供需两侧都在、状态标签正确。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9334
const HALL = 'http://localhost:8104/info/#/sd'
const USER = process.env.E2E_USER || '19900002005'
const PASS = process.env.E2E_PASS || 'Test12345'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  results.push({ ok, label, extra })
}

const profile = mkdtempSync(path.join(tmpdir(), 'edge-mine-'))
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

try {
  const ws = new WebSocket(await targetWs())
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  const cdp = new Cdp(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  await cdp.send('Page.navigate', { url: HALL })
  await sleep(2500)

  // ---------- 登录（未登录会被踢到 SSO） ----------
  const needLogin = await cdp.eval(`location.port === '8090'`)
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

  const onHall = await waitFor(cdp, `location.port === '8104' && !!document.querySelector('.sd-card')`, '回到供需大厅', 30000)
  check(onHall, '登录后进入供需大厅', await cdp.eval('location.href'))

  // ---------- 点「我的发布」 ----------
  const clicked = await cdp.eval(`(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === '我的发布')
    if (!btn) return false
    btn.click(); return true
  })()`)
  check(clicked, '找到并点击「我的发布」')

  const drawerOpen = await waitFor(cdp, `!!document.querySelector('.ant-drawer-content')`, '抽屉打开')
  check(drawerOpen, '「我的发布」抽屉打开')

  if (drawerOpen) {
    await waitFor(
      cdp,
      `!document.querySelector('.ant-drawer-content .muted') || document.querySelectorAll('.ant-drawer-content .surface-card').length > 0`,
      '抽屉数据加载',
    )
    await sleep(800)

    const rows = await cdp.eval(`(() => {
      const cards = [...document.querySelectorAll('.ant-drawer-content .surface-card')]
      return cards.map((card) => {
        const tag = card.querySelector('.soft-tag')
        const statusTag = card.querySelectorAll('.soft-tag')[1]
        return { type: tag ? tag.textContent.trim() : '', status: statusTag ? statusTag.textContent.trim() : '', text: card.textContent.trim().slice(0, 40) }
      })
    })()`)
    check(rows.length > 0, '抽屉里渲染出发布记录', `共 ${rows.length} 条`)

    const types = [...new Set(rows.map((r) => r.type).filter(Boolean))]
    check(types.every((t) => t === '供应' || t === '求购'), '每条记录都带供应/求购类型标签', JSON.stringify(types))
    check(types.includes('供应'), '抽屉包含供应记录')
    // 需求侧是本次修复的重点：修复前抽屉只有供应
    const demandInDrawer = types.includes('求购')
    check(demandInDrawer, '抽屉包含求购记录（修复前恒为空）', JSON.stringify(types))

    const hasPending = rows.some((r) => r.status === '待审核')
    const hintShown = await cdp.eval(
      `[...document.querySelectorAll('.ant-drawer-content p')].some((p) => /审核通过才会出现在供需大厅/.test(p.textContent))`,
    )
    check(!hasPending || hintShown, '存在待审核记录时给出审核说明', `待审核=${hasPending} 提示=${hintShown}`)

    const stats = await cdp.eval(
      `[...document.querySelectorAll('.ant-drawer-content .soft-tag, .ant-drawer-content .chip')].slice(0, 3).map((t) => t.textContent.trim())`,
    )
    check(stats.some((t) => /在线|待审核|已下架/.test(t)), '抽屉顶部统计包含在线/待审核/已下架', JSON.stringify(stats))

    // 已下架默认折叠，避免历史记录把在架信息挤掉
    const closedToggle = await cdp.eval(
      `(() => {
        const chip = [...document.querySelectorAll('.ant-drawer-content .chip')].find((c) => /已下架/.test(c.textContent))
        return chip ? chip.textContent.trim() : ''
      })()`,
    )
    check(Boolean(closedToggle), '抽屉提供「已下架」折叠开关', closedToggle)

    if (closedToggle) {
      const before = rows.length
      await cdp.eval(`(() => {
        const chip = [...document.querySelectorAll('.ant-drawer-content .chip')].find((c) => /已下架/.test(c.textContent))
        chip.click(); return true
      })()`)
      await sleep(500)
      const after = await cdp.eval(`document.querySelectorAll('.ant-drawer-content .surface-card').length`)
      check(after >= before, '展开已下架后记录数不减少', `${before} → ${after}`)
    }
  }

  // ---------- 智能匹配页：修复前只查供应，"我的需求"分组恒为空 ----------
  await cdp.send('Page.navigate', { url: 'http://localhost:8104/info/#/sd-match' })
  const onMatch = await waitFor(cdp, `location.hash.includes('sd-match') && !!document.querySelector('.ant-segmented')`, '进入智能匹配页', 30000)
  check(onMatch, '打开智能匹配页')
  if (onMatch) {
    const scopes = await cdp.eval(
      `[...document.querySelectorAll('.ant-segmented-item-label')].map((item) => item.textContent.trim())`,
    )
    check(scopes.length === 3, '匹配页渲染出全部/我的供应/我的需求三个范围', JSON.stringify(scopes))

    const supplyGroups = await cdp.eval(
      `[...document.querySelectorAll('.section-kicker')].filter((k) => k.textContent.trim() === 'SUPPLY').length`,
    )
    await cdp.eval(`(() => {
      const item = [...document.querySelectorAll('.ant-segmented-item-label')].find((i) => /我的需求/.test(i.textContent))
      if (item) item.click(); return true
    })()`)
    await sleep(1200)
    const demandGroups = await cdp.eval(
      `[...document.querySelectorAll('.section-kicker')].filter((k) => k.textContent.trim() === 'DEMAND').length`,
    )
    check(supplyGroups > 0, '「全部」范围下能列出我的供应分组', `SUPPLY 分组 ${supplyGroups} 个`)
    check(demandGroups > 0, '「我的需求」范围下有撮合分组（修复前恒为空）', `DEMAND 分组 ${demandGroups} 个`)
  }
} catch (error) {
  console.error('执行异常：', error)
  results.push({ ok: false, label: '脚本异常' })
} finally {
  edge.kill()
}

const failed = results.filter((r) => !r.ok)
console.log(`\n${failed.length === 0 ? '全部通过' : `失败 ${failed.length} 项`}`)
failed.forEach((r) => console.log(`  - ${r.label}`))
if (failed.length) process.exitCode = 1
