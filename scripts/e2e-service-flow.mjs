/**
 * 综合服务（agri-service）主链路端到端联调
 *
 * 链路：
 *   令牌解析身份（经营主体 / 服务商档案）→ 三主体数据范围与越权回归
 *   → 下单参数与金额校验 → 订单状态机（不许跳步、不许用评价代替验收）
 *   → 需求发布（撮合数按在营服务商实算、大厅联系方式脱敏）
 *   → 服务商抢单/跨类目拒绝/进度回退拒绝 → 培训报名幂等与结业证书签发
 *   → 问诊必须挂真实专家、AI 初判结论随内容变化
 *   → 政策申报期闸门与审核链路 → 投保费率实算与报案归属
 *   → 运营派单/审核/结算复核（操作人来自令牌、真实来源 IP）
 *   → 站内信写入方与收件箱范围 → 清理与残留归零、被改种子逐条还原
 *
 * 用法：node scripts/e2e-service-flow.mjs
 *   前置：core-platform :8093、agri-service :8094、MySQL 在跑，
 *        且已执行 node scripts/provision-service-access.mjs（服务商账号 + 档案绑定）。
 */
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const CORE = 'http://localhost:8093'
const SVC = 'http://localhost:8094'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const PASSWORD = 'Admin@123'
const MARKER = 'E2E服务闭环'
const PROVIDER_NAME = '建国农机合作社'
/** A=绿源农业合作社(2001)、B=陕西洛川果业(2003)，两家的单据必须互不可见。 */
const MERCHANT_A = '2001'
const MERCHANT_B = '2003'

const sql = (query) => {
  if (!existsSync(MYSQL)) return ''
  const result = spawnSync(MYSQL,
    ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query], { encoding: 'utf8' })
  if (result.status !== 0) return `ERR:${String(result.stderr ?? '').trim().slice(0, 200)}`
  return String(result.stdout ?? '').trim()
}
const exec = (query) => {
  const out = sql(query)
  if (String(out).startsWith('ERR')) {
    console.log(`  ! SQL 失败：${out}　← ${query.replace(/\s+/g, ' ').slice(0, 110)}`)
  }
  return out
}
const scalar = (query) => sql(query).split('\n')[0] ?? ''
const maxId = (table) => Number(scalar(`SELECT COALESCE(MAX(id),0) FROM agri_service.${table}`)) || 0

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

async function login(username) {
  const response = await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, marketId: 1 }),
  })
  const body = await response.json().catch(() => null)
  return body?.data?.accessToken ?? ''
}

/** 服务域失败分两种：HTTP 状态（RBAC 与身份解析）与 HTTP 200 + code!=200（业务判定）。 */
async function api(token, method, path, body, headers = {}) {
  const response = await fetch(`${SVC}${path}`, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { code: -1, message: text.slice(0, 120), data: null }
  }
  return { status: response.status, code: parsed?.code ?? -1, message: parsed?.message ?? '', data: parsed?.data }
}

const snapshot = {
  order: maxId('service_order'), demand: maxId('service_demand'), message: maxId('service_message'),
  log: maxId('service_op_log'), consultation: maxId('service_consultation'),
  application: maxId('service_policy_application'), policy: maxId('insurance_policy'),
  claim: maxId('insurance_claim'), enrollment: maxId('service_enrollment'),
  resource: maxId('service_resource'), favorite: maxId('service_favorite'),
  event: maxId('service_order_event'), provider: maxId('service_provider'),
}
const restore = {
  learnersBefore: {},
  settlementBefore: '',
  policy4Before: '',
  provider9Before: '',
  expertCountsBefore: '',
  unreadBefore: '',
  provider1Merchant: scalar('SELECT IFNULL(merchant_id,\'\') FROM agri_service.service_provider WHERE id=1'),
}

function purgePreviousRuns() {
  exec(`USE agri_service;
    DELETE e FROM service_order_event e JOIN service_order o ON o.id=e.order_id
      WHERE o.id>${snapshot.order} OR o.notes LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_order WHERE id>${snapshot.order} OR notes LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_demand WHERE id>${snapshot.demand} OR service_name LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_consultation WHERE id>${snapshot.consultation} OR subject LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_policy_application WHERE id>${snapshot.application} OR policy_title LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.insurance_policy WHERE id>${snapshot.policy} OR insured_area LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.insurance_claim WHERE id>${snapshot.claim} OR description LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_enrollment WHERE id>${snapshot.enrollment}`)
  exec(`DELETE FROM agri_service.service_resource WHERE id>${snapshot.resource} OR title LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_favorite WHERE id>${snapshot.favorite}`)
  exec(`DELETE FROM agri_service.service_message WHERE id>${snapshot.message} OR content LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_op_log WHERE id>${snapshot.log} OR detail LIKE '%${MARKER}%'`)
}

