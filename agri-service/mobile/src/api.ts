export interface Provider {
  id: string | number
  name: string
  category: string
  categoryIcon: string
  rating: number
  orderCount: number
  distanceKm: number
  responseMinutes: number
  price: number
  unit: string
  badge: string
  tags: string[]
  description: string
  certifications: string[]
  region: string
  availableSlots: string[]
  status: string
  items?: Array<{ id: string | number; name: string; price: number; unit: string; description: string; duration: string }>
  reviews?: Array<{ serviceName: string; rating: number; review: string; appointmentDate: string }>
}

import {
  getServiceToken,
  handleServiceUnauthorized,
} from './auth'

export interface Order {
  id: string | number
  orderNo: string
  providerId: string | number
  providerName: string
  serviceName: string
  category: string
  quantity: number
  unit: string
  unitPrice: number
  totalAmount: number
  depositAmount: number
  appointmentDate: string
  appointmentSlot: string
  location: string
  status: string
  progress: number
  rating?: number
  review?: string
  timeline?: Array<{ title: string; note: string; eventTime: string; completed: boolean }>
}

export interface Overview {
  stats: {
    serviceProviders: number
    completedOrders: number
    myOrders: number
    satisfaction: number
    protectedAmount: number
    unreadMessages: number
  }
  categories: Array<{ name: string; icon: string; key: string; count: number }>
  featuredProviders: Provider[]
  policies: Policy[]
  todos: Array<{ title: string; content: string; status: string; progress: string; link: string }>
}

export interface Policy {
  id: string | number
  title: string
  level: string
  amountText: string
  deadline: string
  matchScore: number
  conditions: string
  materials: string[]
  status: string
}

export interface Course {
  id: number
  title: string
  teacher: string
  mode: string
  duration: string
  learners: number
  rating: number
  cover: string
  summary: string
  tags: string[]
  enrolled: boolean
  myProgress: number
  certNo?: string | null
  myNote: string
}

export interface Expert {
  id: number
  name: string
  title: string
  category: string
  organization: string
  serviceScope: string
  rating: number
  consultCount: number
  summary: string
  avatarIcon: string
  status: string
}

export interface ExpertProfile { id: string; name: string; title: string; status: string; userId: string; accountName: string }

export interface Consultation {
  id: number
  consultNo: string
  type: string
  expertName: string
  subject: string
  content: string
  aiLevel: string
  repliedAt?: string | null
  suggestion: string
  status: string
  createdAt: string
}

export interface ServiceResource {
  id: number
  resourceType: string
  title: string
  location: string
  areaMu: number
  price: number
  unit: string
  description: string
  contactName: string
  contactPhone: string
  merchantName?: string
  mine: boolean
  status: string
  createdAt: string
}

export interface Enrollment {
  id: number
  courseId: number
  progress: number
  noteText: string
  certNo?: string | null
  completedAt?: string | null
}

interface Envelope<T> { code: number; message: string; data: T }

const runtimePlatform = uni.getSystemInfoSync().uniPlatform
export const API_BASE = import.meta.env.VITE_SERVICE_API_BASE
  || ''

function query(params?: Record<string, string | number | undefined>): string {
  if (!params) return ''
  const pairs = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
  return pairs.length ? `?${pairs.join('&')}` : ''
}

export function request<T>(
  url: string,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' = 'GET',
  data?: Record<string, unknown>,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  if (runtimePlatform !== 'web' && !/^https?:\/\//.test(API_BASE)) {
    return Promise.reject(new Error('当前版本未配置服务地址，请联系平台更新客户端'))
  }
  return new Promise<T>((resolve, reject) => {
    const token = getServiceToken()
    if (!token) { handleServiceUnauthorized(); reject(new Error('请先使用统一账号登录')); return }
    uni.request({
      url: `${API_BASE}/api/v1/service${url}${query(params)}`,
      // uni 类型声明未包含 PATCH，但运行时与后端都支持该方法。
      method: method as 'GET' | 'POST' | 'PUT' | 'DELETE',
      timeout: 15000,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      success(response) {
        if (getServiceToken() !== token) { reject(new Error('登录会话已变化，请重新加载')); return }
        const body = response.data as Envelope<T>
        if (response.statusCode === 401 || (response.data as { code?: number })?.code === 401) {
          handleServiceUnauthorized()
          reject(new Error('登录已失效，请重新使用统一账号登录'))
          return
        }
        if (response.statusCode >= 400) {
          reject(new Error(body?.message || `请求失败（HTTP ${response.statusCode}）`))
          return
        }
        if (body?.code === 0 || body?.code === 200) {
          resolve(body.data)
          return
        }
        reject(new Error(body?.message || '综合服务请求失败'))
      },
      fail(error: { errMsg?: string }) {
        reject(new Error(error?.errMsg || '网络异常，请检查服务地址与网络'))
      },
    })
  })
}

