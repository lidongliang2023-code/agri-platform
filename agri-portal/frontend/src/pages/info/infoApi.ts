/**
 * 信息资讯 · 官网门户接口层。
 *
 * <p>走的是 `/api/v1/info/public/*`：门户开放浏览、无需登录，所以后端单独开了一条
 * 只读通道（业务接口仍要求 info:consumer）。这里的返回已做过脱敏 ——
 * 供需的联系方式一律是「登录后可见」。</p>
 */

const BASE = '/api/v1/info/public'

interface Envelope<T> {
  code: number
  message: string
  data: T
}

export interface Article {
  id: number
  articleNo?: string
  title: string
  channel: string
  contentType?: string
  summary?: string
  content?: string
  author?: string
  coverIcon?: string
  readCount?: number
  likeCount?: number
  tags?: string[]
  publishedAt?: string
  createdAt?: string
  isTop?: boolean
  attestNo?: string
}

export interface Channel {
  id: number
  code: string
  name: string
  icon?: string
  description?: string
  articleCount?: number
}

export interface Quote {
  id: number
  code?: string
  /** 品种名。后端字段是 name，不是 variety。 */
  name: string
  icon?: string
  category?: string
  market?: string
  origin?: string
  price: number
  priceUnit?: string
  changeAmount?: number
  changePct?: number
  weekPct?: number
  monthPct?: number
  spec?: string
  source?: string
  /** 近 N 期价格序列（数字数组）。 */
  trend?: number[]
  monitorLevel?: string
  status?: string
  updatedAt?: string
}

export interface PriceIndex {
  code?: string
  basePeriod?: string
  sampleCount?: number
  method?: string
  publishedAt?: string
  id: number
  name: string
  category?: string
  value: number
  changePct?: number
  unit?: string
  note?: string
  trend?: number[]
}

export interface SupplyDemand {
  id: number
  sdNo: string
  sdType: 'supply' | 'demand'
  title: string
  category: string
  variety: string
  spec?: string
  quantity: string
  price: number
  priceUnit: string
  origin: string
  marketRef?: string
  orgName: string
  orgType?: string
  verified?: boolean
  badge?: string
  viewCount?: number
  chatCount?: number
  status: string
  contactName?: string
  contactPhone?: string
  contactMasked?: boolean
  createdAt?: string
}

export interface Course {
  id: number
  title: string
  teacher: string
  mode: string
  duration: string
  learners: number
  rating: number
  coverIcon?: string
  summary?: string
  tags?: string[]
  isLive?: boolean
  liveAt?: string
}

export interface Expert {
  id: number
  name: string
  title?: string
  field?: string
  orgName?: string
  avatarText?: string
  rating?: number
  answerCount?: number
  years?: number
  intro?: string
  tags?: string[]
  verified?: boolean
}

export interface Report {
  id: number
  title: string
  category?: string
  summary?: string
  price?: number
  pages?: number
  publishDate?: string
  coverIcon?: string
  downloadCount?: number
  tags?: string[]
}

export interface Knowledge {
  id: number
  title: string
  category?: string
  crop?: string
  summary?: string
  content?: string
  sourceName?: string
  viewCount?: number
  tags?: string[]
  updatedAt?: string
}

export interface SearchResult {
  keyword: string
  articles?: Article[]
  quotes?: Quote[]
  supplyDemands?: SupplyDemand[]
  knowledge?: Knowledge[]
  experts?: Expert[]
  reports?: Report[]
  total?: number
}

async function get<T>(path: string, params?: Record<string, string | number | undefined>): Promise<T> {
  const query = new URLSearchParams()
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && String(value) !== '') {
        query.set(key, String(value))
      }
    }
  }
  const suffix = query.size ? `?${query.toString()}` : ''
  const response = await fetch(`${BASE}${path}${suffix}`, { headers: { Accept: 'application/json' } })
  if (!response.ok) {
    throw new Error(`资讯服务暂时不可用（HTTP ${response.status}）`)
  }
  const body = (await response.json()) as Envelope<T>
  // 认证域用 code=0，交易域用 code=200，这里两种都接受
  if (body.code !== 0 && body.code !== 200) {
    throw new Error(body.message || '资讯服务返回异常')
  }
  return body.data
}

export const infoPublicApi = {
  overview: () => get<Record<string, unknown>>('/overview'),
  channels: () => get<Channel[]>('/channels'),
  /** 门户首页头条：运营编排优先，curated=false 表示回退到了按时间排序。 */
  recommend: () => get<{ curated: boolean; items: Article[] }>('/recommend'),

  articles: (params?: { channel?: string; contentType?: string; keyword?: string; page?: number; size?: number }) =>
    get<{ items: Article[]; total: number; page: number; size: number; channels?: Channel[]; hot?: Article[] }>(
      '/articles', params),
  article: (id: number) => get<Article & { comments?: unknown[] }>(`/articles/${id}`),

  markets: (params?: { category?: string; market?: string; keyword?: string }) =>
    get<{
      stats?: Record<string, number>
      quotes?: Quote[]
      categories?: string[]
      markets?: string[]
      aiRead?: string
    }>('/markets', params),
  market: (id: number) => get<Quote & {
    series?: Array<{ date: string; price: number; volume?: number; forecast?: boolean }>
    regionPrices?: Array<{ id: number; region?: string; market?: string; price: number; priceUnit?: string; changePct?: number; updatedAt?: string }>
    relatedArticles?: Article[]
    aiRead?: string
  }>(`/markets/${id}`),
  indices: () => get<PriceIndex[]>('/indices'),

  supplyDemands: (params?: {
    type?: string; category?: string; origin?: string; sort?: string; keyword?: string; page?: number; size?: number
  }) => get<{
    items: SupplyDemand[]
    stats: { supplyCount: number; demandCount: number; todayCount: number; matchRate: number; avgResponse: number }
    categories: string[]
    origins: string[]
  }>('/supply-demands', params),
  supplyDemand: (id: number, type: string) =>
    get<SupplyDemand & { matches?: unknown[] }>(`/supply-demands/${id}`, { type }),

  courses: () => get<{ items: Course[]; live: Course | null; learners: number }>('/courses'),

  experts: (field?: string) => get<{ items: Expert[]; fields?: string[] }>('/experts', { field }),
  expert: (id: number) => get<Expert>(`/experts/${id}`),

  reports: (category?: string) => get<{ items: Report[]; categories?: string[] }>('/reports', { category }),
  report: (id: number) => get<Report>(`/reports/${id}`),

  knowledge: (params?: { keyword?: string; crop?: string }) => get<Knowledge[]>('/knowledge', params),
  knowledgeDetail: (id: number) => get<Knowledge>(`/knowledge/${id}`),

  search: (keyword: string) => get<SearchResult>('/search', { keyword }),
}

/** 涨跌方向：国内农产品惯例 —— 涨红、跌绿。 */
export function trendClass(value?: number): string {
  if (value === undefined || value === null || value === 0) return 'flat'
  return value > 0 ? 'up' : 'down'
}

export function signed(value?: number, digits = 2): string {
  if (value === undefined || value === null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

export function money(value?: number, digits = 2): string {
  if (value === undefined || value === null) return '—'
  return value.toFixed(digits)
}

export function formatCount(value?: number): string {
  const count = value ?? 0
  if (count >= 10000) return `${(count / 10000).toFixed(1)} 万`
  return String(count)
}

/** 把 "2026-10-25 08:40" 之类的时间裁成 "10-25" 这种列表友好格式。 */
export function dayLabel(value?: string): string {
  if (!value) return ''
  const match = value.match(/(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[2]}-${match[3]}` : value.slice(0, 10)
}
