/**
 * 开通政府监管侧的登录身份（幂等，全部走既有接口，不直接改库）
 *
 * 做四件事：
 *   1) 确保 GOVERNMENT_INSPECTOR 角色存在，并按该角色建执法账号 inspector；
 *   2) 通过监管运营端接口把「执法人员档案」（gov_user）绑到该平台账号 ——
 *      移动执法端的"我的任务/我的案件/收件箱"全靠这条关系认人；
 *   3) 通过监管运营端接口把「监管主体档案」（gov_subject）绑到当前运营账号的经营主体 ——
 *      主体端登录后能看到谁的档案，取决于这条绑定；
 *   4) 用三个账号自检：执法账号能进移动端、进不了运营端；
 *      运营账号能解析主体；未绑定的主体账号被明确拒绝并给出可操作原因。
 *
 * 用法：node scripts/provision-gov-access.mjs
 *   默认口令 Admin@123（与本地其它演示账号一致，可用 GOV_PASSWORD 覆盖）。
 */
const CORE = process.env.CORE_URL || 'http://localhost:8093'
const GOV = process.env.GOV_URL || 'http://localhost:8095'
const USERNAME = process.env.GOV_INSPECTOR_USERNAME || 'inspector'
const PASSWORD = process.env.GOV_PASSWORD || 'Admin@123'
const MARKET_ID = 1
// 要与之建立绑定的执法人员档案姓名（种子里的稻田镇网格执法人员）
const INSPECTOR_NAME = process.env.GOV_INSPECTOR_NAME || '王磊'
// 要与当前登录主体建立绑定的监管档案名称（默认用平台运营账号所属的那家）
const SUBJECT_NAME = process.env.GOV_SUBJECT_NAME || '绿源蔬菜专业合作社'

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
const gov = (path, options) => call(GOV, path, options)

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
  const admin = await login('admin')
  const token = admin?.accessToken ?? ''
  check(Boolean(token), '以 admin 取得平台运营令牌')
  const auth = { token }

  // 1) 执法账号
  const roles = unwrap(await core('/api/v1/admin/roles', auth), '查询平台角色')
  const inspectorRole = (roles ?? []).find((item) => item.code === 'GOVERNMENT_INSPECTOR')
  if (!inspectorRole) {
    throw new Error('平台角色 GOVERNMENT_INSPECTOR 不存在（应由 core-platform 迁移建好），请先执行迁移')
  }
  const userPage = unwrap(await core(
    `/api/v1/admin/users?page=1&size=20&keyword=${encodeURIComponent(USERNAME)}`, auth), '查询执法账号')
  const existing = (userPage?.records ?? []).find((item) => item.username === USERNAME)
  let userId = existing ? String(existing.id) : ''
  if (!userId) {
    userId = String(unwrap(await core('/api/v1/admin/users', {
      method: 'POST', ...auth,
      body: {
        username: USERNAME, nickname: '农业综合执法二大队 · 执法员', phone: '13800139100',
        password: PASSWORD, marketId: MARKET_ID, roleId: Number(inspectorRole.id),
      },
    }), '创建执法账号'))
  }
  check(Boolean(userId), '执法账号已就绪', `${USERNAME}(id=${userId}) 角色=${inspectorRole.code}`)

  // 2) 政府人员业务身份：移动执法端的写操作除了 RBAC（gov:inspector）还要过能力闸门 gov.oversight，
  //    而这个能力来自"已通过的政府人员身份申请"，所以必须本人申请 + 运营审核两步都走完。
  const inspectorLogin = await login(USERNAME)
  const inspectorToken = inspectorLogin?.accessToken ?? ''
  check(Boolean(inspectorToken), `${USERNAME} 登录成功`)
  const identities = await core('/api/v1/sso/account/identity-applications', { token: inspectorToken })
  const identityRows = identities.data?.identities ?? []
  const governmentRow = identityRows.find((item) => item.code === 'government')
  if (!governmentRow || governmentRow.status === 'available') {
    const applied = await core('/api/v1/sso/account/identity-applications', {
      method: 'POST', token: inspectorToken,
      body: { identityType: 'government', subjectName: '寿光市农业农村局' },
    })
    check(applied.code === 0 || applied.code === 200, '执法账号提交政府人员身份申请', applied.message)
  } else {
    check(true, `政府人员身份申请已存在（${governmentRow.status}）`)
  }
  const pendingList = unwrap(await core('/api/v1/admin/identity-applications?pageNum=1&pageSize=50&status=pending', auth),
    '查询待审核身份申请')
  const pendingRows = pendingList?.records ?? pendingList?.list ?? pendingList?.items ?? []
  const pendingMine = pendingRows
    .find((item) => String(item.userId ?? '') === userId && item.identityType === 'government')
  if (pendingMine) {
    unwrap(await core(`/api/v1/admin/identity-applications/${pendingMine.id}/review`, {
      method: 'POST', ...auth, body: { approved: true, remark: '执法账号开通审核通过' },
    }), '审核政府人员身份')
  }
  const afterReview = await core('/api/v1/sso/account/identity-applications', { token: inspectorToken })
  const govStatus = (afterReview.data?.identities ?? []).find((item) => item.code === 'government')?.status
  check(govStatus === 'approved', '政府人员业务身份已生效（gov.oversight 能力来源）', `status=${govStatus}`)

  // 3) 执法人员档案 ↔ 平台账号（监管运营端接口，需要 gov:admin）
  const govUsers = unwrap(await gov('/api/v1/government/ops/users', auth), '读取执法人员档案')
  const profile = (govUsers ?? []).find((item) => item.name === INSPECTOR_NAME)
  if (!profile) {
    throw new Error(`gov_user 里没有名为「${INSPECTOR_NAME}」的执法人员档案，请检查 agri_government 种子数据`)
  }
  const boundUser = unwrap(await gov(`/api/v1/government/ops/users/${profile.id}/platform-binding`, {
    method: 'PUT', ...auth, body: { platformUserId: userId },
  }), '绑定执法人员档案')
  check(String(boundUser?.platformUserId ?? '') === userId,
    `执法人员档案「${boundUser?.name}」已绑定平台账号`, `网格=${boundUser?.grid}`)

  // 3) 监管主体档案 ↔ 平台经营主体（用 admin 自己解析出的主体，避免写死主体号）
  const mine = unwrap(await core('/api/v1/platform/merchants/mine', auth), '读取当前账号的经营主体')
  const merchantId = String(mine?.[0]?.merchantId ?? '')
  check(Boolean(merchantId), '取得用于绑定的平台经营主体', `${merchantId} ${mine?.[0]?.merchantName ?? ''}`)

  const subjects = unwrap(await gov('/api/v1/government/ops/subjects', auth), '读取监管主体台账')
  const target = (subjects ?? []).find((item) => item.subjectName === SUBJECT_NAME)
  if (!target) {
    throw new Error(`监管主体台账里没有「${SUBJECT_NAME}」（可用 GOV_SUBJECT_NAME 指定别的档案）；`
      + `现有档案：${(subjects ?? []).map((item) => item.subjectName).join('、')}`)
  }
  // 上一轮绑错时先纠正：一个经营主体只能对应一份监管档案，留着错绑会让解析出现二义性
  const conflict = (subjects ?? []).find((item) => String(item.merchantId ?? '') === merchantId
    && item.id !== target.id)
  if (conflict) {
    unwrap(await gov(`/api/v1/government/ops/subjects/${conflict.id}/merchant-binding`, {
      method: 'PUT', ...auth, body: { merchantId: '' },
    }), '纠正上一轮的错绑')
    console.log(`  · 已解除「${conflict.subjectName}」对经营主体 ${merchantId} 的绑定（上一轮绑错）`)
  }
  const boundSubject = unwrap(await gov(`/api/v1/government/ops/subjects/${target.id}/merchant-binding`, {
    method: 'PUT', ...auth, body: { merchantId },
  }), '绑定监管主体档案')
  check(String(boundSubject?.merchantId ?? '') === merchantId,
    `监管主体档案「${boundSubject?.subjectName}」已绑定平台经营主体`, `信用分=${boundSubject?.creditScore}`)

  // 4) 三账号自检
  const inspectorIdentity = unwrap(await gov('/api/v1/government/identity', { token: inspectorToken }), '执法账号身份卡')
  check(String(inspectorIdentity?.inspectorId ?? '') === String(profile.id),
    '身份卡把执法账号解析成档案里的人', `${inspectorIdentity?.inspectorName} / ${inspectorIdentity?.certificateNo}`)
  check(inspectorIdentity?.roles?.inspector === true && inspectorIdentity?.roles?.admin === false,
    '执法账号有执法权限、没有运营权限')
  const workbench = await gov('/api/v1/government/mobile/workbench', { token: inspectorToken })
  check(workbench.code === 200 && workbench.data?.inspector?.name === INSPECTOR_NAME,
    '移动执法工作台按登录者读数（不是写死的王磊）',
    `待办任务=${workbench.data?.stats?.pendingTasks}`)
  const inspectorOps = await gov('/api/v1/government/ops/subjects', { token: inspectorToken })
  check(inspectorOps.status === 403, '执法账号打不开监管运营端', inspectorOps.message)
  const inspectorCitizen = await gov('/api/v1/government/home', { token: inspectorToken })
  check(inspectorCitizen.status === 403, '执法账号不能以主体身份办事项（缺 gov:citizen）',
    String(inspectorCitizen.status))

  const adminIdentity = unwrap(await gov('/api/v1/government/identity', auth), '运营账号身份卡')
  check(String(adminIdentity?.subjectId ?? '') === String(target.id),
    '运营账号按经营主体解析到监管主体档案', `${adminIdentity?.subjectName}`)
  const home = await gov('/api/v1/government/home', auth)
  check(home.code === 200 && home.data?.subject?.subjectName === boundSubject?.subjectName,
    '主体端首页读到的是自己档案（由令牌解析）',
    `待办 ${ (home.data?.todos ?? []).length } 条 / 未读 ${home.data?.stats?.unreadMessages}`)

  // 未绑定监管档案的主体账号必须被明确拒绝，并说明该找谁
  const outsider = await login('luochuan')
  const outsiderHome = await gov('/api/v1/government/home', { token: outsider?.accessToken ?? '' })
  check(outsiderHome.status === 403 && /绑定|档案/.test(outsiderHome.message ?? ''),
    '未绑定监管档案的主体账号被拒绝且原因可操作', outsiderHome.message)

  console.log(`\n执法账号：${USERNAME} / ${PASSWORD}　移动执法端：http://localhost:8109/`)
  console.log(`主体端：http://localhost:8108/gov/　运营端：http://localhost:8110/gov-ops/`)
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
