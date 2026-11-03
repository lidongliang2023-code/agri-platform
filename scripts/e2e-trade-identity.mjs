#!/usr/bin/env node
/**
 * 交易域身份收口端到端回归（服务端口径，不看页面）。
 *
 * 覆盖四件事，全部按"接口返回值 == 数据库实查值"断言：
 *   1. 主体归属：采购方/供货方/操作人一律由访问令牌推导，请求体自报的身份不采信；
 *   2. 跨主体判权：别人的需求改不了也删不掉、别人的报价看不见也改不了，
 *      且"不是你的"与"不存在"回同一句话（不拿连号 id 探测别人有没有这张单）；
 *   3. 影子写入口已下线：保证金域那两条绕开赔付守卫的路由、按 id 查别人询价/报价的
 *      四条读路由、以及不校验状态的询价改状态，全部 404；
 *   4. 留痕真实：退款/赔付审核的审核人取令牌账号（admin），不是前端拼的昵称。
 *
 * 前置：node scripts/provision-trade-access.mjs（没有交易类业务身份时，
 * 交易域所有写接口一律 403，主链路根本进不去 —— 这条闸门本身也在本脚本里断言）。
 *
 * 用法：node scripts/e2e-trade-identity.mjs [--keep]（--keep 保留临时数据便于排查）
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { login, probeTradeWrite } from './provision-trade-access.mjs'

const CORE = process.env.AGRI_CORE_URL || 'http://localhost:8093'
const TRADE = process.env.AGRI_TRADE_URL || 'http://localhost:8089'
const MYSQL = process.env.MYSQL_BIN || 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const KEEP = process.argv.includes('--keep')

const MARK = 'E2E-TRADE'
const BUYER = 2001   // farmer / 绿源农业合作社
const SELLER = 2003  // luochuan / 陕西洛川果业
const STRANGER = 2116774863340740609 // provider / 建国农机合作社（第三方对照，不参与本次单据）

let passed = 0
const failures = []
function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
  } else {
    failures.push(`${label}${detail ? ` · ${detail}` : ''}`)
  }
}

function sql(query) {
  // --default-character-set=utf8mb4 是必需的：不带它，mysql.exe 按 GBK 客户端编码输出，
  // 中文列值（主体名、备注）在 Node 这边就成了乱码，比较一定失败。
  const out = execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', `USE agri_trade; ${query}`], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  if (out.includes('ERROR')) throw new Error(`SQL 失败：${out}`)
  return out.replace(/\r\n/g, '\n').trim()
}
const scalar = (query) => sql(query).split('\n')[0] ?? ''
const list = (query) => {
  const text = sql(query)
  return text ? text.split('\n') : []
}

async function call(path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${path.startsWith('http') ? path : `${TRADE}${path}`}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await response.text()
  let payload = null
  try {
    payload = JSON.parse(text)
  } catch {
    // 404/405 是 Spring 自己的错误页（交易域没配 JSON 错误体），按"没有这个路由"处理
    payload = { code: null, message: text.slice(0, 120) }
  }
  return { status: response.status, code: payload.code ?? null, message: payload.message ?? '', data: payload.data }
}

const okBody = (r) => r.status === 200 && r.code === 200
const rejected = (r) => r.code !== 200
const says = (r, ...needles) => needles.some((needle) => (r.message ?? '').includes(needle))

/**
 * 关键前置步骤：失败就直接中止（不再往下跑出 NaN/undefined 那种看不懂的红）。
 * 中止后 catch 里仍会按主键区间清场，不留残留。
 */
function must(label, response, extract) {
  const value = extract(response)
  if (okBody(response) && value !== undefined && value !== null && value !== '') {
    return value
  }
  throw new Error(`${label} 失败：status=${response.status} code=${response.code} message=${response.message}`)
}

/** 本次跑创建/改动的表：先快照 MAX(id)，收尾按 id > 快照删除，回到零残留。 */
const PURGE_TABLES = [
  'agri_trade_demand', 'agri_trade_inquiry', 'agri_trade_quote', 'agri_trade_order',
  'agri_trade_order_item', 'agri_trade_contract', 'agri_trade_contract_signature',
  'agri_trade_logistics', 'agri_trade_logistics_trace', 'agri_trade_payment',
  'agri_trade_refund', 'agri_trade_compensation', 'agri_trade_settlement',
  'agri_trade_match_record', 'agri_trade_evaluation',
]

function snapshot() {
  const marks = {}
  for (const table of PURGE_TABLES) {
    marks[table] = Number(scalar(`SELECT IFNULL(MAX(id), 0) FROM ${table};`) || 0)
  }
  return marks
}

/** 跑挂了也要清场：异常退出时由 catch 调这张函数，把本次区间里的行删掉。 */
let marks = null

/**
 * 删掉本次跑新增的行，返回每张表的 { created, left }。
 * created 是删除前的增量，left 是删除后仍然在区间里的行数（必须为 0 才算零残留）。
 */
