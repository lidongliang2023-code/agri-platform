#!/usr/bin/env node
/**
 * 统一认证中心 · 忘记密码真实浏览器回归。
 *
 * 使用现有测试账号完成：打开找回表单 → 发送复位验证码 → 重置密码 →
 * 校验旧密码失败/新密码成功 → 校验旧 SSO 会话失效 → 恢复原密码。
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
  const hit = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const BASE = arg('base', 'http://localhost')
const SSO = `${BASE}:8090`
const PHONE = arg('phone', '19900002005')
const OLD_PASSWORD = arg('password', 'Test12345')
const NEW_PASSWORD = `Reset${String(Date.now()).slice(-8)}a`
const RESET_CODE_KEY = `agri:sms:code:reset_password:${PHONE}`
const COOLDOWN_KEY = `agri:sms:cooldown:${PHONE}`
const ATTEMPT_KEY = `agri:sms:attempt:reset_password:${PHONE}`

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const redis = (...args) => execFileSync('C:\\Redis\\redis-cli.exe', ['-n', '0', ...args], {
  encoding: 'utf8',
}).trim()

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

const fill = async (page, selector, value) => {
  await page.evaluate(({ sel, val }) => {
    const input = document.querySelector(sel)
    if (!(input instanceof HTMLInputElement)) throw new Error(`未找到输入框 ${sel}`)
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, val)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { sel: selector, val: value })
}

const clickButton = async (page, text) => {
  await page.evaluate((label) => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => (item.textContent ?? '').includes(label))
    if (!button) throw new Error(`未找到按钮 ${label}`)
    button.click()
  }, text)
}

const loginWithPassword = async (page, password) => {
  await page.goto(`${SSO}/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  await clickButton(page, '账号 + 密码')
  await fill(page, 'input[autocomplete="username"]', PHONE)
  await fill(page, 'input[autocomplete="current-password"]', password)
  await clickButton(page, '登 录')
  for (let i = 0; i < 30; i += 1) {
    await sleep(500)
    if (!page.url().includes(':8090/')) break
  }
  await page.waitForNetworkIdle({ idleTime: 700, timeout: 15000 }).catch(() => {})
  return page.url()
}

let passwordChanged = false
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })

try {
  resetSmsState()

  // 先在独立上下文建立一枚旧 SSO 会话，供重置后验证“旧会话失效”。
  const oldSession = await browser.createBrowserContext()
  const oldPage = await oldSession.newPage()
  await oldPage.setViewport({ width: 1440, height: 900 })
  const oldLoginUrl = await loginWithPassword(oldPage, OLD_PASSWORD)
  check(!oldLoginUrl.includes(':8090/'), '测试账号可用原密码建立旧登录会话', oldLoginUrl)

  const context = await browser.createBrowserContext()
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(`${SSO}/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  await clickButton(page, '忘记密码？')
  await page.waitForSelector('.auth-reset-back', { timeout: 10000 })
  const resetText = await page.evaluate(() => document.body.innerText)
  check(['找回密码', '注册手机号', '短信验证码', '新密码', '确认新密码']
    .every((label) => resetText.includes(label)), '登录页已提供完整自助找回密码表单')

  await fill(page, 'input[autocomplete="tel"]', PHONE)
  const sendResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/sso/sms/code'),
    { timeout: 10000 },
  )
  await clickButton(page, '获取验证码')
  const sent = await sendResponse
  const sentBody = await sent.json()
  check(sent.ok() && sentBody.code === 0, '找回密码验证码接口发送成功')

  const code = readResetCode()
  check(/^\d{6}$/.test(code), '（联调侧）dev 通道取到找回密码验证码', code ? `长度 ${code.length}` : '空')
  await fill(page, 'input[maxlength="6"]', code)
  const passwordInputs = await page.$$('input[autocomplete="new-password"]')
  await passwordInputs[0].evaluate((input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, NEW_PASSWORD)
  await passwordInputs[1].evaluate((input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, NEW_PASSWORD)

  const resetResponse = page.waitForResponse(
    (response) => response.url().endsWith('/api/v1/sso/password-reset'),
    { timeout: 10000 },
  )
  await clickButton(page, '确认重置密码')
  const reset = await resetResponse
  const resetBody = await reset.json()
  passwordChanged = reset.ok() && resetBody.code === 0
  check(passwordChanged, '手机号验证码重置密码真实落库')
  await page.waitForFunction(
    () => document.body.innerText.includes('密码已重置，请使用新密码登录'),
    { timeout: 10000 },
  )
  check(true, '重置成功后返回密码登录并给出明确提示')

  const oldLogin = await api('/api/v1/sso/login-standalone', {
    phone: PHONE,
    password: OLD_PASSWORD,
    marketId: 1,
  })
  check(oldLogin.body.code !== 0, '旧密码在重置后无法登录')

  const newLoginUrl = await loginWithPassword(page, NEW_PASSWORD)
  check(!newLoginUrl.includes(':8090/'), '新密码可正常登录并回跳业务系统', newLoginUrl)

  await oldPage.goto(
    `${SSO}/api/v1/sso/authorize?client_id=portal`
      + '&redirect_uri=http%3A%2F%2Flocalhost%3A8098%2Fportal%2F&state=e2e-reset',
    { waitUntil: 'networkidle2', timeout: 60000 },
  )
  await sleep(800)
  check(oldPage.url().includes(':8090/login'), '重置密码后旧 SSO 会话已失效', oldPage.url())
  await oldSession.close()
  await context.close()
} finally {
  if (passwordChanged) {
    resetSmsState()
    const sent = await api('/api/v1/sso/sms/code', { phone: PHONE, scene: 'reset_password' })
    const code = sent.body.code === 0 ? readResetCode() : ''
    if (code) {
      await api('/api/v1/sso/password-reset', {
        phone: PHONE,
        code,
        newPassword: OLD_PASSWORD,
        confirmPassword: OLD_PASSWORD,
      })
    }
    resetSmsState()
    const restored = await api('/api/v1/sso/login-standalone', {
      phone: PHONE,
      password: OLD_PASSWORD,
      marketId: 1,
    })
    check(restored.body.code === 0, '测试账号原密码已恢复')
  }
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) process.exitCode = 1
