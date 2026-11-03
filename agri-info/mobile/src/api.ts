import { API_BASE, MEDIA_BASE, currentOwner, getInfoToken, handleInfoUnauthorized } from './auth'

/* ===================== 领域类型（与 PC 用户端同构，字段名对齐后端返回） ===================== */

export interface Channel {
  id: number
  code: string
  name: string
  icon: string
  description: string
  articleCount: number
  status: string
}

export interface Article {
  id: number
  articleNo: string
  title: string
  channel: string
  contentType: string
  summary: string
  content?: string
  author: string
  authorType: string
  coverIcon: string
  tags: string[]
  readCount: number
  likeCount: number
  commentCount: number
  favoriteCount: number
  status: string
  riskLevel: string
  riskNote: string
  isTop: boolean
  aiGenerated: boolean
  source: string
  publishedAt: string
}

export interface ArticleComment {
  id: number
  userName: string
  userRegion: string
  content: string
  likeCount: number
  createdAt: string
}

export interface Quote {
  id: number
  code: string
  name: string
  icon: string
  category: string
  origin: string
  market: string
  price: number
  priceUnit: string
  changeAmount: number
  changePct: number
  weekPct: number
  monthPct: number
  spec: string
  source: string
  trend: number[]
  monitorLevel: string
  status: string
  updatedAt: string
  normalized?: number[]
}

export interface SeriesPoint {
  date: string
  price?: number
  value?: number
  low?: number
  high?: number
  forecast: boolean
}

export interface Forecast {
  id: number
  quoteId: number
  horizon: string
  midPrice: number
  lowPrice: number
  highPrice: number
  upProbability: number
  flatProbability: number
  downProbability: number
  supplyIndex: number
  demandIndex: number
  stockDays: string
  salesAdvice: string
  plantAdvice: string
  confidence: number
  mape: number
  drivers: string
  updatedAt: string
}

export interface RegionPrice {
  region: string
  price: number
  changePct: number
}

export interface AiRead {
  content: string
  confidence: number
  updatedAt?: string
}

export interface MarketData {
  stats: { total: number; up: number; down: number; flat: number; abnormal: number }
  quotes: Quote[]
  categories: string[]
  markets: string[]
  regionPrices: RegionPrice[]
  aiRead: AiRead
}

export interface MarketDetail extends Quote {
  series: SeriesPoint[]
  forecast: Forecast | null
  regionPrices: RegionPrice[]
  relatedArticles: Article[]
  aiRead: AiRead
  alertRules: AlertRule[]
}

export interface PriceIndex {
  id: number
  code: string
  name: string
  category: string
  value: number
  changePct: number
  basePeriod: string
  sampleCount: number
  method: string
  trend: number[]
  status: string
  publishedAt: string
}

export interface IndexDetail extends PriceIndex {
  series: SeriesPoint[]
  components: Array<{
    id: number
    name: string
    icon: string
    origin: string
    price: number
    priceUnit: string
    changePct: number
  }>
}

export interface Overview {
  stats: {
    monitoredQuotes: number
    todayArticles: number
    unreadAlerts: number
    onlineSupplyDemand: number
    aiCalls: number
  }
  greeting: { owner: string; date: string; headline: string }
  ticker: string[]
  feed: Article[]
  hotRank: Array<{ quoteId: number; name: string; icon: string; origin: string; changePct: number; price: number }>
  aiBrief: { title: string; lines: string[]; confidence: number; articleId: number }
  live: Course | null
  channels: Channel[]
  todos: Array<{ title: string; content: string; page: string; tag: string }>
}

export interface ArticleList {
  items: Article[]
  total: number
  page: number
  size: number
  channels: Channel[]
  hot: Array<{ id: number; title: string; readCount: number; coverIcon: string }>
}

export interface ArticleDetail extends Article {
  content: string
  comments: ArticleComment[]
  related: Article[]
  favorited: boolean
  attestation: Attestation | null
}

export interface SupplyDemand {
  id: number
  sdNo: string
  sdType: 'supply' | 'demand'
  title: string
  category: string
  variety: string
  spec: string
  quantity: string
  price: number
  priceUnit: string
  origin: string
  marketRef: string
  availableDate: string
  durationDays: number
  expireDate: string
  contactName: string
  contactPhone: string
  orgName: string
  orgType: string
  verified: boolean
  badge: string
  matchScore: number
  viewCount: number
  chatCount: number
  isTop: boolean
  status: string
  auditNote: string
  owner: string
  createdAt: string
}

