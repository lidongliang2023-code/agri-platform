/**
 * S2B2C 认证层回归（agri-s2b2c :8088）
 *
 * 链路：
 *   1. 无令牌 → 401（认证拦截器）
 *   2. 伪造/过期令牌 → 401
 *   3. 有效令牌 → GET /api/consumer/profile 自动建档，返回 consumerId，库里 user_id 已绑定
 *   4. 用自己的 consumerId 查购物车 → 200；用别人的 → 403
 *   5. 下单：不传 consumerId 自动补当前消费者（业务校验失败即证明已越过认证/归属）
 *   6. 清理：删除本轮自动创建的消费者档案（仅删除 phone 为空的新档，避免误删老数据）
 *
 * 用法：node scripts/e2e-s2b2c-auth.mjs
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import process from 'node:process'

const CORE = 'http://localhost:8093'
const S2B2C = 'http://localhost:8088'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const sql = (q) => {
  if (!existsSync(MYSQL)) return ''
  try {
    return execFileSync(MYSQL, ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', q],
      { encoding: 'utf8' }).trim()
  } catch (e) {
    return `ERR:${String(e?.message ?? e).slice(0, 80)}`
  }
}

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const readJson = async (res) => {
  try {
    return await res.json()
  } catch {
    return null
  }
}

const login = await (await fetch(`${CORE}/api/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', password: 'Admin@123', marketId: 1 }),
})).json()
const token = login?.data?.accessToken ?? ''
check(Boolean(token), '拿到平台令牌')

const call = async (url, options = {}) => {
  const response = await fetch(`${S2B2C}${url}`, options)
  return { status: response.status, body: await readJson(response) }
}

let createdConsumerId = null
let supplierApplicationId = ''
let supplierCreated = false

/*
 * 商品库存与销量的"开场快照"：本脚本会在多个夹具里真实下单（下单会扣库存、加销量），
 * 而中途那些快照恢复只覆盖了前半段的订单 —— 后半段（售后、自动确收、冲回）造的订单
 * 就把库存留在了扣掉的状态。实测每跑一轮 product 3 少 1 件库存、多 1 销量，
 * 五轮下来 747→742。所以这里在**任何造数之前**取一次绝对值，收尾时原样写回。
 */
const stockSnapshot = {}
for (const pid of [1, 3]) {
  stockSnapshot[pid] = {
    stock: sql(`SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = ${pid}`),
    sales: sql(`SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = ${pid}`),
  }
}
console.log(`开场库存快照：${JSON.stringify(stockSnapshot)}`)
let ownProductId = null
let channelCreated = false
let channelOrderId = ''
let myChannelId = ''
let testChannelId = ''
let priceOrderIds = []
let couponOrderIds = []
let couponIds = []
let couponStockSnapshot = null
let budgetFlashId = ''
let budgetGroupId = ''
let successGroupId = ''
let lifecycleFlashId = ''
let lifecycleGroupId = ''
let supplierStatementId = ''
let refundOrderIds = []
let refundCouponIds = []
let refundFlashIds = []
let refundStockSnapshot = null
let gradeOriginal = ''
let channelCompletedOrderId = ''
let supplierCompletedOrderId = ''
let reviewIds = []

