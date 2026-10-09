/**
 * 页面名称：AI农艺师对话
 * 路由路径：/production/ai/assistant
 * 所属模块：智能决策中心
 * 原型来源：用户端原型 P31 ai-assistant
 * PRD 序号：PRD 6.1 #41
 *
 * 原型 P31 逐字段还原：
 * - 页面标题「🤖 AI农艺师对话」
 * - 左侧「历史对话」列表（4 条示例会话，选中态蓝底）+ 新建会话 / 重命名 / 删除
 * - 会话头「🤖 AI农艺师 - {会话标题}」
 * - 消息气泡：用户头像取姓名首字（原型为「栋」），AI 头像 🤖，AI 消息支持 Markdown 渲染
 * - AI 回复给出农事建议时，气泡下方提供「确认并创建任务 →」，跳转
 *   `/production/tasks/create` 并携带任务名 / 地块 / 执行人 / 计划时间 / 用药 / 优先级
 * - 底部输入区：TextArea placeholder「请输入您的问题...」+「发送」按钮
 *   Enter 发送、Shift+Enter 换行；发送期间展示「思考中」与流式打字效果
 *
 * 数据来源：`/ai/assistant/sessions`（会话列表 / 新建 / 重命名 / 删除）、
 * `/ai/assistant/sessions/{id}/messages`、`/ai/assistant/messages`。
 *
 * ⚠️ 数据来源纪律（不可回退）：
 * 1. 会话列表只取服务端返回值；服务端无会话时显示空态 + 醒目提示，
 *    **不再回落 4 组原型示例会话（DEMO-SESSION-1..4）**。
 * 2. 消息列表只取服务端返回值；**不再回落示例消息（DEMO-MESSAGES）**。
 * 3. 问答回复只取服务端返回值；接口失败 / 未返回 content 时明确报错，
 *    **不再用本地农艺知识库回答**（本地回答包含用药建议，会被误认为模型结论）。
 * 4. 新建 / 删除 / 重命名会话失败时明确报错，**不再把失败弹成成功**。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App as AntdApp,
  Avatar,
  Button,
  Card,
  Empty,
  Input,
  List,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tooltip,
  Typography,
} from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  ThunderboltOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import useAuthStore from '@/store/auth'
import useFarmStore from '@/store/farm'
import {
  createChatSession,
  deleteChatSession,
  listChatMessages,
  listChatSessions,
  renameChatSession,
  sendChatMessage,
} from '@/api/ai'
import type { ChatMessage, ChatSession } from '@/types'

const { Text, Title, Paragraph } = Typography

/** 流式打字速度：每次追加字符数 */
const STREAM_STEP = 18

/** 流式打字间隔（毫秒） */
const STREAM_INTERVAL = 40

/** 从 AI 回复中解析出的农事任务建议 */
interface TaskSuggestion {
  /** 任务名称 */
  taskName: string
  /** 执行地块 */
  plotName: string
  /** 执行人 */
  assigneeName: string
  /** 计划时间 */
  planTime: string
  /** 用药 / 物料 */
  drug: string
  /** 优先级 */
  priority: string
}

/** 本地消息（新增消息在接口返回前使用本地 ID） */
type LocalMessage = ChatMessage & { pending?: boolean }

/* ==================== 会话数据 ==================== */

/**
 * 会话与消息**只取服务端返回值**
 *
 * ⚠️ 此前页面在 `GET /ai/assistant/sessions` 无数据时回落 4 组原型示例会话与示例消息，
 * 并在问答接口不可用时用本地农艺知识库直接生成「防治方案 + 用药建议」——
 * 这些回复并非模型输出，却以与真实回复完全相同的样式展示在对话区，
 * 会让用户误以为是用药结论。现已全部移除：
 * - 服务端无会话 → 列表空态 + 醒目提示；
 * - 问答接口失败 / 未返回内容 → 明确报错，不生成任何回复。
 */

/* ==================== Markdown 轻量渲染 ==================== */

