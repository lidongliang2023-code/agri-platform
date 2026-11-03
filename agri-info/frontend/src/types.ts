export type PageKey =
  | 'home'
  | 'market'
  | 'market-detail'
  | 'compare'
  | 'indices'
  | 'forecast'
  | 'news'
  | 'news-detail'
  | 'search'
  | 'sd'
  | 'sd-detail'
  | 'sd-publish'
  | 'sd-match'
  | 'ai-qa'
  | 'pest'
  | 'expert'
  | 'training'
  | 'knowledge'
  | 'reports'
  | 'attest'
  | 'alerts'
  | 'favorites'
  | 'expert-cert'

export interface Channel {
  id: number
  code: string
  name: string
  icon: string
  description: string
  articleCount: number
  status: string
}

export interface Author {
  id: number
  name: string
  authorType: string
  avatarText: string
  title: string
  orgName: string
  articleCount: number
  followers: number
  verified: boolean
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
  auditNote?: string
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
  riskJson: string
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

export interface MarketStats {
  total: number
  up: number
  down: number
  flat: number
  abnormal: number
}

export interface MarketData {
  stats: MarketStats
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
  components: Array<{ id: number; name: string; icon: string; origin: string; price: number; priceUnit: string; changePct: number }>
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
  todos: Array<{ title: string; content: string; page: PageKey; tag: string }>
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
  /** 列表接口按当前用户返回的真实学习进度（0-100）。 */
  enrolled?: boolean
  lessonCount?: number
}

/** 课程章节。注意不含播放地址 —— 地址必须逐节换票，见 PlayTicket。 */
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

/** 播放票据：短时签名地址，过期后需重新换取。 */
export interface PlayTicket {
  lessonId: number
  title: string
  mediaType: string
  durationSec: number
  url: string
  expiresIn: number
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
