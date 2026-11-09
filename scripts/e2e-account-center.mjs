#!/usr/bin/env node
/** 官网门户个人中心全链路回归（2026-10-21）。 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))
const PORTAL = 'http://localhost:8098/portal/'
const GATEWAY = 'http://localhost:8098'
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

/** 直接跑一条 redis-cli（--raw 保证不带类型前缀）。 */
const redisRun = (...args) => execFileSync('C:\\Redis\\redis-cli.exe', ['--raw', ...args],
  { encoding: 'utf8' }).replace(/\r/g, '').trim()
/** 本轮碰过的号码都登记在这里，收尾（含异常路径）统一清掉验证码/计数/冷却键。 */
const smsPhonesTouched = []
const sweepSmsKeys = (phone) => {
  if (!phone) return
  redisRun('KEYS', `agri:sms:*${phone}*`).split('\n').filter(Boolean).forEach((key) => redisRun('DEL', key))
}

const MYSQL_BIN = 'C:\\Program Files\\MySQL\\MySQL Server 8.4\\bin\\mysql.exe'
/**
 * mysql CLI 不带 --default-character-set=utf8mb4 时，中文按控制台代码页（GBK）吐出来，
 * 在 Node 里按 utf8 解就是乱码 —— 任何"拿库里的中文跟页面比"的断言都会假红（本仓库踩过多次）。
 * 另外 Windows 的换行是 \r\n，比较前先归一。
 */
const sql = (statement) => execFileSync(MYSQL_BIN,
  ['-uroot', '--default-character-set=utf8mb4', '--batch', '-N', '-e', statement],
  { encoding: 'utf8', env: { ...process.env, MYSQL_PWD: 'root' } }).replace(/\r/g, '').trim()

/**
 * 从 Node 侧探测能否登录（不进浏览器上下文）。
 *
 * <p>login-standalone 会发新的会话 Cookie，用页面里的 fetch 探测一次就把后面步骤赖以生存的
 * 会话换掉了，所以密码链路的登录校验必须在页面外做。</p>
 */
const loginProbe = async (password) => (await fetch(`${GATEWAY}/api/v1/sso/login-standalone`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: account.phone, password, marketId: 1, remember: false }),
})).json()

/**
 * 本轮造出来的东西，全部登记在这里 —— 清理必须放在 finally。
 *
 * <p>之前清理写在 try 的尾巴上，中途一抛错就整段跳过：实测这个脚本在演示库里
 * 留下了 6 个「账号中心…」经营主体、33 条「账号中心联调申请」、4 条活着的
 * 「账号中心测试路 88 号」收货地址。断言红不红是一回事，把测试数据留在演示主体上是另一回事。</p>
 */
let addedMerchant = null
let addedEnterprise = null
let joinId = ''
let addressId = ''
let platformUserId = ''
let productionMemberId = ''
let passwordHashBefore = ''

const validId = () => {
  const base = `11010519900101${String(Date.now()).slice(-3).padStart(3, '0')}`
  const weights = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
  const codes = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2']
  const sum = base.split('').reduce((total, char, index) => total + Number(char) * weights[index], 0)
  return base + codes[sum % 11]
}

