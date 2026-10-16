#!/usr/bin/env node
/**
 * 联调：**退出登录 / 缺少平台访问令牌** 时必须落到登录页（2026-10-16 用户口径）。
 *
 * <p>改前实测的两个毛病：</p>
 * <ol>
 *   <li><b>退出登录</b>：清本地态 → `POST /auth/logout` → 跳 `{SSO}/logout?client_id=prod`；
 *       而统一认证中心的登出**忽略 redirect_uri**、写死回跳 `http://localhost/?logout=1`，
 *       应用的 `/` 又把人送去 `/production/dashboard` —— 于是落回业务页，再被 401 弹走，
 *       最后停在**运营端**登录页（用户端也这样）。</li>
 *   <li><b>缺少令牌 / 401</b>：`@/utils/request` 跳的 `/login` 在没有 `?end=user` 时分流到
 *       **运营端**登录页；且没有任何路由守卫 —— 无会话直开业务页会先把页面渲染出来、
 *       再让一串接口 401，典型表现是闪一下空页面。</li>
 * </ol>

 *
 * <p>本脚本断言：① 用户端退出登录后停在**登录页**（不是业务页）；② 运营端退出登录同样如此；
 * ③ 无会话直接打开用户端/运营端业务页 → 落对应端的登录页（且没有把业务页渲染出来）。</p>

 *
 * 用法：node scripts/e2e-auth-redirect.mjs [--base=http://localhost] [--user=farmer] [--admin=admin]
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
const USER = arg('user', 'farmer')
const ADMIN = arg('admin', 'admin')
const PASSWORD = arg('password', 'Admin@123')
const FARM_ID = arg('farm', '1')
const HEADFUL = process.argv.includes('--headful')

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/** 登录（node 侧，拿身份与令牌） */
const loginAs = async (username) =>
  (await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, marketId: 1 }),
  })).json()

/** 一个"业务页"的特征：路径落在生产/运营的业务路由下（登录页与 SSO 页不算） */
const isBusinessPath = (url) =>
  /\/production\/(?!login)[a-z]/i.test(url) || /\/admin\/production/i.test(url)
/** 一个"登录页"的特征：本端登录页，或统一认证中心的登录/授权页 */
const isLoginPage = (url) =>
  /\/production\/login/i.test(url) || /\/admin\/login/i.test(url) || /:8090\//.test(url) || /\/login/i.test(url)

/**
 * 走一遍"登录 → 打开某页 → 点退出登录"，返回最终 URL。
 *
 * @param username 账号
 * @param startPath 登录后先打开的页面
 * @param base 站点前缀（用户端 / 运营端都在同一站）
 */
const logoutFlow = async (username, startPath) => {
  const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000 })
  const login = await loginAs(username)
  await page.goto(`${BASE_URL}/prod/manifest.json`, { waitUntil: 'domcontentloaded', timeout: 20000 })
  await page.evaluate(async (creds) => {
    try {
      await fetch('/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'include', body: JSON.stringify(creds),
      })
    } catch { /* 由后续页面表现反映 */ }
  }, { username, password: PASSWORD, marketId: 1 })
  await page.evaluateOnNewDocument((state) => {
    try {
      localStorage.setItem('agri_user_info', JSON.stringify(state.userInfo))
      localStorage.setItem('agri_roles', JSON.stringify(state.roles))
      localStorage.setItem('agri_permissions', JSON.stringify([]))
      localStorage.setItem('agri_market_id', '1')
      localStorage.setItem('agri_current_farm', JSON.stringify({ farmId: state.farmId, farmCode: '', farmName: '' }))
    } catch { /* localStorage 不可用则忽略 */ }
  }, { userInfo: login.data?.user ?? {}, roles: login.data?.user?.roles ?? [], farmId: FARM_ID })

  await page.goto(`${BASE_URL}${startPath}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await sleep(800)
  // 打开右上角用户菜单 → 点「退出登录」
  await page.evaluate(() => {
    const trigger = document.querySelector('.ant-dropdown-trigger')
    trigger?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
    trigger?.click()
  })
  await sleep(600)
  const clicked = await page.evaluate(() => {
    const item = [...document.querySelectorAll('.ant-dropdown-menu-item, li')]
      .find((el) => (el.textContent ?? '').replace(/\s+/g, '') === '退出登录')
    if (!item) return false
    item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    item.click()
    return true
  })
  if (!clicked) {
    await browser.close()
    throw new Error('没找到「退出登录」菜单项')
  }
  // 等最终落点稳定（可能经历：SSO 登出 → /?logout=1 → 本端登录页 → SSO 授权页）
  let lastUrl = page.url()
  for (let i = 0; i < 20; i++) {
    await sleep(700)
    const now = page.url()
    if (now === lastUrl) break
    lastUrl = now
  }
  await browser.close()
  return lastUrl
}

try {
  console.log('—— 场景 1：用户端退出登录 ——')
  const userUrl = await logoutFlow(USER, '/production/tasks')
  check(isLoginPage(userUrl) && !isBusinessPath(userUrl),
    '用户端退出登录后停在登录页（不是业务页）', userUrl)

  console.log('—— 场景 2：运营端退出登录 ——')
  const adminUrl = await logoutFlow(ADMIN, '/admin/production/crops')
  check(isLoginPage(adminUrl) && !isBusinessPath(adminUrl),
    '运营端退出登录后停在登录页（不是业务页）', adminUrl)

  console.log('—— 场景 3：无会话直接打开业务页 ——')
  const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })
  const page = await browser.newPage()
  await page.setViewport({ width: 1600, height: 1000 })
  const seen = []
  await page.goto(`${BASE_URL}/production/farms`, { waitUntil: 'networkidle2', timeout: 60000 })
  seen.push(page.url())
  for (let i = 0; i < 12; i++) {
    await sleep(700)
    if (page.url() === seen[seen.length - 1]) break
    seen.push(page.url())
  }
  const noTokenUrl = page.url()
  check(isLoginPage(noTokenUrl) && !isBusinessPath(noTokenUrl),
    '无令牌打开用户端业务页 → 落到登录页', noTokenUrl)

  const adminSeen = []
  const page2 = await browser.newPage()
  await page2.goto(`${BASE_URL}/admin/production/crops`, { waitUntil: 'networkidle2', timeout: 60000 })
  adminSeen.push(page2.url())
  for (let i = 0; i < 12; i++) {
    await sleep(700)
    if (page2.url() === adminSeen[adminSeen.length - 1]) break
    adminSeen.push(page2.url())
  }
  check(isLoginPage(page2.url()) && !isBusinessPath(page2.url()),
    '无令牌打开运营端业务页 → 落到（运营端）登录页', page2.url())
  await browser.close()
} catch (error) {
  check(false, '脚本执行未抛异常', String(error).slice(0, 160))
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
