import axios from 'axios'
import { attachUnifiedAuth } from './sso'

export interface Subject {
  id: number; subjectName: string; creditCode: string; subjectType: string; legalPerson: string;
  contactPhone: string; address: string; region: string; industry: string; scale: string;
  creditScore: number; creditLevel: string; riskLevel: string; supervisionStatus: string;
  certificationStatus: string; annualReportStatus: string; updatedAt: string;
}
export interface Policy {
  id: number; title: string; level: string; category: string; authority: string; policyNo: string;
  summary: string; content: string; publishDate: string; effectiveDate: string; deadline: string;
  status: string; tags: string[];
}
export interface CreditEvent {
  id: number; eventType: string; title: string; scoreChange: number; detail: string;
  source: string; eventDate: string; publicFlag: boolean;
}
export interface Repair {
  id: number; repairNo: string; repairType: string; reason: string; attachmentName: string;
  status: string; progress: number; reviewNote: string; submittedAt: string;
}
export interface Inspection {
  id: number; inspectionNo: string; subjectName: string; inspectionType: string; inspectors: string;
  resultText: string; riskCount: number; status: string; inspectionDate: string; chainHash: string;
}
export interface Rectification {
  id: number; rectificationNo: string; issueText: string; requirement: string; deadline: string;
  status: string; progress: number; feedbackText: string; submittedAt: string;
}
export interface Penalty {
  id: number; penaltyNo: string; subjectName: string; violationText: string; legalBasis: string;
  penaltyText: string; amount: number; documentDate: string; statementStatus: string;
  statementText: string; publicFlag: boolean; status: string;
}
export interface License {
  id: number; licenseName: string; licenseNo: string; authority: string; issueDate: string;
  expireDate: string; status: string; attachmentName: string; subjectName?: string;
}
export interface Report {
  id: number; reportNo: string; reportType: string; title: string; description: string;
  period: string; status: string; aiScore: number; chainHash: string; submittedAt: string;
}
export interface Subsidy {
  id: number; applicationNo: string; policyId: number; projectName: string; amount: number;
  status: string; progress: number; remoteCheckStatus: string; submittedAt: string;
}
export interface IdentityCard {
  operatorName?: string; merchantId?: string; merchantName?: string; merchantError?: string
  subjectId?: number; subjectName?: string; creditCode?: string; creditScore?: number; riskLevel?: string
  subjectError?: string; inspectorId?: number; inspectorName?: string; inspectorTeam?: string
  inspectorGrid?: string; certificateNo?: string; roles?: Record<string, boolean>
}
export interface Complaint {
  id: number; complaintNo: string; complaintType: string; title: string; content: string;
  reporterName: string; reporterPhone: string; anonymous: boolean; targetName: string;
  status: string; priority: string; assignedOrg: string; handleNote: string; createdAt: string;
}
export interface CreditProfile {
  score: number; level: string; riskLevel: string; updatedAt: string;
  dimensions: Array<{ name: string; score: number; detail: string }>;
  events: CreditEvent[]; repairs: Repair[];
}
export interface HomeData {
  subject: Subject;
  stats: { creditScore: number; pendingTasks: number; licenseAlerts: number; unreadMessages: number };
  todos: Array<{ route: string; title: string; content: string; status: string; progress: string }>;
  policies: Policy[];
  publicNotices: Array<{ samplingNo: string; productName: string; subjectName: string; result: string; disposition: string }>;
}
interface Envelope<T> { code: number; message: string; data: T }
const client = axios.create({ baseURL: '/api/v1/government', timeout: 12000 })
attachUnifiedAuth(client, 'gov')

async function req<T>(call: Promise<{ data: Envelope<T> }>): Promise<T> {
  try {
    const response = await call
    if (![0, 200].includes(response.data.code)) throw new Error(response.data.message)
    return response.data.data
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const message = (error.response?.data as { message?: string } | undefined)?.message
      throw new Error(message || '政府监管服务暂时不可用')
    }
    throw error
  }
}