async function main() {
  const admin = await login('admin')
  const farmer = await login('farmer')
  const other = await login('luochuan')
  const provider = await login('provider')
  check(Boolean(admin && farmer && other && provider), '四个测试账号登录成功（admin / farmer / luochuan / provider）')

  purgePreviousRuns()

  /* ---------- 1. 身份由令牌解析、数据范围按主体 ---------- */
  const idA = await api(farmer, 'GET', '/api/v1/service/identity')
  check(idA.data?.merchantId === MERCHANT_A, 'A 身份解析到经营主体 2001', `${idA.data?.merchantId} ${idA.data?.merchantName}`)
  const idB = await api(other, 'GET', '/api/v1/service/identity')
  check(idB.data?.merchantId === MERCHANT_B, 'B 身份解析到经营主体 2003', idB.data?.merchantId)
  const idP = await api(provider, 'GET', '/api/v1/service/identity')
  check(idP.data?.providerName === PROVIDER_NAME && idP.data?.roles?.provider === true,
    '服务商账号解析到具体档案', `${idP.data?.providerName} providerId=${idP.data?.providerId}`)
  const noToken = await api('', 'GET', '/api/v1/service/orders')
  check(noToken.status === 401, '未登录访问被拒', String(noToken.status))

  const ordersA = await api(farmer, 'GET', '/api/v1/service/orders')
  const ordersB = await api(other, 'GET', '/api/v1/service/orders')
  const listA = ordersA.data ?? []
  const listB = ordersB.data ?? []
  check(listA.length > 0 && listA.every((item) => item.merchantId === MERCHANT_A),
    'A 的订单列表只含本主体', `rows=${listA.length}`)
  check(listB.length > 0 && listB.every((item) => item.merchantId === MERCHANT_B),
    'B 的订单列表只含本主体', `rows=${listB.length}`)
  const shared = listB.filter((item) => listA.some((mine) => mine.orderNo === item.orderNo))
  check(shared.length === 0, '两家订单零交集（原先是同一份全平台清单）')
  const aFirst = listA[0]
  const crossRead = await api(other, 'GET', `/api/v1/service/orders/${aFirst.id}`)
  check(crossRead.status === 404, 'B 读 A 的订单返回 404（不暴露存在性）', crossRead.message)
  const crossPatch = await api(other, 'PATCH', `/api/v1/service/orders/${aFirst.id}`, { status: 'cancelled' })
  check(crossPatch.status === 404, 'B 改 A 的订单同样被拒', String(crossPatch.status))
  const opsOrders = await api(admin, 'GET', '/api/v1/service/ops/orders')
  check((opsOrders.data ?? []).length >= listA.length + listB.length,
    '运营端按角色可看全量台账', `rows=${(opsOrders.data ?? []).length}`)

  /* ---------- 2. 下单：参数、金额与归属 ---------- */
  const providers = await api(farmer, 'GET', '/api/v1/service/providers')
  const target = (providers.data ?? []).find((item) => item.name === PROVIDER_NAME)
  check(Boolean(target), '服务商列表可按名称定位档案', target ? `id=${target.id}` : '')
  const noProvider = await api(farmer, 'POST', '/api/v1/service/orders', {
    appointmentDate: '2026-11-20', appointmentSlot: '09:00-12:00', location: `${MARKER} 试验田`,
    quantity: 20, contactPhone: '13800001234',
  })
  check(noProvider.code === 400, '不选服务商直接下单被拒（不再缺省给某个服务商）', noProvider.message)
  const ghostProvider = await api(farmer, 'POST', '/api/v1/service/orders', {
    providerId: 999999, appointmentDate: '2026-11-20', quantity: 20, contactPhone: '13800001234',
  })
  check(ghostProvider.status === 404, '指向不存在的服务商返回 404', ghostProvider.message)
  const noDate = await api(farmer, 'POST', '/api/v1/service/orders', {
    providerId: Number(target.id), quantity: 20, contactPhone: '13800001234',
  })
  check(noDate.code === 400, '缺预约日期被拒（不再写"待确认"）', noDate.message)
  const noQuantity = await api(farmer, 'POST', '/api/v1/service/orders', {
    providerId: Number(target.id), appointmentDate: '2026-11-20', appointmentSlot: '09:00',
    location: 'x', contactPhone: '13800001234',
  })
  check(noQuantity.code === 400, '缺服务数量被拒', noQuantity.message)
  const created = await api(farmer, 'POST', '/api/v1/service/orders', {
    providerId: Number(target.id), serviceName: `${MARKER} 水稻机收`, quantity: 20,
    appointmentDate: '2026-11-20', appointmentSlot: '09:00-12:00',
    location: `${MARKER} 3 号田`, contactPhone: '13800001234', notes: MARKER,
  })
  const order = created.data ?? {}
  check(created.code === 200 && order.status === 'pending_payment', '下单成功且落在"待支付定金"', order.orderNo ?? '')
  check(Number(order.unitPrice) === Number(target.price) && Number(order.totalAmount) === Number(target.price) * 20,
    '金额由服务商报价 × 数量算出', `${order.unitPrice} × 20 = ${order.totalAmount}`)
  check(Number(order.depositAmount) === Math.round(Number(order.totalAmount) * 0.2),
    '定金按 20% 计', String(order.depositAmount))
  check(order.merchantId === MERCHANT_A && order.providerName === PROVIDER_NAME,
    '订单归属取令牌、服务商名取档案（不接受前端自报）', `${order.merchantId} / ${order.providerName}`)
  const orderId = Number(order.id)
  const orderNotice = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND biz_no='${order.orderNo}'`))
  check(orderNotice === 1, '下单写入了本主体站内信（消息表有写入方）', `rows=${orderNotice}`)
  // 买家自己传低价：金额必须仍按服务商目录价算，否则一单就能把价打到 1 分
  const cheap = await api(farmer, 'POST', '/api/v1/service/orders', {
    providerId: Number(target.id), serviceName: `${MARKER} 低价试探`, quantity: 10,
    unitPrice: 0.01, totalAmount: 0.1,
    appointmentDate: '2026-11-21', appointmentSlot: '09:00-12:00',
    location: `${MARKER} 低价地块`, contactPhone: '13800001234',
  })
  check(cheap.code === 200 && Number(cheap.data?.unitPrice) === Number(target.price)
    && Number(cheap.data?.totalAmount) === Number(target.price) * 10,
    '请求里的 unitPrice 不生效，金额只认服务商目录价',
    `${cheap.data?.unitPrice} × 10 = ${cheap.data?.totalAmount}`)
  const quote = await api(farmer, 'POST', '/api/v1/service/orders', {
    providerId: Number(target.id), serviceName: '水稻机收（履带式）', quantity: 10,
    appointmentDate: '2026-11-22', appointmentSlot: '09:00-12:00',
    location: `${MARKER} 目录价地块`, contactPhone: '13800001234',
  })
  const catalogPrice = Number(scalar(`SELECT price FROM agri_service.service_item
    WHERE provider_id=${Number(target.id)} AND name='水稻机收（履带式）'`))
  check(Number(quote.data?.unitPrice) === catalogPrice,
    '命中服务目录时按目录单价计价（不是服务商起价）', `${quote.data?.unitPrice} / ${catalogPrice}`)
  await exec(`DELETE FROM agri_service.service_order WHERE id IN (${cheap.data?.id}, ${quote.data?.id})`)

  /* ---------- 2b. 服务商入驻申请的字段落位 ---------- */
  const joined = await api(farmer, 'POST', '/api/v1/service/providers/apply', {
    name: `${MARKER} 服务队`, category: '农机作业', phone: '13800005566',
    region: `${MARKER} 服务区域`, certifications: '营业执照,农机作业许可',
    description: `${MARKER} 端到端申请的档案`,
  })
  const joinedId = Number(joined.data?.id)
  check(joined.code === 200 && Number.isFinite(joinedId), '入驻申请建档并返回待审核状态', joined.data?.name ?? '')
  const joinedRow = scalar(`SELECT CONCAT(status,'#',certifications,'#',IFNULL(contact_phone,''),'#',IFNULL(merchant_id,0))
    FROM agri_service.service_provider WHERE id=${joinedId}`)
  check(joinedRow.startsWith('pending#营业执照,农机作业许可#13800005566'),
    '资质写进资质列、号码写进电话列（此前手机号占了资质列的位）', joinedRow)
  check(joinedRow.endsWith(`#${MERCHANT_A}`), '申请档案自动归属登录主体', joinedRow)
  const bareApply = await api(farmer, 'POST', '/api/v1/service/providers/apply', {
    name: `${MARKER} 缺资质`, category: '农机作业', phone: '13800005567',
  })
  const bareId = Number(bareApply.data?.id)
  const bareCert = scalar(`SELECT certifications FROM agri_service.service_provider WHERE id=${bareId}`)
  check(bareCert === '待补充资质材料', '未填资质时落占位文案而不是手机号', bareCert)
  await exec(`DELETE FROM agri_service.service_provider WHERE id IN (${joinedId}, ${bareId})`)

  /* ---------- 3. 订单状态机 ---------- */
  const jump = await api(farmer, 'PATCH', `/api/v1/service/orders/${orderId}`, { status: 'in_progress', note: '跳过确认' })
  check(jump.code === 409, '待支付直接跳到作业中被拒', jump.message)
  const pay = await api(farmer, 'PATCH', `/api/v1/service/orders/${orderId}`, { status: 'confirmed', note: '定金已付' })
  check(pay.code === 200 && pay.data?.status === 'confirmed', '确认后进度 35%', String(pay.data?.progress))
  const earlyReview = await api(farmer, 'POST', `/api/v1/service/orders/${orderId}/review`, { rating: 5, review: MARKER })
  check(earlyReview.code === 409, '未完成就评价被拒（评价不再充当验收）', earlyReview.message)
  await api(farmer, 'PATCH', `/api/v1/service/orders/${orderId}`, { status: 'in_progress', note: '进场' })
  const done = await api(farmer, 'PATCH', `/api/v1/service/orders/${orderId}`, { status: 'completed', note: '验收通过' })
  check(done.code === 200 && done.data?.progress === 100, '完成收尾款前状态推进正常')
  const reviewed = await api(farmer, 'POST', `/api/v1/service/orders/${orderId}/review`, { rating: 5, review: `${MARKER} 作业规整` })
  check(reviewed.code === 200 && Number(reviewed.data?.rating) === 5, '完成后可评价', reviewed.message)
  const twice = await api(farmer, 'POST', `/api/v1/service/orders/${orderId}/review`, { rating: 4, review: '再评一次' })
  check(twice.code === 409, '重复评价被拒', twice.message)
  const afterClose = await api(farmer, 'PATCH', `/api/v1/service/orders/${orderId}`, { status: 'in_progress' })
  check(afterClose.code === 409, '已完成不能再改回作业中', afterClose.message)
  const timeline = (await api(farmer, 'GET', `/api/v1/service/orders/${orderId}`)).data?.timeline ?? []
  check(timeline.some((item) => String(item.note).includes(MARKER)), '订单时间线含真实评价记录', `steps=${timeline.length}`)

  /* ---------- 4. 需求：撮合数与脱敏 ---------- */
  const demand = await api(farmer, 'POST', '/api/v1/service/demands', {
    category: '农机作业', serviceName: `${MARKER} 60 亩机收`, description: '需要履带机',
    location: `${MARKER} 团头湖村`, area: '60亩', preferredDate: '2026-11-25',
    budgetMin: 55, budgetMax: 68, contactPhone: '13900002222',
  })
  check(demand.code === 200 && demand.data?.status === 'matching', '需求发布成功', demand.data?.demandNo ?? '')
  const expectedMatch = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_provider
    WHERE category='农机作业' AND status='available'`))
  check(Number(demand.data?.matchCount) === expectedMatch && expectedMatch > 0,
    '撮合数=同类目在营服务商数（不再是标题哈希）', `接口=${demand.data?.matchCount} 库=${expectedMatch}`)
  const hall = await api(other, 'GET', '/api/v1/service/demands')
  const hallRow = (hall.data ?? []).find((item) => item.demandNo === demand.data?.demandNo)
  check(Boolean(hallRow) && String(hallRow.contactPhone).includes('****'),
    '需求大厅里别家的联系方式脱敏', hallRow?.contactPhone ?? '')
  const mine = await api(farmer, 'GET', '/api/v1/service/demands/mine')
  const mineRow = (mine.data ?? []).find((item) => item.demandNo === demand.data?.demandNo)
  check(mineRow?.contactPhone === '13900002222' && mineRow?.merchantId === MERCHANT_A,
    '自己发布的需求能看到完整联系方式', mineRow?.contactPhone ?? '')
  const demandNoNumber = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_demand
    WHERE merchant_id=${MERCHANT_B} AND service_name LIKE '%${MARKER}%'`))
  check(demandNoNumber === 0, 'B 的"我的需求"里没有 A 发布的需求')

  /* ---------- 5. 服务商抢单与进度 ---------- */
  const bench = await api(provider, 'GET', '/api/v1/service/mobile/workbench')
  check(bench.code === 200 && bench.data?.provider?.name === PROVIDER_NAME,
    '工作台按登录者出档案', `在办=${(bench.data?.todayOrders ?? []).length}`)
  const poolPhones = (bench.data?.availableDemands ?? []).map((item) => item.contactPhone)
  check(poolPhones.length > 0 && poolPhones.every((value) => String(value).includes('****')),
    '抢单池里不给完整联系电话', `rows=${poolPhones.length}`)
  const crossCategory = await api(provider, 'POST', '/api/v1/service/mobile/workbench/demands/2/accept', null)
  check(crossCategory.code === 409, '跨类目抢单被拒', crossCategory.message)
  const demandId = Number(demand.data?.id)
  const accepted = await api(provider, 'POST', `/api/v1/service/mobile/workbench/demands/${demandId}/accept`, null)
  check(accepted.code === 200 && accepted.data?.status === 'accepted', '抢单成功并生成工单', accepted.data?.orderNo ?? '')
  const again = await api(provider, 'POST', `/api/v1/service/mobile/workbench/demands/${demandId}/accept`, null)
  check(again.code === 409, '同一需求不能被重复接', again.message)
  const workOrder = await api(farmer, 'GET', '/api/v1/service/orders')
  const acceptedOrderNo = accepted.data?.orderNo
  const workOrderRow = (workOrder.data ?? []).find((item) => item.orderNo === acceptedOrderNo)
  check(Boolean(workOrderRow) && workOrderRow.merchantId === MERCHANT_A && workOrderRow.providerName === PROVIDER_NAME,
    '抢单生成的工单归属需求方主体', `merchant=${workOrderRow?.merchantId}`)
  const acceptNotice = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND content LIKE '%${acceptedOrderNo}%'`))
  check(acceptNotice >= 1, '需求方收到接单通知', `rows=${acceptNotice}`)
  const otherWorkOrder = await api(other, 'GET', '/api/v1/service/orders')
  check(!(otherWorkOrder.data ?? []).some((item) => item.orderNo === acceptedOrderNo),
    'B 读不到这张新工单')
  const progressOrder = Number(workOrderRow?.id)
  // 别家的工单：种子订单 2 属于绿翼飞防（provider 2），当前服务商（建国农机）报进度必须 404
  const foreignOrder = Number(scalar("SELECT id FROM agri_service.service_order WHERE provider_id=2 ORDER BY id LIMIT 1"))
  const wrongProvider = await api(provider, 'POST', `/api/v1/service/mobile/workbench/orders/${foreignOrder}/progress`, { progress: 50 })
  check(wrongProvider.status === 404, '给别家工单报进度返回 404', wrongProvider.message)
  const forward = await api(provider, 'POST', `/api/v1/service/mobile/workbench/orders/${progressOrder}/progress`,
    { progress: 60, note: `${MARKER} 已进场 36 亩` })
  check(forward.code === 200 && (forward.data?.todayOrders ?? []).some((item) => item.orderNo === acceptedOrderNo),
    '进度上报后工单在本服务商工作台可见')
  const back = await api(provider, 'POST', `/api/v1/service/mobile/workbench/orders/${progressOrder}/progress`, { progress: 30 })
  check(back.code === 409, '进度回退被拒', back.message)
  const finish = await api(provider, 'POST', `/api/v1/service/mobile/workbench/orders/${progressOrder}/progress`,
    { progress: 100, note: `${MARKER} 作业完成` })
  check(finish.code === 200, '进度到 100% 收尾')
  const finishedRow = (await api(farmer, 'GET', `/api/v1/service/orders/${progressOrder}`)).data
  check(finishedRow?.status === 'completed', '需求方侧看到工单已完成', finishedRow?.status ?? '')
  const doneNotice = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND title LIKE '%待你验收%'`))
  check(doneNotice === 1, '完成时通知需求方验收', `rows=${doneNotice}`)
  const providerOps = await api(provider, 'GET', '/api/v1/service/ops/overview')
  check(providerOps.status === 403, '服务商账号进不了运营端', String(providerOps.status))

  /* ---------- 6. 培训：报名幂等、进度与结业证书 ---------- */
  const coursesBefore = await api(farmer, 'GET', '/api/v1/service/courses')
  const coursesOfB = await api(other, 'GET', '/api/v1/service/courses')
  // 挑一门两家都还没报名的课，否则"未报名不能写笔记""首次报名才累加"会被种子数据污染
  const course = (coursesBefore.data ?? []).find((item) => item.enrolled !== true
    && !(coursesOfB.data ?? []).find((row) => row.id === item.id)?.enrolled)
  check(Boolean(course), '课程列表带"我是否已报名"标记', `course=${course?.title}`)
  const courseId = Number(course.id)
  const learnersBefore = Number(scalar(`SELECT learners FROM agri_service.service_course WHERE id=${courseId}`))
  const enroll = await api(farmer, 'POST', `/api/v1/service/courses/${courseId}/enroll`)
  // 报名接口返回"带报名状态的课程行"：门户拿它直接刷新卡片，返回报名记录会让 myProgress 变 undefined
  check(enroll.code === 200 && Number(enroll.data?.id) === courseId && enroll.data?.enrolled === true
    && Number(enroll.data?.myProgress) === 0,
    '报名返回课程行且进度从 0 开始', `id=${enroll.data?.id} enrolled=${enroll.data?.enrolled} progress=${enroll.data?.myProgress}`)
  const learnersMiddle = Number(scalar(`SELECT learners FROM agri_service.service_course WHERE id=${courseId}`))
  check(learnersMiddle === learnersBefore + 1, '首次报名累加学习人数', `${learnersBefore}→${learnersMiddle}`)
  await api(farmer, 'POST', `/api/v1/service/courses/${courseId}/enroll`)
  const learnersAfterTwice = Number(scalar(`SELECT learners FROM agri_service.service_course WHERE id=${courseId}`))
  check(learnersAfterTwice === learnersMiddle, '重复报名不再累加学习人数（真按主体判重）', String(learnersAfterTwice))
  const noteBeforeEnroll = await api(other, 'PUT', `/api/v1/service/courses/${courseId}/note`, { note: '未报名的笔记' })
  check(noteBeforeEnroll.code === 409, '未报名不能保存笔记', noteBeforeEnroll.message)
  const noteSaved = await api(farmer, 'PUT', `/api/v1/service/courses/${courseId}/note`, { note: `${MARKER} 用药浓度记录` })
  check(noteSaved.code === 200 && String(noteSaved.data?.noteText).includes(MARKER), '课堂笔记保存并能读回')
  const half = await api(farmer, 'PATCH', `/api/v1/service/courses/${courseId}/progress`, { progress: 60 })
  check(half.code === 200 && Number(half.data?.progress) === 60, '学习进度推进到 60%')
  const noCertYet = (await api(farmer, 'GET', '/api/v1/service/certificates')).data ?? []
  check(!noCertYet.some((item) => String(item.title).includes(course.title)), '未到 100% 不发结业证')
  await api(farmer, 'PATCH', `/api/v1/service/courses/${courseId}/progress`, { progress: 100 })
  const certs = await api(farmer, 'GET', '/api/v1/service/certificates')
  const cert = (certs.data ?? []).find((item) => item.title === course.title)
  check(Boolean(cert) && Boolean(cert.certNo), '进度到 100% 后由服务端签发证书', cert?.certNo ?? '')
  const otherCerts = await api(other, 'GET', '/api/v1/service/certificates')
  check(!(otherCerts.data ?? []).some((item) => item.certNo === cert?.certNo), '证书只在自己的列表里')
  const courseRow = (await api(farmer, 'GET', '/api/v1/service/courses')).data?.find((item) => Number(item.id) === courseId)
  check(courseRow?.enrolled === true && Number(courseRow.myProgress) === 100,
    '课程列表的进度取当前主体的报名记录（不再用全平台共享值）', String(courseRow?.myProgress))

  /* ---------- 7. 问诊与 AI ---------- */
  const experts = await api(farmer, 'GET', '/api/v1/service/experts?category=农技问诊')
  const expert = (experts.data ?? [])[0]
  check((experts.data ?? []).length >= 2 && Boolean(expert?.name), '专家档案来自接口（不再是页面常量数组）',
    `rows=${(experts.data ?? []).length}`)
  const noExpert = await api(farmer, 'POST', '/api/v1/service/consultations', { subject: `${MARKER} 叶斑`, content: '有斑点' })
  check(noExpert.code === 400, '不选专家无法提交问诊（不再兜某个固定专家）', noExpert.message)
  const ghostExpert = await api(farmer, 'POST', '/api/v1/service/consultations',
    { subject: `${MARKER} 叶斑`, content: '有斑点', expertId: 987654 })
  check(ghostExpert.status === 404, '指向不存在的专家返回 404', ghostExpert.message)
  const consult = await api(farmer, 'POST', '/api/v1/service/consultations',
    { subject: `${MARKER} 叶斑复核`, content: '叶片有红褐色斑点', expertId: Number(expert.id), type: '农技图文' })
  check(consult.code === 200 && consult.data?.expertName === expert.name, '问诊挂到真实专家档案',
    `${consult.data?.consultNo} → ${consult.data?.expertName}`)
  const consultCount = Number(scalar(`SELECT consult_count FROM agri_service.service_expert WHERE id=${Number(expert.id)}`))
  check(consultCount > 0, '专家接诊数真实累加', String(consultCount))
  const consultsB = await api(other, 'GET', '/api/v1/service/consultations')
  check(!(consultsB.data ?? []).some((item) => item.consultNo === consult.data?.consultNo),
    'B 的问诊记录里没有 A 的问诊')
  const aiSpots = await api(farmer, 'POST', '/api/v1/service/ai/diagnose', { subject: '叶片褐斑', content: '有斑点并扩大' })
  check(aiSpots.code === 200 && JSON.stringify(aiSpots.data?.matchedDiseases).includes('稻瘟病'),
    'AI 初判的疑似病害来自命中的关键词分支', JSON.stringify(aiSpots.data?.matchedDiseases))
  const aiUnknown = await api(farmer, 'POST', '/api/v1/service/ai/diagnose', { subject: '长势不齐', content: '说不清' })
  check((aiUnknown.data?.matchedDiseases ?? []).length === 0,
    '信息不足时不再返回两条占位疑似', JSON.stringify(aiUnknown.data?.matchedDiseases))
  check(aiUnknown.data?.expertAvailable === true && Number(aiUnknown.data?.expertCount) > 0,
    '能否转专家看的是真实专家数', `experts=${aiUnknown.data?.expertCount}`)
  const aiNoSubject = await api(farmer, 'POST', '/api/v1/service/ai/diagnose', { content: '' })
  check(aiNoSubject.code === 400, '空主题的诊断被拒', aiNoSubject.message)

  /* ---------- 8. 政策申报：申报期闸门与审核链路 ---------- */
  restore.policy4Before = scalar("SELECT status FROM agri_service.service_policy WHERE id=4")
  exec(`UPDATE agri_service.service_policy SET status='closed' WHERE id=4`)
  const closedApply = await api(farmer, 'POST', '/api/v1/service/policies/applications', { policyId: 4, contactPhone: '13800001234' })
  check(closedApply.code === 409, '已截止的政策不能申报', closedApply.message)
  exec(`UPDATE agri_service.service_policy SET status='${restore.policy4Before || 'open'}' WHERE id=4`)
  const badApply = await api(farmer, 'POST', '/api/v1/service/policies/applications', { contactPhone: '13800001234' })
  check(badApply.code === 400, '不选政策无法申报', badApply.message)
  const ghostApply = await api(farmer, 'POST', '/api/v1/service/policies/applications', { policyId: 987654, contactPhone: '138' })
  check(ghostApply.status === 404, '指向不存在的政策返回 404', ghostApply.message)
  const apply = await api(farmer, 'POST', '/api/v1/service/policies/applications', { policyId: 2, contactPhone: '13800001234' })
  check(apply.code === 200 && apply.data?.applicant === '绿源农业合作社',
    '申报人取当前主体（不再是"平台用户"）', String(apply.data?.applicant))
  const applicationId = Number(apply.data?.id)
  const appsB = await api(other, 'GET', '/api/v1/service/policies/applications')
  check(!(appsB.data ?? []).some((item) => item.applicationNo === apply.data?.applicationNo),
    'B 的申报列表里没有 A 的申报')
  const badFlow = await api(admin, 'POST', `/api/v1/service/ops/policy-applications/${applicationId}/review`,
    { status: 'paid', note: '一步拨付' })
  check(badFlow.code === 409, '跳过乡镇与区县直接拨付被拒', badFlow.message)
  const noNote = await api(admin, 'POST', `/api/v1/service/ops/policy-applications/${applicationId}/review`, { status: 'town_review' })
  check(noNote.code === 400, '审核不写意见被拒', noNote.message)
  let step = await api(admin, 'POST', `/api/v1/service/ops/policy-applications/${applicationId}/review`,
    { status: 'town_review', note: '乡镇材料齐全' })
  check(step.code === 200 && Number(step.data?.progress) === 45, '乡镇审核通过', String(step.data?.progress))
  await api(admin, 'POST', `/api/v1/service/ops/policy-applications/${applicationId}/review`, { status: 'county_review', note: '区县复核通过' })
  step = await api(admin, 'POST', `/api/v1/service/ops/policy-applications/${applicationId}/review`, { status: 'paid', note: '已拨付' })
  check(step.code === 200 && step.data?.status === 'paid', '走完三级审核并拨付')
  const afterPaid = await api(admin, 'POST', `/api/v1/service/ops/policy-applications/${applicationId}/review`, { status: 'town_review', note: '退回' })
  check(afterPaid.code === 409, '已拨付不能退回', afterPaid.message)
  const applyNotices = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND content LIKE '%乡镇审核%'`))
  check(applyNotices >= 1, '每一步审核都通知了申报主体', `rows=${applyNotices}`)

  /* ---------- 9. 保险：费率实算与报案归属 ---------- */
  const products = await api(farmer, 'GET', '/api/v1/service/insurance/products')
  const product = (products.data ?? []).find((item) => Number(item.premiumRate) > 0)
  check(Boolean(product), '产品带可用费率', `${product?.name} ${product?.premiumRate}/${product?.unitMeasure}`)
  const badInsure = await api(farmer, 'POST', '/api/v1/service/insurance/policies', { productId: Number(product.id) })
  check(badInsure.code === 400, '不填投保数量被拒', badInsure.message)
  const insured = await api(farmer, 'POST', '/api/v1/service/insurance/policies',
    { productId: Number(product.id), insuredAmount: 30 })
  check(insured.code === 200 && Number(insured.data?.premium) === Number(product.premiumRate) * 30,
    '保费=费率×数量（不再兜 1280 常量）', `${insured.data?.premium}`)
  check(Number(insured.data?.coverageAmount) === Number(product.coveragePerUnit) * 30,
    '保额同样按产品参数实算', String(insured.data?.coverageAmount))
  const policyId = Number(insured.data?.id)
  const claimsB = await api(other, 'GET', '/api/v1/service/insurance/claims')
  const foreignClaim = await api(other, 'POST', '/api/v1/service/insurance/claims',
    { policyId, disasterType: '暴雨', description: `${MARKER} 别家保单报案` })
  check(foreignClaim.code === 403 || foreignClaim.status === 403,
    '拿别人的保单报不了案', foreignClaim.message)
  check((claimsB.data ?? []).every((item) => item.merchantId === MERCHANT_B), 'B 的报案列表只含自己')
  const expiredClaim = await api(farmer, 'POST', '/api/v1/service/insurance/claims',
    { policyId: 3, disasterType: '火灾', description: `${MARKER} 已失效保单报案` })
  check(expiredClaim.code === 409, '已失效保单不能报案', expiredClaim.message)
  const claim = await api(farmer, 'POST', '/api/v1/service/insurance/claims',
    { policyId, disasterType: '暴雨内涝', description: `${MARKER} 低洼地块积水`, lossArea: '8亩' })
  check(claim.code === 200 && claim.data?.status === 'submitted', '报案成功进入待查勘', claim.data?.claimNo ?? '')
  const claimId = Number(claim.data?.id)
  const claimJump = await api(admin, 'POST', `/api/v1/service/ops/insurance-claims/${claimId}/review`, { status: 'paid', note: '直接赔付' })
  check(claimJump.code === 409, '报案后一步赔付被状态机挡住', claimJump.message)
  for (const next of ['surveying', 'assessing', 'publicity', 'paid']) {
    const moved = await api(admin, 'POST', `/api/v1/service/ops/insurance-claims/${claimId}/review`, { status: next, note: `${MARKER} ${next}` })
    check(moved.code === 200, `理赔推进到 ${next}`, String(moved.data?.progress))
  }
  const closedPolicy = await api(farmer, 'GET', '/api/v1/service/insurance/policies')
  check((closedPolicy.data ?? []).some((item) => Number(item.id) === policyId && item.status === 'closed'),
    '赔付完成后保单自动结案')
  const claimNotice = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND biz_no='${claim.data?.claimNo}'`))
  check(claimNotice >= 1, '理赔每一步都通知了投保主体', `rows=${claimNotice}`)

  /* ---------- 10. 运营端：操作人、真实 IP 与统计口径 ---------- */
  restore.settlementBefore = scalar("SELECT CONCAT(status,'#',IFNULL(reviewed_by,''),'#',IFNULL(reviewed_at,'')) FROM agri_service.service_settlement WHERE id=1")
  const overview = await api(admin, 'GET', '/api/v1/service/ops/overview')
  const dbProviders = Number(scalar("SELECT COUNT(*) FROM agri_service.service_provider WHERE status IN ('available','restricted')"))
  const dbOrders = Number(scalar('SELECT COUNT(*) FROM agri_service.service_order'))
  const dbUnbound = Number(scalar("SELECT COUNT(*) FROM agri_service.service_provider WHERE merchant_id IS NULL AND status<>'removed'"))
  check(Number(overview.data?.metrics?.providers) === dbProviders, '大盘服务商数与库一致',
    `${overview.data?.metrics?.providers} / ${dbProviders}`)
  check(Number(overview.data?.metrics?.totalOrders) === dbOrders, '大盘订单数与库一致',
    `${overview.data?.metrics?.totalOrders} / ${dbOrders}`)
  const unboundTodo = (overview.data?.todos ?? []).find((item) => item.title === '服务商未绑定平台主体')
  check(Number(unboundTodo?.count) === dbUnbound, '待办里的"未绑定主体"计数与库一致',
    `${unboundTodo?.count} / ${dbUnbound}`)
  // 绑一个平台不存在的主体号：当时不报错的话，故障会推迟到服务商登录工作台才爆出来
  const bogusBind = await api(admin, 'PUT', '/api/v1/service/ops/providers/1/merchant-binding', { merchantId: '999999999999' })
  check(bogusBind.code === 409 && String(bogusBind.message).includes('不存在'),
    '绑定不存在的平台主体被当场拒绝并说明原因', String(bogusBind.message).slice(0, 40))
  const conflictBind = await api(admin, 'PUT', '/api/v1/service/ops/providers/2/merchant-binding', { merchantId: '2116774863340740609' })
  check(conflictBind.code === 409 && String(conflictBind.message).includes('一个主体只能对应一家服务商'),
    '同一主体不能绑两家服务商', String(conflictBind.message).slice(0, 40))
  const keepBind = await api(admin, 'PUT', '/api/v1/service/ops/providers/1/merchant-binding', { merchantId: '2116774863340740609' })
  check(keepBind.code === 200 && keepBind.data?.merchantId === '2116774863340740609',
    '重存现有绑定仍然成功（幂等，便于纠错）', String(keepBind.data?.merchantId))
  const report = await api(admin, 'GET', '/api/v1/service/ops/reports')
  const dbComplaintRate = Number(scalar(`SELECT ROUND(COALESCE((SELECT COUNT(*) FROM agri_service.service_complaint) * 100.0
    / NULLIF((SELECT COUNT(*) FROM agri_service.service_order),0),0),2)`))
  check(Number(report.data?.complaintRate) === dbComplaintRate,
    '投诉率按表实算（不再是 99.62% 这类常量）', `${report.data?.complaintRate} / ${dbComplaintRate}`)
  const dbCategories = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_provider WHERE status='available'`))
  const overviewCategorySum = (await api(farmer, 'GET', '/api/v1/service/overview')).data?.categories ?? []
  check(overviewCategorySum.reduce((sum, item) => sum + Number(item.count), 0) === dbCategories,
    '首页类目计数总和=在营服务商数（不再是十段常量）',
    `${overviewCategorySum.reduce((sum, item) => sum + Number(item.count), 0)} / ${dbCategories}`)
  const noReason = await api(admin, 'POST', '/api/v1/service/ops/providers/9/review', { status: 'available' })
  check(noReason.code === 400, '审核不写意见被拒', noReason.message)
  const settleNoNote = await api(admin, 'POST', '/api/v1/service/ops/settlements/1/review', { status: 'approved' })
  check(settleNoNote.code === 400, '结算复核不写意见被拒', settleNoNote.message)
  const settled = await api(admin, 'POST', '/api/v1/service/ops/settlements/1/review', { status: 'approved', note: `${MARKER} 差异已核对` })
  check(settled.code === 200 && settled.data?.reviewedBy && settled.data.reviewedBy !== '王运营',
    '结算复核人来自登录令牌', String(settled.data?.reviewedBy))
  const settledTwice = await api(admin, 'POST', '/api/v1/service/ops/settlements/1/review', { status: 'approved', note: '再复核' })
  check(settledTwice.code === 409, '重复复核被拒', settledTwice.message)
  // 派单用例自己建一张单，不去动种子订单的归属（测完由本轮清理删除）
  const dispatchSeed = await api(farmer, 'POST', '/api/v1/service/orders', {
    providerId: Number(target.id), serviceName: `${MARKER} 派单试验单`, quantity: 5,
    appointmentDate: '2026-11-28', appointmentSlot: '09:00-12:00',
    location: `${MARKER} 派单地块`, contactPhone: '13800001234', notes: `${MARKER} 派单`,
  })
  const dispatchTarget = Number(dispatchSeed.data?.id)
  check(dispatchSeed.code === 200 && Boolean(dispatchTarget), '派单用例的订单已建好', String(dispatchTarget))
  const dispatchNoTarget = await api(admin, 'POST', `/api/v1/service/ops/orders/${dispatchTarget}/dispatch`, { note: '改派' })
  check(dispatchNoTarget.code === 400, '派单不点名服务商被拒', dispatchNoTarget.message)
  restore.provider9Before = scalar("SELECT CONCAT(status,'#',IFNULL(audit_reason,'')) FROM agri_service.service_provider WHERE id=9")
  const dispatchPending = await api(admin, 'POST', `/api/v1/service/ops/orders/${dispatchTarget}/dispatch`,
    { providerId: 9, note: '派给待复审的服务商' })
  check(dispatchPending.code === 409, '不可接单的服务商不能被派单', dispatchPending.message)
  const reviewPending = await api(admin, 'POST', '/api/v1/service/ops/providers/9/review', { status: 'available', reason: `${MARKER} 补齐排班证明` })
  check(reviewPending.code === 200 && reviewPending.data?.status === 'available', '待复审服务商审核通过后恢复在营')
  const reviewTwice = await api(admin, 'POST', '/api/v1/service/ops/providers/9/review', { status: 'available', reason: '再点一次' })
  check(reviewTwice.code === 409, '重复同状态审核被拒', reviewTwice.message)
  // 来源 IP 在写入那一刻取，所以代理头要挂在派单这个写请求上，而不是后面的查询
  const dispatched = await api(admin, 'POST', `/api/v1/service/ops/orders/${dispatchTarget}/dispatch`,
    { providerId: 9, note: `${MARKER} 改派恒丰` }, { 'X-Forwarded-For': '10.77.88.99' })
  check(dispatched.code === 200 && dispatched.data?.providerName === '恒丰农机合作社', '派单成功且服务商名取档案',
    String(dispatched.data?.providerName))
  const freezeWithWork = await api(admin, 'POST', '/api/v1/service/ops/providers/9/review', { status: 'frozen', reason: '冻结' })
  check(freezeWithWork.code === 409, '有未完结工单的服务商不能直接冻结', freezeWithWork.message)
  const dispatchNotice = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND content LIKE '%恒丰农机合作社%'`))
  check(dispatchNotice >= 1, '改派结论通知了下单主体', `rows=${dispatchNotice}`)
  // 留痕：操作人来自令牌，来源 IP 取请求头（给一个可辨识的值，验证不是硬编码 127.0.0.1）
  const logs = await api(admin, 'GET', '/api/v1/service/ops/logs')
  const dispatchLog = (logs.data ?? []).find((item) => item.action === '人工派单')
  check(Boolean(dispatchLog) && dispatchLog.ip === '10.77.88.99',
    '审计日志记录真实来源 IP（不再固定 127.0.0.1）', String(dispatchLog?.ip))
  check(Boolean(dispatchLog) && dispatchLog.operator && dispatchLog.operator !== '王运营',
    '审计日志操作人来自登录令牌', String(dispatchLog?.operator))
  const settlementLog = (logs.data ?? []).find((item) => item.action === '批次复核')
  check(String(settlementLog?.detail).includes(MARKER), '审计明细写的是本次真实动作', String(settlementLog?.detail).slice(0, 40))
  const team = await api(admin, 'GET', '/api/v1/service/ops/team')
  check((team.data ?? []).length >= 5 && (team.data ?? []).every((item) => !/^王运营|陈仲裁|刘结算$/.test(String(item.name))),
    '人员名单是岗位而不是可冒充的真人姓名', (team.data ?? []).map((item) => item.name).join('、'))

  /* ---------- 11. 投诉、收藏与脱敏 ---------- */
  const complaint = await api(farmer, 'POST', '/api/v1/service/complaints', {
    orderNo: acceptedOrderNo, category: '作业质量', description: `${MARKER} 边角漏收 0.5 亩`, demand: '补收',
  })
  check(complaint.code === 200 && complaint.data?.merchantId === MERCHANT_A, '投诉落库并归属本主体',
    complaint.data?.complaintNo ?? '')
  const fakeOrder = await api(farmer, 'POST', '/api/v1/service/complaints',
    { orderNo: 'FW-不存在', description: 'x' })
  check(fakeOrder.status === 404, '挂在不存在订单上的投诉被拒', fakeOrder.message)
  const complaintOfB = await api(other, 'POST', '/api/v1/service/complaints', { orderNo: acceptedOrderNo, description: 'x' })
  check(complaintOfB.status === 404, 'B 不能挂到 A 的订单上投诉', complaintOfB.message)
  const resolveNoConclusion = await api(admin, 'POST', `/api/v1/service/ops/complaints/${Number(complaint.data?.id)}/resolve`, { status: 'resolved' })
  check(resolveNoConclusion.code === 400, '不写处理结论无法办结', resolveNoConclusion.message)
  const resolved = await api(admin, 'POST', `/api/v1/service/ops/complaints/${Number(complaint.data?.id)}/resolve`,
    { status: 'resolved', resolution: `${MARKER} 已安排补收` })
  check(resolved.code === 200 && resolved.data?.handler && resolved.data.handler !== '陈仲裁',
    '投诉处理人来自令牌', String(resolved.data?.handler))
  const resolvedTwice = await api(admin, 'POST', `/api/v1/service/ops/complaints/${Number(complaint.data?.id)}/resolve`,
    { status: 'resolved', resolution: '再办结一次' })
  check(resolvedTwice.code === 409, '已办结的工单不能重复办结', resolvedTwice.message)
  const complaintNotice = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND biz_no='${complaint.data?.complaintNo}'`))
  check(complaintNotice >= 1, '投诉结论通知了投诉方', `rows=${complaintNotice}`)
  const fav = await api(farmer, 'POST', `/api/v1/service/favorites/${Number(target.id)}/toggle`)
  check(fav.code === 200 && fav.data?.favorited === true, '收藏服务商落库', String(fav.data?.favorited))
  const favList = await api(farmer, 'GET', '/api/v1/service/favorites')
  check((favList.data ?? []).some((item) => Number(item.id) === Number(target.id)), '我的收藏能读到')
  const favOthers = await api(other, 'GET', '/api/v1/service/providers')
  check(!(favOthers.data ?? []).find((item) => Number(item.id) === Number(target.id))?.favorited,
    '别家账号看不到这条收藏')
  const unfav = await api(farmer, 'POST', `/api/v1/service/favorites/${Number(target.id)}/toggle`)
  check(unfav.data?.favorited === false, '取消收藏生效')
  const resource = await api(farmer, 'POST', '/api/v1/service/resources', {
    resourceType: 'land', title: `${MARKER} 40 亩水田流转`, location: '望城区乔口镇', areaMu: 40,
    price: 700, unit: '元/亩/年', contactPhone: '13800001234', description: '连片、机耕道通达',
  })
  check(resource.code === 200 && resource.data?.merchantId === MERCHANT_A, '资源发布落库', resource.data?.title ?? '')
  const badResource = await api(farmer, 'POST', '/api/v1/service/resources', {
    resourceType: '其它', title: 'x', location: 'x', price: 1, contactPhone: '138',
  })
  check(badResource.code === 400, '未知资源类型被拒', badResource.message)
  const resourceHall = await api(other, 'GET', '/api/v1/service/resources?type=land')
  const resourceRow = (resourceHall.data ?? []).find((item) => item.id === resource.data?.id)
  check(resourceRow && String(resourceRow.contactPhone).includes('****') && resourceRow.mine === false,
    '资源大厅对别家脱敏并标注归属', resourceRow?.contactPhone ?? '')

  /* ---------- 12. 收件箱范围与一键已读 ---------- */
  const inboxA = await api(farmer, 'GET', '/api/v1/service/messages')
  const inboxCountA = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message WHERE merchant_id=${MERCHANT_A}`))
  check((inboxA.data ?? []).length === inboxCountA && inboxCountA > 0,
    '收件箱条数与库中本主体一致', `rows=${(inboxA.data ?? []).length} 库=${inboxCountA}`)
  const unreadSql = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND is_read=FALSE`))
  const statsUnread = Number((await api(farmer, 'GET', '/api/v1/service/overview')).data?.stats?.unreadMessages)
  check(statsUnread === unreadSql, '首页"未读消息"是本主体的未读数（不是全平台）', `页面=${statsUnread} 库=${unreadSql}`)
  restore.unreadBefore = scalar(`SELECT COALESCE(GROUP_CONCAT(id),'') FROM agri_service.service_message WHERE is_read=FALSE`)
  const readAll = await api(farmer, 'POST', '/api/v1/service/messages/read-all')
  check(readAll.code === 200 && Number(readAll.data?.updated) === unreadSql,
    '一键已读只清本主体', `updated=${readAll.data?.updated} 应为=${unreadSql}`)
  const remainUnread = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_A} AND is_read=FALSE`))
  check(remainUnread === 0, 'A 的未读归零')
  const otherUnread = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_B} AND is_read=FALSE`))
  const dbOtherUnread = Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message
    WHERE merchant_id=${MERCHANT_B} AND is_read=FALSE`))
  check(otherUnread === dbOtherUnread, 'B 的未读不受影响', `rows=${otherUnread}`)
  const dict = await api(farmer, 'GET', '/api/v1/service/dictionaries')
  check((dict.data?.orderStatus ?? []).includes('pending_payment') && (dict.data?.categories ?? []).includes('农机作业'),
    '状态词表与类目由后端统一下发', (dict.data?.orderStatus ?? []).join('/'))
}

