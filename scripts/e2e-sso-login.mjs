#!/usr/bin/env node
/**
 * 联调：**统一认证中心**的登录方式（2026-10-16 口口径）。
 *
 * <p>本轮落地：登录页改成三个 Tab（手机号登录 / 账号密码 / 微信扫码），
 * 其中**手机号 + 密码**可真跑通（账号表 {@code platform_user.phone} + AuthService 支持按手机号查账号），
 * 微信扫码与手机验证码/注册**依赖外部凭据**，页面上如实说明依赖、不放会失败的按钮。</p>

 *
 * <p>本脚本走**完整 SSO 链路**：子系统登录入口 → SsoHandoff → 认证中心 /authorize → 登录页 →
 * 提交手机号+密码 → 服务端签授权码并回跳 → 子系统 /sso/callback 换票 → 落到业务页。</p>

 *
 * 用法：node scripts/e2e-sso-login.mjs [--base=http://localhost] [--phone=13800000001] [--headful]
 * 退出码：0 = 全部通过；1 = 有断言失败。
 */
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
const PHONE = arg('phone', '13800000001')
const PASSWORD = arg('password', 'Admin@123')
const HEADFUL = process.argv.includes('--headful')

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

try {
  // 1) 从用户端登录入口走 SSO 交接（SsoHandoff 会把未登录访客送去统一认证中心）
  await page.goto(`${BASE_URL}/production/login`, { waitUntil: 'networkidle2', timeout: 60000 })
  for (let i = 0; i < 20; i++) {
    await sleep(600)
    if (page.url().includes(':8090/')) break
  }
  check(page.url().includes(':8090/'), '登录入口把访客送到统一认证中心', page.url())

  const ssoText = await page.evaluate(() => document.body.innerText)
  check(ssoText.includes('统一认证中心'), '认证中心登录页已渲染')
  check(ssoText.includes('手机号登录') && ssoText.includes('账号密码') && ssoText.includes('微信扫码'),
    '登录页有三个 Tab：手机号登录 / 账号密码 / 微信扫码')

  // 2) 微信扫码：本轮未接入（缺开放平台凭据），页面必须**如实说明**而不是给个假二维码
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((el) => (el.textContent ?? '').includes('微信扫码'))
    tab?.click()
  })
  await sleep(400)
  const wechatText = await page.evaluate(() => document.body.innerText)
  check(wechatText.includes('尚未接入') && wechatText.includes('AppID'),
    '「微信扫码」如实说明依赖（未配置凭据），不伪造二维码',
    wechatText.replace(/\s+/g, ' ').slice(0, 90))

  // 3) 手机号 + 密码登录：走完整 SSO 链路
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll('button[role="tab"]')]
      .find((el) => (el.textContent ?? '').includes('手机号登录'))
    tab?.click()
  })
  await sleep(300)
  await page.evaluate((phone) => {
    const input = document.querySelector('input[autocomplete="tel"]')
    if (!input) throw new Error('未找到手机号输入框')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, phone)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, PHONE)
  await page.evaluate((pwd) => {
    const input = document.querySelector('input[type="password"]')
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(input, pwd)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, PASSWORD)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button[type="submit"]')]
      .find((b) => (b.textContent ?? '').includes('登'))
    btn?.click()
  })

  // 4) 等回跳到子系统（授权码换票后落在业务页）
  let landed = page.url()
  for (let i = 0; i < 25; i++) {
    await sleep(700)
    if (page.url() !== landed) landed = page.url()
    if (landed.startsWith(BASE_URL) && !landed.includes('/login')) break
  }
  await page.waitForNetworkIdle({ idleTime: 800, timeout: 15000 }).catch(() => {})
  check(landed.startsWith(BASE_URL) && !landed.includes('/login') && !landed.includes(':8090'),
    '手机号+密码登录后回跳到子系统业务页（SSO 链路打通）', landed)
  const appText = await page.evaluate(() => document.body.innerText)
  check(appText.length > 50 && !appText.includes('正在跳转到统一认证中心'),
    '子系统页面已按登录态渲染', appText.replace(/\s+/g, ' ').slice(0, 70))
} catch (error) {
  check(false, '脚本执行未抛异常', String(error).slice(0, 160))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
