/**
 * 修溯源点检的夹具：造一个「当前主体名下有采收批次、且确实是商城供应商」的账号。
 *
 * 用法：node scripts/provision-supplier-with-batches.mjs        # 幂等，可反复跑
 *      node scripts/provision-supplier-with-batches.mjs --show  # 只打印夹具账号名
 * 前置：core(:8093)、agri-s2b2c(:8088)、agri-production(:8092) 在跑
 *
 * 为什么红：`GET /api/supplier/production-batches` 只回**当前令牌主体名下**的采收批次
 * （跨主体不可见是设计）。演示账号 supplier1 在 2026-11-03 14:08 被改绑到「五常大米专营有限公司」，
 * 该主体名下 0 个批次 → 所有拿 supplier1 当夹具的溯源脚本从第一步就红，红的是夹具不是产品。
 * 而有批次的主体 2001（绿源农业合作社）名下的 farmer/admin 都没有商城供应商权限，
 * `/api/supplier/**` 整族被 `@OperatorOnly("s2b2c:supplier")` 拦着（所以也不存在"没身份也能申请入驻"的口子）。
 *
 * 因此这里不改别人的账号，只**新增一个专用夹具账号**：角色 S2B2C_SUPPLIER + 绑定主体 2001
 * + 已通过的 mall_supplier 业务身份 + 自己提交并让平台审过的入驻单。四步全走产品自己的端点，
 * 不手插库（能力是 CapabilityFacade 现算的，插库会让"有身份"和"有能力"两件事对不上）。
 */
const CORE = 'http://localhost:8093'
const S2B2C = 'http://localhost:8088'
const USERNAME = 'lvyuanshop'
const PASSWORD = process.env.AGRI_DEMO_PASSWORD ?? 'Admin@123'
const SUBJECT_ID = '2001'          // 名下有 3 个在册采收批次的生产主体
const SUBJECT_NAME = '绿源农业合作社'
const CREDIT_CODE = '91440300MA5XXXXX0X'   // 主体 2001 的真实统一社会信用代码（s2b2c_supplier 上是唯一键）
const MARKET_ID = 1

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const request = async (base, path, options = {}, token = '') => {
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
  const res = await fetch(`${base}${path}`, { ...options, headers: { ...headers, ...(options.headers ?? {}) },
    body: options.body ? JSON.stringify(options.body) : undefined })
  const text = await res.text()
  let body = null
  try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 140) } }
  return { status: res.status, body }
}
const core = (path, options = {}, token = '') => request(CORE, path, options, token)
const unwrap = (res, label) => {
  if (res.status !== 200 || (res.body?.code ?? 0) !== 0) {
    throw new Error(`${label}失败：HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 140)}`)
  }
  return res.body.data
}
const login = async (username, password = PASSWORD) => {
  const { body } = await core('/api/v1/auth/login', { method: 'POST', body: { username, password } })
  return body?.data ?? {}
}