const browser = await chromium.launch({ headless: !HEADFUL, executablePath: BROWSER, args: ['--no-sandbox'] })
try {
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto(PORTAL, { waitUntil: 'networkidle', timeout: 60000 })
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

  await page.goto(`${PORTAL}#/account`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.account-page', { timeout: 20000 })
  await page.waitForSelector('.account-menu-top', { timeout: 20000 })
  /**
   * 侧边栏早就不再是「六个分区」：navModel 现在是分组 + 组内条目（条目本身是 .account-menu-top）。
   * 断言改成「分组齐 + 关键条目在 + 条目数够」，不钉死条目总数——
   * 每接一个子页条目数就会变，钉死只会在下次正常改动时假红。
   */
  const nav = await page.evaluate(() => ({
    groups: [...document.querySelectorAll('.uc-nav-group-title')].map((node) => node.textContent.replace(/\s+/g, '')),
    items: [...document.querySelectorAll('.account-menu-top')].map((node) => node.textContent.replace(/\s+/g, ' ').trim()),
  }))
  check(['账号', '认证', '组织权限', '安全', '消息'].every((label) => nav.groups.includes(label)),
    '个人中心侧边栏按分组渲染', `${nav.groups.length} 组：${nav.groups.join('/')}`)
  check(nav.items.length >= 20 && ['账号总览', '个人实名', '企业实名', '我的组织', '成员管理', '账号安全', '消息中心']
    .every((label) => nav.items.some((item) => item.includes(label))),
  '分组下的条目覆盖各功能页（关键条目齐全）', `${nav.items.length} 项`)
  check(page.url().includes('#/account/overview'), '个人中心默认进入账号总览', page.url())
  check((await page.evaluate(() => document.querySelector('.account-content-head h2')?.textContent?.trim()))
    === '账号总览', '默认页标题与路由一致')
  await page.screenshot({ path: path.join(OUT, 'account-overview.png'), fullPage: true })

  /**
   * 用路由进个人中心某个子页，而不是点侧边栏。
   *
   * <p>侧边栏现在的文案是 navModel 给的「我的组织 / 收货地址」，脚本原先点的是老名字
   * 「主体资料与认证 / 地址管理」—— `button?.click()` 找不到就静默什么都不做，
   * 于是要么靠上一个页面的残留 DOM 蒙对、要么整段断言替没打开的页面说话（实测：
   * 切换主体入口与地址页两连红，红因都是这个静默 no-op）。路由是稳定契约，走路由。</p>
   */
  const openAccountView = async (view) => {
    await page.goto(`${PORTAL}#/account/${view}`, { waitUntil: 'networkidle', timeout: 60000 })
    /**
     * 必须再 reload：SPA 里有些入口（如「去认证」）只改内部 tab、不改地址栏，
     * 此时目标地址和当前地址一字不差 —— goto 同地址既不刷新也不触发 hashchange，
     * 页面还停在原来那个视图上，后面按 DOM 找元素就全空了（实测踩过）。
     */
    await page.reload({ waitUntil: 'networkidle', timeout: 60000 })
    await page.waitForSelector('.account-menu button', { timeout: 20000 })
    await sleep(600)
  }
  const dumpMerchantRows = () => page.evaluate(() => [...document.querySelectorAll('.merchant-row')]
    .map((row) => `${(row.querySelector('.merchant-title strong')?.textContent ?? '').trim()}`
      + `[${[...row.querySelectorAll('.merchant-row-actions button')].map((b) => `${b.textContent?.trim()}${b.disabled ? '(禁用)' : ''}`).join(',')}]`)
    .join(' / '))
  /**
   * 等某一家的行真的渲染出来再操作。
   *
   * <p>只等 .merchant-row 会拿到 SPA 缓存摘要渲染的第一帧 —— 那时新建的主体还不在里面，
   * 于是"按名字找行"落空、退去找别的行，后面所有断言都在替别家主体说话（实测踩过：
   * 企业认证弹窗与切换入口两连红，红的是同一件事）。</p>
   */
  const waitForMerchantRow = async (name) => {
    try {
      await page.waitForFunction((rowName) => [...document.querySelectorAll('.merchant-row')]
        .some((row) => (row.querySelector('.merchant-title strong')?.textContent ?? '').trim() === rowName),
      name, { timeout: 20000 })
      return true
    } catch {
      check(false, `主体列表渲染出「${name}」这一行`, `当前只有：${await dumpMerchantRows()}`)
      return false
    }
  }

  await page.goto(`${PORTAL}#/account/profile`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.account-profile-overview', { timeout: 10000 })
  check((await page.evaluate(() => document.body.innerText)).includes('账号概况')
    && !(await page.$('.account-profile-edit')), '账号资料菜单默认显示只读账号概况')
  await page.screenshot({ path: path.join(OUT, 'account-profile-overview.png'), fullPage: true })

  /**
   * 修改密码 / 变更手机号已经不是侧边栏子菜单（旧 .account-submenu 只剩 CSS，DOM 里没有对应节点），
   * 现在入口在账号资料**编辑页**的「需要修改登录信息？」区块，点了才落到 #/account/security/*。
   */
  const clickByText = async (selector, text) => page.evaluate(({ sel, label }) => {
    const hit = [...document.querySelectorAll(sel)].find((item) => (item.textContent ?? '').includes(label))
    if (!hit) throw new Error(`未找到 ${sel} 里的「${label}」`)
    hit.click()
  }, { sel: selector, label: text })

  await clickByText('.account-profile-overview .account-card-head button', '编辑账号资料')
  await page.waitForFunction(() => window.location.hash === '#/account/profile/edit', undefined, { timeout: 10000 })
  await page.waitForSelector('.account-profile-edit', { timeout: 10000 })
  const securityEntries = await page.$$eval('.account-profile-security-entry button',
    (items) => items.map((item) => `${item.textContent?.trim()}${item.disabled ? '(禁用)' : ''}`))
  check(securityEntries.join('|') === '修改密码|变更手机号',
    '账号资料编辑页提供修改密码与变更手机号入口', securityEntries.join('/'))
  await page.screenshot({ path: path.join(OUT, 'account-security-menu.png'), fullPage: true })
  await clickByText('.account-profile-security-entry button', '修改密码')
  await page.waitForFunction(() => window.location.hash === '#/account/security/password', undefined, { timeout: 10000 })
  check((await page.evaluate(() => document.querySelector('.account-content-head h2')?.textContent))
    === '修改密码', '从账号资料入口进入修改密码页面')
  await page.screenshot({ path: path.join(OUT, 'account-security-password.png'), fullPage: true })
  await page.goto(`${PORTAL}#/account/profile/edit`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.account-profile-security-entry button', { timeout: 10000 })
  await clickByText('.account-profile-security-entry button', '变更手机号')
  await page.waitForFunction(() => window.location.hash === '#/account/security/phone', undefined, { timeout: 10000 })
  check((await page.evaluate(() => document.querySelector('.account-content-head h2')?.textContent))
    === '变更手机号', '从账号资料入口进入变更手机号页面')
  await page.screenshot({ path: path.join(OUT, 'account-security-phone.png'), fullPage: true })
  check((await page.evaluate(() => document.querySelector('.account-content-head')?.innerText.replace(/\s+/g, ' ')))
    .includes('账号安全 / 变更手机号'), '面包屑跟随子页显示所属分组',
  await page.evaluate(() => document.querySelector('.account-content-head span')?.textContent ?? ''))
  await page.goto(`${PORTAL}#/account/profile`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.account-profile-overview', { timeout: 10000 })
  check(true, '安全子页处理完可回到账号概况')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.account-profile-overview button')]
      .find((item) => item.textContent?.includes('编辑账号资料'))
    button?.click()
  })
  await page.waitForFunction(() => window.location.hash === '#/account/profile/edit', undefined, { timeout: 10000 })
  await page.waitForSelector('.account-profile-edit', { timeout: 10000 })
  check(true, '点击编辑进入独立的账号资料页面')
  const editInputTops = await page.$$eval('.account-profile-edit .account-form-grid input',
    (inputs) => inputs.map((input) => Math.round(input.getBoundingClientRect().top)))
  check(editInputTops.length === 2 && Math.max(...editInputTops) - Math.min(...editInputTops) <= 1,
    '编辑账号资料字段输入框顶部对齐', editInputTops.join('/'))
  await page.screenshot({ path: path.join(OUT, 'account-profile-edit.png'), fullPage: true })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('.account-profile-edit button')]
      .find((item) => item.textContent?.trim() === '取消')
    button?.click()
  })
  await page.waitForFunction(() => window.location.hash === '#/account/profile', undefined, { timeout: 10000 })
  await page.waitForSelector('.account-profile-overview', { timeout: 10000 })
  check(true, '取消编辑返回账号概况页面')

  const request = async (path, init = {}) => page.evaluate(async ({ url, options }) => {
    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    return await response.json()
  }, { url: path, options: init })

  const uploadCertificationDocument = async (merchantId, kind, invalid = false) => page.evaluate(
    async ({ targetMerchantId, documentKind, invalidImage }) => {
      let blob
      if (invalidImage) {
        blob = new Blob(['not-an-image'], { type: 'image/png' })
      } else {
        const canvas = document.createElement('canvas')
        canvas.width = 480
        canvas.height = 300
        const context = canvas.getContext('2d')
        context.fillStyle = documentKind === 'business_license' ? '#e6f4ec' : '#fff5d6'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.fillStyle = '#174e34'
        context.font = 'bold 32px sans-serif'
        context.fillText(documentKind, 28, 150)
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      }
      const body = new FormData()
      body.append('file', new File([blob], `${documentKind}.png`, { type: blob.type }))
      const response = await fetch(
        `/api/v1/sso/account/businesses/${targetMerchantId}/certification-files?kind=${encodeURIComponent(documentKind)}`,
        { method: 'POST', credentials: 'include', body },
      )
      return { status: response.status, ...(await response.json()) }
    },
    { targetMerchantId: merchantId, documentKind: kind, invalidImage: invalid },
  )

  const original = await request('/api/v1/sso/account/summary')
  check(original.code === 0 && original.data?.username === account.phone, '账号摘要读取真实平台用户')
  const initialActiveMerchantId = original.data?.activeMerchantId
  check(Boolean(initialActiveMerchantId)
    && original.data?.merchants?.filter((item) => item.merchantId === initialActiveMerchantId).length === 1,
  '登录会话只解析出一个当前主体', initialActiveMerchantId ?? '')

  /**
   * 取一个平台访问令牌给后面的"主体范围"用例用。
   *
   * <p>先按真实前端的方式在浏览器里 refresh；refresh 目前被"按子系统隔离刷新令牌"这条
   * 在改的口径挡住（见下面的 console 说明），所以拿不到时退回脚本侧登录 ——
   * 两条路都要打印是哪条通的，不能悄悄换一条就当作前端没问题。</p>
   */
  const refreshedSession = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    return await response.json()
  })
  let accessToken = refreshedSession.data?.accessToken
  let tokenSource = '浏览器 /api/v1/auth/refresh'
  if (!accessToken) {
    console.log(`· 浏览器内 refresh 未拿到令牌（code=${refreshedSession.code} ${refreshedSession.message}）：`
      + 'core-platform 正在把刷新令牌按子系统分开，而 /sso/login-standalone 只写全局 agri_refresh_token，'
      + '浏览器请求带 Referer/Origin → 服务端按 portal 这个 client 找 agri_refresh_token_portal 找不到。'
      + '本轮改用脚本侧登录取令牌，这条产品缺口单独上报。')
    const nodeLogin = await (await fetch(`${GATEWAY}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: account.phone, password: account.password, marketId: 1 }),
    })).json()
    accessToken = nodeLogin?.data?.accessToken
    tokenSource = '脚本侧 /api/v1/auth/login'
  }
  check(Boolean(accessToken), '可获取平台访问令牌用于主体范围验证', `来源：${tokenSource}`)

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
  const afterRestore = await request('/api/v1/sso/account/summary')
  /** 恢复必须读回比对：邮箱原本没绑（null），只断言 code=0 的话"清不掉"这件事就悄悄留着了。 */
  check(profileRestore.code === 0 && afterRestore.data?.nickname === original.data.nickname
    && (afterRestore.data?.email ?? null) === (original.data.email ?? null),
  '个人资料测试后恢复原值', `email=${JSON.stringify(afterRestore.data?.email)}`)

  /**
   * 密码链路：先备份 bcrypt 哈希，验完用哈希还原。
   *
   * <p>不能用"再改回去"收尾：运营端参数配置开了弱口令拦截，演示账号的 Test12345 含
   * 1234 顺子，会被自家策略拒（实测 code=400 密码过于简单），所以还原只能落到库里的哈希。
   * 临时密码 Nd7968kqm 是按当前策略挑的（8-20 位、大小写 + 数字、无 4 位顺子、不含手机号尾段）。</p>
   *
   * <p>登录探测走 Node fetch 而不是页面上下文：login-standalone 会换掉会话 Cookie，
   * 在页面里探测会把后面的步骤换一个会话。</p>
   */
  const tempPassword = 'Nd7968kqm'
  platformUserId = String(original.data.userId)
  passwordHashBefore = sql(
    `SELECT password FROM agri_core.platform_user WHERE id=${platformUserId};`,
  )
  check(/^\$2a\$/.test(passwordHashBefore), '改密前备份到真实 bcrypt 哈希',
    passwordHashBefore.slice(0, 7))

  const wrongCurrent = await request('/api/v1/sso/account/password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: 'NotTheCurrent1', newPassword: tempPassword, confirmPassword: tempPassword,
    }),
  })
  check(wrongCurrent.code === 400 && /当前密码不正确/.test(wrongCurrent.message ?? ''),
    '当前密码不对时改密被拒并说明原因', `code=${wrongCurrent.code} ${wrongCurrent.message ?? ''}`)

  const weakNext = await request('/api/v1/sso/account/password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: account.password, newPassword: 'Test12346', confirmPassword: 'Test12346',
    }),
  })
  check(weakNext.code === 400 && /过于简单/.test(weakNext.message ?? ''),
    '弱口令新密码被策略拒绝并说明原因', `code=${weakNext.code} ${weakNext.message ?? ''}`)

  const passwordChange = await request('/api/v1/sso/account/password', {
    method: 'POST',
    body: JSON.stringify({
      currentPassword: account.password,
      newPassword: tempPassword,
      confirmPassword: tempPassword,
    }),
  })
  const loginWithTemp = await loginProbe(tempPassword)
  const loginWithOld = await loginProbe(account.password)
  check(passwordChange.code === 0 && loginWithTemp.code === 0 && loginWithTemp.data?.stage === 'done'
    && loginWithOld.code !== 0,
    '改密后新密码可登录、旧密码失效',
    `改密 code=${passwordChange.code} 新密码登录=${loginWithTemp.code} 旧密码登录=${loginWithOld.code} ${passwordChange.message ?? ''}`)

  sql(`UPDATE agri_core.platform_user SET password='${passwordHashBefore}' WHERE id=${platformUserId};`)
  const loginRestored = await loginProbe(account.password)
  check(loginRestored.code === 0 && loginRestored.data?.stage === 'done',
    '密码修改与恢复链路真实可用（原哈希已还原）', `恢复后登录 code=${loginRestored.code}`)

  /* ─────────── 绑定手机号：一条正链路 + 六条负分支（2026-11-03 重构） ───────────
   *
   * 旧版只有"发码 → 改 → 改回来"三步，且发码走的是**公开**端点 `/api/v1/sso/sms/code`。
   * 那意味着任何人未登录都能对任意手机号发换绑码（骚扰 + 把对方刚收到的码顶掉），
   * 而且"号码已被占用""号码没变"这类冲突要等用户填完 6 位码才被拒 —— 白烧一条码还要干等 60 秒。
   * 现在换绑发码收在 `POST /api/v1/sso/account/phone/code`（要会话、先判冲突），
   * 真落库仍在 `/phone` 且**占用判定放在验码之后**（发码与提交之间号可能被别人抢走）。
   */
  const codeKey = (phone) => `agri:sms:code:change_phone:${phone}`
  const attemptKey = (phone) => `agri:sms:attempt:change_phone:${phone}`
  const cooldownKey = (phone) => `agri:sms:cooldown:${phone}`
  const sendPhoneCode = (phone) => {
    smsPhonesTouched.push(phone)
    return request('/api/v1/sso/account/phone/code', { method: 'POST', body: JSON.stringify({ phone }) })
  }
  const submitPhone = (phone, code) => request('/api/v1/sso/account/phone', {
    method: 'POST', body: JSON.stringify({ phone, code }),
  })
  /** 永远不等于真码的错码（避免 1/1000000 概率撞对） */
  const otherCode = (real, offset = 1) => String((Number(real) + offset) % 1_000_000).padStart(6, '0')

  const newPhone = `199${String(Date.now()).slice(-8)}`
  const voidPhone = `198${String(Date.now()).slice(-8)}`
  const dailyPhone = `197${String(Date.now()).slice(-8)}`
  const takenPhone = sql(`SELECT phone FROM agri_core.platform_user
    WHERE deleted = 0 AND phone REGEXP '^1[3-9][0-9]{9}$' AND phone <> '${account.phone}' ORDER BY id LIMIT 1`)
  // 上一轮如果中途中断，冷却/计数键会留在这里，把这一轮的第一次发码判成"60 秒内不重发"（假红）。
  ;[newPhone, voidPhone, dailyPhone, account.phone, takenPhone].filter(Boolean).forEach(sweepSmsKeys)

  const publicSend = await request('/api/v1/sso/sms/code', {
    method: 'POST', body: JSON.stringify({ phone: newPhone, scene: 'change_phone' }),
  })
  check(publicSend.code !== 0 && /账号中心/.test(String(publicSend.message ?? '')),
    '负分支：公开端点拒绝换绑场景的发码', String(publicSend.message ?? '').slice(0, 46))

  const anonSend = await (await fetch(`${GATEWAY}/api/v1/sso/account/phone/code`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: newPhone }),
  })).json()
  check(anonSend.code !== 0 && /登录/.test(String(anonSend.message ?? '')),
    '负分支：没有会话就发不出换绑验证码', `code=${anonSend.code} ${String(anonSend.message ?? '').slice(0, 26)}`)

  const sameSend = await sendPhoneCode(account.phone)
  check(sameSend.code !== 0 && /相同/.test(String(sameSend.message ?? ''))
    && redisRun('EXISTS', codeKey(account.phone)) === '0',
  '负分支：新号与当前绑定号相同时直接拒，且不产生验证码', String(sameSend.message ?? '').slice(0, 40))

  if (/^1[3-9]\d{9}$/.test(String(takenPhone))) {
    const takenSend = await sendPhoneCode(takenPhone)
    check(takenSend.code !== 0 && /已绑定其他账号/.test(String(takenSend.message ?? '')),
      '负分支：号码已被别的账号占用时不发码', `${takenPhone}｜${String(takenSend.message ?? '').slice(0, 30)}`)
  } else {
    check(false, '负分支：号码已被别的账号占用时不发码', `演示库里找不到可借用的他人号码（takenPhone=${takenPhone}）`)
  }

  const firstSend = await sendPhoneCode(newPhone)
  check(firstSend.code === 0 && firstSend.data?.sent === true,
    '换绑发码走账号中心（登录态）成功', `devMode=${firstSend.data?.devMode} hint=${String(firstSend.data?.hint ?? '').slice(0, 26)}`)
  const phoneCode = redisCode(newPhone)
  check(/^\d{6}$/.test(String(phoneCode)) && !JSON.stringify(firstSend).includes(phoneCode),
    '验证码只进 Redis/日志，响应体里没有明文码', `Redis=${phoneCode}`)
  const resend = await sendPhoneCode(newPhone)
  check(resend.code !== 0 && /60 秒/.test(String(resend.message ?? '')),
    '负分支：60 秒内不重发', String(resend.message ?? '').slice(0, 30))

  const wrongTry = await submitPhone(newPhone, otherCode(phoneCode))
  check(wrongTry.code !== 0 && /还可试 4 次/.test(String(wrongTry.message ?? '')),
    '负分支：错码只计一次错误，好码仍然可用', String(wrongTry.message ?? '').slice(0, 30))
  const bound = await submitPhone(newPhone, phoneCode)
  check(bound.code === 0 && bound.data?.loginNameChanged === true,
    '正分支：换绑成功并回报"登录名同步变更"（该账号登录名就是手机号）', JSON.stringify(bound.data ?? {}).slice(0, 60))
  const afterBound = await request('/api/v1/sso/account/summary')
  check(afterBound.data?.phone === newPhone && afterBound.data?.username === newPhone,
    '换绑后手机号与登录名都真的落到库里', `phone=${afterBound.data?.phone} username=${afterBound.data?.username}`)

  const voidSend = await sendPhoneCode(voidPhone)
  const voidCode = redisCode(voidPhone)
  let voidLast = ''
  for (let i = 0; i < 5; i += 1) {
    const tried = await submitPhone(voidPhone, otherCode(voidCode, i + 1))
    voidLast = String(tried.message ?? '')
  }
  check(voidSend.code === 0 && /错满 5 次/.test(voidLast),
    '负分支：连续错满 5 次本条立即作废（不再是错第 6 次才作废）', voidLast.slice(0, 44))
  const voidReuse = await submitPhone(voidPhone, voidCode)
  check(voidReuse.code !== 0 && /过期或未发送/.test(String(voidReuse.message ?? ''))
    && redisRun('EXISTS', codeKey(voidPhone)) === '0' && redisRun('EXISTS', attemptKey(voidPhone)) === '0',
  '作废后连正确码也不再接受，Redis 里这条码与计数都已清掉', String(voidReuse.message ?? '').slice(0, 30))

  /* ── 真机：换绑手机页面（禁用语义 + 同号提醒 + 成功后写清登录名变了） ── */
  await openAccountView('security/phone')
  const phoneInputs = page.locator('.account-phone-form input')
  const sendButton = page.locator('.account-phone-form .account-code-row button')
  const submitButton = page.locator('.account-phone-form button.btn-primary')
  check(await sendButton.isDisabled(), '刚进页面时「获取验证码」不可点（还没填号码）')
  await phoneInputs.first().fill(newPhone)
  await sleep(400)
  const sameNumberWarn = await page.evaluate(() => document.querySelector('.account-phone-form .account-field-warning')?.innerText.replace(/\s+/g, ' ') ?? '')
  check(await sendButton.isDisabled() && sameNumberWarn.includes('就是当前绑定的号码'),
    '填成当前绑定的号码时页面当场提醒，按钮仍不可点', sameNumberWarn.slice(0, 40))
  await phoneInputs.first().fill(account.phone)
  await sleep(400)
  check(!(await sendButton.isDisabled()), '换成新号码后「获取验证码」解禁')
  check(await submitButton.isDisabled(), '没填验证码时「确认变更」不可点（不会把空码送去后端）')
  await sendButton.click()
  const uiWaitCode = await (async () => {
    for (let i = 0; i < 40; i += 1) {
      const value = redisCode(account.phone)
      if (/^\d{6}$/.test(String(value))) return value
      await sleep(250)
    }
    return ''
  })()
  check(Boolean(uiWaitCode), '页面上点「获取验证码」真的走通了发码链路', `Redis=${uiWaitCode}`)
  const uiNotice = await page.evaluate(() => document.querySelector('.account-notice')?.innerText.replace(/\s+/g, ' ') ?? '')
  check(uiNotice.includes('验证码已'), '发码结果用真实提示告知（含开发通道说明）', uiNotice.slice(0, 40))
  await phoneInputs.nth(1).fill(otherCode(uiWaitCode))
  await sleep(300)
  check(await submitButton.isEnabled(), '填了 6 位码后「确认变更」解禁（不管码对不对，对错由服务端判）')
  await phoneInputs.nth(1).fill(uiWaitCode)
  await sleep(200)
  await submitButton.click()
  /*
   * 提示要在点的当下就抓：flash 几秒后自动消失，而下面轮询库要跑好几轮 SQL ——
   * 先轮库再读文案，读到的是"提示已经没了"的页面（上一轮这条就是这么假红的）。
   */
  const submitNotice = await (async () => {
    for (let i = 0; i < 40; i += 1) {
      const text = await page.evaluate(() => document.querySelector('.account-notice')?.innerText.replace(/\s+/g, ' ') ?? '')
      if (text.includes('已变更')) return text
      await sleep(150)
    }
    return ''
  })()
  const restoredPhone = await (async () => {
    for (let i = 0; i < 40; i += 1) {
      const row = sql(`SELECT CONCAT(phone,'|',username) FROM agri_core.platform_user WHERE id=${platformUserId}`)
      if (row === `${account.phone}|${account.phone}`) return row
      await sleep(250)
    }
    return sql(`SELECT CONCAT(phone,'|',username) FROM agri_core.platform_user WHERE id=${platformUserId}`)
  })()
  check(submitNotice.includes('登录名同步'), '换绑成功的提示写清"登录名同步改为新手机号"', submitNotice.slice(0, 44))
  check(restoredPhone === `${account.phone}|${account.phone}`,
    '页面换绑回原号码：手机号与登录名一起回到开场值', restoredPhone)

  /* ── 日发上限：运营端参数配置此前"能改没人执行"，现在真被读到 ── */
  const limitBefore = sql(`SELECT config_value FROM agri_core.platform_uc_system_config WHERE config_key='captcha.sms.daily.limit'`)
  const adminLogin = await (await fetch(`${GATEWAY}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
  })).json()
  const adminToken = adminLogin?.data?.accessToken ?? ''
  const setLimit = async (value) => (await fetch(`${GATEWAY}/api/v1/admin/uc/configs`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify([{ key: 'captcha.sms.daily.limit', value }]),
  })).json()
  const lowered = await setLimit('2')
  check(lowered.code === 0, '运营端把当日发码上限临时改成 2（保存即失效缓存）', JSON.stringify(lowered.data ?? {}).slice(0, 50))
  const limitTries = []
  for (let i = 0; i < 3; i += 1) {
    redisRun('DEL', cooldownKey(dailyPhone))   // 冷却是另一层：清掉它才能专测"当日条数"这条上限
    limitTries.push(await sendPhoneCode(dailyPhone))
  }
  check(limitTries[0].code === 0 && limitTries[1].code === 0, '上限之内照常发码', `前两次 code=${limitTries.map((r) => r.code).join('/')}`)
  check(limitTries[2].code !== 0 && /今日/.test(String(limitTries[2].message ?? '')),
    '负分支：超过当日发码上限被拒', String(limitTries[2].message ?? '').slice(0, 46))
  const limitRestored = await setLimit(limitBefore)
  check(limitRestored.code === 0
    && sql(`SELECT config_value FROM agri_core.platform_uc_system_config WHERE config_key='captcha.sms.daily.limit'`) === limitBefore,
  '发码上限已还原', `开场值 ${limitBefore} → 现值 ${sql(`SELECT config_value FROM agri_core.platform_uc_system_config WHERE config_key='captcha.sms.daily.limit'`)}`)

  /*
   * 注意别把这句写成以 `[` 开头：上一条语句以 `)` 结束，ASI 不会补分号，
   * 会被解析成 `check(...)[数组].forEach(...)` —— 报出来就是一个看不出所以然的
   * "Cannot read properties of undefined"（本轮真踩了一次，栈只指到这一行）。
   */
  const phonesToSweep = [newPhone, voidPhone, dailyPhone, account.phone]
  phonesToSweep.forEach(sweepSmsKeys)
  /*
   * 判据只针对**本轮用过的号码**：Redis 里可能同时有别的脚本/别的轮次留下的换绑键，
   * 断言"全局没有 change_phone 键"会把别人的残留算成我的错（上一轮就是这么红的）。
   */
  const smsKeysLeft = redisRun('KEYS', 'agri:sms:*').split('\n').filter(Boolean)
    .filter((key) => phonesToSweep.some((phone) => key.includes(phone)))
  check(smsKeysLeft.length === 0, '清理：本轮号码的验证码/计数/冷却键都已从 Redis 清掉', `残留 ${smsKeysLeft.length} 个：${smsKeysLeft.slice(0, 2).join(' ')}`)

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
  addressId = addressCreate.data?.id
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

  const realNameId = validId()
  const realName = await request('/api/v1/sso/account/real-name', {
    method: 'POST',
    body: JSON.stringify({
      realName: '账号中心实名测试',
      idCard: realNameId,
      contactPhone: account.phone,
      address: '山东省潍坊市寿光市账号中心路 1 号',
      validStart: '2020-01-01',
      validEnd: '2040-01-01',
      businessType: '家庭农场',
      email: 'account-center@example.com',
    }),
  })
  const realNameLiveness = await request('/api/v1/sso/account/real-name/liveness', {
    method: 'POST',
    body: '{}',
  })
  const realNamePolice = await request('/api/v1/sso/account/real-name/police', {
    method: 'POST',
    body: JSON.stringify({ realName: '账号中心实名测试', idCard: realNameId }),
  })
  const realNameSubmit = await request('/api/v1/sso/account/real-name/submit', {
    method: 'POST',
    body: '{}',
  })
  const afterRealName = await request('/api/v1/sso/account/summary')
  check(realName.code === 0 && realNameLiveness.code === 0 && realNamePolice.code === 0
    && realNameSubmit.code === 0 && afterRealName.data?.realName?.status === 'pending',
  '企业账号也可完成身份证 OCR、活体、公安二要素并提交个人实名认证')

  const beforeCreate = await request('/api/v1/sso/account/summary')
  const createSubject = await request('/api/v1/sso/account/businesses', {
    method: 'POST',
    body: JSON.stringify({
      identity: 'personal',
      realName: '账号中心新增主体',
      idCard: validId(),
      businessType: '家庭农场',
      address: '山东省潍坊市寿光市主体创建路 2 号',
      contactName: '账号中心新增主体',
      contactPhone: account.phone,
      email: 'account-center@example.com',
      validStart: '2020-01-01',
      validEnd: '2040-01-01',
    }),
  })
  const afterCreate = await request('/api/v1/sso/account/summary')
  addedMerchant = (afterCreate.data?.merchants ?? []).find((item) =>
    !(beforeCreate.data?.merchants ?? []).some((old) => old.merchantId === item.merchantId))
  check(createSubject.code === 0 && addedMerchant?.memberType === 'personal',
    '已有主体账号仍可创建新的个人主体', addedMerchant?.merchantName ?? '')

  const enterpriseName = `账号中心创建企业主体${Date.now().toString().slice(-6)}`
  /** 信用代码每轮唯一：后端有"同一代码已绑定其他主体"的查重，写死一个值会让第二轮之后永远 409。 */
  const enterpriseCreditCode = `913707${String(Date.now()).padStart(12, '0').slice(-12)}`
  const beforeEnterprise = await request('/api/v1/sso/account/summary')
  const createEnterprise = await request('/api/v1/sso/account/businesses', {
    method: 'POST',
    body: JSON.stringify({
      identity: 'enterprise',
      companyName: enterpriseName,
      creditCode: enterpriseCreditCode,
      industry: '果蔬产业',
      companySize: '10-50人',
      address: '山东省潍坊市寿光市企业总部路 3 号',
      contactName: '企业主体联系人',
      contactPhone: account.phone,
      legalPerson: '企业主体法人',
      email: 'account-center@example.com',
    }),
  })
  const afterEnterprise = await request('/api/v1/sso/account/summary')
  addedEnterprise = (afterEnterprise.data?.merchants ?? []).find((item) =>
    !(beforeEnterprise.data?.merchants ?? []).some((old) => old.merchantId === item.merchantId))
  check(createEnterprise.code === 0 && addedEnterprise?.memberType === 'enterprise'
    && addedEnterprise?.verifyStatus !== 'approved',
  '已有主体账号可创建待认证企业主体', addedEnterprise?.merchantName ?? '')
  let uploadedDocuments = null
  if (addedEnterprise?.merchantName) {
    // 主体是 API 新建的，当前 SPA 的内存摘要不会自动感知；强制刷新才能按真实后端状态渲染。
    await openAccountView('org')
    await page.waitForSelector('.merchant-row', { timeout: 15000 })
    const rowReady = await waitForMerchantRow(addedEnterprise.merchantName)
    const openedCertification = await page.evaluate((name) => {
      const row = [...document.querySelectorAll('.merchant-row')]
        .find((item) => (item.querySelector('.merchant-title strong')?.textContent ?? '').trim() === name)
      const button = [...(row?.querySelectorAll('button') ?? [])]
        .find((item) => (item.textContent ?? '').trim() === '去认证')
      button?.click()
      return Boolean(button)
    }, addedEnterprise.merchantName)
    check(openedCertification && rowReady, '待认证企业主体显示去认证操作', `行已渲染=${rowReady}`)
    await page.waitForSelector('.account-modal', { timeout: 10000 })
    const certificationText = await page.evaluate(() => document.querySelector('.account-modal')?.innerText ?? '')
    /**
     * 企业认证口径（2026-11-02 起）：法人身份二照换成「法定代表人扫脸」，并新增对公打款四要素，
     * 材料三件 = 营业执照照片 / 法定代表人扫脸 / 对公打款凭证。
     */
    const requiredText = ['企业主体认证', '企业名称', '统一社会信用代码', '法定代表人', '营业执照号', '注册资本',
      '联系人姓名', '联系电话', '对公账户户名', '对公账户账号', '对公打款金额', '对公打款流水号',
      '营业执照照片', '法定代表人扫脸', '对公打款凭证', '认证材料说明']
    check(requiredText.every((label) => certificationText.includes(label)),
      '个人中心企业认证弹窗包含完整认证字段',
      `缺：${requiredText.filter((label) => !certificationText.includes(label)).join('/')}`)
    await page.screenshot({
      path: path.join(OUT, 'account-certification-upload-form.png'),
      fullPage: false,
    })

    const documentDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agri-certification-docs-'))
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    )
    const filePaths = [
      'business-license.png',
      'legal-person-face.png',
      'corporate-transfer-proof.png',
    ].map((filename) => {
      const filePath = path.join(documentDir, filename)
      fs.writeFileSync(filePath, png)
      return filePath
    })
    try {
      for (let index = 0; index < filePaths.length; index += 1) {
        const inputs = await page.$$('.certification-upload input[type="file"]')
        if (!inputs.length) throw new Error('认证材料文件选择框不存在')
        await inputs[0].setInputFiles(filePaths[index])
        await page.waitForFunction(
          (expected) => document.querySelectorAll('.certification-document-preview img').length >= expected,
          index + 1,
          { timeout: 10000 },
        )
      }
      const previewUrls = await page.$$eval('.certification-document-preview img',
        (images) => images.map((image) => image.getAttribute('src')))
      uploadedDocuments = {
        businessLicenseUrl: previewUrls[0],
        legalPersonFaceUrl: previewUrls[1],
        corporateTransferProofUrl: previewUrls[2],
      }
      check(previewUrls.length === 3 && previewUrls.every((url) => url?.includes('/certification-files/')),
        '浏览器选择三张图片后均显示缩略图')
      await page.screenshot({
        path: path.join(OUT, 'account-certification-files.png'),
        fullPage: false,
      })
    } finally {
      fs.rmSync(documentDir, { recursive: true, force: true })
    }
    await page.click('.account-modal-close')
    /**
     * 「去认证」会把页面切到企业实名页（startCertification 里 setTab('enterprise')），
     * 关掉弹窗并不会切回主体列表 —— 不重新点一次菜单，主体行压根不在 DOM 里，
     * 「切换为此主体」这一步只会红得莫名其妙（实测两连红就是这里）。
     */
    await openAccountView('org')
    await waitForMerchantRow(addedEnterprise.merchantName)

    const switchReady = await page.waitForFunction((rowName) => {
      const row = [...document.querySelectorAll('.merchant-row')]
        .find((item) => (item.querySelector('.merchant-title strong')?.textContent ?? '').trim() === rowName)
      return [...(row?.querySelectorAll('.merchant-row-actions button') ?? [])]
        .some((button) => (button.textContent ?? '').includes('切换为此主体'))
    }, addedEnterprise.merchantName, { timeout: 15000 }).then(() => true).catch(() => false)
    const clickedSwitch = await page.evaluate((name) => {
      const row = [...document.querySelectorAll('.merchant-row')]
        .find((item) => (item.querySelector('.merchant-title strong')?.textContent ?? '').trim() === name)
      const button = [...(row?.querySelectorAll('.merchant-row-actions button') ?? [])]
        .find((item) => (item.textContent ?? '').includes('切换为此主体'))
      button?.click()
      return Boolean(button)
    }, addedEnterprise.merchantName)
    check(switchReady && clickedSwitch, '个人中心为目标主体显示切换入口',
      `行已就绪=${switchReady} 已点到=${clickedSwitch}　${await dumpMerchantRows()}`)
    const activeReady = await page.waitForFunction((merchantId) => {
      const active = document.querySelector('.merchant-row.active')
      return active?.textContent?.includes(merchantId)
    }, addedEnterprise.merchantId, { timeout: 15000 }).then(() => true).catch(() => false)
    check(activeReady, '点「切换为此主体」后该行成为当前登录主体',
      activeReady ? '' : `切换后 active 行仍是：${await dumpMerchantRows()}`)
    await page.screenshot({
      path: path.join(OUT, 'account-active-merchant.png'),
      fullPage: true,
    })
    const afterSwitch = await request('/api/v1/sso/account/summary')
    check(afterSwitch.data?.activeMerchantId === addedEnterprise.merchantId,
      '页面切换后当前登录主体已更新')
    const scopedMerchants = await page.evaluate(async (token) => {
      const response = await fetch('/api/v1/platform/merchants/mine', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      return await response.json()
    }, accessToken)
    check(scopedMerchants.code === 0 && scopedMerchants.data?.length === 1
      && scopedMerchants.data[0]?.merchantId === addedEnterprise.merchantId,
    '业务侧主体范围只返回当前这一家')
    const productionScoped = await fetch(
      'http://localhost:8092/api/v1/production/members?pageNum=1&pageSize=10',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ).then((response) => response.json())
    check([0, 200].includes(productionScoped.code) && productionScoped.data?.total === 0,
      '生产管理模块切换到新主体后查询新主体的空数据范围')
    const productionCreate = await fetch(
      'http://localhost:8092/api/v1/production/members',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberName: '主体切换测试成员',
          phone: '13700008888',
          memberType: 'OPERATOR',
          postName: '测试操作员',
          joinDate: '2026-10-21',
          status: 1,
        }),
      },
    ).then((response) => response.json())
    productionMemberId = productionCreate.data
    const productionAfterCreate = await fetch(
      'http://localhost:8092/api/v1/production/members?pageNum=1&pageSize=10',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ).then((response) => response.json())
    check([0, 200].includes(productionCreate.code) && Boolean(productionMemberId)
      && productionAfterCreate.data?.records?.some((item) => item.memberId === productionMemberId),
    '生产管理模块的数据新增与查询均落在切换后的主体')
    /**
     * 只查得到还不算数：写在哪个租户下才是"切换生效"的证据。
     * 生产域的 tenant_id 就是平台经营主体号（演示库里 agri_prod_member.tenant_id = 2001），
     * 切换没生效时这里会退回老主体号 —— 上面那条列表断言照样能绿，所以必须单独钉这一条。
     */
    /** 成员主键是 MEM+时间戳这种字符串（不是数字），SQL 里必须带引号；只允许"字母数字-_"进语句。 */
    const memberTenant = /^[\w-]+$/.test(String(productionMemberId))
      ? sql(`SELECT tenant_id FROM agri_production.agri_prod_member WHERE member_id='${productionMemberId}';`) : ''
    check(memberTenant === String(addedEnterprise.merchantId),
      '新成员写在切换后主体的租户号下', `member.tenant_id=${memberTenant || '无此行'} 目标主体=${addedEnterprise.merchantId}`)
    if (productionMemberId) {
      const productionDelete = await fetch(
        `http://localhost:8092/api/v1/production/members/${encodeURIComponent(productionMemberId)}`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      ).then((response) => response.json())
      check([0, 200].includes(productionDelete.code), '主体切换测试成员已删除')
      sql(`DELETE FROM agri_production.agri_prod_member WHERE member_id='${productionMemberId}';`)
    }
    const forbiddenSwitch = await request('/api/v1/sso/account/businesses/2001/activate',
      { method: 'POST' })
    check(forbiddenSwitch.code === 403, '不能切换到自己未绑定的经营主体')
  }
  if (addedEnterprise?.merchantId) {
    const incomplete = await request(
      `/api/v1/sso/account/businesses/${addedEnterprise.merchantId}/submit-certification`,
      {
        method: 'POST',
        body: JSON.stringify({
          companyName: addedEnterprise.merchantName,
          creditCode: enterpriseCreditCode,
          legalPerson: '企业认证法人',
          contactName: '企业主体联系人',
          contactPhone: account.phone,
        }),
      },
    )
    check(incomplete.code === 400 && String(incomplete.message).includes('营业执照'),
      '缺少认证材料时提交被后端拦截')

    const invalid = await uploadCertificationDocument(
      addedEnterprise.merchantId, 'business_license', true)
    check(invalid.code === 400, '伪装成图片的非法文件被拒绝')

    const preview = await page.evaluate(async (url) => {
      const response = await fetch(url, { credentials: 'include' })
      return { status: response.status, type: response.headers.get('content-type'), size: (await response.arrayBuffer()).byteLength }
    }, uploadedDocuments.businessLicenseUrl)
    check(preview.status === 200 && preview.type?.startsWith('image/') && preview.size > 0,
      '申请人可读取已上传材料且返回真实图片流')
  }
  let enterpriseCertified = { code: -1 }
  if (addedEnterprise?.merchantId && uploadedDocuments) {
    enterpriseCertified = await request(
      `/api/v1/sso/account/businesses/${addedEnterprise.merchantId}/submit-certification`,
      {
        method: 'POST',
        body: JSON.stringify({
          companyName: addedEnterprise.merchantName,
          creditCode: enterpriseCreditCode,
          legalPerson: '企业认证法人',
          licenseNo: 'BL-ACCOUNT-CENTER-001',
          contactName: '企业主体联系人',
          contactPhone: account.phone,
          attachNote: '个人中心企业认证联调材料说明',
          corporateBankName: addedEnterprise.merchantName,
          corporateBankAccount: '62284000000123456',
          corporateTransferAmount: '0.66',
          corporateTransferReference: `TF${Date.now()}`,
          ...uploadedDocuments,
        }),
      },
    )
    const certifiedSummary = await request('/api/v1/sso/account/summary')
    const certifiedMerchant = certifiedSummary.data?.merchants
      ?.find((item) => item.merchantId === addedEnterprise.merchantId)
    check(enterpriseCertified.code === 0 && certifiedMerchant?.verifyStatus === 'pending',
      '未认证企业主体可从入口提交认证审核', `code=${enterpriseCertified.code} verify=${certifiedMerchant?.verifyStatus}`)
    check(certifiedMerchant?.certification?.legalPerson === '企业认证法人'
      && certifiedMerchant?.certification?.status === 'pending',
    '企业认证资料完整落库并显示认证单号')
    const persisted = sql(`SELECT CONCAT('执照=', IFNULL(business_license_url, '-'),
        '｜扫脸=', IFNULL(legal_person_face_url, '-'),
        '｜回单=', IFNULL(corporate_transfer_proof_url, '-'),
        '｜户名=', IFNULL(corporate_bank_name, '-'),
        '｜账号=', IFNULL(corporate_bank_account, '-'),
        '｜金额=', IFNULL(corporate_transfer_amount, '-'),
        '｜流水=', IFNULL(corporate_transfer_reference, '-'),
        '｜通道=', IFNULL(verification_channel, '-'))
        FROM agri_core.platform_merchant_certification WHERE merchant_id=${addedEnterprise.merchantId}
        ORDER BY id DESC LIMIT 1;`)
    const fields = Object.fromEntries(persisted.split('｜').map((pair) => pair.split('=')))
    check(Object.values(fields).every((value) => value && value !== '-')
      && fields.执照?.includes('business_license') && fields.扫脸?.includes('legal_person_face')
      && fields.回单?.includes('corporate_transfer_proof') && fields.通道 === '法人扫脸 + 对公打款',
    '三件企业认证材料与对公账户信息已真实落库', persisted)
  }

  const search = await request('/api/v1/sso/account/businesses/search?keyword=%E7%BB%BF%E6%BA%90')
  const business = (search.data ?? []).find((item) => !item.alreadyJoined)
  check(search.code === 0 && Boolean(business), '可搜索待加入的经营主体', business?.name ?? '')
  // joinId 已提到文件顶部（finally 要用）
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

  await page.reload({ waitUntil: 'networkidle' })
  await page.waitForSelector('.account-menu button', { timeout: 20000 })
  await openAccountView('org')
  await page.waitForFunction(() => {
    const text = document.body.innerText
    return text.includes('创建企业主体') && text.includes('创建个人主体')
  }, { timeout: 10000 })
  check(true, '登录后始终显示创建企业/个人主体入口')
  const merchantDetails = await page.evaluate(() =>
    document.querySelector('.merchant-detail-grid')?.innerText ?? '')
  check(['主体编码', '经营主体 ID', '联系人', '联系电话', '主体状态']
    .every((label) => merchantDetails.includes(label)),
  '个人中心展示经营主体完整资料')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.trim() === '创建企业主体')
    button?.click()
  })
  await page.waitForSelector('.account-modal', { timeout: 10000 })
  const enterpriseFields = await page.evaluate(() => (
    [...document.querySelectorAll('.account-modal .account-form-grid > label')]
      .map((label) => label.childNodes[0]?.textContent?.trim())
  ))
  check(JSON.stringify(enterpriseFields) === JSON.stringify(
    ['企业名称', '统一社会信用代码', '所属行业', '企业规模', '注册地址', '联系人姓名']),
  '企业主体创建字段与注册向导一致')
  const enterpriseSizes = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.account-modal label')]
    const sizeLabel = labels.find((item) => item.textContent?.includes('企业规模'))
    return [...(sizeLabel?.querySelectorAll('option') ?? [])].map((item) => item.textContent?.trim())
  })
  check(JSON.stringify(enterpriseSizes) === JSON.stringify(
    ['微型（20人以下）', '小型（20-100人）', '中型（100-500人）', '大型（500人以上）']),
  '企业规模选项与注册向导一致')
  await page.click('.account-modal-close')
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')]
      .find((item) => item.textContent?.trim() === '创建个人主体')
    button?.click()
  })
  await page.waitForSelector('.account-modal', { timeout: 10000 })
  const personalFields = await page.evaluate(() => (
    [...document.querySelectorAll('.account-modal .account-form-grid > label')]
      .map((label) => label.childNodes[0]?.textContent?.trim())
  ))
  check(JSON.stringify(personalFields) === JSON.stringify(
    ['真实姓名', '身份证号', '经营类型', '联系人姓名']),
  '个人主体创建字段与注册向导一致')
  const businessTypes = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.account-modal label')]
    const typeLabel = labels.find((item) => item.textContent?.includes('经营类型'))
    return [...(typeLabel?.querySelectorAll('option') ?? [])].map((item) => item.textContent?.trim())
  })
  check(JSON.stringify(businessTypes) === JSON.stringify(
    ['家庭农场', '农民专业合作社', '个体采购户', '经纪人', '其他']),
  '个人经营类型选项与注册向导一致')
  await page.click('.account-modal-close')
  check((await page.evaluate(() => document.body.innerText)).includes('去实名认证'),
    '未认证个人主体显示认证入口')
  await openAccountView('addresses')
  const addressVisible = await page.waitForFunction(() => document.body.innerText.includes('账号中心测试路 88 号'),
    undefined, { timeout: 10000 }).then(() => true).catch(() => false)
  check(addressVisible, '个人中心地址页显示真实地址', addressVisible ? ''
    : `地址页文本：${await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 240))}`)
  await page.screenshot({ path: path.join(OUT, 'account-center.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${PORTAL}#/account`, { waitUntil: 'networkidle', timeout: 60000 })
  await page.waitForSelector('.account-menu button', { timeout: 20000 })
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check(mobileOverflow <= 1, '个人中心 390px 无横向溢出', String(mobileOverflow))
  await page.screenshot({ path: path.join(OUT, 'account-center-mobile.png'), fullPage: true })

  const addressDelete = await request(`/api/v1/sso/account/addresses/${addressId}`, { method: 'DELETE' })
  check(addressDelete.code === 0, '收货地址删除可用')
  if (initialActiveMerchantId) {
    const restored = await request(
      `/api/v1/sso/account/businesses/${initialActiveMerchantId}/activate`,
      { method: 'POST' },
    )
    check(restored.code === 0, '切换测试后恢复原当前主体')
    await sleep(2300)
    const restoredProduction = await fetch(
      'http://localhost:8092/api/v1/production/members?pageNum=1&pageSize=10',
      { headers: { Authorization: `Bearer ${accessToken}` } },
    ).then((response) => response.json())
    check([0, 200].includes(restoredProduction.code),
      '恢复主体后生产管理模块继续可用')
  }
  if (joinId) {
    const cancel = await request(`/api/v1/sso/account/businesses/join-requests/${joinId}`, { method: 'DELETE' })
    check(cancel.code === 0, '加入主体申请可撤回')
  }
  const activeKey = `agri:active-merchant:${original.data.userId}:1`
  const activeBeforeLogout = execFileSync(
    'C:\\Redis\\redis-cli.exe',
    ['--raw', 'GET', activeKey],
    { encoding: 'utf8' },
  ).trim()
  await page.evaluate(async () => {
    await fetch('/api/v1/sso/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  })
  const activeAfterLogout = execFileSync(
    'C:\\Redis\\redis-cli.exe',
    ['--raw', 'EXISTS', activeKey],
    { encoding: 'utf8' },
  ).trim()
  check(activeBeforeLogout === initialActiveMerchantId && activeAfterLogout === '0',
    '退出登录后清除当前主体状态')
  check(errors.length === 0, '个人中心无未捕获脚本异常', errors.slice(0, 2).join(' | '))

  console.log('\n个人中心地址：http://localhost:8098/portal/#/account')
} catch (error) {
  /** 崩溃必须带栈：只写 message 的话，"哪一行炸了"要靠猜（本轮排查就在这上面绕了一圈）。 */
  fs.writeFileSync(path.join(REPO_ROOT, 'outputs', 'account-center-crash.txt'),
    `${error}\n${error?.stack ?? '(无栈)'}\n`, 'utf8')
  const at = [...String(error?.stack ?? '').matchAll(/e2e-account-center\.mjs:(\d+):(\d+)/g)]
    .map((match) => `L${match[1]}:${match[2]}`).slice(0, 3).join(' ')
  check(false, '个人中心回归未抛异常', `${String(error).slice(0, 150)}${at ? `　栈：${at}（完整栈见 outputs/account-center-crash.txt）` : ''}`)
} finally {
  /* ---------------- 收尾：本轮造的东西一律清零（断言红不红都要清） ---------------- */
  // 验证码键有 TTL（日限键到当天午夜），但"本轮碰过的号码"不该留到明天再自然消失
  smsPhonesTouched.filter(Boolean).forEach(sweepSmsKeys)
  const merchantIds = [addedMerchant?.merchantId, addedEnterprise?.merchantId]
    .filter((id) => /^\d+$/.test(String(id ?? '')))
  if (merchantIds.length) {
    sql(`DELETE FROM agri_core.platform_merchant_certification WHERE merchant_id IN (${merchantIds.join(',')});
         DELETE FROM agri_core.platform_user_merchant WHERE merchant_id IN (${merchantIds.join(',')});
         DELETE FROM agri_core.platform_merchant WHERE id IN (${merchantIds.join(',')});`)
    /**
     * 上传目录跟着服务的工作目录走：core-app 是在 `core-platform/core-app/` 下启动的，
     * 证照落在 `core-platform/core-app/uploads/…`；只清 `core-platform/uploads/…` 会留下孤儿目录
     * （实测本轮之前攒了 7 个已删主体的上传目录）。两处都清。
     */
    merchantIds.forEach((id) => ['core-platform/uploads', 'core-platform/core-app/uploads'].forEach((root) => fs.rmSync(
      path.join(REPO_ROOT, root, 'platform/certification', String(id)),
      { recursive: true, force: true },
    )))
    check(sql(`SELECT COUNT(*) FROM agri_core.platform_merchant WHERE id IN (${merchantIds.join(',')});`) === '0'
      && sql(`SELECT COUNT(*) FROM agri_core.platform_user_merchant WHERE merchant_id IN (${merchantIds.join(',')});`) === '0',
    `本轮 ${merchantIds.length} 个测试经营主体已清理（含绑定与认证单）`, merchantIds.join(','))
  }
  if (/^\d+$/.test(String(joinId ?? ''))) {
    sql(`DELETE FROM agri_core.platform_merchant_join_request WHERE id=${joinId};`)
    check(sql(`SELECT COUNT(*) FROM agri_core.platform_merchant_join_request WHERE id=${joinId};`) === '0',
      '本轮加入主体申请已清理', `id=${joinId}`)
  }
  if (/^\d+$/.test(String(addressId ?? ''))) {
    sql(`DELETE FROM agri_core.platform_user_address WHERE id=${addressId};`)
    check(sql(`SELECT COUNT(*) FROM agri_core.platform_user_address WHERE id=${addressId};`) === '0',
      '本轮收货地址已清理', `id=${addressId}`)
  }
  if (/^[\w-]+$/.test(String(productionMemberId ?? ''))) {
    sql(`DELETE FROM agri_production.agri_prod_member WHERE member_id='${productionMemberId}';`)
    check(sql(`SELECT COUNT(*) FROM agri_production.agri_prod_member WHERE member_id='${productionMemberId}';`) === '0',
      '本轮主体切换测试成员已清理', `id=${productionMemberId}`)
  }
  if (passwordHashBefore) {
    const restored = await loginProbe(account.password)
    if (restored.code !== 0) {
      sql(`UPDATE agri_core.platform_user SET password='${passwordHashBefore}' WHERE id=${platformUserId};`)
      const again = await loginProbe(account.password)
      check(again.code === 0, '收尾：密码不在原值，已按备份哈希强制还原', `还原后登录 code=${again.code}`)
    } else {
      check(true, '收尾：登录密码仍是演示账号原值')
    }
  }
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
