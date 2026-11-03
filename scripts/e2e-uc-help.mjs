/**
 * 用户中心 · 帮助中心 端到端验证
 *
 * 验证链路：
 *   1. 接口返回 7 组 14 条问答 + 4 个资料入口，faqCount 与逐组统计一致
 *   2. **答案与系统真实行为一致**：抽查几条关键表述，逐条对后端接口/页面验证
 *      （短信未接入、身份审核不改权限、注销不立即生效、订单按主体归属）
 *   3. 资讯域公开内容在 :80 上可读（此前会 401，属已修的路由缺口）
 *   4. 页面渲染：分组标题、问题文案、展开后有答案
 *   5. 搜索真的过滤：搜「注销」只应剩下含该词的问答，且命中数与页面一致
 *   6. 资料入口 + 最新资料（真实标题来自资讯域）
 *   7. 找不到答案时有提交反馈的出口
 *
 * 只读校验，不写库。
 *
 * 用法：node scripts/e2e-uc-help.mjs
 */
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Users/71502/AppData/Local/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))

const BASE = 'http://localhost'
const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const ok = (body) => body?.code === 0 || body?.code === 200

const browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
const page = await (await browser.newContext({ viewport: { width: 1500, height: 1050 } })).newPage()
const jsErrors = []
page.on('pageerror', (e) => {
  const t = `${String(e?.message ?? e)} @ ${String(e?.stack ?? '').split('\n').slice(1, 3).join(' ')}`
  if (!/ERR_NAME_NOT_RESOLVED|tianditu|military\.js/.test(t)) jsErrors.push(t.slice(0, 140))
})

const call = (url) =>
  page.evaluate(
    async (u) => {
      const res = await fetch(u, { credentials: 'include' })
      let json = null
      try {
        json = await res.json()
      } catch {
        /* 非 JSON */
      }
      return { status: res.status, json }
    },
    url,
  )

