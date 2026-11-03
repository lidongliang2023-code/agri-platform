#!/usr/bin/env node
/**
 * 统一认证中心 · 找回密码回归（2026-10-30 重构版）。
 *
 * 走真实浏览器（Edge headless + CDP，无 puppeteer 依赖）：
 *   1. mode=forgot 深链直达第一步，第二步才出现新密码；
 *   2. 发送验证码 → 脱敏提示 → 下一步；
 *   3. 弱密码 / 两次不一致在提交前被拦下；
 *   4. 真重置：旧密码失效、新密码可登录、旧 SSO 会话失效；
 *   5. 用户中心 :8098/sso/ 反代可用（不会被 302 回门户首页）；
 *   6. 最后用 API 把测试账号密码恢复原值。
 *
 * 运行：node scripts/e2e-password-reset.mjs
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as sleep } from 'node:timers/promises'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
const PORT = 9347
const PROFILE = 'C:/Users/71502/AppData/Local/Temp/edge-sso-reset'
const BASE = 'http://localhost'
const SSO = `${BASE}:8090`
const PORTAL = `${BASE}:8098`
const PHONE = '19900002005'
// 基准密码必须本身通过服务端策略（8-20 位、字母+数字、无 4 位连续、不含手机号），
// 否则"恢复原密码"这一步会被 AccountPolicyService 拒绝。
const ORIGINAL_PASSWORD = 'AgriTest2026x'
// base36 时间戳打散数字，避免随机撞出 1234 这类连续序列被策略拦下
const NEW_PASSWORD = `Kx${Date.now().toString(36)}a9Q`
const RESET_CODE_KEY = `agri:sms:code:reset_password:${PHONE}`
const COOLDOWN_KEY = `agri:sms:cooldown:${PHONE}`
const ATTEMPT_KEY = `agri:sms:attempt:reset_password:${PHONE}`
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'outputs', 'sso-password-reset-20261030')

mkdirSync(PROFILE, { recursive: true })
mkdirSync(OUT, { recursive: true })

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const redis = (...args) => execFileSync('C:\\Redis\\redis-cli.exe', ['-n', '0', ...args], { encoding: 'utf8' }).trim()
const resetSmsState = () => redis('DEL', RESET_CODE_KEY, COOLDOWN_KEY, ATTEMPT_KEY)
const readResetCode = () => redis('GET', RESET_CODE_KEY)

const api = async (pathName, payload) => {
  const response = await fetch(`${SSO}${pathName}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return { status: response.status, body: await response.json() }
}

const edge = spawn(EDGE, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${PROFILE}`,
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  '--window-size=1440,1000',
  'about:blank',
], { stdio: 'ignore', detached: false })

let ws
let nextId = 1
const pending = new Map()

function send(method, params = {}) {
  const id = nextId++
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`CDP 超时：${method}`))
      }
    }, 30000)
  })
}

async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
  if (result.exceptionDetails) throw new Error(`页面执行异常：${result.exceptionDetails.text}`)
  return result.result?.value
}

async function waitFor(expression, timeoutMs = 20000, label = expression) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      if (await evaluate(expression)) return true
    } catch {
      // 页面跳转期间执行上下文会失效
    }
    await sleep(250)
  }
  throw new Error(`等待超时：${label}`)
}

/** React 受控输入必须走原生 setter + input 事件，直接改 value 不会触发 onChange */
const setInput = (selector, value, index = 0) => evaluate(`(() => {
  const input = document.querySelectorAll(${JSON.stringify(selector)})[${index}]
  if (!input) return false
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(input, ${JSON.stringify(value)})
  input.dispatchEvent(new Event('input', { bubbles: true }))
  return true
})()`)

const clickText = (text) => evaluate(`(() => {
  const button = [...document.querySelectorAll('button')].find((item) => (item.textContent ?? '').includes(${JSON.stringify(text)}))
  if (!button) return false
  button.click()
  return true
})()`)

const bodyText = () => evaluate('document.body.innerText')

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
  writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(data, 'base64'))
}

let passwordChanged = false

