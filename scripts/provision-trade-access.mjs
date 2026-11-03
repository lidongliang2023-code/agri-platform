#!/usr/bin/env node
/**
 * 开通交易域的业务身份（幂等，全部走既有接口，不直接改库）。
 *
 * 为什么需要它：交易域的写接口由 `TradeCapabilityInterceptor` 按**业务身份**把关 ——
 * 采购类（/api/trade/demand/**）要 trade.wholesale / trade.retail，
 * 成交类（order / negotiation / guarantee / compensation …）要任一交易身份。
 * 而演示数据里 approved 的业务身份只有两条：inspector=government、provider=service_provider。
 * 也就是说 **farmer / luochuan / admin 走到任何一条交易写接口都是 403**：
 * 下单、询价、报价、发货、退款申请这些主链路在本地环境里从来没真正跑通过，
 * 页面上一律显示"需要已开通交易类业务身份"。
 *
 * 这个脚本做的事：
 *   1) 用账号自己的令牌提交 `wholesaler`（批发商）身份申请；
 *   2) 用运营端接口把该申请审核通过（审核人由平台侧从令牌取）；
 *   3) 自检：拿一条**不会落库**的校验分支验证能力已放行
 *      （POST /negotiation/inquiry 空 body —— 被拦截器挡下是 403，
 *       被参数校验挡下说明身份已通，两种都会返回错误但含义完全不同，且不产生数据）。
 *
 * 用法：
 *   node scripts/provision-trade-access.mjs
 *   node scripts/provision-trade-access.mjs --accounts farmer,luochuan
 */
import { pathToFileURL } from 'node:url'

const CORE = process.env.AGRI_CORE_URL || 'http://localhost:8093'
const TRADE = process.env.AGRI_TRADE_URL || 'http://localhost:8089'
const DEMO_PASSWORD = process.env.AGRI_DEMO_PASSWORD || 'Admin@123'
/**
 * 默认给这三个账号开通：
 *   2001 绿源农业合作社（farmer，采购方）、
 *   2003 陕西洛川果业（luochuan，供货方）、
 *   建国农机合作社（provider，与上面两家都无关的第三方对照）。
 * 第三个是判权断言要的"有交易身份、但不是这张单据的参与方"——
 * 少了它，跨主体用例只能拿"没有业务身份的账号"去撞能力闸门（403），
 * 看着像拒了，其实根本没走到判权那一层。
 */
const DEFAULT_ACCOUNTS = ['farmer', 'luochuan', 'provider']

async function request(base, path, options = {}, token) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  const response = await fetch(`${base}${path}`, { ...options, headers })
  const text = await response.text()
  try {
    return { status: response.status, body: JSON.parse(text) }
  } catch {
    return { status: response.status, body: { code: -1, message: text.slice(0, 160), data: null } }
  }
}

/**
 * 账号密码表。
 *
 * 演示账号并不共用一个密码：`admin` 是 Admin@123，而 UI 夹具账号（如 19900002005）用 Test12345。
 * 原来这里只有一个 DEMO_PASSWORD，所以 `--accounts=19900002005` 一定登录失败，
 * 那个账号的交易身份就永远开不出来，依赖它的 e2e 全部卡在 403「需要已开通交易类业务身份」。
 * 现在支持 `--accounts=farmer,19900002005:Test12345` 显式给密码；不给则回落到 AGRI_DEMO_PASSWORD。
 */
const ACCOUNT_PASSWORDS = new Map()

export async function login(username, password = ACCOUNT_PASSWORDS.get(username) ?? DEMO_PASSWORD) {
  const { body } = await request(CORE, '/api/v1/sso/login-standalone', {
    method: 'POST',
    body: JSON.stringify({ username, password, marketId: 1, remember: true }),
  })
  if (!body?.data?.accessToken) {
    throw new Error(`${username} 登录失败：code=${body?.code} message=${body?.message}`)
  }
  return body.data.accessToken
}

/** 账号在当前主体下的业务身份清单（identities: [{code,status,...}]）。 */
async function identitiesOf(token) {
  const { body } = await request(CORE, '/api/v1/sso/account/identity-applications', { method: 'GET' }, token)
  return body?.data?.identities ?? []
}

/**
 * 确保账号拥有已通过的批发商身份，返回 { token, status, applied, reviewed }。
 *
 * @param identityType 身份类型（wholesaler 给 trade.wholesale，落在采购与成交两类能力里）
 * @param subjectName  申请里填写的主体名称（审核页展示用，取平台档案里的真实主体名）
 * @param userId       账号的平台用户号；审核台的待审列表按申请人过滤（雪花号一律按字符串比）
 */
