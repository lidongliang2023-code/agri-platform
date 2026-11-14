import { http } from '@/utils/request'
export interface VoiceDraft {
  plotId?: number; batchId?: number; operationType?: string; operatedAt?: string; operatorId?: number
  areaMu?: number; inputId?: number; quantity?: number; unit?: string; durationHours?: number
  description?: string; evidenceRef?: string; registeredMaxPerMu?: number; safetyIntervalDays?: number
}
export interface VoiceContext {
  farmId: number; asrConfigured: boolean; asrCapability?: { available: boolean; mode: string; description: string }; notice: string
  plots: { id: number; plotName: string; area?: number }[]
  members: { id: number; memberName: string; userId?: string }[]
  inputs: { inputId: number; inputName: string; unit?: string; inputType?: string }[]
  batches: { batchId: number; batchNo: string; plotId: number; harvestDate: string; quantity: number; unit: string }[]
}
export interface VoiceSummary { id: string; revision: number; state: string; transcript: string; draftJson?: string; extractionJson?: string; plotId?: number; plotName?: string; operationDate?: string; operationType?: string; archiveGroup?: string; usageId?: number; createdAt: string; confirmedBy?: string }
export interface VoiceDetail extends VoiceSummary {
  farmId: number; draft: VoiceDraft; risks: { missing?: string[]; warnings?: string[] }
  asr?: { status: string; message?: string; model?: string; provider?: string; confidence?: number }
  extraction?: { status: string; message?: string; suggestion?: { draft?: VoiceDraft; confidence?: number; uncertainFields?: string[]; evidence?: unknown }; traceId?: string }
  audioAvailable: boolean; audioExpiresAt?: string; audioSha?: string; reviewedBy?: string; reviewNote?: string
  events: { type: string; payload: string; operator: string; createdAt: string }[]
  groupRecords?: { id: string; operationType: string; usageId?: number; confirmedBy: string }[]
}
const B = '/voice-records'
export const voiceContext = (farmId: string): Promise<VoiceContext> => http.get(`${B}/context`, { farmId })
export const voiceList = (farmId: string): Promise<VoiceSummary[]> => http.get(B, { farmId })
export const voiceDetail = (id: string): Promise<VoiceDetail> => http.get(`${B}/${id}`)
export const createVoice = (data: FormData): Promise<VoiceDetail> => http.post(B, data, { timeout: 60000 })
export const saveVoice = (id: string, revision: number, transcript: string, draft: VoiceDraft, reason: string): Promise<VoiceDetail> => http.put(`${B}/${id}`, { revision, transcript, draft, reason })
export const voiceAction = (id: string, action: string, body: { revision: number; reason?: string; confirmed?: boolean; abnormalConfirmed?: boolean; existingUsageId?: number }): Promise<VoiceDetail> => http.post(`${B}/${id}/${action}`, body, { timeout: 65000 })
export const voiceAudio = (id: string): Promise<Blob> => http.get(`${B}/${id}/audio`, {}, { responseType: 'blob' })
export const exportVoice = (farmId: string): Promise<Record<string, unknown>[]> => http.get(`${B}/export`, { farmId })