async function main() {
  let targets = null
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/list`)
      targets = await response.json()
      if (targets.some((t) => t.type === 'page')) break
    } catch {
      // 端口未就绪
    }
    await sleep(300)
  }
  if (!targets) throw new Error('Edge 调试端口未就绪')
  const page = targets.find((t) => t.type === 'page')
  ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    ws.onopen = resolve
    ws.onerror = () => reject(new Error('CDP WebSocket 连接失败'))
  })
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data)
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id)
      pending.delete(message.id)
      if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`))
      else resolve(message.result)
    }
  }
  await send('Page.enable')
  await send('Runtime.enable')

  resetSmsState()

  // 先把测试账号拉回已知状态：上一轮若在完成页中断，密码可能停在新值上。
  // 用同一套"验证码 → 重置"接口修复，顺带证明这条链路本身可用。
  const baseline = await api('/api/v1/sso/login-standalone', { phone: PHONE, password: ORIGINAL_PASSWORD, marketId: 1 })
  if (baseline.body.code !== 0) {
    resetSmsState()
    const bootstrapSent = await api('/api/v1/sso/sms/code', { phone: PHONE, scene: 'reset_password' })
    const bootstrapCode = bootstrapSent.body.code === 0 ? readResetCode() : ''
    if (!bootstrapCode) throw new Error('基准密码恢复失败：拿不到验证码')
    const repaired = await api('/api/v1/sso/password-reset', {
      phone: PHONE,
      code: bootstrapCode,
      newPassword: ORIGINAL_PASSWORD,
      confirmPassword: ORIGINAL_PASSWORD,
    })
    check(repaired.body.code === 0, '基准密码已恢复为脚本约定值', repaired.body.message)
    resetSmsState()
  }

  // 先建立一枚旧 SSO 会话：重置后要验证它已失效
  const loginResponse = await fetch(`${SSO}/api/v1/sso/login-standalone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: PHONE, password: ORIGINAL_PASSWORD, marketId: 1 }),
    redirect: 'manual',
  })
  const oldSession = (loginResponse.headers.getSetCookie?.() ?? [])
    .map((item) => item.split(';')[0])
    .join('; ')
  check(loginResponse.status === 200 && oldSession !== '', '测试账号可用原密码建立旧 SSO 会话')

  // ---- 1. 深链 + 第一步 ----
  await send('Page.navigate', { url: `${SSO}/login?mode=forgot` })
  await waitFor(`document.querySelector('.auth-reset-back') !== null`, 25000, '找回密码页渲染')
  const stepOne = await bodyText()
  check(['找回密码', '验证手机号', '设置新密码', '完成', '注册手机号', '短信验证码']
    .every((label) => stepOne.includes(label)), 'mode=forgot 深链直达找回密码第一步')
  check(await evaluate(`document.querySelectorAll('input[autocomplete="new-password"]').length === 0`),
    '第一步只收手机号与验证码（新密码在第二步）')
  await shot('01-step1-verify-phone')

  // ---- 2. 发送验证码 ----
  await setInput('input[autocomplete="tel"]', PHONE)
  await clickText('获取验证码')
  await waitFor(`document.body.innerText.includes('验证码已发送至')`, 15000, '验证码发送提示')
  const sentHint = await evaluate(`[...document.querySelectorAll('.auth-hint')].map((n) => n.textContent).join(' ')`)
  check(sentHint.includes('199****2005'), '发送后提示里手机号已脱敏', sentHint.slice(0, 40))

  const code = readResetCode()
  check(/^\d{6}$/.test(code), '（联调侧）dev 通道取到找回密码验证码', code ? `长度 ${code.length}` : '空')

  // ---- 3. 第二步 ----
  await setInput('input[maxlength="6"]', code)
  await clickText('下一步')
  await waitFor(`document.querySelectorAll('input[autocomplete="new-password"]').length === 2`, 15000, '第二步密码框')
  const stepTwo = await bodyText()
  check(stepTwo.includes('确认新密码'), '第二步才出现设置新密码')
  await shot('02-step2-new-password')
  check(stepTwo.includes('199****2005'), '第二步回显待重置的脱敏手机号')

  // 弱密码被前端拦下
  await setInput('input[autocomplete="new-password"]', 'abc12', 0)
  await setInput('input[autocomplete="new-password"]', 'abc12', 1)
  await clickText('确认重置密码')
  await sleep(400)
  const weakError = await evaluate(`document.querySelector('.auth-error')?.textContent ?? ''`)
  check(weakError.includes('8-20 位'), '弱密码被拦下并说明规则', weakError)

  // 两次不一致
  await setInput('input[autocomplete="new-password"]', NEW_PASSWORD, 0)
  await setInput('input[autocomplete="new-password"]', `${NEW_PASSWORD}x`, 1)
  await clickText('确认重置密码')
  await sleep(400)
  const mismatchError = await evaluate(`document.querySelector('.auth-error')?.textContent ?? ''`)
  check(mismatchError.includes('不一致'), '两次密码不一致被拦下', mismatchError)

  // ---- 4. 真重置 ----
  await setInput('input[autocomplete="new-password"]', NEW_PASSWORD, 1)
  await clickText('确认重置密码')
  await waitFor(`document.body.innerText.includes('密码已重置') && document.body.innerText.includes('其它设备')`,
    15000, '完成页')
  passwordChanged = true
  check(true, '重置成功进入完成页并说明旧会话已失效')
  await shot('03-step3-done')

  const oldLogin = await api('/api/v1/sso/login-standalone', { phone: PHONE, password: ORIGINAL_PASSWORD, marketId: 1 })
  check(oldLogin.body.code !== 0, '旧密码在重置后无法登录')
  const newLogin = await api('/api/v1/sso/login-standalone', { phone: PHONE, password: NEW_PASSWORD, marketId: 1 })
  check(newLogin.body.code === 0, '新密码可正常登录')

  const authorize = await fetch(`${SSO}/api/v1/sso/authorize?client_id=portal`
    + '&redirect_uri=http%3A%2F%2Flocalhost%3A8098%2Fportal%2F&state=e2e-reset', {
    redirect: 'manual',
    headers: { Cookie: oldSession },
  })
  const authorizeLocation = authorize.headers.get('location') ?? ''
  check(authorize.status >= 300 && authorizeLocation.includes('/login'),
    '重置密码后旧 SSO 会话已失效', `${authorize.status} ${authorizeLocation}`)

  // ---- 5. 返回登录 ----
  await clickText('返回登录')
  await waitFor(`document.querySelector('input[autocomplete="username"]') !== null`, 10000, '登录页')
  await sleep(300)
  const prefilled = await evaluate(`(() => ({
    account: document.querySelector('input[autocomplete="username"]')?.value ?? '',
    notice: document.body.innerText.includes('密码已重置，请使用新密码登录'),
  }))()`)
  check(prefilled.account === PHONE && prefilled.notice, '返回登录回填手机号并提示用新密码登录', prefilled.account)

  // ---- 6. 用户中心入口（:8098 反代）----
  await send('Page.navigate', { url: `${PORTAL}/sso/index.html?mode=forgot` })
  await waitFor(`document.querySelector('.auth-reset-back') !== null`, 25000, '门户找回密码页')
  const portalState = await evaluate(`(() => ({
    title: document.querySelector('.form-title')?.textContent ?? '',
    url: location.href,
  }))()`)
  check(portalState.title.includes('找回密码') && portalState.url.includes('/sso/index.html'),
    '用户中心 /sso/ 反代可用，找回密码未被 302 回门户首页', portalState.url)
}

try {
  await main()
} catch (error) {
  console.error('E2E 失败:', error.message)
  process.exitCode = 1
} finally {
  if (passwordChanged) {
    resetSmsState()
    const sent = await api('/api/v1/sso/sms/code', { phone: PHONE, scene: 'reset_password' })
    const code = sent.body.code === 0 ? readResetCode() : ''
    if (code) {
      await api('/api/v1/sso/password-reset', {
        phone: PHONE,
        code,
        newPassword: ORIGINAL_PASSWORD,
        confirmPassword: ORIGINAL_PASSWORD,
      })
    }
    resetSmsState()
    const restored = await api('/api/v1/sso/login-standalone', { phone: PHONE, password: ORIGINAL_PASSWORD, marketId: 1 })
    check(restored.body.code === 0, '测试账号原密码已恢复')
  }
  try {
    ws?.close()
  } catch {
    // 忽略
  }
  edge.kill()
}

if (failures.length) {
  console.log(`\n失败 ${failures.length} 项：`)
  failures.forEach((item) => console.log(' -', item))
  process.exitCode = 1
} else if (!process.exitCode) {
  console.log('\n全部通过')
}
