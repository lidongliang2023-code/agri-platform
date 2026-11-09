import axios from 'axios'
import { attachUnifiedAuth } from './sso'
import type {
  CollectionAlert,
  CollectionAlertPolicy,
  AiAdmin,
  AttestationsAdmin,
  AuditLog,
  Author,
  Channel,
  Contents,
  Dashboard,
  ExpertsAdmin,
  OpsCourse,
  OpsLesson,
  QuotesAdmin,
  RecommendItem,
  RecommendAdmin,
  ReportsAdmin,
  StatsAdmin,
  SupplyDemandsAdmin,
} from './types'

interface ApiEnvelope<T> {
  code: number
  message: string
  data: T
}

const client = axios.create({
  baseURL: '/api/v1/info/ops',
  timeout: 15000,
})

attachUnifiedAuth(client, 'info-ops')

// 写操作要落审计日志，操作人由统一账号昵称决定，因此同样通过 X-Agri-User 透传。
let operator = ''
export function setOperator(name: string): void {
  operator = name
}
client.interceptors.request.use((config) => {
  if (operator) config.headers['X-Agri-User'] = encodeURIComponent(operator)
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
      throw new Error(message || (error.code === 'ECONNABORTED' ? '请求超时，请稍后重试' : '信息资讯运营服务暂时不可用'))
    }
    throw error
  }
}