export const serviceApi = {
  /** 当前令牌解析出的经营主体 / 服务商档案，前端不再自己写死身份。 */
  identity: () => request<{
    merchantId: string
    merchantName: string
    merchantError?: string
    providerId?: number | string | null
    providerName?: string | null
    providerError?: string
    expertId?: string
    expertName?: string
    userId?: string
    operatorName?: string
    roles?: { consumer: boolean; provider: boolean; admin: boolean }
  }>('/identity'),
  overview: () => request<Overview>('/overview'),
  dictionaries: () => request<{
    orderStatus: string[]
    orderStatusText: Record<string, string>
    categories: string[]
    demandStatus: string[]
    claimStatus: string[]
  }>('/dictionaries'),
  providers: (params?: { category?: string; keyword?: string; sort?: string }) =>
    request<Provider[]>('/providers', 'GET', undefined, params),
  provider: (id: string | number) => request<Provider>(`/providers/${id}`),
  orders: () => request<Order[]>('/orders'),
  order: (id: string | number) => request<Order>(`/orders/${id}`),
  createOrder: (data: Record<string, unknown>) => request<Order>('/orders', 'POST', data),
  updateOrder: (id: string | number, status: string) => request<Order>(`/orders/${id}`, 'PUT', { status }),
  reviewOrder: (id: string | number, rating: number, review: string) =>
    request<Order>(`/orders/${id}/review`, 'POST', { rating, review }),
  myDemands: () => request<Array<{ id: string; demandNo: string; serviceName: string; area: string; location: string; preferredDate: string; status: string; acceptedProviderName?: string }>>('/demands/mine'),
  complaints: () => request<Array<{ id: string; complaintNo: string; orderNo: string; description: string; status: string; progress: number; resolution?: string }>>('/complaints'),
  createComplaint: (data: Record<string, unknown>) => request('/complaints', 'POST', data),
  createDemand: (data: Record<string, unknown>) => request('/demands', 'POST', data),
  policies: () => request<Policy[]>('/policies'),
  policyApplications: () => request<Array<{ id: string | number; applicationNo: string; policyTitle: string; status: string; progress: number; amountText: string; submittedAt: string }>>('/policies/applications'),
  applyPolicy: (data: Record<string, unknown>) => request('/policies/applications', 'POST', data),
  courses: () => request<Course[]>('/courses'),
  enrollCourse: (id: number) => request<Course>(`/courses/${id}/enroll`, 'POST', {}),
  updateCourseProgress: (id: number, progress: number) => request<Enrollment>(`/courses/${id}/progress`, 'PATCH', { progress }),
  saveCourseNote: (id: number, note: string) => request<Enrollment>(`/courses/${id}/note`, 'PUT', { note }),
  certificates: () => request<Array<{ certNo: string; title: string; teacher: string; duration: string; mode: string; completedAt: string }>>('/certificates'),
  expertProfile: () => request<ExpertProfile>('/expert/profile'),
  expertConsultations: () => request<Consultation[]>('/expert/consultations'),
  replyConsultation: (id: string | number, content: string) => request<Consultation>(`/expert/consultations/${id}/reply`, 'POST', { content }),
  experts: (category?: string) => request<Expert[]>('/experts', 'GET', undefined, { category }),
  consultations: () => request<Consultation[]>('/consultations'),
  createConsultation: (data: Record<string, unknown>) => request<Consultation>('/consultations', 'POST', data),
  resources: (type?: string) => request<ServiceResource[]>('/resources', 'GET', undefined, { type }),
  createResource: (data: Record<string, unknown>) => request<ServiceResource>('/resources', 'POST', data),
  applyProvider: (data: Record<string, unknown>) => request<{ id: string; name: string; status: string; message: string }>('/providers/apply', 'POST', data),
  insuranceProducts: () => request<Array<{ id: string | number; name: string; premium: string; coverage: string; subsidy: string; icon: string; summary: string; tags: string[]; premiumRate: number; coveragePerUnit: number; unitMeasure: string }>>('/insurance/products'),
  insurancePolicies: () => request<Array<{ id: string | number; policyNo: string; productName: string; insuredSubject: string; insuredArea: string; premium: number; coverageAmount: number; effectiveDate: string; status: string }>>('/insurance/policies'),
  insuranceClaims: () => request<Array<{ id: string | number; claimNo: string; policyNo: string; disasterType: string; status: string; progress: number; description: string }>>('/insurance/claims'),
  createClaim: (data: Record<string, unknown>) => request('/insurance/claims', 'POST', data),
  insure: (data: Record<string, unknown>) => request<{ id: string | number; policyNo: string; premium: number; coverageAmount: number }>('/insurance/policies', 'POST', data),
  diagnose: (data: Record<string, unknown>) => request<{ consultNo: string; level: string; suggestion: string; matchedDiseases: string[] }>('/ai/diagnose', 'POST', data),
  messages: () => request<Array<{ id: string | number; title: string; content: string; read: boolean; createdAt: string; type: string }>>('/messages'),
  readAll: () => request('/messages/read-all', 'POST', {}),
  /**
   * 服务商工作台：身份由访问令牌解析，路径里没有 providerId。
   * 老写法 `?providerId=1`（还带默认值）等于让调用方自报身份，换个数就能看别家的派单池。
   */
  favorites: () => request<Provider[]>('/favorites'),
  toggleFavorite: (providerId: string | number) =>
    request<{ providerId: string | number; name: string; favorited: boolean }>(`/favorites/${providerId}/toggle`, 'POST', {}),
  workbench: () => request<{
    provider: Provider
    availableDemands: Array<{
      id: string | number
      demandNo: string
      serviceName: string
      category: string
      description: string
      location: string
      area: string
      preferredDate: string
      budgetMin: number
      budgetMax: number
      quotedPrice: number
      quotedUnit: string
      contactName: string
      contactPhone: string
    }>
    todayOrders: Order[]
    myOrders: number
    completedOrders: number
    openComplaints: number
  }>('/mobile/workbench'),
  acceptDemand: (demandId: string | number) =>
    request(`/mobile/workbench/demands/${demandId}/accept`, 'POST', {}),
  reportProgress: (orderId: string | number, progress: number, note: string) =>
    request(`/mobile/workbench/orders/${orderId}/progress`, 'POST', { progress, note }),
}

