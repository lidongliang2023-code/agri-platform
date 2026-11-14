import type { ImageSearchSnapshot, KnowledgeSnapshot } from './pest-atlas'
import { http } from '@/utils/request'
import type { PageResult } from '@/types'

export type PestCaseStatus = 'RUNNING' | 'NEEDS_RETAKE' | 'FAILED' | 'DIAGNOSED' | 'REVIEWED' | 'FOLLOW_UP' | 'CLOSED'
export interface PestDiagnosisInput {
  requestId: string
  plotId: string
  cropName: string
  symptoms: string
  growthStage?: string
  environment?: string
  recentTreatment?: string
  voiceTranscript?: string
  localBulletin?: string
  bulletinSource?: string
  images: string[]
}
export interface PestCaseSummary {
  id: string
  plotName: string
  cropName: string
  status: PestCaseStatus
  taskId?: string
  failureMessage?: string
  createdAt: string
  updatedAt: string
}
export interface PestCase extends PestCaseSummary {
  farmId: string
  plotId: string
  createdBy: string
  input: PestDiagnosisInput
  followUpDueAt?: string
  sampleDueAt?: string
  reportDueAt?: string
  expertRequired?: boolean
  followUpOverdue?: boolean
  modelRecallRequired?: boolean
  knowledgeAttempts?: Array<{ attemptId: string; snapshot: KnowledgeSnapshot; createdAt: string }>
  imageAttempts?: Array<{ attemptId: string; snapshot: ImageSearchSnapshot; createdAt: string }>
  events?: Array<{ type: string; payload: { kind?: string; state?: string; target?: string; receipt?: string; note?: string }; createdAt: string }>
  result?: {
    tier: string
    imageQuality: string
    qualityGuidance?: string
    quarantineSuspected: boolean
    inKnowledgeScope: boolean
    referenceIds?: string[]
    knowledgeSnapshot?: KnowledgeSnapshot
    imageSnapshot?: ImageSearchSnapshot
    knowledgeReferences?: string
    medicationPolicy?: string
    summary: string
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNCERTAIN'
    candidates: Array<{ name: string; confidence: number; evidence: string }>
    suggestions: string
    missingEvidence?: string
    traceId?: string
    usage?: { model?: string; prompt_version?: string; execution_mode?: string }
  }
  review?: { conclusion: string; advice: string; reviewer: string; reviewedAt: string; modelCorrect: boolean }
  feedback?: Array<{ outcome: string; note: string; closed: boolean; operator: string; createdAt: string }>
}
const BASE = '/ai/pest-detection'
export const listPestCases = (params: { farmId?: string; plotId?: string; status?: string; pageNum: number; pageSize: number }): Promise<PageResult<PestCaseSummary>> => http.get(BASE, params)
export const getPestCase = (id: string): Promise<PestCase> => http.get(`${BASE}/${encodeURIComponent(id)}`)
export const submitPestCase = (input: PestDiagnosisInput): Promise<PestCase> => http.post(BASE, input, { timeout: 65000 })
export const retryPestCase = (id: string): Promise<PestCase> => http.post(`${BASE}/${id}/retry`, undefined, { timeout: 65000 })
export const reviewPestCase = (id: string, input: { conclusion: string; advice: string; modelCorrect: boolean }): Promise<PestCase> => http.post(`${BASE}/${id}/review`, input)
export const createPestTask = (id: string, input: { taskName: string; taskType: string; assigneeId?: string; planStartDate: string; planEndDate: string; priority: string }): Promise<PestCase> => http.post(`${BASE}/${id}/task`, input)
export const followUpPestCase = (id: string, input: { outcome: string; note: string; close: boolean }): Promise<PestCase> => http.post(`${BASE}/${id}/follow-up`, input)

export const savePestHandoff = (id: string, input: { kind: string; state: string; target: string; receipt?: string; note: string }): Promise<PestCase> => http.post(`${BASE}/${id}/handoff`, input)
