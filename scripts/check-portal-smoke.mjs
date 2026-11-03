#!/usr/bin/env node
/**
 * 门户整包冒烟检查（2026-11-02）。
 *
 * <p>门户是单个 SPA 打包发布的，改首页会让所有页面换版本目录。这个脚本只做一件事：
 * 逐个进入门户的每个一级路由，确认没有未捕获脚本异常、页面关键区块在、并且请求都打到真实后端。
 * 用来兜住"改一处、坏一片"的构建级回归，不替代各页的专项脚本。</p>
 *
 * 用法：node scripts/check-portal-smoke.mjs [--base=http://localhost:8098]
 */
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((candidate) => existsSync(candidate))

const arg = (name, fallback) => {
  const hit = process.argv.slice(2).find((item) => item.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const BASE = arg('base', 'http://localhost:8098')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

/** 每条路由：必须出现的关键文案。 */
const ROUTES = [
  { hash: '#/', expect: ['从田间到餐桌', '平台公告'], label: '首页' },
  { hash: '#/chains', expect: ['产业链频道', '在售商品'], label: '产业链' },
  { hash: '#/hall', expect: ['交易大厅'], label: '交易大厅' },
  { hash: '#/finance', expect: ['供应链金融'], label: '金融服务' },
  { hash: '#/logistics', expect: ['物流', '服务'], label: '物流服务' },
  { hash: '#/certify', expect: ['认证', '所需材料'], label: '认证说明' },
  { hash: '#/info', expect: ['资讯', '行情'], label: '资讯首页' },
  { hash: '#/info/market', expect: ['行情'], label: '行情页' },
  { hash: '#/info/supply-demand', expect: ['供应', '需求'], label: '供需大厅' },
  { hash: '#/info/training', expect: ['课程'], label: '培训课堂' },
  { hash: '#/account', expect: ['登录', '注册'], label: '会员中心（未登录态）' },
]

const browser = await chromium.launch({ headless: !process.argv.includes('--headful'), executablePath: BROWSER, args: ['--no-sandbox'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(`${page.url()} :: ${String(error)}`))
const badResponses = []
page.on('response', (response) => {
  if (response.status() >= 500) badResponses.push(`${response.status()} ${response.url()}`)
})

try {
  for (const route of ROUTES) {
    const before = errors.length
    await page.goto(`${BASE}/portal/index.html${route.hash}`, { waitUntil: 'networkidle', timeout: 60000 })
    await sleep(900)
    const text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' '))
    const missing = route.expect.filter((needle) => !text.includes(needle))
    check(missing.length === 0, `${route.label} ${route.hash} 关键区块在位`, missing.length ? `缺：${missing.join('/')}` : '')
    check(!text.includes('页面不存在'), `${route.label} 没有落到 404 兜底`)
    check(errors.length === before, `${route.label} 无未捕获脚本异常`, errors.slice(before, before + 1).join(' | '))
  }
  check(badResponses.length === 0, '门户各页未出现 5xx 接口响应', badResponses.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log('失败项：', failures.join('、'))
process.exit(failures.length ? 1 : 0)