function purge(marks) {
  const result = {}
  for (const [table, maxId] of Object.entries(marks)) {
    const created = Number(scalar(`SELECT COUNT(*) FROM ${table} WHERE id > ${maxId};`) || 0)
    if (!KEEP && created > 0) {
      sql(`DELETE FROM ${table} WHERE id > ${maxId};`)
    }
    result[table] = { created, left: Number(scalar(`SELECT COUNT(*) FROM ${table} WHERE id > ${maxId};`) || 0) }
  }
  return result
}

async function main() {
  const farmerToken = await login('farmer')
  const sellerToken = await login('luochuan')
  const strangerToken = await login('provider')
  const adminToken = await login('admin')
  check('四个演示账号都能拿到访问令牌', Boolean(farmerToken && sellerToken && strangerToken && adminToken))

  // ---------- G0：交易类业务身份是写接口的前置闸门 ----------
  const probe = await probeTradeWrite(farmerToken)
  check('farmer 已具备交易类业务身份（否则下面每条写接口都是 403）', probe.passedCapability, `probe=${probe.status} ${probe.message}`)
  const anonymousDemandPage = await call('/api/trade/demand/page?pageNum=1&pageSize=1')
  check('未登录取交易数据被拒（401，不是静默空列表）', anonymousDemandPage.status === 401, `status=${anonymousDemandPage.status}`)

  marks = snapshot()

  // ---------- G1：采购需求的主体归属与判权 ----------
  const forgedCreate = await call('/api/trade/demand', {
    method: 'POST', token: farmerToken,
    body: { demandName: `${MARK} 冒名需求`, quantity: 10, unit: '吨', buyerId: SELLER },
  })
  check('以别人主体下单被拒（点名 buyerId 不属于自己的范围）',
    rejected(forgedCreate) && says(forgedCreate, '无权'), forgedCreate.message)

  const badContent = await call('/api/trade/demand', {
    method: 'POST', token: farmerToken,
    body: { demandName: `${MARK} 数量非法`, quantity: 0, unit: '吨' },
  })
  check('采购数量必须大于 0', rejected(badContent) && says(badContent, '数量'), badContent.message)

  const priceConflict = await call('/api/trade/demand', {
    method: 'POST', token: farmerToken,
    body: { demandName: `${MARK} 价格倒挂`, quantity: 5, unit: '吨', priceMin: 5000, priceMax: 200 },
  })
  check('期望最低价高于最高价被拒', rejected(priceConflict) && says(priceConflict, '最低价'), priceConflict.message)

  const created = await call('/api/trade/demand', {
    method: 'POST', token: farmerToken,
    body: {
      demandName: `${MARK} 采购玉米`, quantity: 30, unit: '吨',
      priceMin: 2200, priceMax: 2600, deliveryAddress: '陕西省西安市', tenantId: '9999',
    },
  })
  const demandId = must('发布采购需求', created, (r) => r.data?.id)
  const demandRow = sql(`SELECT buyer_id, demand_no, tenant_id, del_flag FROM agri_trade_demand WHERE id=${demandId};`)
  const [rowBuyer, rowNo, rowTenant] = demandRow.split('\t')
  check('需求的采购方由令牌推导（2001）而不是请求体的 2003', String(rowBuyer) === String(BUYER), `buyer_id=${rowBuyer}`)
  check('单号由服务端生成（DM + 时间）', /^DM\d+$/.test(String(rowNo)), `demand_no=${rowNo}`)
  check('主体列 tenant_id 不再被请求体写进去（映射已删，落库为 NULL）',
    rowTenant === 'NULL' || rowTenant === '', `tenant_id=${rowTenant}`)

  const strangerUpdate = await call(`/api/trade/demand/${demandId}`, {
    method: 'PUT', token: sellerToken,
    body: { demandName: '别人改成我的', quantity: 1, unit: '吨' },
  })
  check('别家主体改不了这条需求', rejected(strangerUpdate) && says(strangerUpdate, '不是您名下'), strangerUpdate.message)
  const strangerDelete = await call(`/api/trade/demand/${demandId}`, { method: 'DELETE', token: sellerToken })
  check('别家主体下架不了这条需求', rejected(strangerDelete) && says(strangerDelete, '不是您名下'), strangerDelete.message)
  const strangerMatch = await call(`/api/trade/demand/${demandId}/match`, { method: 'POST', token: sellerToken })
  check('别家主体不能对自己的需求触发撮合', rejected(strangerMatch) && says(strangerMatch, '不是您名下'), strangerMatch.message)
  check('越权三次都没有改动任何字段（del_flag 仍为 0）',
    scalar(`SELECT del_flag FROM agri_trade_demand WHERE id=${demandId};`) === '0')

  const statusTypo = await call(`/api/trade/demand/${demandId}`, {
    method: 'PUT', token: farmerToken, body: { demandStatus: 'publish' },
  })
  check('需求状态只认词表（publish 这种历史写法被拒）',
    rejected(statusTypo) && says(statusTypo, 'pending'), statusTypo.message)

  const smuggle = await call(`/api/trade/demand/${demandId}`, {
    method: 'PUT', token: farmerToken,
    body: { demandName: `${MARK} 改过标题`, quantity: 45, buyerId: SELLER, buyerName: '陕西洛川果业', demandNo: 'DM-FAKE', delFlag: 1 },
  })
  const afterUpdate = sql(`SELECT buyer_id, buyer_name, demand_no, quantity, del_flag FROM agri_trade_demand WHERE id=${demandId};`)
  const [uBuyer, uBuyerName, uNo, uQty, uDel] = afterUpdate.split('\t')
  check('主人改标题与数量成功', okBody(smuggle), smuggle.message)
  check('改内容改不动归属：buyer_id 仍是 2001', String(uBuyer) === String(BUYER), `buyer_id=${uBuyer}`)
  check('buyer_name 不被请求体改写', uBuyerName === '绿源农业合作社', `buyer_name=${uBuyerName}`)
  check('单号不被请求体改写', /^DM\d+$/.test(String(uNo)), `demand_no=${uNo}`)
  check('del_flag 不能由请求体置 1', String(uDel) === '0', `del_flag=${uDel}`)
  check('数量按请求更新（45）', String(uQty).startsWith('45'), `quantity=${uQty}`)

  const closed = await call(`/api/trade/demand/${demandId}`, {
    method: 'PUT', token: farmerToken, body: { demandStatus: 'closed' },
  })
  check('主人可以把需求置为已关闭', okBody(closed), closed.message)
  const completeIt = await call(`/api/trade/demand/${demandId}`, {
    method: 'PUT', token: farmerToken, body: { demandStatus: 'completed' },
  })
  check('把需求改成已成交（供删除守卫验证）', okBody(completeIt), completeIt.message)
  const deleteCompleted = await call(`/api/trade/demand/${demandId}`, { method: 'DELETE', token: farmerToken })
  check('已成交的需求留作凭据，删不掉', rejected(deleteCompleted) && says(deleteCompleted, '凭据'), deleteCompleted.message)
  const reopen = await call(`/api/trade/demand/${demandId}`, {
    method: 'PUT', token: farmerToken, body: { demandStatus: 'matching' },
  })
  check('放回进行中以便后续清理', okBody(reopen), reopen.message)

  // ---------- G2：询价（只能问自己的需求；批量与幂等） ----------
  const sellerProductIds = list(`SELECT id FROM agri_trade_product WHERE seller_id=${SELLER} AND del_flag=0 ORDER BY id LIMIT 2;`)
  check('对照供货方（2003）名下有可询价的货源', sellerProductIds.length >= 1, `products=${sellerProductIds.join(',')}`)
  const productId = sellerProductIds[0]

  // 先造一张**属于供货方自己**的需求，作为"替别人询价"的靶子
  const otherDemandCreate = await call('/api/trade/demand', {
    method: 'POST', token: sellerToken,
    body: { demandName: `${MARK} 洛川自己的需求`, quantity: 8, unit: '吨' },
  })
  const otherDemand = otherDemandCreate.data?.id
  check('对照组需求已由 2003 自己发布（用于验证不能替别人询价）',
    okBody(otherDemandCreate) && Boolean(otherDemand), otherDemandCreate.message)
  const crossInquiry = await call('/api/trade/negotiation/inquiry', {
    method: 'POST', token: farmerToken, body: { demandId: Number(otherDemand), productId: Number(productId) },
  })
  check('替别人的需求发起询价被拒', rejected(crossInquiry) && says(crossInquiry, '询价失败'), crossInquiry.message)
  check('被拒时确实没有落库（那张需求上没有我的询价）',
    scalar(`SELECT COUNT(*) FROM agri_trade_inquiry WHERE demand_id=${otherDemand} AND buyer_id=${BUYER};`) === '0')

  const inquiry = await call('/api/trade/negotiation/inquiry', {
    method: 'POST', token: farmerToken, body: { demandId: Number(demandId), productId: Number(productId) },
  })
  const inquiryId = must('对自己需求发起询价', inquiry, (r) => r.data?.id)
  const inquiryRow = sql(`SELECT buyer_id, seller_id, inquiry_no FROM agri_trade_inquiry WHERE id=${inquiryId};`)
  const [iqBuyer, iqSeller, iqNo] = inquiryRow.split('\t')
  check('询价单双方由服务端从需求与货源推导', String(iqBuyer) === String(BUYER) && String(iqSeller) === String(SELLER),
    `buyer=${iqBuyer} seller=${iqSeller}`)
  check('询价单号带随机段（批量同毫秒不再撞唯一索引）', /^IN\d{13}[0-9A-F]{6}$/.test(String(iqNo)), `inquiry_no=${iqNo}`)

  const batchMissing = await call('/api/trade/negotiation/inquiry/batch', {
    method: 'POST', token: farmerToken, body: { demandId: Number(demandId) },
  })
  check('批量询价缺 productIds 时给校验消息（不再是 500）',
    rejected(batchMissing) && says(batchMissing, 'productIds'), batchMissing.message)
  const batchCross = await call('/api/trade/negotiation/inquiry/batch', {
    method: 'POST', token: farmerToken,
    body: { demandId: Number(otherDemand), productIds: [Number(productId)], buyerId: BUYER },
  })
  check('批量询价对别人需求无效（请求体 buyerId 不采信）',
    rejected(batchCross) && says(batchCross, '没有发出询价'), batchCross.message)
  const batch = await call('/api/trade/negotiation/inquiry/batch', {
    method: 'POST', token: farmerToken,
    body: { demandId: Number(demandId), productIds: sellerProductIds.map(Number) },
  })
  const batchCreated = Array.isArray(batch.data) ? batch.data.length : 0
  check('批量询价对自己的需求生效', okBody(batch) && batchCreated >= 1, `created=${batchCreated} ${batch.message}`)
  const distinctNos = scalar(`SELECT COUNT(DISTINCT inquiry_no) FROM agri_trade_inquiry WHERE demand_id=${demandId};`)
  const totalOnes = scalar(`SELECT COUNT(*) FROM agri_trade_inquiry WHERE demand_id=${demandId};`)
  check('同批询价的单号互不相同（唯一索引不再撞号）', distinctNos === totalOnes, `${distinctNos}/${totalOnes}`)
  const repeatBatch = await call('/api/trade/negotiation/inquiry/batch', {
    method: 'POST', token: farmerToken,
    body: { demandId: Number(demandId), productIds: sellerProductIds.map(Number) },
  })
  check('重复批量不新增询价单（同需求同货源只问一次）',
    rejected(repeatBatch) && says(repeatBatch, '问过价'), repeatBatch.message)

  const myInquiries = await call('/api/trade/negotiation/inquiry/mine', { token: farmerToken })
  const mineCount = scalar(`SELECT COUNT(*) FROM agri_trade_inquiry WHERE buyer_id=${BUYER} AND del_flag=0;`)
  check('我的询价条数与库里一致', okBody(myInquiries) && String(myInquiries.data?.length) === mineCount,
    `${myInquiries.data?.length}/${mineCount}`)
  const received = await call('/api/trade/negotiation/inquiry/received', { token: sellerToken })
  const receivedCount = scalar(`SELECT COUNT(*) FROM agri_trade_inquiry WHERE seller_id=${SELLER} AND del_flag=0;`)
  check('供货方收到的询价条数与库里一致', okBody(received) && String(received.data?.length) === receivedCount,
    `${received.data?.length}/${receivedCount}`)

  // 已下线的四条"按 id 查别人单据"的读路由 + 不校验状态的改状态路由
  const removedRoutes = [
    ['GET', `/api/trade/negotiation/inquiry/buyer/${BUYER}`],
    ['GET', `/api/trade/negotiation/inquiry/seller/${SELLER}`],
    ['GET', `/api/trade/negotiation/quote/buyer/${BUYER}`],
    ['GET', `/api/trade/negotiation/quote/seller/${SELLER}`],
  ]
  for (const [method, path] of removedRoutes) {
    const r = await call(path, { method, token: adminToken })
    // 404 = 没有处理器；405 = 只剩别人的方法（路径变量把 "buyer" 当成了单据 id 但那是一条 GET-only 的路由）
    check(`按 id 查别人单据的读路由已下线：${path}`, r.status === 404 || r.status === 405, `status=${r.status}`)
  }
  const inquiryStatusRewrite = await call(`/api/trade/negotiation/inquiry/${inquiryId}/status`, {
    method: 'PUT', token: adminToken, body: { status: 'converted' },
  })
  check('改询价单状态的路由已下线（状态由报价与成交事件推进）',
    inquiryStatusRewrite.status === 404 || inquiryStatusRewrite.status === 405,
    `status=${inquiryStatusRewrite.status}`)
  check('且确实没改成：状态仍是待报价',
    scalar(`SELECT inquiry_status FROM agri_trade_inquiry WHERE id=${inquiryId};`) === 'pending_reply')

  // ---------- G3：报价（判权 + 金额服务端算） ----------
  const quote = await call('/api/trade/negotiation/quote', {
    method: 'POST', token: sellerToken,
    body: { inquiryId: Number(inquiryId), unitPrice: 2450, quantity: 30, freightAmount: 800, remark: `${MARK} 报价` },
  })
  const quoteId = must('被询价的供货方报价', quote, (r) => r.data?.id)
  const quoteRow = sql(`SELECT seller_id, buyer_id, unit_price, total_amount, quote_status FROM agri_trade_quote WHERE id=${quoteId};`)
  const [qSeller, qBuyer, qPrice, qTotal] = quoteRow.split('\t')
  check('报价双方从询价单带出', String(qSeller) === String(SELLER) && String(qBuyer) === String(BUYER),
    `seller=${qSeller} buyer=${qBuyer}`)
  check('总价由服务端算（2450×30=73500）', Number(qTotal) === 73500, `total_amount=${qTotal}`)

  const strangerQuoteDetail = await call(`/api/trade/negotiation/quote/${quoteId}`, { token: strangerToken })
  check('第三方读别人的报价 → 与"不存在"同一句话', rejected(strangerQuoteDetail)
    && says(strangerQuoteDetail, '报价不存在'), strangerQuoteDetail.message)
  const buyerSeesQuote = await call(`/api/trade/negotiation/quote/${quoteId}`, { token: farmerToken })
  check('采购方能看这份报价', okBody(buyerSeesQuote), buyerSeesQuote.message)
  const strangerQuoteUpdate = await call(`/api/trade/negotiation/quote/${quoteId}`, {
    method: 'PUT', token: farmerToken, body: { unitPrice: 1 },
  })
  check('采购方改不了供货方的报价', rejected(strangerQuoteUpdate) && says(strangerQuoteUpdate, '报价不存在'),
    strangerQuoteUpdate.message)
  const strangerQuoteDelete = await call(`/api/trade/negotiation/quote/${quoteId}`, { method: 'DELETE', token: strangerToken })
  check('第三方删不了别人的报价', rejected(strangerQuoteDelete) && says(strangerQuoteDelete, '报价不存在'),
    strangerQuoteDelete.message)
  const sellerFix = await call(`/api/trade/negotiation/quote/${quoteId}`, {
    method: 'PUT', token: sellerToken, body: { unitPrice: 2480 },
  })
  check('报价方本人可以改待受理的报价', okBody(sellerFix), sellerFix.message)
  check('改单价后总价重算（2480×30=74400）',
    Number(scalar(`SELECT total_amount FROM agri_trade_quote WHERE id=${quoteId};`)) === 74400)

  const buyerAcceptByStranger = await call(`/api/trade/negotiation/quote/${quoteId}/accept`, { method: 'POST', token: strangerToken })
  check('第三方受理别人的报价被拒', rejected(buyerAcceptByStranger) && says(buyerAcceptByStranger, '采购方'),
    buyerAcceptByStranger.message)

  const accepted = await call(`/api/trade/negotiation/quote/${quoteId}/accept`, { method: 'POST', token: farmerToken })
  check('采购方受理报价成功', okBody(accepted), accepted.message)
  const orderLinkId = scalar(`SELECT order_id FROM agri_trade_quote WHERE id=${quoteId};`)
  check('受理后生成一张订单', /^\d+$/.test(orderLinkId), `order_id=${orderLinkId}`)
  const orderId = Number(orderLinkId)
  if (!Number.isFinite(orderId) || orderId <= 0) {
    throw new Error(`受理报价没有回写订单，主链路后面的断言无从依附：http=${accepted.status} accept=${accepted.code}/${accepted.message} quote.order_id=${orderLinkId}`)
  }
  const orderRowsBefore = Number(scalar('SELECT COUNT(*) FROM agri_trade_order;'))
  const reAccept = await call(`/api/trade/negotiation/quote/${quoteId}/accept`, { method: 'POST', token: farmerToken })
  check('重复受理被拒（报价已生成过订单）', rejected(reAccept) && says(reAccept, '请勿重复受理'),
    `code=${reAccept.code} http=${reAccept.status} ${reAccept.message}`)
  check('重复受理没有多出订单',
    Number(scalar('SELECT COUNT(*) FROM agri_trade_order;')) === orderRowsBefore,
    `${orderRowsBefore} → ${scalar('SELECT COUNT(*) FROM agri_trade_order;')}`)

  // ---------- G4：主链路（支付 → 发货 → 状态词表） ----------
  const payByStranger = await call(`/api/trade/order/${orderId}/pay`, { method: 'POST', token: sellerToken, body: {} })
  check('供货方不能替买方付款', rejected(payByStranger) && says(payByStranger, '采购方'), payByStranger.message)
  const paid = await call(`/api/trade/order/${orderId}/pay`, { method: 'POST', token: farmerToken, body: { paymentMethod: 'bank' } })
  check('买方付款成功', okBody(paid), paid.message)
  const paidRow = sql(`SELECT payment_status, order_status, paid_amount FROM agri_trade_order WHERE id=${orderId};`)
  const [payStatus, orderStatus, paidAmount] = paidRow.split('\t')
  check('付款后订单状态与已付金额一致', payStatus === 'paid' && orderStatus === 'paid' && Number(paidAmount) > 0,
    `${payStatus}/${orderStatus}/${paidAmount}`)
  const payAgain = await call(`/api/trade/order/${orderId}/pay`, { method: 'POST', token: farmerToken, body: {} })
  check('重复付款幂等（不再插一条流水）',
    okBody(payAgain) && scalar(`SELECT COUNT(*) FROM agri_trade_payment WHERE order_id=${orderId} AND payment_status='success';`) === '1')

  const shipByBuyer = await call(`/api/trade/order/${orderId}/ship`, { method: 'POST', token: farmerToken, body: {} })
  check('买方不能发货', rejected(shipByBuyer) && says(shipByBuyer, '供货方'), shipByBuyer.message)
  const shipped = await call(`/api/trade/order/${orderId}/ship`, { method: 'POST', token: sellerToken, body: {} })
  check('供货方发货成功并生成物流单', okBody(shipped) && Boolean(shipped.data?.id), shipped.message)
  const logisticsId = shipped.data?.id
  const badStatus = await call(`/api/trade/logistics/${logisticsId}/status`, {
    method: 'POST', token: sellerToken, body: { status: 'shipped' },
  })
  check('物流状态只认词表（shipped 这种库里没有的值被拒）',
    rejected(badStatus) && says(badStatus, 'pending'), badStatus.message)
  check('非法状态没有改动物流单',
    sql(`SELECT logistics_status FROM agri_trade_logistics WHERE id=${logisticsId};`) !== 'shipped')
  const goodStatus = await call(`/api/trade/logistics/${logisticsId}/status`, {
    method: 'POST', token: sellerToken, body: { status: 'in_transit', location: '西安转运中心' },
  })
  const traceCount = scalar(`SELECT COUNT(*) FROM agri_trade_logistics_trace WHERE logistics_id=${logisticsId};`)
  check('合法状态推进并写一条轨迹', okBody(goodStatus) && Number(traceCount) >= 2, `traces=${traceCount}`)
  const strangerTrace = await call(`/api/trade/logistics/${logisticsId}/traces`, { token: strangerToken })
  check('第三方看不到别人订单的物流轨迹', rejected(strangerTrace), strangerTrace.message)

  // ---------- G5：退款申请与审核留痕 ----------
  const refundNoAmount = await call(`/api/trade/order/${orderId}/refund`, {
    method: 'POST', token: farmerToken, body: { refundReason: '质量问题' },
  })
  check('退款金额缺失时给校验消息（不再 500）',
    rejected(refundNoAmount) && says(refundNoAmount, '金额'), refundNoAmount.message)
  const paidAmountValue = Number(scalar(`SELECT paid_amount FROM agri_trade_order WHERE id=${orderId};`))
  const overRefund = await call(`/api/trade/order/${orderId}/refund`, {
    method: 'POST', token: farmerToken,
    body: { refundAmount: paidAmountValue + 1000, refundReason: '想多退' },
  })
  check('退款金额不能超过可退金额', rejected(overRefund) && says(overRefund, '可退金额'), overRefund.message)
  const refundApply = await call(`/api/trade/order/${orderId}/refund`, {
    method: 'POST', token: farmerToken,
    body: { refundAmount: paidAmountValue / 2, refundReason: `${MARK} 质量不符`, refundType: 'partial' },
  })
  check('按可退金额的一半申请退款成功', okBody(refundApply), refundApply.message)
  const refundId = Number(scalar(`SELECT id FROM agri_trade_refund WHERE order_id=${orderId} AND del_flag=0 ORDER BY id DESC LIMIT 1;`))
  check('退款申请人是发起方（买方主体 2001）',
    scalar(`SELECT applicant_id FROM agri_trade_refund WHERE id=${refundId};`) === String(BUYER))
  const secondPending = await call(`/api/trade/order/${orderId}/refund`, {
    method: 'POST', token: farmerToken,
    body: { refundAmount: 1, refundReason: '再申请一次', refundType: 'partial' },
  })
  check('同一订单不允许挂两条待审退款', rejected(secondPending) && says(secondPending, '待审核'), secondPending.message)

  const refundRejectNoNote = await call(`/api/trade/order/refund/${refundId}/audit`, {
    method: 'POST', token: adminToken, body: { status: 'rejected', reviewer: '张总' },
  })
  check('驳回退款必须填原因', rejected(refundRejectNoNote) && says(refundRejectNoNote, '原因'), refundRejectNoNote.message)
  const refundBadStatus = await call(`/api/trade/order/refund/${refundId}/audit`, {
    method: 'POST', token: adminToken, body: { status: 'pass', reviewer: '张总', remark: '算了' },
  })
  check('审核结论只认 approved/rejected', rejected(refundBadStatus) && says(refundBadStatus, 'approved'), refundBadStatus.message)
  const refundAudit = await call(`/api/trade/order/refund/${refundId}/audit`, {
    method: 'POST', token: adminToken, body: { status: 'approved', reviewer: '张总', remark: `${MARK} 同意部分退款` },
  })
  check('运营审核通过退款', okBody(refundAudit), refundAudit.message)
  const refundTrace = sql(`SELECT reviewer, review_remark FROM agri_trade_refund WHERE id=${refundId};`)
  check('审核人取令牌账号（admin），不是请求体里的"张总"',
    refundTrace.split('\t')[0] === 'admin', `reviewer=${refundTrace.split('\t')[0]}`)
  const refundReAudit = await call(`/api/trade/order/refund/${refundId}/audit`, {
    method: 'POST', token: adminToken, body: { status: 'rejected', reviewer: '李四', remark: '翻案' },
  })
  check('已审的退款单不能翻案', rejected(refundReAudit) && says(refundReAudit, '处理过'), refundReAudit.message)
  check('订单已置为已退款并累加已退金额',
    scalar(`SELECT order_status FROM agri_trade_order WHERE id=${orderId};`) === 'refunded')

  // ---------- G6：赔付（影子入口下线 + 建单校验 + 打款分步） ----------
  for (const [method, path] of [
    ['GET', '/api/trade/guarantee/compensation/page'],
    ['POST', '/api/trade/guarantee/compensation'],
    ['POST', '/api/trade/guarantee/compensation/1/audit'],
    ['POST', '/api/trade/compensation/guarantee'],
    ['POST', '/api/trade/compensation/guarantee/1/freeze'],
    ['POST', '/api/trade/compensation/guarantee/1/unfreeze'],
    ['POST', '/api/trade/compensation/guarantee/1/replenish'],
  ]) {
    const r = await call(path, { method, token: adminToken, ...(method === 'GET' ? {} : { body: {} }) })
    // 404 = 这条路径上没有处理器；405 = 只剩别人的方法（如 GET /guarantee/{id} 把
    // "compensation"当成了路径变量），两者都说明写入口已经不在了。
    check(`绕开赔付/保证金守卫的影子路由已下线：${method} ${path}`,
      r.status === 404 || r.status === 405, `status=${r.status}`)
  }
  const balanceRead = await call(`/api/trade/compensation/guarantee/${BUYER}/balance`, { token: adminToken })
  check('保留的只读口径仍可用（赔付前要看钱够不够）', okBody(balanceRead), balanceRead.message)

  const noSource = await call('/api/trade/compensation', {
    method: 'POST', token: adminToken, body: { compensationType: 'quality', amount: 500 },
  })
  check('没有纠纷也没有订单的赔付建不了', rejected(noSource) && says(noSource, '纠纷'), noSource.message)
  const strangerApplicant = await call('/api/trade/compensation', {
    method: 'POST', token: adminToken,
    body: { orderId, compensationType: 'quality', amount: 500, applicantId: STRANGER, applicantName: '凭空写的一家' },
  })
  check('申请人不是单据参与方时建不了（请求体写谁都不算）',
    rejected(strangerApplicant) && says(strangerApplicant, '建单失败'), strangerApplicant.message)
  const badType = await call('/api/trade/compensation', {
    method: 'POST', token: adminToken, body: { orderId, compensationType: '随手写', amount: 500 },
  })
  check('赔付类型只认词表', rejected(badType) && says(badType, '赔付类型'), badType.message)
  const compensation = await call('/api/trade/compensation', {
    method: 'POST', token: adminToken,
    body: { orderId, compensationType: 'quality', amount: 300, applicantId: BUYER, applicantName: '随便填的' },
  })
  const compensationId = must('挂订单的赔付建单', compensation, (r) => r.data?.id)
  const compRow = sql(`SELECT applicant_id, applicant_name, recipient_id, compensation_status, reviewer
    FROM agri_trade_compensation WHERE id=${compensationId};`)
  const [cApplicant, cApplicantName, cRecipient, cStatus] = compRow.split('\t')
  check('申请人名称由服务端按单据取（不是请求体那句"随便填的"）',
    String(cApplicant) === String(BUYER) && cApplicantName === '绿源农业合作社',
    `applicant=${cApplicant}/${cApplicantName}`)
  check('收款方按订单买方推导', String(cRecipient) === String(BUYER), `recipient=${cRecipient}`)
  check('新建赔付是待审核，不是已打款', cStatus === 'pending', `status=${cStatus}`)

  const compExecuteFirst = await call(`/api/trade/compensation/${compensationId}/execute`, { method: 'POST', token: adminToken })
  check('未核准不能直接打款', rejected(compExecuteFirst) && says(compExecuteFirst, '打款失败'), compExecuteFirst.message)
  const compRejectNoNote = await call(`/api/trade/compensation/${compensationId}/review`, {
    method: 'POST', token: adminToken, body: { reviewResult: 'rejected' },
  })
  check('驳回赔付必须填原因', rejected(compRejectNoNote) && says(compRejectNoNote, '原因'), compRejectNoNote.message)
  const compReview = await call(`/api/trade/compensation/${compensationId}/review`, {
    method: 'POST', token: adminToken, body: { reviewResult: 'approved', reviewer: '王五' },
  })
  check('运营核准赔付', okBody(compReview), compReview.message)
  const compReviewRow = sql(`SELECT reviewer, compensation_status FROM agri_trade_compensation WHERE id=${compensationId};`)
  const [cReviewer, cReviewStatus] = compReviewRow.split('\t')
  check('赔付审核人同样取令牌账号', cReviewer === 'admin', `reviewer=${cReviewer}`)
  check('核准只置 approved，钱还没出去', cReviewStatus === 'approved')
  const compReviewAgain = await call(`/api/trade/compensation/${compensationId}/review`, {
    method: 'POST', token: adminToken, body: { reviewResult: 'rejected', remark: '翻案' },
  })
  check('一张赔付单只审一次', rejected(compReviewAgain) && says(compReviewAgain, '审核失败'), compReviewAgain.message)
  const payoutBefore = scalar(`SELECT COUNT(*) FROM agri_trade_payment WHERE payment_type='compensation';`)
  const compExecute = await call(`/api/trade/compensation/${compensationId}/execute`, { method: 'POST', token: adminToken })
  check('核准后打款成功', okBody(compExecute), compExecute.message)
  check('打款写出一条赔付出款流水', Number(scalar(`SELECT COUNT(*) FROM agri_trade_payment WHERE payment_type='compensation';`)) === Number(payoutBefore) + 1)
  check('赔付单状态已是 paid 且有流水号',
    sql(`SELECT compensation_status, transaction_id FROM agri_trade_compensation WHERE id=${compensationId};`).startsWith('paid\tTX'))

  // ---------- G7：NLP 与已下线的假身份入口 ----------
  const nlpCreate = await call('/api/trade/nlp/parse-and-create', {
    method: 'POST', token: farmerToken, body: { text: '采购玉米 30 吨，价格 2400 元' },
  })
  check('「解析并建单」的假身份入口已下线（404）', nlpCreate.status === 404, `status=${nlpCreate.status}`)
  const nlpEmpty = await call('/api/trade/nlp/parse', { method: 'POST', token: farmerToken, body: { text: '   ' } })
  check('空文本解析给校验消息', rejected(nlpEmpty) && says(nlpEmpty, '需求文本'), nlpEmpty.message)
  const nlpExtract = await call('/api/trade/nlp/extract/quantity', { method: 'POST', token: farmerToken, body: {} })
  check('抽取接口没有文本时不再 NPE（400 级消息而非 500 崩栈）',
    rejected(nlpExtract) && says(nlpExtract, '文本'), `status=${nlpExtract.status} ${nlpExtract.message}`)
  const nlpParse = await call('/api/trade/nlp/parse', {
    method: 'POST', token: farmerToken, body: { text: '需要优质玉米 30 吨，陕西西安，2400元' },
  })
  check('正常解析能拿到商品名与数量', okBody(nlpParse) && nlpParse.data?.productName === '玉米'
    && nlpParse.data?.quantity === '30', JSON.stringify(nlpParse.data ?? {}))

  // ---------- G8：范围与全平台口径分开 ----------
  const buyerOrders = await call('/api/trade/order/page?pageNum=1&pageSize=100&side=buyer', { token: farmerToken })
  const buyerOrderCount = scalar(`SELECT COUNT(*) FROM agri_trade_order WHERE del_flag=0 AND buyer_id=${BUYER};`)
  check('我的采购订单只回我作为买方的（条数与库里一致）',
    okBody(buyerOrders) && String(buyerOrders.data?.total) === buyerOrderCount,
    `${buyerOrders.data?.total}/${buyerOrderCount}`)
  const sellerOrders = await call('/api/trade/order/page?pageNum=1&pageSize=100&side=seller', { token: sellerToken })
  const sellerOrderCount = scalar(`SELECT COUNT(*) FROM agri_trade_order WHERE del_flag=0 AND seller_id=${SELLER};`)
  check('我的供货订单只回我作为卖方的', okBody(sellerOrders) && String(sellerOrders.data?.total) === sellerOrderCount,
    `${sellerOrders.data?.total}/${sellerOrderCount}`)
  const strangerOrder = await call(`/api/trade/order/${orderId}`, { token: strangerToken })
  check('第三方按连号 id 看别人的订单被拒', rejected(strangerOrder) && says(strangerOrder, '无权'), strangerOrder.message)
  const mineDashboard = await call('/api/trade/dashboard/mine', { token: farmerToken })
  check('经营看板取令牌主体（2001）而不是随便一家',
    okBody(mineDashboard) && String(mineDashboard.data?.merchantId) === String(BUYER),
    `merchantId=${mineDashboard.data?.merchantId}`)
  const otherDashboard = await call(`/api/trade/dashboard/seller/${SELLER}`, { token: farmerToken })
  check('点名看别家经营数据被拒', rejected(otherDashboard) && says(otherDashboard, '自己绑定'), otherDashboard.message)

  // ---------- Z：零残留 ----------
  const purged = purge(marks)
  const createdRows = Object.entries(purged).filter(([, value]) => value.created > 0)
  const residue = Object.entries(purged).filter(([, value]) => value.left > 0)
  const markResidue = Number(scalar(`SELECT
      (SELECT COUNT(*) FROM agri_trade_demand WHERE demand_name LIKE '${MARK}%') +
      (SELECT COUNT(*) FROM agri_trade_quote WHERE remark LIKE '${MARK}%') +
      (SELECT COUNT(*) FROM agri_trade_refund WHERE refund_reason LIKE '${MARK}%') +
      (SELECT COUNT(*) FROM agri_trade_compensation WHERE review_remark LIKE '${MARK}%');`))
  check(`本次新增的 ${createdRows.reduce((sum, [, value]) => sum + value.created, 0)} 行已按主键区间清干净`,
    KEEP || residue.length === 0, JSON.stringify(residue))
  check('文字标记扫一遍也没有残留（需求标题/报价备注/退款原因/审核备注）',
    KEEP || markResidue === 0, `markResidue=${markResidue}`)
  if (KEEP) console.log('（--keep）保留的临时数据：', JSON.stringify(createdRows))

  console.log(`\n交易域身份端到端回归：${passed} 条断言通过，${failures.length} 条失败`)
  if (failures.length) {
    failures.forEach((line) => console.log(`  ✗ ${line}`))
    process.exitCode = 1
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`交易域端到端中断：${error.message}`)
    if (marks) {
      const cleaned = purge(marks)
      const left = Object.entries(cleaned).filter(([, value]) => value.left > 0)
      console.error(left.length ? `清场后仍有残留：${JSON.stringify(left)}` : '已按主键区间清场，无残留')
    }
    process.exitCode = 1
  })
}
