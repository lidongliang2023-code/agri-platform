#!/usr/bin/env node
/** 官网门户个人中心全链路回归（2026-10-21）。 */
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
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const account = { phone: '19900002005', password: 'Test12345', nickname: '页面注册企业测试有限公司' }

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const redisCode = (phone) => execFileSync(
  'C:\\Redis\\redis-cli.exe',
  ['--raw', 'GET', `agri:sms:code:change_phone:${phone}`],
  { encoding: 'utf8' },
).trim()

const validId = () => {
  const base = `11010519900101${String(Date.now()).slice(-3).padStart(3, '0')}`
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const sum = base.split('').reduce((total, char, index) => total + Number(char) * weights[index], 0)
  return base + codes[sum % 11]
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
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
  check(login.code === 0 && login.data?.stage === 'done', '账号中心测试账号登录成功')

  await page.goto(`${PORTAL}#/account`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.account-page', { timeout: 20000 })
  await page.waitForSelector('.account-tabs button', { timeout: 20000 })
  check((await page.$$eval('.account-tabs button', (items) => items.length)) === 4,
    '个人中心四个功能分区齐全')

  const request = async (path, init = {}) => page.evaluate(async ({ url, options }) => {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    return await response.json()
  }, { url: path, options: init })

  const original = await request('/api/v1/sso/account/summary')
  check(original.code === 0 && original.data?.username === account.phone, '账号摘要读取真实平台用户')

  const testNickname = `账号中心测试${Date.now().toString().slice(-6)}`
  const profileSave = await request('/api/v1/sso/account/profile', {
    method: 'PUT',
    body: JSON.stringify({ nickname: testNickname, email: 'account-center@example.com' }),
  })
  const afterProfile = await request('/api/v1/sso/account/summary')
  check(profileSave.code === 0 && afterProfile.data?.nickname === testNickname
    && afterProfile.data?.email === 'account-center@example.com', '个人资料修改真实落库')
  const profileRestore = await request('/api/v1/sso/account/profile', {
    method: 'PUT',
    body: JSON.stringify({ nickname: original.data.nickname, email: original.data.email }),
  })
  check(profileRestore.code === 0, '个人资料测试后恢复原值')

  const tempPassword = 'Test12346'
  const passwordChange = await request('/api/v1/sso/account/password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: account.password,
      newPassword: tempPassword,
      confirmPassword: tempPassword,
    }),
  })
  const passwordRestore = await request('/api/v1/sso/account/password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: tempPassword,
      newPassword: account.password,
      confirmPassword: account.password,
    }),
  })
  check(passwordChange.code === 0 && passwordRestore.code === 0, '密码修改与恢复链路真实可用')

  const newPhone = `199${String(Date.now()).slice(-8)}`
  let sms = await request('/api/v1/sso/sms/code', {
    method: 'POST',
    body: JSON.stringify({ phone: newPhone, scene: 'change_phone' }),
  })
  let code = redisCode(newPhone)
  const phoneChange = await request('/api/v1/sso/account/phone', {
    method: 'POST',
    body: JSON.stringify({ phone: newPhone, code }),
  })
  let afterPhone = await request('/api/v1/sso/account/summary')
  check(sms.code === 0 && phoneChange.code === 0 && afterPhone.data?.phone === newPhone,
    '短信验证后手机号变更真实落库', newPhone)

  sms = await request('/api/v1/sso/sms/code', {
    method: 'POST',
    body: JSON.stringify({ phone: account.phone, scene: 'change_phone' }),
  })
  code = redisCode(account.phone)
  const phoneRestore = await request('/api/v1/sso/account/phone', {
    method: 'POST',
    body: JSON.stringify({ phone: account.phone, code }),
  })
  afterPhone = await request('/api/v1/sso/account/summary')
  check(sms.code === 0 && phoneRestore.code === 0 && afterPhone.data?.phone === account.phone,
    '手机号测试后恢复登录账号')

  const addressCreate = await request('/api/v1/sso/account/addresses', {
    method: 'POST',
    body: JSON.stringify({
      receiverName: '账号中心收货人',
      contactPhone: account.phone,
      province: '山东省',
      city: '潍坊市',
      district: '寿光市',
      detailAddress: '账号中心测试路 66 号',
      postalCode: '262700',
      isDefault: true,
    }),
  })
  const addressId = addressCreate.data?.id
  check(addressCreate.code === 0 && addressId, '新增收货地址真实落库')
  const addressUpdate = await request(`/api/v1/sso/account/addresses/${addressId}`, {
    method: 'PUT',
    body: JSON.stringify({
      receiverName: '账号中心收货人',
      contactPhone: account.phone,
      province: '山东省',
      city: '潍坊市',
      district: '寿光市',
      detailAddress: '账号中心测试路 88 号',
      postalCode: '262700',
      isDefault: true,
    }),
  })
  const afterAddress = await request('/api/v1/sso/account/addresses')
  check(addressUpdate.code === 0
    && afterAddress.data?.some((item) => item.id === addressId && item.detailAddress.includes('88 号')),
  '收货地址修改、默认地址和查询可用')

  const realName = await request('/api/v1/sso/account/real-name', {
    method: 'POST',
    body: JSON.stringify({
      realName: '账号中心实名测试',
      idCard: validId(),
      contactPhone: account.phone,
      address: '山东省潍坊市寿光市账号中心路 1 号',
      validStart: '2020-01-01',
      validEnd: '2040-01-01',
      businessType: '家庭农场',
      email: 'account-center@example.com',
    }),
  })
  const afterRealName = await request('/api/v1/sso/account/summary')
  check(realName.code === 0 && afterRealName.data?.realName?.status === 'pending',
    '企业账号也可提交账号级个人实名认证')

  const search = await request('/api/v1/sso/account/businesses/search?keyword=%E7%BB%BF%E6%BA%90')
  const business = (search.data ?? []).find((item) => !item.alreadyJoined)
  check(search.code === 0 && Boolean(business), '可搜索待加入的经营主体', business?.name ?? '')
  let joinId = ''
  if (business) {
    const join = await request('/api/v1/sso/account/businesses/join-requests', {
      method: 'POST',
      body: JSON.stringify({
        merchantId: business.merchantId,
        roleInMerchant: 'buyer',
        message: '账号中心联调申请',
      }),
    })
    joinId = join.data?.id
    const afterJoin = await request('/api/v1/sso/account/summary')
    check(join.code === 0 && afterJoin.data?.sentJoinRequests
      ?.some((item) => item.id === joinId && item.status === 'pending'),
    '加入经营主体申请真实落库并进入待审批')
  }

  await page.reload({ waitUntil: 'networkidle2' })
  await page.waitForSelector('.account-tabs button', { timeout: 20000 })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.account-tabs button')]
      .find((item) => item.textContent?.includes('地址管理'))
    button?.click()
  })
  await page.waitForFunction(() => document.body.innerText.includes('账号中心测试路 88 号'), { timeout: 10000 })
  check(true, '个人中心地址页显示真实地址')
  await page.screenshot({ path: path.join(OUT, 'account-center.png'), fullPage: true })
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${PORTAL}#/account`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.account-tabs button', { timeout: 20000 })
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(mobileOverflow <= 1, '个人中心 390px 无横向溢出', String(mobileOverflow))
  await page.screenshot({ path: path.join(OUT, 'account-center-mobile.png'), fullPage: true })

  const addressDelete = await request(`/api/v1/sso/account/addresses/${addressId}`, { method: 'DELETE' })
  check(addressDelete.code === 0, '收货地址删除可用')
  if (joinId) {
    const cancel = await request(`/api/v1/sso/account/businesses/join-requests/${joinId}`, { method: 'DELETE' })
    check(cancel.code === 0, '加入主体申请可撤回')
  }
  check(errors.length === 0, '个人中心无未捕获脚本异常', errors.slice(0, 2).join(' | '))

  console.log('\n个人中心地址：http://localhost:8098/portal/#/account')
} catch (error) {
  check(false, '个人中心回归未抛异常', String(error).slice(0, 260))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
