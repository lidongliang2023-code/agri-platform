import { http } from '@/utils/request'

export interface TechSource { articleId: string; title: string; summary?: string; source?: string; publishAt?: string }
export interface QaResult { recordId: string; question: string; answer: string; intent: string; status: string; confidence: number; sources: TechSource[] }
export interface TrainingQuestion { question_no: number; question_text: string; options: string[]; user_answer?: string; is_correct?: number; answered_at?: string }
export interface TrainingDetail { training_id: string; title: string; topic: string; level: string; question_count: number; answered_count: number; correct_count: number; score?: number; status: string; questions: TrainingQuestion[] }

const B = '/tech-learning'
export const askTech = (question: string, sessionId?: string): Promise<QaResult> => http.post(`${B}/qa`, { question, sessionId })
export const listTechQaHistory = (): Promise<Record<string, unknown>[]> => http.get(`${B}/qa/history`, { limit: 50 })
export const createTraining = (payload: { topic: string; level?: string; questionCount?: number }): Promise<TrainingDetail> => http.post(`${B}/training`, payload)
export const listTrainings = (): Promise<Record<string, unknown>[]> => http.get(B + '/training', { limit: 30 })
export const getTraining = (id: string): Promise<TrainingDetail> => http.get(`${B}/training/${id}`)
export const answerTraining = (id: string, questionNo: number, answer: string): Promise<Record<string, unknown>> => http.post(`${B}/training/${id}/answers`, { questionNo, answer })
export const completeTraining = (id: string): Promise<TrainingDetail> => http.post(`${B}/training/${id}/complete`)
