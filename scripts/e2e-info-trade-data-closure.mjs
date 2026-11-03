#!/usr/bin/env node
/**
 * 信息资讯 ↔ 交易撮合 数据闭环验证（2026-10-28）
 *
 * 背景：信息资讯 PC 端已不再有发布表单，改为跳转交易端卖家中心/买家中心发布。
 * 那么"在交易端发布后，信息资讯端到底看不看得到"就成了一条必须验证的链路——
 * 跳转通了不代表数据通了。
 *
 * 本脚本走接口层，验证四件事：
 *   1. 交易端发布商品/需求后，信息资讯大厅（BFF）能否查到
 *   2. 信息资讯「我发布过的」能否查到，状态是否正确
 *   3. 状态映射是否与交易端真实状态一致（重点看 pending / published）
 *   4. 结束后清理测试数据，不污染演示库
 *
 * 用法：node scripts/e2e-info-trade-data-closure.mjs
 */
import process from 'node:process'

const TRADE = 'http://localhost:8086'
const INFO = 'http://localhost:8104'
const SSO = 'http://localhost:8090'
const USER = process.env.E2E_USER || '19900002005'
const PASS = process.env.E2E_PASS || 'Test12345'
const ADMIN = { user: process.env.E2E_ADMIN || 'admin', pass: process.env.E2E_ADMIN_PASS || 'Admin@123' }

const stamp = Date.now().toString().slice(-6)
const PRODUCT_NAME = `闭环验证供应${stamp}`
const DEMAND_NAME = `闭环验证求购${stamp}`

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}
const note = (label, extra = '') => console.log(`· ${label}${extra ? `　${extra}` : ''}`)

let token = ''
const created = { productId: null, demandId: null }

async function api(method, url, body, extraHeaders = {}) {
  const headers = { ...extraHeaders }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (token) headers.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try {
    json = JSON.parse(text)
  } catch {
    // 非 JSON 响应保留原文便于排查
  }
  return { status: res.status, json, text }
}

const unwrap = (res) => (res.json && typeof res.json === 'object' && 'data' in res.json ? res.json.data : res.json)
// 统一认证返回 code=0，交易/信息模块返回 code=200，两个都算成功。
const ok = (res) => Boolean(res.json) && (res.json.code === 0 || res.json.code === 200)

