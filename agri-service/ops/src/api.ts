import axios from 'axios'
import { attachUnifiedAuth } from '../../frontend/src/sso'

export interface OpsProvider {
  id: number
  name: string
  category: string
  categoryIcon: string
  rating: number
  orderCount: number
  price: number
  unit: string
  badge: string
  region: string
  status: string
  creditCode?: string
  contactName?: string
  contactPhone?: string
  serviceArea?: string
  creditScore: number
  cancelRate: number
  riskLevel: string
  auditReason?: string
  merchantId?: string | null
  createdAt?: string
  items?: ServiceItem[]
  orders?: Array<{ id: number; orderNo: string; serviceName: string; totalAmount: number; status: string; progress: number; appointmentDate: string }>
}

export interface ServiceItem {
  id: number
  providerId: number
  providerName: string
  providerRegion: string
  name: string
  category: string
  price: number
  unit: string
  description: string
  selectedCount: number
  status: string
  auditStatus: string
  auditReason: string
  aiScore: number
}

export interface OpsOrder {
  id: number
  orderNo: string
  providerId: number
  providerName: string
  serviceName: string
  category: string
  quantity: number
  unit: string
  totalAmount: number
  appointmentDate: string
  location: string
  contactName: string
  contactPhone: string
  status: string
  progress: number
  dispatchStatus: string
  riskFlag?: string
  settleStatus: string
  createdAt: string
}

export interface DispatchDemand {
  id: number
  demandNo: string
  category: string
  serviceName: string
  description: string
  location: string
  area: string
  preferredDate: string
  budgetMin: number
  budgetMax: number
  status: string
  availableProviderCount: number
}

export interface OpsOverview {
  metrics: {
    providers: number
    pendingProviders: number
    unboundProviders: number
    activeOrders: number
    totalOrders: number
    gmv: number
    platformFee: number
    openComplaints: number
    pendingPolicies: number
    pendingClaims: number
  }
  trend: Array<{ date: string; orders: number; gmv: number; providers: number; complaints: number }>
  todos: Array<{ route: string; title: string; count: number; description: string }>
  alerts: QualityAlert[]
  regions: Array<{ name: string; providers: number; rating: number }>
}

export interface Complaint {
  id: number
  complaintNo: string
  orderNo: string
  category: string
  description: string
  demand: string
  status: string
  progress: number
  handler?: string
  resolution?: string
  createdAt: string
}

export interface PolicyApplication {
  id: number
  applicationNo: string
  policyTitle: string
  applicant: string
  contactPhone: string
  amountText: string
  status: string
  progress: number
  submittedAt: string
}

export interface InsuranceClaim {
  id: number
  claimNo: string
  policyNo: string
  disasterType: string
  description: string
  lossArea: string
  status: string
  progress: number
  createdAt: string
}

export interface Settlement {
  id: number
  batchNo: string
  period: string
  orderCount: number
  amount: number
  commission: number
  status: string
  reviewedBy?: string
  reviewedAt?: string
  createdAt: string
}

export interface Campaign {
  id: number
  name: string
  scope: string
  quota: number
  claimed: number
  budget: number
  status: string
  startsAt: string
  endsAt: string
}

export interface QualityAlert {
  id: number
  providerId?: number
  providerName: string
  type: string
  content: string
  score: number
  level: string
  status: string
  createdAt: string
}

export interface Strategy {
  key: string
  label: string
  value: string
  description: string
  updatedAt: string
}

export interface TeamMember {
  id: number
  name: string
  role: string
  scope: string
  permissions: string[]
  status: string
}

export interface OpLog {
  id: number
  operator: string
  role: string
  action: string
  target: string
  detail: string
  ip: string
  createdAt: string
}

interface Envelope<T> { code: number; message: string; data: T }
const client = axios.create({ baseURL: '/api/v1/service', timeout: 15000 })
attachUnifiedAuth(client, 'service-ops')

async function request<T>(call: Promise<{ data: Envelope<T> }>): Promise<T> {
  try {
    const response = await call
    if (response.data.code !== 200 && response.data.code !== 0) throw new Error(response.data.message)
    return response.data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = (error.response?.data as { message?: string } | undefined)?.message
      throw new Error(message || '请求失败，请检查综合服务后端与 MySQL')
    }
    throw error
  }
}

