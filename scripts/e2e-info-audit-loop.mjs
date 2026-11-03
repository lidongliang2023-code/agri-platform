#!/usr/bin/env node
/**
 * 运营审核闭环验证（2026-10-28）
 *
 * 修复前：运营端「供需审核」读的是 info_supply_demand（用户端早就不写的死表），
 * 审核台里只有建表时塞的演示数据，运营点"通过"对用户端毫无影响。
 *
 * 本脚本验证真实链路：
 *   卖家发布商品(pending) → 大厅看不到 → 运营端待审核能看到
 *   → 运营通过 → 大厅可见、我的发布变在线
 *   → 运营下架 → 大厅再次不可见、我的发布变已下架
 *
 * 用法：node scripts/e2e-info-audit-loop.mjs
 */
import process from 'node:process'

const TRADE = 'http://localhost:8086'
const INFO = 'http://localhost:8104'
const SSO = 'http://localhost:8090'

const SELLER = { user: '19900002005', pass: 'Test12345' }
const ADMIN = { user: 'admin', pass: 'Admin@123' }

const stamp = Date.now().toString().slice(-6)
const NAME = `审核闭环验证${stamp}`

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const note = (label, extra = '') => console.log(`· ${label}${extra ? `　${extra}` : ''}`)

async function login({ user, pass }) {
  const res = await fetch(`${SSO}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: user, password: pass }),
  })
  const json = await res.json()
  return json?.data?.accessToken ?? ''
}

function client(token) {
  return async (method, url, body) => {
    const headers = { Authorization: `Bearer ${token}` }
    if (body !== undefined) headers['Content-Type'] = 'application/json'
    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
    const text = await res.text()
    let json = null
    try { json = JSON.parse(text) } catch { /* 保留原文 */ }
    return { status: res.status, json, text }
  }
}

const unwrap = (res) => (res.json && typeof res.json === 'object' && 'data' in res.json ? res.json.data : res.json)
const ok = (res) => Boolean(res.json) && (res.json.code === 0 || res.json.code === 200)

async function hallHit(call, productId) {
  const res = await call('GET', `${INFO}/api/v1/info/public/supply-demands?type=supply&page=1&size=10&keyword=${encodeURIComponent(NAME)}`)
  const items = unwrap(res)?.items ?? []
  return items.some((item) => item.tradeId === productId)
}

async function mineStatus(call, productId) {
  const res = await call('GET', `${INFO}/api/v1/info/supply-demands/mine?type=supply`)
  const items = unwrap(res)?.items ?? []
  return items.find((item) => item.tradeId === productId)?.status ?? null
}

let productId = null

try {
  const sellerToken = await login(SELLER)
  const adminToken = await login(ADMIN)
  check(Boolean(sellerToken) && Boolean(adminToken), '卖家与运营账号均登录成功')
  if (!sellerToken || !adminToken) throw new Error('登录失败')

  const seller = client(sellerToken)
  const admin = client(adminToken)

  // ---------- 1. 取品类并发布商品 ----------
  const cats = await seller('GET', `${TRADE}/api/trade/public/categories`)
  const category = (unwrap(cats) ?? []).find((item) => item && item.id && item.categoryName)
  check(Boolean(category), '取到交易端品类', category?.categoryName ?? '')

  const created = await seller('POST', `${TRADE}/api/trade/seller/product/mine`, {
    productName: NAME,
    categoryId: category.id,
    categoryName: category.categoryName,
    variety: category.categoryName,
    unit: '斤',
    price: 2.8,
    stockQuantity: 300,
    minOrderQuantity: 50,
    originProvince: '山东省',
    originCity: '潍坊市',
    description: '运营审核闭环验证数据',
    images: ['/images/trade/demo-audit.jpg'],
  })
  const product = unwrap(created)
  productId = product?.id ?? null
  check(ok(created) && Boolean(productId), '卖家发布商品成功', `id=${productId} publishStatus=${product?.publishStatus}`)
  if (!productId) throw new Error('发布失败')

  // ---------- 2. 待审核：大厅不可见，我的发布待审核 ----------
  check(!(await hallHit(seller, productId)), '待审核时信息资讯大厅查不到')
  check((await mineStatus(seller, productId)) === 'pending', '待审核时「我的发布」显示待审核', `status=${await mineStatus(seller, productId)}`)

  // ---------- 3. 运营端待审核列表能看到这条 ----------
  const opsPending = await admin('GET', `${INFO}/api/v1/info/ops/supply-demands?status=pending`)
  const pendingItems = unwrap(opsPending)?.items ?? []
  const inOps = pendingItems.some((item) => item.sdType === 'supply' && item.id === productId)
  check(ok(opsPending) && inOps, '运营端待审核列表能看到这条商品',
    `待审核 ${pendingItems.length} 条`)

  // ---------- 4. 运营审核通过 ----------
  const approve = await admin('POST', `${INFO}/api/v1/info/ops/supply-demands/${productId}/audit?type=supply`, {
    action: 'approve',
    note: '资料齐全，准予上线',
  })
  check(ok(approve), '运营审核通过', approve.json?.message ?? approve.text.slice(0, 100))

  check(await hallHit(seller, productId), '审核通过后信息资讯大厅可以查到')
  check((await mineStatus(seller, productId)) === 'online', '审核通过后「我的发布」显示在线', `status=${await mineStatus(seller, productId)}`)

  const tradeDetail = await seller('GET', `${TRADE}/api/trade/seller/product/mine/${productId}`)
  check(unwrap(tradeDetail)?.publishStatus === 'published', '交易端商品状态同步为 published',
    `publishStatus=${unwrap(tradeDetail)?.publishStatus}`)

  // ---------- 5. 运营下架 ----------
  const offline = await admin('POST', `${INFO}/api/v1/info/ops/supply-demands/${productId}/audit?type=supply`, {
    action: 'offline',
    note: '价格与平台监测价偏离过大，先下架核实',
  })
  check(ok(offline), '运营下架成功')

  check(!(await hallHit(seller, productId)), '下架后信息资讯大厅不再展示')
  check((await mineStatus(seller, productId)) === 'offline', '下架后「我的发布」显示已下架', `status=${await mineStatus(seller, productId)}`)

  const afterOffline = await seller('GET', `${TRADE}/api/trade/seller/product/mine/${productId}`)
  check(unwrap(afterOffline)?.publishStatus === 'offline', '交易端商品状态同步为 offline',
    `publishStatus=${unwrap(afterOffline)?.publishStatus}`)
} catch (error) {
  console.error('执行异常：', error)
  failures.push('脚本异常')
} finally {
  // 清理：直接删掉验证商品。只下架的话记录会一直堆在库里，
  // 跑几轮演示库就多出一堆「审核闭环验证xxxx」。
  if (productId) {
    const sellerToken = await login(SELLER)
    if (sellerToken) {
      const seller = client(sellerToken)
      const res = await seller('DELETE', `${TRADE}/api/trade/product/${productId}`)
      console.log(`\n· 清理：商品 ${productId} 已删除（${ok(res) ? 'ok' : 'skip'}）`)
    }
  }
}

console.log(`\n${failures.length === 0 ? '全部通过' : `失败 ${failures.length} 项`}`)
failures.forEach((item) => console.log(`  - ${item}`))
if (failures.length) process.exitCode = 1
