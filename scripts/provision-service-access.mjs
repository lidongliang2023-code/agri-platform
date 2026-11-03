/**
 * 开通综合服务侧的登录身份（幂等，全部走既有接口，不直接改库）
 *
 * 做四件事：
 *   1) 备好"建国农机合作社"这个服务商主体的平台档案（经营主体 + 账号 + 用户↔主体绑定）；
 *   2) 给该账号申请并通过「服务商」业务身份（service.provider 能力的唯一来源）；
 *   3) 用运营端接口把 service_provider 档案绑到该经营主体 ——
 *      服务商工作台"我代表哪家服务商"完全取决于这条绑定；
 *   4) 用三类账号自检：需求方只看自己的单、服务商能进工作台且进不了运营端、
 *      没绑主体的账号进工作台必须被明确拒绝。
 *
 * 用法：node scripts/provision-service-access.mjs
 *   默认口令 Admin@123（与本地其它演示账号一致，可用 SERVICE_PASSWORD 覆盖）。
 */
const CORE = process.env.CORE_URL || 'http://localhost:8093'
const SVC = process.env.SERVICE_URL || 'http://localhost:8094'
const USERNAME = process.env.SERVICE_PROVIDER_USERNAME || 'provider'
const PASSWORD = process.env.SERVICE_PASSWORD || 'Admin@123'
const MARKET_ID = 1
const PROVIDER_NAME = process.env.SERVICE_PROVIDER_NAME || '建国农机合作社'
const PROVIDER_CREDIT_CODE = '91430100MA7NONGJI01X'

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

async function call(base, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const text = await response.text()
  let parsed = null
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = { code: -1, message: text.slice(0, 160), data: null }
  }
  return { status: response.status, code: parsed?.code ?? -1, message: parsed?.message ?? '', data: parsed?.data }
}

const core = (path, options) => call(CORE, path, options)
const svc = (path, options) => call(SVC, path, options)

const unwrap = (result, label) => {
  if (result.status >= 400 || (result.code !== 0 && result.code !== 200)) {
    throw new Error(`${label}失败：${result.message || `HTTP ${result.status}`}`)
  }
  return result.data
}

async function login(username) {
  return unwrap(await core('/api/v1/auth/login', {
    method: 'POST', body: { username, password: PASSWORD, marketId: MARKET_ID },
  }), `${username} 登录`)
}

