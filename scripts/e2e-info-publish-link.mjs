#!/usr/bin/env node
/**
 * 端到端验证：信息资讯「发布供需信息」→ 交易撮合卖家中心/买家中心 → 回跳。
 *
 * 用 Edge headless + CDP（Node 22 内置 WebSocket，不引 puppeteer）。
 * 只做一件事：把用户真实点一遍的路径跑通，并断言关键节点。
 */
import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9333
const INFO = 'http://localhost:8104/info/#/sd-publish'
const PHONE = '13800000001'
const PASSWORD = 'Admin@123'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  results.push({ ok, label, extra })
}

const profile = mkdtempSync(path.join(tmpdir(), 'edge-e2e-'))
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
    const res = await this.send('Runtime.evaluate', {
      expression, returnByValue: true, awaitPromise: true,
    })
    if (res.exceptionDetails) {
      throw new Error(res.exceptionDetails.exception?.description ?? 'evaluate 失败')
    }
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

const url = () => 'location.href'

try {
  const ws = new WebSocket(await targetWs())
  await new Promise((r) => ws.addEventListener('open', r, { once: true }))
  const cdp = new Cdp(ws)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')

  // ---------- 1. 打开信息资讯发布入口页（未登录会跳 SSO） ----------
  await cdp.send('Page.navigate', { url: INFO })
  await sleep(2500)

  let current = await cdp.eval(url())
  check(current.includes(':8090') || current.includes('/authorize'), '未登录时跳转统一认证中心', current)

  // ---------- 2. 登录 ----------
  // 登录页默认停在「手机号 + 验证码」标签，必须切到「账号 + 密码」
  const hasLoginForm = await waitFor(
    cdp,
    `!![...document.querySelectorAll('button[role="tab"]')].find((b) => /账号/.test(b.textContent))`,
    '登录页标签渲染',
  )
  if (hasLoginForm) {
    await cdp.eval(`(() => {
      const tab = [...document.querySelectorAll('button[role="tab"]')].find((b) => /账号/.test(b.textContent))
      if (tab) tab.click(); return true
    })()`)
  }
  const passwordReady = await waitFor(
    cdp,
    `!!document.querySelector('input[type="password"]')`,
    '密码输入框出现',
  )
  check(hasLoginForm && passwordReady, '统一认证中心渲染出账号密码登录表单')

  if (passwordReady) {
    await cdp.eval(`(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
      const u = document.querySelector('input[autocomplete="username"]') || document.querySelector('input[type="text"]')
      const p = document.querySelector('input[type="password"]')
      set.call(u, ${JSON.stringify(PHONE)}); u.dispatchEvent(new Event('input', { bubbles: true }))
      set.call(p, ${JSON.stringify(PASSWORD)}); p.dispatchEvent(new Event('input', { bubbles: true }))
      return true
    })()`)
    await cdp.eval(`(() => {
      const btn = document.querySelector('button.auth-submit')
        || [...document.querySelectorAll('button')].find((b) => /登\s*录/.test(b.textContent))
      if (!btn) return false
      btn.click(); return true
    })()`)
  }

  // ---------- 3. 回到信息资讯发布入口页 ----------
  const backToInfo = await waitFor(
    cdp,
    `location.port === '8104' && !!document.querySelector('.publish-entry')`,
    '回到信息资讯发布入口页',
    30000,
  )
  current = await cdp.eval(url())
  check(backToInfo, '登录后回到发布入口页', current)

  const cardCount = await cdp.eval(`document.querySelectorAll('.publish-entry').length`)
  check(cardCount === 2, '页面渲染出供应/需求两张卡片', `卡片数=${cardCount}`)

  const btnTexts = await cdp.eval(
    `[...document.querySelectorAll('.publish-entry-actions button')].map((b) => b.textContent.trim())`,
  )
  check(
    btnTexts.some((t) => t.includes('卖家中心')) && btnTexts.some((t) => t.includes('买家中心')),
    '两张卡分别指向卖家中心 / 买家中心',
    JSON.stringify(btnTexts),
  )

  // 顶部全局搜索本身就是一个 <form>，所以不能只数 form 数量；
  // 旧发布表单的特征是 .form-grid（品类/品种/数量那一套字段）。
  const formGone = await cdp.eval(
    `document.querySelectorAll('form').length === 1 && !!document.querySelector('.global-search')`
    + ` && !document.querySelector('.form-grid')`,
  )
  check(formGone, '信息资讯端已不再渲染发布表单（只剩顶部搜索框）')

  // ---------- 4. 点「去卖家中心发布商品」 ----------
  const clicked = await cdp.eval(`(() => {
    const btn = [...document.querySelectorAll('.publish-entry-actions button')]
      .find((b) => /卖家中心发布商品/.test(b.textContent))
    if (!btn) return false
    btn.click(); return true
  })()`)
  check(clicked, '点击「去卖家中心发布商品」')

  const onTrade = await waitFor(cdp, `location.port === '8086'`, '跳转到交易撮合', 25000)
  const tradeUrl = await cdp.eval(url())
  check(onTrade, '已跳转到交易撮合', tradeUrl)
  check(/tab=publish/.test(tradeUrl), '带 tab=publish 参数')
  check(/returnUrl=/.test(tradeUrl), '带 returnUrl 回跳参数')
  check(decodeURIComponent(tradeUrl).includes('/info/'), 'returnUrl 指回信息资讯', decodeURIComponent(tradeUrl))

  // ---------- 5. 交易端发布商品表单 ----------
  const onPublishForm = await waitFor(
    cdp,
    `/发布新商品|编辑商品/.test(document.body.innerText)`,
    '交易端发布商品表单',
    30000,
  )
  current = await cdp.eval(url())
  check(onPublishForm, '交易端渲染出「发布新商品」表单', current)

  if (onPublishForm) {
    const returnLabel = await cdp.eval(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /返回信息资讯/.test(x.textContent))
      return b ? b.textContent.trim() : ''
    })()`)
    check(Boolean(returnLabel), '返回按钮显示「返回信息资讯」', returnLabel)

    const skuBlock = await cdp.eval(`/可售规格|SKU/.test(document.body.innerText)`)
    check(skuBlock, '表单包含 SKU 等交易端完整字段（非信息端精简表单）')
  }

  // ---------- 6. 点返回，验证回跳闭环 ----------
  if (onPublishForm) {
    await cdp.eval(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /返回信息资讯/.test(x.textContent))
      if (b) b.click(); return true
    })()`)
    const returned = await waitFor(
      cdp,
      `location.port === '8104' && !!document.querySelector('.publish-entry')`,
      '回跳到信息资讯',
      25000,
    )
    check(returned, '点「返回信息资讯」成功回跳发布入口页', await cdp.eval(url()))
  }

  // ---------- 7. 买家侧：发布采购需求 ----------
  const demandClicked = await cdp.eval(`(() => {
    const btn = [...document.querySelectorAll('.publish-entry-actions button')]
      .find((b) => /买家中心发布需求/.test(b.textContent))
    if (!btn) return false
    btn.click(); return true
  })()`)
  check(demandClicked, '点击「去买家中心发布需求」')

  const onBuyer = await waitFor(cdp, `location.port === '8086'`, '跳转买家中心', 25000)
  const buyerUrl = await cdp.eval(url())
  check(onBuyer, '已跳转到交易撮合（买家）', buyerUrl)
  check(
    /tab=publish/.test(buyerUrl) && /returnUrl=/.test(buyerUrl),
    '买家侧同样带 tab=publish + returnUrl',
    decodeURIComponent(buyerUrl),
  )

  const onDemandForm = await waitFor(
    cdp,
    `/发布采购需求|编辑采购需求/.test(document.body.innerText)`,
    '买家发布需求表单',
    30000,
  )
  check(onDemandForm, '交易端渲染出「发布采购需求」表单', await cdp.eval(url()))

  if (onDemandForm) {
    const nlp = await cdp.eval(`/智能需求助手/.test(document.body.innerText)`)
    check(nlp, '买家表单含「智能需求助手」（交易端独有能力，信息端原本没有）')

    const demandBackLabel = await cdp.eval(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /返回信息资讯/.test(x.textContent))
      return b ? b.textContent.trim() : ''
    })()`)
    check(Boolean(demandBackLabel), '买家页返回按钮同样显示「返回信息资讯」', demandBackLabel)

    await cdp.eval(`(() => {
      const b = [...document.querySelectorAll('button')].find((x) => /返回信息资讯/.test(x.textContent))
      if (b) b.click(); return true
    })()`)
    const backAgain = await waitFor(
      cdp,
      `location.port === '8104' && !!document.querySelector('.publish-entry')`,
      '买家侧回跳',
      25000,
    )
    check(backAgain, '买家侧点「返回信息资讯」成功回跳发布入口页', await cdp.eval(url()))
  }
} catch (error) {
  check(false, '执行异常', error.message)
} finally {
  edge.kill()
  const failed = results.filter((r) => !r.ok)
  console.log(`\n${failed.length === 0 ? '✓ 全部通过' : `✗ ${failed.length} 项失败`}（共 ${results.length} 项）`)
  process.exit(failed.length === 0 ? 0 : 1)
}
