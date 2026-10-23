import axios from 'axios'

const USER_KEY = 'agri_finance_user_id'
const NAME_KEY = 'agri_finance_user_name'

export const financeUser = {
  id: localStorage.getItem(USER_KEY) || '2001',
  name: localStorage.getItem(NAME_KEY) || '绿源农业合作社',
}

export function setFinanceUser(user) {
  if (!user?.id) return
  financeUser.id = String(user.id)
  financeUser.name = user.name || financeUser.name
  localStorage.setItem(USER_KEY, financeUser.id)
  localStorage.setItem(NAME_KEY, financeUser.name)
}

async function request(promise) {
  const response = await promise
  const body = response.data
  if (!body || body.code !== 200) {
    throw new Error(body?.message || '请求失败')
  }
  return body.data
}

export const financeApi = {
  credit: () => request(axios.get('/api/v1/credit/score', { params: { userId: financeUser.id } })),
  applications: () => request(axios.get('/api/v1/loan/applications', {
    params: { userId: financeUser.id },
  })),
  apply: (payload) => request(axios.post('/api/v1/loan/apply', {
    ...payload,
    userId: financeUser.id,
    userName: financeUser.name,
  })),
  uploadEvidence: (file) => {
    const data = new FormData()
    data.append('file', file)
    return request(axios.post('/api/v1/loan/evidence', data))
  },
  loans: () => request(axios.get('/api/v1/loan/list', { params: { userId: financeUser.id } })),
  loan: (id) => request(axios.get(`/api/v1/loan/${id}`)),
  confirmLoan: (applicationId) => request(axios.post('/api/v1/loan/create', { applicationId })),
  repaymentPlans: (loanId = '') => request(axios.get('/api/v1/repayment/plans', {
    params: loanId ? { loanId } : {},
  })),
  payRepayment: (planId) => request(axios.post('/api/v1/repayment/pay', { planId })),
  pledges: () => request(axios.get('/api/v1/pledge/list', { params: { userId: financeUser.id } })),
  createPledge: (payload) => request(axios.post('/api/v1/pledge/create', {
    ...payload,
    userId: financeUser.id,
  })),
  contracts: () => request(axios.get('/api/v1/contract/list', { params: { userId: financeUser.id } })),
  signContract: (id) => request(axios.post('/api/v1/contract/sign', { id, signType: 'borrower' })),
  messages: () => request(axios.get('/api/v1/message/list', { params: { userId: financeUser.id } })),
  markMessageRead: (id) => request(axios.post(`/api/v1/message/read/${id}`)),
  markAllMessagesRead: () => request(axios.post('/api/v1/message/read-all', null, {
    params: { userId: financeUser.id },
  })),
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
  return PRODUCT_NAMES[value] || value || '综合融资'
}
