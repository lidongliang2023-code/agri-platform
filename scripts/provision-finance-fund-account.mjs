/**
 * 开通供应链金融资金方账号（幂等，全部走平台既有接口，不直接改库）
 *
 * 做四件事：
 *   1) 确保"丰链云合作银行"在客商中心有经营主体档案；
 *   2) 确保 FINANCE_FUND 角色存在（V38 迁移建的），并按该角色建账号 fund；
 *   3) 把账号与该主体绑定（用户↔经营主体，决定"这个登录账号是哪个主体"）；
 *   4) 通过金融运营端接口把资金机构 PROVIDER-BANK-001 绑到该主体（决定"这个主体能进哪家机构的工作台"）。
 *
 * 用法：node scripts/provision-finance-fund-account.mjs
 *   默认口令 Admin@123（与本地其它演示账号一致，可用 FINANCE_FUND_PASSWORD 覆盖）。
 */
const CORE = process.env.CORE_URL || 'http://localhost:8093'
const FIN = process.env.FINANCE_URL || 'http://localhost:8087'
const USERNAME = process.env.FINANCE_FUND_USERNAME || 'fund'
const PASSWORD = process.env.FINANCE_FUND_PASSWORD || 'Admin@123'
const MARKET_ID = 1
const BANK_NAME = '丰链云合作银行'
const BANK_CREDIT_CODE = '91310000MA1K123456'

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
const fin = (path, options) => call(FIN, path, options)

const unwrap = (result, label) => {
  if (result.status >= 400 || (result.code !== 0 && result.code !== 200)) {
    throw new Error(`${label}失败：${result.message || `HTTP ${result.status}`}`)
  }
  return result.data
}