async function main() {
  console.log(`\n=== 信息资讯 ↔ 交易撮合 数据闭环 ===\n账号 ${USER}\n`)

  // ---------- 0. 登录 ----------
  const login = await api('POST', `${SSO}/api/v1/auth/login`, { username: USER, password: PASS })
  const loginData = unwrap(login)
  token = loginData?.accessToken || ''
  check(Boolean(token), '统一认证登录成功', token ? `token 长度 ${token.length}` : login.text.slice(0, 120))
  if (!token) return

  // ---------- 1. 取品类 ----------
  const cats = await api('GET', `${TRADE}/api/trade/public/categories`)
  const catList = unwrap(cats)
  const category = Array.isArray(catList) ? catList.find((item) => item && item.id && item.categoryName) : null
  check(Boolean(category), '取到交易端品类', category ? `${category.categoryName}(${category.id})` : cats.text.slice(0, 120))
  if (!category) return

  // ---------- 2. 交易端卖家中心发布商品（模拟用户跳过去自己发布） ----------
  const productRes = await api(
    'POST',
    `${TRADE}/api/trade/seller/product/mine`,
    {
      productName: PRODUCT_NAME,
      categoryId: category.id,
      categoryName: category.categoryName,
      variety: category.categoryName,
      unit: '斤',
      price: 3.2,
      priceMin: 3.2,
      priceMax: 3.6,
      priceType: 'fixed',
      stockQuantity: 800,
      minOrderQuantity: 100,
      originProvince: '山东省',
      originCity: '潍坊市',
      originDistrict: '寿光市',
      specLevel: '一级',
      description: '信息资讯跳转交易端发布的闭环验证数据',
      images: ['/images/trade/demo-closure.jpg'],
    },
  )
  const product = unwrap(productRes)
  created.productId = product?.id ?? null
  check(ok(productRes) && Boolean(created.productId), '交易端卖家中心发布商品成功',
    created.productId ? `id=${created.productId} publishStatus=${product.publishStatus}` : productRes.text.slice(0, 160))
  if (!created.productId) return

  const productPublished = product.publishStatus === 'published'
  note('商品 publishStatus', product.publishStatus)

  // ---------- 3. 交易端大厅是否可见 ----------
  const hall = await api('GET', `${TRADE}/api/trade/public/hall/products?pageNum=1&pageSize=10&keyword=${encodeURIComponent(PRODUCT_NAME)}`)
  const hallData = unwrap(hall)
  const hallHit = Array.isArray(hallData?.records) && hallData.records.some((item) => item.id === created.productId)
  // 大厅只列 publish_status=published；待审核不可见是业务规则，不是缺陷。
  check(hallHit === productPublished, '交易端大厅可见性与审核状态一致',
    `publishStatus=${product.publishStatus} 大厅可见=${hallHit}`)

  // ---------- 4. 信息资讯大厅（BFF）是否可见 ----------
  const infoList = await api('GET', `${INFO}/api/v1/info/public/supply-demands?type=supply&page=1&size=10&keyword=${encodeURIComponent(PRODUCT_NAME)}`)
  const infoData = unwrap(infoList)
  const infoHit = Array.isArray(infoData?.items) && infoData.items.some((item) => item.tradeId === created.productId)
  check(infoHit === productPublished, '信息资讯供需大厅可见性与审核状态一致',
    `items=${infoData?.items?.length ?? '?'} 可见=${infoHit}`)

  // ---------- 5. 信息资讯「我发布过的」 ----------
  const mine = await api('GET', `${INFO}/api/v1/info/supply-demands/mine?type=supply`)
  const mineItems = unwrap(mine)?.items
  const mineItem = Array.isArray(mineItems) ? mineItems.find((item) => item.tradeId === created.productId) : null
  check(Boolean(mineItem), '信息资讯「我发布过的」能查到该商品',
    mineItem ? `status=${mineItem.status}` : `共 ${Array.isArray(mineItems) ? mineItems.length : '?'} 条`)

  // 状态映射必须反映交易端真实状态：pending 的商品不能显示成 online
  if (mineItem) {
    const expected = productPublished ? 'online' : 'pending'
    check(mineItem.status === expected, '我的发布状态与交易端 publishStatus 一致',
      `信息端=${mineItem.status} 交易端=${product.publishStatus} 期望=${expected}`)
  }

  // ---------- 6. 交易端发布采购需求 ----------
  const demandRes = await api('POST', `${TRADE}/api/trade/demand`, {
    demandName: DEMAND_NAME,
    productName: DEMAND_NAME,
    categoryName: category.categoryName,
    variety: category.categoryName,
    quantity: 1200,
    unit: '斤',
    expectedPrice: 3.1,
    priceMin: 3.0,
    priceMax: 3.4,
    deliveryProvince: '山东省',
    deliveryCity: '济南市',
    additionalRequirements: '信息资讯跳转交易端发布的闭环验证数据',
  })
  const demand = unwrap(demandRes)
  created.demandId = demand?.id ?? null
  check(ok(demandRes) && Boolean(created.demandId), '交易端买家中心发布需求成功',
    created.demandId ? `id=${created.demandId} demandStatus=${demand.demandStatus}` : demandRes.text.slice(0, 160))
  if (!created.demandId) return
  note('需求 demandStatus', demand.demandStatus)

  // ---------- 7. 信息资讯需求侧可见性 ----------
  const infoDemand = await api('GET', `${INFO}/api/v1/info/public/supply-demands?type=demand&page=1&size=10&keyword=${encodeURIComponent(DEMAND_NAME)}`)
  const infoDemandData = unwrap(infoDemand)
  const demandHit = Array.isArray(infoDemandData?.items)
    && infoDemandData.items.some((item) => item.tradeId === created.demandId)
  check(demandHit, '信息资讯供需大厅能查到该需求',
    `items=${infoDemandData?.items?.length ?? '?'}${demandHit ? '' : '（未命中）'}`)

  // ---------- 8. 信息资讯需求侧「我发布过的」 ----------
  const mineDemand = await api('GET', `${INFO}/api/v1/info/supply-demands/mine?type=demand`)
  const mineDemandItems = unwrap(mineDemand)?.items
  const mineDemandItem = Array.isArray(mineDemandItems)
    ? mineDemandItems.find((item) => item.tradeId === created.demandId)
    : null
  check(Boolean(mineDemandItem), '信息资讯「我发布的求购」能查到该需求',
    mineDemandItem ? `status=${mineDemandItem.status}` : `共 ${Array.isArray(mineDemandItems) ? mineDemandItems.length : '?'} 条`)

  if (mineDemandItem) {
    const expectedDemand = demand.demandStatus === 'pending' ? 'pending'
      : ['completed', 'closed', 'cancelled', 'expired'].includes(demand.demandStatus) ? 'offline'
        : 'online'
    check(mineDemandItem.status === expectedDemand, '求购状态与交易端 demandStatus 一致',
      `信息端=${mineDemandItem.status} 交易端=${demand.demandStatus} 期望=${expectedDemand}`)
  }
}

async function cleanup() {
  if (!token) return
  console.log('\n--- 清理测试数据 ---')
  if (created.productId) {
    // 直接删。以前是「置 status=0 + 运营下架」，记录会一直堆在库里，
    // 而且下架后仍占着「全部」列表，跑几轮演示库就全是测试商品。
    const res = await api('DELETE', `${TRADE}/api/trade/product/${created.productId}`)
    console.log(`· 商品 ${created.productId} 删除：${ok(res) ? 'ok' : res.text.slice(0, 80)}`)
  }
  if (created.demandId) {
    const res = await api('DELETE', `${TRADE}/api/trade/demand/${created.demandId}`)
    console.log(`· 需求 ${created.demandId} 删除：${ok(res) ? 'ok' : res.text.slice(0, 80)}`)
  }
}

try {
  await main()
} catch (error) {
  console.error('执行异常：', error)
  failures.push('脚本异常')
} finally {
  await cleanup()
}

console.log(`\n${failures.length === 0 ? '全部通过' : `失败 ${failures.length} 项`}`)
if (failures.length) {
  failures.forEach((item) => console.log(`  - ${item}`))
  process.exitCode = 1
}