export const STATUS: Record<string, { label: string; tone: string }> = {
  pending_payment: { label: '待确认预约', tone: 'orange' },
  confirmed: { label: '待服务', tone: 'blue' },
  in_progress: { label: '服务中', tone: 'green' },
  completed: { label: '已完成', tone: 'gray' },
  cancelled: { label: '已取消', tone: 'red' },
  processing: { label: '处理中', tone: 'orange' },
  resolved: { label: '已处理', tone: 'green' },
  rejected: { label: '已驳回', tone: 'red' },
  closed: { label: '已关闭', tone: 'gray' },
  effective: { label: '保障生效', tone: 'green' },
  claiming: { label: '理赔中', tone: 'orange' },
  expired: { label: '已到期', tone: 'gray' },
  submitted: { label: '已提交', tone: 'blue' },
  town_review: { label: '乡镇审核中', tone: 'orange' },
  county_review: { label: '区县审核中', tone: 'orange' },
  paid: { label: '已兑付', tone: 'green' },
  surveying: { label: '查勘中', tone: 'orange' },
  matching: { label: '匹配中', tone: 'blue' },
  assigned: { label: '已指派', tone: 'green' },
  accepted: { label: '服务商已接单', tone: 'green' },
}

export function statusMeta(status: string): { label: string; tone: string } {
  return STATUS[status] ?? { label: status, tone: 'gray' }
}

export function toast(title: string, icon: 'none' | 'success' | 'error' = 'none'): void {
  uni.showToast({ title, icon })
}
