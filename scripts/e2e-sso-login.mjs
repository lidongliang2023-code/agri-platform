#!/usr/bin/env node
/**
 * 联调：**统一认证中心**的登录方式（2026-10-16）。
 *
 * <p>本轮落地：登录页四个 Tab（验证码登录 / 手机号密码 / 账号密码 / 微信扫码），其中</p>
 * <ul>
 *   <li><b>手机验证码登录</b>（含手机号注册）可用：验证码走「可插拔通道」，本机是 dev 通道 ——
 *       验证码<b>只写后端日志</b>，不回响应体、不落库明文；联调时由脚本直接从 Redis 取值
 *       （页面刻意拿不到码，这样页面流程与生产一致，也不存在"验证码漏给前端"的口子）；</li>
 *   <li><b>手机号 + 密码</b>登录可用（账号表 phone 列 + AuthService 按手机号查账号）；</li>
 *   <li><b>微信扫码</b>与「微信扫码注册」<b>未接入</b>：需要微信开放平台 AppID/AppSecret 与可回调的公网地址，
 *       页面上如实说明依赖，不放点了必然失败的按钮、不伪造二维码。</li>
 * </ul>

 *
 * <p>每个场景用**独立浏览器上下文**：SSO 会建全局会话，同一上下文里连续跑会把"未登录"前提破坏掉。</p>

 *
 * 用法：node scripts/e2e-sso-login.mjs [--base=http://localhost] [--phone=13800000001] [--headful]
 * 退出码：0 = 全部通过；1 = 有断言失败。
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
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
const PHONE = arg('phone', '13800000001')
const PASSWORD = arg('password', 'Admin@123')
/** dev 短信通道下验证码落在 Redis 的这个 key 上（场景 login） */
const SMS_CODE_KEY = `agri:sms:code:login:${PHONE}`
const HEADFUL = process.argv.includes('--headful')

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 打开登录入口并等认证中心登录页出现 */
const openSsoLoginPage = async (page) => {
  await page.goto(`${BASE_URL}/production/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  for (let i = 0; i < 20; i++) {
    await sleep(600)
    if (page.url().includes(':8090/')) break
  }
  return page.url()
}
/** 等回跳到子系统业务页 */
const waitLanded = async (page) => {
  let landed = page.url()
  for (let i = 0; i < 25; i++) {
    await sleep(700)
    landed = page.url()
    if (landed.startsWith(BASE_URL) && !landed.includes('/login')) break
  }
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  return landed
}
/** 切 Tab（antd 之外的手写 Tab，用 role=tab 定位） */
const clickTab = async (page, label) => {
  await page.evaluate((text) => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((el) => (el.textContent ?? '').includes(text))
    tab?.click()
  }, label)
  await sleep(300)
}
/** 往输入框写值（受控组件：必须走原生 setter + input 事件） */
const fill = async (page, selector, value) => {
  await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel)
    if (!input) throw new Error(`未找到输入框 ${sel}`)
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { sel: selector, val: value })
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })

try {
  // ---------- 场景 A：登录页形态 + 微信依赖说明 + 验证码登录 ----------
  const ctxA = await browser.createBrowserContext()
  const pageA = await ctxA.newPage()
  await pageA.setViewport({ width: 1440, height: 900 })
  /** 登录接口的响应体：失败时唯一能看清原因的地方 */
  let smsLoginCall = null
  pageA.on('response', async (res) => {
    if (/\/api\/v1\/sso\/login-by-sms$/.test(res.url())) {
      try {
        smsLoginCall = { status: res.status(), json: await res.json() }
      } catch { /* 忽略 */ }
    }
  })

  const ssoUrl = await openSsoLoginPage(pageA)
  check(ssoUrl.includes(':8090/'), '登录入口把访客送到统一认证中心', ssoUrl)
  const ssoText = await pageA.evaluate(() => document.body.innerText)
  check(ssoText.includes('统一认证中心'), '认证中心登录页已渲染')
  check(
    ssoText.includes('验证码登录') && ssoText.includes('手机号密码')
      && ssoText.includes('账号密码') && ssoText.includes('微信扫码'),
    '登录页有四个 Tab：验证码登录 / 手机号密码 / 账号密码 / 微信扫码',
  )

  await clickTab(pageA, '微信扫码')
  const wechatText = await pageA.evaluate(() => document.body.innerText)
  check(wechatText.includes('尚未接入') && wechatText.includes('AppID'),
    '「微信扫码」如实说明依赖（未配置凭据）、不伪造二维码',
    wechatText.replace(/\s+/g, ' ').slice(-80))

  await clickTab(pageA, '验证码登录')
  await fill(pageA, 'input[autocomplete="tel"]', PHONE)
  await pageA.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('发送验证码'))
    btn?.click()
  })
  await sleep(1500)
  const afterSend = await pageA.evaluate(() => document.body.innerText)
  // 两种都算"如实"：① dev 通道已发送（提示见后端日志）；② 命中 60 秒重发限流（沿用已有验证码继续验）
  const cooldown = /秒后再试/.test(afterSend)
  check(/开发模式|已发送/.test(afterSend), '发送验证码后页面给出明确结果（已发送 / 命中重发限流）',
    cooldown ? '命中 60s 限流，沿用 Redis 里已有的验证码继续' : afterSend.replace(/\s+/g, ' ').slice(-70))

  // 页面刻意拿不到验证码；联调在本机从 Redis 取（生产由短信下发）
  const smsCode = execFileSync('C:\\Redis\\redis-cli.exe', ['-n', '0', 'GET', SMS_CODE_KEY],
    { encoding: 'utf8' }).trim()
  check(/^\d{6}$/.test(smsCode), '（联调侧）dev 通道取到验证码', smsCode ? `长度 ${smsCode.length}` : '空')
  await fill(pageA, 'input[maxlength="6"]', smsCode)
  await pageA.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="submit"]')]
      .find((b) => (b.textContent ?? '').includes('登'))
    btn?.click()
  })
  const smsLanded = await waitLanded(pageA)
  if (!smsLanded.startsWith(BASE_URL) || smsLanded.includes('login')) {
    // 没跳走时把页面上的原因打出来（验证码错 / 过期 / 限流 都在这句里）
    const pageText = await pageA.evaluate(() => document.body.innerText)
    console.log('  页面文本：', pageText.replace(/\s+/g, ' ').slice(-160))
    console.log('  登录接口响应：', JSON.stringify(smsLoginCall))
  }
  check(smsLanded.startsWith(BASE_URL) && !smsLanded.includes('login') && !smsLanded.includes(':8090'),
    '验证码登录后回跳到子系统业务页（SSO 链路打通）', smsLanded)
  await ctxA.close()

  // ---------- 场景 B：手机号 + 密码登录（独立上下文，避免 SSO 会话串味）----------
  const ctxB = await browser.createBrowserContext()
  const pageB = await ctxB.newPage()
  await pageB.setViewport({ width: 1440, height: 900 })
  await openSsoLoginPage(pageB)
  await clickTab(pageB, '手机号密码')
  await fill(pageB, 'input[autocomplete="tel"]', PHONE)
  await fill(pageB, 'input[type="password"]', PASSWORD)
  await pageB.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="submit"]')]
      .find((b) => (b.textContent ?? '').includes('登'))
    btn?.click()
  })
  const pwdLanded = await waitLanded(pageB)
  check(pwdLanded.startsWith(BASE_URL) && !pwdLanded.includes('login') && !pwdLanded.includes(':8090'),
    '手机号+密码登录后回跳到子系统业务页', pwdLanded)
  const appText = await pageB.evaluate(() => document.body.innerText)
  check(appText.length > 50 && !appText.includes('正在跳转到统一认证中心'),
    '子系统页面已按登录态渲染', appText.replace(/\s+/g, ' ').slice(0, 70))
  await ctxB.close()
} catch (error) {
  check(false, '脚本执行未抛异常', String(error).slice(0, 160))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