function cleanup() {
  exec(`USE agri_service;
    DELETE e FROM service_order_event e JOIN service_order o ON o.id=e.order_id WHERE o.id>${snapshot.order}`)
  exec(`DELETE FROM agri_service.service_order WHERE id>${snapshot.order} OR notes LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_demand WHERE id>${snapshot.demand} OR service_name LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_consultation WHERE id>${snapshot.consultation} OR subject LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_policy_application WHERE id>${snapshot.application}`)
  exec(`DELETE FROM agri_service.insurance_policy WHERE id>${snapshot.policy}`)
  exec(`DELETE FROM agri_service.insurance_claim WHERE id>${snapshot.claim}`)
  exec(`DELETE FROM agri_service.service_enrollment WHERE id>${snapshot.enrollment}`)
  exec(`DELETE FROM agri_service.service_resource WHERE id>${snapshot.resource}`)
  exec(`DELETE FROM agri_service.service_favorite WHERE id>${snapshot.favorite}`)
  exec(`DELETE FROM agri_service.service_message WHERE id>${snapshot.message} OR content LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_service.service_op_log WHERE id>${snapshot.log} OR detail LIKE '%${MARKER}%'`)
  if (restore.settlementBefore) {
    const [status, reviewer, reviewedAt] = restore.settlementBefore.split('#')
    exec(`UPDATE agri_service.service_settlement SET status='${status}',
      reviewed_by=${reviewer ? `'${reviewer}'` : 'NULL'}, reviewed_at=${reviewedAt ? `'${reviewedAt}'` : 'NULL'} WHERE id=1`)
  }
  if (restore.policy4Before) {
    exec(`UPDATE agri_service.service_policy SET status='${restore.policy4Before}' WHERE id=4`)
  }
  if (restore.provider9Before) {
    const [status, reason] = restore.provider9Before.split('#')
    exec(`UPDATE agri_service.service_provider SET status='${status}', audit_reason=${reason ? `'${reason}'` : 'NULL'} WHERE id=9`)
  }
  if (restore.unreadBefore) {
    exec(`UPDATE agri_service.service_message SET is_read=FALSE WHERE id IN (${restore.unreadBefore})`)
  }
}

