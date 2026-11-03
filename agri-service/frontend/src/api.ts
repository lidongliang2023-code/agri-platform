import axios from 'axios'
import { attachUnifiedAuth } from './sso'
import type {
  Certificate,
  Complaint,
  Consultation,
  Course,
  Demand,
  Dictionaries,
  DiagnoseResult,
  Enrollment,
  Expert,
  InsuranceClaim,
  InsurancePolicy,
  InsuranceProduct,
  Overview,
  Policy,
  PolicyApplication,
  Provider,
  ServiceIdentity,
  ServiceMessage,
  ServiceOrder,
  ServiceResource,
} from './types'

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

const client = axios.create({
  baseURL: '/api/v1/service',
  timeout: 12000,
})

attachUnifiedAuth(client, 'service')

async function request<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const response = await promise
    // 平台 common.ApiResponse 以 200 表示业务成功；兼容部分历史网关的 0 约定。
    if (response.data.code !== 200 && response.data.code !== 0) {
      throw new Error(response.data.message || '请求失败')
    }
    return response.data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = (error.response?.data as { message?: string } | undefined)?.message
      throw new Error(message || (error.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : '综合服务暂时不可用'))
    }
    throw error
  }
}

export const serviceApi = {
  /** 当前令牌解析出的主体与身份，页面用它显示"我在替谁下单"。 */
  identity: () => request<ServiceIdentity>(client.get('/identity')),
  dictionaries: () => request<Dictionaries>(client.get('/dictionaries')),
  overview: () => request<Overview>(client.get('/overview')),
  providers: (params?: { category?: string; keyword?: string; sort?: string }) =>
    request<Provider[]>(client.get('/providers', { params })),
  provider: (id: number) => request<Provider>(client.get(`/providers/${id}`)),
  applyProvider: (body: Record<string, unknown>) =>
    request<{ name: string; status: string; message: string }>(client.post('/providers/apply', body)),

  orders: (params?: { status?: string; keyword?: string }) =>
    request<ServiceOrder[]>(client.get('/orders', { params })),
  order: (id: number) => request<ServiceOrder>(client.get(`/orders/${id}`)),
  createOrder: (body: Record<string, unknown>) =>
    request<ServiceOrder>(client.post('/orders', body)),
  updateOrder: (id: number, body: Record<string, unknown>) =>
    request<ServiceOrder>(client.patch(`/orders/${id}`, body)),
  reviewOrder: (id: number, body: { rating: number; review: string }) =>
    request<ServiceOrder>(client.post(`/orders/${id}/review`, body)),

  demands: () => request<Demand[]>(client.get('/demands')),
  myDemands: () => request<Demand[]>(client.get('/demands/mine')),
  createDemand: (body: Record<string, unknown>) =>
    request<Demand>(client.post('/demands', body)),

  policies: (keyword?: string) => request<Policy[]>(client.get('/policies', { params: { keyword } })),
  policyApplications: () => request<PolicyApplication[]>(client.get('/policies/applications')),
  applyPolicy: (body: Record<string, unknown>) =>
    request<PolicyApplication>(client.post('/policies/applications', body)),

  insuranceProducts: () => request<InsuranceProduct[]>(client.get('/insurance/products')),
  insurancePolicies: () => request<InsurancePolicy[]>(client.get('/insurance/policies')),
  insuranceClaims: () => request<InsuranceClaim[]>(client.get('/insurance/claims')),
  insure: (body: Record<string, unknown>) =>
    request<InsurancePolicy>(client.post('/insurance/policies', body)),
  createClaim: (body: Record<string, unknown>) =>
    request<InsuranceClaim>(client.post('/insurance/claims', body)),

  courses: () => request<Course[]>(client.get('/courses')),
  enrollCourse: (id: number) => request<Course>(client.post(`/courses/${id}/enroll`)),
  updateCourseProgress: (id: number, progress: number) =>
    request<Enrollment>(client.patch(`/courses/${id}/progress`, { progress })),
  saveCourseNote: (id: number, note: string) =>
    request<Enrollment>(client.put(`/courses/${id}/note`, { note })),
  enrollments: () => request<Enrollment[]>(client.get('/enrollments')),
  certificates: () => request<Certificate[]>(client.get('/certificates')),
  experts: (category?: string) => request<Expert[]>(client.get('/experts', { params: { category } })),
  consultations: () => request<Consultation[]>(client.get('/consultations')),
  createConsultation: (body: Record<string, unknown>) =>
    request<Consultation>(client.post('/consultations', body)),
  diagnose: (body: Record<string, unknown>) =>
    request<DiagnoseResult>(client.post('/ai/diagnose', body)),

  resources: (type?: string) => request<ServiceResource[]>(client.get('/resources', { params: { type } })),
  createResource: (body: Record<string, unknown>) =>
    request<ServiceResource>(client.post('/resources', body)),
  favorites: () => request<Provider[]>(client.get('/favorites')),
  toggleFavorite: (providerId: number) =>
    request<{ providerId: number; name: string; favorited: boolean }>(
      client.post(`/favorites/${providerId}/toggle`),
    ),

  messages: () => request<ServiceMessage[]>(client.get('/messages')),
  readAllMessages: () => request<{ updated: number }>(client.post('/messages/read-all')),
  complaints: () => request<Complaint[]>(client.get('/complaints')),
  createComplaint: (body: Record<string, unknown>) =>
    request<Complaint>(client.post('/complaints', body)),
}