export interface SdMatch {
  id: number
  sdId: number
  targetType: string
  targetTitle: string
  targetOrg: string
  targetRegion: string
  score: number
  priceGap: string
  distanceKm: number
  reason: string
  status: string
}

export interface SdMessage {
  id: number
  sdId: number
  direction: string
  fromName: string
  content: string
  createdAt: string
}

export interface SupplyDemandList {
  stats: {
    supplyCount: number
    demandCount: number
    todayCount: number
    matchRate: number
    avgResponse: number
  }
  ai: { headline: string; content: string; confidence: number; suggestions: number }
  items: SupplyDemand[]
  categories: string[]
  origins: string[]
}

export interface SupplyDemandDetail extends SupplyDemand {
  matches: SdMatch[]
  messages: SdMessage[]
  priceRef: {
    variety: string
    available: boolean
    price?: number
    priceUnit?: string
    changePct?: number
    origin?: string
    note: string
  }
}

export interface Course {
  id: number
  title: string
  teacher: string
  mode: string
  duration: string
  learners: number
  rating: number
  progress: number
  coverIcon: string
  summary: string
  tags: string[]
  liveAt: string
  isLive: boolean
  status: string
  /** 后端按当前统一账号算出的个人进度与报名状态（不是全站共享的 progress）。 */
  enrolled?: boolean
  lessonCount?: number
  totalDurationSec?: number
}

/** 课程章节。不含播放地址 —— 地址逐节换票，见 PlayTicket。 */
export interface CourseLesson {
  id: number
  courseId: number
  seq: number
  title: string
  durationSec: number
  durationLabel: string
  mediaType: string
  coverUrl: string | null
  freePreview: boolean
  status: string
  positionSec: number
  progress: number
  finished: boolean
  playable: boolean
}

export interface CourseDetail extends Course {
  lessons: CourseLesson[]
  lessonCount: number
  totalDurationSec: number
  enrolled: boolean
  lastLessonId: number
}

/** 播放票据：短时签名地址，过期（410）需重新换取。 */
export interface PlayTicket {
  lessonId: number
  title: string
  mediaType: string
  durationSec: number
  url: string
  expiresIn: number
}

export interface QaRecord {
  id: number
  qaNo: string
  qaType: string
  question: string
  answer: string
  category: string
  crop: string
  sourceRefs: string
  confidence: number
  expertName: string
  status: string
  askedBy: string
  createdAt: string
}

export interface AiAnswer {
  qaNo: string
  answer: string
  category: string
  confidence: number
  sourceRefs: string[]
  related: Array<{ id: number; title: string; summary: string }>
  expertAvailable: boolean
}

export interface PestResult {
  qaNo: string
  crop: string
  candidates: Array<{ name: string; probability: number; note: string }>
  advice: string
  expertAvailable: boolean
}

export interface Expert {
  id: number
  name: string
  title: string
  orgName: string
  field: string
  region: string
  certNo: string
  level: string
  intro: string
  answerCount: number
  rating: number
  followers: number
  status: string
  applyAt: string
  auditAt: string
  auditNote: string
  owner: string
  answers?: QaRecord[]
}

export interface Report {
  id: number
  reportNo: string
  title: string
  category: string
  period: string
  summary: string
  sections: string | string[]
  pageCount: number
  price: number
  downloads: number
  isFree: boolean
  status: string
  publishedAt: string
  related?: Array<{ id: number; title: string; category: string; period: string }>
  attestation?: Attestation | null
}

export interface Attestation {
  id: number
  attestNo: string
  title: string
  contentType: string
  contentId: number
  contentHash: string
  chainName: string
  blockHeight: string
  txId: string
  attestedAt: string
  status: string
  verifyCount: number
  owner: string
  steps?: Array<{ title: string; note: string; done: boolean }>
}

export interface AlertRule {
  id: number
  ruleName: string
  quoteId: number
  quoteName: string
  metric: string
  operator: string
  threshold: number
  channel: string
  enabled: boolean
  hitCount: number
}

export interface AlertMessage {
  id: number
  ruleId: number
  title: string
  content: string
  level: string
  quoteName: string
  triggerValue: string
  read: boolean
  createdAt: string
}

export interface Subscription {
  id: number
  targetType: string
  targetName: string
  channel: string
  frequency: string
  enabled: boolean
}

