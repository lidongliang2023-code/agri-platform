#!/usr/bin/env node
/**
 * 买家中心全链路回归（2026-10-22）：
 * 发布采购需求 → 撮合与询价 → 卖家报价 → 买家受理成单 → 双方签合同
 * → 支付/发货/收货 → 售后纠纷 → 评价 → 申请开票 → 运营开票。
 *
 * 另建一张短链路订单验证收货后退款及买家中心退款记录接口。
 * 默认保留测试单据，便于页面复核；所有 ID 会在结束时打印。
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

const TRADE = arg('trade', 'http://localhost:8086').replace(/\/$/, '')
const CORE = arg('core', 'http://localhost:8093').replace(/\/$/, '')
const PRODUCT_ID = Number(arg('product', '7001'))
const MYSQL = arg('mysql', 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe')
const MYSQL_PASSWORD = arg('mysql-password', 'root')
const buyerAccount = { username: arg('buyer', '19900002005'), password: arg('buyer-password', 'Test12345') }
const sellerAccount = { username: arg('seller', 'farmer'), password: arg('seller-password', 'Admin@123') }
const adminAccount = { username: arg('admin', 'admin'), password: arg('admin-password', 'Admin@123') }
const stamp = Date.now()

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `  ${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const login = async ({ username, password }) => {
  const response = await fetch(`${CORE}/api/v1/auth/login`, {
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

const request = async (method, path, token, payload) => {
  const url = path.startsWith('http://') || path.startsWith('https://') ? path : `${TRADE}${path}`
  const response = await fetch(url, {
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

const uploadContractEvidence = async (contractId, token, signMode, filename, type, bytes) => {
  const form = new FormData()
  form.append('file', new Blob([bytes], { type }), filename)
  const response = await fetch(
    `${TRADE}/api/trade/contract/${contractId}/evidence?signMode=${encodeURIComponent(signMode)}`,
    { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form },
  )
  return { status: response.status, body: await response.json() }
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

const expectOk = (result, label) => {
  check(result.body.code === 200, label, result.body.message === 'success' ? '' : result.body.message ?? '')
  return result.body.data
}

const makeOrderFromProduct = async (buyerToken, marker) => {
  const created = await request('POST', '/api/trade/order/from-product', buyerToken, {
    productId: PRODUCT_ID,
    quantity: 1,
    freightAmount: 0,
    deliveryProvince: '北京市',
    deliveryCity: '北京市',
    deliveryDistrict: '丰台区',
    deliveryAddress: `新发地买家中心联调仓 ${marker}`,
    deliveryContact: '买家中心联调收货人',
    deliveryPhone: '13900000000',
  })
  const order = expectOk(created, `创建售后联调订单 ${marker}`)
  if (!order?.id) throw new Error('售后联调订单创建失败')
  return order
}

let demandId = null
let inquiryId = null
let quoteId = null
let mainOrderId = null
let contractId = null
let evaluationId = null
let disputeId = null
let invoiceId = null
let refundOrderId = null
let refundId = null

try {
  console.log('== 登录与身份 ==')
  const [buyerToken, sellerToken, adminToken] = await Promise.all([
    login(buyerAccount),
    login(sellerAccount),
    login(adminAccount),
  ])
  const buyerMerchants = await request('GET', `${CORE}/api/v1/platform/merchants/mine`, buyerToken)
  const sellerMerchants = await request('GET', `${CORE}/api/v1/platform/merchants/mine`, sellerToken)
  const buyerMerchantId = String(buyerMerchants.body.data?.[0]?.merchantId ?? '')
  const sellerMerchantId = String(sellerMerchants.body.data?.[0]?.merchantId ?? '')
  check(Boolean(buyerToken && sellerToken && adminToken), '买家、卖家、运营账号均登录成功')
  check(buyerMerchantId !== sellerMerchantId && Boolean(buyerMerchantId && sellerMerchantId),
    '买卖双方主体已解析且相互独立', `${buyerMerchantId} / ${sellerMerchantId}`)

  console.log('\n== 发布采购需求 ==')
  const demandName = `买家中心全链路五常大米采购${stamp}`
  expectOk(await request('POST', '/api/trade/demand', buyerToken, {
    demandName,
    categoryId: 5101,
    categoryName: '大米',
    variety: '五常稻花香',
    productName: '东北五常大米 25kg/袋',
    demandType: 'spot',
    qualityLevel: '一级',
    quantity: 2,
    unit: '袋',
    priceMin: 115,
    priceMax: 135,
    deliveryProvince: '北京市',
    deliveryCity: '北京市',
    deliveryAddress: '新发地买家中心全链路联调仓',
    deliveryDeadline: '2026-11-30 18:00:00',
    qualityRequirement: '一级新米，水分不高于 14.5%',
    certificationRequire: '提供质检报告',
    packagingRequire: '25kg/袋',
    sampleRequire: 1,
  }), '发布采购需求')
  demandId = Number(scalar(`
    SELECT id FROM agri_trade.agri_trade_demand
    WHERE demand_name = '${demandName.replaceAll("'", "''")}' AND del_flag = 0
    ORDER BY id DESC LIMIT 1
  `))
  const demandRow = sql(`
    SELECT demand_no, buyer_id, demand_status, response_count
    FROM agri_trade.agri_trade_demand WHERE id = ${demandId}
  `)[0] ?? []
  check(demandId > 0 && demandRow[1] === buyerMerchantId,
    '采购需求真实落库并归属当前采购主体', `demandId=${demandId}`)
  check(demandRow[2] === 'pending' && demandRow[3] === '0',
    '需求初始状态为待匹配且无报价', `${demandRow[2]}/${demandRow[3]}`)

  console.log('\n== 智能撮合与询价 ==')
  const matches = expectOk(await request('POST', `/api/trade/demand/${demandId}/match`, buyerToken), '触发智能撮合')
  const matchedProduct = (matches ?? []).find((item) => Number(item.productId) === PRODUCT_ID) ?? matches?.[0]
  check(Boolean(matchedProduct?.productId), '撮合返回可询价货源', String(matchedProduct?.productId ?? ''))
  const inquiry = expectOk(await request('POST', '/api/trade/negotiation/inquiry', buyerToken, {
    demandId,
    productId: PRODUCT_ID,
  }), '买家向撮合货源发起询价')
  inquiryId = Number(inquiry?.id)
  check(inquiryId > 0 && String(inquiry?.sellerId) === sellerMerchantId,
    '询价单落库并指向正确供应商', `inquiryId=${inquiryId}`)
  const sellerReceived = await request('GET', '/api/trade/negotiation/inquiry/received', sellerToken)
  check((sellerReceived.body.data ?? []).some((item) => Number(item.id) === inquiryId),
    '卖家端能收到该询价')

  console.log('\n== 卖家报价与买家受理 ==')
  const quote = expectOk(await request('POST', '/api/trade/negotiation/quote', sellerToken, {
    inquiryId,
    unitPrice: 120,
    quantity: 2,
    freightAmount: 10,
    remark: '一级五常大米，含平台物流',
  }), '卖家提交报价')
  quoteId = Number(quote?.id)
  check(quoteId > 0 && Number(quote?.totalAmount) === 240,
    '报价金额由服务端计算', `quoteId=${quoteId} goods=¥${quote?.totalAmount}`)
  const quotePage = expectOk(await request(
    'GET',
    `/api/trade/negotiation/quote/page?pageNum=1&pageSize=100&buyerId=${buyerMerchantId}`,
    buyerToken,
  ), '买家读取自己的报价列表')
  check((quotePage?.records ?? []).some((item) => Number(item.id) === quoteId),
    '买家中心能看到供应商报价')
  const stateAfterQuote = sql(`
    SELECT d.demand_status, d.response_count, i.inquiry_status, i.reply_count
    FROM agri_trade.agri_trade_demand d
    JOIN agri_trade.agri_trade_inquiry i ON i.demand_id = d.id
    WHERE d.id = ${demandId} AND i.id = ${inquiryId}
  `)[0] ?? []
  check(stateAfterQuote[0] === 'quoted' && stateAfterQuote[1] === '1'
    && stateAfterQuote[2] === 'quoted' && stateAfterQuote[3] === '1',
  '报价后需求与询价状态同步推进', stateAfterQuote.join('/'))

  expectOk(await request('POST', `/api/trade/negotiation/quote/${quoteId}/accept`, buyerToken), '买家接受报价')
  const converted = expectOk(await request(
    'POST', `/api/trade/negotiation/quote/${quoteId}/convert`, buyerToken,
  ), '按报价生成采购订单')
  mainOrderId = Number(converted?.id)
  check(mainOrderId > 0 && converted?.source === 'quote',
    '报价转化为真实采购订单', `orderId=${mainOrderId}`)
  const orderAfterConvert = sql(`
    SELECT order_status, payment_status, goods_amount, freight_amount, total_amount, product_name
    FROM agri_trade.agri_trade_order WHERE id = ${mainOrderId}
  `)[0] ?? []
  check(orderAfterConvert[0] === 'pending_confirm' && orderAfterConvert[1] === 'unpaid',
    '订单初始状态为待确认/未支付', `${orderAfterConvert[0]}/${orderAfterConvert[1]}`)
  check(Number(orderAfterConvert[2]) === 240 && Number(orderAfterConvert[3]) === 10
    && Number(orderAfterConvert[4]) === 250 && orderAfterConvert[5] === '东北五常大米 25kg/袋',
    '订单货款、运费、总额和商品名正确', orderAfterConvert.join(' / '))
  check(scalar(`SELECT COUNT(*) FROM agri_trade.agri_trade_order_item WHERE order_id = ${mainOrderId}`) === '1',
    '订单明细已落库')
  const linked = sql(`
    SELECT d.demand_status, i.inquiry_status, i.order_id, q.quote_status, q.order_id
    FROM agri_trade.agri_trade_demand d
    JOIN agri_trade.agri_trade_inquiry i ON i.demand_id = d.id
    JOIN agri_trade.agri_trade_quote q ON q.inquiry_id = i.id
    WHERE d.id = ${demandId} AND i.id = ${inquiryId} AND q.id = ${quoteId}
  `)[0] ?? []
  check(linked[0] === 'completed' && linked[1] === 'converted'
    && linked[2] === String(mainOrderId) && linked[3] === 'accepted'
    && linked[4] === String(mainOrderId),
  '需求、询价、报价、订单四张单据完成关联', linked.join('/'))

  console.log('\n== 合同签订 ==')
  const contractRows = sql(`
    SELECT id, contract_status, buyer_sign_status, seller_sign_status, contract_amount, order_no
    FROM agri_trade.agri_trade_contract
    WHERE order_id = ${mainOrderId} AND del_flag = 0
  `)
  contractId = Number(contractRows[0]?.[0])
  check(contractId > 0, '报价成单后自动生成待签合同', `contractId=${contractId}`)
  check(contractRows[0]?.[1] === 'draft' && contractRows[0]?.[2] === 'pending'
    && contractRows[0]?.[3] === 'pending' && Number(contractRows[0]?.[4]) === 250,
  '合同金额与初始签署状态正确', contractRows[0]?.slice(1, 5).join('/'))
  const onlineSeal = expectOk(await uploadContractEvidence(
    contractId,
    buyerToken,
    'online',
    'buyer-electronic-seal.png',
    'image/png',
    Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlKkAAAAASUVORK5CYII=', 'base64'),
  ), '买家上传电子签章图片')
  const offlineSignedFile = expectOk(await uploadContractEvidence(
    contractId,
    sellerToken,
    'offline',
    'seller-offline-signed-contract.pdf',
    'application/pdf',
    Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'),
  ), '卖家上传线下签署合同扫描件')
  check(onlineSeal?.url?.startsWith('/uploads/trade/contracts/')
    && offlineSignedFile?.url?.startsWith('/uploads/trade/contracts/'),
  '两种签署证据文件均已保存')
  expectOk(await request('POST', `/api/trade/contract/${contractId}/sign`, buyerToken, {
    signMode: 'online',
    signerName: '买家电子签章经办人',
    evidenceUrl: onlineSeal.url,
    confirmed: true,
  }), '买家完成在线电子签章')
  expectOk(await request('POST', `/api/trade/contract/${contractId}/sign`, sellerToken, {
    signMode: 'offline',
    signerName: '卖家线下签署经办人',
    evidenceUrl: offlineSignedFile.url,
    confirmed: true,
  }), '卖家完成线下签署确认')
  const signed = sql(`
    SELECT contract_status, buyer_sign_status, seller_sign_status,
           buyer_sign_time IS NOT NULL, seller_sign_time IS NOT NULL,
           chain_status, CHAR_LENGTH(chain_tx_hash), buyer_signature, seller_signature,
           contract_file_url, CHAR_LENGTH(contract_hash)
    FROM agri_trade.agri_trade_contract WHERE id = ${contractId}
  `)[0] ?? []
  check(signed[0] === 'signed' && signed[1] === 'signed' && signed[2] === 'signed'
    && signed[3] === '1' && signed[4] === '1' && signed[5] === 'success' && Number(signed[6]) === 66,
  '双方签署完成并生成存证哈希', signed.slice(0, 7).join('/'))
  check(signed[7]?.startsWith('ONLINE|') && signed[8]?.startsWith('OFFLINE|')
    && signed[9] === offlineSignedFile.url && Number(signed[10]) === 64,
  '在线签章、线下文件与合同哈希分别留痕',
  `${signed[7]?.split('|')[0]}/${signed[8]?.split('|')[0]}/${signed[9]}`)

  console.log('\n== 支付、发货与收货 ==')
  expectOk(await request('POST', `/api/trade/order/${mainOrderId}/pay`, buyerToken, {
    paymentMethod: 'transfer',
  }), '买家支付采购订单')
  expectOk(await request('POST', `/api/trade/order/${mainOrderId}/ship`, sellerToken, {
    carrierName: '平台物流',
    carrierNo: `BUYER-E2E-${stamp}`,
    logisticsType: 'road',
    location: '绿源农业合作社发货仓',
  }), '卖家发货并生成物流单')
  expectOk(await request('POST', `/api/trade/order/${mainOrderId}/confirm-receipt`, buyerToken, {
    signReceiver: '买家中心联调收货人',
  }), '买家确认收货')
  const fulfilled = sql(`
    SELECT o.order_status, o.payment_status, o.logistics_status, l.logistics_status,
           o.buyer_confirmed, p.payment_status, p.amount
    FROM agri_trade.agri_trade_order o
    JOIN agri_trade.agri_trade_logistics l ON l.id = o.logistics_id
    JOIN agri_trade.agri_trade_payment p ON p.order_id = o.id AND p.del_flag = 0
    WHERE o.id = ${mainOrderId}
  `)[0] ?? []
  check(fulfilled[0] === 'received' && fulfilled[1] === 'paid' && fulfilled[2] === 'delivered'
    && fulfilled[3] === 'delivered' && fulfilled[4] === '1',
  '订单、支付与物流同步到已收货/已签收', fulfilled.slice(0, 5).join('/'))
  check(fulfilled[5] === 'success' && Number(fulfilled[6]) === 250,
    '支付流水成功且金额正确', `¥${fulfilled[6]}`)

  console.log('\n== 收货与售后 ==')
  expectOk(await request('POST', '/api/trade/dispute', buyerToken, {
    orderId: mainOrderId,
    disputeType: 'quality',
    disputeReason: '包装轻微破损',
    disputeDescription: '联调验收：到货包装轻微破损，申请平台记录并协商处理',
    claimAmount: 20,
  }), '买家发起质量售后工单')
  disputeId = Number(scalar(`
    SELECT id FROM agri_trade.agri_trade_dispute
    WHERE order_id = ${mainOrderId} AND del_flag = 0 ORDER BY id DESC LIMIT 1
  `))
  check(disputeId > 0, '售后工单真实落库', `disputeId=${disputeId}`)
  expectOk(await request('POST', `/api/trade/dispute/${disputeId}/resolve`, buyerToken, {
    result: 'agreed',
    remark: '供应商补偿包装费用，双方和解',
  }), '双方完成售后和解')
  const disputeState = sql(`
    SELECT dispute_status, process_stage, close_reason
    FROM agri_trade.agri_trade_dispute WHERE id = ${disputeId}
  `)[0] ?? []
  check(disputeState[0] === 'resolved' && disputeState[1] === 'resolved',
    '售后工单关闭并保留处理结果', disputeState.join('/'))

  console.log('\n== 采购评价 ==')
  expectOk(await request('POST', '/api/trade/evaluation', buyerToken, {
    orderId: mainOrderId,
    ratingOverall: 5,
    ratingQuality: 5,
    ratingService: 5,
    ratingDelivery: 4,
    evaluationContent: '买家中心全链路联调：大米品质好，物流及时。',
  }), '买家提交采购评价')
  const evaluation = sql(`
    SELECT id, evaluator_id, evaluatee_id, rating_overall, evaluation_status
    FROM agri_trade.agri_trade_evaluation
    WHERE order_id = ${mainOrderId} AND del_flag = 0 ORDER BY id DESC LIMIT 1
  `)[0] ?? []
  evaluationId = Number(evaluation[0])
  check(evaluationId > 0 && evaluation[1] === buyerMerchantId && evaluation[2] === sellerMerchantId,
    '评价人与被评价人按订单双方正确落库', `evaluationId=${evaluationId}`)
  check(evaluation[3] === '5' && evaluation[4] === 'published',
    '评价评分与发布状态正确', `${evaluation[3]}星/${evaluation[4]}`)

  console.log('\n== 资金与发票 ==')
  const invoice = expectOk(await request('POST', '/api/trade/invoice', buyerToken, {
    orderId: mainOrderId,
    invoiceType: '增值税专用发票',
    title: '页面注册企业测试有限公司',
    taxNo: '91110000BUYERE2E001',
    remark: '买家中心全链路开票联调',
  }), '买家申请开票')
  invoiceId = scalar(`
    SELECT id FROM agri_trade.agri_trade_invoice
    WHERE order_id = ${mainOrderId} AND del_flag = 0 ORDER BY id DESC LIMIT 1
  `)
  check(Boolean(invoiceId) && invoice?.invoiceStatus === 'pending' && Number(invoice?.amount) === 250,
    '开票申请落库，金额取订单总额', `invoiceId=${invoiceId}/¥${invoice?.amount}`)
  const adminInvoicePage = expectOk(await request(
    'GET', '/api/trade/admin/invoice/page?pageNum=1&pageSize=100&invoiceStatus=pending', adminToken,
  ), '运营端读取待开票申请')
  check((adminInvoicePage?.records ?? []).some((item) => String(item.id) === invoiceId),
    '运营端能看到买家的开票申请')
  expectOk(await request('POST', `/api/trade/admin/invoice/${invoiceId}/review`, adminToken, {
    status: 'issued',
    remark: '运营审核通过并完成开票',
  }), '运营审核并完成开票')
  const buyerInvoices = expectOk(await request('GET', '/api/trade/invoice/mine', buyerToken), '买家读取发票记录')
  const issuedInvoice = (buyerInvoices ?? []).find((item) => String(item.id) === invoiceId)
  check(issuedInvoice?.invoiceStatus === 'issued' && Boolean(issuedInvoice?.issueTime),
    '买家端发票状态同步为已开票')

  console.log('\n== 收货后退货退款（独立售后订单） ==')
  const refundOrder = await makeOrderFromProduct(buyerToken, `REFUND-${stamp}`)
  refundOrderId = Number(refundOrder.id)
  expectOk(await request('POST', `/api/trade/order/${refundOrderId}/pay`, buyerToken, {
    paymentMethod: 'transfer',
  }), '售后订单支付')
  expectOk(await request('POST', `/api/trade/order/${refundOrderId}/ship`, sellerToken, {
    carrierName: '平台物流',
    carrierNo: `BUYER-REFUND-${stamp}`,
    logisticsType: 'road',
  }), '售后订单发货')
  expectOk(await request('POST', `/api/trade/order/${refundOrderId}/confirm-receipt`, buyerToken, {
    signReceiver: '买家中心联调收货人',
  }), '售后订单确认收货')
  expectOk(await request('POST', `/api/trade/order/${refundOrderId}/refund`, buyerToken, {
    refundType: 'return_refund',
    refundAmount: Number(refundOrder.totalAmount),
    refundReason: '买家中心全链路联调：收货后退货退款',
  }), '买家发起退货退款')
  refundId = Number(scalar(`
    SELECT id FROM agri_trade.agri_trade_refund
    WHERE order_id = ${refundOrderId} AND del_flag = 0 ORDER BY id DESC LIMIT 1
  `))
  expectOk(await request('POST', `/api/trade/order/refund/${refundId}/audit`, adminToken, {
    status: 'approved',
    reviewer: '平台管理员',
    remark: '售后联调审核通过',
  }), '运营审核通过售后退款')
  const buyerRefundRows = expectOk(await request('GET', '/api/trade/order/refund/mine', buyerToken), '买家读取售后记录')
  const refundRow = (buyerRefundRows ?? []).find((item) => Number(item.id) === refundId)
  check(refundRow?.refundStatus === 'approved',
    '买家中心可读取已通过退款记录', `refundId=${refundId}`)
  const refundFinal = sql(`
    SELECT o.order_status, o.payment_status, o.refund_amount, r.refund_status, p.payment_status
    FROM agri_trade.agri_trade_order o
    JOIN agri_trade.agri_trade_refund r ON r.order_id = o.id
    JOIN agri_trade.agri_trade_payment p ON p.id = r.payment_id
    WHERE o.id = ${refundOrderId} AND r.id = ${refundId}
  `)[0] ?? []
  check(refundFinal[0] === 'refunded' && refundFinal[1] === 'refunded'
    && Number(refundFinal[2]) === Number(refundOrder.totalAmount)
    && refundFinal[3] === 'approved' && refundFinal[4] === 'refunded',
  '订单、退款单、支付流水同步完成退款', refundFinal.join('/'))

  console.log('\n== 结果 ==')
  console.log(`需求：${TRADE}/demand/detail/${demandId}`)
  console.log(`报价：${quoteId} / 主订单：${TRADE}/order/detail/${mainOrderId}`)
  console.log(`合同：${contractId} / 售后工单：${disputeId} / 评价：${evaluationId}`)
  console.log(`发票：${invoiceId}（已开票） / 退款订单：${TRADE}/order/detail/${refundOrderId}`)
  console.log(`买家中心：${TRADE}/member/buyer?tab=inquiry`)
} catch (error) {
  check(false, '买家中心全链路未抛异常', String(error).slice(0, 320))
}

console.log(`\n== 失败 ${failures.length} 项 ==`)
if (failures.length) console.log(`失败项：${failures.join('、')}`)
process.exit(failures.length ? 1 : 0)
