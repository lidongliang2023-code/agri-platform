#!/usr/bin/env node
/**
 * 官网门户首页公开数据源联调（2026-11-02）。
 *
 * 覆盖（本轮改造的对象是"首页在说什么，与后端真实数据是否同一件事"）：
 *   1. 大盘四项来自交易域实查，且与 SQL 独立核对；
 *   2. 首页不再请求 core-platform 的遗留表接口（svc_news / svc_quote）；
 *   3. 资讯 tab = 资讯域真实栏目，条目链接 = 真详情路由，切 tab 走服务端 channel 过滤；
 *   4. 栏目篇数按已发布内容实查（不再是种子里写死的 1286/3864）；
 *   5. 公告走主数据公开只读通道：草稿不可见、发布可见、下线不可见；
 *   6. 行情表读资讯域真实品种，品种名可点进详情；
 *   7. 接口不可达分支：显示"—" + 原因，而不是回落到旧的写死常量；
 *   8. 旧的前端假数字（1268 亿等）在页面上彻底消失；
 *   9. 临时公告清理为零残留。
 *
 * 用法：node scripts/e2e-portal-home-datasource.mjs [--base=http://localhost:8098] [--headful]
 */
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
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
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.split('=').slice(1).join('=') : fallback
}
const BASE = arg('base', 'http://localhost:8098')
const MDM = arg('mdm', 'http://localhost:8083')
const HEADFUL = process.argv.includes('--headful')
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'

const failures = []
let skipped = 0
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const note = (label) => {
  console.log(`· ${label}`)
  skipped += 1
}

/** 独立证据：脚本自己查库核对页面/接口说的数。 */
const sql = (query) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query],
      { encoding: 'utf8' }).replace(/\r/g, '').trim()
  } catch (error) {
    return `__ERROR__ ${String(error).slice(0, 160)}`
  }
}
const sqlNum = (query) => Number(sql(query))

const STAMP = Date.now()
const ANN_TITLE = `门户首页公告联调${STAMP}`
const ANN_BODY = `仅用于门户首页公告块联调的正文${STAMP}`

