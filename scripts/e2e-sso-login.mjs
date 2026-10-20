#!/usr/bin/env node
/**
 * 联调：**统一认证中心**的登录方式（2026-10-20 按 portal 原型收敛为两个 Tab）。
 *
 * <p>登录页严格对齐原型：只有「手机号 + 验证码」「账号 + 密码」两个 Tab；
 * 微信 / 支付宝 / 国家政务服务平台收进「其他登录方式」图标。其中</p>
 * <ul>
 *   <li><b>手机验证码登录</b>可用：验证码走「可插拔通道」，本机是 dev 通道 ——
 *       验证码<b>只写后端日志</b>，不回响应体、不落库明文；联调时由脚本直接从 Redis 取值
 *       （页面刻意拿不到码，这样页面流程与生产一致，也不存在"验证码漏给前端"的口子）；</li>
 *   <li><b>账号 + 密码</b>登录可用（账号表 username / phone + AuthService）；</li>
 *   <li><b>微信 / 支付宝 / 政务平台扫码</b><b>未接入</b>：需要开放平台凭据与可回调的公网地址，
 *       页面上如实说明依赖，不伪造二维码。</li>
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
  const tabLabels = await pageA.$$eval('button[role="tab"]', (els) => els.map((el) => (el.textContent ?? '').trim()))
  check(
    tabLabels.length === 2 && tabLabels[0].includes('手机号 + 验证码') && tabLabels[1].includes('账号 + 密码'),
    '登录页严格按原型只有两个 Tab：手机号 + 验证码 / 账号 + 密码',
    JSON.stringify(tabLabels),
  )
  check(ssoText.includes('其他登录方式'), '微信 / 支付宝 / 政务平台收进「其他登录方式」')

  await pageA.evaluate(() => {
    const btn = [...document.querySelectorAll('.third-icons button')]
      .find((el) => (el.getAttribute('title') ?? '').includes('微信'))
    btn?.click()
  })
  await sleep(300)
  const wechatText = await pageA.evaluate(() => document.body.innerText)
  check(wechatText.includes('尚未接入') && wechatText.includes('AppID'),
    '「微信扫码」如实说明依赖（未配置凭据）、不伪造二维码',
    wechatText.replace(/\s+/g, ' ').slice(-80))

  await clickTab(pageA, '手机号 + 验证码')
  await fill(pageA, 'input[autocomplete="tel"]', PHONE)
  await pageA.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('获取验证码'))
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
  const ssoCookie = (await pageA.cookies()).find((cookie) => cookie.name === 'agri_sso_session')
  check(Boolean(ssoCookie) && ssoCookie.expires > Date.now() / 1000 + 6 * 24 * 3600,
    '「7 天内自动登录」真实生效（SSO 会话 Cookie 有效期 ≥ 6 天）',
    ssoCookie ? `expires=${new Date(ssoCookie.expires * 1000).toISOString()}` : '未拿到会话 Cookie')
  await ctxA.close()

  // ---------- 场景 B：账号 + 密码登录（独立上下文，避免 SSO 会话串味）----------
  const ctxB = await browser.createBrowserContext()
  const pageB = await ctxB.newPage()
  await pageB.setViewport({ width: 1440, height: 900 })
  await openSsoLoginPage(pageB)
  await clickTab(pageB, '账号 + 密码')
  await fill(pageB, 'input[autocomplete="username"]', PHONE)
  await fill(pageB, 'input[type="password"]', PASSWORD)
  await pageB.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="submit"]')]
      .find((b) => (b.textContent ?? '').includes('登'))
    btn?.click()
  })
  const pwdLanded = await waitLanded(pageB)
  check(pwdLanded.startsWith(BASE_URL) && !pwdLanded.includes('login') && !pwdLanded.includes(':8090'),
    '账号+密码登录后回跳到子系统业务页', pwdLanded)
  const appText = await pageB.evaluate(() => document.body.innerText)
  check(appText.length > 50 && !appText.includes('正在跳转到统一认证中心'),
    '子系统页面已按登录态渲染', appText.replace(/\s+/g, ' ').slice(0, 70))
  await ctxB.close()

  // ---------- 场景 C：直接从 /register 独立注册（无 client_id/redirect_uri）----------
  // 用户在浏览器地址栏直接打开认证中心注册页时没有授权上下文；这条链路必须也能注册落库，
  // 并且注册后能从子系统入口免登进入。
  const registerPhone = `139${String(Date.now()).slice(-8)}`
  const registerPassword = 'Agri2026test'
  const ctxC = await browser.createBrowserContext()
  const pageC = await ctxC.newPage()
  await pageC.setViewport({ width: 1440, height: 1000 })
  let standaloneRegisterBody = null
  pageC.on('response', async (res) => {
    if (/\/api\/v1\/sso\/register-by-sms$/.test(res.url())) {
      try {
        standaloneRegisterBody = { status: res.status(), json: await res.json() }
      } catch { /* ignore */ }
    }
  })
  await pageC.goto(`${BASE_URL}:8090/register`, { waitUntil: 'networkidle2', timeout: 60000 })
  await pageC.waitForSelector('.identity-cards', { timeout: 15000 })
  const standaloneText = await pageC.evaluate(() => document.body.innerText)
  const registerDisabled = await pageC.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="submit"]')].find((b) => (b.textContent ?? '').includes('免费注册'))
    return btn ? btn.disabled : true
  })
  check(standaloneText.includes('当前为独立注册') && !registerDisabled,
    '直接打开 /register（无授权上下文）时提交按钮可用')

  await pageC.evaluate(() => {
    const card = [...document.querySelectorAll('.identity-card')].find((el) => (el.textContent ?? '').includes('个人会员'))
    card?.click()
  })
  await sleep(300)
  await fill(pageC, 'input[placeholder="请输入真实姓名"]', '独立注册联调')
  await fill(pageC, 'input[placeholder="用于接收重要通知"]', '独立注册联系人')
  await fill(pageC, 'input[placeholder="11 位手机号"]', registerPhone)
  await pageC.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => (b.textContent ?? '').includes('获取验证码'))
    btn?.click()
  })
  await sleep(1200)
  const registerCode = execFileSync('C:\\Redis\\redis-cli.exe',
    ['-n', '0', 'GET', `agri:sms:code:register:${registerPhone}`], { encoding: 'utf8' }).trim()
  check(/^\d{6}$/.test(registerCode), '独立注册：短信验证码已发送', `手机 ${registerPhone}`)
  await fill(pageC, 'input[placeholder="6 位验证码"]', registerCode)
  await fill(pageC, 'input[placeholder="8-20 位字母+数字"]', registerPassword)
  await fill(pageC, 'input[placeholder="再次输入密码"]', registerPassword)
  await pageC.evaluate(() => document.querySelector('.agreement input[type="checkbox"]')?.click())
  await pageC.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="submit"]')].find((b) => (b.textContent ?? '').includes('免费注册'))
    btn?.click()
  })
  await pageC.waitForSelector('.success-mask', { visible: true, timeout: 20000 })
  const standaloneSuccess = await pageC.evaluate(() => document.querySelector('.success-mask').innerText)
  check(standaloneSuccess.includes('注册成功') && standaloneSuccess.includes('已登录认证中心'),
    '独立注册：页面展示成功并说明已登录认证中心', standaloneSuccess.replace(/\s+/g, ' ').slice(0, 90))
  check(standaloneRegisterBody?.status === 200 && standaloneRegisterBody?.json?.code === 0
    && standaloneRegisterBody?.json?.data?.redirect === null,
    '独立注册：接口返回 redirect=null（不伪造子系统回跳）',
    JSON.stringify(standaloneRegisterBody?.json?.data ?? {}).slice(0, 60))

  await pageC.evaluate(() => {
    const btn = [...document.querySelectorAll('.success-actions button')].find((b) => (b.textContent ?? '').includes('进入生产管理'))
    btn?.click()
  })
  const standaloneLanded = await waitLanded(pageC)
  check(standaloneLanded.startsWith(BASE_URL) && !standaloneLanded.includes(':8090') && !standaloneLanded.includes('/login'),
    '独立注册后从子系统入口进入可自动登录', standaloneLanded)
  await ctxC.close()

  // ---------- 场景 D：新会话用独立注册的账号 + 密码登录 ----------
  const ctxD = await browser.createBrowserContext()
  const pageD = await ctxD.newPage()
  await pageD.setViewport({ width: 1440, height: 1000 })
  await openSsoLoginPage(pageD)
  await clickTab(pageD, '账号 + 密码')
  // 场景 C 注册的是个人会员；登录身份要与注册身份一致（服务端会校验 member_type）
  await pageD.evaluate(() => {
    const label = [...document.querySelectorAll('.identity-inline label')].find((el) => (el.textContent ?? '').includes('个人会员'))
    label?.click()
  })
  await sleep(300)
  await fill(pageD, 'input[autocomplete="username"]', registerPhone)
  await fill(pageD, 'input[type="password"]', registerPassword)
  await pageD.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="submit"]')].find((b) => (b.textContent ?? '').includes('登'))
    btn?.click()
  })
  const registerPasswordLanded = await waitLanded(pageD)
  check(registerPasswordLanded.startsWith(BASE_URL) && !registerPasswordLanded.includes(':8090') && !registerPasswordLanded.includes('/login'),
    '独立注册的账号可用手机号 + 密码登录', registerPasswordLanded)
  await ctxD.close()
} catch (error) {
  check(false, '脚本执行未抛异常', String(error).slice(0, 160))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