export const govApi = {
  identity: () => req<IdentityCard>(client.get('/identity')),
  home: () => req<HomeData>(client.get('/home')),
  me: () => req<Subject>(client.get('/me')),
  licenses: () => req<License[]>(client.get('/licenses')),
  reports: () => req<Report[]>(client.get('/reports')),
  createReport: (body: Record<string, unknown>) => req<Report>(client.post('/reports', body)),
  selfCheck: () => req<{ score: number; riskCount: number; resultText: string; items: string[]; dimensions: Array<{ name: string; score: number; detail: string }> }>(client.get('/self-check')),
  runSelfCheck: () => req<unknown>(client.post('/self-check', {})),
  credit: () => req<CreditProfile>(client.get('/credit')),
  createRepair: (body: Record<string, unknown>) => req<Repair>(client.post('/credit-repairs', body)),
  inspections: () => req<Inspection[]>(client.get('/inspections')),
  rectifications: () => req<Rectification[]>(client.get('/rectifications')),
  feedbackRectification: (id: number, body: Record<string, unknown>) => req<Rectification>(client.post(`/rectifications/${id}/feedback`, body)),
  penalties: () => req<Penalty[]>(client.get('/penalties')),
  submitStatement: (id: number, body: Record<string, unknown>) => req<Penalty>(client.post(`/penalties/${id}/statement`, body)),
  policies: (keyword?: string) => req<Policy[]>(client.get('/policies', { params: { keyword } })),
  subsidies: () => req<Subsidy[]>(client.get('/subsidies')),
  createSubsidy: (body: Record<string, unknown>) => req<Subsidy>(client.post('/subsidies', body)),
  publicCredit: (keyword: string) => req<{ items: Subject[]; query: string }>(client.get('/public/credit', { params: { keyword } })),
  /**
   * 公众溯源核验：数据来自**生产域**的溯源码与链上存证（不再是本域 gov_trace_event 种子）。
   *
   * <p>{@code events[]} 里的节点可能没有地点（生产域链路节点本来就没有"地点"这一列），
   * 也可能存证还在 PENDING / FAILED —— {@code chainStatus} 与 {@code attested} 要说清状态，
   * {@code chainHash} 在没有交易哈希时给的是"未上链/存证未生成交易哈希"这样的文字，
   * 页面不能把它当成一个真哈希渲染。</p>
   */
  trace: (code: string) => req<{ traceCode: string; productName: string; batchNo: string; subjectName: string; verified: boolean; verifiable?: boolean; status?: string; statusText?: string; chainSummary: string; nodeCount?: number; onChainCount?: number; attestedCount?: number; source?: string; events: Array<{ seq?: number; stage?: string; stageName: string; eventTitle: string; location?: string; eventTime: string; evidence: string; chainHash: string; attested?: boolean; onChain?: boolean; chainStatus?: string; recordNo?: string; chainTime?: string; failedReason?: string; operatorName?: string }> }>(client.get(`/public/trace/${encodeURIComponent(code)}`)),
  samplings: () => req<Array<{ id: number; samplingNo: string; productName: string; subjectName: string; region: string; sampleDate: string; testItems: string; result: string; disposition: string }>>(client.get('/public/samplings')),
  publicLists: () => req<{ red: Subject[]; black: Subject[] }>(client.get('/public/lists')),
  publicity: () => req<{ licenses: License[]; penalties: Penalty[] }>(client.get('/public/publicity')),
  complaints: () => req<Complaint[]>(client.get('/complaints')),
  createComplaint: (body: Record<string, unknown>) => req<Complaint>(client.post('/complaints', body)),
  messages: () => req<Array<{ id: number; type: string; title: string; content: string; read: boolean; createdAt: string; bizType?: string; bizNo?: string }>>(client.get('/messages')),
  readAll: () => req<unknown>(client.post('/messages/read-all')),
  logs: () => req<Array<{ id: number; operator: string; role: string; action: string; target: string; detail: string; ip: string; createdAt: string }>>(client.get('/op-logs')),
}

export const SUBJECT_STATUS: Record<string, { label: string; tone: string }> = {
  normal: { label: '正常', tone: 'green' },
  restricted: { label: '重点监管', tone: 'orange' },
  revoked: { label: '已注销', tone: 'gray' },
  valid: { label: '有效', tone: 'green' },
  expiring: { label: '即将到期', tone: 'orange' },
  expired: { label: '已到期', tone: 'red' },
  verified: { label: '已验证', tone: 'green' },
  needs_fix: { label: '待修正', tone: 'orange' },
  pending: { label: '待处理', tone: 'orange' },
  feedback: { label: '待复核', tone: 'blue' },
  closed: { label: '已办结', tone: 'gray' },
  submitted: { label: '已提交', tone: 'blue' },
  reviewing: { label: '审核中', tone: 'orange' },
  approved: { label: '已通过', tone: 'green' },
  rejected: { label: '已驳回', tone: 'red' },
  county_review: { label: '区县复核', tone: 'orange' },
  paid: { label: '已兑付', tone: 'green' },
  accepted: { label: '已受理', tone: 'blue' },
  processing: { label: '处理中', tone: 'orange' },
  resolved: { label: '已解决', tone: 'green' },
}
