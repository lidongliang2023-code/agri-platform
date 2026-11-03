/**
 * S2B2C · 资金口径端到端（佣金只在真的成交后结算；身份只从令牌取）
 *
 * 修的是钱的问题，所以验的也必须是钱：本轮之前，佣金在**下单时**就生成 PENDING，
 * 而「批量结算」只按 `status='PENDING'` 筛、**完全不看订单状态** ——
 * 买家下完单不付款、或付款后申请退款，运营端点一次结算就能把佣金结给渠道，
 * 渠道再提现、平台打款，钱在货没成交的时候就出去了。
 *
 * 这条脚本把整条链跑通，并在每一个"还不该给钱"的节点上断言结算必须挡住：
 *   未付款 → 未发货 → 未确认收货 → 有进行中的售后 → 已完成且无售后（这才允许结算）
 * 同时验三件配套的事：
 *   1. 状态机在服务端：待付款的单不能"确认收货"，未付款的单不能发货；
 *   2. 归属：供应商发别人的订单必须 403；替别人领券 / 看别人的佣金必须拿不到；
 *   3. 审计字段（结算操作人、提现审核人、打款人）来自令牌，不是写死的"平台运营"。
 *
 * 造出来的订单/佣金/批次/提现/售后/券记录跑完全部删除，商品库存与销量按快照还原。
 * 用法：node scripts/e2e-s2b2c-money-guard.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const require2 = createRequire(path.join('C:/Users/71502/.workbuddy-ai/binaries/node/workspace', 'noop.js'))
const { chromium } = require2('playwright-core')

const BROWSER = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => existsSync(p))
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const CORE = 'http://localhost:8093'
const API = 'http://localhost:8088'
/** 运营端结算页（网关虚拟主机） */
const PLATFORM = 'http://localhost:8103'
const OUT = path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  'outputs', 's2b2c-money-guard-20261102')
mkdirSync(OUT, { recursive: true })

const sql = (query) => {
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query],
      { encoding: 'utf8' }).trim()
  } catch (error) {
    return `ERR:${String(error?.message ?? error).slice(0, 160)}`
  }
}

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const PASSWORD = (() => {
  try {
    const src = readFileSync('scripts/e2e-mdm-sso-loop.mjs', 'utf8')
    return src.match(/登录密码"\]'\)\.first\(\)\.fill\('([^']+)'\)/)[1]
  } catch {
    return 'Admin@123'
  }
})()

const suffix = String(Date.now()).slice(-8)
const MARK = `E2E${suffix}`
/** 供应商 1（supplier1 的店铺）与供应商 2（无主，用来验跨供应商发货被拒） */
const OWN_PRODUCT = 1
const OTHER_PRODUCT = 3
const CHANNEL_ID = 1

const created = {
  orderIds: [], commissionIds: [], batchNos: [], withdrawalIds: [], afterSaleIds: [],
  couponUserIds: [], consumerIds: [], addressIds: [], couponIds: [],
}
/** 下单会扣库存、加销量：按商品记下本次造了几件（只用于日志），还原走下面的绝对值快照 */
const productDelta = {}
/**
 * 在任何造数之前取一次库存/销量的绝对值，收尾原样写回。
 * 不用"加减本次件数"：退款分支自己会回补库存，两头一起算迟早漂（本轮实测每轮少 1 件）。
 */
const productSnapshot = {}
for (const pid of [OWN_PRODUCT, OTHER_PRODUCT]) {
  productSnapshot[pid] = {
    stock: sql(`SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = ${pid}`),
    sales: sql(`SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = ${pid}`),
  }
}
const tokens = {}

const call = async (method, pathname, { body, query, bearer } = {}) => {
  const url = new URL(`${API}${pathname}`)
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })
  const response = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${bearer ?? tokens.admin}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let json = {}
  try { json = JSON.parse(text) } catch { json = { raw: text.slice(0, 120) } }
  return { status: response.status, body: json }
}

