import { http } from '@/utils/request'
import type { PageResult } from '@/types'

export type SafetyState = 'PASSED' | 'NEEDS_REVIEW' | 'BLOCKED' | 'REJECTED'
export interface SafetyCandidate { ruleId?: number; inputId?: number; inputName: string; registrationNo?: string; dosageMin?: number; dosageMax?: number; dosageUnit?: string; applicationMethod?: string; safetyIntervalDays?: number; rotationGroup?: string; source?: string; sourceVersion?: string; status: string; reason: string }
export interface SafetyCheckResult { id: string; requestId: string; state: SafetyState; cropName: string; targetName: string; recommendations: SafetyCandidate[]; blocked: Array<Record<string, unknown>>; compatibility: Array<Record<string, unknown>>; ruleCount: number; notice: string; createdAt?: string }
export interface SafetyCheckRequest { requestId: string; cropName: string; targetName: string; region: string; applicationDate: string; harvestDate?: string; mixInputIds?: string[]; recentInputIds?: string[] }
export function checkInputSafety(payload: SafetyCheckRequest): Promise<SafetyCheckResult> { return http.post<SafetyCheckResult>('/input-safety/check', payload) }
export function listInputSafety(params: { pageNum: number; pageSize: number; state?: string }): Promise<PageResult<Record<string, unknown>>> { return http.get<PageResult<Record<string, unknown>>>('/input-safety', params) }
export function getInputSafety(id: string): Promise<Record<string, unknown>> { return http.get<Record<string, unknown>>(`/input-safety/${encodeURIComponent(id)}`) }
export function compareActualInputSafety(id: string, payload: { usageId: string }): Promise<{ matched: boolean; message: string }> { return http.post<{ matched: boolean; message: string }>(`/input-safety/${encodeURIComponent(id)}/compare-actual`, payload) }
export type SafetyRuleKind = 'registration' | 'restrictions' | 'compatibility'
export const listSafetyRules = (kind: SafetyRuleKind): Promise<Array<Record<string, unknown>>> => http.get(`/input-safety/rules/${kind}`)
export const saveSafetyRule = (kind: SafetyRuleKind, payload: Record<string, unknown>): Promise<{id: string}> => http.post(`/input-safety/rules/${kind}`, payload)
export const listSafetyRisks = (): Promise<Array<Record<string, unknown>>> => http.get('/input-safety/risks')
export const reviewSafetyRisk = (id: string, note: string): Promise<{state: string}> => http.post(`/input-safety/risks/${id}/review`, { note })

export interface RegistrationSyncBatch { id: string; source_name: string; source_url: string; source_checksum: string; status: 'RUNNING' | 'SUCCEEDED' | 'FAILED'; total_rows: number; parsed_rows: number; imported_rows: number; skipped_rows: number; error_message?: string; started_at: string; finished_at?: string; created_by: string }
export interface RegistrationSyncConfig { defaultUrl: string; sourceName: string; autoEnable: boolean; note: string }
export const getRegistrationSyncConfig = (): Promise<RegistrationSyncConfig> => http.get('/input-safety/registration-sync/config')
export const listRegistrationSyncBatches = (): Promise<RegistrationSyncBatch[]> => http.get('/input-safety/registration-sync/batches')
export const syncRegistrationData = (sourceUrl?: string): Promise<RegistrationSyncBatch> => http.post('/input-safety/registration-sync', sourceUrl ? { sourceUrl } : {})
