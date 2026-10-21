#!/usr/bin/env node
/** 个人中心主体级团队与角色权限回归（2026-10-21）。 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const PORTAL = 'http://localhost:8098/portal/'
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'
const account = { phone: '19900002005', password: 'Test12345' }
const memberName = `主体团队测试${Date.now().toString().slice(-5)}`
const memberPhone = `136${String(Date.now()).slice(-8)}`

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fill = async (page, selector, value) => {
  await page.evaluate(({ target, next }) => {
    const input = document.querySelector(target)
    if (!input) throw new Error(`未找到输入框 ${target}`)
    const proto = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, next)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, { target: selector, next: value })
}

const clickTab = async (page, label) => {
  await page.evaluate((text) => {
    const button = [...document.querySelectorAll('.account-menu button')]
      .find((item) => item.textContent?.includes(text))
    if (!button) throw new Error(`未找到页签 ${text}`)
    button.click()
  }, label)
  await sleep(250)
}

const clickButton = async (page, label, selector = 'button') => {
  const clicked = await page.evaluate(({ text, sel }) => {
    const button = [...document.querySelectorAll(sel)]
      .find((item) => item.textContent?.replace(/\s/g, '').includes(text.replace(/\s/g, '')))
    button?.click()
    return Boolean(button)
  }, { text: label, sel: selector })
  if (!clicked) throw new Error(`未找到按钮 ${label}`)
  await sleep(250)
}

let cleanup = null
const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] })
try {
  const page = await browser.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewport({ width: 1440, height: 1000 })
  await page.goto(PORTAL, { waitUntil: 'networkidle2', timeout: 60000 })

  const login = await page.evaluate(async ({ phone, password }) => {
    const response = await fetch('/api/v1/sso/login-standalone', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: phone, password, marketId: 1, remember: false }),
    })
    return await response.json()
  }, account)
  check(login.code === 0 && login.data?.stage === 'done', '主体团队测试账号登录成功')

  const request = async (url, init = {}) => page.evaluate(async ({ target, options }) => {
    const response = await fetch(target, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    return await response.json()
  }, { target: url, options: init })

  const refreshed = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}',
    })
    return await response.json()
  })
  const token = refreshed.data?.accessToken
  const production = async (url, init = {}) => {
    const response = await fetch(`http://localhost:8098/api/v1/production${url}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(init.headers || {}),
      },
    })
    return await response.json()
  }
  check(Boolean(token), '取得个人中心生产域访问令牌')

  const originalSummary = await request('/api/v1/sso/account/summary')
  const originalActive = originalSummary.data?.activeMerchantId
  check(Boolean(originalActive), '读取原当前主体', originalActive || '')
  const originalRoles = await production('/members/roles')
  const originalOwnerRole = originalRoles.data?.find((role) => role.roleCode === 'FARM_OWNER')
  check([0, 200].includes(originalRoles.code) && Boolean(originalOwnerRole),
    '原主体角色数据可读取')

  const creditCode = `91370783${Date.now().toString().slice(-10)}`
  const created = await request('/api/v1/sso/account/businesses', {
    method: 'POST',
    body: JSON.stringify({
      identity: 'enterprise',
      companyName: `团队角色测试企业${Date.now().toString().slice(-4)}`,
      creditCode,
      industry: '粮油产业',
      companySize: '小型（20-100人）',
      address: '测试地址',
      contactName: '测试联系人',
    }),
  })
  const afterCreate = await request('/api/v1/sso/account/summary')
  const added = (afterCreate.data?.merchants ?? []).find((merchant) =>
    merchant.creditCode === creditCode)
  check(created.code === 0 && Boolean(added), '创建主体级团队测试主体', added?.merchantName || '')

  const switched = await request(`/api/v1/sso/account/businesses/${added.merchantId}/activate`, {
    method: 'POST',
  })
  check(switched.code === 0, '切换到团队测试主体')
  cleanup = { userId: originalSummary.data.userId, merchantId: added.merchantId, originalActive }

  await page.goto(`${PORTAL}#/account?tab=team`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.account-team-panel', { timeout: 20000 })
  const teamText = await page.evaluate(() => document.body.innerText)
  check(teamText.includes(added.merchantName) && teamText.includes('团队与成员'),
    '个人中心团队页显示当前主体')

  await clickButton(page, '邀请成员')
  await page.waitForSelector('.account-team-modal', { timeout: 10000 })
  const inputs = await page.$$('.account-team-modal input')
  await inputs[0].click({ clickCount: 3 })
  await inputs[0].type(memberName)
  await inputs[1].type(memberPhone)
  await clickButton(page, '发送邀请', '.account-team-modal .account-form-actions button')
  await page.waitForFunction((name) => document.body.innerText.includes(name),
    { timeout: 10000 }, memberName)
  check((await page.evaluate(() => document.querySelector('.account-team-table')?.innerText || ''))
    .includes(memberName), '在当前主体下真实邀请成员并显示')
  await page.screenshot({ path: path.join(OUT, 'account-team-members.png'), fullPage: true })

  await clickTab(page, '角色与权限')
  await page.waitForSelector('.account-role-card', { timeout: 15000 })
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.account-role-card')]
      .find((item) => item.textContent?.includes('FARM_OWNER'))
    card?.click()
  })
  await page.waitForSelector('.account-permission-groups', { timeout: 10000 })
  check((await page.evaluate(() => document.body.innerText)).includes('配置权限 · 农场主'),
    '打开主体内农场主权限配置')
  await clickButton(page, '按角色模板填充')
  await page.waitForFunction(() => {
    const text = document.querySelector('.account-permission-toolbar')?.textContent || ''
    const match = text.match(/已选\s*(\d+)\s*个权限点/)
    return match && Number(match[1]) > 0
  }, { timeout: 10000 })
  const [saveResponse] = await Promise.all([
    page.waitForResponse((response) =>
      response.url().includes('/members/roles/') && response.url().endsWith('/permissions')
      && response.request().method() === 'PUT', { timeout: 15000 }),
    clickButton(page, '保存权限'),
  ])
  const saveBody = await saveResponse.json()
  check(saveResponse.ok() && [0, 200].includes(saveBody.code),
    '浏览器保存角色权限请求成功', saveBody.message || '')
  await sleep(1200)

  const newRoles = await production('/members/roles')
  const newOwnerRole = newRoles.data?.find((role) => role.roleCode === 'FARM_OWNER')
  check([0, 200].includes(newRoles.code) && (newOwnerRole?.permissions?.length ?? 0) > 0,
    '角色权限保存到当前主体', String(newOwnerRole?.permissions?.length ?? 0))
  check(newOwnerRole?.roleId !== originalOwnerRole?.roleId,
    '不同主体拥有独立角色记录')

  await request(`/api/v1/sso/account/businesses/${originalActive}/activate`, { method: 'POST' })
  await sleep(2300)
  const restoredRoles = await production('/members/roles')
  const restoredOwnerRole = restoredRoles.data?.find((role) => role.roleCode === 'FARM_OWNER')
  check(JSON.stringify([...(restoredOwnerRole?.permissions ?? [])].sort())
    === JSON.stringify([...(originalOwnerRole?.permissions ?? [])].sort()),
  '切回原主体后角色权限不受新主体配置影响')

  await page.goto(`${PORTAL}#/account?tab=team`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.account-team-panel', { timeout: 20000 })
  const restoredTeam = await page.evaluate(() => document.querySelector('.account-team-table')?.innerText || '')
  check(!restoredTeam.includes(memberName), '切回原主体后不显示新主体团队成员')

  await page.goto(`${PORTAL}#/account?tab=roles`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.account-role-card', { timeout: 20000 })
  await page.screenshot({ path: path.join(OUT, 'account-team-roles.png'), fullPage: true })
  check(errors.length === 0, '个人中心团队与角色页面无脚本异常', errors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '主体团队与角色回归未抛异常', String(error).slice(0, 280))
} finally {
  if (cleanup) {
    try {
      execFileSync('C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe',
        ['-uroot', '--batch', '-e',
          `UPDATE agri_core.platform_merchant_certification SET deleted=1 WHERE merchant_id=${cleanup.merchantId}; DELETE FROM agri_production.agri_prod_member WHERE tenant_id='${cleanup.merchantId}'; DELETE FROM agri_production.agri_prod_role WHERE tenant_id='${cleanup.merchantId}'; DELETE FROM agri_core.platform_user_merchant WHERE merchant_id=${cleanup.merchantId}; DELETE FROM agri_core.platform_merchant WHERE id=${cleanup.merchantId};`],
        { env: { ...process.env, MYSQL_PWD: 'root' } })
      check(true, '团队角色测试数据已清理')
    } catch {
      check(false, '团队角色测试数据清理失败')
    }
  }
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
