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

/**
 * 查询未读消息数量（GET /messages/unread-count）。
 *
 * ⚠️ 后端签名是 `ApiResponse<Long>`，而全局 JacksonConfig 只给
 * `Long` / `Long.TYPE` 注册了 ToStringSerializer，所以 `data` 落到 JSON 里是
 * **字符串**（实测 `{"code":0,"data":"0"}`），不是数字。
 *
 * 因此这里不能只依赖泛型声明（TS 编译期拦不住运行时），必须在 api 层归一化成真正的 number：
 * 上层（如 BasicLayout 的 `<Badge count>`）才能拿到数字，否则 `"0"` 会被当作非零节点参与判断。
 *
 * @returns 未读数量（number）
 */
export async function getUnreadCount(): Promise<number> {
  const raw = await http.get<unknown>(`${BASE}/unread-count`)
  const parsed = typeof raw === 'number' ? raw : Number(raw ?? 0)
  return Number.isFinite(parsed) ? parsed : 0
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
