import axios from 'axios'
import useAuthStore from '@/store/auth'

const aiHub = axios.create({
  baseURL: '/api/ai/admin',
  timeout: 20000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
})

aiHub.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export interface AiHubScene {
  sceneCode: string
  sceneName?: string
  bizSystem?: string
  domain?: string
  enabled?: boolean
  revision?: number
  model?: string
  promptVersion?: string
}

export interface AiHubProvider {
  id: string
  name?: string
  provider?: string
  enabled?: boolean
  active?: boolean
  revision?: number
  model?: string
}

export interface AiHubCall {
  taskId?: string
  sceneCode?: string
  bizSystem?: string
  status?: string
  latencyMs?: number
  traceId?: string
  createdAt?: string
}

export interface AiHubOverview {
  status?: string
  sceneCount?: number
  systemCount?: number
  callCount?: number
  successCount?: number
  averageLatencyMs?: number
  auditWritable?: boolean
  modelConfigured?: boolean
  mode?: string
  provider?: string
  recent?: AiHubCall[]
}

export function getAiHubOverview(): Promise<AiHubOverview> {
  return aiHub.get('/overview').then((res) => res.data.data)
}

export function listAiHubScenes(): Promise<AiHubScene[]> {
  return aiHub.get('/scenes').then((res) => (res.data.data ?? []).map((row: Record<string, unknown>) => ({
    ...row,
    sceneCode: String(row.sceneCode ?? row.code ?? ''),
    sceneName: String(row.sceneName ?? row.name ?? ''),
    model: row.model ?? (row.providerId ? `场景渠道：${row.providerId}` : '跟随中台全局模型'),
    promptVersion: row.promptVersion ?? (row.publishedVersion == null ? undefined : `V${row.publishedVersion}`),
  })))
}

export function listAiHubProviders(): Promise<AiHubProvider[]> {
  return aiHub.get('/providers').then((res) => res.data.data ?? [])
}

export function listAiHubCalls(params: { page?: number; pageSize?: number; keyword?: string; status?: string }) {
  return aiHub.get('/calls', { params }).then((res) => res.data.data)
}
