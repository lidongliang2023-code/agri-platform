/**
 * 供应链金融主链路端到端联调（融资方端 + 资金方/运营端 + 数据库落库）
 *
 * 链路：
 *   令牌解析身份（融资主体 / 资金机构绑定） → 越权与数据范围回归
 *   → 融资申请 → 资金方审批（生成资产 + 站内信）
 *   → 仓单链路：生产域已入库批次 → 核对库存与链上存证 → 生成仓单 → 按仓单质押 → 运营审核生效
 *   → 确认借款（生成合同） → 双方签署（签齐才放款，同时把担保落到借款上）
 *   → 借款 + 还款计划落库 → 还款 → 结清（质押与仓单自动释放 + 站内信）
 *   → 到期未还扫描 → 逾期台账 + 授信重算 → 催收分配 → 结清
 *   → 黑名单复核生效 → 申请被拒 → 解除后可再申请
 *
 * 用法：node scripts/e2e-finance-flow.mjs
 *   前置：core-platform :8093、agri-finance :8087、MySQL 3306 在跑。
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const CORE = 'http://localhost:8093'
const FIN = 'http://localhost:8087'
const MYSQL = 'C:/Program Files/MySQL/MySQL Server 8.4/bin/mysql.exe'
const PASSWORD = 'Admin@123'
const MARKER = 'E2E金融闭环'
// 融资能力（finance.apply）要求经营主体认证通过；主体 2001 的认证单是历史 pending 状态，
// 测试把它临时改成 approved 打通正例，finally 按原值还原（不新增、不删除认证行）。
const CERT_MERCHANT = 2001
const USERNAME = process.env.FINANCE_FUND_USERNAME || 'fund'

const sql = (query) => {
  if (!existsSync(MYSQL)) return ''
  const result = spawnSync(MYSQL,
    ['-uroot', '-proot', '--default-character-set=utf8mb4', '-N', '-B', '-e', query], { encoding: 'utf8' })
  if (result.status !== 0) return `ERR:${String(result.stderr ?? '').trim().slice(0, 200)}`
  return String(result.stdout ?? '').trim()
}

/** 清理里的每条 SQL 都要能看见失败，否则"残留为 0/为 2"会被误判成业务问题。 */
const exec = (query) => {
  const result = sql(query)
  if (String(result).startsWith('ERR')) {
    console.log(`  ! SQL 失败：${result}　← ${query.replace(/\s+/g, ' ').slice(0, 110)}`)
  }
  return result
}

/** 业务行删掉之后，站内信与资产会留下"指向不存在单据"的孤儿行；每条链路收尾都扫一遍。 */
const SWEEP_ORPHANS = `
  USE agri_finance;
    DELETE IGNORE a FROM agri_finance.asset a
    LEFT JOIN agri_finance.loan_application la ON la.id = SUBSTRING(a.id, 11)
    WHERE a.id LIKE 'ASSET-APP-%' AND la.id IS NULL;
    DELETE IGNORE m FROM agri_finance.message_notification m
    LEFT JOIN agri_finance.loan_application la ON la.id = m.related_biz_id
    LEFT JOIN agri_finance.loan l ON l.id = m.related_biz_id
    LEFT JOIN agri_finance.contract c ON c.id = m.related_biz_id
    LEFT JOIN agri_finance.asset ast ON ast.id = m.related_biz_id
    LEFT JOIN agri_finance.overdue_record od ON od.id = m.related_biz_id
    LEFT JOIN agri_finance.blacklist b ON b.id = m.related_biz_id
    LEFT JOIN agri_finance.investment iv ON iv.id = m.related_biz_id
    LEFT JOIN agri_finance.pledge p ON p.id = m.related_biz_id
    LEFT JOIN agri_finance.repayment_plan rp ON rp.id = m.related_biz_id
    WHERE m.related_biz_type IN ('LOAN_APPLICATION','LOAN','CONTRACT','ASSET','OVERDUE_RECORD',
      'BLACKLIST','INVESTMENT','PLEDGE','REPAYMENT_PLAN')
      AND la.id IS NULL AND l.id IS NULL AND c.id IS NULL AND ast.id IS NULL AND od.id IS NULL
      AND b.id IS NULL AND iv.id IS NULL AND p.id IS NULL AND rp.id IS NULL;`

const failures = []
const check = (ok, label, extra = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${extra ? `　${extra}` : ''}`)
  if (!ok) failures.push(label)
}

const login = async (username) => {
  const response = await fetch(`${CORE}/api/v1/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: PASSWORD, marketId: 1 }),
  })
  const body = await response.json().catch(() => null)
  return body?.data?.accessToken ?? ''
}

