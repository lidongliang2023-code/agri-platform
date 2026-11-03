import axios from 'axios'
import { attachUnifiedAuth } from './sso'
import type {
  AiAnswer,
  AlertMessage,
  AlertRule,
  Article,
  ArticleDetail,
  ArticleList,
  Attestation,
  Author,
  Channel,
  Course,
  CourseDetail,
  Expert,
  Favorite,
  Forecast,
  IndexDetail,
  Knowledge,
  MarketData,
  MarketDetail,
  Overview,
  PestResult,
  PlayTicket,
  PriceIndex,
  QaRecord,
  Quote,
  Report,
  SearchResult,
  Subscription,
  SupplyDemand,
  SupplyDemandDetail,
  SupplyDemandList,
} from './types'

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

const client = axios.create({
  baseURL: '/api/v1/info',
  timeout: 15000,
})

attachUnifiedAuth(client, 'info')

// 私域数据（我的发布 / 预警 / 订阅 / 收藏 / 问答记录）按统一账号昵称隔离。
// 平台令牌只承载权限，不携带昵称，因此由前端在会话建立后透传该头。
let currentUser = ''
export function setCurrentUser(name: string): void {
  currentUser = name
}
client.interceptors.request.use((config) => {
  if (currentUser) config.headers['X-Agri-User'] = encodeURIComponent(currentUser)
  return config
})

async function request<T>(promise: Promise<{ data: ApiEnvelope<T> }>): Promise<T> {
  try {
    const response = await promise
    if (response.data.code !== 200 && response.data.code !== 0) {
      throw new Error(response.data.message || '请求失败')
    }
    return response.data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = (error.response?.data as { message?: string } | undefined)?.message
      throw new Error(message || (error.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : '信息资讯服务暂时不可用'))
    }
    throw error
  }
}

