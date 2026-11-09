export type OpsPageKey =
  | 'green-supply'
  | 'cloud-factories'
  | 'dashboard'
  | 'contents'
  | 'channels'
  | 'courses'
  | 'quotes'
  | 'supply-demands'
  | 'recommend'
  | 'ai'
  | 'reports'
  | 'experts'
  | 'attestations'
  | 'stats'
  | 'audit-logs'

export interface ToneCard {
  label: string
  value: string
  unit: string
  note: string
  tone: string
}

export interface TrendPoint {
  date: string
  produced: number
  pv: number
}

export interface DistributionItem {
  name: string
  percent: number
  count: number
  color: string
}

export interface QuoteQuality {
  quoteCount: number
  targetCount: number
  sourceCount: number
  sourceNormal: number
  points: number
  availableRate: number
  blockedRows: number
  accuracy: number | Array<{ category: string; mape: number }>
}

export interface Article {
  id: number
  articleNo: string
  title: string
  channel: string
  contentType: string
  summary: string
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
  auditNote: string | null
  isTop: boolean
  aiGenerated: boolean
  source: string
  publishedAt: string
  content?: string
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

export interface Dashboard {
  cards: ToneCard[]
  trend: TrendPoint[]
  distribution: DistributionItem[]
  quoteQuality: QuoteQuality
  pending: Article[]
  recentAlerts: AlertMessage[]
}

export interface Contents {
  items: Article[]
  counts: { all: number; published: number; offline: number; rejected: number; pending: number; draft: number }
  channels: string[]
}

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
}

export interface QuoteSource {
  id: number
  name: string
  sourceType: string
  frequency: string
  pointCount: number
  errorRate: number
  lastSync: string
  status: string
}

export interface CollectTask {
  scheduleEnabled?: boolean
  nextRunAt?: string
  retryCount?: number
  scheduleResult?: string
  id: number
  name: string
  sourceName: string
  cron: string
  lastRun: string
  lastRows: number
  durationMs: number
  status: string
  remark: string
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

export interface QualityRule {
  name: string
  level: string
  hit: number
}

export interface Quality {
  availableRate: number
  blockedRows: number
  duplicateRows: number
  missingRows: number
  rules: QualityRule[]
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

export interface QuotesAdmin {
  quotes: Quote[]
  sources: QuoteSource[]
  tasks: CollectTask[]
  indices: PriceIndex[]
  forecasts: Forecast[]
  quality: Quality
  rules: AlertRule[]
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

export interface SupplyDemandsAdmin {
  items: SupplyDemand[]
  counts: { all: number; online: number; offline: number; pending: number }
  matches: SdMatch[]
}

export interface RecommendSlot {
  id: number
  slotName: string
  positionName: string
  strategyName: string
  itemCount: number
  ctr: number
  status: string
  updatedAt: string
}

export interface SensitiveWord {
  id: number
  word: string
  level: string
  action: string
  hitCount: number
  status: string
}

export interface RecommendAdmin {
  slots: RecommendSlot[]
  sensitiveWords: SensitiveWord[]
  pushRecords: AlertMessage[]
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

export interface AiAdmin {
  knowledge: Knowledge[]
  qaPairs: QaRecord[]
  stats: { knowledgeCount: number; sensitiveCount: number; avgConfidence: number; qaCount: number }
}

export interface Report {
  id: number
  reportNo: string
  title: string
  category: string
  period: string
  summary: string
  sections: string
  pageCount: number
  price: number
  downloads: number
  isFree: boolean
  status: string
  publishedAt: string
}

export interface ReportsAdmin {
  items: Report[]
  counts: { all: number; published: number; pending: number }
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
}

export interface AttestationsAdmin {
  items: Attestation[]
  stats: { verified: number; chain: string; total: number; confirmed: number }
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
}

export interface ExpertsAdmin {
  items: Expert[]
  counts: { approved: number; all: number; rejected: number; pending: number }
}

export interface StatsAdmin {
  content: { readTotal: number; published: number; likeTotal: number; commentTotal: number; total: number }
  channelStats: Array<{ channel: string; total: number; readTotal: number }>
  sdStats: { viewTotal: number; demand: number; online: number; supply: number }
  aiStats: Array<{ category: string; total: number; avgConfidence: number }>
  expertStats: { approved: number; pending: number; answers: number }
}

export interface AuditLog {
  id: number
  operator: string
  action: string
  target: string
  detail: string
  ip: string
  createdAt: string
}

/* ================= 培训课程（运营端） ================= */

export interface OpsCourse {
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
  lessonCount: number
  totalDurationSec: number
}

export interface OpsLesson {
  id: number
  courseId: number
  seq: number
  title: string
  durationSec: number
  mediaType: string
  /** 运营端需要看到真实挂载路径，用户端接口不下发这个字段。 */
  videoUrl: string
  coverUrl: string | null
  freePreview: boolean
  status: string
  learnCount: number
}

/* ================= 推荐位内容编排 ================= */

export interface RecommendItem {
  id: number
  contentType: string
  contentId: number
  sortNo: number
  status: string
  title: string | null
  channel: string | null
  coverIcon: string | null
  publishedAt: string | null
}

export interface CollectionFreshness {
  taskId: number
  taskName: string
  sourceName: string
  state: 'paused' | 'no_samples' | 'expired' | 'healthy'
  total: number
  expired: number
  expiredPercent: number | null
  oldestObservedAt: string | null
  latestObservedAt: string | null
  maxAgeMinutes: number
  thresholdPercent: number
  checkedAt: string
}
export interface CollectionAlertPolicy {
  freshnessEnabled: boolean
  maxAgeMinutes: number
  expiredPercent: number
  enabled: boolean
  failureThreshold: number
  rejectPercent: number
  staleMinutes: number
}
export interface CollectionAlert {
  id: number
  taskId: number
  taskName: string
  sourceName: string
  alertType: string
  severity: string
  status: string
  hitCount: number
  firstAt: string
  lastAt: string
  recoveredAt?: string
  detail: string
  ackBy?: string
  ackNote?: string
  ackAt?: string
  recoveryNote?: string
}