/** 行内标记正则：`**加粗**` 与 `` `代码` `` */
const INLINE_PATTERN = /(\*\*[^*]+\*\*|`[^`]+`)/g

/**
 * 渲染行内标记
 *
 * @param text 文本片段
 * @param keyPrefix React key 前缀
 * @returns 渲染结果
 */
function renderInline(text: string, keyPrefix: string): ReactNode {
  const nodes: ReactNode[] = []
  let lastIndex = 0
  let cursor = 0
  let match: RegExpExecArray | null = INLINE_PATTERN.exec(text)
  while (match !== null) {
    if (match.index > lastIndex) {
      nodes.push(<span key={`${keyPrefix}-t-${cursor}`}>{text.slice(lastIndex, match.index)}</span>)
    }
    const token = match[0]
    if (token.startsWith('**')) {
      nodes.push(<strong key={`${keyPrefix}-b-${cursor}`}>{token.slice(2, -2)}</strong>)
    } else {
      nodes.push(
        <code key={`${keyPrefix}-c-${cursor}`} style={{ padding: '0 4px' }}>
          {token.slice(1, -1)}
        </code>,
      )
    }
    cursor += 1
    lastIndex = match.index + token.length
    match = INLINE_PATTERN.exec(text)
  }
  if (lastIndex < text.length) {
    nodes.push(<span key={`${keyPrefix}-t-${cursor}`}>{text.slice(lastIndex)}</span>)
  }
  return nodes
}

/**
 * 轻量 Markdown 渲染（标题 / 无序列表 / 有序列表 / 段落）
 *
 * @param content Markdown 文本
 * @returns 渲染结果
 */
function renderMarkdown(content: string): ReactNode {
  const lines = content.split('\n')
  const blocks: ReactNode[] = []
  let listItems: string[] = []
  let listType: 'ul' | 'ol' = 'ul'

  /** 输出已缓存的列表块 */
  const flushList = (): void => {
    if (listItems.length === 0) return
    const items = listItems.map((item, index) => (
      <li key={`li-${blocks.length}-${index}`}>{renderInline(item, `li-${blocks.length}-${index}`)}</li>
    ))
    blocks.push(
      listType === 'ul' ? (
        <ul key={`ul-${blocks.length}`} style={{ marginBottom: 8, paddingLeft: 20 }}>
          {items}
        </ul>
      ) : (
        <ol key={`ol-${blocks.length}`} style={{ marginBottom: 8, paddingLeft: 20 }}>
          {items}
        </ol>
      ),
    )
    listItems = []
  }

  lines.forEach((rawLine, index) => {
    const line = rawLine.trimEnd()
    if (line.trim() === '') {
      flushList()
      return
    }
    const heading = /^(#{1,4})\s+(.*)$/.exec(line)
    if (heading) {
      flushList()
      const level = Math.min(5, heading[1].length + 2)
      blocks.push(
        <Title key={`h-${index}`} level={level as 1 | 2 | 3 | 4 | 5} style={{ marginBottom: 8 }}>
          {renderInline(heading[2], `h-${index}`)}
        </Title>,
      )
      return
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line)
    if (bullet) {
      if (listType !== 'ul') {
        flushList()
        listType = 'ul'
      }
      listItems.push(bullet[1])
      return
    }
    const ordered = /^\d+[.、]\s*(.*)$/.exec(line)
    if (ordered) {
      if (listType !== 'ol') {
        flushList()
        listType = 'ol'
      }
      listItems.push(ordered[1])
      return
    }
    flushList()
    blocks.push(
      <Paragraph key={`p-${index}`} style={{ marginBottom: 6 }}>
        {renderInline(line, `p-${index}`)}
      </Paragraph>,
    )
  })
  flushList()
  return <div>{blocks}</div>
}

/* ==================== 农事任务建议解析 ==================== */

/** 建议字段标签 → 取值键 */
const SUGGESTION_LABELS: { label: string; key: keyof TaskSuggestion }[] = [
  { label: '任务', key: 'taskName' },
  { label: '执行地块', key: 'plotName' },
  { label: '地块', key: 'plotName' },
  { label: '执行人', key: 'assigneeName' },
  { label: '计划时间', key: 'planTime' },
  { label: '用药', key: 'drug' },
  { label: '优先级', key: 'priority' },
]

/**
 * 从 AI 回复中解析农事任务建议
 *
 * 支持原型 P31 的 `任务: xxx / 执行地块: xxx` 多段格式，
 * 以及对纯建议文本（含「喷施」「防治」）的兜底推导。
 *
 * @param content AI 回复内容
 * @returns 任务建议，无建议时返回 null
 */
function resolveTaskSuggestion(content: string): TaskSuggestion | null {
  const suggestion: TaskSuggestion = {
    taskName: '',
    plotName: '',
    assigneeName: '',
    planTime: '',
    drug: '',
    priority: '',
  }
  const segments = content.split(/[\n；;]+|\s\/\s/).map((item) => item.trim())
  segments.forEach((segment) => {
    SUGGESTION_LABELS.forEach(({ label, key }) => {
      const pattern = new RegExp(`^${label}\\s*[:：]\\s*(.+)$`)
      const match = pattern.exec(segment)
      if (match && !suggestion[key]) {
        suggestion[key] = match[1].trim()
      }
    })
  })

  const hasExplicit = Boolean(suggestion.taskName)
  const looksLikeAdvice = /喷施|防治任务|防治|用药|任务单/.test(content)
  if (!hasExplicit && !looksLikeAdvice) return null

  if (!suggestion.taskName) {
    const heading = /^###\s*(.+)$/m.exec(content)
    const firstLine = content.split('\n').find((item) => item.trim().length > 0) ?? ''
    suggestion.taskName = heading
      ? `${heading[1].trim()}任务`
      : `${firstLine.slice(0, 16).trim()}…`
  }
  if (!suggestion.plotName) {
    const plotMatch = /([\d]+号田|[\d]+号棚|[^\s，,。]{2,8}区)/.exec(content)
    suggestion.plotName = plotMatch ? plotMatch[1] : ''
  }
  if (!suggestion.drug) {
    const drugMatch = /喷施\*\*?([^*（(，,。\n]+)/.exec(content)
    suggestion.drug = drugMatch ? drugMatch[1].trim() : ''
  }
  if (!suggestion.priority) {
    suggestion.priority = /紧急/.test(content) ? '紧急' : '普通'
  }
  // ⚠️ 计划时间不做本地推测：AI 未明确给出时留空，由用户在创建任务页自行填写，
  // 避免用「明天 08:00-11:00」这类编造值预填表单。
  return suggestion
}

/**
 * AI农艺师对话
 *
 * 业务职责：多轮农艺问答、会话管理与「AI 建议 → 农事任务」转化。
 *
 * @returns 页面内容
 */
export default function AiAssistant(): JSX.Element {
  const navigate = useNavigate()
  const { message } = AntdApp.useApp()
  const queryClient = useQueryClient()
  const userInfo = useAuthStore((state) => state.userInfo)
  const farmId = useFarmStore((state) => state.currentFarm?.farmId)

  /** 会话列表（**只取服务端返回值**，无数据时为空态，不再回落示例会话） */
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string>('')

  /** 各会话消息（本地合并接口数据） */
  const [messageMap, setMessageMap] = useState<Record<string, LocalMessage[]>>({})

  /** 输入框内容 */
  const [inputValue, setInputValue] = useState<string>('')
  /** 是否正在等待 / 流式输出 */
  const [pending, setPending] = useState<boolean>(false)
  /** 流式输出的临时文本 */
  const [streamText, setStreamText] = useState<string>('')
  /** 问答失败原因（接口失败 / 服务端未返回回复内容） */
  const [chatError, setChatError] = useState<string>('')

  /** 重命名弹窗 */
  const [renameOpen, setRenameOpen] = useState<boolean>(false)
  const [renameTarget, setRenameTarget] = useState<ChatSession | null>(null)
  const [renameValue, setRenameValue] = useState<string>('')

  /** 消息区滚动容器 */
  const scrollRef = useRef<HTMLDivElement | null>(null)
  /** 流式定时器 */
  const timerRef = useRef<number | null>(null)

  /** 用户名首字（原型为「栋」） */
  const userInitial: string = (userInfo?.realName || userInfo?.username || '用户').slice(0, 1)

  /** 远程会话列表 */
  const sessionsQuery = useQuery({
    queryKey: ['ai-chat-sessions', farmId],
    queryFn: () => listChatSessions(),
  })

  /** 远程消息列表 */
  const messagesQuery = useQuery({
    queryKey: ['ai-chat-messages', activeSessionId],
    enabled: Boolean(activeSessionId),
    queryFn: () => listChatMessages(activeSessionId),
  })

  /** 远程会话就绪后覆盖本地状态（含空数组：服务端无会话即空态） */
  useEffect(() => {
    const remote = sessionsQuery.data
    if (Array.isArray(remote)) {
      setSessions(remote)
      setActiveSessionId((prev) =>
        remote.some((item) => item.sessionId === prev) ? prev : (remote[0]?.sessionId ?? ''),
      )
    }
  }, [sessionsQuery.data])

  /** 远程消息就绪后覆盖本地状态（服务端无消息时保持空态，不再回落示例消息） */
  useEffect(() => {
    const remote = messagesQuery.data
    if (Array.isArray(remote) && remote.length > 0) {
      setMessageMap((prev) => ({ ...prev, [activeSessionId]: remote }))
    }
  }, [messagesQuery.data, activeSessionId])

  /** 当前会话 */
  const activeSession: ChatSession | undefined = useMemo(
    () => sessions.find((item) => item.sessionId === activeSessionId),
    [sessions, activeSessionId],
  )

  /** 当前会话消息 */
  const messages: LocalMessage[] = messageMap[activeSessionId] ?? []

  /** 滚动到底部 */
  const scrollToBottom = useCallback((): void => {
    window.setTimeout(() => {
      const node = scrollRef.current
      if (node) {
        node.scrollTop = node.scrollHeight
      }
    }, 0)
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, streamText, pending, scrollToBottom])

  /** 卸载时清理流式定时器 */
  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current)
      }
    },
    [],
  )

  /**
   * 以打字机效果流式输出 AI 回复
   *
   * @param full 完整回复内容
   * @param sessionId 所属会话
   * @returns Promise，输出完成后 resolve
   */
  const streamReply = useCallback(
    (full: string, sessionId: string): Promise<void> =>
      new Promise<void>((resolve) => {
        let cursor = 0
        setStreamText('')
        timerRef.current = window.setInterval(() => {
          cursor = Math.min(full.length, cursor + STREAM_STEP)
          setStreamText(full.slice(0, cursor))
          if (cursor >= full.length) {
            if (timerRef.current !== null) {
              window.clearInterval(timerRef.current)
              timerRef.current = null
            }
            setStreamText('')
            setMessageMap((prev) => ({
              ...prev,
              [sessionId]: [
                ...(prev[sessionId] ?? []),
                {
                  messageId: `LOCAL-AI-${Date.now()}`,
                  sessionId,
                  role: 'assistant',
                  content: full,
                  createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
                },
              ],
            }))
            resolve()
          }
        }, STREAM_INTERVAL)
      }),
    [],
  )

  /**
   * 发送消息
   *
   * 流程：本地追加用户消息 → 展示思考中 → 请求接口 → 流式输出 AI 回复 → 更新会话摘要。
   *
   * ⚠️ 问答回复**只取服务端返回值**：接口失败或服务端未返回 content 时明确报错，
   * 不再用本地农艺知识库生成「防治方案 + 用药建议」（此类本地回复会被误认为模型结论）。
   *
   * @returns Promise
   */
  const handleSend = async (): Promise<void> => {
    const content = inputValue.trim()
    if (!content || pending) return
    if (!activeSessionId) {
      message.warning('请先新建或选择一个会话')
      return
    }
    const sessionId = activeSessionId
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    setInputValue('')
    setChatError('')
    setMessageMap((prev) => ({
      ...prev,
      [sessionId]: [
        ...(prev[sessionId] ?? []),
        {
          messageId: `LOCAL-USER-${Date.now()}`,
          sessionId,
          role: 'user',
          content,
          createdAt: now,
        },
      ],
    }))
    setPending(true)

    try {
      const res = await sendChatMessage({ sessionId, content })
      const reply = res?.content
      if (!reply) {
        // 服务端未返回回复内容：不做任何本地兜底生成
        setChatError(
          '问答接口已响应，但未返回回复内容（服务端 AI 问答能力未接入）。未生成任何回复，请稍后重试或联系农技员。',
        )
        message.warning('服务端未返回回复内容')
        setPending(false)
        return
      }
      await streamReply(reply, sessionId)
      setPending(false)
      setSessions((prev) =>
        prev.map((item) =>
          item.sessionId === sessionId
            ? {
                ...item,
                lastMessage: reply.slice(0, 30),
                updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
              }
            : item,
        ),
      )
    } catch (error) {
      setChatError(
        `问答失败：${(error as Error)?.message || '接口不可用'}。未生成任何回复` +
          '（为避免给出非模型的用药建议，不再使用本地知识库兜底）。',
      )
      message.error('问答失败，请稍后重试')
      setPending(false)
    }
  }

  /** 输入框键盘事件：Enter 发送 / Shift+Enter 换行 */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  /**
   * 新建会话
   *
   * ⚠️ 失败时**不创建本地 ID 占位会话**：此前会在接口不可用情况下生成一个
   * `LOCAL-SESSION-*` 会话并弹「已新建会话」，但该会话在服务端并不存在，
   * 刷新后即消失，属于把失败弹成成功。现改为原样抛出，由 onError 明确报错。
   */
  const createMutation = useMutation({
    mutationFn: async (): Promise<ChatSession> => {
      const created = await createChatSession('新对话')
      if (!created?.sessionId) {
        throw new Error('服务端未返回会话 ID')
      }
      return created
    },
    onSuccess: (created) => {
      setSessions((prev) => [created, ...prev])
      setMessageMap((prev) => ({ ...prev, [created.sessionId]: [] }))
      setActiveSessionId(created.sessionId)
      void queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] })
      message.success('已新建会话')
    },
    onError: (error: Error) => {
      message.error(`新建会话失败：${error?.message || '接口不可用'}`)
    },
  })

  /**
   * 删除会话
   *
   * 删除以服务端结果为准，失败即报错，不在本地「假装删除」。
   */
  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string): Promise<string> => {
      await deleteChatSession(sessionId)
      return sessionId
    },
    onSuccess: (sessionId) => {
      setSessions((prev) => {
        const next = prev.filter((item) => item.sessionId !== sessionId)
        setActiveSessionId((current) =>
          current === sessionId ? (next[0]?.sessionId ?? '') : current,
        )
        return next
      })
      message.success('会话已删除')
    },
    onError: (error: Error) => {
      message.error(`删除会话失败：${error?.message || '接口不可用'}`)
      void queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] })
    },
  })

  /** 提交重命名（失败不提示成功） */
  const submitRename = async (): Promise<void> => {
    if (!renameTarget || !renameValue.trim()) {
      message.warning('请输入会话标题')
      return
    }
    const title = renameValue.trim()
    try {
      await renameChatSession(renameTarget.sessionId, title)
    } catch (error) {
      message.error(`重命名失败：${(error as Error)?.message || '接口不可用'}`)
      return
    }
    setSessions((prev) =>
      prev.map((item) => (item.sessionId === renameTarget.sessionId ? { ...item, title } : item)),
    )
    setRenameOpen(false)
    message.success('会话标题已更新')
  }

  /**
   * 将 AI 建议创建为农事任务
   *
   * 跳转 `/production/tasks/create`，同时通过 query 与 router state 传递建议参数，
   * 兼容创建页两种取值方式。
   *
   * @param suggestion 任务建议
   * @returns void
   */
  const gotoTaskCreate = (suggestion: TaskSuggestion): void => {
    const query = new URLSearchParams({
      taskName: suggestion.taskName,
      plotName: suggestion.plotName,
      assigneeName: suggestion.assigneeName,
      planTime: suggestion.planTime,
      material: suggestion.drug,
      priority: suggestion.priority,
      source: 'ai-assistant',
    }).toString()
    navigate(`/production/tasks/create?${query}`, { state: { suggestion } })
  }

  /** 会话列表已加载完成且为空（服务端无会话，不用示例会话占位） */
  const sessionsEmpty: boolean = !sessionsQuery.isLoading && sessions.length === 0

  return (
    <div style={{ padding: 24 }}>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        {sessionsQuery.isError && (
          <Alert
            type="error"
            showIcon
            message="会话列表加载失败"
            description="服务端 GET /ai/assistant/sessions 接口不可用。此处不使用任何示例会话占位，请稍后重试。"
          />
        )}
        {!sessionsQuery.isError && sessionsEmpty && (
          <Alert
            type="info"
            showIcon
            message="暂无会话"
            description="服务端未返回任何问答会话。点击左上角「＋」新建一个会话后再开始提问；页面不会展示示例会话，以免被误认为真实历史对话。"
          />
        )}
      </Space>
      <Card
        styles={{ body: { padding: 0, height: 'calc(100vh - 216px)' } }}
        style={{ overflow: 'hidden', marginTop: 12 }}
      >
        <div style={{ display: 'flex', height: '100%' }}>
          {/* 左侧：历史对话 */}
          <div
            style={{
              width: 280,
              borderRight: '1px solid #f0f0f0',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text strong>历史对话</Text>
              <Tooltip title="新建会话">
                <Button
                  type="text"
                  size="small"
                  icon={<PlusOutlined />}
                  loading={createMutation.isPending}
                  onClick={() => createMutation.mutate()}
                />
              </Tooltip>
            </div>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <Spin spinning={sessionsQuery.isLoading}>
                <List
                  dataSource={sessions}
                  locale={{
                    emptyText: (
                      <Empty
                        description={
                          sessionsQuery.isLoading ? '加载中…' : '暂无会话（服务端无数据）'
                        }
                      />
                    ),
                  }}
                  renderItem={(item) => {
                    const active = item.sessionId === activeSessionId
                    return (
                      <List.Item
                        onClick={() => setActiveSessionId(item.sessionId)}
                        style={{
                          cursor: 'pointer',
                          padding: '10px 16px',
                          background: active ? '#e6f4ff' : undefined,
                          borderLeft: active ? '3px solid #1677ff' : '3px solid transparent',
                        }}
                        actions={[]}
                      >
                        <Space direction="vertical" size={2} style={{ width: '100%' }}>
                          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                            <Text strong ellipsis style={{ maxWidth: 170 }}>
                              {/*
                                后端 /ai/assistant/sessions 实际返回的是「诊断记录摘要」
                                （sessionId / plotId / diagnosisType / resultLabel / confidence / diagnosedAt），
                                **没有 title 字段**。此处用服务端已有的 sessionId 兜底显示，不本地编造会话标题。
                              */}
                              {item.title || item.sessionId}
                            </Text>
                            <Space size={0}>
                              <Button
                                type="text"
                                size="small"
                                icon={<EditOutlined />}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setRenameTarget(item)
                                  setRenameValue(item.title)
                                  setRenameOpen(true)
                                }}
                              />
                              <Popconfirm
                                title="确认删除该会话？"
                                onConfirm={(event) => {
                                  event?.stopPropagation()
                                  deleteMutation.mutate(item.sessionId)
                                }}
                              >
                                <Button
                                  type="text"
                                  size="small"
                                  danger
                                  icon={<DeleteOutlined />}
                                  onClick={(event) => event.stopPropagation()}
                                />
                              </Popconfirm>
                            </Space>
                          </Space>
                          <Space direction="vertical" size={0} style={{ width: '100%' }}>
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              {item.updatedAt || item.createdAt}
                            </Text>
                            {item.lastMessage && (
                              <Text
                                type="secondary"
                                ellipsis
                                style={{ fontSize: 12, maxWidth: 230 }}
                              >
                                {item.lastMessage}
                              </Text>
                            )}
                          </Space>
                        </Space>
                      </List.Item>
                    )
                  }}
                />
              </Spin>
            </div>
          </div>

          {/* 右侧：对话区 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <div
              style={{
                padding: '12px 20px',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Space size={8}>
                <RobotOutlined style={{ fontSize: 18, color: '#1677ff' }} />
                <Text strong style={{ fontSize: 16 }}>
                  🤖 AI农艺师 - {activeSession?.title ?? '未选择会话'}
                </Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {messages.length} 条消息
              </Text>
            </div>

            {/* 消息区 */}
            <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
              {chatError && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="未获取到 AI 回复"
                  description={chatError}
                />
              )}
              {messagesQuery.isError && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="历史消息加载失败"
                  description="服务端 GET /ai/assistant/sessions/{id}/messages 接口不可用。此处不使用示例消息占位。"
                />
              )}
              {messages.length === 0 && !activeSessionId && (
                <Empty description="请先新建或选择一个会话" style={{ marginTop: 80 }} />
              )}
              {messages.length === 0 && activeSessionId && (
                <Empty
                  description="暂无消息，开始提问吧（回复将来自服务端 AI 问答接口）"
                  style={{ marginTop: 80 }}
                />
              )}
              <Space direction="vertical" size={16} style={{ width: '100%' }}>
                {messages.map((item) => {
                  const isUser = item.role === 'user'
                  const suggestion = isUser ? null : resolveTaskSuggestion(item.content)
                  return (
                    <div
                      key={item.messageId}
                      style={{
                        display: 'flex',
                        flexDirection: isUser ? 'row-reverse' : 'row',
                        alignItems: 'flex-start',
                        gap: 10,
                      }}
                    >
                      {isUser ? (
                        <Avatar size={34} style={{ backgroundColor: '#1677ff' }}>
                          {userInitial}
                        </Avatar>
                      ) : (
                        <Avatar size={34} style={{ backgroundColor: '#f6ffed', fontSize: 18 }}>
                          🤖
                        </Avatar>
                      )}
                      <div style={{ maxWidth: '72%' }}>
                        <div
                          style={{
                            padding: '10px 14px',
                            borderRadius: 10,
                            background: isUser ? '#1677ff' : '#f5f5f5',
                            color: isUser ? '#fff' : 'rgba(0,0,0,0.88)',
                            wordBreak: 'break-word',
                          }}
                        >
                          {isUser ? (
                            <span style={{ whiteSpace: 'pre-wrap' }}>{item.content}</span>
                          ) : (
                            <div>{renderMarkdown(item.content)}</div>
                          )}
                        </div>
                        <div
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                            color: '#8c8c8c',
                            textAlign: isUser ? 'right' : 'left',
                          }}
                        >
                          {item.createdAt}
                        </div>
                        {suggestion && (
                          <Button
                            type="link"
                            icon={<ThunderboltOutlined />}
                            style={{ paddingLeft: 0, marginTop: 4 }}
                            onClick={() => gotoTaskCreate(suggestion)}
                          >
                            确认并创建任务 →
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* 思考中 / 流式输出 */}
                {(pending || streamText) && (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <Avatar size={34} style={{ backgroundColor: '#f6ffed', fontSize: 18 }}>
                      🤖
                    </Avatar>
                    <div style={{ maxWidth: '72%' }}>
                      <div
                        style={{
                          padding: '10px 14px',
                          borderRadius: 10,
                          background: '#f5f5f5',
                          minHeight: 40,
                        }}
                      >
                        {streamText ? (
                          <div>{renderMarkdown(streamText)}</div>
                        ) : (
                          <Space>
                            <Spin size="small" />
                            <Text type="secondary">AI 正在分析您的提问…</Text>
                          </Space>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </Space>
            </div>

            {/* 输入区 */}
            <div style={{ borderTop: '1px solid #f0f0f0', padding: '12px 24px 16px' }}>
              <Space direction="vertical" size={6} style={{ width: '100%' }}>
                <Input.TextArea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    activeSessionId ? '请输入您的问题...' : '请先新建或选择一个会话后再提问'
                  }
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  disabled={pending || !activeSessionId}
                />
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Enter 发送，Shift + Enter 换行
                  </Text>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={pending}
                    disabled={!inputValue.trim() || !activeSessionId}
                    onClick={() => void handleSend()}
                  >
                    发送
                  </Button>
                </Space>
              </Space>
            </div>
          </div>
        </div>
      </Card>

      {/* 重命名会话 */}
      <Modal
        title="重命名会话"
        open={renameOpen}
        onCancel={() => setRenameOpen(false)}
        onOk={() => void submitRename()}
      >
        <Input
          value={renameValue}
          maxLength={40}
          onChange={(event) => setRenameValue(event.target.value)}
          placeholder="请输入会话标题"
          prefix={<UserOutlined />}
        />
      </Modal>
    </div>
  )
}