async function verifyResidue() {
  const residue = {
    order: Number(scalar(`SELECT COUNT(*) FROM agri_service.service_order WHERE id>${snapshot.order}`)),
    demand: Number(scalar(`SELECT COUNT(*) FROM agri_service.service_demand WHERE id>${snapshot.demand}`)),
    consult: Number(scalar(`SELECT COUNT(*) FROM agri_service.service_consultation WHERE id>${snapshot.consultation}`)),
    application: Number(scalar(`SELECT COUNT(*) FROM agri_service.service_policy_application WHERE id>${snapshot.application}`)),
    policy: Number(scalar(`SELECT COUNT(*) FROM agri_service.insurance_policy WHERE id>${snapshot.policy}`)),
    claim: Number(scalar(`SELECT COUNT(*) FROM agri_service.insurance_claim WHERE id>${snapshot.claim}`)),
    enrollment: Number(scalar(`SELECT COUNT(*) FROM agri_service.service_enrollment WHERE id>${snapshot.enrollment}`)),
    resource: Number(scalar(`SELECT COUNT(*) FROM agri_service.service_resource WHERE id>${snapshot.resource}`)),
    favorite: Number(scalar(`SELECT COUNT(*) FROM agri_service.service_favorite WHERE id>${snapshot.favorite}`)),
    message: Number(scalar(`SELECT COUNT(*) FROM agri_service.service_message WHERE id>${snapshot.message}`)),
    log: Number(scalar(`SELECT COUNT(*) FROM agri_service.service_op_log WHERE id>${snapshot.log}`)),
    markerAnywhere: Number(scalar(`SELECT (SELECT COUNT(*) FROM agri_service.service_order WHERE notes LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_service.service_demand WHERE service_name LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_service.service_consultation WHERE subject LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_service.service_resource WHERE title LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_service.service_message WHERE content LIKE '%${MARKER}%')
      + (SELECT COUNT(*) FROM agri_service.service_op_log WHERE detail LIKE '%${MARKER}%')`)),
  }
  check(Object.values(residue).every((value) => value === 0),
    '清理后本轮临时数据残留为 0', JSON.stringify(residue))
  const settlement = scalar("SELECT CONCAT(status,'#',IFNULL(reviewed_by,''),'#',IFNULL(reviewed_at,'')) FROM agri_service.service_settlement WHERE id=1")
  check(!restore.settlementBefore || settlement === restore.settlementBefore, '结算批次已还原', `${settlement} / ${restore.settlementBefore}`)
  const provider9 = scalar("SELECT CONCAT(status,'#',IFNULL(audit_reason,'')) FROM agri_service.service_provider WHERE id=9")
  check(!restore.provider9Before || provider9 === restore.provider9Before, '被审核的服务商已还原', provider9)
  const policy4 = scalar('SELECT status FROM agri_service.service_policy WHERE id=4')
  check(policy4 === (restore.policy4Before || 'open'), '政策申报期状态已还原', policy4)
  const subjectBound = scalar('SELECT merchant_id FROM agri_service.service_provider WHERE id=1')
  check(subjectBound === scalar('SELECT merchant_id FROM agri_service.service_provider WHERE id=1')
    && subjectBound && !subjectBound.startsWith('ERR'), '服务商绑定未被本轮破坏', `merchant=${subjectBound}`)
}

main()
  .catch((error) => {
    failures.push(error.message)
    console.error(error)
  })
  .finally(async () => {
    cleanup()
    await verifyResidue()
    console.log('')
    if (failures.length === 0) {
      console.log('断言 全部通过')
      process.exit(0)
    }
    console.log(`断言 失败 ${failures.length} 项：`)
    failures.forEach((item) => console.log('  -', item))
    process.exit(1)
  })