try {
  /* ---------- 1) 无令牌 / 伪造令牌 ---------- */
  const anonymous = await call('/api/consumer/profile')
  check(anonymous.status === 401, '无令牌访问 401', `status=${anonymous.status}`)

  const forged = await call('/api/consumer/profile', {
    headers: { Authorization: 'Bearer not-a-real-token' },
  })
  check(forged.status === 401, '伪造令牌被拒 401', `status=${forged.status}`)

  /* ---------- 2) 有效令牌：自动建档 ---------- */
  const auth = { Authorization: `Bearer ${token}` }

  /*
   * 发货要按"订单归属"选身份（2026-11-02 补上的规则）：
   * 有供应商档案的账号只能发自己店铺的订单，平台账号（无供应商档案）才可代发。
   * 本脚本自己会提交一次商城入驻，于是 admin 也变成"有档案的供应商"，
   * 所以夹具里发供应商 1 的单必须用 supplier1 的令牌，否则会被归属校验挡下。
   */
  const supplierLogin = await (await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'supplier1', password: 'Admin@123', marketId: 1 }),
  })).json().catch(() => ({}))
  const supplierAuth = { Authorization: `Bearer ${supplierLogin?.data?.accessToken ?? ''}` }
  const shipOrder = async (orderId, prefix) => {
    const owner = sql(`SELECT supplier_id FROM agri_s2b2c.s2b2c_order WHERE id = '${orderId}'`)
    const headers = owner === '1' ? supplierAuth : auth
    const response = await fetch(`${S2B2C}/api/platform/order/ship?id=${orderId}`
      + `&logisticsNo=${prefix}${Date.now()}&company=顺丰`, { method: 'PUT', headers })
    return { status: response.status, body: await readJson(response) }
  }
  /** 把一笔单走到"已完成"：付款 → 发货（按归属）→ 确认收货。结算只认已完成的单。 */
  const completeOrder = async (orderId) => {
    await call(`/api/consumer/order/pay/${orderId}`, { method: 'PUT', headers: auth })
    await shipOrder(orderId, 'AUTH')
    return call(`/api/consumer/order/receive/${orderId}`, { method: 'PUT', headers: auth })
  }

  const profile = await call('/api/consumer/profile', { headers: auth })
  createdConsumerId = profile.body?.id ?? null
  check(profile.status === 200 && Boolean(createdConsumerId), '有效令牌可读消费者档案', `id=${createdConsumerId}`)

  const bound = sql(`SELECT user_id FROM agri_s2b2c.s2b2c_consumer WHERE id = '${createdConsumerId}'`)
  const adminId = sql(`SELECT id FROM agri_core.platform_user WHERE username = 'admin'`)
  check(String(bound) === String(adminId), '消费者档案已绑定平台账号', `user_id=${bound}`)

  /* ---------- 3) 归属校验 ---------- */
  const ownCart = await call(`/api/consumer/cart?consumerId=${createdConsumerId}`, { headers: auth })
  check(ownCart.status === 200, '查询自己的购物车 200', `status=${ownCart.status}`)

  /* ---------- 3.1) 按 id 反查归属 ---------- */
  const otherCartId = sql(`SELECT id FROM agri_s2b2c.s2b2c_cart WHERE consumer_id <> '${createdConsumerId}' ORDER BY id DESC LIMIT 1`)
  if (otherCartId && !otherCartId.startsWith('ERR')) {
    const otherCartUpdate = await call(`/api/consumer/cart/update?id=${otherCartId}&quantity=1`, {
      method: 'PUT', headers: auth,
    })
    check(otherCartUpdate.status === 403, '按购物车 id 改别人的行 403', `status=${otherCartUpdate.status}`)
    const otherCartDelete = await call(`/api/consumer/cart/delete/${otherCartId}`, { method: 'DELETE', headers: auth })
    check(otherCartDelete.status === 403, '按购物车 id 删别人的行 403', `status=${otherCartDelete.status}`)
  } else {
    console.log('  （库里没有其他消费者的购物车行，跳过按 id 的 403 断言）')
  }

  const otherAddressId = sql(`SELECT id FROM agri_s2b2c.s2b2c_address WHERE consumer_id <> '${createdConsumerId}' ORDER BY id DESC LIMIT 1`)
  if (otherAddressId && !otherAddressId.startsWith('ERR')) {
    const otherAddressDelete = await call(`/api/consumer/address/delete/${otherAddressId}`, { method: 'DELETE', headers: auth })
    check(otherAddressDelete.status === 403, '按地址 id 删别人的地址 403', `status=${otherAddressDelete.status}`)
  }

  const unknownCart = await call('/api/consumer/cart/update?id=999999999999999999&quantity=1', { method: 'PUT', headers: auth })
  check(unknownCart.status === 404, '不存在的购物车行 404', `status=${unknownCart.status}`)
  const unknownOrder = await call('/api/consumer/order/detail/999999999999999999', { headers: auth })
  check(unknownOrder.status === 404, '不存在的订单 404', `status=${unknownOrder.status}`)

  const otherId = '1'
  const otherCart = await call(`/api/consumer/cart?consumerId=${otherId}`, { headers: auth })
  check(otherCart.status === 403, '查询别人的购物车 403', `status=${otherCart.status}`)

  /* ---------- 4) 下单：consumerId 缺失时自动补当前 ---------- */
  const order = await call('/api/consumer/order/create', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  check(order.status !== 401 && order.status !== 403,
    '下单请求已越过认证与归属校验（业务侧校验失败）', `status=${order.status} body=${JSON.stringify(order.body).slice(0, 40)}`)
  /* ---------- 5) 供应商商品写入：能力 + 归属 ---------- */
  const productCreate = async (body, headers = auth) => {
    const response = await fetch(`${S2B2C}/api/supplier/product/create`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    })
    return { status: response.status, body: await readJson(response) }
  }
  const deniedProduct = await productCreate({})
  check(deniedProduct.status === 403 && String(deniedProduct.body?.message ?? '').includes('交易类业务身份'),
    '无交易身份时上架商品被 403', `status=${deniedProduct.status} msg=${String(deniedProduct.body?.message ?? '').slice(0, 22)}`)

  // 临时开通批发商身份，让能力层放行；此时应该卡在"没有供应商档案"
  const sessionRes = await fetch(`${CORE}/api/v1/sso/login-standalone`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'Admin@123' }),
  })
  const cookie = (sessionRes.headers.getSetCookie?.() ?? []).map((item) => item.split(';')[0]).join('; ')
  const applied = await (await fetch(`${CORE}/api/v1/sso/account/identity-applications`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ identityType: 'wholesaler', subjectName: 'E2E商城供应商主体' }),
  })).json()
  supplierApplicationId = applied?.data?.id ?? ''
  if (supplierApplicationId) {
    await fetch(`${CORE}/api/v1/admin/identity-applications/${supplierApplicationId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth },
      body: JSON.stringify({ approved: true, remark: 'e2e 商城供应商' }),
    })
  }
  const noProfile = await productCreate({})
  check(noProfile.status === 403 && String(noProfile.body?.message ?? '').includes('供应商档案'),
    '能力具备但未入驻商城时被 403', `status=${noProfile.status} msg=${String(noProfile.body?.message ?? '').slice(0, 22)}`)

  const applySupplier = await (await fetch(`${S2B2C}/api/supplier/apply`, {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName: 'E2E商城供应商', creditCode: '91320100E2E0001X', contactPhone: '13800000000' }),
  })).json()
  supplierCreated = applySupplier?.success === true
  check(supplierCreated, '提交商城入驻申请', JSON.stringify(applySupplier).slice(0, 40))

  const ownSupplierId = sql(`SELECT id FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}' ORDER BY id DESC LIMIT 1`)
  const duplicateSupplierApply = await (await fetch(`${S2B2C}/api/supplier/apply`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName: 'E2E商城供应商', creditCode: '91320100E2E0001X', contactPhone: '13800000000' }),
  })).json()
  check(duplicateSupplierApply?.success === false && String(duplicateSupplierApply?.message ?? '').includes('审核'),
    '供应商审核中不能重复申请', String(duplicateSupplierApply?.message ?? '').slice(0, 20))
  await fetch(`${S2B2C}/api/platform/supplier/audit?id=${ownSupplierId}&auditStatus=REJECTED&auditOpinion=e2e拒绝`,
    { method: 'PUT', headers: auth })
  const reapplySupplier = await (await fetch(`${S2B2C}/api/supplier/apply`, {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyName: 'E2E商城供应商', creditCode: '91320100E2E0001X',
      contactPhone: '13800000000', shopName: 'E2E能力校验店' }),
  })).json()
  const supplierProfileAfter = await (await fetch(`${S2B2C}/api/supplier/profile`, { headers: auth })).json()
  const supplierRows = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_supplier WHERE user_id = '${adminId}'`)
  check(reapplySupplier?.success === true && supplierProfileAfter?.auditStatus === 'PENDING'
    && supplierRows === '1', '驳回后重新申请复用原供应商档案', `rows=${supplierRows}`)
  const created = await productCreate({ categoryId: 1, name: 'E2E 能力校验商品', price: 1, stock: 1 })
  check(created.status !== 403 && created.body?.success === true,
    '开通身份并入驻后上架商品成功', `status=${created.status} body=${JSON.stringify(created.body).slice(0, 40)}`)
  ownProductId = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id = '${ownSupplierId}' ORDER BY id DESC LIMIT 1`)

  const otherProductId = sql('SELECT id FROM agri_s2b2c.s2b2c_product WHERE supplier_id <> ' +
    `'${ownSupplierId}' ORDER BY id DESC LIMIT 1`)
  if (otherProductId && !otherProductId.startsWith('ERR')) {
    const otherResponse = await fetch(`${S2B2C}/api/supplier/product/update`, {
      method: 'PUT',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: otherProductId, name: '越权改名' }),
    })
    const otherBody = await readJson(otherResponse)
    check(otherResponse.status === 403 && String(otherBody?.message ?? '').includes('其他供应商'),
      '按商品 id 改其他供应商的商品被 403', `status=${otherResponse.status}`)
  }

  /* ---------- 6) 渠道合伙人：账号绑定 + profile ---------- */
  const channelCall = async (url, options = {}) => {
    const response = await fetch(`${S2B2C}${url}`, options)
    return { status: response.status, body: await readJson(response) }
  }
  const profileBefore = await channelCall('/api/channel/profile', { headers: auth })
  check(profileBefore.status === 200 && profileBefore.body?.applied === false,
    '渠道 profile：未入驻时 applied=false', JSON.stringify(profileBefore.body).slice(0, 40))

  const otherChannelDetail = await channelCall('/api/channel/detail/1', { headers: auth })
  check(otherChannelDetail.status === 403, '查看其他渠道详情 403', `status=${otherChannelDetail.status}`)

  const appliedChannel = await channelCall('/api/channel/apply', {
    method: 'POST',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ registerType: 'PERSONAL', contactName: 'E2E渠道', contactPhone: '13800000000', shopName: 'E2E渠道优选店' }),
  })
  channelCreated = appliedChannel.body?.success === true
  check(channelCreated, '提交渠道入驻申请', JSON.stringify(appliedChannel.body).slice(0, 40))

  const profileAfter = await channelCall('/api/channel/profile', { headers: auth })
  myChannelId = profileAfter.body?.id ?? ''
  check(profileAfter.body?.applied === true && Boolean(myChannelId), 'profile 返回当前渠道', `id=${myChannelId}`)

  const ownDetail = await channelCall(`/api/channel/detail/${myChannelId}`, { headers: auth })
  check(ownDetail.status === 200, '查看自己的渠道详情 200', `status=${ownDetail.status}`)

  const crossSelect = await channelCall('/api/channel/select-product?channelId=1&productId=5', {
    method: 'POST', headers: auth,
  })
  check(crossSelect.status === 403, '替其他渠道选品 403', `status=${crossSelect.status}`)

  const crossUpdate = await channelCall('/api/channel/update', {
    method: 'PUT',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 1, shopName: '越权改名' }),
  })
  check(crossUpdate.status === 403, '修改其他渠道资料 403', `status=${crossUpdate.status}`)

  /* ---------- 6.1) 渠道能力：审核通过才生效 ---------- */
  const pendingProfile = await channelCall('/api/channel/profile', { headers: auth })
  check(pendingProfile.body?.capability === 's2b2c.channel' && pendingProfile.body?.capabilityGranted === false,
    '未审核时 s2b2c.channel 未开通', JSON.stringify(pendingProfile.body).slice(0, 60))

  const pendingSelect = await channelCall(`/api/channel/select-product?channelId=${myChannelId}&productId=1`, {
    method: 'POST', headers: auth,
  })
  check(pendingSelect.status === 403, '未审核渠道不能选品', `status=${pendingSelect.status}`)

  const rejectChannel = await fetch(
    `http://localhost:8088/api/platform/channel-partner/audit?id=${myChannelId}&auditStatus=REJECTED&auditOpinion=e2e拒绝`,
    { method: 'PUT', headers: auth }).then((r) => r.json())
  check(rejectChannel?.success === true, '运营端可驳回渠道申请', JSON.stringify(rejectChannel).slice(0, 30))
  const reapplyChannel = await channelCall('/api/channel/apply', {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ registerType: 'PERSONAL', contactName: 'E2E渠道', contactPhone: '13800000000',
      shopName: 'E2E渠道优选店' }),
  })
  const reapplyProfile = await channelCall('/api/channel/profile', { headers: auth })
  const channelRows = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_channel_partner WHERE user_id = '${adminId}'`)
  check(reapplyChannel.body?.success === true && reapplyProfile.body?.auditStatus === 'PENDING'
    && channelRows === '1', '驳回后重新申请复用原渠道档案', `rows=${channelRows}`)

  const audited = await fetch(`http://localhost:8088/api/platform/channel-partner/audit?id=${myChannelId}&auditStatus=APPROVED&auditOpinion=e2e`, {
    method: 'PUT',
    headers: auth,
  })
  const auditedBody = await readJson(audited)
  check(auditedBody?.success === true, '运营端可审核通过渠道', JSON.stringify(auditedBody).slice(0, 40))

  const auditedProfile = await channelCall('/api/channel/profile', { headers: auth })
  check(auditedProfile.body?.capabilityGranted === true, '审核通过后 s2b2c.channel 已开通',
    `auditStatus=${auditedProfile.body?.auditStatus}`)

  const reAudit = await fetch(`http://localhost:8088/api/platform/channel-partner/audit?id=${myChannelId}&auditStatus=REJECTED`, {
    method: 'PUT',
    headers: auth,
  })
  const reAuditBody = await readJson(reAudit)
  check(reAuditBody?.success === false && String(reAuditBody?.message ?? '').includes('已审核'),
    '同一渠道不能重复审核', `msg=${String(reAuditBody?.message ?? '').slice(0, 20)}`)


  /* ---------- 6.2) 渠道店铺（消费者视角） ---------- */
  const shopPage = await channelCall(`/api/consumer/channel/${myChannelId}`, { headers: auth })
  check(shopPage.status === 200 && shopPage.body?.channel?.shopName === 'E2E渠道优选店',
    '渠道店铺可读（名称正确）', `products=${(shopPage.body?.products ?? []).length}`)
  const unknownShop = await channelCall('/api/consumer/channel/999999999', { headers: auth })
  check(unknownShop.status === 404, '不存在的渠道店铺 404', `status=${unknownShop.status}`)

  /* ---------- 7) 渠道选品关系 + 订单渠道快照 ---------- */
  if (myChannelId) {
    testChannelId = String(myChannelId)
    const beforeChannel = sql(`SELECT IFNULL(channel_id,'NULL') FROM agri_s2b2c.s2b2c_product WHERE id = 1`)
    const picked = await channelCall(`/api/channel/select-product?channelId=${myChannelId}&productId=1`, {
      method: 'POST', headers: auth,
    })
    check(picked.body?.success === true, '选品成功（写入关系表）', JSON.stringify(picked.body).slice(0, 30))
    const relationCount = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${myChannelId}' AND product_id = 1 AND status = 'ACTIVE'`)
    check(relationCount === '1', '关系表有一条 ACTIVE 记录', `rows=${relationCount}`)
    const discovered = await channelCall('/api/consumer/channels?limit=50', { headers: auth })
    check((discovered.body ?? []).some((row) => String(row.id) === String(myChannelId)
      && Number(row.productCount ?? 0) >= 1), '渠道好店发现列表含本渠道（有在架商品）')
    const afterChannel = sql(`SELECT IFNULL(channel_id,'NULL') FROM agri_s2b2c.s2b2c_product WHERE id = 1`)
    check(beforeChannel === afterChannel, '商品自身的 channel_id 未被改写', `${beforeChannel} → ${afterChannel}`)

    const pickedAgain = await channelCall(`/api/channel/select-product?channelId=${myChannelId}&productId=1`, {
      method: 'POST', headers: auth,
    })
    const relationCount2 = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${myChannelId}' AND product_id = 1`)
    check(pickedAgain.body?.success === true && relationCount2 === '1', '重复选品幂等（关系仍一条）', `rows=${relationCount2}`)

    const pendingProduct = sql(`SELECT id FROM agri_s2b2c.s2b2c_product WHERE status <> 'APPROVED' ORDER BY id LIMIT 1`)
    if (pendingProduct && !pendingProduct.startsWith('ERR')) {
      const pendingPick = await channelCall(`/api/channel/select-product?channelId=${myChannelId}&productId=${pendingProduct}`, {
        method: 'POST', headers: auth,
      })
      check(pendingPick.body?.success === false && String(pendingPick.body?.message ?? '').includes('审核'),
        '未审核商品不能选品', `msg=${String(pendingPick.body?.message ?? '').slice(0, 20)}`)
    }

    /* 佣金规则：按渠道等级覆盖商品佣金率 */
    const saveRule = async (grade, rate) => {
      const res = await fetch(`${S2B2C}/api/platform/commission-rule`, {
        method: 'PUT',
        headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ grade, rate, status: 'ACTIVE', remark: 'e2e' }),
      })
      return res.json()
    }
    const rule1 = await saveRule('LEVEL_1', 6)
    const rule3 = await saveRule('LEVEL_3', 12)
    check(rule1?.success === true && rule3?.success === true, '配置 LEVEL_1=6% / LEVEL_3=12% 佣金规则')
    const rulesList = await (await fetch(`${S2B2C}/api/platform/commission-rules`, { headers: auth })).json()
    check((rulesList ?? []).some((r) => r.grade === 'LEVEL_1' && Number(r.rate) === 6),
      '规则列表可读', `count=${(rulesList ?? []).length}`)

    /* 下单：跨渠道拆单（渠道商品 + 其他供应商商品） */
    const addressId = '990000000000000001'
    const cartA = '990000000000000002'
    const cartB = '990000000000000003'
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${addressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address (id, consumer_id, name, phone, province, city, district, address, is_default, status)
         VALUES ('${addressId}', '${createdConsumerId}', 'E2E', '13800000000', '江苏省', '南京市', '鼓楼区', '测试路 1 号', FALSE, 'ACTIVE')`)
    // 商品 1：供应商 1 且在本渠道选品清单（从渠道店铺加购，带 channelId）
    // 商品 3：供应商 2，普通直购加购（不带 channelId）
    const channelAdd = await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=1&quantity=1&channelId=${myChannelId}`, {
      method: 'POST', headers: auth,
    })
    check(channelAdd.body?.success === true, '渠道店铺加购带上 channelId', JSON.stringify(channelAdd.body).slice(0, 30))
    const cartChannel = sql(`SELECT channel_id FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1 ORDER BY id DESC LIMIT 1`)
    check(String(cartChannel) === String(myChannelId), '购物车行记录了渠道归属', `channel_id=${cartChannel}`)
    const badChannelAdd = await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=3&quantity=1&channelId=${myChannelId}`, {
      method: 'POST', headers: auth,
    })
    check(badChannelAdd.body?.success === false && String(badChannelAdd.body?.message ?? '').includes('未上架'),
      '未在该渠道选品的商品不能按渠道加购', String(badChannelAdd.body?.message ?? '').slice(0, 22))
    const directAdd = await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=3&quantity=1`, {
      method: 'POST', headers: auth,
    })
    check(directAdd.body?.success === true, '普通直购加购成功', JSON.stringify(directAdd.body).slice(0, 20))
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${cartB}'`)
    const snap = {}
    for (const pid of [1, 3]) {
      snap[pid] = {
        stock: sql(`SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = ${pid}`),
        sales: sql(`SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = ${pid}`),
      }
    }

    const orderCreated = await channelCall('/api/consumer/order/create', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId }),
    })
    const orderIds = orderCreated.body?.orderIds ?? []
    /** 结算/提现夹具专用：这几笔要走完收货，不能和上面共用的"待发货"订单混用 */
    const settleOrderIds = []
    check(orderCreated.status === 200 && orderCreated.body?.success === true && orderIds.length === 2,
      '混合购物车拆成 2 个订单', `count=${orderCreated.body?.orderCount} msg=${String(orderCreated.body?.message ?? '').slice(0, 20)}`)
    check(String(orderCreated.body?.message ?? '').includes('拆分'), '返回消息说明已拆单',
      String(orderCreated.body?.message ?? '').slice(0, 24))

    if (orderIds.length) {
      const inClause = orderIds.map((id) => `'${id}'`).join(',')
      const channelOrders = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_order WHERE id IN (${inClause}) AND channel_id = '${myChannelId}' AND supplier_id = 1`)
      check(channelOrders === '1', '渠道订单：供应商 1 + 渠道快照', `rows=${channelOrders}`)
      const directOrders = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_order WHERE id IN (${inClause}) AND channel_id IS NULL AND supplier_id = 2`)
      check(directOrders === '1', '直购订单：供应商 2、无渠道归属', `rows=${directOrders}`)
      const commissions = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${inClause}) AND channel_id = '${myChannelId}'`)
      check(commissions === '1', '佣金只记在渠道订单上', `rows=${commissions}`)
      channelOrderId = String(orderIds[0])
    }

    // 佣金比例应取渠道等级规则（LEVEL_1=6%），而不是商品自带的 10%
    if (orderIds.length) {
      const inClause = orderIds.map((id) => `'${id}'`).join(',')
      const rate = sql(`SELECT rate FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${inClause}) AND channel_id = '${myChannelId}' LIMIT 1`)
      check(Number(rate) === 6, '佣金按渠道等级规则 LEVEL_1=6% 计算', `rate=${rate}`)
    }

    // 调整渠道等级为 LEVEL_3 后再下一单，验证只影响新订单
    const gradeChanged = await (await fetch(`${S2B2C}/api/platform/channel-partner/${myChannelId}/grade?grade=LEVEL_3`, {
      method: 'PUT', headers: auth,
    })).json()
    check(gradeChanged?.success === true, '渠道等级调整为 LEVEL_3', JSON.stringify(gradeChanged).slice(0, 40))

    const cartC = '990000000000000004'
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${cartC}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_cart (id, consumer_id, shop_id, product_id, quantity, selected)
         VALUES ('${cartC}', '${createdConsumerId}', 1, 1, 1, TRUE)`)
    const stock1Again = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 1')
    const sales1Again = sql('SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = 1')
    const orderAfterGrade = await channelCall('/api/consumer/order/create', {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId, channelId: String(myChannelId) }),
    })
    const newOrderIds = orderAfterGrade.body?.orderIds ?? []
    check(newOrderIds.length === 1, '升级后单渠道商品只生成 1 单', `count=${newOrderIds.length}`)
    if (newOrderIds.length) {
      const rate = sql(`SELECT rate FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${newOrderIds[0]}'`)
      check(Number(rate) === 12, '新订单佣金按 LEVEL_3=12% 计算', `rate=${rate}`)
      const oldRate = orderIds.length
        ? sql(`SELECT rate FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${orderIds[0]}' LIMIT 1`)
        : ''
      check(Number(oldRate) === 6 || oldRate === '', '历史订单佣金不受等级调整影响', `old=${oldRate}`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${newOrderIds[0]}'`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id = '${newOrderIds[0]}'`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id = '${newOrderIds[0]}'`)
    }
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id = '${cartC}'`)
    if (stock1Again && sales1Again && !stock1Again.startsWith('ERR')) {
      sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = ${stock1Again}, sales = ${sales1Again} WHERE id = 1`)
    }
    // 规则是本轮造的配置，清理掉恢复原样
    sql("DELETE FROM agri_s2b2c.s2b2c_commission_rule WHERE grade IN ('LEVEL_1','LEVEL_3') AND remark = 'e2e'")

    /* 佣金提现：余额 → 申请 → 审核 → 打款 */
    if (orderIds.length) {
      /*
       * 结算要一笔"已完成"的单。上面那两笔要留给后面的发货协同流程（它们必须停在待发货），
       * 所以这里另造一笔走完 付款 → 发货 → 确认收货，而不是把共用的单推过去 ——
       * 以前直接结待付款订单的佣金，那是资金口径的漏洞，不是"能结算"。
       */
      await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=1&quantity=1&channelId=${myChannelId}`,
        { method: 'POST', headers: auth })
      const settledFixture = await channelCall('/api/consumer/order/create', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressId }),
      })
      const settledIds = (settledFixture.body?.orderIds ?? []).map(String)
      settleOrderIds.push(...settledIds)
      for (const orderId of settledIds) await completeOrder(orderId)
      const settleStatus = settledIds.length
        ? sql(`SELECT GROUP_CONCAT(status) FROM agri_s2b2c.s2b2c_order
            WHERE id IN (${settledIds.map((id) => `'${id}'`).join(',')})`) : ''
      check(String(settleStatus) === 'COMPLETED', '结算前订单已走完付款/发货/收货', `status=${settleStatus}`)
      // 按渠道批量结算（生成批次号，佣金行记录 settle_batch_no）
      const settleRes = await (await fetch(`${S2B2C}/api/platform/commission/settlement`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: String(myChannelId) }),
      })).json()
      check(settleRes?.success === true && Number(settleRes?.count) >= 1 && Boolean(settleRes?.batchNo),
        '按渠道批量结算生成批次', `batch=${settleRes?.batchNo} count=${settleRes?.count}`)
      const batchOnRows = settledIds.length
        ? sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${settledIds.map((id) => `'${id}'`).join(',')}) AND settle_batch_no = '${settleRes?.batchNo}'`)
        : '0'
      check(batchOnRows !== '0', '佣金行记录了结算批次号', `rows=${batchOnRows}`)
      const channelBatches = await channelCall('/api/channel/settlements', { headers: auth })
      check((channelBatches.body ?? []).some((row) => row.batchNo === settleRes?.batchNo),
        '渠道端能看到结算批次')
      const channelOrders = await channelCall('/api/channel/orders?page=1&size=50', { headers: auth })
      const channelOrderRows = channelOrders.body?.records ?? []
      check(channelOrderRows.length >= 1
        && channelOrderRows.every((row) => String(row.channelId) === String(myChannelId)),
        '渠道订单只返回本渠道订单', `rows=${channelOrderRows.length}`)
      const summary = await channelCall('/api/channel/commission-summary', { headers: auth })
      const available = Number(summary.body?.available ?? 0)
      check(available > 0, '可提现余额 = 已结算佣金', `available=${available}`)

      const tooMuch = await channelCall('/api/channel/withdrawal', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: available + 100 }),
      })
      check(tooMuch.body?.success === false && String(tooMuch.body?.message ?? '').includes('余额不足'),
        '超过余额的提现被拒', String(tooMuch.body?.message ?? '').slice(0, 24))

      const applyWithdraw = await channelCall('/api/channel/withdrawal', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Math.min(available, 0.05) }),
      })
      check(applyWithdraw.body?.success === true, '提交提现申请', JSON.stringify(applyWithdraw.body).slice(0, 30))

      const duplicate = await channelCall('/api/channel/withdrawal', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: 0.01 }),
      })
      check(duplicate.body?.success === false && String(duplicate.body?.message ?? '').includes('待审核'),
        '重复提现申请被拒', String(duplicate.body?.message ?? '').slice(0, 20))

      const pendingList = await channelCall('/api/platform/withdrawals?status=PENDING', { headers: auth })
      const withdrawRow = (pendingList.body ?? [])[0]
      check(Boolean(withdrawRow?.id), '运营端能看到待审提现', `id=${withdrawRow?.id}`)

      if (withdrawRow?.id) {
        const approve = await (await fetch(`${S2B2C}/api/platform/withdrawal/${withdrawRow.id}/review?status=APPROVED`, {
          method: 'PUT', headers: auth,
        })).json()
        check(approve?.success === true, '审核通过提现', JSON.stringify(approve).slice(0, 30))
        const payWithoutNo = await (await fetch(`${S2B2C}/api/platform/withdrawal/${withdrawRow.id}/review?status=PAID`, {
          method: 'PUT', headers: auth,
        })).json()
        check(payWithoutNo?.success === false && String(payWithoutNo?.message ?? '').includes('流水号'),
          '打款必须登记流水号', String(payWithoutNo?.message ?? '').slice(0, 24))
        const payoutNo = `E2E-PAY-${Date.now()}`
        const pay = await (await fetch(`${S2B2C}/api/platform/withdrawal/${withdrawRow.id}/review?status=PAID&payoutNo=${payoutNo}`, {
          method: 'PUT', headers: auth,
        })).json()
        check(pay?.success === true, '标记已打款', JSON.stringify(pay).slice(0, 30))
        const payoutRow = sql(`SELECT payout_no FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE id = '${withdrawRow.id}'`)
        check(payoutRow === payoutNo, '打款流水号落库', `payout_no=${payoutRow}`)
        const illegal = await (await fetch(`${S2B2C}/api/platform/withdrawal/${withdrawRow.id}/review?status=REJECTED`, {
          method: 'PUT', headers: auth,
        })).json()
        check(illegal?.success === false && String(illegal?.message ?? '').includes('不能变更'),
          '已打款后不能再驳回', String(illegal?.message ?? '').slice(0, 24))
        const mine = await channelCall('/api/channel/withdrawals', { headers: auth })
        const paid = (mine.body ?? []).find((row) => String(row.id) === String(withdrawRow.id))
        check(paid?.status === 'PAID' && paid?.payoutNo === payoutNo, '渠道端看到打款状态与流水号',
          `status=${paid?.status} payoutNo=${paid?.payoutNo}`)
      }
      /*
       * 清理按"本轮真正创建出来的那几条"删，不按 channel_id 删：
       * myChannelId 在 JS 里是 19 位数字，一旦走过 Number 就丢精度，
       * 用错了值就是"脚本说清理干净了、库里还留着"（本轮实测到过）。
       */
      if (settleRes?.batchNo) {
        sql(`DELETE FROM agri_s2b2c.s2b2c_commission_settlement WHERE batch_no = '${settleRes.batchNo}'`)
      }
      sql(`DELETE FROM agri_s2b2c.s2b2c_commission_withdrawal WHERE channel_id = '${myChannelId}'`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_commission_settlement WHERE channel_id = '${myChannelId}'`)
    }

    /* 渠道经营台：订单详情 / 发货 / 售后 / 客户 / 分析 / 对账 */
    if (channelOrderId) {
      await channelCall(`/api/consumer/order/pay/${channelOrderId}`, { method: 'PUT', headers: auth })
      const detail = await channelCall(`/api/channel/order/${channelOrderId}`, { headers: auth })
      check(detail.status === 200 && (detail.body?.items || []).length >= 1, '渠道订单详情含商品明细')
      const detailBuyerPhone = String(detail.body?.buyer?.phone ?? '')
      check(Boolean(detail.body?.buyer?.id)
        && (detailBuyerPhone === '' || detailBuyerPhone.includes('****')), '订单详情买家信息可用且手机号脱敏',
        `phone=${detailBuyerPhone || '未留手机号'}`)

      const stats = await channelCall('/api/channel/order-stats', { headers: auth })
      check(Number(stats.body?.byStatus?.PENDING_SHIP ?? 0) >= 1, '订单状态统计含待发货',
        `pendingShip=${stats.body?.byStatus?.PENDING_SHIP}`)

      const ship = await channelCall(
        `/api/channel/order/${channelOrderId}/ship?logisticsNo=SF-E2E-${Date.now()}&company=顺丰冷链`,
        { method: 'PUT', headers: auth })
      check(ship.body?.success === true, '渠道提交发货信息', String(ship.body?.message ?? '').slice(0, 20))
      const pendingShip = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${channelOrderId}'`)
      const firstProposal = sql(`SELECT CONCAT(status,'|',proposer_type) FROM agri_s2b2c.s2b2c_order_shipment WHERE order_id='${channelOrderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
      check(pendingShip === 'PENDING_SHIP' && firstProposal === 'PROPOSED|CHANNEL',
        '提交后订单待供应商确认', `order=${pendingShip} proposal=${firstProposal}`)
      const orderSupplierId = sql(`SELECT supplier_id FROM agri_s2b2c.s2b2c_order WHERE id = '${channelOrderId}'`)
      const proposedNotice = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice WHERE recipient_type = 'SUPPLIER' AND recipient_id = '${orderSupplierId}' AND type = 'SHIP_PROPOSED' AND ref_id = '${channelOrderId}'`)
      check(proposedNotice !== '0', '供应商收到发货待确认通知', `rows=${proposedNotice}`)

      sql(`INSERT INTO agri_s2b2c.s2b2c_notice_preference (id, recipient_type, recipient_id, notice_type, enabled) VALUES ('990000000000000301','SUPPLIER','${orderSupplierId}','SHIP_WITHDRAWN',0) ON DUPLICATE KEY UPDATE enabled=0`)
      const withdrawShip = await channelCall(
        `/api/channel/order/${channelOrderId}/shipment/withdraw`, { method: 'PUT', headers: auth })
      check(withdrawShip.body?.success === true, '渠道撤回发货信息', String(withdrawShip.body?.message ?? '').slice(0, 20))
      const withdrawnProposal = sql(`SELECT status FROM agri_s2b2c.s2b2c_order_shipment WHERE order_id='${channelOrderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
      check(withdrawnProposal === 'CANCELLED', '撤回后发货信息为 CANCELLED', `status=${withdrawnProposal}`)
      const withdrawnNotice = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice WHERE recipient_type = 'SUPPLIER' AND recipient_id = '${orderSupplierId}' AND type = 'SHIP_WITHDRAWN' AND ref_id = '${channelOrderId}'`)
      check(withdrawnNotice === '0', '关闭通知偏好后撤回通知不落库', `rows=${withdrawnNotice}`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_notice_preference WHERE recipient_type='SUPPLIER' AND recipient_id='${orderSupplierId}' AND notice_type='SHIP_WITHDRAWN'`)

      const retryPropose = await channelCall(
        `/api/channel/order/${channelOrderId}/shipment/propose?logisticsNo=SF-E2E-RETRY-${Date.now()}&company=SF`,
        { method: 'PUT', headers: auth })
      const reproposal = sql(`SELECT CONCAT(status,'|',proposer_type) FROM agri_s2b2c.s2b2c_order_shipment WHERE order_id='${channelOrderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
      check(reproposal === 'PROPOSED|CHANNEL', '撤回后可重新提交发货信息',
        `proposal=${reproposal} msg=${String(retryPropose.body?.message ?? '').slice(0, 30)}`)

      const createdAfterSale = await channelCall('/api/consumer/after-sales', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: createdConsumerId, orderId: channelOrderId, type: 'REFUND', reason: 'e2e 售后', amount: 1 }),
      })
      check(createdAfterSale.body?.success === true, '消费者提交售后', String(createdAfterSale.body?.message ?? '').slice(0, 20))
      const afterSales = await channelCall('/api/channel/after-sales', { headers: auth })
      const afterSaleRow = (afterSales.body ?? []).find((row) => String(row.orderId) === String(channelOrderId))
      check(Boolean(afterSaleRow), '渠道售后列表含本渠道售后')
      if (afterSaleRow) {
        const reviewed = await channelCall(
          `/api/channel/after-sale/${afterSaleRow.id}/review?status=APPROVED&opinion=e2e`,
          { method: 'PUT', headers: auth })
        check(reviewed.body?.success === true, '渠道处理售后')
      }

      const customers = await channelCall('/api/channel/customers?page=1&size=50', { headers: auth })
      check((customers.body?.records ?? []).some((row) => String(row.consumerId) === String(createdConsumerId)),
        '客户列表含本渠道买家')
      const customer = await channelCall(`/api/channel/customer/${createdConsumerId}`, { headers: auth })
      check(customer.status === 200 && Number(customer.body?.profile?.orderCount ?? 0) >= 1, '客户画像可读')

      const analytics = await channelCall('/api/channel/analytics?days=30', { headers: auth })
      check(Number(analytics.body?.orders ?? 0) >= 1 && (analytics.body?.trend ?? []).length === 30,
        '经营分析含 30 天走势')
      const month = new Date().toISOString().slice(0, 7)
      const reconcile = await channelCall(`/api/channel/reconcile?month=${month}`, { headers: auth })
      check(Number(reconcile.body?.summary?.orderCount ?? 0) >= 1 && (reconcile.body?.ledger ?? []).length >= 1,
        '月度对账单含订单与流水')
    }

    // 清理订单相关；商品库存/销量恢复
    if (orderIds.length) {
      const inClause = [...orderIds, ...settleOrderIds].map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM agri_s2b2c.s2b2c_after_sale WHERE order_id IN (${inClause})`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_order_shipment WHERE order_id IN (${inClause})`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_notice WHERE ref_type = 'ORDER' AND ref_id IN (${inClause})`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${inClause})`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id IN (${inClause})`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id IN (${inClause})`)
    }
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE id IN ('${cartA}','${cartB}')`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${addressId}'`)
    for (const pid of [1, 3]) {
      if (snap[pid].stock && snap[pid].sales && !snap[pid].stock.startsWith('ERR')) {
        sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = ${snap[pid].stock}, sales = ${snap[pid].sales} WHERE id = ${pid}`)
      }
    }
  }

  /* ---------- 8) 供应商撤销渠道授权 ---------- */
  if (myChannelId && ownProductId) {
    // 供应商商品默认 PENDING，先由运营审核通过，渠道才能选
    await fetch(`http://localhost:8088/api/platform/product/audit?id=${ownProductId}&status=APPROVED&opinion=e2e`, {
      method: 'PUT', headers: auth,
    })
    const pickOwn = await channelCall(`/api/channel/select-product?channelId=${myChannelId}&productId=${ownProductId}`, {
      method: 'POST', headers: auth,
    })
    check(pickOwn.body?.success === true, '渠道选中供应商自己的商品', JSON.stringify(pickOwn.body).slice(0, 30))

    /* 限售区域：省级配置，下单按收货省份校验 */
    const regionAddressId = '990000000000000010'
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${regionAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id, consumer_id, name, phone, province, city, district, address, is_default, status)
         VALUES ('${regionAddressId}', '${createdConsumerId}', 'E2E限售', '13800000002', '江苏省', '南京市', '鼓楼区', '限售路 10 号', FALSE, 'ACTIVE')`)
    const regionRule = await channelCall(`/api/supplier/product/${ownProductId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, regionNames: ['浙江省'] }),
    })
    check(regionRule.body?.success === true && (regionRule.body?.regionNames ?? []).includes('浙江省'),
      '投放规则保存限售区域', JSON.stringify(regionRule.body?.regionNames ?? []).slice(0, 30))
    const regionRuleGet = await channelCall(`/api/supplier/product/${ownProductId}/distribution-rule`, { headers: auth })
    check((regionRuleGet.body?.regionNames ?? []).includes('浙江省'), '限售区域可回读',
      JSON.stringify(regionRuleGet.body?.regionNames ?? []).slice(0, 30))

    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}'`)
    const regionAdd = await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=${ownProductId}&quantity=1&channelId=${myChannelId}`, {
      method: 'POST', headers: auth,
    })
    check(regionAdd.body?.success === true, '限售商品仍可加入购物车（结算时校验）',
      JSON.stringify(regionAdd.body).slice(0, 20))
    const blockedOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: regionAddressId }),
    })
    check(blockedOrder.status === 400 && blockedOrder.body?.success === false
      && String(blockedOrder.body?.message ?? '').includes('限售'),
      '收货地址不在限售区域时下单被拒', `status=${blockedOrder.status} msg=${String(blockedOrder.body?.message ?? '').slice(0, 24)}`)

    const relaxRule = await channelCall(`/api/supplier/product/${ownProductId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, regionNames: ['江苏省'] }),
    })
    check(relaxRule.body?.success === true, '限售区域改为收货省份')
    const regionOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: regionAddressId }),
    })
    const regionOrderIds = regionOrder.body?.orderIds ?? []
    check(regionOrder.status === 200 && regionOrder.body?.success === true && regionOrderIds.length === 1,
      '收货地址在限售区域内允许下单', `status=${regionOrder.status} count=${regionOrderIds.length}`)
    if (regionOrderIds.length) {
      const regionInClause = regionOrderIds.map((id) => `'${id}'`).join(',')
      sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${regionInClause})`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id IN (${regionInClause})`)
      sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id IN (${regionInClause})`)
    }
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${regionAddressId}'`)
    const clearRegions = await channelCall(`/api/supplier/product/${ownProductId}/distribution-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: true, maxChannels: 0, regionNames: [] }),
    })
    check(clearRegions.body?.success === true && (clearRegions.body?.regionNames ?? []).length === 0,
      '限售区域可清空为全国', JSON.stringify(clearRegions.body?.regionNames ?? []))

    const authList = await channelCall(`/api/supplier/channel-authorizations?productId=${ownProductId}`, { headers: auth })
    const relation = (authList.body ?? []).find((item) => String(item.productId) === String(ownProductId))
    check(Boolean(relation?.id), '供应商能看到渠道授权记录', `id=${relation?.id}`)

    if (relation?.id) {
      const revoke = await channelCall(`/api/supplier/channel-authorization/${relation.id}/revoke`, {
        method: 'PUT', headers: auth,
      })
      check(revoke.body?.success === true, '供应商撤销渠道授权', JSON.stringify(revoke.body).slice(0, 30))

      const afterList = await channelCall(`/api/supplier/channel-authorizations?productId=${ownProductId}`, { headers: auth })
      const revoked = (afterList.body ?? []).find((item) => item.id === relation.id)
      check(revoked?.status === 'REVOKED', '撤销后状态为 REVOKED', `status=${revoked?.status}`)

      const channelProducts = await channelCall(`/api/channel/products?channelId=${myChannelId}&page=1&size=50`, { headers: auth })
      const stillListed = (channelProducts.body?.records ?? []).some((item) => String(item.id) === String(ownProductId))
      check(!stillListed, '撤销后渠道选品列表不再包含该商品')

      const revokeAgain = await channelCall(`/api/supplier/channel-authorization/${relation.id}/revoke`, {
        method: 'PUT', headers: auth,
      })
      check(revokeAgain.body?.success === true && String(revokeAgain.body?.message ?? '').includes('已经'),
        '重复撤销幂等', String(revokeAgain.body?.message ?? '').slice(0, 20))
    }
  }

  /* ---------- 9) 渠道零售价与上下架 ---------- */
  if (testChannelId) {
    const pricingAddressId = '990000000000000009'
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${pricingAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id, consumer_id, name, phone, province, city, district, address, is_default, status)
         VALUES ('${pricingAddressId}', '${createdConsumerId}', 'E2E改价', '13800000001', '江苏省', '南京市', '鼓楼区', '改价路 9 号', FALSE, 'ACTIVE')`)
    await channelCall(`/api/channel/select-product?channelId=${testChannelId}&productId=3`, { method: 'POST', headers: auth })
    const priced = await (await fetch(`${S2B2C}/api/channel/product/3/listing?retailPrice=45&shelfStatus=ON`, {
      method: 'PUT', headers: auth,
    })).json()
    check(priced?.success === true && Number(priced?.effectivePrice) === 45,
      '渠道改价生效', `effective=${priced?.effectivePrice}`)

    const shopPriced = await channelCall(`/api/consumer/channel/${testChannelId}`, { headers: auth })
    const pricedProduct = (shopPriced.body?.products ?? []).find((row) => String(row.id) === '3')
    check(Number(pricedProduct?.price) === 45, '渠道店铺展示渠道零售价', `price=${pricedProduct?.price}`)

    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 3`)
    await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=3&quantity=1&channelId=${testChannelId}`, {
      method: 'POST', headers: auth,
    })
    const priceOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumerId: createdConsumerId, addressId: pricingAddressId }),
    })
    priceOrderIds = priceOrder.body?.orderIds ?? []
    const priceChannelOrderId = (priceOrderIds ?? []).map(String).find((id) =>
      sql(`SELECT IFNULL(channel_id,'') FROM agri_s2b2c.s2b2c_order WHERE id = '${id}'`) === String(testChannelId))
    if (priceChannelOrderId) {
      const itemPrice = sql(`SELECT price FROM agri_s2b2c.s2b2c_order_item WHERE order_id = '${priceChannelOrderId}' LIMIT 1`)
      check(Number(itemPrice) === 45, '渠道订单按渠道零售价计价', `price=${itemPrice}`)
    }

    await fetch(`${S2B2C}/api/channel/product/3/listing?shelfStatus=OFF`, { method: 'PUT', headers: auth })
    const offAdd = await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=3&quantity=1&channelId=${testChannelId}`, {
      method: 'POST', headers: auth,
    })
    check(offAdd.body?.success === false && String(offAdd.body?.message ?? '').includes('下架'),
      '渠道下架后不能加购', String(offAdd.body?.message ?? '').slice(0, 20))
    const shopOff = await channelCall(`/api/consumer/channel/${testChannelId}`, { headers: auth })
    check(!(shopOff.body?.products ?? []).some((row) => String(row.id) === '3'),
      '下架后渠道店铺不展示该商品')

    await fetch(`${S2B2C}/api/channel/product/3/listing?retailPrice=&shelfStatus=ON`, { method: 'PUT', headers: auth })
  }

  /* ---------- 10) 优惠券核销：服务端算优惠、防复用、防客户端伪造 ---------- */
  if (createdConsumerId) {
    const pad = (n) => String(n).padStart(2, '0')
    const dayText = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    const validStart = dayText(new Date())
    const validEnd = dayText(new Date(Date.now() + 30 * 86400000))
    const couponAddressId = '990000000000000011'
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${couponAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id, consumer_id, name, phone, province, city, district, address, is_default, status)
         VALUES ('${couponAddressId}', '${createdConsumerId}', 'E2E券', '13800000003', '江苏省', '南京市', '鼓楼区', '券路 11 号', FALSE, 'ACTIVE')`)
    const createCoupon = async (body) => (await fetch(`${S2B2C}/api/platform/coupons`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ totalCount: 10, perUserLimit: 1, validStart, validEnd, minAmount: 1, ...body }),
    })).json()
    const fixedCoupon = await createCoupon({
      name: 'E2E满减券', type: 'FIXED', amount: 5, budget: 5, costBearer: 'PLATFORM',
    })
    const fixedCouponId = String(fixedCoupon?.id ?? '')
    if (fixedCouponId) couponIds.push(fixedCouponId)
    check(fixedCoupon?.success === true && Boolean(fixedCouponId), '创建固定金额优惠券', fixedCouponId)
    const fixedBudget = sql(`SELECT CONCAT(budget,'|',budget_used,'|',cost_bearer)
                             FROM agri_s2b2c.s2b2c_coupon WHERE id='${fixedCouponId}'`)
    check(fixedBudget === '5.00|0.00|PLATFORM', '券预算与承担方落库', fixedBudget)
    const fixedReceive = await channelCall(
      `/api/consumer/coupon/receive?consumerId=${createdConsumerId}&couponId=${fixedCouponId}`,
      { method: 'POST', headers: auth })
    check(fixedReceive.body?.success === true, '消费者领取优惠券', JSON.stringify(fixedReceive.body).slice(0, 24))
    const couponList = await channelCall(`/api/consumer/coupons?consumerId=${createdConsumerId}`, { headers: auth })
    const fixedUser = (couponList.body ?? []).find((row) =>
      String(row.couponId) === fixedCouponId && String(row.status).toUpperCase() === 'UNUSED')
    check(Boolean(fixedUser?.id), '券列表返回未使用记录', `id=${fixedUser?.id}`)
    couponStockSnapshot = {
      stock: sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3'),
      sales: sql('SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = 3'),
    }

    const addCart3 = async () => {
      sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 3`)
      return channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=3&quantity=1`, {
        method: 'POST', headers: auth,
      })
    }
    await addCart3()
    const couponOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: couponAddressId, couponUserId: fixedUser?.id, discountAmount: 999 }),
    })
    const couponOrderIdsNow = (couponOrder.body?.orderIds ?? []).map(String)
    couponOrderIds.push(...couponOrderIdsNow)
    check(couponOrder.body?.success === true && couponOrderIdsNow.length === 1,
      '使用优惠券下单成功', `count=${couponOrderIdsNow.length}`)
    if (couponOrderIdsNow[0]) {
      const orderCoupon = sql(`SELECT CONCAT(discount_amount,'|',pay_amount,'|',IFNULL(coupon_user_id,''),'|',coupon_discount)
                               FROM agri_s2b2c.s2b2c_order WHERE id = '${couponOrderIdsNow[0]}'`)
      check(orderCoupon === `5.00|33.00|${fixedUser?.id}|5.00`, '券优惠由服务端计算并落单', orderCoupon)
      const couponStatus = sql(`SELECT CONCAT(status,'|',IFNULL(order_id,''))
                                FROM agri_s2b2c.s2b2c_coupon_user WHERE id = '${fixedUser?.id}'`)
      check(couponStatus === `USED|${couponOrderIdsNow[0]}`, '券标记已用并绑定订单', couponStatus)
      const budgetUsed = sql(`SELECT budget_used FROM agri_s2b2c.s2b2c_coupon WHERE id='${fixedCouponId}'`)
      check(Number(budgetUsed) === 5, '券核销扣减活动预算', `budgetUsed=${budgetUsed}`)
      const couponMonitor = await channelCall(
        `/api/platform/activities/COUPON/${fixedCouponId}/monitor`, { headers: auth })
      check(Number(couponMonitor.body?.metrics?.used) === 1
        && Number(couponMonitor.body?.metrics?.discountAmount) === 5
        && Number(couponMonitor.body?.metrics?.gmv) === 33,
        '活动监控统计券核销与优惠',
        `used=${couponMonitor.body?.metrics?.used} discount=${couponMonitor.body?.metrics?.discountAmount} gmv=${couponMonitor.body?.metrics?.gmv}`)
      check(Number(couponMonitor.body?.metrics?.budget) === 5
        && Number(couponMonitor.body?.metrics?.budgetUsed) === 5
        && Number(couponMonitor.body?.metrics?.budgetRemain) === 0
        && String(couponMonitor.body?.activity?.costBearer ?? '') === 'PLATFORM',
        '活动监控返回预算与承担方',
        `budget=${couponMonitor.body?.metrics?.budget} used=${couponMonitor.body?.metrics?.budgetUsed}`)
      check(String(couponMonitor.body?.attribution ?? '').includes('coupon_user_id'),
        '券监控标明订单归因口径', String(couponMonitor.body?.attribution ?? '').slice(0, 30))
      const marketingAfterCoupon = await channelCall('/api/consumer/marketing', { headers: auth })
      check(!(marketingAfterCoupon.body?.coupons ?? []).some((row) =>
        String(row.id) === fixedCouponId), '预算耗尽的优惠券不再对外展示')
    }

    await addCart3()
    const reuseCoupon = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: couponAddressId, couponUserId: fixedUser?.id }),
    })
    check(reuseCoupon.status === 400 && String(reuseCoupon.body?.message ?? '').includes('已使用'),
      '重复使用优惠券被拒', `status=${reuseCoupon.status} msg=${String(reuseCoupon.body?.message ?? '').slice(0, 20)}`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 3`)

    await addCart3()
    const fakeDiscount = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: couponAddressId, discountAmount: 999, freightAmount: -20 }),
    })
    const fakeOrderIds = (fakeDiscount.body?.orderIds ?? []).map(String)
    couponOrderIds.push(...fakeOrderIds)
    check(fakeDiscount.body?.success === true, '无券订单创建成功')
    if (fakeOrderIds[0]) {
      const fakeMoney = sql(`SELECT CONCAT(discount_amount,'|',freight_amount,'|',pay_amount)
                             FROM agri_s2b2c.s2b2c_order WHERE id = '${fakeOrderIds[0]}'`)
      check(fakeMoney === '0.00|0.00|38.00', '客户端伪造折扣与负运费被忽略', fakeMoney)
    }

    const rateCoupon = await createCoupon({ name: 'E2E折扣券', type: 'DISCOUNT', discountRate: 9.5, amount: 0 })
    const rateCouponId = String(rateCoupon?.id ?? '')
    if (rateCouponId) couponIds.push(rateCouponId)
    const rateReceive = await channelCall(
      `/api/consumer/coupon/receive?consumerId=${createdConsumerId}&couponId=${rateCouponId}`,
      { method: 'POST', headers: auth })
    const rateList = await channelCall(`/api/consumer/coupons?consumerId=${createdConsumerId}`, { headers: auth })
    const rateUser = (rateList.body ?? []).find((row) =>
      String(row.couponId) === rateCouponId && String(row.status).toUpperCase() === 'UNUSED')
    check(rateReceive.body?.success === true && Boolean(rateUser?.id), '领取折扣券',
      `id=${rateUser?.id}`)
    await addCart3()
    const rateOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: couponAddressId, couponUserId: rateUser?.id }),
    })
    const rateOrderIds = (rateOrder.body?.orderIds ?? []).map(String)
    couponOrderIds.push(...rateOrderIds)
    check(rateOrder.body?.success === true && rateOrderIds.length === 1, '折扣券下单成功')
    if (rateOrderIds[0]) {
      const rateMoney = sql(`SELECT CONCAT(discount_amount,'|',pay_amount)
                             FROM agri_s2b2c.s2b2c_order WHERE id = '${rateOrderIds[0]}'`)
      check(rateMoney === '1.90|36.10', '9.5 折按支付 95% 计算', rateMoney)
    }

    /* 券预算不足：优惠 5 > 预算 4 → 拒绝且不消耗券 */
    const lowBudgetCoupon = await createCoupon({ name: 'E2E低预算券', type: 'FIXED', amount: 5, budget: 4 })
    const lowBudgetId = String(lowBudgetCoupon?.id ?? '')
    if (lowBudgetId) couponIds.push(lowBudgetId)
    await channelCall(`/api/consumer/coupon/receive?consumerId=${createdConsumerId}&couponId=${lowBudgetId}`,
      { method: 'POST', headers: auth })
    const lowList = await channelCall(`/api/consumer/coupons?consumerId=${createdConsumerId}`, { headers: auth })
    const lowUser = (lowList.body ?? []).find((row) =>
      String(row.couponId) === lowBudgetId && String(row.status).toUpperCase() === 'UNUSED')
    await addCart3()
    const lowOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: couponAddressId, couponUserId: lowUser?.id }),
    })
    check(lowOrder.status === 400 && String(lowOrder.body?.message ?? '').includes('预算'),
      '券优惠超过预算时下单被拒', `status=${lowOrder.status} msg=${String(lowOrder.body?.message ?? '').slice(0, 20)}`)
    const lowState = sql(`SELECT CONCAT((SELECT status FROM agri_s2b2c.s2b2c_coupon_user WHERE id='${lowUser?.id}'),
                                        '|',(SELECT budget_used FROM agri_s2b2c.s2b2c_coupon WHERE id='${lowBudgetId}'))`)
    check(lowState === 'UNUSED|0.00', '预算不足不消耗券与预算', lowState)

    /* 秒杀预算：1 元补贴可用一次，第二次预算耗尽按原价成交 */
    const flashRes = await (await fetch(`${S2B2C}/api/platform/flash-sales`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 3, salePrice: 37, totalStock: 10, perUserLimit: 10,
        startTime: '2026-01-01 00:00:00', endTime: '2030-12-31 23:59:59',
        budget: 1, costBearer: 'SUPPLIER' }),
    })).json()
    budgetFlashId = String(flashRes?.id ?? '')
    check(flashRes?.success === true && Boolean(budgetFlashId), '创建带预算的秒杀', budgetFlashId)
    await addCart3()
    const flashOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: couponAddressId }),
    })
    const flashOrderIds = (flashOrder.body?.orderIds ?? []).map(String)
    couponOrderIds.push(...flashOrderIds)
    if (flashOrderIds[0]) {
      const flashPrice = sql(`SELECT price FROM agri_s2b2c.s2b2c_order_item WHERE order_id='${flashOrderIds[0]}' LIMIT 1`)
      const flashUsed = sql(`SELECT budget_used FROM agri_s2b2c.s2b2c_flash_sale WHERE id='${budgetFlashId}'`)
      check(Number(flashPrice) === 37 && Number(flashUsed) === 1, '秒杀预算内按活动价并扣预算',
        `price=${flashPrice} used=${flashUsed}`)
      const flashMonitor = await channelCall(`/api/platform/activities/FLASH/${budgetFlashId}/monitor`, { headers: auth })
      check(String(flashMonitor.body?.attribution ?? '').includes('flash_sale_id'),
        '秒杀监控按订单主键归因', String(flashMonitor.body?.attribution ?? '').slice(0, 30))
    }
    await addCart3()
    const flashOrder2 = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: couponAddressId }),
    })
    const flashOrderIds2 = (flashOrder2.body?.orderIds ?? []).map(String)
    couponOrderIds.push(...flashOrderIds2)
    if (flashOrderIds2[0]) {
      const flashPrice2 = sql(`SELECT price FROM agri_s2b2c.s2b2c_order_item WHERE order_id='${flashOrderIds2[0]}' LIMIT 1`)
      const flashUsed2 = sql(`SELECT budget_used FROM agri_s2b2c.s2b2c_flash_sale WHERE id='${budgetFlashId}'`)
      check(Number(flashPrice2) === 38 && Number(flashUsed2) === 1, '秒杀预算耗尽后按原价成交',
        `price=${flashPrice2} used=${flashUsed2}`)
      const marketingAfterFlash = await channelCall('/api/consumer/marketing', { headers: auth })
      check(!(marketingAfterFlash.body?.flashSales ?? []).some((row) =>
        String(row.id) === budgetFlashId), '预算耗尽的秒杀不再对外展示')
    }

    /* 拼团预算：补贴 1 > 预算 0.5 → 拒绝参团且不残留团实例 */
    const groupRes = await (await fetch(`${S2B2C}/api/platform/group-buys`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E低预算团', productId: 3, singlePrice: 38, groupPrice: 37,
        groupSize: 2, perUserLimit: 1, validHours: 24,
        startTime: '2026-01-01 00:00:00', endTime: '2030-12-31 23:59:59',
        budget: 0.5, costBearer: 'CHANNEL' }),
    })).json()
    budgetGroupId = String(groupRes?.id ?? '')
    await addCart3()
    const groupOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: couponAddressId, groupBuyId: budgetGroupId }),
    })
    check(groupOrder.status === 400 && String(groupOrder.body?.message ?? '').includes('预算'),
      '拼团预算不足时拒绝参团', `status=${groupOrder.status} msg=${String(groupOrder.body?.message ?? '').slice(0, 20)}`)
    const groupInstances = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_group_instance WHERE group_buy_id='${budgetGroupId}'`)
    check(groupInstances === '0', '预算不足时团实例随事务回滚', `instances=${groupInstances}`)

    /* 取消订单：库存、券与活动预算回补 */
    const stockBeforeCancel = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3')
    const cancelCouponOrder = await channelCall(`/api/consumer/order/cancel/${couponOrderIdsNow[0]}`, {
      method: 'PUT', headers: auth,
    })
    check(cancelCouponOrder.body?.success === true, '取消待付款订单')
    const couponCancelState = sql(`SELECT CONCAT(o.status,'|',cu.status,'|',c.budget_used)
                                   FROM agri_s2b2c.s2b2c_order o
                                   JOIN agri_s2b2c.s2b2c_coupon_user cu ON cu.id = o.coupon_user_id
                                   JOIN agri_s2b2c.s2b2c_coupon c ON c.id = cu.coupon_id
                                   WHERE o.id = '${couponOrderIdsNow[0]}'`)
    check(couponCancelState === 'CANCELLED|UNUSED|0.00', '取消后券状态与预算回补', couponCancelState)
    const stockAfterCancel = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3')
    check(Number(stockAfterCancel) === Number(stockBeforeCancel) + 1, '取消后商品库存回补',
      `${stockBeforeCancel} → ${stockAfterCancel}`)
    const cancelAgain = await channelCall(`/api/consumer/order/cancel/${couponOrderIdsNow[0]}`, {
      method: 'PUT', headers: auth,
    })
    check(cancelAgain.body?.success === false, '重复取消被拒', String(cancelAgain.body?.message ?? '').slice(0, 20))

    const flashRemainBefore = sql(`SELECT remain_stock FROM agri_s2b2c.s2b2c_flash_sale WHERE id='${budgetFlashId}'`)
    const cancelFlashOrder = await channelCall(`/api/consumer/order/cancel/${flashOrderIds[0]}`, {
      method: 'PUT', headers: auth,
    })
    const flashRemainAfter = sql(`SELECT remain_stock FROM agri_s2b2c.s2b2c_flash_sale WHERE id='${budgetFlashId}'`)
    const flashBudgetAfter = sql(`SELECT budget_used FROM agri_s2b2c.s2b2c_flash_sale WHERE id='${budgetFlashId}'`)
    check(cancelFlashOrder.body?.success === true
      && Number(flashRemainAfter) === Number(flashRemainBefore) + 1
      && Number(flashBudgetAfter) === 0,
      '取消后秒杀库存与预算回补',
      `stock=${flashRemainBefore}→${flashRemainAfter} budget=${flashBudgetAfter}`)

    const successGroup = await (await fetch(`${S2B2C}/api/platform/group-buys`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E回补团', productId: 3, singlePrice: 38, groupPrice: 37,
        groupSize: 2, perUserLimit: 1, validHours: 24,
        startTime: '2026-01-01 00:00:00', endTime: '2030-12-31 23:59:59',
        budget: 5, costBearer: 'PLATFORM' }),
    })).json()
    successGroupId = String(successGroup?.id ?? '')
    await addCart3()
    const groupOk = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: couponAddressId, groupBuyId: successGroupId }),
    })
    const groupOkIds = (groupOk.body?.orderIds ?? []).map(String)
    couponOrderIds.push(...groupOkIds)
    check(groupOk.body?.success === true && groupOkIds.length === 1, '预算内拼团下单成功')
    if (groupOkIds[0]) {
      const groupSubsidy = sql(`SELECT group_subsidy FROM agri_s2b2c.s2b2c_order WHERE id='${groupOkIds[0]}'`)
      const groupBudgetUsed = sql(`SELECT budget_used FROM agri_s2b2c.s2b2c_group_buy WHERE id='${successGroupId}'`)
      check(Number(groupSubsidy) === 1 && Number(groupBudgetUsed) === 1, '拼团补贴与预算扣减',
        `subsidy=${groupSubsidy} used=${groupBudgetUsed}`)
      const groupInstanceId = sql(`SELECT instance_id FROM agri_s2b2c.s2b2c_group_buy_order WHERE order_id='${groupOkIds[0]}' LIMIT 1`)
      const cancelGroupOrder = await channelCall(`/api/consumer/order/cancel/${groupOkIds[0]}`, {
        method: 'PUT', headers: auth,
      })
      const groupBudgetAfter = sql(`SELECT budget_used FROM agri_s2b2c.s2b2c_group_buy WHERE id='${successGroupId}'`)
      const groupMemberStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_group_buy_order WHERE order_id='${groupOkIds[0]}' LIMIT 1`)
      const groupAfter = sql(`SELECT CONCAT(joined_count,'|',status) FROM agri_s2b2c.s2b2c_group_instance WHERE id='${groupInstanceId}'`)
      check(cancelGroupOrder.body?.success === true && Number(groupBudgetAfter) === 0,
        '取消拼团订单回补预算', `used=${groupBudgetAfter}`)
      check(groupMemberStatus === 'CANCELLED' && groupAfter === '0|FAILED',
        '拼团成员与团实例同步取消', `member=${groupMemberStatus} instance=${groupAfter}`)
    }

    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 3`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${couponAddressId}'`)
  }

  /* ---------- 11) 售后退款：全额回补、部分退款、拒绝、佣金冲回 ---------- */
  if (createdConsumerId) {
    const refundAddressId = '990000000000000012'
    const pad = (n) => String(n).padStart(2, '0')
    const dayText = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${refundAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id, consumer_id, name, phone, province, city, district, address, is_default, status)
         VALUES ('${refundAddressId}', '${createdConsumerId}', 'E2E退款', '13800000004', '江苏省', '南京市', '鼓楼区', '退款路 12 号', FALSE, 'ACTIVE')`)
    refundStockSnapshot = {
      1: { stock: sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 1'),
           sales: sql('SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = 1') },
      3: { stock: sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3'),
           sales: sql('SELECT IFNULL(sales,0) FROM agri_s2b2c.s2b2c_product WHERE id = 3') },
    }

    const addRefundCart = async (productId, channelId) => {
      sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = ${productId}`)
      let url = `/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=${productId}&quantity=1`
      if (channelId) url += `&channelId=${channelId}`
      return channelCall(url, { method: 'POST', headers: auth })
    }
    const createPaidOrder = async ({ productId = 3, channelId = null, couponUserId = null } = {}) => {
      await addRefundCart(productId, channelId)
      const body = { addressId: refundAddressId }
      if (couponUserId) body.couponUserId = couponUserId
      const created = await channelCall('/api/consumer/order/create', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const ids = (created.body?.orderIds ?? []).map(String)
      refundOrderIds.push(...ids)
      if (!ids.length) return { created, orderId: null }
      await channelCall(`/api/consumer/order/pay/${ids[0]}`, { method: 'PUT', headers: auth })
      return { created, orderId: ids[0] }
    }
    const applyAfterSale = (orderId, amount) => channelCall('/api/consumer/after-sales', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ consumerId: createdConsumerId, orderId, type: 'REFUND', reason: 'e2e退款', amount }),
    })
    const reviewAfterSale = async (id, status) => (await fetch(
      `${S2B2C}/api/platform/after-sale/review?id=${id}&status=${status}&opinion=e2e`,
      { method: 'PUT', headers: auth })).json()

    /* 全额退款：券预算、库存回补，订单置 REFUNDED */
    const refundCoupon = await (await fetch(`${S2B2C}/api/platform/coupons`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E退款券', type: 'FIXED', amount: 5, minAmount: 1,
        totalCount: 5, perUserLimit: 1, budget: 5, costBearer: 'PLATFORM',
        validStart: dayText(new Date()), validEnd: dayText(new Date(Date.now() + 7 * 86400000)) }),
    })).json()
    const refundCouponId = String(refundCoupon?.id ?? '')
    if (refundCouponId) refundCouponIds.push(refundCouponId)
    await channelCall(`/api/consumer/coupon/receive?consumerId=${createdConsumerId}&couponId=${refundCouponId}`,
      { method: 'POST', headers: auth })
    const refundCouponList = await channelCall(`/api/consumer/coupons?consumerId=${createdConsumerId}`, { headers: auth })
    const refundCouponUser = (refundCouponList.body ?? []).find((row) =>
      String(row.couponId) === refundCouponId && String(row.status).toUpperCase() === 'UNUSED')
    const stock3BeforeRefund = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3')
    const couponPaid = await createPaidOrder({ couponUserId: refundCouponUser?.id })
    const couponPayAmount = couponPaid.orderId
      ? sql(`SELECT pay_amount FROM agri_s2b2c.s2b2c_order WHERE id = '${couponPaid.orderId}'`) : '0'
    check(Boolean(couponPaid.orderId) && sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${couponPaid.orderId}'`) === 'PENDING_SHIP',
      '退款夹具：券订单已支付', `order=${couponPaid.orderId} pay=${couponPayAmount}`)
    const overApply = await applyAfterSale(couponPaid.orderId, Number(couponPayAmount) + 1)
    check(overApply.body?.success === false && String(overApply.body?.message ?? '').includes('超过'),
      '退款金额不能超过实付', String(overApply.body?.message ?? '').slice(0, 20))
    const couponApply = await applyAfterSale(couponPaid.orderId, couponPayAmount)
    check(couponApply.body?.success === true, '提交全额售后退款')
    const afterAppliedNotice = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice
                                   WHERE type='AFTER_SALE_APPLIED' AND ref_id='${couponPaid.orderId}'`)
    const afterAppliedMessage = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_message
                                     WHERE receiver_type='CONSUMER' AND receiver_id='${createdConsumerId}'
                                     AND title='售后申请已提交'`)
    check(Number(afterAppliedNotice) >= 1 && Number(afterAppliedMessage) >= 1,
      '售后申请通知商家与消费者', `notice=${afterAppliedNotice} message=${afterAppliedMessage}`)
    const duplicateApply = await applyAfterSale(couponPaid.orderId, couponPayAmount)
    check(duplicateApply.body?.success === false && String(duplicateApply.body?.message ?? '').includes('已有'),
      '重复提交售后被拒', String(duplicateApply.body?.message ?? '').slice(0, 20))
    const couponAfterSaleId = sql(`SELECT id FROM agri_s2b2c.s2b2c_after_sale
                                   WHERE order_id = '${couponPaid.orderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
    const couponApprove = await reviewAfterSale(couponAfterSaleId, 'APPROVED')
    check(couponApprove?.success === true && couponApprove?.fullRefund === true,
      '平台同意全额退款', JSON.stringify(couponApprove).slice(0, 40))
    const couponRefundState = sql(`SELECT CONCAT(o.status,'|',a.status,'|',cu.status,'|',c.budget_used)
                                   FROM agri_s2b2c.s2b2c_order o
                                   JOIN agri_s2b2c.s2b2c_after_sale a ON a.order_id = o.id
                                   JOIN agri_s2b2c.s2b2c_coupon_user cu ON cu.id = o.coupon_user_id
                                   JOIN agri_s2b2c.s2b2c_coupon c ON c.id = cu.coupon_id
                                   WHERE o.id = '${couponPaid.orderId}'`)
    check(couponRefundState === 'REFUNDED|APPROVED|UNUSED|0.00', '全额退款回补券与预算', couponRefundState)
    const refundMessage = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_message
                               WHERE receiver_type='CONSUMER' AND receiver_id='${createdConsumerId}' AND title='退款已完成'`)
    const refundNotice = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice
                              WHERE type='REFUND_COMPLETED' AND ref_id='${couponPaid.orderId}'`)
    check(Number(refundMessage) >= 1 && Number(refundNotice) >= 1,
      '退款完成通知消费者与商家', `message=${refundMessage} notice=${refundNotice}`)
    const stock3AfterRefund = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3')
    check(Number(stock3AfterRefund) === Number(stock3BeforeRefund), '全额退款恢复商品库存',
      `${stock3BeforeRefund} → ${stock3AfterRefund}`)

    /* 渠道订单退款：待结算佣金冲回 */
    const channelPaid = await createPaidOrder({ productId: 1, channelId: myChannelId })
    const channelCommissionBefore = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${channelPaid.orderId}'`)
    const channelPayAmount = channelPaid.orderId
      ? sql(`SELECT pay_amount FROM agri_s2b2c.s2b2c_order WHERE id = '${channelPaid.orderId}'`) : '0'
    await applyAfterSale(channelPaid.orderId, channelPayAmount)
    const channelAfterSaleId = sql(`SELECT id FROM agri_s2b2c.s2b2c_after_sale
                                    WHERE order_id = '${channelPaid.orderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
    const channelApprove = await reviewAfterSale(channelAfterSaleId, 'APPROVED')
    const channelCommissionAfter = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${channelPaid.orderId}'`)
    const channelOrderStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${channelPaid.orderId}'`)
    check(Number(channelCommissionBefore) === 1 && channelCommissionAfter === '0' && channelOrderStatus === 'REFUNDED'
      && channelApprove?.success === true,
      '渠道订单退款冲回待结算佣金', `commission=${channelCommissionBefore}→${channelCommissionAfter} status=${channelOrderStatus}`)

    /* 秒杀订单全额退款：秒杀库存与预算回补 */
    const refundFlash = await (await fetch(`${S2B2C}/api/platform/flash-sales`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 3, salePrice: 36, totalStock: 10, perUserLimit: 10,
        startTime: '2026-01-01 00:00:00', endTime: '2030-12-31 23:59:59',
        budget: 2, costBearer: 'SUPPLIER' }),
    })).json()
    const refundFlashId = String(refundFlash?.id ?? '')
    if (refundFlashId) refundFlashIds.push(refundFlashId)
    const flashPaid = await createPaidOrder({ productId: 3 })
    const flashItem = flashPaid.orderId
      ? sql(`SELECT IFNULL(flash_sale_id,'') FROM agri_s2b2c.s2b2c_order_item WHERE order_id = '${flashPaid.orderId}' LIMIT 1`) : ''
    const flashPayAmount = flashPaid.orderId
      ? sql(`SELECT pay_amount FROM agri_s2b2c.s2b2c_order WHERE id = '${flashPaid.orderId}'`) : '0'
    await applyAfterSale(flashPaid.orderId, flashPayAmount)
    const flashAfterSaleId = sql(`SELECT id FROM agri_s2b2c.s2b2c_after_sale
                                  WHERE order_id = '${flashPaid.orderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
    await reviewAfterSale(flashAfterSaleId, 'APPROVED')
    const flashRefundState = sql(`SELECT CONCAT(CAST(remain_stock AS CHAR),'|',budget_used)
                                  FROM agri_s2b2c.s2b2c_flash_sale WHERE id = '${refundFlashId}'`)
    check(flashItem === refundFlashId && flashRefundState === '10|0.00', '秒杀订单退款恢复库存与预算', flashRefundState)

    /* 部分退款：只记账，不回补库存/预算 */
    const partialPaid = await createPaidOrder({ productId: 3 })
    const stockBeforePartial = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3')
    await applyAfterSale(partialPaid.orderId, 1)
    const partialAfterSaleId = sql(`SELECT id FROM agri_s2b2c.s2b2c_after_sale
                                    WHERE order_id = '${partialPaid.orderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
    const partialApprove = await reviewAfterSale(partialAfterSaleId, 'APPROVED')
    const partialStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${partialPaid.orderId}'`)
    const stockAfterPartial = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 3')
    check(partialApprove?.success === true && partialApprove?.fullRefund === false
      && partialStatus === 'PENDING_SHIP' && Number(stockAfterPartial) === Number(stockBeforePartial),
      '部分退款不改订单状态与库存', `order=${partialStatus} stock=${stockBeforePartial}→${stockAfterPartial}`)

    /* 拒绝售后：订单与库存不变 */
    const rejectedPaid = await createPaidOrder({ productId: 3 })
    const rejectedPayAmount = sql(`SELECT pay_amount FROM agri_s2b2c.s2b2c_order WHERE id = '${rejectedPaid.orderId}'`)
    const rejectedApply = await applyAfterSale(rejectedPaid.orderId, rejectedPayAmount)
    const rejectedAfterSaleId = sql(`SELECT id FROM agri_s2b2c.s2b2c_after_sale
                                     WHERE order_id = '${rejectedPaid.orderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
    const rejectedReview = rejectedAfterSaleId
      ? await reviewAfterSale(rejectedAfterSaleId, 'REJECTED') : { success: false, message: 'no after-sale id' }
    const rejectedState = sql(`SELECT CONCAT((SELECT status FROM agri_s2b2c.s2b2c_after_sale WHERE id='${rejectedAfterSaleId}'),
                                             '|',(SELECT status FROM agri_s2b2c.s2b2c_order WHERE id='${rejectedPaid.orderId}'))`)
    check(rejectedReview?.success === true && rejectedState === 'REJECTED|PENDING_SHIP',
      '拒绝售后不改订单状态',
      `${rejectedState} order=${rejectedPaid.orderId} apply=${JSON.stringify(rejectedApply.body).slice(0, 60)}`)
    const rejectMessage = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_message
                               WHERE receiver_type='CONSUMER' AND receiver_id='${createdConsumerId}' AND title='售后已拒绝'`)
    const rejectNotice = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice
                              WHERE type='AFTER_SALE_REJECTED' AND ref_id='${rejectedPaid.orderId}'`)
    check(Number(rejectMessage) >= 1 && Number(rejectNotice) >= 1,
      '拒绝售后通知消费者与商家', `message=${rejectMessage} notice=${rejectNotice}`)

    /* 待付款订单不能申请售后 */
    await addRefundCart(3)
    const unpaid = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: refundAddressId }),
    })
    const unpaidIds = (unpaid.body?.orderIds ?? []).map(String)
    refundOrderIds.push(...unpaidIds)
    if (unpaidIds[0]) {
      const unpaidApply = await applyAfterSale(unpaidIds[0], 38)
      // 拒绝原因现在直接说出卡在哪一档（原来是"当前订单状态不可申请售后"，等于什么都没说）
      check(unpaidApply.body?.success === false
        && String(unpaidApply.body?.message ?? '').includes('待付款'),
        '待付款订单不能申请售后', String(unpaidApply.body?.message ?? '').slice(0, 24))
    }

    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id IN (1,3)`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${refundAddressId}'`)
  }

  /* ---------- 12) 渠道等级自动考核 ---------- */
  if (myChannelId && createdConsumerId) {
    const gradeAddressId = '990000000000000013'
    gradeOriginal = sql(`SELECT grade FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${myChannelId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${gradeAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id, consumer_id, name, phone, province, city, district, address, is_default, status)
         VALUES ('${gradeAddressId}', '${createdConsumerId}', 'E2E等级', '13800000005', '江苏省', '南京市', '鼓楼区', '等级路 13 号', FALSE, 'ACTIVE')`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=1&quantity=1&channelId=${myChannelId}`,
      { method: 'POST', headers: auth })
    const gradeOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: gradeAddressId }),
    })
    const gradeOrderIds = (gradeOrder.body?.orderIds ?? []).map(String)
    refundOrderIds.push(...gradeOrderIds)
    if (gradeOrderIds[0]) {
      await channelCall(`/api/consumer/order/pay/${gradeOrderIds[0]}`, { method: 'PUT', headers: auth })
    }
    check(Boolean(gradeOrderIds[0]), '等级考核夹具：渠道订单已支付', `order=${gradeOrderIds[0]}`)

    const setGrade = async (grade) => (await fetch(
      `${S2B2C}/api/platform/channel-partner/${myChannelId}/grade?grade=${grade}`,
      { method: 'PUT', headers: auth })).json()
    const saveGrade = async (body) => (await fetch(`${S2B2C}/api/platform/grade-rule`, {
      method: 'PUT', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })).json()
    await setGrade('LEVEL_1')
    await saveGrade({ grade: 'LEVEL_1', minOrders: 0, minGmv: 0, status: 'ACTIVE', remark: 'e2e' })
    await saveGrade({ grade: 'LEVEL_2', minOrders: 1, minGmv: 1, status: 'ACTIVE', remark: 'e2e' })
    await saveGrade({ grade: 'LEVEL_3', minOrders: 99999, minGmv: 999999, status: 'ACTIVE', remark: 'e2e' })
    const evalUp = await (await fetch(`${S2B2C}/api/platform/channel-grades/evaluate?days=365&channelId=${myChannelId}`, {
      method: 'POST', headers: auth,
    })).json()
    const gradeAfterUp = sql(`SELECT grade FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${myChannelId}'`)
    const gradeLogs = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_grade_change_log WHERE channel_id = '${myChannelId}'`)
    const gradeNotices = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice
                              WHERE type = 'GRADE_CHANGED' AND ref_id = '${myChannelId}'`)
    check(evalUp?.success === true && Number(evalUp?.changed) >= 1 && gradeAfterUp === 'LEVEL_2',
      '等级考核按订单与 GMV 升级', `${evalUp?.message} grade=${gradeAfterUp}`)
    check(Number(gradeLogs) >= 1 && Number(gradeNotices) >= 1, '等级变更留痕并通知渠道',
      `logs=${gradeLogs} notices=${gradeNotices}`)
    const evalAgain = await (await fetch(`${S2B2C}/api/platform/channel-grades/evaluate?days=365&channelId=${myChannelId}`, {
      method: 'POST', headers: auth,
    })).json()
    const gradeLogsAgain = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_grade_change_log WHERE channel_id = '${myChannelId}'`)
    check(evalAgain?.success === true && Number(evalAgain?.changed) === 0 && Number(gradeLogsAgain) === Number(gradeLogs),
      '重复考核幂等', `changed=${evalAgain?.changed}`)

    await saveGrade({ grade: 'LEVEL_2', minOrders: 99999, minGmv: 999999, status: 'ACTIVE', remark: 'e2e' })
    const evalDown = await (await fetch(`${S2B2C}/api/platform/channel-grades/evaluate?days=365&channelId=${myChannelId}`, {
      method: 'POST', headers: auth,
    })).json()
    const gradeAfterDown = sql(`SELECT grade FROM agri_s2b2c.s2b2c_channel_partner WHERE id = '${myChannelId}'`)
    const gradeLogsDown = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_grade_change_log WHERE channel_id = '${myChannelId}'`)
    check(evalDown?.success === true && gradeAfterDown === 'LEVEL_1' && Number(gradeLogsDown) === Number(gradeLogs) + 1,
      '等级考核触发降级并留痕', `grade=${gradeAfterDown} logs=${gradeLogsDown}`)
    const gradeHistory = await channelCall('/api/channel/grade-history?days=365', { headers: auth })
    check(gradeHistory.body?.currentGrade === 'LEVEL_1' && (gradeHistory.body?.changes ?? []).length >= 2,
      '渠道端可查看等级考核历史', `changes=${(gradeHistory.body?.changes ?? []).length}`)

    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${gradeAddressId}'`)
  }

  /* ---------- 13) 超时未支付订单自动取消 ---------- */
  if (createdConsumerId && myChannelId) {
    const expireAddressId = '990000000000000014'
    const pad = (n) => String(n).padStart(2, '0')
    const dayText = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${expireAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id,consumer_id,name,phone,province,city,district,address,is_default,status)
         VALUES ('${expireAddressId}','${createdConsumerId}','E2E超时','13800000006','江苏省','南京市','鼓楼区','超时路 14 号',FALSE,'ACTIVE')`)
    const expireCoupon = await (await fetch(`${S2B2C}/api/platform/coupons`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E超时券', type: 'FIXED', amount: 5, minAmount: 1,
        totalCount: 5, perUserLimit: 1, budget: 5, costBearer: 'PLATFORM',
        validStart: dayText(new Date()), validEnd: dayText(new Date(Date.now() + 7 * 86400000)) }),
    })).json()
    const expireCouponId = String(expireCoupon?.id ?? '')
    if (expireCouponId) couponIds.push(expireCouponId)
    await channelCall(`/api/consumer/coupon/receive?consumerId=${createdConsumerId}&couponId=${expireCouponId}`,
      { method: 'POST', headers: auth })
    const expireCoupons = await channelCall(`/api/consumer/coupons?consumerId=${createdConsumerId}`, { headers: auth })
    const expireCouponUser = (expireCoupons.body ?? []).find((row) =>
      String(row.couponId) === expireCouponId && String(row.status).toUpperCase() === 'UNUSED')

    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=1&quantity=1&channelId=${myChannelId}`,
      { method: 'POST', headers: auth })
    const stockBeforeExpire = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 1')
    const expireOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: expireAddressId, couponUserId: expireCouponUser?.id }),
    })
    const expireOrderIds = (expireOrder.body?.orderIds ?? []).map(String)
    couponOrderIds.push(...expireOrderIds)
    const expireOrderId = expireOrderIds[0]
    const expireOrderNo = expireOrderId
      ? sql(`SELECT order_no FROM agri_s2b2c.s2b2c_order WHERE id = '${expireOrderId}'`) : ''
    check(Boolean(expireOrderId), '超时取消夹具：待付款订单已创建', expireOrderNo)
    if (expireOrderId) {
      sql(`UPDATE agri_s2b2c.s2b2c_order SET create_time = DATE_SUB(NOW(), INTERVAL 60 MINUTE)
           WHERE id = '${expireOrderId}'`)
      const expired = await (await fetch(`${S2B2C}/api/platform/orders/expire-unpaid?minutes=30`, {
        method: 'POST', headers: auth,
      })).json()
      const expireState = sql(`SELECT CONCAT(o.status,'|',cu.status,'|',c.budget_used)
                               FROM agri_s2b2c.s2b2c_order o
                               JOIN agri_s2b2c.s2b2c_coupon_user cu ON cu.id = o.coupon_user_id
                               JOIN agri_s2b2c.s2b2c_coupon c ON c.id = cu.coupon_id
                               WHERE o.id = '${expireOrderId}'`)
      check(expired?.success === true && Number(expired?.cancelled) >= 1
        && expireState === 'CANCELLED|UNUSED|0.00', '超时订单自动取消并回补券与预算', expireState)
      const stockAfterExpire = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 1')
      const expireCommission = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${expireOrderId}'`)
      check(Number(stockAfterExpire) === Number(stockBeforeExpire) && expireCommission === '0',
        '超时取消恢复库存并清理待结算佣金', `stock=${stockBeforeExpire}→${stockAfterExpire}`)
      const consumerMessage = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_message
                                   WHERE receiver_type = 'CONSUMER' AND receiver_id = '${createdConsumerId}'
                                   AND title = '订单已取消' AND content LIKE '%${expireOrderNo}%'`)
      const cancelNotices = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice
                                 WHERE type = 'ORDER_CANCELLED' AND ref_id = '${expireOrderId}'`)
      check(Number(consumerMessage) >= 1 && Number(cancelNotices) >= 2, '超时取消通知消费者与供货方',
        `message=${consumerMessage} notice=${cancelNotices}`)
      const expiredAgain = await (await fetch(`${S2B2C}/api/platform/orders/expire-unpaid?minutes=30`, {
        method: 'POST', headers: auth,
      })).json()
      check(expiredAgain?.success === true && Number(expiredAgain?.cancelled) === 0,
        '超时取消幂等（已取消订单不再处理）', `cancelled=${expiredAgain?.cancelled}`)
    }
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${expireAddressId}'`)
  }

  /* ---------- 14) 发货后自动确认收货 ---------- */
  if (createdConsumerId && myChannelId) {
    const autoAddressId = '990000000000000015'
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${autoAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id,consumer_id,name,phone,province,city,district,address,is_default,status)
         VALUES ('${autoAddressId}','${createdConsumerId}','E2E自动收货','13800000007','江苏省','南京市','鼓楼区','自动收货路 15 号',FALSE,'ACTIVE')`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=1&quantity=1&channelId=${myChannelId}`,
      { method: 'POST', headers: auth })
    const autoOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: autoAddressId }),
    })
    const autoOrderIds = (autoOrder.body?.orderIds ?? []).map(String)
    couponOrderIds.push(...autoOrderIds)
    const autoOrderId = autoOrderIds[0]
    channelCompletedOrderId = autoOrderId || ''
    const autoOrderNo = autoOrderId
      ? sql(`SELECT order_no FROM agri_s2b2c.s2b2c_order WHERE id = '${autoOrderId}'`) : ''
    check(Boolean(autoOrderId), '自动收货夹具：订单已创建', autoOrderNo)
    if (autoOrderId) {
      await call(`/api/consumer/order/pay/${autoOrderId}`, { method: 'PUT', headers: auth })
      await shipOrder(autoOrderId, 'AUTO')
      const shipped = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${autoOrderId}'`)
      check(shipped === 'SHIPPED', '自动收货夹具：订单已发货', shipped)
      sql(`UPDATE agri_s2b2c.s2b2c_order SET update_time = DATE_SUB(NOW(), INTERVAL 30 DAY)
           WHERE id = '${autoOrderId}'`)
      const autoResult = await (await fetch(`${S2B2C}/api/platform/orders/auto-complete?days=7`, {
        method: 'POST', headers: auth,
      })).json()
      const completedStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${autoOrderId}'`)
      check(autoResult?.success === true && Number(autoResult?.completed) >= 1 && completedStatus === 'COMPLETED',
        '超时未收货订单自动完成', `status=${completedStatus} completed=${autoResult?.completed}`)
      const autoMessage = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_message
                               WHERE receiver_type = 'CONSUMER' AND receiver_id = '${createdConsumerId}'
                               AND title = '订单已自动确认收货' AND content LIKE '%${autoOrderNo}%'`)
      const completeNotices = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice
                                   WHERE type = 'ORDER_COMPLETED' AND ref_id = '${autoOrderId}'`)
      check(Number(autoMessage) >= 1 && Number(completeNotices) >= 2, '自动收货通知消费者与供货方',
        `message=${autoMessage} notice=${completeNotices}`)
      const autoAgain = await (await fetch(`${S2B2C}/api/platform/orders/auto-complete?days=7`, {
        method: 'POST', headers: auth,
      })).json()
      check(autoAgain?.success === true && Number(autoAgain?.completed) === 0,
        '自动确认收货幂等（已完成订单不再处理）', `completed=${autoAgain?.completed}`)
    }
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${autoAddressId}'`)
  }

  /* ---------- 15) 退货退款：同意退货 → 买家寄回 → 商家确认收货退款 ---------- */
  if (createdConsumerId && myChannelId) {
    const returnAddressId = '990000000000000016'
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${returnAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id,consumer_id,name,phone,province,city,district,address,is_default,status)
         VALUES ('${returnAddressId}','${createdConsumerId}','E2E退货','13800000008','江苏省','南京市','鼓楼区','退货路 16 号',FALSE,'ACTIVE')`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=1&quantity=1&channelId=${myChannelId}`,
      { method: 'POST', headers: auth })
    const stockBeforeReturn = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 1')
    const returnOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: returnAddressId }),
    })
    const returnOrderIds = (returnOrder.body?.orderIds ?? []).map(String)
    refundOrderIds.push(...returnOrderIds)
    const returnOrderId = returnOrderIds[0]
    check(Boolean(returnOrderId), '退货夹具：订单已创建', returnOrderId)
    if (returnOrderId) {
      await channelCall(`/api/consumer/order/pay/${returnOrderId}`, { method: 'PUT', headers: auth })
      const returnPay = sql(`SELECT pay_amount FROM agri_s2b2c.s2b2c_order WHERE id = '${returnOrderId}'`)
      const applyReturn = await channelCall('/api/consumer/after-sales', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: createdConsumerId, orderId: returnOrderId,
          type: 'RETURN', reason: 'e2e退货', amount: returnPay }),
      })
      const returnAfterSaleId = sql(`SELECT id FROM agri_s2b2c.s2b2c_after_sale
                                    WHERE order_id = '${returnOrderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
      check(applyReturn.body?.success === true && Boolean(returnAfterSaleId), '提交退货退款申请')
      const approveReturn = await (await fetch(
        `${S2B2C}/api/platform/after-sale/review?id=${returnAfterSaleId}&status=APPROVED&opinion=e2e同意退货`,
        { method: 'PUT', headers: auth })).json()
      const afterApprove = sql(`SELECT status FROM agri_s2b2c.s2b2c_after_sale WHERE id = '${returnAfterSaleId}'`)
      const orderAfterApprove = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${returnOrderId}'`)
      check(approveReturn?.success === true && afterApprove === 'RETURNING' && orderAfterApprove === 'PENDING_SHIP',
        '同意退货后等待买家寄回、订单未立即退款', `${afterApprove}/${orderAfterApprove}`)
      const earlyConfirm = await (await fetch(
        `${S2B2C}/api/platform/after-sale/${returnAfterSaleId}/confirm-return?opinion=e2e`,
        { method: 'PUT', headers: auth })).json()
      check(earlyConfirm?.success === false && String(earlyConfirm?.message ?? '').includes('尚未'),
        '买家未寄回前不能确认收货', String(earlyConfirm?.message ?? '').slice(0, 20))
      const submitReturn = await channelCall(
        `/api/consumer/after-sales/${returnAfterSaleId}/return?company=顺丰&logisticsNo=RET${Date.now()}`,
        { method: 'PUT', headers: auth })
      const returnInfo = sql(`SELECT CONCAT(IFNULL(return_company,''),'|',IFNULL(return_logistics_no,''),'|',
                                              IFNULL(return_shipped_at,'')) FROM agri_s2b2c.s2b2c_after_sale
                              WHERE id = '${returnAfterSaleId}'`)
      check(submitReturn.body?.success === true && returnInfo.split('|')[1].length > 0,
        '买家提交退货物流', returnInfo)
      const returnShippedNotice = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice
                                       WHERE type='RETURN_SHIPPED' AND ref_id='${returnOrderId}'`)
      check(Number(returnShippedNotice) >= 1, '买家寄回后通知商家', `notice=${returnShippedNotice}`)
      const confirmReturn = await (await fetch(
        `${S2B2C}/api/platform/after-sale/${returnAfterSaleId}/confirm-return?opinion=e2e已收到`,
        { method: 'PUT', headers: auth })).json()
      const returnFinal = sql(`SELECT CONCAT(a.status,'|',o.status) FROM agri_s2b2c.s2b2c_after_sale a
                               JOIN agri_s2b2c.s2b2c_order o ON o.id = a.order_id
                               WHERE a.id = '${returnAfterSaleId}'`)
      const stockAfterReturn = sql('SELECT stock FROM agri_s2b2c.s2b2c_product WHERE id = 1')
      const returnCommission = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${returnOrderId}'`)
      check(confirmReturn?.success === true && confirmReturn?.fullRefund === true
        && returnFinal === 'COMPLETED|REFUNDED'
        && Number(stockAfterReturn) === Number(stockBeforeReturn) && returnCommission === '0',
        '商家确认收货后退款并回补库存/佣金',
        `${returnFinal} stock=${stockBeforeReturn}→${stockAfterReturn} commission=${returnCommission}`)
      const returnRefundMsg = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_message
                                   WHERE receiver_type='CONSUMER' AND receiver_id='${createdConsumerId}'
                                   AND title='退款已完成'`)
      const returnRefundNotice = sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_notice
                                      WHERE type='REFUND_COMPLETED' AND ref_id='${returnOrderId}'`)
      check(Number(returnRefundMsg) >= 1 && Number(returnRefundNotice) >= 1,
        '退货退款完成通知消费者与商家', `message=${returnRefundMsg} notice=${returnRefundNotice}`)
    }
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${returnAddressId}'`)
  }

  /* ---------- 16) 已结算佣金的退款冲回 ---------- */
  if (createdConsumerId && myChannelId) {
    const settledAddressId = '990000000000000017'
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${settledAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id,consumer_id,name,phone,province,city,district,address,is_default,status)
         VALUES ('${settledAddressId}','${createdConsumerId}','E2E冲回','13800000009','江苏省','南京市','鼓楼区','冲回路 17 号',FALSE,'ACTIVE')`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=1&quantity=1&channelId=${myChannelId}`,
      { method: 'POST', headers: auth })
    const settledOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: settledAddressId }),
    })
    const settledOrderIds = (settledOrder.body?.orderIds ?? []).map(String)
    refundOrderIds.push(...settledOrderIds)
    const settledOrderId = settledOrderIds[0]
    check(Boolean(settledOrderId), '佣金冲回夹具：订单已创建', settledOrderId)
    if (settledOrderId) {
      await call(`/api/consumer/order/pay/${settledOrderId}`, { method: 'PUT', headers: auth })
      await shipOrder(settledOrderId, 'SETTLE')
      await call(`/api/consumer/order/receive/${settledOrderId}`, { method: 'PUT', headers: auth })
      const settle = await (await fetch(`${S2B2C}/api/platform/commission/settlement`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: String(myChannelId) }),
      })).json()
      const originalSettled = sql(`SELECT CONCAT(status,'|',amount) FROM agri_s2b2c.s2b2c_commission
                                   WHERE order_id = '${settledOrderId}' AND amount > 0 LIMIT 1`)
      check(settle?.success === true && originalSettled.startsWith('SETTLED|'),
        '佣金冲回夹具：佣金已结算', originalSettled)
      const settledPay = sql(`SELECT pay_amount FROM agri_s2b2c.s2b2c_order WHERE id = '${settledOrderId}'`)
      await channelCall('/api/consumer/after-sales', {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: createdConsumerId, orderId: settledOrderId,
          type: 'REFUND', reason: 'e2e结算后退款', amount: settledPay }),
      })
      const refundAfterSaleId = sql(`SELECT id FROM agri_s2b2c.s2b2c_after_sale
                                     WHERE order_id = '${settledOrderId}' ORDER BY create_time DESC, id DESC LIMIT 1`)
      await fetch(`${S2B2C}/api/platform/after-sale/review?id=${refundAfterSaleId}&status=APPROVED&opinion=e2e冲回`,
        { method: 'PUT', headers: auth })
      const commissionRows = sql(`SELECT COUNT(*), IFNULL(SUM(amount),0), SUM(amount < 0), MAX(remark)
                                  FROM agri_s2b2c.s2b2c_commission WHERE order_id = '${settledOrderId}'`)
      const [rowCount, netAmount, negativeCount, remark] = commissionRows.split('\t')
      const reversalOrderStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_order WHERE id = '${settledOrderId}'`)
      check(Number(rowCount) === 2 && Number(netAmount) === 0 && Number(negativeCount) === 1
        && String(remark) === '退款冲回' && reversalOrderStatus === 'REFUNDED',
        '已结算佣金退款生成负向冲回并抵消', `rows=${rowCount} net=${netAmount} remark=${remark}`)
      // 这次结算同样生成了批次，按批次号删掉 —— 不按 channel_id 删（19 位 id 一旦走过 Number 就丢精度，
      // 用错值就是"脚本说清理干净了、库里还留着"，本轮实测到过一条残留）
      if (settle?.batchNo) {
        sql(`DELETE FROM agri_s2b2c.s2b2c_commission_settlement WHERE batch_no = '${settle.batchNo}'`)
      }
    }
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 1`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${settledAddressId}'`)
  }

  /* ---------- 17) 营销活动状态生命周期 ---------- */
  if (createdConsumerId) {
    const pad = (n) => String(n).padStart(2, '0')
    const dayText = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    const dateTimeText = (date) => `${dayText(date)} ${pad(date.getHours())}:${pad(date.getMinutes())}:00`
    const yesterday = new Date(Date.now() - 86400000)
    const tomorrow = new Date(Date.now() + 86400000)
    const dayAfter = new Date(Date.now() + 2 * 86400000)
    const expiredCoupon = await (await fetch(`${S2B2C}/api/platform/coupons`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E过期券', type: 'FIXED', amount: 5, minAmount: 1,
        totalCount: 5, perUserLimit: 1,
        validStart: dayText(yesterday), validEnd: dayText(yesterday) }),
    })).json()
    const expiredCouponId = String(expiredCoupon?.id ?? '')
    if (expiredCouponId) couponIds.push(expiredCouponId)
    const marketing = await channelCall('/api/consumer/marketing', { headers: auth })
    check(!(marketing.body?.coupons ?? []).some((row) => String(row.id) === expiredCouponId),
      '过期优惠券不出现在消费者营销列表')
    const receiveExpired = await channelCall(
      `/api/consumer/coupon/receive?consumerId=${createdConsumerId}&couponId=${expiredCouponId}`,
      { method: 'POST', headers: auth })
    check(receiveExpired.body?.success === false, '过期优惠券不能领取',
      String(receiveExpired.body?.message ?? '').slice(0, 20))
    const sync = await (await fetch(`${S2B2C}/api/platform/marketing/sync-status`, {
      method: 'POST', headers: auth,
    })).json()
    const couponStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_coupon WHERE id = '${expiredCouponId}'`)
    check(sync?.success === true && couponStatus === 'ENDED', '状态同步将过期券置为结束', couponStatus)

    const futureFlash = await (await fetch(`${S2B2C}/api/platform/flash-sales`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId: 3, salePrice: 30, totalStock: 5, perUserLimit: 1,
        startTime: dateTimeText(tomorrow), endTime: dateTimeText(dayAfter) }),
    })).json()
    lifecycleFlashId = String(futureFlash?.id ?? '')
    const futureFlashStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_flash_sale WHERE id = '${lifecycleFlashId}'`)
    check(futureFlash?.success === true && futureFlashStatus === 'UPCOMING', '未来秒杀初始为未开始', futureFlashStatus)
    sql(`UPDATE agri_s2b2c.s2b2c_flash_sale SET start_time = DATE_SUB(NOW(), INTERVAL 1 HOUR),
         end_time = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = '${lifecycleFlashId}'`)
    await fetch(`${S2B2C}/api/platform/marketing/sync-status`, { method: 'POST', headers: auth })
    const activeFlashStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_flash_sale WHERE id = '${lifecycleFlashId}'`)
    const marketingFlash = await channelCall('/api/consumer/marketing', { headers: auth })
    check(activeFlashStatus === 'ACTIVE'
      && (marketingFlash.body?.flashSales ?? []).some((row) => String(row.id) === lifecycleFlashId),
      '状态同步开始秒杀并进入营销列表', activeFlashStatus)
    sql(`UPDATE agri_s2b2c.s2b2c_flash_sale SET end_time = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
         WHERE id = '${lifecycleFlashId}'`)
    await fetch(`${S2B2C}/api/platform/marketing/sync-status`, { method: 'POST', headers: auth })
    const endedFlashStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_flash_sale WHERE id = '${lifecycleFlashId}'`)
    const marketingFlashAfter = await channelCall('/api/consumer/marketing', { headers: auth })
    check(endedFlashStatus === 'ENDED'
      && !(marketingFlashAfter.body?.flashSales ?? []).some((row) => String(row.id) === lifecycleFlashId),
      '状态同步结束秒杀并移出营销列表', endedFlashStatus)

    const futureGroup = await (await fetch(`${S2B2C}/api/platform/group-buys`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'E2E状态拼团', productId: 3, singlePrice: 38, groupPrice: 37,
        groupSize: 2, perUserLimit: 1, validHours: 24,
        startTime: dateTimeText(tomorrow), endTime: dateTimeText(dayAfter) }),
    })).json()
    lifecycleGroupId = String(futureGroup?.id ?? '')
    sql(`UPDATE agri_s2b2c.s2b2c_group_buy SET start_time = DATE_SUB(NOW(), INTERVAL 1 HOUR),
         end_time = DATE_ADD(NOW(), INTERVAL 1 HOUR) WHERE id = '${lifecycleGroupId}'`)
    await fetch(`${S2B2C}/api/platform/marketing/sync-status`, { method: 'POST', headers: auth })
    const activeGroupStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_group_buy WHERE id = '${lifecycleGroupId}'`)
    sql(`UPDATE agri_s2b2c.s2b2c_group_buy SET end_time = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
         WHERE id = '${lifecycleGroupId}'`)
    await fetch(`${S2B2C}/api/platform/marketing/sync-status`, { method: 'POST', headers: auth })
    const endedGroupStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_group_buy WHERE id = '${lifecycleGroupId}'`)
    const marketingGroups = await channelCall('/api/consumer/marketing', { headers: auth })
    check(futureGroup?.success === true && activeGroupStatus === 'ACTIVE' && endedGroupStatus === 'ENDED'
      && !(marketingGroups.body?.groupBuys ?? []).some((row) => String(row.id) === lifecycleGroupId),
      '拼团按时间窗开始/结束并移出营销列表', `${activeGroupStatus}→${endedGroupStatus}`)
  }

  /* ---------- 18) 供货价快照：调价不影响历史收入 ---------- */
  if (createdConsumerId && ownProductId && ownSupplierId) {
    const snapshotAddressId = '990000000000000018'
    const pad = (n) => String(n).padStart(2, '0')
    const now = new Date()
    const month = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${snapshotAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id,consumer_id,name,phone,province,city,district,address,is_default,status)
         VALUES ('${snapshotAddressId}','${createdConsumerId}','E2E快照','13800000010','江苏省','南京市','鼓楼区','快照路 18 号',FALSE,'ACTIVE')`)
    sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = 10, price = 1 WHERE id = '${ownProductId}'`)
    const revenueBefore = await channelCall(`/api/supplier/revenue?month=${month}`, { headers: auth })
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = '${ownProductId}'`)
    await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=${ownProductId}&quantity=1`,
      { method: 'POST', headers: auth })
    const snapshotOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: snapshotAddressId }),
    })
    const snapshotOrderIds = (snapshotOrder.body?.orderIds ?? []).map(String)
    refundOrderIds.push(...snapshotOrderIds)
    const snapshotOrderId = snapshotOrderIds[0]
    const supplySnapshot = snapshotOrderId
      ? sql(`SELECT IFNULL(supply_price,'') FROM agri_s2b2c.s2b2c_order_item
             WHERE order_id = '${snapshotOrderId}' LIMIT 1`) : ''
    check(Boolean(snapshotOrderId) && Number(supplySnapshot) === 1,
      '下单时写入供货价快照', `order=${snapshotOrderId} supply=${supplySnapshot}`)
    const revenueAfterOrder = await channelCall(`/api/supplier/revenue?month=${month}`, { headers: auth })
    sql(`UPDATE agri_s2b2c.s2b2c_product SET price = 999 WHERE id = '${ownProductId}'`)
    const revenueAfterPrice = await channelCall(`/api/supplier/revenue?month=${month}`, { headers: auth })
    const before = Number(revenueBefore.body?.summary?.supplyRevenue || 0)
    const afterOrder = Number(revenueAfterOrder.body?.summary?.supplyRevenue || 0)
    const afterPrice = Number(revenueAfterPrice.body?.summary?.supplyRevenue || 0)
    check(afterOrder - before === 1 && afterPrice === afterOrder,
      '供应商收入按下单快照计算，不受调价影响', `${before}→${afterOrder}→${afterPrice}`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = '${ownProductId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${snapshotAddressId}'`)
  }

  /* ---------- 19) 供应商供货对账单 ---------- */
  if (createdConsumerId && ownProductId && ownSupplierId) {
    const statementAddressId = '990000000000000019'
    const pad = (n) => String(n).padStart(2, '0')
    const today = new Date()
    const day = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`
    sql(`DELETE FROM agri_s2b2c.s2b2c_supplier_statement_order WHERE statement_id IN
         (SELECT id FROM agri_s2b2c.s2b2c_supplier_statement WHERE supplier_id = '${ownSupplierId}')`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_supplier_statement WHERE supplier_id = '${ownSupplierId}'`)
    sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = 10, price = 1 WHERE id = '${ownProductId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${statementAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id,consumer_id,name,phone,province,city,district,address,is_default,status)
         VALUES ('${statementAddressId}','${createdConsumerId}','E2E对账','13800000011','江苏省','南京市','鼓楼区','对账路 19 号',FALSE,'ACTIVE')`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = '${ownProductId}'`)
    await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=${ownProductId}&quantity=1`,
      { method: 'POST', headers: auth })
    const statementOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: statementAddressId }),
    })
    const statementOrderIds = (statementOrder.body?.orderIds ?? []).map(String)
    refundOrderIds.push(...statementOrderIds)
    const statementOrderId = statementOrderIds[0]
    supplierCompletedOrderId = statementOrderId || ''
    const statementOrderNo = statementOrderId
      ? sql(`SELECT order_no FROM agri_s2b2c.s2b2c_order WHERE id = '${statementOrderId}'`) : ''
    if (statementOrderId) {
      await channelCall(`/api/consumer/order/pay/${statementOrderId}`, { method: 'PUT', headers: auth })
      await fetch(`${S2B2C}/api/platform/order/ship?id=${statementOrderId}&logisticsNo=STMT${Date.now()}&company=顺丰`,
        { method: 'PUT', headers: auth })
      await channelCall(`/api/consumer/order/receive/${statementOrderId}`, { method: 'PUT', headers: auth })
    }
    const generated = await (await fetch(`${S2B2C}/api/platform/supplier-statements/generate`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId: String(ownSupplierId), periodStart: day, periodEnd: day }),
    })).json()
    supplierStatementId = String(generated?.id ?? '')
    check(generated?.success === true && Number(generated?.orderCount) >= 1 && Number(generated?.amount) >= 1,
      '平台按已完成订单生成供货对账单',
      `id=${supplierStatementId} count=${generated?.orderCount} amount=${generated?.amount}`)
    const duplicate = await (await fetch(`${S2B2C}/api/platform/supplier-statements/generate`, {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId: String(ownSupplierId), periodStart: day, periodEnd: day }),
    })).json()
    check(duplicate?.success === true && duplicate?.existing === true
      && String(duplicate?.id) === supplierStatementId, '同账期重复生成返回已有对账单')
    const statementDetail = await channelCall(`/api/supplier/statement/${supplierStatementId}`, { headers: auth })
    check(statementDetail.status === 200
      && (statementDetail.body?.orders ?? []).some((row) => String(row.orderNo) === statementOrderNo),
      '供应商可查看对账明细', `orders=${(statementDetail.body?.orders ?? []).length}`)
    const confirmStatement = await channelCall(`/api/supplier/statement/${supplierStatementId}/confirm?remark=e2e确认`,
      { method: 'PUT', headers: auth })
    const statementStatus = sql(`SELECT status FROM agri_s2b2c.s2b2c_supplier_statement WHERE id = '${supplierStatementId}'`)
    check(confirmStatement.body?.success === true && statementStatus === 'CONFIRMED',
      '供应商确认对账单', statementStatus)
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = '${ownProductId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${statementAddressId}'`)
  }

  /* ---------- 20) 评价：完成订单才能评价、商家回复、平台隐藏 ---------- */
  if (createdConsumerId && myChannelId && ownProductId && ownSupplierId
      && supplierCompletedOrderId && channelCompletedOrderId) {
    const reviewAddressId = '990000000000000020'
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${reviewAddressId}'`)
    sql(`INSERT INTO agri_s2b2c.s2b2c_address
         (id,consumer_id,name,phone,province,city,district,address,is_default,status)
         VALUES ('${reviewAddressId}','${createdConsumerId}','E2E评价','13800000012','江苏省','南京市','鼓楼区','评价路 20 号',FALSE,'ACTIVE')`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = '${ownProductId}'`)
    await channelCall(`/api/consumer/cart/add?consumerId=${createdConsumerId}&productId=${ownProductId}&quantity=1`,
      { method: 'POST', headers: auth })
    const unpaidReviewOrder = await channelCall('/api/consumer/order/create', {
      method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ addressId: reviewAddressId }),
    })
    const unpaidReviewOrderIds = (unpaidReviewOrder.body?.orderIds ?? []).map(String)
    refundOrderIds.push(...unpaidReviewOrderIds)
    const unpaidReviewOrderId = unpaidReviewOrderIds[0]
    check(Boolean(unpaidReviewOrderId), '评价夹具：待付款订单已创建', unpaidReviewOrderId)

    const createReview = async (orderId, productId, rating, content, anonymous = false) => {
      const response = await fetch(`${S2B2C}/api/consumer/reviews`, {
        method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
        body: JSON.stringify({ consumerId: createdConsumerId, orderId, productId, rating, content, anonymous }),
      })
      return { status: response.status, body: await readJson(response) }
    }

    const unpaidReview = await createReview(unpaidReviewOrderId, ownProductId, 5, 'E2E评价-未完成订单')
    check(unpaidReview.body?.success === false && String(unpaidReview.body?.message ?? '').includes('完成后'),
      '未完成订单不能评价', String(unpaidReview.body?.message ?? '').slice(0, 20))
    const wrongProductReview = await createReview(supplierCompletedOrderId, 3, 5, 'E2E评价-非本单商品')
    check(wrongProductReview.body?.success === false && String(wrongProductReview.body?.message ?? '').includes('不属于'),
      '商品不属于订单时不能评价', String(wrongProductReview.body?.message ?? '').slice(0, 20))

    const supplierReview = await createReview(supplierCompletedOrderId, ownProductId, 5, 'E2E评价-供应商供货')
    const supplierReviewId = String(supplierReview.body?.id ?? '') || sql(
      `SELECT id FROM agri_s2b2c.s2b2c_review WHERE order_id = '${supplierCompletedOrderId}'
       AND product_id = '${ownProductId}' LIMIT 1`)
    if (supplierReviewId && !supplierReviewId.startsWith('ERR')) reviewIds.push(supplierReviewId)
    check(supplierReview.body?.success === true && Boolean(supplierReviewId),
      '已完成订单可提交评价', `id=${supplierReviewId}`)
    const duplicateReview = await createReview(supplierCompletedOrderId, ownProductId, 5, 'E2E评价-重复')
    check(duplicateReview.body?.success === false && String(duplicateReview.body?.message ?? '').includes('已评价'),
      '同一订单商品不能重复评价', String(duplicateReview.body?.message ?? '').slice(0, 20))

    const ownReviews = await call(`/api/consumer/reviews?productId=${ownProductId}&page=1&size=50`, { headers: auth })
    check((ownReviews.body?.records ?? []).some((row) => String(row.id) === supplierReviewId),
      '消费者端展示已提交评价')
    const supplierReviewList = await call('/api/supplier/reviews?page=1&size=50', { headers: auth })
    check((supplierReviewList.body?.records ?? []).some((row) => String(row.id) === supplierReviewId),
      '供应商端可见本供应商商品评价')
    const supplierReply = await call(
      `/api/supplier/review/${supplierReviewId}/reply?reply=${encodeURIComponent('感谢反馈，欢迎复购')}`,
      { method: 'PUT', headers: auth })
    const supplierReplyDb = sql(`SELECT CONCAT(IFNULL(reply,''),'|',IFNULL(reply_by,'')) FROM agri_s2b2c.s2b2c_review
                                 WHERE id = '${supplierReviewId}'`)
    check(supplierReply.body?.success === true && supplierReplyDb.endsWith('|SUPPLIER'),
      '供应商回复评价并记录回复方', supplierReplyDb)
    const duplicateReply = await call(
      `/api/supplier/review/${supplierReviewId}/reply?reply=${encodeURIComponent('二次回复')}`,
      { method: 'PUT', headers: auth })
    check(duplicateReply.body?.success === false && String(duplicateReply.body?.message ?? '').includes('已回复'),
      '同一评价不能重复回复', String(duplicateReply.body?.message ?? '').slice(0, 16))
    const repliedList = await call('/api/supplier/reviews?replied=true&page=1&size=50', { headers: auth })
    const unrepliedList = await call('/api/supplier/reviews?replied=false&page=1&size=50', { headers: auth })
    check((repliedList.body?.records ?? []).some((row) => String(row.id) === supplierReviewId)
      && !(unrepliedList.body?.records ?? []).some((row) => String(row.id) === supplierReviewId),
      '供应商评价按回复状态筛选')
    const channelCrossReply = await call(
      `/api/channel/review/${supplierReviewId}/reply?reply=${encodeURIComponent('渠道越权回复')}`,
      { method: 'PUT', headers: auth })
    check(channelCrossReply.status === 403, '渠道不能回复非本渠道订单评价', `status=${channelCrossReply.status}`)

    const platformReviews = await call('/api/platform/reviews?rating=5&page=1&size=50', { headers: auth })
    check((platformReviews.body?.records ?? []).some((row) => String(row.id) === supplierReviewId),
      '平台评价审核可按评分筛选')
    const summaryBeforeHide = await call(`/api/consumer/reviews/summary/${ownProductId}`, { headers: auth })
    const hideReview = await call(`/api/platform/review/${supplierReviewId}/hide?hidden=true`,
      { method: 'PUT', headers: auth })
    const hiddenDb = sql(`SELECT hidden FROM agri_s2b2c.s2b2c_review WHERE id = '${supplierReviewId}'`)
    const ownReviewsHidden = await call(`/api/consumer/reviews?productId=${ownProductId}&page=1&size=50`, { headers: auth })
    const summaryHidden = await call(`/api/consumer/reviews/summary/${ownProductId}`, { headers: auth })
    const myReviewsHidden = await call(`/api/consumer/reviews/mine?consumerId=${createdConsumerId}`, { headers: auth })
    check(hideReview.body?.success === true && hiddenDb === '1'
      && !(ownReviewsHidden.body?.records ?? []).some((row) => String(row.id) === supplierReviewId)
      && Number(summaryHidden.body?.total) === Number(summaryBeforeHide.body?.total) - 1,
      '平台隐藏评价后消费者列表与评分统计排除该评价',
      `hidden=${hiddenDb} total=${summaryBeforeHide.body?.total}→${summaryHidden.body?.total}`)
    check((myReviewsHidden.body ?? []).some((row) => String(row.id) === supplierReviewId && row.hidden === true),
      '消费者我的评价标记已隐藏')
    const hiddenPlatformList = await call('/api/platform/reviews?hidden=true&page=1&size=50', { headers: auth })
    check((hiddenPlatformList.body?.records ?? []).some((row) => String(row.id) === supplierReviewId),
      '平台可按已隐藏筛选评价')
    const unknownHide = await call('/api/platform/review/999999999999999999/hide?hidden=true',
      { method: 'PUT', headers: auth })
    check(unknownHide.body?.success === false, '隐藏不存在的评价返回失败')
    const restoreReview = await call(`/api/platform/review/${supplierReviewId}/hide?hidden=false`,
      { method: 'PUT', headers: auth })
    const ownReviewsRestored = await call(`/api/consumer/reviews?productId=${ownProductId}&page=1&size=50`, { headers: auth })
    check(restoreReview.body?.success === true
      && (ownReviewsRestored.body?.records ?? []).some((row) => String(row.id) === supplierReviewId),
      '平台恢复评价后消费者端重新展示')

    const channelReview = await createReview(channelCompletedOrderId, 1, 4, 'E2E评价-渠道匿名', true)
    const channelReviewId = String(channelReview.body?.id ?? '') || sql(
      `SELECT id FROM agri_s2b2c.s2b2c_review WHERE order_id = '${channelCompletedOrderId}'
       AND product_id = 1 LIMIT 1`)
    if (channelReviewId && !channelReviewId.startsWith('ERR')) reviewIds.push(channelReviewId)
    check(channelReview.body?.success === true && Boolean(channelReviewId),
      '渠道订单可提交匿名评价', `id=${channelReviewId}`)
    const channelReviewList = await call('/api/channel/reviews?page=1&size=50', { headers: auth })
    const channelReviewRow = (channelReviewList.body?.records ?? []).find(
      (row) => String(row.id) === channelReviewId)
    check(Boolean(channelReviewRow) && channelReviewRow.nickname == null,
      '渠道端可见本渠道订单评价且匿名昵称不下发')
    const channelReply = await call(
      `/api/channel/review/${channelReviewId}/reply?reply=${encodeURIComponent('感谢您选择本店')}`,
      { method: 'PUT', headers: auth })
    const channelReplyDb = sql(`SELECT CONCAT(IFNULL(reply,''),'|',IFNULL(reply_by,'')) FROM agri_s2b2c.s2b2c_review
                                WHERE id = '${channelReviewId}'`)
    check(channelReply.body?.success === true && channelReplyDb.endsWith('|CHANNEL'),
      '渠道回复评价并记录回复方', channelReplyDb)
    const supplierListForChannelReview = await call('/api/supplier/reviews?page=1&size=50', { headers: auth })
    check(!(supplierListForChannelReview.body?.records ?? []).some(
      (row) => String(row.id) === channelReviewId), '供应商看不到其他供应商商品的评价')
    const supplierCrossReply = await call(
      `/api/supplier/review/${channelReviewId}/reply?reply=${encodeURIComponent('供应商越权回复')}`,
      { method: 'PUT', headers: auth })
    check(supplierCrossReply.status === 403, '供应商不能回复非本供应商商品评价', `status=${supplierCrossReply.status}`)
    const productOneReviews = await call('/api/consumer/reviews?productId=1&page=1&size=50', { headers: auth })
    const productOneReviewRow = (productOneReviews.body?.records ?? []).find(
      (row) => String(row.id) === channelReviewId)
    check(Boolean(productOneReviewRow) && productOneReviewRow.replyBy === 'CHANNEL'
      && productOneReviewRow.nickname == null,
      '消费者端展示渠道回复且隐藏匿名昵称')
    const platformChannelReviews = await call('/api/platform/reviews?rating=4&page=1&size=50', { headers: auth })
    check((platformChannelReviews.body?.records ?? []).some(
      (row) => String(row.id) === channelReviewId), '平台评价审核可见渠道订单评价')

    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = '${ownProductId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '${reviewAddressId}'`)
  }

} finally {
  if (reviewIds.length) {
    const reviewInClause = reviewIds.map((id) => `'${id}'`).join(',')
    sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE id IN (${reviewInClause})`)
  }
  if (createdConsumerId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_review WHERE consumer_id = '${createdConsumerId}' AND content LIKE 'E2E评价%'`)
  }
  if (priceOrderIds.length) {
    const priceInClause = priceOrderIds.map((id) => `'${id}'`).join(',')
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${priceInClause})`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id IN (${priceInClause})`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id IN (${priceInClause})`)
    sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = stock + 1, sales = GREATEST(IFNULL(sales,0) - 1, 0) WHERE id = 3`)
  }
  if (couponOrderIds.length) {
    const couponInClause = couponOrderIds.map((id) => `'${id}'`).join(',')
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${couponInClause})`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id IN (${couponInClause})`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id IN (${couponInClause})`)
  }
  if (couponIds.length) {
    const couponIdClause = couponIds.map((id) => `'${id}'`).join(',')
    sql(`DELETE FROM agri_s2b2c.s2b2c_coupon_user WHERE coupon_id IN (${couponIdClause})`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_coupon WHERE id IN (${couponIdClause})`)
  }
  if (budgetFlashId) sql(`DELETE FROM agri_s2b2c.s2b2c_flash_sale WHERE id = '${budgetFlashId}'`)
  if (lifecycleFlashId) sql(`DELETE FROM agri_s2b2c.s2b2c_flash_sale WHERE id = '${lifecycleFlashId}'`)
  if (lifecycleGroupId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_group_buy_order WHERE group_id = '${lifecycleGroupId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_group_instance WHERE group_buy_id = '${lifecycleGroupId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_group_buy WHERE id = '${lifecycleGroupId}'`)
  }
  if (supplierStatementId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_supplier_statement_order WHERE statement_id = '${supplierStatementId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_supplier_statement WHERE id = '${supplierStatementId}'`)
  }
  if (budgetGroupId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_group_buy_order WHERE group_id = '${budgetGroupId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_group_instance WHERE group_buy_id = '${budgetGroupId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_group_buy WHERE id = '${budgetGroupId}'`)
  }
  if (successGroupId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_group_buy_order WHERE group_id = '${successGroupId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_group_instance WHERE group_buy_id = '${successGroupId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_group_buy WHERE id = '${successGroupId}'`)
  }
  if (refundOrderIds.length) {
    const refundInClause = refundOrderIds.map((id) => `'${id}'`).join(',')
    sql(`DELETE FROM agri_s2b2c.s2b2c_commission WHERE order_id IN (${refundInClause})`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order_item WHERE order_id IN (${refundInClause})`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_after_sale WHERE order_id IN (${refundInClause})`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_order WHERE id IN (${refundInClause})`)
  }
  if (refundCouponIds.length) {
    const refundCouponClause = refundCouponIds.map((id) => `'${id}'`).join(',')
    sql(`DELETE FROM agri_s2b2c.s2b2c_coupon_user WHERE coupon_id IN (${refundCouponClause})`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_coupon WHERE id IN (${refundCouponClause})`)
  }
  for (const id of refundFlashIds) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_flash_sale WHERE id = '${id}'`)
  }
  if (createdConsumerId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id IN (1,3)`)
  }
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000012'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000013'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000014'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000015'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000016'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000017'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000018'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000019'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000020'`)
  if (refundStockSnapshot) {
    for (const [pid, snap] of Object.entries(refundStockSnapshot)) {
      if (snap.stock && snap.sales && !snap.stock.startsWith('ERR') && !snap.sales.startsWith('ERR')) {
        sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = ${snap.stock}, sales = ${snap.sales} WHERE id = ${pid}`)
      }
    }
  }
  if (myChannelId) {
    if (gradeOriginal) {
      sql(`UPDATE agri_s2b2c.s2b2c_channel_partner SET grade = '${gradeOriginal}' WHERE id = '${myChannelId}'`)
    }
    sql(`DELETE FROM agri_s2b2c.s2b2c_grade_change_log WHERE channel_id = '${myChannelId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_notice WHERE type = 'GRADE_CHANGED' AND ref_id = '${myChannelId}'`)
  }
  sql('DELETE FROM agri_s2b2c.s2b2c_grade_rule')
  if (couponStockSnapshot?.stock && couponStockSnapshot?.sales
      && !couponStockSnapshot.stock.startsWith('ERR') && !couponStockSnapshot.sales.startsWith('ERR')) {
    sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = ${couponStockSnapshot.stock}, sales = ${couponStockSnapshot.sales} WHERE id = 3`)
  }
  if (createdConsumerId) sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 3 AND channel_id IS NOT NULL`)
  if (createdConsumerId) sql(`DELETE FROM agri_s2b2c.s2b2c_cart WHERE consumer_id = '${createdConsumerId}' AND product_id = 3`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000009'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000010'`)
  sql(`DELETE FROM agri_s2b2c.s2b2c_address WHERE id = '990000000000000011'`)
  if (createdConsumerId) {
    // 只清理本轮自动创建的空手机号档案，认领来的老档案不动
    sql(`DELETE FROM agri_s2b2c.s2b2c_consumer WHERE id = '${createdConsumerId}' AND phone IS NULL`)
  }
  if (ownProductId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_distribution_region WHERE product_id = '${ownProductId}'`)
    sql(`DELETE FROM agri_s2b2c.s2b2c_product WHERE id = '${ownProductId}'`)
  }
  if (supplierCreated) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_supplier WHERE company_name = 'E2E商城供应商'`)
  }
  if (supplierApplicationId) {
    sql(`DELETE FROM agri_core.platform_identity_application WHERE id = '${supplierApplicationId}'`)
  }
  // 清掉本轮及历史遗留的孤儿关系（渠道行已删）
  sql("DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id NOT IN (SELECT id FROM agri_s2b2c.s2b2c_channel_partner)")
  if (testChannelId) {
    sql(`DELETE FROM agri_s2b2c.s2b2c_channel_product WHERE channel_id = '${testChannelId}'`)
  }
  if (channelCreated) {
    sql("DELETE FROM agri_s2b2c.s2b2c_channel_partner WHERE shop_name = 'E2E渠道优选店'")
  }
}

const left = createdConsumerId
  ? sql(`SELECT COUNT(*) FROM agri_s2b2c.s2b2c_consumer WHERE id = '${createdConsumerId}'`)
  : '0'
console.log(`\n清理：自动创建的消费者档案已删除（残留 ${left}）`)

/* 库存与销量按开场快照原样写回，并断言真的回去了 */
for (const pid of [1, 3]) {
  const snapRow = stockSnapshot[pid]
  if (snapRow && snapRow.stock && !snapRow.stock.startsWith('ERR')
    && snapRow.sales && !snapRow.sales.startsWith('ERR')) {
    sql(`UPDATE agri_s2b2c.s2b2c_product SET stock = ${snapRow.stock}, sales = ${snapRow.sales} WHERE id = ${pid}`)
  }
}
const stockBackRaw = sql(`SELECT CONCAT(id,':',stock,'-',IFNULL(sales,0)) FROM agri_s2b2c.s2b2c_product WHERE id IN (1,3)`)
// Windows 下 mysql 的行分隔是 \r\n，直接 split('\n') 会把 \r 留在串里 —— 看起来一样、比起来不等
const stockBack = stockBackRaw.replace(/\s+/g, ' ').trim()
const expectedStock = [1, 3]
  .map((pid) => `${pid}:${stockSnapshot[pid].stock}-${stockSnapshot[pid].sales}`).join(' ')
check(String(stockBack) === String(expectedStock),
  '清理：商品库存与销量回到开场快照（下单扣的量不会留在演示数据里）', `现在=${stockBack} 应为=${expectedStock}`)

console.log('')
if (failures.length === 0) {
  console.log('全部断言通过 ✅')
  process.exit(0)
}
console.log(`失败 ${failures.length} 项：`)
failures.forEach((item) => console.log('  -', item))
process.exit(1)
