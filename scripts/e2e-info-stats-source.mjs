#!/usr/bin/env node
/**
 * 供需统计口径回归（2026-10-28）
 *
 * 背景：清理 info_supply_demand / info_sd_match 死表后，工作台、运营大盘、数据报表
 * 里的供需数一度还在读那两张只剩演示数据的表 —— 数字永远不变，运营看着像没人用。
 *
 * 现在所有口径都实时向交易模块取数，本脚本逐项比对「接口返回」与「交易端真实值」，
 * 同时确认全站搜索里的供需结果不再为空、门户侧联系方式已脱敏。
 *
 * 用法：node scripts/e2e-info-stats-source.mjs
 */
const SSO = 'http://localhost:8090'
const INFO = 'http://localhost:8104'
const TRADE = 'http://localhost:8086'

const login = async (u, p) => {
  const r = await fetch(`${SSO}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: u, password: p }),
  })
  return (await r.json())?.data?.accessToken ?? ''
}
const get = async (url, token) => {
  const r = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  return { status: r.status, json: await r.json() }
}

let bad = 0
const ok = (cond, label, extra = '') => {
  console.log(`${cond ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!cond) bad++
}

// 交易端真实数（基准）
const hall = await get(`${TRADE}/api/trade/public/hall/products?pageNum=1&pageSize=1`)
const supplyReal = hall.json?.data?.total ?? -1
const dem = await get(`${TRADE}/api/trade/public/demands`)
const demandReal = Array.isArray(dem.json?.data) ? dem.json.data.length : (dem.json?.data?.records?.length ?? -1)
console.log(`基准：交易端供应 ${supplyReal} 条、需求 ${demandReal} 条\n`)

// 1. 门户 overview
const pub = await get(`${INFO}/api/v1/info/public/overview`)
const pubStats = pub.json?.data?.stats
ok(pub.status === 200 && typeof pubStats?.onlineSupplyDemand === 'number',
  '门户 overview 返回 onlineSupplyDemand', `值=${pubStats?.onlineSupplyDemand}`)
ok(pubStats?.onlineSupplyDemand === supplyReal + demandReal,
  '门户供需数与交易端一致', `${pubStats?.onlineSupplyDemand} vs ${supplyReal + demandReal}`)

// 2. 用户端 overview
const seller = await login('19900002005', 'Test12345')
const usr = await get(`${INFO}/api/v1/info/overview`, seller)
const usrStats = usr.json?.data?.stats
ok(usr.status === 200 && usrStats?.onlineSupplyDemand === supplyReal + demandReal,
  '用户端 overview 供需数与交易端一致', `值=${usrStats?.onlineSupplyDemand}`)

// 3. 运营端 dashboard 卡片
const admin = await login('admin', 'Admin@123')
const dash = await get(`${INFO}/api/v1/info/ops/dashboard`, admin)
const cards = dash.json?.data?.cards ?? []
const card = cards.find((c) => c.label === '在线供需信息')
ok(dash.status === 200 && Boolean(card), '运营大盘保留「在线供需信息」卡片')
ok(card && card.value === String(supplyReal + demandReal),
  '大盘卡片数值为交易端实时数', `卡片=${card?.value} 期望=${supplyReal + demandReal} 备注=${card?.note}`)
ok(cards[2]?.label === '在线供需信息', '卡片顺序未变（第 3 张）', `实际第3张=${cards[2]?.label}`)

// 4. 运营端 stats.sdStats
const st = await get(`${INFO}/api/v1/info/ops/stats`, admin)
const sd = st.json?.data?.sdStats
ok(st.status === 200 && Boolean(sd), '运营报表返回 sdStats')
ok(sd && sd.supply === supplyReal && sd.demand === demandReal,
  'sdStats 与交易端一致', `supply=${sd?.supply}/${supplyReal} demand=${sd?.demand}/${demandReal}`)

// 5. 登录态搜索
// 关键词不能硬编码品类名 —— 库里没有该品类的商品时，「搜不到」是正确结果，
// 断言就会假失败。改成从交易端取一条真实在架商品，用它的名字片段去搜。
const hallFirst = await get(`${TRADE}/api/trade/public/hall/products?pageNum=1&pageSize=1`)
const sampleName = hallFirst.json?.data?.records?.[0]?.productName ?? ''
const kw = encodeURIComponent(sampleName.slice(0, 2) || 'a')
console.log(`\n搜索关键词取自在架商品：「${sampleName.slice(0, 2)}」（${sampleName}）`)

const s1 = await get(`${INFO}/api/v1/info/search?keyword=${kw}`, seller)
const s1sd = s1.json?.data?.supplyDemands
ok(s1.status === 200 && Array.isArray(s1sd), '用户端搜索返回 supplyDemands 数组', `条数=${s1sd?.length}`)
ok(Array.isArray(s1sd) && s1sd.length > 0, '用户端搜索能搜到真实供需', `条数=${s1sd?.length} 关键词=${sampleName.slice(0, 2)}`)
ok(s1.json?.data?.total === (s1.json?.data?.articles?.length ?? 0) + (s1.json?.data?.quotes?.length ?? 0)
  + (s1.json?.data?.knowledge?.length ?? 0) + (s1sd?.length ?? 0) + (s1.json?.data?.reports?.length ?? 0),
  'total 已含供需条数', `total=${s1.json?.data?.total}`)

// 6. 门户搜索（脱敏）
const s2 = await get(`${INFO}/api/v1/info/public/search?keyword=${kw}`)
const s2sd = s2.json?.data?.supplyDemands
ok(s2.status === 200 && Array.isArray(s2sd), '门户搜索返回 supplyDemands 数组', `条数=${s2sd?.length}`)
const leaked = (s2sd ?? []).filter((it) => it.contactPhone && !String(it.contactPhone).includes('*'))
ok(leaked.length === 0, '门户搜索的联系方式已脱敏', leaked.length ? JSON.stringify(leaked[0].contactPhone) : '无明文号码')

console.log(`\n${bad === 0 ? '全部通过' : `失败 ${bad} 项`}`)
if (bad) process.exitCode = 1