/** 金融接口有两种失败：HTTP 4xx（RBAC 拦截）与 HTTP 200 + code!=200（业务判定）。 */
const api = async (token, method, path, body) => {
  const response = await fetch(`${FIN}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
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

const ids = {
  application1: '', application2: '', application3: '', contract1: '', loan1: '', plan1: '',
  loan2: '', plan2: '', overdueRecordId: '', blacklistId: '',
  receipt1: '', receipt2: '', receiptNo: '', pledge1: '',
}
let creditSnapshot = ''
let certBefore = ''
let providerBoundBefore = ''

function applyPayload(fundPurpose, applyAmount = 20000) {
  return {
    productType: 'agri',
    applyAmount,
    applyTerm: 3,
    repaymentMethod: '到期一次还本付息',
    fundPurpose: `${MARKER} ${fundPurpose}`,
    repaymentSource: '果蔬销售回款',
    contactName: '张建国',
    contactPhone: '13900001111',
  }
}

/**
 * 仓单链路本轮数据的标记与清理：
 *   仓单写在 location、质押写在 warehouse_address、监控快照按 receipt_id 连带删除。
 * 顺序是先解开质押再删仓单，反过来越过没有意义但也不会出错 —— 只是会留下指向空仓单的快照。
 */
const markerReceipts = () => {
  const rows = String(sql(
    `SELECT GROUP_CONCAT(CONCAT(id,'~',receipt_no)) FROM agri_finance.warehouse_receipt
      WHERE location LIKE '%${MARKER}%'`,
  ) || '')
  if (!rows || rows.startsWith('ERR') || rows === 'NULL') return []
  return rows.split(',').map((pair) => {
    const [id, receiptNo] = pair.split('~')
    return { id, receiptNo }
  }).filter((item) => item.id)
}

function purgeReceiptChain() {
  const receipts = markerReceipts()
  exec(`DELETE FROM agri_finance.pledge WHERE warehouse_address LIKE '%${MARKER}%'`)
  if (receipts.length) {
    const quote = (values) => values.map((value) => `'${value}'`).join(',')
    exec(`DELETE FROM agri_finance.pledge_monitor WHERE receipt_id IN (${quote(receipts.map((item) => item.id))})`)
    if (receipts.some((item) => item.receiptNo)) {
      exec(`DELETE FROM agri_finance.pledge_monitor WHERE receipt_no IN (${quote(
        receipts.map((item) => item.receiptNo).filter(Boolean),
      )})`)
    }
    exec(`DELETE FROM agri_finance.warehouse_receipt WHERE id IN (${quote(receipts.map((item) => item.id))})`)
  }
  // 别的脚本（如浏览器点检）中断时留下的仓单没有本轮标记，但它同样会挡住
  // "同一批次只能有一张未释放仓单"这道闸门，看起来像本轮失败。这三张表都没有种子数据，
  // 存在即测试产物，所以整表清一次（种子质押的 receipt_id 为空，不会被误删）。
  exec('DELETE FROM agri_finance.pledge_monitor')
  exec('DELETE FROM agri_finance.warehouse_receipt')
  exec('DELETE FROM agri_finance.pledge WHERE receipt_id IS NOT NULL')
}

/** 上一轮中断留下的带标记数据先清干净，判据才只反映本轮行为。 */
function purgePreviousRuns() {
  purgeReceiptChain()
  exec(SWEEP_ORPHANS)
  purgeReceiptChain()
  const stale = sql(`SELECT GROUP_CONCAT(id) FROM agri_finance.loan_application WHERE fund_purpose LIKE '%${MARKER}%'`)
  const list = String(stale || '').split(',').map((id) => id.trim()).filter((id) => id && !id.startsWith('ERR'))
  if (list.length) {
    const quoted = list.map((id) => `'${id}'`).join(',')
    const loans = String(sql(`SELECT GROUP_CONCAT(id) FROM agri_finance.loan WHERE application_id IN (${quoted})`) || '')
      .split(',').filter((id) => id && id !== 'NULL')
    if (loans.length) {
      const loanList = loans.map((id) => `'${id}'`).join(',')
      exec(`DELETE FROM agri_finance.repayment_plan WHERE loan_id IN (${loanList})`)
      exec(`DELETE FROM agri_finance.overdue_record WHERE loan_id IN (${loanList})`)
      exec(`DELETE FROM agri_finance.loan WHERE id IN (${loanList})`)
    }
    exec(`DELETE FROM agri_finance.contract WHERE application_id IN (${quoted})`)
    exec(`DELETE FROM agri_finance.finance_approval_record WHERE application_id IN (${quoted})`)
    exec(`DELETE FROM agri_finance.asset WHERE id IN (${list.map((id) => `'ASSET-APP-${id}'`).join(',')})`)
    exec(`DELETE FROM agri_finance.loan_application WHERE id IN (${quoted})`)
  }
  exec(`DELETE FROM agri_finance.blacklist WHERE reason LIKE '%${MARKER}%'`)
  exec(`DELETE FROM agri_finance.message_notification WHERE title LIKE '%${MARKER}%' OR content LIKE '%${MARKER}%'`)
}

function certifyMerchant() {
  certBefore = sql(`SELECT CONCAT(id,'#',IFNULL(cert_status,'')) FROM agri_core.platform_merchant_certification
    WHERE merchant_id=${CERT_MERCHANT} AND deleted=0 ORDER BY id DESC LIMIT 1`)
  const [certId, status] = String(certBefore).split('#')
  check(Boolean(certId) && !String(certBefore).startsWith('ERR'), '找到融资主体的认证单', certBefore)
  if (!certId || String(certBefore).startsWith('ERR')) return
  exec(`UPDATE agri_core.platform_merchant_certification SET cert_status='approved' WHERE id=${certId}`)
}

async function main() {
  const admin = await login('admin')
  const farmer = await login('luochuan')
  check(Boolean(admin) && Boolean(farmer), '两个测试账号登录成功（admin / luochuan）')
  purgePreviousRuns()

  // ---------- 1. 身份由令牌解析 ----------
  const adminSubject = await api(admin, 'GET', '/api/v1/finance/subject')
  check(adminSubject.code === 200 && adminSubject.data?.borrowerId === '2001',
    'admin 身份卡解析出融资主体 2001', String(adminSubject.data?.borrowerName))
  const farmerSubject = await api(farmer, 'GET', '/api/v1/finance/subject')
  check(farmerSubject.data?.borrowerId === '2003',
    'luochuan 身份卡解析出融资主体 2003', String(farmerSubject.data?.borrowerName))

  const anonymous = await fetch(`${FIN}/api/v1/finance/subject`)
  check(anonymous.status === 401, '未带令牌访问身份卡返回 401', String(anonymous.status))

  providerBoundBefore = sql(`SELECT IFNULL(merchant_id,'') FROM agri_finance.fund_provider WHERE id='PROVIDER-BANK-001'`)
  // 资金机构已经由 scripts/provision-finance-fund-account.mjs 绑到真实资金方主体上，
  // 这里不再临时改绑定：审批/放款/回款都用 fund 账号跑，才验得出"运营不能替机构审批"这条边界。
  const fund = await login(USERNAME)
  if (!fund) {
    throw new Error(`资金方账号 ${USERNAME} 登录失败，请先执行 node scripts/provision-finance-fund-account.mjs`)
  }
  const unboundWorkbench = await api(admin, 'GET', '/api/v1/fund-workbench/mine')
  check(unboundWorkbench.code === 403 && String(unboundWorkbench.message).includes('资金机构'),
    '运营账号（主体未绑机构）打不开资金工作台', unboundWorkbench.message)

  const boundSubject = await api(fund, 'GET', '/api/v1/finance/subject')
  check(boundSubject.data?.providerId === 'PROVIDER-BANK-001' && boundSubject.data?.providerReady === true,
    '资金方账号解析出绑定的资金机构（providerReady）', `${boundSubject.data?.borrowerId} / ${boundSubject.data?.providerName}`)

  const farmerWorkbench = await api(farmer, 'GET', '/api/v1/fund-workbench/mine')
  check(farmerWorkbench.status === 403, '融资方账号打不开资金工作台（缺 finance:fund）', farmerWorkbench.message)

  certifyMerchant()

  // ---------- 2. 数据范围与越权 ----------
  const foreignLoans = await api(farmer, 'GET', '/api/v1/loan/list?userId=2001')
  check(foreignLoans.code === 200 && (foreignLoans.data ?? []).every((item) => String(item.userId) === '2003'),
    '融资方传别人的主体号也只会拿到自己的借款', `rows=${(foreignLoans.data ?? []).length}`)

  const foreignContracts = await api(farmer, 'GET', '/api/v1/contract/list?userId=2001')
  check((foreignContracts.data ?? []).length === 0, '融资方读不到他人合同',
    `rows=${(foreignContracts.data ?? []).length}`)

  const foreignSign = await api(farmer, 'POST', '/api/v1/contract/sign', { id: 'CONTRACT-002' })
  check(foreignSign.code === 403, '融资方不能签署他人合同', foreignSign.message)

  const foreignPay = await api(farmer, 'POST', '/api/v1/repayment/pay', { planId: 'PLAN-002' })
  check(foreignPay.code === 403, '融资方不能替他人账单还款', foreignPay.message)

  const farmerReview = await api(farmer, 'POST', '/api/v1/loan/review', { id: 'APP-20261015', result: '已通过' })
  check(farmerReview.status === 403, '融资方没有审批权限（HTTP 403）', String(farmerReview.status))

  const farmerInbox = await api(farmer, 'GET', '/api/v1/message/list?userId=2001')
  check(farmerInbox.code === 403, '融资方不能读别人的收件箱', farmerInbox.message)

  const operatorScoped = await api(admin, 'GET', '/api/v1/loan/applications?userId=2002')
  check(operatorScoped.code === 200 && (operatorScoped.data ?? []).every((item) => String(item.userId) === '2002'),
    '运营角色仍可按主体筛台账', `rows=${(operatorScoped.data ?? []).length}`)

  // ---------- 3. 申请（主体以令牌为准） ----------
  creditSnapshot = sql(`SELECT CONCAT_WS('|',IFNULL(composite_score,''),IFNULL(available_amount,''),
    IFNULL(overdue_count,''),IFNULL(total_transaction_amount,''),IFNULL(fulfillment_rate,''))
    FROM agri_finance.credit_score WHERE user_id='2001' ORDER BY created_at DESC LIMIT 1`)

  const apply = await api(admin, 'POST', '/api/v1/loan/apply', { userId: '2002', ...applyPayload('采购有机肥') })
  ids.application1 = apply.data?.id ?? ''
  check(apply.code === 200 && Boolean(ids.application1), '融资申请提交成功', apply.message)
  check(sql(`SELECT user_id FROM agri_finance.loan_application WHERE id='${ids.application1}'`) === '2001',
    '申请落库的融资主体来自令牌（忽略请求里的 2002）')
  check(sql(`SELECT status FROM agri_finance.loan_application WHERE id='${ids.application1}'`) === '待审批',
    '申请初始状态为待审批')

  // ---------- 4. 资金方审批 → 资产 → 站内信 ----------
  const approved = await api(fund, 'POST', '/api/v1/loan/review', {
    id: ids.application1, result: '已通过', opinion: `${MARKER} 审批通过`, amount: 20000, rate: 6,
  })
  check(approved.code === 200, '资金方审批通过（机构与审批人取登录身份）', approved.message)
  check(sql(`SELECT reviewer_id FROM agri_finance.loan_application WHERE id='${ids.application1}'`)
    === String(approved.data?.application?.reviewerId ?? ''), '审批人留痕为平台用户号而非前端参数')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.finance_approval_record WHERE application_id='${ids.application1}'`)) === 1,
    '审批留痕落库 1 条')
  ids.assetId = String(approved.data?.generatedAsset?.id ?? '')
  check(Boolean(ids.assetId), '审批通过生成可投资产', ids.assetId)
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.message_notification
    WHERE user_id='2001' AND related_biz_id='${ids.application1}'`)) >= 1, '审批结果写入融资方站内信')

  const duplicate = await api(fund, 'POST', '/api/v1/loan/review', {
    id: ids.application1, result: '已通过', amount: 20000, rate: 6,
  })
  check(duplicate.code === 409, '重复审批被拒（不能二次改判）', duplicate.message)

  // ---------- 5. 仓单链路：批次 → 仓单 → 质押 → 审核生效 ----------
  const goodsOptions = await api(farmer, 'GET', '/api/v1/pledge-goods/enabled')
  check(goodsOptions.code === 200 && (goodsOptions.data ?? []).length > 0,
    '融资方能读质押物字典（折算率上限是开单口径，不是运营专属）', `rows=${(goodsOptions.data ?? []).length}`)
  const tomato = (goodsOptions.data ?? []).find((item) => item.goodsCode === 'PG-TOMATO')
  check(Boolean(tomato) && Number(tomato.pledgeRateMax) > 0, '字典里找到本批货对应的品种与上限',
    tomato ? `${tomato.goodsName} ${tomato.pledgeRateMax}%` : 'PG-TOMATO 缺失')

  const batches = await api(admin, 'GET', '/api/v1/warehouse-receipt/batches')
  const batch = (batches.data ?? [])[0] ?? null
  check(batches.code === 200 && Boolean(batch), '主体 2001 有已入库批次可开仓单',
    batch ? `${batch.batchNo} ${batch.cropName} ${batch.quantity}${batch.unit}` : `rows=${(batches.data ?? []).length}`)

  const otherBatches = await api(farmer, 'GET', '/api/v1/warehouse-receipt/batches')
  check((otherBatches.data ?? []).every((item) => item.batchNo !== batch?.batchNo),
    '别的主体（2003）看不到 2001 的批次', `rows=${(otherBatches.data ?? []).length}`)

  const preview = await api(admin, 'GET', `/api/v1/warehouse-receipt/batch-preview?batchId=${batch?.batchId}`)
  check(preview.code === 200 && Number(preview.data?.availableQuantity) > 0,
    '开单前核对到在库可用量', `available=${preview.data?.availableQuantity}${preview.data?.batch?.unit ?? ''}`)
  check(preview.data?.chain?.status === 'SUCCESS' && Boolean(preview.data?.chain?.txHash),
    '批次有成功的链上存证（生产域读回）', String(preview.data?.chain?.txHash ?? 'null'))

  const overStock = await api(admin, 'POST', '/api/v1/warehouse-receipt/create', {
    batchId: batch?.batchId, goodsCode: 'PG-TOMATO', quantity: Number(preview.data?.availableQuantity ?? 0) + 1,
    unitPrice: 6.5, location: `${MARKER} 超量`,
  })
  check(overStock.code === 400 && String(overStock.message).includes('在库可用量'),
    '仓单数量超过在库可用量被拒', overStock.message)

  const badGoods = await api(admin, 'POST', '/api/v1/warehouse-receipt/create', {
    batchId: batch?.batchId, goodsCode: 'PG-NOT-EXIST', quantity: 100, unitPrice: 6.5, location: `${MARKER} 错品种`,
  })
  check(badGoods.code === 404, '质押物字典里没有的品种开不出仓单', badGoods.message)

  const disabledGoods = await api(admin, 'POST', '/api/v1/warehouse-receipt/create', {
    batchId: batch?.batchId, goodsCode: 'PG-SHRIMP', quantity: 100, unitPrice: 6.5, location: `${MARKER} 停用品种`,
  })
  check(disabledGoods.code === 409 && String(disabledGoods.message).includes('停用'),
    '已停用的质押物品种不能开仓单', disabledGoods.message)

  const foreignBatch = await api(farmer, 'POST', '/api/v1/warehouse-receipt/create', {
    batchId: batch?.batchId, goodsCode: 'PG-TOMATO', quantity: 100, unitPrice: 6.5, location: `${MARKER} 跨主体`,
  })
  check(foreignBatch.code !== 200, '别的主体拿同一批次号开不出仓单',
    `${foreignBatch.code} ${foreignBatch.message}`)

  const receiptCreate = await api(admin, 'POST', '/api/v1/warehouse-receipt/create', {
    batchId: batch?.batchId, goodsCode: 'PG-TOMATO', quantity: 100, unitPrice: 6.5,
    location: `${MARKER} 批次仓单`,
  })
  ids.receipt1 = receiptCreate.data?.id ?? ''
  ids.receiptNo = receiptCreate.data?.receiptNo ?? ''
  check(receiptCreate.code === 200 && Boolean(ids.receipt1), '按已入库批次生成仓单', receiptCreate.message)
  check(sql(`SELECT status FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt1}'`) === '待质押',
    '仓单初始状态为待质押')
  check(sql(`SELECT user_id FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt1}'`) === '2001',
    '仓单归属取自令牌主体')
  check(sql(`SELECT batch_no FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt1}'`) === String(batch?.batchNo),
    '仓单绑定了生产域批次号', String(batch?.batchNo))
  check(sql(`SELECT blockchain_hash FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt1}'`)
    === String(preview.data?.chain?.txHash), '仓单存证 = 生产域链上哈希',
    String(receiptCreate.data?.blockchainHash ?? ''))
  check(Number(sql(`SELECT total_value FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt1}'`)) === 650,
    '货值 = 数量 × 单价落库', String(receiptCreate.data?.totalValue ?? ''))

  const duplicateReceipt = await api(admin, 'POST', '/api/v1/warehouse-receipt/create', {
    batchId: batch?.batchId, goodsCode: 'PG-TOMATO', quantity: 50, unitPrice: 6.5, location: `${MARKER} 重复开单`,
  })
  check(duplicateReceipt.code === 409 && String(duplicateReceipt.message).includes('同一批货'),
    '同一批次不能开第二张未释放仓单（重复担保）', duplicateReceipt.message)

  const pledgeOverCap = await api(admin, 'POST', '/api/v1/pledge/create', {
    receiptId: ids.receipt1, pledgeRate: Number(tomato?.pledgeRateMax ?? 55) + 10,
    warehouseAddress: `${MARKER} 超上限`,
  })
  check(pledgeOverCap.code === 400 && String(pledgeOverCap.message).includes('上限'),
    '折算率超过字典上限被拒', pledgeOverCap.message)

  const pledgeForeign = await api(farmer, 'POST', '/api/v1/pledge/create', {
    receiptId: ids.receipt1, pledgeRate: 40, warehouseAddress: `${MARKER} 跨主体质押`,
  })
  check(pledgeForeign.code === 403 && !pledgeForeign.data, '融资方不能把别人的仓单押出去', pledgeForeign.message)
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.pledge WHERE warehouse_address LIKE '%${MARKER}%'`)) === 0,
    '跨主体质押没有留下半条数据')

  const pledgeCreate = await api(admin, 'POST', '/api/v1/pledge/create', {
    receiptId: ids.receipt1, pledgeRate: 50, applicationId: ids.application1,
    warehouseAddress: `${MARKER} 仓单质押`,
  })
  ids.pledge1 = pledgeCreate.data?.id ?? ''
  check(pledgeCreate.code === 200 && Boolean(ids.pledge1), '按仓单发起质押（绑定本轮融资申请）', pledgeCreate.message)
  check(sql(`SELECT status FROM agri_finance.pledge WHERE id='${ids.pledge1}'`) === '待审核', '质押初始为待审核')
  check(sql(`SELECT receipt_id FROM agri_finance.pledge WHERE id='${ids.pledge1}'`) === ids.receipt1,
    '质押记录了来源仓单')
  check(sql(`SELECT status FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt1}'`) === '已质押',
    '仓单被质押占用（待质押 → 已质押）')
  check(Number(sql(`SELECT loan_amount FROM agri_finance.pledge WHERE id='${ids.pledge1}'`)) === 325,
    '可质押金额 = 货值 × 折算率', String(pledgeCreate.data?.loanAmount ?? ''))
  check(sql(`SELECT commodity_type FROM agri_finance.pledge WHERE id='${ids.pledge1}'`)
    === String(receiptCreate.data?.commodityType), '质押物品类取自仓单（不接受前端自报）')

  const pledgeAgain = await api(admin, 'POST', '/api/v1/pledge/create', {
    receiptId: ids.receipt1, pledgeRate: 50, warehouseAddress: `${MARKER} 重复质押`,
  })
  check(pledgeAgain.code === 409, '同一张仓单不能重复质押', pledgeAgain.message)

  const noReceiptPledge = await api(admin, 'POST', '/api/v1/pledge/create', {
    commodityType: '手填品类', quantity: 10, unitPrice: 100, pledgeRate: 50, warehouseAddress: `${MARKER} 手填`,
  })
  check(noReceiptPledge.code === 400 && String(noReceiptPledge.message).includes('仓单'),
    '回到没有仓单就能质押的老路被拒', noReceiptPledge.message)

  const earlyRelease = await api(admin, 'POST', '/api/v1/pledge/release', { id: ids.pledge1 })
  check(earlyRelease.code === 409, '待审核的质押不能直接释放（状态机不许跳步）', earlyRelease.message)
  const farmerApprove = await api(farmer, 'POST', '/api/v1/pledge/approve', { id: ids.pledge1 })
  check(farmerApprove.status === 403, '融资方没有质押审核权限（HTTP 403）', String(farmerApprove.status))
  const approve = await api(admin, 'POST', '/api/v1/pledge/approve', { id: ids.pledge1 })
  check(approve.code === 200 && sql(`SELECT status FROM agri_finance.pledge WHERE id='${ids.pledge1}'`) === '已生效',
    '运营审核质押生效', approve.message)
  const approveAgain = await api(admin, 'POST', '/api/v1/pledge/approve', { id: ids.pledge1 })
  check(approveAgain.code === 409, '已生效的质押不能重复审核', approveAgain.message)

  const monitorBefore = await api(admin, 'GET', `/api/v1/warehouse-receipt/${ids.receipt1}/monitor`)
  check(monitorBefore.code === 200 && !monitorBefore.data?.id, '还没有仓储读数快照时返回空而不是假数据')
  const monitor = await api(admin, 'POST', `/api/v1/warehouse-receipt/${ids.receipt1}/monitor/refresh`)
  check(monitor.code === 200 && Boolean(monitor.data?.id), '从生产域拉一次仓储读数并存成快照', monitor.message)
  check(monitor.data?.temperature != null || monitor.data?.humidity != null,
    '快照里有真实的温度/湿度读数', `${monitor.data?.temperature ?? '—'}℃ / ${monitor.data?.humidity ?? '—'}%`)
  check(Boolean(monitor.data?.deviceCode) && Boolean(monitor.data?.deviceNote),
    '快照记录了读数出处（哪台设备、是不是本批次的传感器）',
    `${monitor.data?.deviceCode} / ${monitor.data?.deviceNote}`)
  check(monitor.data?.realtimeWeight == null && monitor.data?.gasConcentration == null,
    '没有采集通道的重量/气体浓度存 null（页面显示「—」），不编 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.pledge_monitor WHERE receipt_id='${ids.receipt1}'`)) === 1,
    '监控快照落库 1 条')

  const monitorForeign = await api(farmer, 'POST', `/api/v1/warehouse-receipt/${ids.receipt1}/monitor/refresh`)
  check(monitorForeign.code === 403, '融资方不能刷新别人的仓单读数', monitorForeign.message)

  const receiptList = await api(admin, 'GET', '/api/v1/warehouse-receipt/list')
  check(receiptList.code === 200 && (receiptList.data ?? []).some((item) => item.id === ids.receipt1),
    '运营端仓单台账能看到本轮仓单（跨主体）', `rows=${(receiptList.data ?? []).length}`)
  const scopedReceipts = await api(farmer, 'GET', '/api/v1/warehouse-receipt/list?userId=2001')
  check((scopedReceipts.data ?? []).every((item) => String(item.userId) === '2003'),
    '融资方查别人的主体号也只拿到自己的仓单（本轮为 0 条）', `rows=${(scopedReceipts.data ?? []).length}`)
  const detailForeign = await api(farmer, 'GET', `/api/v1/warehouse-receipt/${ids.receipt1}`)
  check(detailForeign.code === 403, '融资方按 id 直查别人的仓单被拒', detailForeign.message)

  // ---------- 6. 确认借款 → 合同 → 签署 → 放款 ----------
  const accepted = await api(admin, 'POST', `/api/v1/loan/${ids.application1}/accept`)
  ids.contract1 = accepted.data?.id ?? ''
  check(accepted.code === 200 && Boolean(ids.contract1), '确认借款生成待签合同', accepted.message)
  check(sql(`SELECT sign_status FROM agri_finance.contract WHERE id='${ids.contract1}'`) === '待签署', '合同初始为待签署')
  check(sql(`SELECT application_id FROM agri_finance.contract WHERE id='${ids.contract1}'`) === ids.application1,
    '合同与融资申请建立关联（放款闸门按申请核对）')

  const lenderFirst = await api(fund, 'POST', `/api/v1/contract/${ids.contract1}/lender-sign`)
  check(lenderFirst.code === 200 && lenderFirst.data?.disbursed === false, '单方签署不放款（资金方先签）')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.loan WHERE application_id='${ids.application1}'`)) === 0,
    '合同未签齐时不落借款（原实现是审批一过直接记债）')

  const borrowerSign = await api(admin, 'POST', '/api/v1/contract/sign', { id: ids.contract1 })
  ids.loan1 = borrowerSign.data?.loan?.id ?? ''
  check(borrowerSign.code === 200 && borrowerSign.data?.disbursed === true, '签齐最后一笔签名即放款', borrowerSign.message)
  check(sql(`SELECT status FROM agri_finance.loan WHERE id='${ids.loan1}'`) === '还款中', '放款后借款为还款中')
  check(sql(`SELECT status FROM agri_finance.contract WHERE id='${ids.contract1}'`) === '执行中', '放款后合同进入执行中')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.repayment_plan WHERE loan_id='${ids.loan1}'`)) === 1,
    '到期一次还本付息生成 1 期还款计划')
  ids.plan1 = sql(`SELECT id FROM agri_finance.repayment_plan WHERE loan_id='${ids.loan1}' LIMIT 1`)
  check(Number(sql(`SELECT interest_amount FROM agri_finance.loan WHERE id='${ids.loan1}'`)) > 0,
    '应还利息按计划表合计写入（不再用本金×年利率顶替）')
  check(sql(`SELECT loan_id FROM agri_finance.pledge WHERE id='${ids.pledge1}'`) === ids.loan1,
    '放款把担保关系从申请落到借款（结清才找得到该释放哪张质押）')

  // ---------- 7. 还款 → 结清 → 质押与仓单自动释放 ----------
  const pay = await api(admin, 'POST', '/api/v1/repayment/pay', { planId: ids.plan1 })
  check(pay.code === 200, '按期账单还款成功', pay.message)
  check(sql(`SELECT status FROM agri_finance.loan WHERE id='${ids.loan1}'`) === '已结清', '本金还清后借款自动结清')
  check(Number(sql(`SELECT remaining_amount FROM agri_finance.loan WHERE id='${ids.loan1}'`)) === 0, '剩余本金归零')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.message_notification
    WHERE user_id='2001' AND title='借款已结清' AND related_biz_id='${ids.loan1}'`)) === 1, '结清写入站内信')
  const repayAgain = await api(admin, 'POST', '/api/v1/repayment/pay', { planId: ids.plan1 })
  check(repayAgain.code === 400, '同一期账单不能重复还款', repayAgain.message)

  check(sql(`SELECT status FROM agri_finance.pledge WHERE id='${ids.pledge1}'`) === '已释放',
    '借款结清后质押自动释放', sql(`SELECT status FROM agri_finance.pledge WHERE id='${ids.pledge1}'`))
  check(sql(`SELECT status FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt1}'`) === '已释放',
    '质押释放时仓单一起放行（货可以出库了）')
  check(sql(`SELECT release_date FROM agri_finance.pledge WHERE id='${ids.pledge1}'`) !== 'NULL',
    '质押释放时间已留痕')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.message_notification
    WHERE user_id='2001' AND related_biz_id='${ids.pledge1}' AND title='质押物已释放'`)) === 1,
    '结清释放质押写入站内信')
  const releaseDenied = await api(farmer, 'POST', '/api/v1/pledge/release', { id: ids.pledge1 })
  check(releaseDenied.status === 403, '融资方没有质押释放权限（HTTP 403）', String(releaseDenied.status))
  const releaseAgain = await api(admin, 'POST', '/api/v1/pledge/release', { id: ids.pledge1 })
  check(releaseAgain.code === 409, '已释放的质押不能重复释放', releaseAgain.message)

  // ---------- 8. 到期未还 → 逾期台账 → 授信重算 ----------
  const apply2 = await api(admin, 'POST', '/api/v1/loan/apply', applyPayload('逾期分支', 30000))
  ids.application2 = apply2.data?.id ?? ''
  await api(fund, 'POST', '/api/v1/loan/review', {
    id: ids.application2, result: '已通过', amount: 30000, rate: 6, opinion: `${MARKER} 逾期分支审批`,
  })
  const accept2 = await api(admin, 'POST', `/api/v1/loan/${ids.application2}/accept`)
  const contract2 = accept2.data?.id ?? ''
  await api(fund, 'POST', `/api/v1/contract/${contract2}/lender-sign`)
  await api(admin, 'POST', '/api/v1/contract/sign', { id: contract2 })
  ids.loan2 = sql(`SELECT id FROM agri_finance.loan WHERE application_id='${ids.application2}'`)
  ids.plan2 = sql(`SELECT id FROM agri_finance.repayment_plan WHERE loan_id='${ids.loan2}' LIMIT 1`)
  check(Boolean(ids.loan2) && Boolean(ids.plan2), '第二笔借款已放款（逾期分支）', `${ids.loan2}/${ids.plan2}`)

  exec(`UPDATE agri_finance.repayment_plan SET due_date = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE id='${ids.plan2}'`)
  const scan = await api(admin, 'POST', '/api/v1/overdue/scan')
  check(scan.code === 200 && Number(scan.data?.registered ?? 0) >= 1, '手动到期扫描登记逾期', `registered=${scan.data?.registered}`)
  check(sql(`SELECT status FROM agri_finance.repayment_plan WHERE id='${ids.plan2}'`) === '逾期', '账单状态转为逾期')
  ids.overdueRecordId = sql(`SELECT id FROM agri_finance.overdue_record WHERE loan_id='${ids.loan2}' LIMIT 1`)
  check(Number(sql(`SELECT overdue_days FROM agri_finance.overdue_record WHERE id='${ids.overdueRecordId}'`)) >= 3,
    '逾期台账记录实际逾期天数', ids.overdueRecordId)
  check(Number(sql(`SELECT overdue_count FROM agri_finance.credit_score WHERE user_id='2001'`)) >= 1,
    '逾期后授信评分重算（overdue_count 生效）')

  const scanAgain = await api(admin, 'POST', '/api/v1/overdue/scan')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.overdue_record WHERE loan_id='${ids.loan2}'`)) === 1,
    '重复扫描不会为同一期开第二条台账', `registered=${scanAgain.data?.registered}`)

  const assignBad = await api(admin, 'POST', '/api/v1/overdue/assign', { id: ids.overdueRecordId })
  check(assignBad.code === 400, '分配催收必须指定催收人员', assignBad.message)
  const assign = await api(admin, 'POST', '/api/v1/overdue/assign', {
    id: ids.overdueRecordId, collectorId: 'collector-e2e', collectorName: 'E2E催收员',
  })
  check(assign.code === 200 && sql(`SELECT status FROM agri_finance.overdue_record WHERE id='${ids.overdueRecordId}'`) === '催收中',
    '催收分配后台账进入催收中', assign.message)

  exec(`UPDATE agri_finance.repayment_plan SET status='已还款', paid_date=NOW(),
    paid_principal=principal, paid_interest=interest WHERE id='${ids.plan2}'`)
  exec(`UPDATE agri_finance.loan SET status='已结清', remaining_amount=0, paid_amount=amount WHERE id='${ids.loan2}'`)
  const paid = await api(admin, 'POST', '/api/v1/overdue/paid', { id: ids.overdueRecordId })
  check(paid.code === 200 && sql(`SELECT status FROM agri_finance.overdue_record WHERE id='${ids.overdueRecordId}'`) === '已结清',
    '逾期台账结清', paid.message)
  const reEval = await api(admin, 'POST', '/api/v1/credit/evaluate')
  check(Number(reEval.data?.overdueCount ?? -1) === 0, '逾期结清后授信评分回落（overdue_count 归零）',
    `overdue=${reEval.data?.overdueCount} composite=${reEval.data?.compositeScore}`)
  check(Number(sql(`SELECT overdue_count FROM agri_finance.credit_score WHERE user_id='2001'`)) === 0,
    '评分回落已落库')

  // ---------- 9. 黑名单闸门 ----------
  const addBlack = await api(admin, 'POST', '/api/v1/blacklist/add', {
    userId: '2001', userName: '绿源农业合作社', listType: 'ENTERPRISE',
    reason: `${MARKER} 测试列入`, evidence: 'E2E',
  })
  ids.blacklistId = addBlack.data?.id ?? ''
  check(addBlack.code === 200 && sql(`SELECT review_status FROM agri_finance.blacklist WHERE id='${ids.blacklistId}'`) === '待复核',
    '黑名单先进入待复核', ids.blacklistId)
  const beforeApprove = await api(admin, 'POST', '/api/v1/loan/apply', applyPayload('未生效黑名单', 15000))
  ids.application3 = beforeApprove.data?.id ?? ''
  check(beforeApprove.code === 200, '未复核通过的黑名单不拦截申请', beforeApprove.message)
  await api(admin, 'POST', '/api/v1/blacklist/approve', { id: ids.blacklistId })
  check(sql(`SELECT reviewer_id FROM agri_finance.blacklist WHERE id='${ids.blacklistId}'`) !== '',
    '黑名单复核人取当前登录者')
  const blocked = await api(admin, 'POST', '/api/v1/loan/apply', applyPayload('生效黑名单', 15000))
  check(blocked.code === 403 && String(blocked.message).includes('黑名单'), '黑名单生效后融资申请被拒', blocked.message)
  await api(admin, 'POST', '/api/v1/blacklist/remove', { id: ids.blacklistId })
  const unblocked = await api(admin, 'POST', '/api/v1/loan/apply', applyPayload('解除后申请', 15000))
  check(unblocked.code === 200, '黑名单解除后可以重新申请', unblocked.message)
  if (unblocked.data?.id) ids.application3 = [ids.application3, unblocked.data.id].join(',')

  // ---------- 10. 幂等与契约 ----------
  const disburseAgain = await api(fund, 'POST', '/api/v1/loan/disburse', { applicationId: ids.application1 })
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.loan WHERE application_id='${ids.application1}'`)) === 1,
    '重复放款幂等（同一申请只有一笔债）', String(disburseAgain.data?.id ?? ''))
  const notFound = await api(admin, 'GET', '/api/v1/loan/application/NOT-EXIST')
  check(notFound.code === 404, '查不存在的申请返回 404', notFound.message)
  const subjects = await api(admin, 'GET', '/api/v1/finance/subjects')
  check(subjects.code === 200 && (subjects.data ?? []).some((item) => item.subjectId === '2001'),
    '运营端主体选择器返回真实主体', `rows=${(subjects.data ?? []).length}`)

  // 结清释放之后，同一批次应该可以重新开单 —— 否则"释放"只是改了个状态，货还是押着
  const reopen = await api(admin, 'POST', '/api/v1/warehouse-receipt/create', {
    batchId: batch?.batchId, goodsCode: 'PG-TOMATO', quantity: 80, unitPrice: 7, location: `${MARKER} 释放后再开`,
  })
  ids.receipt2 = reopen.data?.id ?? ''
  check(reopen.code === 200 && Boolean(ids.receipt2), '仓单释放后同批次可再次开单', reopen.message)
  check(sql(`SELECT status FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt2}'`) === '待质押',
    '新仓单重新进入待质押（不是复用已释放那张）', String(reopen.data?.receiptNo ?? ''))
  check(sql(`SELECT batch_no FROM agri_finance.warehouse_receipt WHERE id='${ids.receipt2}'`) === String(batch?.batchNo),
    '两张仓单指向同一批次但状态不同（历史可追溯）')

  const pledgePreview = await api(admin, 'GET', '/api/v1/pledge/list')
  const pledgeRow = (pledgePreview.data ?? []).find((item) => item.id === ids.pledge1)
  check(pledgeRow?.receiptNo === ids.receiptNo, '质押列表带出来源仓单号（运营能核对押的是哪张单）',
    String(pledgeRow?.receiptNo ?? ''))
}

