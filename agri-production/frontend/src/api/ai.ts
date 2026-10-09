/**
 * AI 助手 API（病虫害识别 / 问答 / 产量预测）
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { ChatMessage, ChatSession, PestDetection, YieldForecast } from '@/types'

const BASE = '/ai'

/** 分页查询病虫害识别记录 */
export function listPestDetections(
  params: PageQuery & { plotId?: string; status?: number },
): Promise<PageResult<PestDetection>> {
  return http.get<PageResult<PestDetection>>(
    `${BASE}/pest-detection`,
    params,
  )
}

/** 上传图片进行病虫害识别 */
export function detectPest(payload: {
  imageUrl: string
  plotId?: string
  cropId?: string
}): Promise<PestDetection> {
  return http.post<PestDetection>(`${BASE}/pest-detection`, payload)
}

/** 查询识别结果详情 */
export function getPestDetection(detectId: string): Promise<PestDetection> {
  return http.get<PestDetection>(`${BASE}/pest-detection/${detectId}`)
}

/** 查询问答会话列表 */
export function listChatSessions(): Promise<ChatSession[]> {
  return http.get<ChatSession[]>(`${BASE}/assistant/sessions`)
}

/** 查询会话消息列表 */
export function listChatMessages(sessionId: string): Promise<ChatMessage[]> {
  return http.get<ChatMessage[]>(`${BASE}/assistant/sessions/${sessionId}/messages`)
}

/** 发送问答消息（流式接口暂按一次性返回处理） */
export function sendChatMessage(payload: {
  sessionId?: string
  content: string
}): Promise<ChatMessage> {
  return http.post<ChatMessage>(`${BASE}/assistant/messages`, payload)
}

/** 删除问答会话 */
export function deleteChatSession(sessionId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/assistant/sessions/${sessionId}`)
}

/** 分页查询产量预测 */
export function listYieldForecasts(
  params: PageQuery & { plotId?: string; cropId?: string },
): Promise<PageResult<YieldForecast>> {
  return http.get<PageResult<YieldForecast>>(
    `${BASE}/yield-forecast`,
    params,
  )
}

/** 新建问答会话 */
export function createChatSession(title: string): Promise<ChatSession> {
  return http.post<ChatSession>(`${BASE}/assistant/sessions`, { title })
}

/** 重命名问答会话 */
export function renameChatSession(sessionId: string, title: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/assistant/sessions/${sessionId}`, { title })
}

/** 产量预测历史准确率明细 */
export interface ForecastAccuracyPoint {
  /** 统计周期，如 2026-03 */
  period: string
  /** 预测产量（kg） */
  forecastYield: number
  /** 实际产量（kg） */
  actualYield: number
  /** 准确率（%） */
  accuracy: number
}

/**
 * 查询产量预测历史准确率
 *
 * 后端骨架未实现该端点时静默回落到空数组，由页面使用示例口径渲染。
 *
 * @param params 查询参数
 * @returns 历史准确率明细
 */
export async function listForecastAccuracy(params: {
  plotId?: string
  cropId?: string
} = {}): Promise<ForecastAccuracyPoint[]> {
  try {
    const res = await http.get<ForecastAccuracyPoint[]>(
      `${BASE}/yield-forecast/accuracy`,
      params,
      { silent: true },
    )
    return Array.isArray(res) ? res : []
  } catch {
    return []
  }
}

/** 发起产量预测 */
export function createYieldForecast(payload: {
  planId?: string
  plotId?: string
  cropId: string
}): Promise<YieldForecast> {
  return http.post<YieldForecast>(`${BASE}/yield-forecast`, payload)
}
