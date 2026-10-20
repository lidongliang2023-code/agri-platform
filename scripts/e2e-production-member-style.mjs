#!/usr/bin/env node
/** 生产管理用户端 / 运营端视觉令牌回归：对齐买家中心（2026-10-20）。 */
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const require2 = createRequire(path.join(REPO_ROOT, 'agri-production/frontend/package.json'))
const puppeteer = require2('puppeteer')
const HEADFUL = process.argv.includes('--headful')
const OUT = 'C:/Users/71502/.codex/visualizations/2026/10/16/01a14244-ead8-7ab0-8c7c-df7abac44648'

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const browser = await puppeteer.launch({ headless: HEADFUL ? false : 'new', args: ['--no-sandbox'] })

async function openStyledPage(urlPath, role) {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 1000 })
  await page.evaluateOnNewDocument((roleCode) => {
    const admin = roleCode === 'SUPER_ADMIN'
    localStorage.setItem('agri_user_info', JSON.stringify({
      userId: '1',
      username: admin ? 'admin' : 'farmer',
      realName: admin ? '平台运营管理员' : '联调测试农业科技有限公司',
      tenantId: '',
      userType: admin ? 1 : 3,
    }))
    localStorage.setItem('agri_roles', JSON.stringify([roleCode]))
    localStorage.setItem('agri_permissions', JSON.stringify(admin ? ['*'] : []))
    localStorage.setItem('agri_market_id', '1')
    localStorage.setItem('agri_end', admin ? 'admin' : 'user')
  }, role)
  await page.setRequestInterception(true)
  page.on('request', (request) => {
    const url = new URL(request.url())
    const json = (body) => request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    if (url.pathname === '/api/v1/auth/refresh') {
      return json({
        code: 0,
        message: 'ok',
        data: {
          accessToken: 'e2e-token',
          expiresIn: 3600,
          user: {
            id: '1',
            username: role === 'SUPER_ADMIN' ? 'admin' : 'farmer',
            nickname: role === 'SUPER_ADMIN' ? '平台运营管理员' : '联调测试农业科技有限公司',
            roles: [role],
          },
        },
      })
    }
    if (url.pathname.startsWith('/api/')) {
      return json({ code: 0, message: 'ok', data: null })
    }
    return request.continue()
  })
  await page.goto(`http://localhost${urlPath}`, { waitUntil: 'networkidle2', timeout: 60000 })
  await page.waitForSelector('.agri-sider', { timeout: 20000 })
  await page.waitForSelector('.agri-header', { timeout: 20000 })
  return page
}

async function stylesOf(page) {
  return page.evaluate(() => {
    const style = (selector) => {
      const element = document.querySelector(selector)
      return element ? getComputedStyle(element) : null
    }
    const sider = style('.agri-sider')
    const header = style('.agri-header')
    const content = style('.agri-content')
    const card = style('.ant-card')
    const selected = style('.ant-menu-item-selected')
    const link = style('.ant-btn-link, a')
    return {
      siderWidth: sider?.width ?? '',
      siderBackground: sider?.backgroundImage ?? '',
      headerHeight: header?.height ?? '',
      headerBackground: header?.backgroundColor ?? '',
      headerBorder: header?.borderBottomWidth ?? '',
      contentBackground: content?.backgroundColor ?? '',
      cardRadius: card?.borderRadius ?? '',
      cardBorder: card?.borderColor ?? '',
      selectedBackground: selected?.backgroundImage ?? '',
      linkColor: link?.color ?? '',
    }
  })
}

try {
  const userPage = await openStyledPage('/production/dashboard', 'FARMER')
  const user = await stylesOf(userPage)
  check(user.siderWidth === '224px', '用户端侧栏宽度与买家中心一致', user.siderWidth)
  check(user.siderBackground.includes('linear-gradient'), '用户端侧栏为深绿渐变', user.siderBackground.slice(0, 70))
  check(user.headerHeight === '60px' && user.headerBackground === 'rgb(255, 255, 255)',
    '用户端顶栏为 60px 白色顶栏', `${user.headerHeight} / ${user.headerBackground}`)
  check(user.contentBackground === 'rgb(244, 247, 245)', '用户端内容区为买家中心浅灰绿底', user.contentBackground)
  check(user.cardRadius === '12px' && user.cardBorder === 'rgb(227, 234, 229)',
    '用户端卡片为 12px 浅绿边框', `${user.cardRadius} / ${user.cardBorder}`)
  check(user.selectedBackground.includes('linear-gradient'), '用户端当前菜单为绿色渐变', user.selectedBackground.slice(0, 70))
  check(user.linkColor === 'rgb(18, 118, 74)', '用户端链接主色为买家中心绿色', user.linkColor)
  await userPage.screenshot({ path: path.join(OUT, 'production-user-style.png') })
  await userPage.close()

  const adminPage = await openStyledPage('/admin/production/dashboard', 'SUPER_ADMIN')
  const admin = await stylesOf(adminPage)
  check(admin.siderWidth === user.siderWidth && admin.siderBackground === user.siderBackground,
    '运营端侧栏与用户端同一深绿渐变')
  check(admin.headerHeight === user.headerHeight && admin.headerBackground === user.headerBackground,
    '运营端顶栏与用户端同一 60px 白顶栏')
  check(admin.contentBackground === user.contentBackground, '运营端内容底色与用户端一致')
  check(admin.cardRadius === user.cardRadius && admin.cardBorder === user.cardBorder,
    '运营端卡片圆角与边框和用户端一致')
  check(admin.linkColor === user.linkColor, '运营端链接颜色与用户端一致')
  await adminPage.screenshot({ path: path.join(OUT, 'production-admin-style.png') })
  await adminPage.close()
} catch (error) {
  check(false, '生产管理视觉回归脚本未抛异常', String(error).slice(0, 240))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
