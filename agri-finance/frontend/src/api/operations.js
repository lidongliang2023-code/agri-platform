import axios from 'axios'

export const fundProvider = {
  id: 'PROVIDER-BANK-001',
  name: '丰链云合作银行',
}

export const operationUser = {
  id: 'admin',
  name: '平台风控运营',
}

async function request(promise) {
  const response = await promise
  const body = response.data
  if (!body || body.code !== 200) {
    throw new Error(body?.message || '请求失败')
  }
  return body.data
}

export const operationsApi = {
  provider: () => request(axios.get(`/api/v1/fund-provider/${fundProvider.id}`)),
  availableAssets: () => request(axios.get('/api/v1/asset/available')),
  investments: () => request(axios.get(`/api/v1/investment/provider/${fundProvider.id}`)),
  totalInvested: () => request(axios.get(`/api/v1/investment/total-invested/${fundProvider.id}`)),
  totalReturn: () => request(axios.get(`/api/v1/investment/total-return/${fundProvider.id}`)),
  subscribe: (assetId, amount) => request(axios.post('/api/v1/investment/subscribe', {
    assetId,
    amount,
    providerId: fundProvider.id,
    providerName: fundProvider.name,
  })),
  completeInvestment: (id) => request(axios.post(`/api/v1/investment/complete/${id}`)),
  applications: (status = '') => request(axios.get('/api/v1/loan/applications', { params: { status } })),
  review: (id, result, opinion, amount, rate) => request(axios.post('/api/v1/loan/review', {
    id, result, opinion, amount, rate,
  })),
  loans: () => request(axios.get('/api/v1/loan/list')),
  repaymentPlans: () => request(axios.get('/api/v1/repayment/plans')),
  overdue: () => request(axios.get('/api/v1/overdue/list')),
  assignOverdue: (id, collectorId, collectorName) => request(axios.post('/api/v1/overdue/assign', {
    id, collectorId, collectorName,
  })),
  markOverduePaid: (id) => request(axios.post('/api/v1/overdue/paid', { id })),
  pledges: () => request(axios.get('/api/v1/pledge/list')),
  approvePledge: (id) => request(axios.post('/api/v1/pledge/approve', { id })),
  releasePledge: (id) => request(axios.post('/api/v1/pledge/release', { id })),
  credit: (userId) => request(axios.get('/api/v1/credit/score', { params: { userId } })),
  riskRules: () => request(axios.get('/api/v1/risk-control/rules')),
  updateRiskRule: (rule) => request(axios.put('/api/v1/risk-control/rule', rule)),
  toggleRiskRule: (id, enabled) => request(axios.post(
    `/api/v1/risk-control/rule/${enabled ? 'enable' : 'disable'}/${id}`,
  )),
  blacklist: (listType = '') => request(axios.get('/api/v1/blacklist/list', {
    params: listType ? { listType } : {},
  })),
  addBlacklist: (data) => request(axios.post('/api/v1/blacklist/add', data)),
  approveBlacklist: (id) => request(axios.post('/api/v1/blacklist/approve', {
    id,
    reviewerId: operationUser.id,
    reviewerName: operationUser.name,
  })),
  removeBlacklist: (id) => request(axios.post('/api/v1/blacklist/remove', { id })),
  productConfigs: () => request(axios.get('/api/v1/product-config')),
  updateProductConfig: (id, data) => request(axios.put(`/api/v1/product-config/${id}`, data)),
  toggleProductConfig: (id) => request(axios.post(`/api/v1/product-config/${id}/toggle`)),
  messages: () => request(axios.get('/api/v1/message/list', { params: { userId: fundProvider.id } })),
}