export const infoApi = {
  overview: () => request<Overview>(client.get('/overview')),

  markets: (params?: { category?: string; market?: string; keyword?: string }) =>
    request<MarketData>(client.get('/markets', { params })),
  market: (id: number) => request<MarketDetail>(client.get(`/markets/${id}`)),
  compare: (ids: number[]) =>
    request<Quote[]>(client.get('/markets/compare', { params: { ids: ids.join(',') } })),
  indices: () => request<PriceIndex[]>(client.get('/indices')),
  indexDetail: (id: number) => request<IndexDetail>(client.get(`/indices/${id}`)),
  forecast: (quoteId: number, horizon: string) =>
    request<{ quote: Quote; forecast: Forecast | null; series: MarketDetail['series']; drivers: Array<{ name: string; detail: string; weight: string; state: string }>; mape: string }>(
      client.get('/forecast', { params: { quoteId, horizon } }),
    ),

  articles: (params?: { channel?: string; contentType?: string; keyword?: string; page?: number; size?: number }) =>
    request<ArticleList>(client.get('/articles', { params })),
  article: (id: number) => request<ArticleDetail>(client.get(`/articles/${id}`)),
  likeArticle: (id: number) => request<{ likeCount: number }>(client.post(`/articles/${id}/like`)),
  commentArticle: (id: number, body: { content: string; region?: string }) =>
    request<{ message: string }>(client.post(`/articles/${id}/comments`, body)),
  channels: () => request<Channel[]>(client.get('/channels')),
  authors: () => request<Author[]>(client.get('/authors')),

  supplyDemands: (params?: { type?: string; category?: string; origin?: string; sort?: string; keyword?: string }) =>
    request<SupplyDemandList>(client.get('/supply-demands', { params })),
  // 「我的发布」直接读交易撮合里我发布的商品 / 采购需求，按 type 区分两侧；
  // 后端只返回 items（在线数、待审数由交易侧状态字段自行统计）。
  mySupplyDemands: (type?: 'supply' | 'demand') => request<{ items: SupplyDemand[] }>(
    client.get('/supply-demands/mine', { params: { type } })),
  supplyDemand: (id: number, type?: string) =>
    request<SupplyDemandDetail>(client.get(`/supply-demands/${id}`, { params: { type } })),
  // 供应与需求在交易模块是两张表，id 各自自增、可能撞号，所以匹配也必须带 type，
  // 否则需求侧的匹配会拿同一个 id 去查商品，算出来的是别人的撮合结果。
  sdMatches: (id: number, type?: string) =>
    request<SupplyDemandDetail['matches']>(client.get(`/supply-demands/${id}/matches`, { params: { type } })),
  sendSdMessage: (id: number, body: { content: string }, type?: string) =>
    request<{ message: string; messages: SupplyDemandDetail['messages'] }>(
      client.post(`/supply-demands/${id}/messages`, body, { params: { type } })),

  courses: () => request<{ items: Course[]; live: Course | null; learners: number }>(client.get('/courses')),
  enrollCourse: (id: number) => request<{ message: string; course: Course }>(client.post(`/courses/${id}/enroll`)),
  courseDetail: (id: number) => request<CourseDetail>(client.get(`/courses/${id}`)),
  playTicket: (courseId: number, lessonId: number) =>
    request<PlayTicket>(client.post(`/courses/${courseId}/lessons/${lessonId}/play-ticket`)),
  reportProgress: (courseId: number, lessonId: number, body: { positionSec: number; finished?: boolean }) =>
    request<{ lessonId: number; positionSec: number; progress: number; finished: boolean }>(
      client.post(`/courses/${courseId}/lessons/${lessonId}/progress`, body)),
  knowledge: (params?: { keyword?: string; crop?: string }) =>
    request<Knowledge[]>(client.get('/knowledge', { params })),
  knowledgeDetail: (id: number) => request<Knowledge>(client.get(`/knowledge/${id}`)),

  askAi: (body: { question: string; crop?: string }) => request<AiAnswer>(client.post('/ai/qa', body)),
  pestIdentify: (body: { crop: string; symptom: string }) => request<PestResult>(client.post('/ai/pest', body)),
  qaRecords: () => request<QaRecord[]>(client.get('/ai/records')),

  experts: (field?: string) =>
    request<{ items: Expert[]; fields: string[]; questions: QaRecord[] }>(client.get('/experts', { params: { field } })),
  expert: (id: number) => request<Expert>(client.get(`/experts/${id}`)),
  myExpert: () => request<Expert[]>(client.get('/experts/mine')),
  applyExpert: (body: Record<string, unknown>) =>
    request<{ message: string; status: string; records: Expert[] }>(client.post('/experts/apply', body)),

  reports: (category?: string) =>
    request<{ items: Report[]; categories: string[]; downloads: number }>(client.get('/reports', { params: { category } })),
  report: (id: number) => request<Report>(client.get(`/reports/${id}`)),
  myReports: () => request<Report[]>(client.get('/reports/mine')),
  downloadReport: (id: number) => request<{ message: string; downloads: number }>(client.post(`/reports/${id}/download`)),

  attestations: () => request<Attestation[]>(client.get('/attestations')),
  attestation: (id: number) => request<Attestation>(client.get(`/attestations/${id}`)),
  verifyAttestation: (attestNo: string) =>
    request<{ valid: boolean; message: string; record?: Attestation }>(client.post('/attestations/verify', { attestNo })),

  alertRules: () => request<AlertRule[]>(client.get('/alerts/rules')),
  createAlertRule: (body: Record<string, unknown>) =>
    request<{ message: string; rules: AlertRule[] }>(client.post('/alerts/rules', body)),
  updateAlertRule: (id: number, body: Record<string, unknown>) =>
    request<{ message: string; rules: AlertRule[] }>(client.patch(`/alerts/rules/${id}`, body)),
  alertMessages: () => request<{ items: AlertMessage[]; unread: number }>(client.get('/alerts/messages')),
  readAllAlerts: () => request<{ updated: number }>(client.post('/alerts/messages/read-all')),

  subscriptions: () => request<Subscription[]>(client.get('/subscriptions')),
  createSubscription: (body: Record<string, unknown>) =>
    request<{ message: string; subscriptions: Subscription[] }>(client.post('/subscriptions', body)),
  toggleSubscription: (id: number, enabled: boolean) =>
    request<{ message: string; subscriptions: Subscription[] }>(client.patch(`/subscriptions/${id}`, { enabled })),

  favorites: () => request<Favorite[]>(client.get('/favorites')),
  addFavorite: (body: { targetType: string; targetId: number; title: string; summary?: string }) =>
    request<{ message: string; favorites: Favorite[] }>(client.post('/favorites', body)),
  removeFavorite: (id: number) => request<{ message: string; favorites: Favorite[] }>(client.delete(`/favorites/${id}`)),

  search: (keyword: string) => request<SearchResult>(client.get('/search', { params: { keyword } })),
}

export type { Article }