async function main() {
  const adminLogin = await login('admin')
  const token = adminLogin?.accessToken ?? ''
  check(Boolean(token), '以 admin 取得平台运营令牌')
  const auth = { token }

  // 1) 服务商经营主体
  const merchantPage = unwrap(await core(
    `/api/v1/admin/merchants?page=1&size=20&keyword=${encodeURIComponent(PROVIDER_NAME)}`, auth), '查询经营主体')
  let merchant = (merchantPage?.records ?? []).find((item) => item.name === PROVIDER_NAME)
  if (!merchant) {
    const createdId = unwrap(await core('/api/v1/admin/merchants', {
      method: 'POST', ...auth,
      body: {
        code: 'PROVIDER-NJ-001', name: PROVIDER_NAME, type: 'BOTH', creditCode: PROVIDER_CREDIT_CODE,
        contactName: '陈建国', contactPhone: '13800138200', status: 1,
      },
    }), '创建服务商经营主体')
    merchant = unwrap(await core(`/api/v1/admin/merchants/${createdId}`, auth), '回读服务商经营主体')
  }
  const merchantId = String(merchant.id)
  check(Boolean(merchantId), '服务商经营主体已就绪', `${merchantId} ${merchant.name}`)

  // 2) 角色与账号
  const roles = unwrap(await core('/api/v1/admin/roles', auth), '查询平台角色')
  const providerRole = (roles ?? []).find((item) => item.code === 'SERVICE_PROVIDER')
  if (!providerRole) {
    throw new Error('平台角色 SERVICE_PROVIDER 不存在（应由迁移 V39 建好），请先执行 core-platform 迁移')
  }
  const userPage = unwrap(await core(
    `/api/v1/admin/users?page=1&size=20&keyword=${encodeURIComponent(USERNAME)}`, auth), '查询服务商账号')
  const existing = (userPage?.records ?? []).find((item) => item.username === USERNAME)
  let userId = existing ? String(existing.id) : ''
  if (!userId) {
    userId = String(unwrap(await core('/api/v1/admin/users', {
      method: 'POST', ...auth,
      body: {
        username: USERNAME, nickname: `${PROVIDER_NAME} · 调度员`, phone: '13800138200',
        password: PASSWORD, marketId: MARKET_ID, roleId: Number(providerRole.id),
      },
    }), '创建服务商账号'))
  }
  check(Boolean(userId), '服务商账号已就绪', `${USERNAME}(id=${userId}) 角色=${providerRole.code}`)

  const bindings = unwrap(await core(`/api/v1/admin/user-merchants?page=1&size=50&userId=${userId}`, auth),
    '查询账号主体绑定')
  const bound = (bindings?.records ?? []).some((item) => String(item.merchantId) === merchantId)
  if (!bound) {
    unwrap(await core('/api/v1/admin/user-merchants', {
      method: 'POST', ...auth,
      // 主体号与用户号都是雪花 ID（> 2^53），必须按字符串传：Number() 会丢精度，
      // 报错却写成"经营主体不存在"，会把人引向错误方向。
      body: { userId, merchantId, roleInMerchant: 'owner' },
    }), '绑定账号与经营主体')
  }
  check(true, '服务商账号已绑定到该经营主体', bound ? '（已存在，跳过）' : merchantId)

  // 3) 服务商业务身份：抢单/上报进度的能力 service.provider 来自"已通过的服务商身份申请"
  const providerLogin = await login(USERNAME)
  const providerToken = providerLogin?.accessToken ?? ''
  check(Boolean(providerToken), `${USERNAME} 登录成功`)
  const identities = await core('/api/v1/sso/account/identity-applications', { token: providerToken })
  const identityRow = (identities.data?.identities ?? []).find((item) => item.code === 'service_provider')
  if (!identityRow || identityRow.status === 'available') {
    const applied = await core('/api/v1/sso/account/identity-applications', {
      method: 'POST', token: providerToken,
      body: { identityType: 'service_provider', subjectName: PROVIDER_NAME },
    })
    check(applied.code === 0 || applied.code === 200, '服务商账号提交业务身份申请', applied.message)
  } else {
    check(true, `服务商业务身份申请已存在（${identityRow.status}）`)
  }
  const pendingList = unwrap(await core('/api/v1/admin/identity-applications?pageNum=1&pageSize=50&status=pending', auth),
    '查询待审核身份申请')
  const pendingRows = pendingList?.records ?? pendingList?.list ?? pendingList?.items ?? []
  const pendingMine = pendingRows.find((item) => String(item.userId ?? '') === userId
    && item.identityType === 'service_provider')
  if (pendingMine) {
    unwrap(await core(`/api/v1/admin/identity-applications/${pendingMine.id}/review`, {
      method: 'POST', ...auth, body: { approved: true, remark: '服务商资质审核通过' },
    }), '审核服务商业务身份')
  }
  const afterReview = await core('/api/v1/sso/account/identity-applications', { token: providerToken })
  const providerStatus = (afterReview.data?.identities ?? []).find((item) => item.code === 'service_provider')?.status
  check(providerStatus === 'approved', '服务商业务身份已生效（service.provider 能力来源）', `status=${providerStatus}`)

  // 4) 服务商档案 ↔ 经营主体（运营端接口，需要 service:admin）
  const providers = unwrap(await svc('/api/v1/service/ops/providers?status=all', auth), '读取服务商台账')
  const profile = (providers ?? []).find((item) => item.name === PROVIDER_NAME)
  if (!profile) {
    throw new Error(`service_provider 里没有名为「${PROVIDER_NAME}」的档案，请检查 agri_service 种子数据`)
  }
  // 上轮绑错时先纠正：一个经营主体只能对应一家服务商档案
  const conflict = (providers ?? []).find((item) => String(item.merchantId ?? '') === merchantId
    && String(item.id) !== String(profile.id))
  if (conflict) {
    unwrap(await svc(`/api/v1/service/ops/providers/${conflict.id}/merchant-binding`, {
      method: 'PUT', ...auth, body: { merchantId: '' },
    }), '纠正上一轮的错绑')
    console.log(`  · 已解除「${conflict.name}」对经营主体 ${merchantId} 的绑定（上一轮绑错）`)
  }
  const boundProfile = unwrap(await svc(`/api/v1/service/ops/providers/${profile.id}/merchant-binding`, {
    method: 'PUT', ...auth, body: { merchantId },
  }), '绑定服务商档案')
  check(String(boundProfile?.merchantId ?? '') === merchantId,
    `服务商档案「${boundProfile?.name}」已绑定平台经营主体`, `id=${boundProfile?.id} 状态=${boundProfile?.status}`)

  // 5) 三类账号自检
  const providerIdentity = unwrap(await svc('/api/v1/service/identity', { token: providerToken }), '服务商身份卡')
  check(String(providerIdentity?.providerId ?? '') === String(profile.id),
    '身份卡把服务商账号解析到具体档案', `${providerIdentity?.providerName} / providerId=${providerIdentity?.providerId}`)
  check(providerIdentity?.roles?.provider === true && providerIdentity?.roles?.admin === false,
    '服务商账号有履约权限、没有运营权限')
  const workbench = await svc('/api/v1/service/mobile/workbench', { token: providerToken })
  check(workbench.code === 200 && workbench.data?.provider?.name === PROVIDER_NAME,
    '服务商工作台按登录者出档案（不再读 URL 上的 providerId）',
    `在办工单=${(workbench.data?.todayOrders ?? []).length}`)
  const providerOps = await svc('/api/v1/service/ops/overview', { token: providerToken })
  check(providerOps.status === 403, '服务商账号打不开运营端', providerOps.message)

  const consumer = await login('farmer')
  const consumerToken = consumer?.accessToken ?? ''
  const consumerOrders = unwrap(await svc('/api/v1/service/orders', { token: consumerToken }), '需求方订单列表')
  check(Array.isArray(consumerOrders) && consumerOrders.length > 0
      && consumerOrders.every((item) => item.merchantId === '2001'),
    '需求方列表只含自己主体的订单', `rows=${(consumerOrders ?? []).length}`)
  const consumerWorkbench = await svc('/api/v1/service/mobile/workbench', { token: consumerToken })
  check(consumerWorkbench.status === 403, '需求方账号进不了服务商工作台',
    String(consumerWorkbench.message).slice(0, 40))

  // 另一家需求方：换账号必须看到另一批单据
  const other = await login('luochuan')
  const otherOrders = unwrap(await svc('/api/v1/service/orders', { token: other?.accessToken ?? '' }), '另一主体订单列表')
  const overlap = (otherOrders ?? []).filter((item) => !(consumerOrders ?? [])
    .some((mine) => mine.orderNo === item.orderNo))
  check((otherOrders ?? []).every((item) => item.merchantId === '2003') && overlap.length === (otherOrders ?? []).length,
    '另一主体读到的是自己的订单（与上一家零交集）',
    `rows=${(otherOrders ?? []).length}`)

  // 未绑定服务商档案的账号必须被明确拒绝，而不是退化成某个固定 providerId。
  // 这里用"解绑 → 试一次 → 再绑回来"验证：需求方账号压根没有 service:provider 权限，
  // 被 RBAC 就挡住了（上面已断言），走不到"档案未绑定"这条判据。
  unwrap(await svc(`/api/v1/service/ops/providers/${profile.id}/merchant-binding`, {
    method: 'PUT', ...auth, body: { merchantId: '' },
  }), '临时解绑以验证拒绝逻辑')
  const unboundWorkbench = await svc('/api/v1/service/mobile/workbench', { token: providerToken })
  check(unboundWorkbench.status === 403 && /绑定|档案/.test(String(unboundWorkbench.message)),
    '解绑后工作台被拒绝且原因可操作（不会退化成某个固定档案）', String(unboundWorkbench.message).slice(0, 70))
  unwrap(await svc(`/api/v1/service/ops/providers/${profile.id}/merchant-binding`, {
    method: 'PUT', ...auth, body: { merchantId },
  }), '恢复服务商档案绑定')
  const reboundWorkbench = await svc('/api/v1/service/mobile/workbench', { token: providerToken })
  check(reboundWorkbench.code === 200 && reboundWorkbench.data?.provider?.name === PROVIDER_NAME,
    '重新绑定后工作台恢复（绑定关系即工作台准入）')

  console.log(`\n服务商账号：${USERNAME} / ${PASSWORD}　需求方：farmer / luochuan（口令同上）`)
  console.log('用户端：http://localhost:8105/service/　移动端：http://localhost:8106/　运营端：http://localhost:8107/service-ops/')
}

main()
  .catch((error) => {
    failures.push(error.message)
    console.error(error)
  })
  .finally(() => {
    console.log(`断言 ${failures.length === 0 ? '全部通过' : `失败 ${failures.length} 项：${failures.join(' / ')}`}`)
    process.exit(failures.length === 0 ? 0 : 1)
  })
