/**
 * 消息中心 API
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { MessageItem } from '@/types'

const BASE = '/messages'

/** 消息列表查询参数 */
export interface MessageListParams extends PageQuery {
  messageType?: number
  isRead?: boolean
}

/** 分页查询消息列表 */
export function listMessages(params: MessageListParams): Promise<PageResult<MessageItem>> {
  return http.get<PageResult<MessageItem>>(BASE, params)
}

/** 查询未读消息数量 */
export function getUnreadCount(): Promise<number> {
  return http.get<number>(`${BASE}/unread-count`)
}

/** 标记单条消息已读 */
export function readMessage(messageId: string): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/${messageId}/read`)
}

/** 一键全部已读 */
export function readAllMessages(): Promise<boolean> {
  return http.patch<boolean>(`${BASE}/read-all`)
}

/** 删除消息 */
export function deleteMessage(messageId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${messageId}`)
}