export const opsApi = {
  /** 当前登录运营账号解析出的身份，用于顶栏与"操作人来自令牌"的可核查展示。 */
  identity: () => request<{
    merchantId: string
    merchantName: string
    userId?: string
    operatorName?: string
    operatorRole?: string
    roles?: { consumer: boolean; provider: boolean; admin: boolean }
  }>(client.get('/identity')),
  overview: () => request<OpsOverview>(client.get('/ops/overview')),
  providers: (params?: { status?: string; keyword?: string }) => request<OpsProvider[]>(client.get('/ops/providers', { params })),
  provider: (id: number) => request<OpsProvider>(client.get(`/ops/providers/${id}`)),
  reviewProvider: (id: number, body: Record<string, unknown>) => request<OpsProvider>(client.post(`/ops/providers/${id}/review`, body)),
  bindMerchant: (id: number, merchantId: string) => request<OpsProvider>(
    client.put(`/ops/providers/${id}/merchant-binding`, { merchantId }),
  ),
  serviceItems: (params?: { auditStatus?: string; keyword?: string }) => request<ServiceItem[]>(client.get('/ops/service-items', { params })),
  reviewServiceItem: (id: number, body: Record<string, unknown>) => request<ServiceItem>(client.post(`/ops/service-items/${id}/review`, body)),
  orders: (params?: { status?: string; keyword?: string }) => request<OpsOrder[]>(client.get('/ops/orders', { params })),
  dispatchOrder: (id: number, providerId: number, note: string) => request<OpsOrder>(client.post(`/ops/orders/${id}/dispatch`, { providerId, note })),
  dispatchDemands: () => request<DispatchDemand[]>(client.get('/ops/dispatch-demands')),
  assignDemand: (id: number, providerId: number) => request<unknown>(client.post(`/ops/dispatch-demands/${id}/assign`, { providerId })),
  complaints: () => request<Complaint[]>(client.get('/ops/complaints')),
  resolveComplaint: (id: number, body: Record<string, unknown>) => request<Complaint>(client.post(`/ops/complaints/${id}/resolve`, body)),
  policies: () => request<PolicyApplication[]>(client.get('/ops/policy-applications')),
  reviewPolicy: (id: number, body: Record<string, unknown>) => request<PolicyApplication>(client.post(`/ops/policy-applications/${id}/review`, body)),
  claims: () => request<InsuranceClaim[]>(client.get('/ops/insurance-claims')),
  reviewClaim: (id: number, body: Record<string, unknown>) => request<InsuranceClaim>(client.post(`/ops/insurance-claims/${id}/review`, body)),
  settlements: () => request<Settlement[]>(client.get('/ops/settlements')),
  reviewSettlement: (id: number, body: Record<string, unknown>) => request<Settlement>(client.post(`/ops/settlements/${id}/review`, body)),
  campaigns: () => request<Campaign[]>(client.get('/ops/campaigns')),
  updateCampaign: (id: number, status: string) => request<Campaign>(client.patch(`/ops/campaigns/${id}`, { status })),
  alerts: () => request<QualityAlert[]>(client.get('/ops/quality-alerts')),
  resolveAlert: (id: number, note: string) => request<QualityAlert>(client.post(`/ops/quality-alerts/${id}/resolve`, { status: 'closed', note })),
  strategies: () => request<Strategy[]>(client.get('/ops/strategies')),
  updateStrategy: (key: string, value: string) => request<Strategy[]>(client.post('/ops/strategies', { key, value })),
  team: () => request<TeamMember[]>(client.get('/ops/team')),
  logs: () => request<OpLog[]>(client.get('/ops/logs')),
  report: () => request<{ trend: OpsOverview['trend']; categories: Array<{ category: string; orderCount: number; gmv: number; avgRating: number }>; providers: OpsProvider[] }>(client.get('/ops/reports')),
}

export const ORDER_STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: '待支付', tone: 'orange' },
  confirmed: { label: '待服务', tone: 'blue' },
  in_progress: { label: '服务中', tone: 'green' },
  completed: { label: '已完成', tone: 'gray' },
  cancelled: { label: '已取消', tone: 'red' },
}

export const PROVIDER_STATUS: Record<string, { label: string; tone: string }> = {
  available: { label: '正常经营', tone: 'green' },
  pending: { label: '待审核', tone: 'orange' },
  restricted: { label: '限制接单', tone: 'orange' },
  frozen: { label: '冻结整改', tone: 'red' },
  removed: { label: '已清退', tone: 'red' },
}

export const POLICY_STATUS: Record<string, { label: string; tone: string }> = {
  submitted: { label: '已提交', tone: 'blue' },
  town_review: { label: '乡镇审核中', tone: 'orange' },
  county_review: { label: '区县审核中', tone: 'orange' },
  paid: { label: '已兑付', tone: 'green' },
  rejected: { label: '已驳回', tone: 'red' },
}
