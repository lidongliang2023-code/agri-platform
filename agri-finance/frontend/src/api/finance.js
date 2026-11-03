import axios from 'axios'
import { configuredProductName } from '../data/products'
import { loadFinanceSubject } from './subject'

// 融资主体身份来自后端按令牌解析的身份卡，不再在前端写死主体号
export { financeUser } from './subject'

async function request(promise) {
  const response = await promise
  const body = response.data
  if (!body || body.code !== 200) {
    throw new Error(body?.message || '请求失败')
  }
  return body.data
}

async function borrower(promiseFactory) {
  await loadFinanceSubject()
  return request(promiseFactory())
}

export const financeApi = {
  credit: () => borrower(() => axios.get('/api/v1/credit/score')),
  applications: () => borrower(() => axios.get('/api/v1/loan/applications')),
  apply: (payload) => borrower(() => axios.post('/api/v1/loan/apply', payload)),
  uploadEvidence: (file) => {
    const data = new FormData()
    data.append('file', file)
    return request(axios.post('/api/v1/loan/evidence', data))
  },
  loans: () => borrower(() => axios.get('/api/v1/loan/list')),
  loan: (id) => request(axios.get(`/api/v1/loan/${id}`)),
  /** 确认借款：生成待签合同（放款要等双方签署）。 */
  acceptLoan: (applicationId) => request(axios.post(`/api/v1/loan/${applicationId}/accept`)),
  repaymentPlans: (loanId = '') => borrower(() => axios.get('/api/v1/repayment/plans', {
    params: loanId ? { loanId } : {},
  })),
  payRepayment: (planId) => request(axios.post('/api/v1/repayment/pay', { planId })),
  pledges: () => borrower(() => axios.get('/api/v1/pledge/list')),
  /** 质押必须挂在自己的仓单上；仓单来自生产域已入库批次，不是手填的品名数量。 */
  createPledge: (payload) => borrower(() => axios.post('/api/v1/pledge/create', payload)),
  receiptBatches: () => borrower(() => axios.get('/api/v1/warehouse-receipt/batches')),
  batchPreview: (batchId) => borrower(() => axios.get('/api/v1/warehouse-receipt/batch-preview', {
    params: { batchId },
  })),
  createReceipt: (payload) => borrower(() => axios.post('/api/v1/warehouse-receipt/create', payload)),
  receipts: (status = '') => borrower(() => axios.get('/api/v1/warehouse-receipt/list', {
    params: status ? { status } : {},
  })),
  receiptDetail: (id) => request(axios.get(`/api/v1/warehouse-receipt/${id}`)),
  refreshReceiptMonitor: (id) => request(axios.post(`/api/v1/warehouse-receipt/${id}/monitor/refresh`)),
  /** 质押物字典：折算率上限与最长期限决定开单和质押能填多少。 */
  pledgeGoodsOptions: () => request(axios.get('/api/v1/pledge-goods/enabled')),
  contracts: () => borrower(() => axios.get('/api/v1/contract/list')),
  /** 只签融资方这一半边，资金方那半边由后端按资金方身份落签。 */
  signContract: (id) => request(axios.post('/api/v1/contract/sign', { id })),
  messages: () => borrower(() => axios.get('/api/v1/message/list')),
  markMessageRead: (id) => request(axios.post(`/api/v1/message/read/${id}`)),
  markAllMessagesRead: () => request(axios.post('/api/v1/message/read-all')),
  evaluateCredit: () => request(axios.post('/api/v1/credit/evaluate')),
}

export function money(value, empty = '¥0.00') {
  if (value == null || value === '') return empty
  return `¥${Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function compactMoney(value) {
  const amount = Number(value || 0)
  if (amount >= 100000000) return `¥${(amount / 100000000).toFixed(2)}亿`
  if (amount >= 10000) return `¥${(amount / 10000).toFixed(1)}万`
  return money(amount)
}

export function shortDate(value) {
  return value ? String(value).replace('T', ' ').slice(0, 16) : '—'
}

/** 数量口径：库存与仓单都带小数（1250.000 kg 要显示成 1250），末尾无意义的 0 去掉。 */
export function num(value) {
  if (value == null || value === '') return '—'
  const amount = Number(value)
  return Number.isFinite(amount) ? String(Number(amount.toFixed(3))) : String(value)
}

export const PRODUCT_NAMES = {
  agri: '农资贷',
  purchase: '收购贷',
  sales: '销售贷',
  machine: '农机贷',
  data: '数据信用贷',
  order_loan: '农业订单贷',
  credit_loan: '信用贷',
  equipment_loan: '农机设备贷',
  pledge_loan: '农产品质押贷',
}

export function productName(value) {
  return configuredProductName(value) || PRODUCT_NAMES[value] || value || '综合融资'
}