export interface Favorite {
  id: number
  targetType: string
  targetId: number
  title: string
  summary: string
  createdAt: string
}

export interface SearchResult {
  keyword: string
  articles: Article[]
  quotes: Quote[]
  knowledge: Knowledge[]
  supplyDemands: SupplyDemand[]
  reports: Report[]
  total: number
}

export interface Knowledge {
  id: number
  title: string
  category: string
  crop: string
  summary: string
  content: string
  sourceName: string
  viewCount: number
  tags: string[]
  updatedAt: string
  related?: Array<{ id: number; title: string; category: string; crop: string; summary: string }>
}

/* ===================== 请求封装 ===================== */

interface Envelope<T> {
  code: number
  message: string
  data: T
}

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'

function query(params?: Record<string, string | number | undefined>): string {
  if (!params) return ''
  const pairs = Object.keys(params)
    .filter((key) => params[key] !== undefined && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(String(params[key]))}`)
  return pairs.length ? `?${pairs.join('&')}` : ''
}

export function request<T>(
  url: string,
  method: Method = 'GET',
  data?: Record<string, unknown>,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const owner = currentOwner()
    const token = getInfoToken()
    uni.request({
      url: `${API_BASE}/api/v1/info${url}${query(params)}`,
      method,
      data,
      timeout: 15000,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        // 私域数据归属：平台令牌只承载权限，昵称由前端透传（与 PC 端同一约定）。
        ...(owner ? { 'X-Agri-User': encodeURIComponent(owner) } : {}),
      },
      success(response) {
        const body = response.data as Envelope<T>
        if (response.statusCode === 401) {
          handleInfoUnauthorized()
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
        reject(new Error(body?.message || '信息资讯服务请求失败'))
      },
      fail(error: { errMsg?: string }) {
        reject(new Error(error?.errMsg || '网络异常，请检查服务地址与网络'))
      },
    })
  })
}

export const infoApi = {
  overview: () => request<Overview>('/overview'),

  markets: (params?: { category?: string; market?: string; keyword?: string }) =>
    request<MarketData>('/markets', 'GET', undefined, params),
  market: (id: number) => request<MarketDetail>(`/markets/${id}`),
  compare: (ids: number[]) => request<Quote[]>('/markets/compare', 'GET', undefined, { ids: ids.join(',') }),
  indices: () => request<PriceIndex[]>('/indices'),
  indexDetail: (id: number) => request<IndexDetail>(`/indices/${id}`),
  forecast: (quoteId: number, horizon: string) =>
    request<{
      quote: Quote
      forecast: Forecast | null
      series: SeriesPoint[]
      drivers: Array<{ name: string; detail: string; weight: string; state: string }>
      mape: string
    }>('/forecast', 'GET', undefined, { quoteId, horizon }),

  articles: (params?: { channel?: string; contentType?: string; keyword?: string; page?: number; size?: number }) =>
    request<ArticleList>('/articles', 'GET', undefined, params),
  article: (id: number) => request<ArticleDetail>(`/articles/${id}`),
  likeArticle: (id: number) => request<{ likeCount: number }>(`/articles/${id}/like`, 'POST'),
  commentArticle: (id: number, body: { content: string; region?: string }) =>
    request<{ message: string }>(`/articles/${id}/comments`, 'POST', body),
  channels: () => request<Channel[]>('/channels'),

  supplyDemands: (params?: { type?: string; category?: string; origin?: string; sort?: string; keyword?: string }) =>
    request<SupplyDemandList>('/supply-demands', 'GET', undefined, params),
  mySupplyDemands: () =>
    request<{ items: SupplyDemand[]; onlineCount: number; pendingCount: number }>('/supply-demands/mine'),
  supplyDemand: (id: number) => request<SupplyDemandDetail>(`/supply-demands/${id}`),
  publishSupplyDemand: (body: Record<string, unknown>) =>
    request<{ sdNo: string; status: string; matchScore: number; message: string }>('/supply-demands', 'POST', body),
  sdMatches: (id: number) => request<SdMatch[]>(`/supply-demands/${id}/matches`),
  sendSdMessage: (id: number, body: { content: string }, type?: string) =>
    request<{ message: string; messages: SdMessage[] }>(
      `/supply-demands/${id}/messages`, 'POST', body, { type }),

  courses: () => request<{ items: Course[]; live: Course | null; learners: number }>('/courses'),
  enrollCourse: (id: number) => request<{ message: string; course: Course }>(`/courses/${id}/enroll`, 'POST'),
  courseDetail: (id: number) => request<CourseDetail>(`/courses/${id}`),
  playTicket: (courseId: number, lessonId: number) =>
    request<PlayTicket>(`/courses/${courseId}/lessons/${lessonId}/play-ticket`, 'POST'),
  reportProgress: (courseId: number, lessonId: number, body: { positionSec: number; finished?: boolean }) =>
    request<{ lessonId: number; positionSec: number; progress: number; finished: boolean }>(
      `/courses/${courseId}/lessons/${lessonId}/progress`, 'POST', body),
  knowledge: (params?: { keyword?: string; crop?: string }) =>
    request<Knowledge[]>('/knowledge', 'GET', undefined, params),
  knowledgeDetail: (id: number) => request<Knowledge>(`/knowledge/${id}`),

  askAi: (body: { question: string; crop?: string }) => request<AiAnswer>('/ai/qa', 'POST', body),
  pestIdentify: (body: { crop: string; symptom: string }) => request<PestResult>('/ai/pest', 'POST', body),
  qaRecords: () => request<QaRecord[]>('/ai/records'),

  experts: (field?: string) =>
    request<{ items: Expert[]; fields: string[]; questions: QaRecord[] }>('/experts', 'GET', undefined, { field }),
  expert: (id: number) => request<Expert>(`/experts/${id}`),
  myExpert: () => request<Expert[]>('/experts/mine'),
  applyExpert: (body: Record<string, unknown>) =>
    request<{ message: string; status: string; records: Expert[] }>('/experts/apply', 'POST', body),

  reports: (category?: string) =>
    request<{ items: Report[]; categories: string[]; downloads: number }>('/reports', 'GET', undefined, { category }),
  report: (id: number) => request<Report>(`/reports/${id}`),
  myReports: () => request<Report[]>('/reports/mine'),
  downloadReport: (id: number) =>
    request<{ message: string; downloads: number }>(`/reports/${id}/download`, 'POST'),

  attestations: () => request<Attestation[]>('/attestations'),
  attestation: (id: number) => request<Attestation>(`/attestations/${id}`),
  verifyAttestation: (attestNo: string) =>
    request<{ valid: boolean; message: string; record?: Attestation }>('/attestations/verify', 'POST', { attestNo }),

  alertRules: () => request<AlertRule[]>('/alerts/rules'),
  createAlertRule: (body: Record<string, unknown>) =>
    request<{ message: string; rules: AlertRule[] }>('/alerts/rules', 'POST', body),
  updateAlertRule: (id: number, body: Record<string, unknown>) =>
    request<{ message: string; rules: AlertRule[] }>(`/alerts/rules/${id}`, 'PUT', body),
  alertMessages: () => request<{ items: AlertMessage[]; unread: number }>('/alerts/messages'),
  readAllAlerts: () => request<{ updated: number }>('/alerts/messages/read-all', 'POST'),

  subscriptions: () => request<Subscription[]>('/subscriptions'),
  createSubscription: (body: Record<string, unknown>) =>
    request<{ message: string; subscriptions: Subscription[] }>('/subscriptions', 'POST', body),
  toggleSubscription: (id: number, enabled: boolean) =>
    request<{ message: string; subscriptions: Subscription[] }>(`/subscriptions/${id}`, 'PUT', { enabled }),

  favorites: () => request<Favorite[]>('/favorites'),
  addFavorite: (body: { targetType: string; targetId: number; title: string; summary?: string }) =>
    request<{ message: string; favorites: Favorite[] }>('/favorites', 'POST', body),
  removeFavorite: (id: number) =>
    request<{ message: string; favorites: Favorite[] }>(`/favorites/${id}`, 'DELETE'),

  search: (keyword: string) => request<SearchResult>('/search', 'GET', undefined, { keyword }),
}

/* ===================== 展示辅助 ===================== */

export const STATUS: Record<string, { label: string; tone: string }> = {
  online: { label: '展示中', tone: 'green' },
  pending: { label: '审核中', tone: 'orange' },
  draft: { label: '草稿', tone: 'gray' },
  offline: { label: '已下架', tone: 'gray' },
  rejected: { label: '已驳回', tone: 'red' },
  expired: { label: '已过期', tone: 'gray' },
  published: { label: '已发布', tone: 'green' },
  approved: { label: '已通过', tone: 'green' },
  valid: { label: '有效', tone: 'green' },
  active: { label: '有效', tone: 'green' },
  paused: { label: '已暂停', tone: 'orange' },
}

export function statusMeta(status: string): { label: string; tone: string } {
  return STATUS[status] ?? { label: status || '—', tone: 'gray' }
}

export function toast(title: string, icon: 'none' | 'success' | 'error' = 'none'): void {
  uni.showToast({ title, icon })
}

/**
 * 把播放票据里的相对地址补成当前端可用的绝对地址。
 *
 * <p>H5 同源时 MEDIA_BASE 为空，返回 /vod/xxx 由浏览器补 origin；
 * 小程序与 App 必须拿到完整 https 地址，否则 video 组件直接黑屏且不报错。</p>
 */
export function mediaUrl(path: string): string {
  if (!path) {
    return ''
  }
  if (/^https?:\/\//i.test(path)) {
    return path
  }
  return `${MEDIA_BASE}${path.startsWith('/') ? path : `/${path}`}`
}

/** 涨跌方向：国内农产品行情惯例 —— 涨红、跌绿、平灰。 */
export function trendClass(value: number): string {
  if (value > 0) return 'up'
  if (value < 0) return 'down'
  return 'flat'
}

export function signed(value: number, digits = 2): string {
  const abs = Math.abs(Number(value || 0)).toFixed(digits)
  if (Number(value) > 0) return `+${abs}`
  if (Number(value) < 0) return `-${abs}`
  return '0.00'
}

export function money(value: number, digits = 2): string {
  return Number(value || 0).toFixed(digits)
}

/** 相对时间：原型里的「2小时前 / 昨天 / 10-21」这套口径。 */
export function timeAgo(input: string): string {
  if (!input) return ''
  const text = String(input).replace('T', ' ').replace(/-/g, '/')
  const time = new Date(text).getTime()
  if (Number.isNaN(time)) return String(input)
  const diff = Date.now() - time
  if (diff < 0) return String(input).slice(5, 16)
  const minute = 60 * 1000
  if (diff < minute) return '刚刚'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}分钟前`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}小时前`
  if (diff < 48 * 60 * minute) return '昨天'
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))}天前`
  return String(input).slice(5, 10)
}