function cleanup() {
  const split = (value) => String(value || '').split(',').map((item) => item.trim()).filter((item) => item && item !== 'NULL')
  const applications = [...new Set(split([ids.application1, ids.application2, ids.application3].join(',')))]
  const loans = [...new Set(split([ids.loan1, ids.loan2].join(',')))]
  const contracts = [...new Set(split([
    ids.contract1,
    applications.length
      ? sql(`SELECT GROUP_CONCAT(id) FROM agri_finance.contract WHERE application_id IN (${
        applications.map((id) => `'${id}'`).join(',')})`)
      : '',
  ].join(',')))]
  const inList = (items) => items.map((id) => `'${id}'`).join(',')
  const bizIds = [...applications, ...loans, ...contracts, ...[ids.blacklistId].filter(Boolean)]

  if (inList(loans)) {
    exec(`DELETE FROM agri_finance.repayment_plan WHERE loan_id IN (${inList(loans)})`)
    exec(`DELETE FROM agri_finance.overdue_record WHERE loan_id IN (${inList(loans)})`)
  }
  if (inList([ids.overdueRecordId])) exec(`DELETE FROM agri_finance.overdue_record WHERE id IN (${inList([ids.overdueRecordId])})`)
  if (inList(contracts)) exec(`DELETE FROM agri_finance.contract WHERE id IN (${inList(contracts)})`)
  if (inList(loans)) exec(`DELETE FROM agri_finance.loan WHERE id IN (${inList(loans)})`)
  if (inList(applications)) {
    exec(`DELETE FROM agri_finance.finance_approval_record WHERE application_id IN (${inList(applications)})`)
    exec(`DELETE FROM agri_finance.asset WHERE id IN (${applications.map((id) => `'ASSET-APP-${id}'`).join(',')})`)
  }
  if (inList([ids.assetId])) exec(`DELETE FROM agri_finance.asset WHERE id IN (${inList([ids.assetId])})`)
  else exec(`DELETE FROM agri_finance.asset WHERE asset_name LIKE '%E2E%' OR borrower_id='2001' AND asset_no LIKE 'FA-LN%'`)
  if (inList([ids.blacklistId])) exec(`DELETE FROM agri_finance.blacklist WHERE id IN (${inList([ids.blacklistId])})`)
  if (inList(bizIds)) exec(`DELETE FROM agri_finance.message_notification WHERE related_biz_id IN (${inList(bizIds)})`)
  exec(`DELETE FROM agri_finance.loan_application WHERE fund_purpose LIKE '%${MARKER}%'`)
  purgeReceiptChain()

  if (creditSnapshot && !String(creditSnapshot).startsWith('ERR')) {
    const [composite, available, overdue, funded, rate] = String(creditSnapshot).split('|')
    exec(`UPDATE agri_finance.credit_score SET composite_score=${composite || 0}, available_amount=${available || 0},
      overdue_count=${overdue || 0}, total_transaction_amount=${funded || 0}, fulfillment_rate=${rate || 100}
      WHERE user_id='2001'`)
  }

  exec(SWEEP_ORPHANS)
  const [certId, certStatus] = String(certBefore || '').split('#')
  if (certId && certStatus) {
    exec(`UPDATE agri_core.platform_merchant_certification SET cert_status='${certStatus}' WHERE id=${certId}`)
  }

  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.loan_application WHERE fund_purpose LIKE '%${MARKER}%'`)) === 0,
    '清理后申请残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.warehouse_receipt`)) === 0,
    '清理后仓单残留为 0（该表没有种子数据）')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.pledge_monitor`)) === 0,
    '清理后仓储读数快照残留为 0（该表没有种子数据）')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.pledge WHERE receipt_id IS NOT NULL`)) === 0,
    '清理后由仓单发起的质押残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.loan WHERE application_id IN (${
    inList(applications) || 'NULL'})`)) === 0, '清理后借款残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.overdue_record WHERE id='${ids.overdueRecordId}'`)) === 0,
    '清理后逾期台账残留为 0')
  check(Number(sql(`SELECT COUNT(*) FROM agri_finance.blacklist WHERE id='${ids.blacklistId}'`)) === 0,
    '清理后黑名单残留为 0')
  check(sql(`SELECT IFNULL(merchant_id,'') FROM agri_finance.fund_provider WHERE id='PROVIDER-BANK-001'`)
    === providerBoundBefore, '本轮没有改动资金机构绑定', String(providerBoundBefore))
  check(sql(`SELECT cert_status FROM agri_core.platform_merchant_certification WHERE id=${
    String(certBefore).split('#')[0] || 0}`) === String(certBefore).split('#')[1], '主体认证单状态已还原', certBefore)
}

main()
  .catch((error) => {
    failures.push(`未捕获异常：${error.message}`)
    console.error(error)
  })
  .finally(() => {
    cleanup()
    console.log(`\n断言 ${failures.length === 0 ? '全部通过' : `失败 ${failures.length} 项：${failures.join(' / ')}`}`)
    process.exit(failures.length === 0 ? 0 : 1)
  })