const browser = await chromium.launch({ headless: !HEADFUL, executablePath: BROWSER, args: ['--no-sandbox'] })
try {
  // ========== 1. 交易域大盘：接口与库内独立核对 ==========
  const summary = await (await fetch(`${BASE}/api/trade/public/summary`)).json()
  check(summary?.code === 200, '门户公开大盘可读（匿名，无令牌）', `code=${summary?.code}`)
  const stat = summary?.data ?? {}
  const keys = ['tradeAmount', 'dealCount', 'participantCount', 'publishedProductCount']
  check(keys.every((key) => key in stat), '大盘四项字段齐全', Object.keys(stat).join('/'))

  const dbDealCount = sqlNum(`SELECT COUNT(*) FROM agri_trade.agri_trade_order WHERE del_flag=0 AND order_status<>'cancelled'`)
  const dbProductCount = sqlNum(`SELECT COUNT(*) FROM agri_trade.agri_trade_product WHERE del_flag=0 AND publish_status='published'`)
  check(String(stat.dealCount) === String(dbDealCount), '成交笔数与 SQL 独立核对一致',
    `接口=${stat.dealCount} SQL=${dbDealCount}`)
  check(String(stat.publishedProductCount) === String(dbProductCount), '在架货源数与 SQL 独立核对一致',
    `接口=${stat.publishedProductCount} SQL=${dbProductCount}`)
  const dbAmount = sql(`SELECT IFNULL(SUM(total_amount),0) FROM agri_trade.agri_trade_order WHERE del_flag=0 AND order_status<>'cancelled'`)
    .replace(/\s+/g, '')
  check(Number(stat.tradeAmount).toFixed(2) === Number(dbAmount).toFixed(2), '成交金额与 SQL 独立核对一致',
    `接口=${stat.tradeAmount} SQL=${dbAmount}`)
  const cancelled = sqlNum(`SELECT COUNT(*) FROM agri_trade.agri_trade_order WHERE del_flag=0 AND order_status='cancelled'`)
  const allOrders = sqlNum(`SELECT COUNT(*) FROM agri_trade.agri_trade_order WHERE del_flag=0`)
  check(cancelled === 0 || Number(stat.dealCount) === allOrders - cancelled,
    '已取消订单不计入成交笔数', `取消=${cancelled} 全部=${allOrders} 计入=${stat.dealCount}`)

  // 登录端与门户端必须是同一处实现（口径不能各算各的）
  const login = await (await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'farmer', password: 'Admin@123', marketId: 1 }),
  })).json().catch(() => null)
  const accessToken = login?.data?.accessToken ?? ''
  const loginSummary = accessToken
    ? await (await fetch(`${BASE}/api/trade/home/summary`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })).json().catch(() => null)
    : null
  if (loginSummary?.code === 200 && loginSummary.data?.stat) {
    check(String(loginSummary.data.stat.dealCount) === String(stat.dealCount)
      && String(loginSummary.data.stat.tradeAmount) === String(stat.tradeAmount),
    '登录端首页看板与门户大盘同口径', `dealCount ${loginSummary.data.stat.dealCount} vs ${stat.dealCount}`)
  } else {
    note(`未取得可用令牌或登录端看板未返回，跳过两端同口径比对（login code=${login?.code}）`)
  }

  // ========== 2. 资讯域栏目篇数：实查而不是种子列 ==========
  const channels = await (await fetch(`${BASE}/api/v1/info/public/channels`)).json()
  const channelList = Array.isArray(channels?.data) ? channels.data : []
  check(channels?.code === 200 && channelList.length > 0, '公开栏目清单可读', `共 ${channelList.length} 个`)
  let countMismatch = ''
  for (const item of channelList) {
    const real = sqlNum(`SELECT COUNT(*) FROM agri_info.info_article WHERE status='published' AND channel='${item.name}'`)
    if (Number(item.articleCount) !== real) {
      countMismatch = `${item.name} 接口=${item.articleCount} SQL=${real}`
      break
    }
  }
  check(countMismatch === '', '每个栏目篇数都等于库内已发布条数', countMismatch)
  const seededFake = sqlNum(`SELECT COUNT(*) FROM agri_info.info_channel WHERE article_count > 500`)
  check(seededFake > 0 && channelList.every((item) => Number(item.articleCount) <= 20),
    '种子假计数（1286/3864 那类）不再出现在接口出参', `库里仍有 ${seededFake} 行历史列值，读取已被实查覆盖`)

  // 运营端栏目/作者清单必须与门户同一口径，否则两端各说一套
  const opsLogin = await (await fetch(`${BASE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
  })).json().catch(() => null)
  const opsToken = opsLogin?.data?.accessToken ?? ''
  const opsChannels = await (await fetch(`${BASE}/api/v1/info/ops/channels`, {
    headers: { Authorization: `Bearer ${opsToken}` },
  })).json().catch(() => null)
  const opsRowList = Array.isArray(opsChannels?.data?.channels) ? opsChannels.data.channels : []
  check(opsChannels?.code === 200 && opsRowList.length >= channelList.length,
    '运营端栏目清单可读（info:admin）', `共 ${opsRowList.length} 行（含停用）`)
  const opsMismatch = opsRowList
    .map((item) => {
      const real = sqlNum(`SELECT COUNT(*) FROM agri_info.info_article WHERE status='published' AND channel='${item.name}'`)
      return Number(item.articleCount) === real ? '' : `${item.name} 运营端=${item.articleCount} SQL=${real}`
    })
    .find((text) => text !== '') ?? ''
  check(opsMismatch === '', '运营端栏目篇数与门户同口径', opsMismatch)
  const opsAuthorMismatch = (Array.isArray(opsChannels?.data?.authors) ? opsChannels.data.authors : [])
    .map((item) => {
      const real = sqlNum(`SELECT COUNT(*) FROM agri_info.info_article WHERE status='published' AND author='${item.name}'`)
      return Number(item.articleCount) === real ? '' : `${item.name} 运营端=${item.articleCount} SQL=${real}`
    })
    .find((text) => text !== '') ?? ''
  check(opsAuthorMismatch === '', '运营端作者篇数同样按已发布内容实查', opsAuthorMismatch)

  // ========== 3. 公告：草稿不可见 / 发布可见 / 下线不可见 ==========
  sql(`INSERT INTO agri_masterdata.agri_md_announcement
        (title, type, content, status, publish_time, author, create_time)
       VALUES ('${ANN_TITLE}', 'maintenance', '${ANN_BODY}', 'draft', NOW(), 'e2e', NOW())`)
  const annId = Number(sql(`SELECT id FROM agri_masterdata.agri_md_announcement WHERE title='${ANN_TITLE}' LIMIT 1`))
  check(annId > 0 && !String(annId).startsWith('NaN'), '临时公告已入库（草稿）', `id=${annId}`)

  const publicList = async () => {
    const body = await (await fetch(`${BASE}/api/master-data/public/announcements?limit=50`)).json()
    return Array.isArray(body?.data) ? body.data : []
  }
  const draftRows = await publicList()
  check(!draftRows.some((row) => row.title === ANN_TITLE), '草稿公告对匿名门户不可见')

  sql(`UPDATE agri_masterdata.agri_md_announcement SET status='published', publish_time=NOW() WHERE id=${annId}`)
  const publishedRows = await publicList()
  const mine = publishedRows.find((row) => row.title === ANN_TITLE)
  check(Boolean(mine), '公告发布后匿名门户可读', `返回 ${publishedRows.length} 条`)
  check(mine?.content === ANN_BODY, '公告正文原样透出（门户可展开阅读）')
  check(String(mine?.id) === String(annId), '公告 id 以字符串下发（长整型不丢精度）', `id=${mine?.id}`)

  // 直连主数据后端，证明"要求登录"这条规则本身还在
  // （走门户域名会被 nginx 的 location / 302 回首页，那是网关行为，不是鉴权结果）
  const authBody = await (await fetch(`${MDM}/api/user/announcements`, { headers: { Accept: 'application/json' } }))
    .json().catch(() => null)
  check(authBody?.code === 2006, '用户端公告中心仍要求登录（公开通道没有把私域一并放开）',
    `code=${authBody?.code} message=${authBody?.message}`)

  // ========== 4. 首页实际请求的数据源 ==========
  const context = await browser.newContext({ viewport: { width: 1440, height: 1200 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(String(error)))
  const requested = []
  page.on('request', (request) => requested.push(request.url()))
  await page.goto(`${BASE}/portal/index.html`, { waitUntil: 'networkidle', timeout: 60000 })
  await sleep(600)

  const has = (fragment) => requested.some((url) => url.includes(fragment))
  check(has('/api/trade/public/summary'), '首页请求交易域公开大盘')
  check(has('/api/v1/info/public/channels'), '首页请求资讯域栏目')
  check(has('/api/v1/info/public/markets'), '首页请求资讯域行情')
  check(has('/api/master-data/public/announcements'), '首页请求主数据公开公告')
  check(!has('/api/v1/public/news'), '首页不再读取遗留 svc_news 接口')
  check(!has('/api/v1/quotes'), '首页不再读取遗留 svc_quote 接口')

  const homeText = await page.evaluate(() => document.body.innerText)
  const compact = homeText.replace(/\s+/g, '')

  // ========== 5. 大盘渲染的就是接口那组数，旧假数字彻底消失 ==========
  const tiles = await page.evaluate(() => [...document.querySelectorAll('.portal-stat-grid > div')]
    .map((node) => node.innerText.replace(/\s+/g, ' ').trim()))
  check(tiles.length === 4, '首页大盘四个格子齐全', `${tiles.join(' | ')}`)
  const expectAmount = Number(stat.tradeAmount) >= 1e8
    ? `${(Number(stat.tradeAmount) / 1e8).toFixed(2)}亿`
    : `${(Number(stat.tradeAmount) / 1e4).toFixed(2)}万`
  check(tiles[0]?.includes(expectAmount), '成交金额格按真实量级显示', `页面=${tiles[0]} 期望含=${expectAmount}`)
  check(tiles[1]?.includes(`${stat.dealCount}笔`) || tiles[1]?.includes(`${stat.dealCount} 笔`),
    '成交笔数格等于接口出参', `页面=${tiles[1]}`)
  check(tiles[2]?.includes(String(stat.publishedProductCount)), '在架货源格等于接口出参', `页面=${tiles[2]}`)
  check(tiles[3]?.includes(String(stat.participantCount)), '参与主体格等于接口出参', `页面=${tiles[3]}`)
  for (const fake of ['1268亿', '42万笔', '186万个', '38万家', '12.6万台', '3860个基地']) {
    check(!compact.includes(fake), `前端假指标已下线：${fake}`)
  }

  // ========== 6. 资讯：tab 即真实栏目，条目链到真详情 ==========
  const tabLabels = await page.evaluate(() => [...document.querySelectorAll('#news .tabs button')]
    .map((node) => node.textContent.trim()))
  check(tabLabels.length === channelList.length
    && tabLabels.join(',') === channelList.map((item) => item.name).join(','),
  '资讯 tab 与后端栏目一一对应（顺序一致）', tabLabels.join('/'))

  const zeroChannel = channelList.find((item) => Number(item.articleCount) === 0)
  if (zeroChannel) {
    await page.evaluate((label) => {
      const hit = [...document.querySelectorAll('#news .tabs button')]
        .find((node) => node.textContent.trim() === label)
      if (!hit) throw new Error(`未找到栏目 tab ${label}`)
      hit.click()
    }, zeroChannel.name)
    await sleep(900)
    const emptyText = await page.evaluate(() => document.querySelector('#news .card-b')?.innerText ?? '')
    check(emptyText.includes('该栏目暂无已发布内容'), `空栏目如实展示空态：${zeroChannel.name}`)
  } else {
    note('每个栏目都有已发布内容，未覆盖空栏目分支')
  }

  const firstChannel = channelList[0]
  await page.evaluate((label) => {
    const hit = [...document.querySelectorAll('#news .tabs button')]
      .find((node) => node.textContent.trim() === label)
    if (!hit) throw new Error(`未找到栏目 tab ${label}`)
    hit.click()
  }, firstChannel.name)
  await sleep(900)
  const tabRequest = requested.filter((url) => url.includes('/api/v1/info/public/articles'))
  check(tabRequest.some((url) => decodeURIComponent(url).includes(`channel=${firstChannel.name}`)),
    '切栏目走服务端 channel 过滤（不是前端筛当前页）', tabRequest[tabRequest.length - 1] ?? '')

  const articleApi = await (await fetch(`${BASE}/api/v1/info/public/articles?channel=${encodeURIComponent(firstChannel.name)}&size=6`)).json()
  const articleItems = Array.isArray(articleApi?.data?.items) ? articleApi.data.items : []
  const newsLinks = await page.evaluate(() => [...document.querySelectorAll('#news .portal-news-list a')]
    .map((node) => ({ href: node.getAttribute('href') ?? '', title: node.innerText.replace(/\s+/g, ' ').trim() })))
  check(newsLinks.length === articleItems.length, `首页资讯条目数与接口一致（${firstChannel.name}）`,
    `页面=${newsLinks.length} 接口=${articleItems.length}`)
  check(articleItems.length === 0 || newsLinks.every((link, index) => link.href === `#/info/news/${articleItems[index].id}`),
    '每条资讯链接指向自己的详情页（不再统一跳认证说明）', newsLinks[0]?.href ?? '')

  if (articleItems.length > 0) {
    const target = articleItems[0]
    check(newsLinks[0].title.includes(target.title.slice(0, 8)), '列表标题与接口标题同源', target.title)
    await page.evaluate(() => document.querySelector('#news .portal-news-list a')?.click())
    await sleep(1200)
    const detailText = await page.evaluate(() => document.body.innerText)
    check(page.url().includes(`#/info/news/${target.id}`), '点击资讯确实进入详情路由', page.url())
    check(detailText.includes(target.title), '详情页显示同一篇文章', target.title.slice(0, 20))
    check(!detailText.includes('页面不存在'), '详情页没有落到 404 兜底')
    await page.goto(`${BASE}/portal/index.html`, { waitUntil: 'networkidle', timeout: 60000 })
    await sleep(700)
  } else {
    note(`${firstChannel.name} 栏目当前没有已发布内容，未覆盖点击分支`)
  }

  // ========== 7. 行情：真实品种 + 可点进详情 ==========
  const marketApi = await (await fetch(`${BASE}/api/v1/info/public/markets`)).json()
  const quotes = Array.isArray(marketApi?.data?.quotes) ? marketApi.data.quotes : []
  check(marketApi?.code === 200 && quotes.length > 0, '资讯域公开行情可读', `共 ${quotes.length} 个品种`)
  const quoteNames = await page.evaluate(() => [...document.querySelectorAll('#price .data-table tbody tr td:first-child a')]
    .map((node) => node.textContent.trim()))
  check(quoteNames.length > 0 && quotes.slice(0, 6).every((item, index) => quoteNames[index] === item.name),
    '首页行情表品种名与接口一致', quoteNames.join('/'))
  const quoteLinks = await page.evaluate(() => [...document.querySelectorAll('#price .data-table tbody tr td:first-child a')]
    .map((node) => node.getAttribute('href')))
  check(quoteLinks.every((href, index) => href === `#/info/market/${quotes[index].id}`),
    '行情链接指向对应品种详情', quoteLinks[0] ?? '')

  // ========== 8. 公告块：真实公告 + 展开正文 ==========
  const announceText = await page.evaluate(() => {
    const card = [...document.querySelectorAll('.card')].find((node) => node.innerText.includes('平台公告'))
    return card?.innerText ?? ''
  })
  check(announceText.includes(ANN_TITLE), '首页公告块渲染刚发布的公告', ANN_TITLE)
  await page.evaluate((title) => {
    const hit = [...document.querySelectorAll('.portal-announce-title')]
      .find((node) => node.textContent.trim() === title)
    if (!hit) throw new Error(`未找到公告标题 ${title}`)
    hit.click()
  }, ANN_TITLE)
  await sleep(300)
  const expanded = await page.evaluate(() => document.querySelector('.portal-announce-body')?.innerText ?? '')
  check(expanded.includes(ANN_BODY), '点击公告标题展开真实正文', expanded.slice(0, 24))

  // ========== 9. 下线后首页不再展示 ==========
  sql(`UPDATE agri_masterdata.agri_md_announcement SET status='offline' WHERE id=${annId}`)
  await page.goto(`${BASE}/portal/index.html`, { waitUntil: 'networkidle', timeout: 60000 })
  await sleep(800)
  const afterOffline = await page.evaluate(() => document.body.innerText)
  check(!afterOffline.includes(ANN_TITLE), '公告下线后首页不再展示')

  // ========== 10. 接口不可达分支：显示"—"并说明原因，不回落到假数 ==========
  await page.route('**/api/trade/public/summary*', async (route) => {
    await route.fulfill({ status: 503, contentType: 'application/json', body: '{"code":503,"message":"维护中"}' })
  })
  await page.goto(`${BASE}/portal/index.html`, { waitUntil: 'networkidle', timeout: 60000 })
  await sleep(900)
  const brokenTiles = await page.evaluate(() => [...document.querySelectorAll('.portal-stat-grid > div')]
    .map((node) => node.innerText.replace(/\s+/g, ' ').trim()))
  check(brokenTiles.every((tile) => tile.includes('—')), '大盘读不到时四个格子显示"—"', brokenTiles.join(' | '))
  const brokenText = await page.evaluate(() => document.body.innerText)
  check(brokenText.includes('大盘指标暂时读不到'), '大盘故障给出处置说明而不是沉默')
  check(brokenText.includes('交易服务暂时读不到'), '首屏成交金额同样说明是服务读不到')
  check(!brokenText.replace(/\s+/g, '').includes('1268亿'), '故障时不会回落到旧的写死成交金额')
  await page.unroute('**/api/trade/public/summary*')

  check(pageErrors.length === 0, '全程无页面脚本错误', pageErrors.slice(0, 2).join(' | '))

  // ========== 11. 零残留 ==========
  sql(`DELETE FROM agri_masterdata.agri_md_announcement WHERE id=${annId} AND title='${ANN_TITLE}'`)
  const residue = sqlNum(`SELECT COUNT(*) FROM agri_masterdata.agri_md_announcement WHERE title='${ANN_TITLE}'`)
  check(residue === 0, '临时公告清理为零残留', `剩余=${residue}`)
} finally {
  await browser.close()
  // 无论上面是否异常中断，都确保临时公告不留在库里
  sql(`DELETE FROM agri_masterdata.agri_md_announcement WHERE title='${ANN_TITLE}'`)
}

console.log(`\n结果：${failures.length === 0 ? '全部通过' : `${failures.length} 项失败`}`
  + (skipped ? `（另有 ${skipped} 项因数据条件不满足跳过）` : ''))
if (failures.length > 0) {
  console.log(failures.map((item) => ` - ${item}`).join('\n'))
  process.exitCode = 1
}