export const opsApi = {
  dashboard: () => request<Dashboard>(client.get('/dashboard')),

  contents: (params?: { status?: string; contentType?: string; channel?: string; keyword?: string }) =>
    request<Contents>(client.get('/contents', { params })),
  content: (id: number) => request<Record<string, unknown>>(client.get(`/contents/${id}`)),
  saveContent: (body: Record<string, unknown>) => request<{ message: string }>(client.post('/contents', body)),
  auditContent: (id: number, body: { action: string; note?: string }) =>
    request<{ message: string }>(client.post(`/contents/${id}/audit`, body)),
  offlineContent: (id: number, body: { note?: string }) =>
    request<{ message: string }>(client.post(`/contents/${id}/offline`, body)),

  channels: () => request<{ channels: Channel[]; authors: Author[] }>(client.get('/channels')),
  saveChannel: (body: Record<string, unknown>) => request<{ message: string }>(client.post('/channels', body)),
  updateAuthor: (id: number, body: Record<string, unknown>) =>
    request<{ message: string; authors: Author[] }>(client.patch(`/authors/${id}`, body)),

  quotes: () => request<QuotesAdmin>(client.get('/quotes')),
  saveQuote: (body: Record<string, unknown>) => request<{ message: string }>(client.post('/quotes', body)),
  runTask: (id: number) => request<{ message: string; status: string }>(client.post(`/collect-tasks/${id}/run`, {}, { timeout: 180000 })),
  collectionSchedule: (id: number) => request<{ enabled: boolean; cron: string; maxRetries: number; retrySeconds: number; nextRunAt?: string; lastResult?: string }>(client.get(`/collect-tasks/${id}/schedule`)),
  saveCollectionSchedule: (id: number, body: Record<string, unknown>) => request<{ message: string }>(client.post(`/collect-tasks/${id}/schedule`, body)),
  collectionConfig: (id: number) => request<Record<string, unknown>>(client.get(`/collect-tasks/${id}/config`)),
  saveCollectionConfig: (id: number, body: Record<string, unknown>) => request<{ message: string }>(client.post(`/collect-tasks/${id}/config`, body)),
  collectionRuns: (id: number) => request<Array<{ id: number; startedAt: string; status: string; totalRows: number; acceptedRows: number; duplicateRows: number; rejectedRows: number; detail: string }>>(client.get(`/collect-tasks/${id}/runs`)),
  collectionAlerts: (status: string, taskId?: number) => request<{ items: CollectionAlert[]; freshness: import('./types').CollectionFreshness[]; total: number; activeCount: number; pendingCount: number }>(client.get('/collection-alerts', { params: { status, taskId } })),
  collectionAlertPolicy: (id: number) => request<CollectionAlertPolicy>(client.get(`/collect-tasks/${id}/alert-policy`)),
  saveCollectionAlertPolicy: (id: number, body: CollectionAlertPolicy) => request<{ message: string }>(client.post(`/collect-tasks/${id}/alert-policy`, body)),
  acknowledgeCollectionAlert: (id: number, note: string) => request<{ message: string }>(client.post(`/collection-alerts/${id}/acknowledge`, { note })),
  quality: () => request<QuotesAdmin['quality']>(client.get('/quality')),
  saveAlertRule: (body: Record<string, unknown>) => request<{ message: string }>(client.post('/alert-rules', body)),
  forecastConfig: () => request<Record<string, unknown>>(client.get('/forecast-config')),
  saveForecastConfig: (body: Record<string, unknown>) =>
    request<Record<string, unknown>>(client.post('/forecast-config', body)),

  supplyDemands: (params?: { status?: string; keyword?: string }) =>
    request<SupplyDemandsAdmin>(client.get('/supply-demands', { params })),
  // 供应与需求在交易模块是两张表、id 各自自增，审核必须带 type，否则会审到另一侧同号记录。
  auditSupplyDemand: (id: number, body: { action: string; note?: string }, type?: string) =>
    request<{ message: string }>(client.post(`/supply-demands/${id}/audit`, body, { params: { type } })),

  recommend: () => request<RecommendAdmin>(client.get('/recommend')),
  saveSlot: (id: number, body: Record<string, unknown>) =>
    request<{ message: string }>(client.post(`/recommend/slots/${id}`, body)),
  saveSensitiveWord: (body: Record<string, unknown>) =>
    request<{ message: string }>(client.post('/sensitive-words', body)),

  recommendItems: (slotId: number) =>
    request<RecommendItem[]>(client.get(`/recommend/slots/${slotId}/items`)),
  saveRecommendItems: (slotId: number, articleIds: number[]) =>
    request<{ message: string; items: RecommendItem[] }>(
      client.post(`/recommend/slots/${slotId}/items`, { articleIds })),

  ai: (keyword?: string) => request<AiAdmin>(client.get('/ai', { params: { keyword } })),
  saveKnowledge: (body: Record<string, unknown>) => request<{ message: string }>(client.post('/ai/knowledge', body)),

  reports: (status?: string) => request<ReportsAdmin>(client.get('/reports', { params: { status } })),
  auditReport: (id: number, body: { action: string; note?: string }) =>
    request<{ message: string }>(client.post(`/reports/${id}/audit`, body)),

  attestations: () => request<AttestationsAdmin>(client.get('/attestations')),
  createAttestation: (body: Record<string, unknown>) =>
    request<{ message: string; attestNo: string }>(client.post('/attestations', body)),

  experts: (status?: string) => request<ExpertsAdmin>(client.get('/experts', { params: { status } })),
  auditExpert: (id: number, body: { action: string; note?: string }) =>
    request<{ message: string }>(client.post(`/experts/${id}/audit`, body)),

  stats: () => request<StatsAdmin>(client.get('/stats')),
  auditLogs: () => request<AuditLog[]>(client.get('/audit-logs')),

  // ---------- 培训课程与视频 ----------
  courses: () => request<{ items: OpsCourse[] }>(client.get('/courses')),
  courseLessons: (id: number) => request<OpsLesson[]>(client.get(`/courses/${id}/lessons`)),
  saveCourse: (body: Record<string, unknown>) => request<Record<string, unknown>>(client.post('/courses', body)),
  publishCourse: (id: number, status: 'published' | 'draft') =>
    request<{ message: string }>(client.post(`/courses/${id}/publish`, null, { params: { status } })),
  deleteCourse: (id: number) => request<{ message: string }>(client.delete(`/courses/${id}`)),
  saveLesson: (courseId: number, body: Record<string, unknown>) =>
    request<{ lessons: OpsLesson[] }>(client.post(`/courses/${courseId}/lessons`, body)),
  deleteLesson: (courseId: number, lessonId: number) =>
    request<{ lessons: OpsLesson[] }>(client.delete(`/courses/${courseId}/lessons/${lessonId}`)),

  /**
   * 视频上传。
   *
   * timeout 置 0 是有意的：几百 MB 的文件在慢网络下必然超过默认 15 秒，
   * 用默认值会让上传在 90% 处莫名失败（axios 报 ECONNABORTED，但服务端其实还在收）。
   */
  uploadMedia: (
    courseId: number,
    file: File,
    onProgress?: (percent: number) => void,
  ) => {
    const form = new FormData()
    form.append('file', file)
    return request<{ url: string; size: number; originalName: string; codec?: string }>(
      client.post('/media/upload', form, {
        params: { courseId },
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0,
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100))
          }
        },
      }),
    )
  },
}

export function cloudFactoryRequest<T>(path: string, body?: unknown, method = 'POST'): Promise<T> {
  return request<T>(body === undefined ? client.get(path) : client.request({ url: path, method, data: body }))
}