const orderStatus = (id) => sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = ${id}`)
const commissionStatus = (id) => sql(`SELECT status FROM agri_s2b2c.s2b2c_commission WHERE id = ${id}`)
const commissionsOf = (orderIds) => sql(
  `SELECT id FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${orderIds.join(',')})`)
const settle = async (payload, bearer) => (await call('POST', '/api/platform/commission/settlement',
  { body: payload ?? {}, bearer: bearer ?? tokens.admin })).body

/** 结算一次并断言"这一笔还没该结"，返回后端给的未结算明细 */
const expectBlocked = async (commissionId, needle, label) => {
  const result = await settle({})
  const hit = (result.blocked ?? []).find((item) => String(item.commissionId) === String(commissionId))
  check(result.success === false && Number(result.count) === 0 && hit
    && String(hit.reason).includes(needle),
    label, hit ? `reason=${hit.reason}` : `未结算明细里没有这笔佣金（blocked=${result.blockedCount}）`)
  check(commissionStatus(commissionId) === 'PENDING',
    `   ↳ 数据库侧同一结论：佣金 ${commissionId} 仍是 PENDING`, commissionStatus(commissionId))
  return result
}

let browser
let page

try {
  /* ---------- 0) 四个身份的登录态 ---------- */
  for (const username of ['admin', 'farmer', 'channel1', 'supplier1']) {
    const response = await (await fetch(`${CORE}/api/v1/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: PASSWORD, marketId: 1 }),
    })).json().catch(() => ({}))
    tokens[username] = response?.data?.accessToken ?? ''
  }
  check(Object.values(tokens).every(Boolean),
    '取得 admin / farmer（买家）/ channel1（渠道）/ supplier1（供应商）四个登录态',
    Object.entries(tokens).map(([k, v]) => `${k}=${v ? 'ok' : 'FAIL'}`).join(' '))

  /* ---------- 1) 基线（库存与销量在收尾按本次件数还原） ---------- */
  check(Number(sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_order WHERE remark = '${MARK}'`) || '0') === 0,
    `基线：本次标记（${MARK}）没有历史残留订单`)
  check(Number(sql(
    `SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission c
       JOIN agri_s2b2c.s2b2c_order o ON o.id = c.order_id
      WHERE o.status = 'COMPLETED' AND c.status = 'PENDING'`) || '0') === 0,
    '基线：库里没有「已完成但未结算」的历史佣金，后面的结算计数才只反映本次造的数据')

  /* 渠道先把两个供应商的商品选进自己店铺 —— 没有渠道商品就不会产生佣金，也就验不到结算 */
  for (const productId of [OWN_PRODUCT, OTHER_PRODUCT]) {
    const picked = await call('POST', '/api/channel/select-product',
      { query: { channelId: CHANNEL_ID, productId }, bearer: tokens.channel1 })
    check(picked.body.success === true || String(picked.body.message ?? '').includes('已'),
    `渠道 1 选入商品 ${productId}（有渠道商品才会有佣金）`,
    `code=${picked.status} ${String(picked.body.message ?? '').slice(0, 40)}`)
  }

  /* ---------- 2) 买家下两单：一单归供应商 1（自己的），一单归供应商 2（别人的） ---------- */
  const consumerId = sql(
    `SELECT id FROM agri_s2b2c.s2b2c_consumer WHERE user_id =
      (SELECT id FROM agri_core.platform_user WHERE username = 'farmer') LIMIT 1`)
  check(/^\d+$/.test(consumerId), 'farmer 有消费者档案（下单归属由令牌解析）', `consumerId=${consumerId}`)
  created.consumerIds.push(consumerId)
  let addressId = sql(`SELECT id FROM agri_s2b2c.s2b2c_address WHERE consumer_id = ${consumerId}
      AND status = 'ACTIVE' LIMIT 1`)
  if (!/^\d+$/.test(addressId)) {
    // 这个买家档案是自动建出来的，本来就没有收货地址 —— 没有地址就下不了单，也就验不到结算
    const added = await call('POST', '/api/consumer/address/add', {
      bearer: tokens.farmer,
      body: { name: '端到端收件人', phone: '13800001111', province: '黑龙江省', city: '哈尔滨市',
        district: '道里区', address: `${MARK} 测试地址`, isDefault: true, status: 'ACTIVE' },
    })
    addressId = sql(`SELECT id FROM agri_s2b2c.s2b2c_address WHERE consumer_id = ${consumerId}
      AND address LIKE '%${MARK}%' LIMIT 1`)
    if (/^\d+$/.test(addressId)) created.addressIds.push(addressId)
    check(added.body.success === true && /^\d+$/.test(addressId),
      '为本次的买家建一条收货地址（请求体不传 isDefault 时原先会 NPE 成 500，已一并修掉）',
      `addressId=${addressId}`)
  } else {
    check(true, 'farmer 已有可用收货地址', `addressId=${addressId}`)
  }

  const orderIdsBySupplier = {}
  for (const productId of [OWN_PRODUCT, OTHER_PRODUCT]) {
    const addCart = await call('POST', '/api/consumer/cart/add',
      { query: { consumerId, productId, quantity: 1, channelId: CHANNEL_ID }, bearer: tokens.farmer })
    check(addCart.body.success === true, `商品 ${productId} 加入购物车（带渠道 1）`,
      String(addCart.body.message ?? ''))
    const placed = await call('POST', '/api/consumer/order/create',
      { body: { addressId: String(addressId), payMethod: 'ONLINE', deliveryType: 'EXPRESS', remark: MARK },
        bearer: tokens.farmer })
    const ids = (placed.body.orderIds ?? []).map(String)
    check(placed.body.success === true && ids.length === 1,
      `下单一笔（商品 ${productId}）`, `orderIds=${ids.join(',')} ${String(placed.body.message ?? '')}`)
    if (ids[0]) {
      created.orderIds.push(ids[0])
      orderIdsBySupplier[productId] = ids[0]
      productDelta[productId] = (productDelta[productId] ?? 0) + 1
    }
  }
  const ownOrderId = orderIdsBySupplier[OWN_PRODUCT]
  const otherOrderId = orderIdsBySupplier[OTHER_PRODUCT]
  check(Boolean(ownOrderId) && Boolean(otherOrderId) && ownOrderId !== otherOrderId,
    '拿到两笔订单：一笔属于供应商 1，一笔属于供应商 2（后面用来验跨供应商越权）')
  if (!ownOrderId || !otherOrderId) {
    // 后面每一步都建立在"有两笔真订单"上；缺了就立刻停，不要让空 id 拼进 SQL 造出一屏假红
    throw new Error(`下单没成功（own=${ownOrderId ?? '缺'} other=${otherOrderId ?? '缺'}），后续断言无意义`)
  }

  const commissionRows = sql(
    `SELECT id, order_id, amount FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${created.orderIds.join(',')})`)
      .split('\n').filter(Boolean)
  created.commissionIds = commissionRows.map((row) => row.split('\t')[0])
  check(commissionRows.length === 2,
    '两笔订单各生成一条 PENDING 佣金（佣金确实在下单时就存在 —— 这正是必须挡住结算的原因）',
    commissionRows.join(' | '))
  const ownCommissionId = commissionRows.find((row) => row.split('\t')[1] === ownOrderId)?.split('\t')[0] ?? ''
  const otherCommissionId = commissionRows.find((row) => row.split('\t')[1] === otherOrderId)?.split('\t')[0] ?? ''
  check(Boolean(ownCommissionId) && Boolean(otherCommissionId), '两条佣金分别对应两笔订单')

  /* ---------- 3) 未付款：结算必须挡住，且说得出原因 ---------- */
  await expectBlocked(ownCommissionId, '未付款',
    '订单还没付款 → 结算挡住，并在回执里写明「买家尚未付款」（不是只回"没有待结算佣金"）')
  check(Number(sql(
    `SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission_settlement WHERE created_at >= NOW() - INTERVAL 2 MINUTE`) || '0') === 0,
    '没有为"结不动"的佣金生成空批次')

  /* ---------- 4) 状态机：待付款不能确认收货、不能发货 ---------- */
  const earlyReceive = await call('PUT', `/api/consumer/order/receive/${ownOrderId}`, { bearer: tokens.farmer })
  check(earlyReceive.body.success === false && String(earlyReceive.body.message).includes('待付款'),
    '待付款的单点「确认收货」被服务端拒绝，并把当前档位说给用户（修前这一步会直接把单做成已完成）',
    String(earlyReceive.body.message ?? ''))
  check(orderStatus(ownOrderId) === 'PENDING_PAY', '   ↳ 数据库里订单状态没被改动', orderStatus(ownOrderId))

  const earlyShip = await call('PUT', '/api/platform/order/ship',
    { query: { id: ownOrderId, logisticsNo: `${MARK}-NA`, company: '测试物流' }, bearer: tokens.supplier1 })
  check(earlyShip.status === 400 && String(earlyShip.body.message).includes('待付款'),
    '未付款的单也不能发货（发货要订单已经是待发货）', `status=${earlyShip.status} ${String(earlyShip.body.message ?? '')}`)

  /* ---------- 5) 支付后仍不能结算：未发货 ---------- */
  const paid = await call('PUT', `/api/consumer/order/pay/${ownOrderId}`, { bearer: tokens.farmer })
  check(paid.body.success === true && orderStatus(ownOrderId) === 'PENDING_SHIP',
    '支付成功：订单进入待发货并写下付款时间',
    `status=${orderStatus(ownOrderId)} payTime=${sql(`SELECT IFNULL(pay_time,'NULL') FROM agri_s2b2c.s2b2c_order WHERE id=${ownOrderId}`)}`)
  await expectBlocked(ownCommissionId, '未发货', '已付款但没发货 → 仍然不能结算')

  /* ---------- 6) 归属：供应商不能发别人的订单 ---------- */
  const crossShip = await call('PUT', '/api/platform/order/ship',
    { query: { id: otherOrderId, logisticsNo: `${MARK}-X`, company: '测试物流' }, bearer: tokens.supplier1 })
  check(crossShip.status === 403 && String(crossShip.body.message).includes('不属于当前供应商'),
    'supplier1 给供应商 2 的订单发货被拒（修前这条只按 id + 状态更新，任何 fulfillment 账号都能发别人的货）',
    `status=${crossShip.status} ${String(crossShip.body.message ?? '')}`)
  check(orderStatus(otherOrderId) === 'PENDING_PAY', '   ↳ 被拒的那一单状态未被改动', orderStatus(otherOrderId))

  const ownShip = await call('PUT', '/api/platform/order/ship',
    { query: { id: ownOrderId, logisticsNo: `${MARK}-OK`, company: '顺丰' }, bearer: tokens.supplier1 })
  check(ownShip.body.success === true && orderStatus(ownOrderId) === 'SHIPPED',
    '同一账号发自己店铺的订单成功（归属判定没有把正常路径一起堵死）',
    `status=${orderStatus(ownOrderId)}`)
  await expectBlocked(ownCommissionId, '尚未确认收货', '已发货但买家未确认收货 → 仍然不能结算')

  /* ---------- 7) 完成：这才允许结算，且操作人来自令牌 ---------- */
  const received = await call('PUT', `/api/consumer/order/receive/${ownOrderId}`, { bearer: tokens.farmer })
  check(received.body.success === true && orderStatus(ownOrderId) === 'COMPLETED',
    '确认收货：订单已完成', `status=${orderStatus(ownOrderId)}`)
  const settled = await settle({})
  created.batchNos.push(String(settled.batchNo ?? ''))
  check(settled.success === true && Number(settled.count) >= 1
    && (settled.blocked ?? []).every((item) => String(item.commissionId) !== String(ownCommissionId)),
    '订单完成后结算放行：这一笔进了批次',
    `count=${settled.count} batch=${settled.batchNo} blocked=${settled.blockedCount}`)
  check(commissionStatus(ownCommissionId) === 'SETTLED',
    '   ↳ 佣金确实变成 SETTLED（渠道可提现的余额只算 SETTLED）', commissionStatus(ownCommissionId))
  const operator = sql(
    `SELECT operator FROM agri_s2b2c.s2b2c_commission_settlement WHERE batch_no = '${settled.batchNo}'`)
  check(operator === 'admin', '结算批次的操作人来自令牌（修前写死"平台运营"，审计字段是装饰）', `operator=${operator}`)

  /* ---------- 8) 有进行中的售后：结算必须再挡一次 ---------- */
  await call('PUT', `/api/consumer/order/pay/${otherOrderId}`, { bearer: tokens.farmer })
  await call('PUT', '/api/platform/order/ship',
    { query: { id: otherOrderId, logisticsNo: `${MARK}-OK2`, company: '顺丰' }, bearer: tokens.admin })
  await call('PUT', `/api/consumer/order/receive/${otherOrderId}`, { bearer: tokens.farmer })
  check(orderStatus(otherOrderId) === 'COMPLETED', '第二单也走完到已完成（用 admin 代发，验证平台运营仍可代发）',
    orderStatus(otherOrderId))
  const afterSale = await call('POST', '/api/consumer/after-sales',
    { body: { orderId: String(otherOrderId), type: 'REFUND', reason: `端到端：退款申请-${MARK}`, amount: 10 },
      bearer: tokens.farmer })
  check(afterSale.body.success === true, '对已完成的单提交售后（金额 10 元）', String(afterSale.body.message ?? ''))
  const afterSaleId = sql(
    `SELECT id FROM agri_s2b2c.s2b2c_after_sale WHERE order_id = ${otherOrderId} ORDER BY id DESC LIMIT 1`)
  if (/^\d+$/.test(afterSaleId)) created.afterSaleIds.push(afterSaleId)
  await expectBlocked(otherCommissionId, '处理中的售后',
    '订单已完成但有进行中的售后 → 仍然不能结算（先结后驳回就得往回追钱）')

  /* ---------- 9) 身份只从令牌：替别人领券 / 看别人的数据 ---------- */
  const couponRow = sql(`SELECT id FROM agri_s2b2c.s2b2c_coupon
      WHERE status = 'ACTIVE' AND remain_count > 0 AND valid_start <= CURDATE() AND valid_end >= CURDATE()
      ORDER BY id LIMIT 1`)
  check(/^\d+$/.test(couponRow), '库里有一张可领的在售优惠券', `couponId=${couponRow}`)
  const spoof = await call('POST', '/api/consumer/coupon/receive',
    { query: { consumerId, couponId: couponRow }, bearer: tokens.admin })
  const couponUserId = sql(`SELECT id FROM agri_s2b2c.s2b2c_coupon_user
      WHERE coupon_id = ${couponRow} AND consumer_id = (
        SELECT id FROM agri_s2b2c.s2b2c_consumer WHERE user_id =
          (SELECT id FROM agri_core.platform_user WHERE username = 'admin') LIMIT 1)
      ORDER BY id DESC LIMIT 1`)
  const couponOwner = sql(`SELECT consumer_id FROM agri_s2b2c.s2b2c_coupon_user WHERE id = ${couponUserId}`)
  const adminConsumerId = sql(
    `SELECT id FROM agri_s2b2c.s2b2c_consumer WHERE user_id =
      (SELECT id FROM agri_core.platform_user WHERE username = 'admin') LIMIT 1`)
  if (/^\d+$/.test(couponUserId)) created.couponUserIds.push(String(couponUserId))
  created.couponIds.push(String(couponRow))
  check(spoof.body.success === true && String(couponOwner) === String(adminConsumerId),
    '请求体/参数里传别人的 consumerId 也不会记到别人名下：券落在调用者自己档案上',
    `传的是 ${consumerId}，实际记的是 ${couponOwner}（admin 的档案 ${adminConsumerId}）`)
  const farmerCoupons = await call('GET', '/api/consumer/coupons',
    { query: { consumerId: adminConsumerId }, bearer: tokens.farmer })
  check((farmerCoupons.body ?? []).every((row) => String(row.id) !== String(couponOwner)),
    'farmer 带着 admin 的 consumerId 也读不到 admin 的券（参数不再采信，只回自己的）',
    `farmer 看到 ${(farmerCoupons.body ?? []).length} 张`)

  const growthAsFarmer = await call('GET', '/api/channel/growth', { bearer: tokens.farmer })
  check(growthAsFarmer.status === 403,
    '非渠道账号读渠道增长视图被拒（修前任何人传 channelId 都能看任意渠道的佣金明细）',
    `status=${growthAsFarmer.status}`)
  const growthAsChannel = await call('GET', '/api/channel/growth', { bearer: tokens.channel1 })
  const growthCommissions = ((growthAsChannel.body ?? {}).commissions ?? []).map((row) => String(row.id))
  const channelOwned = sql(`SELECT id FROM agri_s2b2c.s2b2c_commission WHERE channel_id = ${CHANNEL_ID}`)
    .split(/\s+/).filter(Boolean).map(String)
  const foreign = sql(`SELECT id FROM agri_s2b2c.s2b2c_commission WHERE channel_id <> ${CHANNEL_ID}`)
    .split(/\s+/).filter(Boolean).map(String)
  check(growthAsChannel.status === 200
    && growthCommissions.length === channelOwned.length
    && channelOwned.every((id) => growthCommissions.includes(id))
    && foreign.every((id) => !growthCommissions.includes(id)),
    '渠道 1 看到的佣金集合与库里 channel_id=1 完全一致（归属由令牌解析，不再按参数取任意渠道）',
    `页面 ${growthCommissions.length} 条 / 库里 ${channelOwned.length} 条，别的渠道 ${foreign.length} 条未混入`)

  /* ---------- 10) 提现与打款：审核人/打款人都来自令牌 ---------- */
  const settledAmount = sql(
    `SELECT COALESCE(SUM(amount),0) FROM agri_s2b2c.s2b2c_commission
      WHERE channel_id = ${CHANNEL_ID} AND status = 'SETTLED'`)
  const overWithdraw = await call('POST', '/api/channel/withdrawal',
    { body: { amount: Number(settledAmount) + 1000 }, bearer: tokens.channel1 })
  check(overWithdraw.body.success === false && String(overWithdraw.body.message).includes('余额不足'),
    '提现金额超过已结算佣金会被拒（可提余额只算 SETTLED —— 所以第 3~6 步的挡住是真的把钱守住了）',
    String(overWithdraw.body.message ?? '').slice(0, 40))
  const applyWithdraw = await call('POST', '/api/channel/withdrawal',
    { body: { amount: Number(settledAmount) }, bearer: tokens.channel1 })
  const withdrawalId = sql(
    `SELECT id FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE channel_id = ${CHANNEL_ID}
      AND status = 'PENDING' ORDER BY id DESC LIMIT 1`)
  if (/^\d+$/.test(withdrawalId)) created.withdrawalIds.push(withdrawalId)
  check(applyWithdraw.body.success === true && /^\d+$/.test(withdrawalId),
    `按已结算金额（¥${settledAmount}）申请提现成功`, `withdrawalId=${withdrawalId}`)
  const approved = await call('PUT', `/api/platform/withdrawal/${withdrawalId}/review`,
    { query: { status: 'APPROVED', remark: '端到端通过' }, bearer: tokens.admin })
  // 先批通过，再试"不填流水号就标记已打款"——状态机本身也会挡，必须让它走到"缺流水号"这一条
  const paidNoNumber = await call('PUT', `/api/platform/withdrawal/${withdrawalId}/review`,
    { query: { status: 'PAID' }, bearer: tokens.admin })
  check(approved.body.success === true
    && paidNoNumber.body.success === false && String(paidNoNumber.body.message).includes('流水号'),
    '已审核通过但没填打款流水号 → 不能标记已打款（既有规则仍在，本轮没有把它改松）',
    String(paidNoNumber.body.message ?? ''))
  const paidRow = await call('PUT', `/api/platform/withdrawal/${withdrawalId}/review`,
    { query: { status: 'PAID', payoutNo: `${MARK}-PAYOUT` }, bearer: tokens.admin })
  const audit = sql(`SELECT CONCAT(status,'|',reviewer,'|',payout_operator)
      FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE id = ${withdrawalId}`)
  check(approved.body.success === true && paidRow.body.success === true
    && String(audit).startsWith('PAID|admin|admin'),
    '提现走完 PENDING→APPROVED→PAID，审核人与打款人都记的是令牌账号（修前两处都写死"平台运营"）', audit)

  /* ---------- 11) 运营端结算页：结果面板真的显示"为什么没结算" ---------- */
  browser = await chromium.launch({ headless: true, executablePath: BROWSER, args: ['--no-sandbox'] })
  page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
  const jsErrors = []
  page.on('pageerror', (error) => jsErrors.push(String(error?.message ?? error).slice(0, 160)))
  await page.goto(`${PLATFORM}/`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  // 运营端不维护独立登录：首屏会跳统一认证中心，那里要先切到「账号 + 密码」再填
  const tab = page.locator('button').filter({ hasText: '账号 + 密码' })
  if (await tab.count()) await tab.first().click({ timeout: 10000 })
  await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 15000 })
  await page.locator('input[placeholder*="用户名"]').first().fill('admin')
  await page.locator('input[placeholder*="登录密码"], input[placeholder*="密码"]').first().fill(PASSWORD)
  await page.locator('button').filter({ hasText: '登' }).first().click()
  await page.waitForURL(`${PLATFORM}/**`, { timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(3500)
  await page.goto(`${PLATFORM}/settlement`, { waitUntil: 'networkidle', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(3000)
  const pageText = () => page.evaluate(() => document.body.innerText)
  const body11 = await pageText()
  check(body11.includes('分润结算') && body11.includes('已完成'),
    '结算页写清了口径（订单已完成才可结算），不再只说"PENDING → SETTLED"',
    body11.includes('分润结算') ? '' : '没进结算页')
  await page.locator('button').filter({ hasText: '批量结算待结算佣金' }).first().click()
  await page.waitForTimeout(3500)
  const afterSettle = (await pageText()).replace(/\s+/g, ' ')
  check(afterSettle.includes('本次结算结果')
    && (afterSettle.includes('处理中的售后') || afterSettle.includes('尚未确认收货') || afterSettle.includes('未付款')),
    '点一次结算后页面常驻"本次结算结果"，逐条列出还没结算的佣金与原因（不再只有一条三秒就消失的提示）',
    afterSettle.match(/本次结算结果[^]{0,120}/)?.[0]?.slice(0, 140) ?? '')
  await page.screenshot({ path: path.join(OUT, '01-settlement-result.png'), fullPage: true })
  check(jsErrors.length === 0, '结算页无自身 JS 错误', jsErrors.slice(0, 2).join(' | '))
} catch (error) {
  check(false, '流程异常', String(error?.message ?? error).slice(0, 240))
} finally {
  await page?.context().close().catch(() => {})
  await browser?.close().catch(() => {})
  /* ---------- 清理：本次造的每一行都删掉，库存/销量按快照还原 ---------- */
  const ids = created.orderIds.length ? created.orderIds.join(',') : '0'
  sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${ids})`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_after_sale WHERE order_id IN (${ids})`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_logistics WHERE order_id IN (${ids})`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id IN (${ids})`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id IN (${ids})`)
  for (const batchNo of created.batchNos.filter(Boolean)) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission_settlement WHERE batch_no = '${batchNo}'`)
  }
  for (const withdrawalId of created.withdrawalIds) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE id = ${withdrawalId}`)
  }
  for (const couponId of created.couponUserIds) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_coupon_user WHERE id = ${couponId}`)
  }
  for (const addressId of created.addressIds) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = ${addressId}`)
  }
  // 领券会扣 remain_count，删掉领取记录的同时要把库存还回去
  for (const couponId of created.couponIds) {
    sql(`UPDATE agri_s2b2c.s2b2c_coupon SET remain_count = remain_count + 1 WHERE id = ${couponId}`)
  }
  // 本次造的渠道选品关系也退回原状（跑之前 s2b2c_channel_product 是 0 行）
  sql(`DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = ${CHANNEL_ID}
      AND product_id IN (${OWN_PRODUCT},${OTHER_PRODUCT})`)
  sql('DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id IN ('
    + (created.consumerIds.join(',') || '0') + ')')
  // 库存与销量按开场快照原样写回，演示数据不能被测试跑花
  for (const [pid, snap] of Object.entries(productSnapshot)) {
    if (snap.stock && !snap.stock.startsWith('ERR') && snap.sales && !snap.sales.startsWith('ERR')) {
      sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = ${snap.stock}, sales = ${snap.sales} WHERE id = ${pid}`)
    }
  }
  const residueOrder = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_order WHERE id IN (${ids})`)
  const residueCommission = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${ids})`)
  const residueWithdrawal = created.withdrawalIds.length
    ? sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE id IN (${created.withdrawalIds.join(',')})`) : '0'
  const residueBatch = created.batchNos.filter(Boolean).length
    ? sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission_settlement WHERE batch_no IN ('${created.batchNos.filter(Boolean).join("','")}')`) : '0'
  const residueAfterSale = created.afterSaleIds.length
    ? sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_after_sale WHERE id IN (${created.afterSaleIds.join(',')})`) : '0'
  const residueCart = sql(
    `SELECT COUNT(*) FROM agri_s2b2c.s2b2c_cart WHERE consumer_id IN (${created.consumerIds.join(',') || '0'})`)
  const residuePick = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_channel_product
      WHERE channel_id = ${CHANNEL_ID} AND product_id IN (${OWN_PRODUCT},${OTHER_PRODUCT})`)
  console.log('')
  check(residueOrder === '0' && residueCommission === '0' && residueWithdrawal === '0'
    && residueBatch === '0' && residueAfterSale === '0',
    '清理：订单、佣金、结算批次、提现、售后全部零残留',
    `order=${residueOrder} commission=${residueCommission} batch=${residueBatch} withdrawal=${residueWithdrawal} afterSale=${residueAfterSale}`)
  check(residueCart === '0' && residuePick === '0',
    '清理：购物车与本次造的渠道选品关系也归零（跑前它们就是 0 行）',
    `cart=${residueCart} pick=${residuePick}`)
  const stockNow = sql(`SELECT CONCAT(id,':',stock,'-',IFNULL(sales,0)) FROM agri_s2b2c.s2b2c_product
      WHERE id IN (${OWN_PRODUCT},${OTHER_PRODUCT})`).replace(/\s+/g, ' ').trim()
  const stockWanted = [OWN_PRODUCT, OTHER_PRODUCT]
    .map((pid) => `${pid}:${productSnapshot[pid].stock}-${productSnapshot[pid].sales}`).join(' ')
  check(stockNow === stockWanted,
    '清理：商品库存与销量回到开场快照（下单扣的、退款补的都不留在演示数据里）',
    `现在=${stockNow} 应为=${stockWanted}`)
}

console.log('')
if (!failures.length) {
  console.log('S2B2C 资金口径端到端验证全部通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((label) => console.log('  -', label))
process.exit(1)