export function dayLabel(input: string): string {
  if (!input) return ''
  const text = String(input).replace('T', ' ').replace(/-/g, '/')
  const time = new Date(text).getTime()
  if (Number.isNaN(time)) return String(input).slice(0, 10)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = today.getTime() - new Date(time).setHours(0, 0, 0, 0)
  if (diff <= 0) return '今天'
  if (diff <= 24 * 60 * 60 * 1000) return '昨天'
  return String(input).slice(5, 10)
}

export function splitParagraphs(content: string): Array<{ type: 'h' | 'p' | 'q'; text: string }> {
  const blocks = String(content || '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
  return blocks.map((text) => {
    if (/^[一二三四五六七八九十]+、/.test(text) || /^第[一二三四五六七八九十]+章/.test(text)) {
      return { type: 'h' as const, text }
    }
    if (text.startsWith('>') || text.startsWith('＊') || text.startsWith('*')) {
      return { type: 'q' as const, text: text.replace(/^[>＊*]\s*/, '') }
    }
    return { type: 'p' as const, text }
  })
}

export function toArray(value: string | string[] | undefined): string[] {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.map(String) : [String(value)]
  } catch {
    return String(value)
      .split(/[,，、]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
}

/** 本地浏览历史（无服务端接口，按设备留存，最多 60 条）。 */
const HISTORY_KEY = 'info_view_history'

export interface ViewRecord {
  type: string
  id: number
  title: string
  summary: string
  icon: string
  at: string
}

export function pushView(record: Omit<ViewRecord, 'at'>): void {
  const list = getViews().filter((item) => !(item.type === record.type && item.id === record.id))
  list.unshift({ ...record, at: new Date().toISOString() })
  uni.setStorageSync(HISTORY_KEY, list.slice(0, 60))
}

export function getViews(): ViewRecord[] {
  return (uni.getStorageSync(HISTORY_KEY) as ViewRecord[] | null) || []
}

export function clearViews(): void {
  uni.removeStorageSync(HISTORY_KEY)
}