async function main() {
  const login = unwrap(await core('/api/v1/auth/login', {
    method: 'POST', body: { username: 'admin', password: 'Admin@123', marketId: MARKET_ID },
  }), '平台管理员登录')
  const token = login?.accessToken ?? ''
  check(Boolean(token), '以 admin 取得平台运营令牌')
  const auth = { token }

  // 1) 经营主体
  const merchantPage = unwrap(await core(
    `/api/v1/admin/merchants?page=1&size=20&keyword=${encodeURIComponent(BANK_NAME)}`, auth), '查询经营主体')
  const records = merchantPage?.records ?? []
  let merchant = records.find((item) => item.name === BANK_NAME)
  if (!merchant) {
    const createdId = unwrap(await core('/api/v1/admin/merchants', {
      method: 'POST', ...auth,
      body: {
        code: 'BANK-FINANCE-001', name: BANK_NAME, type: 'BOTH', creditCode: BANK_CREDIT_CODE,
        contactName: '陈资金', contactPhone: '13800138100', status: 1,
      },
    }), '创建资金方经营主体')
    merchant = unwrap(await core(`/api/v1/admin/merchants/${createdId}`, auth), '回读资金方经营主体')
  }
  const merchantId = String(merchant.id)
  check(Boolean(merchantId), '资金方经营主体已就绪', `${merchantId} ${merchant.name}`)

  // 2) 角色与账号
  const roles = unwrap(await core('/api/v1/admin/roles', auth), '查询平台角色')
  const fundRole = (roles ?? []).find((item) => item.code === 'FINANCE_FUND')
  if (!fundRole) {
    throw new Error('平台角色 FINANCE_FUND 不存在（应由迁移 V38 建好），请先执行 core-platform 迁移')
  }
  const userPage = unwrap(await core(
    `/api/v1/admin/users?page=1&size=20&keyword=${encodeURIComponent(USERNAME)}`, auth), '查询账号')
  const existing = (userPage?.records ?? []).find((item) => item.username === USERNAME)
  let userId = existing ? String(existing.id) : ''
  if (!userId) {
    userId = String(unwrap(await core('/api/v1/admin/users', {
      method: 'POST', ...auth,
      body: {
        username: USERNAME, nickname: `${BANK_NAME} · 资金经办`, phone: '13800138100',
        password: PASSWORD, marketId: MARKET_ID, roleId: Number(fundRole.id),
      },
    }), '创建资金方账号'))
  }
  check(Boolean(userId), '资金方账号已就绪', `${USERNAME}(id=${userId}) 角色=${fundRole.code}`)

  // 3) 账号 ↔ 主体绑定
  const bindings = unwrap(await core(`/api/v1/admin/user-merchants?page=1&size=50&userId=${userId}`, auth),
    '查询账号主体绑定')
  const bound = (bindings?.records ?? []).some((item) => String(item.merchantId) === merchantId)
  if (!bound) {
    unwrap(await core('/api/v1/admin/user-merchants', {
      method: 'POST', ...auth,
      // 主体号与用户号都是雪花 ID（> 2^53），必须按字符串传：Number() 会丢精度，
      // 表现为"经营主体不存在"这种把人引向错误方向的报错。
      body: { userId, merchantId, roleInMerchant: 'owner' },
    }), '绑定账号与经营主体')
  }
  check(true, '账号已绑定到资金方经营主体', bound ? '（已存在，跳过）' : merchantId)

  // 4) 资金机构 ↔ 主体绑定（金融运营端接口，运营权限）
  const providerList = unwrap(await fin('/api/v1/fund-provider/admin/list', auth), '读取资金机构台账')
  const provider = (providerList?.items ?? []).find((item) => item.institutionName === BANK_NAME)
    ?? (providerList?.items ?? [])[0]
  if (!provider) {
    throw new Error('资金机构台账为空：请先在资金方端注册机构或补种子里建机构档案')
  }
  const bindingResult = unwrap(await fin(`/api/v1/fund-provider/${provider.id}/binding`, {
    method: 'PUT', ...auth, body: { merchantId },
  }), '绑定资金机构与主体')
  check(bindingResult?.provider?.merchantId === merchantId,
    `资金机构「${bindingResult?.provider?.institutionName}」已绑定经营主体`, provider.id)

  // 5) 用资金方账号验证链路
  const fundLogin = unwrap(await core('/api/v1/auth/login', {
    method: 'POST', body: { username: USERNAME, password: PASSWORD, marketId: MARKET_ID },
  }), '资金方账号登录')
  const fundToken = fundLogin?.accessToken ?? ''
  check(Boolean(fundToken), `${USERNAME} 登录成功`)
  const subject = await fin('/api/v1/finance/subject', { token: fundToken })
  check(subject.data?.borrowerId === merchantId, '身份卡解析到资金方主体', String(subject.data?.borrowerId))
  check(subject.data?.providerId === provider.id, '身份卡解析到资金机构', String(subject.data?.providerId))
  check(subject.data?.roles?.fund === true, '资金方权限位为真')
  const workbench = await fin('/api/v1/fund-workbench/mine', { token: fundToken })
  check(workbench.code === 200, '资金工作台可读（非超管账号）', workbench.message)
  // 角色边界：FINANCE_FUND 只有 read/write/fund/review，没有 borrower 与 admin
  const asBorrower = await fin('/api/v1/loan/apply', {
    method: 'POST', token: fundToken, body: { productType: 'agri', applyAmount: 10000, applyTerm: 3 },
  })
  check(asBorrower.status === 403, '资金方账号不能以融资方身份发起申请', String(asBorrower.code))
  const asOps = await fin('/api/v1/overdue/list', { token: fundToken })
  check(asOps.status === 403, '资金方账号读不到运营端逾期台账', String(asOps.code))

  console.log(`\n账号：${USERNAME} / ${PASSWORD}　主体号：${merchantId}　机构号：${provider.id}`)
  console.log('资金端入口：http://localhost:8081/finance/#/fund/workbench')
}

main()
  .catch((error) => {
    failures.push(error.message)
    console.error(error)
  })
  .finally(() => {
    console.log(`\n${failures.length === 0 ? '开通与自检全部通过' : `失败 ${failures.length} 项：${failures.join(' / ')}`}`)
    process.exit(failures.length === 0 ? 0 : 1)
  })