async function main() {
  const admin = await login('admin')
  const auth = admin.accessToken ?? ''
  check(Boolean(auth), 'admin 登录（建夹具用）')
  if (!auth) throw new Error('admin 登录失败，后面的步骤都做不了')

  /* 1) 角色 */
  const roles = unwrap(await core('/api/v1/admin/roles', {}, auth), '查询平台角色')
  const supplierRole = (roles ?? []).find((item) => item.code === 'S2B2C_SUPPLIER')
  if (!supplierRole) throw new Error('平台角色 S2B2C_SUPPLIER 不存在（商城供应商权限码 s2b2c:supplier 挂在它上面）')

  /* 2) 账号 */
  const userPage = unwrap(await core(`/api/v1/admin/users?page=1&size=20&keyword=${encodeURIComponent(USERNAME)}`, {}, auth), '查询夹具账号')
  const existing = (userPage?.records ?? []).find((item) => item.username === USERNAME)
  let userId = existing ? String(existing.id) : ''
  if (!userId) {
    userId = String(unwrap(await core('/api/v1/admin/users', {
      method: 'POST', body: {
        username: USERNAME, nickname: `${SUBJECT_NAME} · 供货店铺`, phone: '13800138011',
        password: PASSWORD, marketId: MARKET_ID, roleId: Number(supplierRole.id),
      },
    }, auth), '创建夹具账号'))
  }
  check(/^\d+$/.test(userId), '夹具账号已就绪', `${USERNAME}(id=${userId}) 角色=${supplierRole.code}`)

  /* 3) 绑到有批次的主体（雪花号一律按字符串传，Number() 会丢精度） */
  const bindings = unwrap(await core(`/api/v1/admin/user-merchants?page=1&size=50&userId=${userId}`, {}, auth), '查询账号主体绑定')
  const bound = (bindings?.records ?? []).some((item) => String(item.merchantId) === SUBJECT_ID)
  if (!bound) {
    unwrap(await core('/api/v1/admin/user-merchants', {
      method: 'POST', body: { userId, merchantId: SUBJECT_ID, roleInMerchant: 'owner' },
    }, auth), '绑定账号与经营主体')
  }
  check(true, '夹具账号已绑定生产主体', bound ? '（已存在，跳过）' : SUBJECT_ID)

  /* 4) 业务身份：s2b2c.supplier 能力来自"已通过的商城供应商身份申请"，不是角色 */
  const shopToken = (await login(USERNAME)).accessToken ?? ''
  const identities = await core('/api/v1/sso/account/identity-applications', {}, shopToken)
  const identityRow = (identities.body?.data?.identities ?? []).find((item) => item.code === 'mall_supplier')
  if (!identityRow || identityRow.status === 'available' || identityRow.status === 'rejected') {
    const applied = await core('/api/v1/sso/account/identity-applications', {
      method: 'POST', body: { identityType: 'mall_supplier', subjectName: SUBJECT_NAME },
    }, shopToken)
    check(applied.body?.code === 0 || applied.body?.code === 200, '提交商城供应商业务身份申请',
      `code=${applied.body?.code} ${applied.body?.message ?? ''}`)
    const pendingList = unwrap(await core('/api/v1/admin/identity-applications?pageNum=1&pageSize=100&status=pending', {}, auth),
      '查询待审核身份申请')
    const rows = pendingList?.records ?? pendingList?.list ?? pendingList?.items ?? []
    const pendingMine = rows.find((item) => String(item.userId ?? '') === userId && item.identityType === 'mall_supplier')
    check(Boolean(pendingMine), '待审列表里找到这条申请', pendingMine ? `id=${pendingMine.id}` : '(没找到)')
    if (pendingMine) {
      const reviewed = await core(`/api/v1/admin/identity-applications/${pendingMine.id}/review`, {
        method: 'POST', body: { approved: true, remark: '溯源夹具：商城供应商身份审核通过' },
      }, auth)
      check(reviewed.body?.code === 0 || reviewed.body?.code === 200, '平台审核通过该业务身份',
        `${reviewed.body?.code} ${reviewed.body?.message ?? ''}`)
    }
  } else {
    check(true, '商城供应商业务身份已存在', `status=${identityRow.status}`)
  }

  /* 5) 入驻单：账号自己申请（此时它有 s2b2c:supplier 权限），平台审核通过。
     没有 s2b2c_supplier 这一行，供应商侧的"建商品"就找不到归属，光有批次也白搭。 */
  const freshToken = (await login(USERNAME)).accessToken ?? ''
  const batchesOf = async (token) => {
    const res = await request(S2B2C, '/api/supplier/production-batches', {}, token)
    return { status: res.status, list: Array.isArray(res.body?.records) ? res.body.records : [], message: String(res.body?.message ?? '') }
  }
  let batches = await batchesOf(freshToken)
  if (batches.status === 403) throw new Error(`仍被能力闸门拦着：${batches.message}`)

  const applied = await request(S2B2C, '/api/supplier/apply', {
    method: 'POST',
    body: {
      companyName: SUBJECT_NAME, creditCode: CREDIT_CODE, contactPhone: '13800138011',
      industry: '蔬菜种植', province: '广东省', city: '深圳市', district: '南山区',
      address: '科技园路 1 号', legalName: '张农户', shopName: '绿源直营店',
    },
  }, freshToken)
  const applyMessage = String(applied.body?.message ?? JSON.stringify(applied.body).slice(0, 80))
  check(applied.status === 200 && /成功|已入驻|审核中/.test(applyMessage), '提交/复用商城入驻申请', applyMessage)

  const listed = await request(S2B2C, `/api/platform/suppliers?page=1&size=30&keyword=${encodeURIComponent(SUBJECT_NAME)}`, {}, auth)
  const rows = listed.body?.records ?? listed.body?.data?.records ?? []
  /* SupplierVO 不返回 userId（VO 里没这一列），所以按**唯一信用代码**认行，别按申请人认。 */
  const mine = rows.find((row) => String(row.creditCode ?? '') === CREDIT_CODE)
    ?? rows.find((row) => String(row.auditStatus) !== 'APPROVED')
  check(Boolean(mine), '平台侧列出这个账号的入驻单', mine ? `id=${mine.id} status=${mine.auditStatus}` : `(关键词 ${SUBJECT_NAME} 没有行)`)
  if (mine && String(mine.auditStatus) !== 'APPROVED') {
    const audited = await request(S2B2C,
      `/api/platform/supplier/audit?id=${mine.id}&auditStatus=APPROVED&auditOpinion=${encodeURIComponent('溯源夹具：有批次在册主体的入驻审核')}`,
      { method: 'PUT' }, auth)
    check(audited.body?.success !== false, '平台审核通过入驻（同时由平台落身份与绑定）',
      JSON.stringify(audited.body ?? {}).slice(0, 120))
    batches = await batchesOf((await login(USERNAME)).accessToken ?? '')
  }

  check(batches.status === 200 && batches.list.length > 0,
    '夹具账号作为供应商能选到本主体在册的采收批次（溯源点检的前提）',
    batches.status === 200 ? `${batches.list.length} 个：${batches.list.map((b) => b.batchNo).join(' / ')}` : `HTTP ${batches.status} ${batches.message}`)
  console.log(`\n夹具账号：${USERNAME} / ${PASSWORD}（主体 ${SUBJECT_ID} ${SUBJECT_NAME}）`)
  console.log('用法：E2E_SUPPLIER_USER=' + USERNAME + ' node scripts/check-supplier-batch-bind-ui.mjs')
}

if (process.argv.includes('--show')) {
  console.log(`${USERNAME} / ${PASSWORD}`)
} else {
  main().then(() => {
    console.log(`\n失败 ${failures.length} 项`)
    process.exit(failures.length > 0 ? 1 : 0)
  }).catch((error) => {
    console.log(`✗ 夹具准备中断　${String(error?.message ?? error).slice(0, 170)}`)
    process.exit(1)
  })
}
export { USERNAME, PASSWORD, SUBJECT_ID, SUBJECT_NAME }