export async function ensureWholesalerIdentity(username, identityType, subjectName, userId) {
  const token = await login(username)
  const adminToken = await login('admin')
  const before = (await identitiesOf(token)).find((item) => item.code === identityType)
  let applied = false
  if (!before || before.status === 'available' || before.status === 'rejected') {
    const { body } = await request(CORE, '/api/v1/sso/account/identity-applications', {
      method: 'POST',
      body: JSON.stringify({ identityType, subjectName }),
    }, token)
    if (body.code !== 0 && body.code !== 200) {
      throw new Error(`${username} 提交业务身份申请失败：code=${body.code} message=${body.message}`)
    }
    applied = true
  }

  let reviewed = false
  if (applied) {
    const { body: pendingBody } = await request(
      CORE,
      '/api/v1/admin/identity-applications?pageNum=1&pageSize=100&status=pending',
      { method: 'GET' },
      adminToken,
    )
    const list = pendingBody?.data?.records ?? pendingBody?.data?.list ?? pendingBody?.data?.items ?? []
    const mine = list.find((item) => item.identityType === identityType
      && String(item.userId ?? '') === String(userId ?? ''))
    if (!mine) {
      throw new Error(`${username} 的待审身份申请没在审核台里找到（提交后查不到，可能是主体名称或申请人过滤条件不对）`)
    }
    const { body } = await request(CORE, `/api/v1/admin/identity-applications/${mine.id}/review`, {
      method: 'POST',
      body: JSON.stringify({ approved: true, remark: '交易域联调：批发商资质审核通过' }),
    }, adminToken)
    if (body.code !== 0 && body.code !== 200) {
      throw new Error(`${username} 业务身份审核失败：code=${body.code} message=${body.message}`)
    }
    reviewed = true
  }

  const after = (await identitiesOf(token)).find((item) => item.code === identityType)
  return { token, status: after?.status ?? 'unknown', applied, reviewed }
}

/**
 * 自检：交易域的写接口是否已经放行。
 *
 * 用一条**必定不落库**的分支验证：空 body 的询价请求。
 * 被能力拦截器挡下 → 403「需要已开通交易类业务身份」；
 * 走到控制器 → 业务校验消息（"请指定要对哪个货源发起询价"）。
 * 两种都是错误响应，但含义完全不同，而后者说明能力闸门已经打开。
 */
export async function probeTradeWrite(token) {
  const { status, body } = await request(TRADE, '/api/trade/negotiation/inquiry', {
    method: 'POST',
    body: JSON.stringify({}),
  }, token)
  const message = body?.message ?? ''
  const blockedByCapability = status === 403 && message.includes('业务身份')
  return { blockedByCapability, passedCapability: !blockedByCapability, status, message }
}

async function main() {
  const argNames = process.argv.find((arg) => arg.startsWith('--accounts='))
  const accounts = (argNames ? argNames.split('=')[1].split(',') : DEFAULT_ACCOUNTS)
    .map((item) => item.trim()).filter(Boolean)
    .map((item) => {
      // 支持 user:password；密码里带冒号时按第一个冒号切（用户名不含冒号）
      const at = item.indexOf(':')
      if (at < 0) return item
      const username = item.slice(0, at)
      ACCOUNT_PASSWORDS.set(username, item.slice(at + 1))
      return username
    })
  const failures = []
  const ok = (label, extra = '') => console.log(`✓ ${label}${extra ? `　${extra}` : ''}`)
  const bad = (label, extra = '') => {
    console.log(`✗ ${label}${extra ? `　${extra}` : ''}`)
    failures.push(label)
  }

  for (const username of accounts) {
    let subjectName = ''
    let userId = ''
    try {
      const token = await login(username)
      const { body } = await request(CORE, '/api/v1/platform/merchants/mine', { method: 'GET' }, token)
      subjectName = body?.data?.[0]?.merchantName ?? ''
      userId = String(body?.data?.[0]?.userId ?? '')
    } catch (error) {
      bad(`${username} 读取绑定主体`, error.message)
      continue
    }
    if (!subjectName) {
      bad(`${username} 没有绑定的经营主体`, '交易域写接口需要先有主体（否则下单一律报"未绑定经营主体"）')
      continue
    }
    try {
      const result = await ensureWholesalerIdentity(username, 'wholesaler', subjectName, userId)
      const probe = await probeTradeWrite(result.token)
      if (result.status === 'approved' && probe.passedCapability) {
        ok(`${username} 批发商身份已生效`,
          `status=${result.status}${result.applied ? '（本次新申请并审核通过）' : '（已存在，跳过）'}`)
      } else {
        bad(`${username} 交易写权限未放行`,
          `status=${result.status} probe=${probe.status} ${probe.message}`)
      }
    } catch (error) {
      bad(`${username} 开通业务身份`, error.message)
    }
  }

  if (failures.length) {
    console.log(`\n开通失败 ${failures.length} 项：${failures.join('、')}`)
    process.exitCode = 1
  } else {
    console.log('\n交易域业务身份已就绪，可以跑 node scripts/e2e-trade-identity.mjs')
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
