import axios from 'axios'
import { fundProvider, loadFinanceSubject } from './subject'

// 资金机构与操作人身份来自后端按令牌解析的身份卡，不再在前端写死机构号
export { fundProvider, operationUser } from './subject'

async function request(promise) {
  const response = await promise
  const body = response.data
  if (!body || body.code !== 200) {
    throw new Error(body?.message || '请求失败')
  }
  return body.data
}

async function withIdentity(promiseFactory) {
  await loadFinanceSubject()
  return request(promiseFactory())
}

export const operationsApi = {
  provider: () => withIdentity(() => axios.get('/api/v1/fund-provider/mine')),
  /** 运营端：资金机构台账（含经营主体绑定与准入状态）。 */
  providerList: (params = {}) => request(axios.get('/api/v1/fund-provider/admin/list', { params })),
  merchantOptions: (keyword = '') => request(axios.get('/api/v1/fund-provider/merchant-options', {
    params: { keyword },
  })),
  bindProvider: (id, merchantId) => request(axios.put(`/api/v1/fund-provider/${id}/binding`, { merchantId })),
  reviewProvider: (id, approved, opinion) => request(axios.post(
    `/api/v1/fund-provider/${approved ? 'approve' : 'reject'}/${id}`, null, { params: { opinion: opinion || '' } },
  )),
  workbench: () => withIdentity(() => axios.get('/api/v1/fund-workbench/mine')),
  fundMarket: () => withIdentity(() => axios.get('/api/v1/fund-workbench/mine/market')),
  fundAssetDetail: (assetId) => withIdentity(() => axios.get(
    `/api/v1/fund-workbench/mine/asset/${encodeURIComponent(assetId)}`,
  )),
  availableAssets: () => request(axios.get('/api/v1/asset/available')),
  myAssets: () => withIdentity(() => axios.get('/api/v1/asset/mine')),
  investments: () => withIdentity(() => axios.get('/api/v1/investment/mine')),
  portfolio: () => withIdentity(() => axios.get('/api/v1/investment/mine/portfolio')),
  totalInvested: () => withIdentity(() => axios.get('/api/v1/investment/mine/total-invested')),
  totalReturn: () => withIdentity(() => axios.get('/api/v1/investment/mine/total-return')),
  subscribe: (assetId, amount) => withIdentity(() => axios.post('/api/v1/investment/subscribe', {
    assetId,
    amount,
  })),
  completeInvestment: (id) => withIdentity(() => axios.post(`/api/v1/investment/complete/${id}`)),
  applications: (status = '') => request(axios.get('/api/v1/loan/applications', { params: { status } })),
  reviewPool: (status = '待审批') => request(axios.get('/api/v1/loan/applications/review-pool', {
    params: { status },
  })),
  approvalOverview: () => withIdentity(() => axios.get('/api/v1/loan/approval/overview')),
  review: (id, result, opinion, amount, rate) => withIdentity(() => axios.post('/api/v1/loan/review', {
    id,
    result,
    opinion,
    amount,
    rate,
  })),
  /** 待签借款合同：资金方这一半边由后端按登录机构落签，双方签齐系统自动放款。 */
  contracts: () => request(axios.get('/api/v1/contract/list')),
  lenderSignContract: (id) => request(axios.post(`/api/v1/contract/${id}/lender-sign`)),
  loans: () => request(axios.get('/api/v1/loan/list')),
  repaymentPlans: () => request(axios.get('/api/v1/repayment/plans')),
  overdue: () => request(axios.get('/api/v1/overdue/list')),
  scanOverdue: () => request(axios.post('/api/v1/overdue/scan')),
  assignOverdue: (id, collectorId, collectorName) => request(axios.post('/api/v1/overdue/assign', {
    id, collectorId, collectorName,
  })),
  markOverduePaid: (id) => request(axios.post('/api/v1/overdue/paid', { id })),
  pledges: (params = {}) => request(axios.get('/api/v1/pledge/list', { params })),
  approvePledge: (id) => request(axios.post('/api/v1/pledge/approve', { id })),
  releasePledge: (id) => request(axios.post('/api/v1/pledge/release', { id })),
  /** 仓单台账：不传 userId 是跨主体全量（运营核单），传了按主体筛。 */
  receipts: (params = {}) => request(axios.get('/api/v1/warehouse-receipt/list', { params })),
  receiptDetail: (id) => request(axios.get(`/api/v1/warehouse-receipt/${id}`)),
  refreshReceiptMonitor: (id) => request(axios.post(`/api/v1/warehouse-receipt/${id}/monitor/refresh`)),
  /** 质押物字典（含已停用），运营维护页用。 */
  pledgeGoods: () => request(axios.get('/api/v1/pledge-goods/list')),
  addPledgeGoods: (data) => request(axios.post('/api/v1/pledge-goods/add', data)),
  updatePledgeGoods: (data) => request(axios.put('/api/v1/pledge-goods/update', data)),
  togglePledgeGoods: (id, enabled) => request(axios.post(
    `/api/v1/pledge-goods/${enabled ? 'enable' : 'disable'}/${id}`,
  )),
  credit: (userId) => request(axios.get('/api/v1/credit/score', { params: { userId } })),
  subjects: () => request(axios.get('/api/v1/finance/subjects')),
  riskRules: () => request(axios.get('/api/v1/risk-control/rules')),
  riskCenter: (subjectId) => request(axios.get('/api/v1/risk-control/center', {
    params: { subjectId },
  })),
  assessRiskCenter: (subjectId) => request(axios.post(
    `/api/v1/risk-control/center/assess/${encodeURIComponent(subjectId)}`,
  )),
  riskSnapshots: (subjectId = '') => request(axios.get('/api/v1/risk-control/center/snapshots', {
    params: subjectId ? { subjectId } : {},
  })),
  updateRiskRule: (rule) => request(axios.put('/api/v1/risk-control/rule', rule)),
  toggleRiskRule: (id, enabled) => request(axios.post(
    `/api/v1/risk-control/rule/${enabled ? 'enable' : 'disable'}/${id}`,
  )),
  blacklist: (listType = '') => request(axios.get('/api/v1/blacklist/list', {
    params: listType ? { listType } : {},
  })),
  addBlacklist: (data) => request(axios.post('/api/v1/blacklist/add', data)),
  approveBlacklist: (id) => request(axios.post('/api/v1/blacklist/approve', { id })),
  removeBlacklist: (id) => request(axios.post('/api/v1/blacklist/remove', { id })),
  productConfigs: () => request(axios.get('/api/v1/product-config')),
  createProductConfig: (data) => request(axios.post('/api/v1/product-config', data)),
  updateProductConfig: (id, data) => request(axios.put(`/api/v1/product-config/${id}`, data)),
  toggleProductConfig: (id) => request(axios.post(`/api/v1/product-config/${id}/toggle`)),
  deleteProductConfig: (id) => request(axios.delete(`/api/v1/product-config/${id}`)),
  messages: () => withIdentity(() => axios.get('/api/v1/message/list', {
    params: fundProvider.id ? { userId: fundProvider.id } : {},
  })),
}