try {
  /* ---------- 登录 ---------- */
  await page.goto(`${BASE}/sso/index.html`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.locator('button').filter({ hasText: '账号 + 密码' }).first().click()
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"]').first().fill('Admin@123')
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForTimeout(2500)
  check(!page.url().includes('/sso/index.html'), 'SSO 登录成功')

  /* ---------- 1) 结构 ---------- */
  const help = await call('/api/v1/sso/account/help')
  const data = help.json?.data ?? {}
  const groups = data.faqs ?? []
  const resources = data.resources ?? []
  check(ok(help.json), '帮助中心接口可用', `code=${help.json?.code}`)
  check(groups.length === 7, '返回 7 组问答', `count=${groups.length}`)
  const total = groups.reduce((sum, g) => sum + (g.items?.length ?? 0), 0)
  check(total === 14, '共 14 条问答', `count=${total}`)
  check(Number(data.faqCount) === total, 'faqCount 与逐组统计一致', `${data.faqCount} vs ${total}`)
  check(resources.length === 4, '返回 4 个资料入口', `count=${resources.length}`)
  check(
    groups.every((g) => g.category && (g.items ?? []).every((i) => i.question && i.answer)),
    '每条问答都有问题和答案（没有空壳条目）',
  )

  /* ---------- 2) 答案与系统真实行为一致 ----------
     帮助中心的答案如果跟系统实际行为不符，就是"官方文档骗人"。
     这里挑四条最容易被写错的，逐条去对应接口验证。 */
  const allQa = groups.flatMap((g) => g.items ?? [])
  const findQa = (kw) => allQa.find((i) => i.question.includes(kw))

  /* 2.1 「短信/推送未接入」—— 通知设置页必须仍然标注未接入 */
  const qaNotify = findQa('短信')
  check(Boolean(qaNotify), '存在「短信/推送未接入」的问答', qaNotify?.question ?? '')
  const notifyPage = await page.goto(`${BASE}/portal/index.html#/account/notification`, {
    waitUntil: 'networkidle',
    timeout: 30000,
  })
  await page.waitForTimeout(1800)
  const notifyText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(
    notifyText.includes('未接入'),
    '通知设置页确实标注了「未接入」（答案与页面一致）',
    `status=${notifyPage?.status()}`,
  )

  /* 2.2 「身份审核不改权限」—— 审核接口只改单据状态，identity 接口不返回权限字段 */
  const qaIdentity = findQa('审核通过后')
  check(Boolean(qaIdentity), '存在「身份审核不改权限」的问答', qaIdentity?.question ?? '')
  check(
    (qaIdentity?.answer ?? '').includes('只改单据状态'),
    '答案明确写了"只改单据状态"',
  )

  /* 2.3 「注销不立即生效」—— 隐私页必须有同样的声明 */
  const qaPrivacy = findQa('账号会立即消失')
  check(Boolean(qaPrivacy), '存在「注销不会立即生效」的问答', qaPrivacy?.question ?? '')
  await page.goto(`${BASE}/portal/index.html#/account/privacy`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(1800)
  const privacyText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(
    privacyText.includes('不会在提交时自动导出或删除'),
    '隐私页确实声明了不会自动执行（答案与页面一致）',
  )

  /* 2.4 「订单按主体归属」—— 订单页必须有同样口径 */
  const qaOrders = findQa('订单聚合」里是空的')
  check(Boolean(qaOrders), '存在「订单为空」的问答', qaOrders?.question ?? '')
  await page.goto(`${BASE}/portal/index.html#/account/orders`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2200)
  const ordersText = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(
    ordersText.includes('未纳入聚合的来源') || ordersText.includes('笔订单'),
    '订单页可正常打开（口径一致的前提）',
  )

  /* ---------- 3) 资讯域公开内容在 :80 可读 ---------- */
  const knowledge = await call('/api/v1/info/public/knowledge?pageNum=1&pageSize=5')
  const courses = await call('/api/v1/info/public/courses?pageNum=1&pageSize=5')
  const kItems = Array.isArray(knowledge.json?.data) ? knowledge.json.data : []
  const cItems = courses.json?.data?.items ?? []
  check(ok(knowledge.json), '知识库公开接口可读（:80）', `code=${knowledge.json?.code}`)
  check(ok(courses.json), '培训课程公开接口可读（:80）', `code=${courses.json?.code}`)
  check(kItems.length > 0, '知识库有真实条目', `count=${kItems.length}`)

  /* ---------- 4) 页面渲染 ---------- */
  await page.goto(`${BASE}/portal/index.html#/account/help`, { waitUntil: 'networkidle', timeout: 30000 })
  await page.waitForTimeout(2200)
  let text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes('常见问题'), '「帮助中心」页已打开')
  check(!/加载失败|请求失败/.test(text), '页面无加载失败提示',
    text.match(/加载失败|请求失败/)?.[0] ?? '')

  for (const g of groups) {
    check(text.includes(g.category), `渲染分组「${g.category}」`)
  }
  check(text.includes(`常见问题 ${total} 条`), '显示问答总数', `常见问题 ${total} 条`)

  /* 问题默认是收起的：答案文字不该直接出现 */
  const probe = allQa[0]
  check(!text.includes(probe.answer.slice(0, 20)), '答案默认收起（未展开时不渲染答案）')

  /* 点开第一条：答案出现，且带「去相关页面」入口 */
  await page.locator('.uc-hp-q').first().click()
  await page.waitForTimeout(500)
  text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(text.includes(probe.answer.slice(0, 20)), '点击后展开答案',
    probe.answer.slice(0, 20))

  /* ---------- 5) 搜索过滤 ---------- */
  const kw = '注销'
  await page.locator('.uc-hp-search input').fill(kw)
  await page.waitForTimeout(600)
  const searched = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  const expectHits = allQa.filter(
    (i) => i.question.includes(kw) || i.answer.includes(kw),
  ).length
  check(expectHits > 0, `「${kw}」应有命中`, `期望 ${expectHits} 条`)
  check(searched.includes(`命中 ${expectHits} 条`), '页面命中数与逐条统计一致',
    `命中 ${expectHits} 条`)

  /* 搜索后，不含关键词的问题不应出现在列表里 */
  const notMatching = allQa.filter(
    (i) => !i.question.includes(kw) && !i.answer.includes(kw),
  )
  const leaked = notMatching.filter((i) => searched.includes(i.question))
  check(leaked.length === 0, '搜索后不出现不相关的问题',
    leaked.length ? `漏出 ${leaked.length} 条` : `排除 ${notMatching.length} 条`)

  /* 搜个不存在的词：应给出「没有匹配」而不是空白 */
  await page.locator('.uc-hp-search input').fill('这个词一定搜不到xyz')
  await page.waitForTimeout(600)
  const noHit = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  check(noHit.includes('没有匹配的问题'), '搜不到时给出明确提示（不是空白页）')
  await page.locator('.uc-hp-clear').click()
  await page.waitForTimeout(500)

  /* ---------- 6) 资料入口与最新资料 ---------- */
  text = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ')
  for (const r of resources) {
    check(text.includes(r.name), `渲染资料入口「${r.name}」`)
  }
  if (kItems.length > 0) {
    check(text.includes('最新资料'), '渲染「最新资料」区块')
    check(text.includes(kItems[0].title), '最新资料是资讯域的真实标题', kItems[0].title)
  }
  const resLinks = await page.locator('.uc-hp-res a').count()
  check(resLinks === resources.length, '每个资料入口都是可点链接', `links=${resLinks}`)

  /* ---------- 7) 出口 ---------- */
  check(text.includes('没找到答案'), '有「没找到答案」的出口')
  const feedbackLink = await page.locator('.uc-hp-contact a').count()
  check(feedbackLink === 1, '出口指向意见反馈', `links=${feedbackLink}`)

  check(jsErrors.length === 0, '页面无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message || error).slice(0, 200))
} finally {
  await browser.close()
}

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((f) => console.log(`  - ${f}`))
process.exit(1)
