#!/usr/bin/env node
/**
 * 商品下单到售后退款全链路回归（2026-10-22）。
 *
 * 覆盖：
 *   商品 -> 下单 -> 买家支付 -> 卖家发货 -> 买家收货 -> 退货退款 -> 运营审核。
 *
 * 除接口断言外，还会直接查询 MySQL，确认订单、支付、退款、物流与轨迹真实落库。
 * 默认保留本次测试单据，便于在买家中心、卖家中心和运营端复核；加 --cleanup
 * 可在断言前删除本次测试产生的数据。
 *
 * 用法：
 *   node scripts/e2e-order-lifecycle.mjs
 *   node scripts/e2e-order-lifecycle.mjs --cleanup
 */
import { execFileSync } from 'node:child_process'
import process from 'node:process'

const arg = (name, fallback) => {
  const prefix = `--${name}=`
  const inline = process.argv.find((item) => item.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

const TRADE_URL = arg('trade', 'http://localhost:8086').replace(/\/$/, '')
const CORE_URL = arg('core', 'http://localhost:8093').replace(/\/$/, '')
const PRODUCT_ID = Number(arg('product', '7001'))
const QUANTITY = Number(arg('quantity', '2'))
const FREIGHT_AMOUNT = Number(arg('freight', '10'))
const BUYER = { username: arg('buyer', '19900002005'), password: arg('buyer-password', 'Test12345') }
const SELLER = { username: arg('seller', 'farmer'), password: arg('seller-password', 'Admin@123') }
const ADMIN = { username: arg('admin', 'admin'), password: arg('admin-password', 'Admin@123') }
const MYSQL = arg('mysql', 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe')
const MYSQL_PASSWORD = arg('mysql-password', 'root')
const CLEANUP = process.argv.includes('--cleanup')

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const login = async ({ username, password }) => {
  const response = await fetch(`${CORE_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, marketId: 1 }),
  })
  const body = await response.json()
  if (body.code !== 0 || !body.data?.accessToken) {
    throw new Error(`${username} 登录失败：${body.message ?? response.status}`)
  }
  return body.data.accessToken
}

const call = async (method, path, token, payload) => {
  const response = await fetch(`${TRADE_URL}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(payload === undefined ? {} : { body: JSON.stringify(payload) }),
  })
  let body
  try {
    body = await response.json()
  } catch {
    body = { code: response.status, message: await response.text() }
  }
  return { status: response.status, body }
}

const myMerchants = async (token) => {
  const response = await fetch(`${CORE_URL}/api/v1/platform/merchants/mine`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await response.json()
  if (body.code !== 0 || !Array.isArray(body.data)) {
    throw new Error(`读取经营主体失败：${body.message ?? response.status}`)
  }
  return body.data
}

const sql = (statement) => {
  const output = execFileSync(MYSQL, [
    '--default-character-set=utf8mb4',
    '-uroot',
    `-p${MYSQL_PASSWORD}`,
    '-N',
    '-B',
    '-e',
    statement,
  ], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  return output.trim().split(/\r?\n/).filter(Boolean).map((line) => line.split('\t'))
}

const scalar = (statement) => sql(statement)[0]?.[0] ?? ''

const cleanup = (orderId) => {
  if (!orderId) return
  sql(`
    DELETE t FROM agri_trade.agri_trade_logistics_trace t
    JOIN agri_trade.agri_trade_logistics l ON l.id = t.logistics_id
    WHERE l.order_id = ${orderId};
    DELETE FROM agri_trade.agri_trade_refund WHERE order_id = ${orderId};
    DELETE FROM agri_trade.agri_trade_payment WHERE order_id = ${orderId};
    DELETE FROM agri_trade.agri_trade_logistics WHERE order_id = ${orderId};
    DELETE FROM agri_trade.agri_trade_order_item WHERE order_id = ${orderId};
    DELETE FROM agri_trade.agri_trade_order WHERE id = ${orderId};
  `)
}

let orderId = null

try {
  console.log('== 登录与主体校验 ==')
  const [buyerToken, sellerToken, adminToken] = await Promise.all([
    login(BUYER),
    login(SELLER),
    login(ADMIN),
  ])
  const [buyerMerchants, sellerMerchants] = await Promise.all([
    myMerchants(buyerToken),
    myMerchants(sellerToken),
  ])
  // 主体号是 19 位 Long，超过 JS 安全整数范围，全链路一律按字符串比较。
  const buyerId = String(buyerMerchants[0]?.merchantId ?? '')
  const sellerIds = sellerMerchants.map((item) => String(item.merchantId))
  check(Boolean(buyerId), '买家账号已绑定唯一经营主体', String(buyerId))
  check(buyerMerchants.length === 1, '买家使用指定主体下单，避免多主体歧义', `${buyerMerchants.length} 个绑定`)
  check(sellerIds.length > 0, '卖家账号已绑定经营主体', sellerIds.join(','))

  const productRows = sql(`
    SELECT product_name, seller_id, price, stock_quantity, publish_status, del_flag
    FROM agri_trade.agri_trade_product
    WHERE id = ${PRODUCT_ID}
  `)
  const product = productRows[0]
  check(Boolean(product), `商品 ${PRODUCT_ID} 存在`)
  const productName = product?.[0] ?? ''
  const productSellerId = String(product?.[1] ?? '')
  const unitPrice = Number(product?.[2])
  const initialStock = Number(product?.[3])
  check(product?.[4] === 'published' && product?.[5] === '0', '商品已上架且可购买', `${product?.[4] ?? ''}/${product?.[5] ?? ''}`)
  check(sellerIds.includes(productSellerId), '当前卖家确实是该商品供货方', `seller=${productSellerId}`)
  check(!sellerIds.includes(buyerId), '买家与卖家为不同经营主体', `${buyerId} ≠ ${productSellerId}`)

  console.log('\n== 下单 ==')
  const created = await call('POST', '/api/trade/order/from-product', buyerToken, {
    productId: PRODUCT_ID,
    quantity: QUANTITY,
    freightAmount: FREIGHT_AMOUNT,
    deliveryProvince: '北京市',
    deliveryCity: '北京市',
    deliveryDistrict: '丰台区',
    deliveryAddress: '新发地批发市场全链路联调仓 A-01',
    deliveryContact: '全链路测试收货人',
    deliveryPhone: '13900000000',
  })
  orderId = Number(created.body.data?.id)
  const expectedTotal = unitPrice * QUANTITY + FREIGHT_AMOUNT
  check(created.body.code === 200 && orderId > 0, '从商品创建订单成功', `orderId=${orderId || created.body.message}`)
  const createdRow = sql(`
    SELECT buyer_id, seller_id FROM agri_trade.agri_trade_order WHERE id = ${orderId}
  `)[0] ?? []
  check(createdRow[0] === buyerId, '订单买方来自令牌主体', createdRow[0] ?? '')
  check(createdRow[1] === productSellerId, '订单卖方来自商品供货方', createdRow[1] ?? '')
  check(created.body.data?.orderStatus === 'pending_confirm'
    && created.body.data?.paymentStatus === 'unpaid', '初始状态为待确认/未支付', `${created.body.data?.orderStatus}/${created.body.data?.paymentStatus}`)
  check(Number(created.body.data?.totalAmount) === expectedTotal, '订单总价由服务端按单价、数量、运费计算',
    `¥${created.body.data?.totalAmount} expected=¥${expectedTotal}`)
  check(scalar(`SELECT COUNT(*) FROM agri_trade.agri_trade_order_item WHERE order_id = ${orderId}`) === '1',
    '订单明细已真实落库')
  if (!orderId) throw new Error('订单未创建成功，后续链路无法执行')

  console.log('\n== 支付 ==')
  const sellerPay = await call('POST', `/api/trade/order/${orderId}/pay`, sellerToken, { paymentMethod: 'transfer' })
  check(sellerPay.body.code !== 200, '卖家不能替买家支付', sellerPay.body.message ?? '')

  const paid = await call('POST', `/api/trade/order/${orderId}/pay`, buyerToken, { paymentMethod: 'transfer' })
  check(paid.body.code === 200, '买家支付成功', paid.body.message ?? '')
  const paymentCountAfterPay = Number(scalar(`
    SELECT COUNT(*) FROM agri_trade.agri_trade_payment
    WHERE order_id = ${orderId} AND del_flag = 0
  `))
  check(paymentCountAfterPay === 1, '支付流水仅生成一条', String(paymentCountAfterPay))

  const repeatedPay = await call('POST', `/api/trade/order/${orderId}/pay`, buyerToken, { paymentMethod: 'transfer' })
  const paymentCountAfterRepeat = Number(scalar(`
    SELECT COUNT(*) FROM agri_trade.agri_trade_payment
    WHERE order_id = ${orderId} AND del_flag = 0
  `))
  check(repeatedPay.body.code === 200 && paymentCountAfterRepeat === 1,
    '重复支付幂等，不重复记账', `payments=${paymentCountAfterRepeat}`)
  const paidRow = sql(`
    SELECT o.order_status, o.payment_status, o.paid_amount,
           p.payer_id, p.payee_id, p.payment_status, p.idempotent_key
    FROM agri_trade.agri_trade_order o
    JOIN agri_trade.agri_trade_payment p ON p.order_id = o.id
    WHERE o.id = ${orderId} AND p.del_flag = 0
  `)[0] ?? []
  check(paidRow[0] === 'paid' && paidRow[1] === 'paid' && Number(paidRow[2]) === expectedTotal,
    '订单已支付状态和金额同步落库', `${paidRow[0]}/${paidRow[1]}/¥${paidRow[2]}`)
  check(paidRow[3] === buyerId && paidRow[4] === productSellerId,
    '支付流水买卖双方正确', `${paidRow[3]} -> ${paidRow[4]}`)
  check(paidRow[5] === 'success' && paidRow[6] === `ORDER-PAY-${orderId}`,
    '支付流水成功状态与幂等键正确', `${paidRow[5]}/${paidRow[6]}`)

  console.log('\n== 发货 ==')
  const buyerShip = await call('POST', `/api/trade/order/${orderId}/ship`, buyerToken, {
    carrierName: '平台物流',
    carrierNo: `TEST-${Date.now()}`,
    logisticsType: 'road',
    location: '绿源农业合作社发货仓',
  })
  check(buyerShip.body.code !== 200, '买家不能代卖家发货', buyerShip.body.message ?? '')

  const shipped = await call('POST', `/api/trade/order/${orderId}/ship`, sellerToken, {
    carrierName: '平台物流',
    carrierNo: `TEST-${Date.now()}`,
    logisticsType: 'road',
    location: '绿源农业合作社发货仓',
  })
  const logisticsId = Number(shipped.body.data?.id)
  check(shipped.body.code === 200 && logisticsId > 0, '卖家发货成功并生成物流单', `logisticsId=${logisticsId || shipped.body.message}`)
  const shipRow = sql(`
    SELECT o.order_status, o.payment_status, o.logistics_status, o.logistics_id,
           l.logistics_status, l.pickup_time IS NOT NULL
    FROM agri_trade.agri_trade_order o
    JOIN agri_trade.agri_trade_logistics l ON l.id = o.logistics_id
    WHERE o.id = ${orderId}
  `)[0] ?? []
  check(shipRow[0] === 'shipped' && shipRow[1] === 'paid' && shipRow[2] === 'picked',
    '订单同步为已发货/已支付', `${shipRow[0]}/${shipRow[1]}/${shipRow[2]}`)
  check(shipRow[3] === String(logisticsId) && shipRow[4] === 'picked' && shipRow[5] === '1',
    '物流单与揽收时间真实落库', `${shipRow[3]}/${shipRow[4]}`)
  check(scalar(`
    SELECT COUNT(*) FROM agri_trade.agri_trade_logistics_trace
    WHERE logistics_id = ${logisticsId} AND trace_status = 'picked' AND del_flag = 0
  `) === '1', '揽收轨迹已写入')

  console.log('\n== 确认收货 ==')
  const sellerConfirm = await call('POST', `/api/trade/order/${orderId}/confirm-receipt`, sellerToken, {
    signReceiver: '卖家不可代签',
  })
  check(sellerConfirm.body.code !== 200, '卖家不能代买家确认收货', sellerConfirm.body.message ?? '')

  const received = await call('POST', `/api/trade/order/${orderId}/confirm-receipt`, buyerToken, {
    signReceiver: '全链路测试收货人',
  })
  check(received.body.code === 200, '买家确认收货成功', received.body.message ?? '')
  const receivedRow = sql(`
    SELECT o.order_status, o.logistics_status, o.buyer_confirmed,
           o.buyer_confirm_time IS NOT NULL, o.sign_time IS NOT NULL,
           l.logistics_status, l.sign_time IS NOT NULL, l.sign_receiver
    FROM agri_trade.agri_trade_order o
    JOIN agri_trade.agri_trade_logistics l ON l.id = o.logistics_id
    WHERE o.id = ${orderId}
  `)[0] ?? []
  check(receivedRow[0] === 'received' && receivedRow[1] === 'delivered' && receivedRow[2] === '1',
    '订单同步为已收货/已送达', `${receivedRow[0]}/${receivedRow[1]}`)
  check(receivedRow[3] === '1' && receivedRow[4] === '1'
    && receivedRow[5] === 'delivered' && receivedRow[6] === '1'
    && receivedRow[7] === '全链路测试收货人',
  '确认时间、签收时间和签收人同步落库')
  check(scalar(`
    SELECT COUNT(*) FROM agri_trade.agri_trade_logistics_trace
    WHERE logistics_id = ${logisticsId} AND trace_status = 'delivered' AND del_flag = 0
  `) === '1', '签收轨迹已写入')

  console.log('\n== 退货退款 ==')
  const refundApplied = await call('POST', `/api/trade/order/${orderId}/refund`, buyerToken, {
    refundType: 'return_refund',
    refundAmount: expectedTotal,
    refundReason: '联调验收：模拟收货后退货退款',
  })
  check(refundApplied.body.code === 200, '买家发起退货退款成功', refundApplied.body.message ?? '')
  const refundRow = sql(`
    SELECT r.id, r.refund_type, r.refund_amount, r.refund_status,
           r.applicant_id, r.payment_id, o.order_status
    FROM agri_trade.agri_trade_refund r
    JOIN agri_trade.agri_trade_order o ON o.id = r.order_id
    WHERE r.order_id = ${orderId} AND r.del_flag = 0
    ORDER BY r.id DESC LIMIT 1
  `)[0] ?? []
  const refundId = Number(refundRow[0])
  check(refundId > 0, '退款单已真实落库', `refundId=${refundId}`)
  check(refundRow[1] === 'return_refund' && Number(refundRow[2]) === expectedTotal,
    '退款类型与金额正确', `${refundRow[1]}/¥${refundRow[2]}`)
  check(refundRow[3] === 'pending' && refundRow[6] === 'refunding',
    '退款申请待审核，订单进入售后中', `${refundRow[3]}/${refundRow[6]}`)
  check(refundRow[4] === buyerId && Number(refundRow[5]) > 0,
    '退款申请人及原支付流水已关联', `applicant=${refundRow[4]}/payment=${refundRow[5]}`)

  const duplicateRefund = await call('POST', `/api/trade/order/${orderId}/refund`, buyerToken, {
    refundType: 'return_refund',
    refundAmount: expectedTotal,
    refundReason: '重复申请应当被拒绝',
  })
  check(duplicateRefund.body.code !== 200, '同一订单不能重复提交待审退款', duplicateRefund.body.message ?? '')

  console.log('\n== 运营审核 ==')
  const buyerAudit = await call('POST', `/api/trade/order/refund/${refundId}/audit`, buyerToken, {
    status: 'approved',
    reviewer: '越权申请人',
    remark: '不应通过',
  })
  check(buyerAudit.body.code !== 200, '普通买家不能审核退款', buyerAudit.body.message ?? '')

  const approved = await call('POST', `/api/trade/order/refund/${refundId}/audit`, adminToken, {
    status: 'approved',
    reviewer: '平台管理员',
    remark: '全链路联调审核通过',
  })
  check(approved.body.code === 200, '运营审核通过退款', approved.body.message ?? '')
  const finalRow = sql(`
    SELECT r.refund_status, r.refund_time IS NOT NULL, r.finish_time IS NOT NULL,
           o.order_status, o.payment_status, o.refund_amount,
           p.payment_status, p.idempotent_key
    FROM agri_trade.agri_trade_refund r
    JOIN agri_trade.agri_trade_order o ON o.id = r.order_id
    JOIN agri_trade.agri_trade_payment p ON p.id = r.payment_id
    WHERE r.id = ${refundId}
  `)[0] ?? []
  check(finalRow[0] === 'approved' && finalRow[1] === '1' && finalRow[2] === '1',
    '退款单已通过并记录完成时间')
  check(finalRow[3] === 'refunded' && finalRow[4] === 'refunded' && Number(finalRow[5]) === expectedTotal,
    '订单订单/支付状态与已退金额同步', `${finalRow[3]}/${finalRow[4]}/¥${finalRow[5]}`)
  check(finalRow[6] === 'refunded' && finalRow[7] === `ORDER-PAY-${orderId}`,
    '原支付流水同步为已退款', `${finalRow[6]}/${finalRow[7]}`)
  check(scalar(`
    SELECT COUNT(*) FROM agri_trade.agri_trade_order WHERE id = ${orderId} AND del_flag = 0
  `) === '1', '退款完成后订单仍可追溯，未被物理误删')

  const orderPage = await call('GET', `/api/trade/order/${orderId}`, buyerToken)
  check(orderPage.body.code === 200
    && orderPage.body.data?.orderStatus === 'refunded'
    && orderPage.body.data?.paymentStatus === 'refunded',
  '买家订单详情接口返回最终已退款状态')

  console.log(`\n全链路订单：${TRADE_URL}/order/detail/${orderId}`)
  console.log(`商品：${productName} / 初始库存 ${initialStock}`)
  console.log(`订单：${created.body.data?.orderNo} / 支付：${paidRow[6]} / 退款单：${refundId}`)
} catch (error) {
  check(false, '全链路回归执行未抛异常', String(error).slice(0, 300))
} finally {
  if (CLEANUP && orderId) {
    try {
      cleanup(orderId)
      console.log(`已清理测试订单 ${orderId}`)
    } catch (error) {
      console.error(`清理测试订单 ${orderId} 失败：${String(error)}`)
      failures.push('清理测试数据')
    }
  }
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
