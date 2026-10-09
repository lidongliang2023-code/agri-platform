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
 * `/ai/assistant/sessions/{id}/messages`、`/ai/assistant/messages`；
 * 后端骨架阶段无数据时回落原型示例会话，问答由本地农艺知识库兜底，保证真实多轮可交互。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
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

/* ==================== 原型示例会话（P31） ==================== */

/** 示例会话 1：番茄晚疫病防治方案（原型默认选中） */
const DEMO_SESSIONS: ChatSession[] = [
  {
    sessionId: 'DEMO-SESSION-1',
    title: '番茄晚疫病防治方案',
    lastMessage: '✅ 已为您生成农事任务：1号田晚疫病防治',
    createdAt: '2026-06-03 10:30:00',
    updatedAt: '2026-06-03 10:30:00',
  },
  {
    sessionId: 'DEMO-SESSION-2',
    title: '黄瓜霜霉病紧急处理',
    lastMessage: '已给出霜霉病紧急处理方案与用药建议',
    createdAt: '2026-06-02 14:20:00',
    updatedAt: '2026-06-02 14:20:00',
  },
  {
    sessionId: 'DEMO-SESSION-3',
    title: '水稻灌溉计划优化',
    lastMessage: '建议改为间歇灌溉，可节水约 18%',
    createdAt: '2026-06-01 09:15:00',
    updatedAt: '2026-06-01 09:15:00',
  },
  {
    sessionId: 'DEMO-SESSION-4',
    title: '有机认证标准咨询',
    lastMessage: '有机认证禁用化学合成农药，建议改用生物制剂',
    createdAt: '2026-05-30 16:45:00',
    updatedAt: '2026-05-30 16:45:00',
  },
]

/** 原型会话 1 的 4 条气泡（原文照搬） */
const DEMO_MESSAGES: Record<string, LocalMessage[]> = {
  'DEMO-SESSION-1': [
    {
      messageId: 'DEMO-MSG-1-1',
      sessionId: 'DEMO-SESSION-1',
      role: 'user',
      content:
        '1号田番茄叶片出现了水渍状斑点，边缘不明显，背面有白色霉层，这是什么病？怎么防治？',
      createdAt: '2026-06-03 10:24:00',
    },
    {
      messageId: 'DEMO-MSG-1-2',
      sessionId: 'DEMO-SESSION-1',
      role: 'assistant',
      content:
        '根据您描述的症状——叶片水渍状斑点、背面白色霉层，结合当前环境数据（湿度72%、温度28.5°C），**高度疑似番茄晚疫病（Phytophthora infestans）**。\n\n### 防治建议\n- ① 立即措施：喷施**代森锰锌**（800倍液）或甲霜灵锰锌，每亩用药量 60-80g\n- ② 环境调控：加强通风，降低棚内湿度至 **65% 以下**\n- ③ 后续监测：每 3 天检查一次病斑扩展情况\n- ④ 安全间隔：距采收期 > 15 天，满足休药期要求\n\n需要我帮您生成农事任务单吗？',
      createdAt: '2026-06-03 10:25:00',
    },
    {
      messageId: 'DEMO-MSG-1-3',
      sessionId: 'DEMO-SESSION-1',
      role: 'user',
      content: '好的，帮我生成任务单，安排张三明天上午执行',
      createdAt: '2026-06-03 10:28:00',
    },
    {
      messageId: 'DEMO-MSG-1-4',
      sessionId: 'DEMO-SESSION-1',
      role: 'assistant',
      content:
        '✅ 已为您生成农事任务：\n任务: 1号田晚疫病防治\n执行地块: 1号田\n执行人: 张三\n计划时间: 2026-06-04 08:00-11:00\n用药: 代森锰锌 800倍液，60g/亩\n优先级: 紧急\n\n点击「确认并创建任务」即可写入农事任务列表。',
      createdAt: '2026-06-03 10:30:00',
    },
  ],
  'DEMO-SESSION-2': [
    {
      messageId: 'DEMO-MSG-2-1',
      sessionId: 'DEMO-SESSION-2',
      role: 'user',
      content: '黄瓜叶片正面出现黄色多角形病斑，背面有紫灰色霉层，扩散很快，怎么办？',
      createdAt: '2026-06-02 14:12:00',
    },
    {
      messageId: 'DEMO-MSG-2-2',
      sessionId: 'DEMO-SESSION-2',
      role: 'assistant',
      content:
        '这是典型的**黄瓜霜霉病**，高湿（>85%）与 18~24℃ 环境下 3~5 天即可蔓延全棚。\n\n### 紧急处理\n- ① 当晚先降湿：关闭天窗后开启加温 1~2 小时，把棚内湿度压到 75% 以下\n- ② 药剂：喷施**烯酰吗啉**（1500 倍液）+ 代森联，重点喷叶背，亩用水量 45~60L\n- ③ 摘除重病叶并带出棚外销毁，减少再侵染源\n- ④ 3 天后复查，若病斑继续扩展，轮换使用氟噻唑吡乙酮\n\n需要我帮您生成农事任务单吗？',
      createdAt: '2026-06-02 14:20:00',
    },
  ],
  'DEMO-SESSION-3': [
    {
      messageId: 'DEMO-MSG-3-1',
      sessionId: 'DEMO-SESSION-3',
      role: 'user',
      content: '水稻A区现在一直保持浅水层，用水量太大，有没有更省的灌溉方案？',
      createdAt: '2026-06-01 09:05:00',
    },
    {
      messageId: 'DEMO-MSG-3-2',
      sessionId: 'DEMO-SESSION-3',
      role: 'assistant',
      content:
        '建议由「长期浅水灌溉」改为**间歇灌溉（干湿交替）**：\n\n### 优化方案\n- ① 分蘖期保持 2~3cm 浅水，够苗后及时晒田\n- ② 孕穗—抽穗期保持 3~5cm 水层，此期对水分最敏感\n- ③ 灌浆期干湿交替，前水不见后水\n- ④ 结合土壤墒情传感器（低于 30% 触发补水）实现按需灌溉\n\n按当前 1200 亩规模测算，全季可节水约 **18%**，同时降低纹枯病发生率。\n\n需要我帮您生成灌溉任务单吗？',
      createdAt: '2026-06-01 09:15:00',
    },
  ],
  'DEMO-SESSION-4': [
    {
      messageId: 'DEMO-MSG-4-1',
      sessionId: 'DEMO-SESSION-4',
      role: 'user',
      content: '我们想做有机认证，现有的化学农药还能继续用吗？',
      createdAt: '2026-05-30 16:38:00',
    },
    {
      messageId: 'DEMO-MSG-4-2',
      sessionId: 'DEMO-SESSION-4',
      role: 'assistant',
      content:
        '有机认证（GB/T 19630）明确**禁用化学合成农药、化肥与转基因投入品**，转换期一般为 24 个月（一年生作物）。\n\n### 替代方案\n- ① 病害防治：改用**枯草芽孢杆菌**、哈茨木霉菌等生物制剂\n- ② 虫害防治：黄板 / 杀虫灯 + 释放天敌（如丽蚜小蜂）\n- ③ 施肥：腐熟有机肥 + 绿肥轮作，禁用速效氮肥\n- ④ 台账：完整保留投入品采购凭证与使用记录，供认证审核追溯\n\n建议先在 1 号田做 30 亩转换试点，再逐步扩大。',
      createdAt: '2026-05-30 16:45:00',
    },
  ],
}

/* ==================== 本地农艺知识库（接口不可用时的兜底回复） ==================== */

/** 知识条目：命中关键词 → 回复模板 */
interface KnowledgeItem {
  /** 命中关键词 */
  keywords: string[]
  /** 回复内容（Markdown） */
  answer: string
}

/** 农艺知识库 */
const KNOWLEDGE_BASE: KnowledgeItem[] = [
  {
    keywords: ['晚疫病', '番茄', '霉层', '水渍'],
    answer:
      '根据您描述的症状——叶片水渍状斑点、背面白色霉层，结合当前环境数据（湿度72%、温度28.5°C），**高度疑似番茄晚疫病（Phytophthora infestans）**。\n\n### 防治建议\n- ① 立即措施：喷施**代森锰锌**（800倍液）或甲霜灵锰锌，每亩用药量 60-80g\n- ② 环境调控：加强通风，降低棚内湿度至 **65% 以下**\n- ③ 后续监测：每 3 天检查一次病斑扩展情况\n- ④ 安全间隔：距采收期 > 15 天，满足休药期要求\n\n需要我帮您生成农事任务单吗？',
  },
  {
    keywords: ['霜霉病', '黄瓜', '多角形'],
    answer:
      '这是典型的**黄瓜霜霉病**，高湿（>85%）与 18~24℃ 环境下 3~5 天即可蔓延全棚。\n\n### 紧急处理\n- ① 当晚先降湿：把棚内湿度压到 75% 以下\n- ② 药剂：喷施**烯酰吗啉**（1500 倍液）+ 代森联，重点喷叶背，亩用水量 45~60L\n- ③ 摘除重病叶并带出棚外销毁\n- ④ 3 天后复查，若病斑继续扩展，轮换使用氟噻唑吡乙酮\n\n需要我帮您生成农事任务单吗？',
  },
  {
    keywords: ['灌溉', '浇水', '缺水', '墒情'],
    answer:
      '建议由「长期漫灌」改为**间歇灌溉（干湿交替）**：\n\n### 优化方案\n- ① 苗期保持浅水层，避免深水淹心\n- ② 关键需水期（孕穗 / 膨果期）保持水层稳定\n- ③ 其余阶段干湿交替，前水不见后水\n- ④ 结合土壤墒情传感器（低于 30% 触发补水）按需灌溉\n\n按当前规模测算全季可节水约 **18%**，并降低根部病害发生率。',
  },
  {
    keywords: ['有机认证', '认证', '有机标准'],
    answer:
      '有机认证（GB/T 19630）明确**禁用化学合成农药、化肥与转基因投入品**，转换期一般为 24 个月（一年生作物）。\n\n### 替代方案\n- ① 病害防治：改用**枯草芽孢杆菌**、哈茨木霉菌等生物制剂\n- ② 虫害防治：黄板 / 杀虫灯 + 释放天敌\n- ③ 施肥：腐熟有机肥 + 绿肥轮作\n- ④ 台账：完整保留投入品采购凭证与使用记录\n\n建议先做 30 亩转换试点，再逐步扩大。',
  },
  {
    keywords: ['施肥', '追肥', '肥料', '氮'],
    answer:
      '结合当前生育期，建议按**少量多次**原则追肥：\n\n### 施肥建议\n- ① 结果期以高钾型水溶肥为主，N:P:K 约 1:0.5:1.6\n- ② 每亩每次 5~8kg，随水冲施，间隔 7~10 天\n- ③ 叶面补充钙镁硼，预防脐腐与裂果\n- ④ 距采收 10 天内停止氮肥，保证品质与硝酸盐达标',
  },
  {
    keywords: ['蚜虫', '白粉虱', '虫害', '蓟马'],
    answer:
      '该虫害建议采用**物理 + 生物 + 化学**三段式防控：\n\n### 防控方案\n- ① 物理：悬挂黄板 / 蓝板 30~40 张每亩，配合防虫网\n- ② 生物：释放丽蚜小蜂或瓢虫，控制虫口基数\n- ③ 化学：虫口达标时喷施**噻虫嗪**（3000 倍液）或吡虫啉，注意轮换用药\n- ④ 安全间隔：采收前 7 天停止用药',
  },
  {
    keywords: ['产量', '预估', '预测'],
    answer:
      '产量预测需要结合**亩株数、单株留果数、单果重与历史修正系数**：\n\n### 测算口径\n- ① 亩株数 × 单株留果数 × 平均单果重 = 理论产量\n- ② 乘以 0.85~0.92 的田间修正系数（病虫损失、畸形果）\n- ③ 建议到「AI助手 · 产量预测」页面用模型跑一版，含置信区间与历史准确率\n\n您也可以告诉我地块与作物，我帮您做一版粗算。',
  },
  {
    keywords: ['土壤', 'ph', '酸化', '板结'],
    answer:
      '土壤酸化 / 板结建议按**改良 + 培肥**两步走：\n\n### 改良方案\n- ① 施用生石灰 50~100kg/亩（视 pH 值调整），翻耕入土 15~20cm\n- ② 增施腐熟有机肥 2~3 吨/亩，提升有机质\n- ③ 推行深松 + 秸秆还田，打破犁底层\n- ④ 30 天后复测 pH，目标区间 6.0~6.8',
  },
]

/** 默认回复（未命中知识库时） */
const DEFAULT_ANSWER =
  '我已收到您的问题。为给出更准确的农艺建议，建议补充以下信息：\n\n- ① 作物种类与当前生育期\n- ② 发生地块与发生面积（亩）\n- ③ 症状出现时间与环境数据（温湿度）\n- ④ 近期已使用的投入品\n\n您也可以直接描述症状，我会结合知识库给出**防治方案与用药建议**，并支持一键生成农事任务单。'

/** 生成任务单的回复模板（命中「任务单 / 帮我生成 / 安排」时） */
const TASK_ANSWER_TEMPLATE =
  '✅ 已为您生成农事任务：\n任务: 1号田晚疫病防治\n执行地块: 1号田\n执行人: 张三\n计划时间: 2026-06-04 08:00-11:00\n用药: 代森锰锌 800倍液，60g/亩\n优先级: 紧急\n\n点击「确认并创建任务」即可写入农事任务列表。'

/**
 * 根据用户输入匹配本地知识库
 *
 * @param question 用户问题
 * @returns AI 回复内容（Markdown）
 */
function answerLocally(question: string): string {
  const text = question.toLowerCase()
  if (/任务单|生成任务|帮我安排|安排一下/.test(text)) {
    return TASK_ANSWER_TEMPLATE
  }
  const hit = KNOWLEDGE_BASE.find((item) => item.keywords.some((kw) => text.includes(kw)))
  return hit ? hit.answer : DEFAULT_ANSWER
}

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
  if (!suggestion.planTime) {
    suggestion.planTime = dayjs().add(1, 'day').format('YYYY-MM-DD') + ' 08:00-11:00'
  }
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

  /** 会话列表（接口优先，回落示例） */
  const [sessions, setSessions] = useState<ChatSession[]>(DEMO_SESSIONS)
  const [activeSessionId, setActiveSessionId] = useState<string>(DEMO_SESSIONS[0].sessionId)

  /** 各会话消息（本地合并接口数据） */
  const [messageMap, setMessageMap] = useState<Record<string, LocalMessage[]>>(DEMO_MESSAGES)

  /** 输入框内容 */
  const [inputValue, setInputValue] = useState<string>('')
  /** 是否正在等待 / 流式输出 */
  const [pending, setPending] = useState<boolean>(false)
  /** 流式输出的临时文本 */
  const [streamText, setStreamText] = useState<string>('')

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

  /** 远程会话就绪后覆盖本地示例 */
  useEffect(() => {
    const remote = sessionsQuery.data
    if (Array.isArray(remote) && remote.length > 0) {
      setSessions(remote)
      setActiveSessionId((prev) =>
        remote.some((item) => item.sessionId === prev) ? prev : remote[0].sessionId,
      )
    }
  }, [sessionsQuery.data])

  /** 远程消息就绪后覆盖本地示例 */
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
   * 流程：本地追加用户消息 → 展示思考中 → 请求接口（失败则用本地知识库兜底）
   * → 流式输出 AI 回复 → 更新会话摘要。
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

    let reply = ''
    try {
      const res = await sendChatMessage({ sessionId, content })
      reply = res?.content || answerLocally(content)
    } catch {
      reply = answerLocally(content)
    }

    await streamReply(reply, sessionId)
    setPending(false)
    setSessions((prev) =>
      prev.map((item) =>
        item.sessionId === sessionId
          ? { ...item, lastMessage: reply.slice(0, 30), updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss') }
          : item,
      ),
    )
  }

  /** 输入框键盘事件：Enter 发送 / Shift+Enter 换行 */
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleSend()
    }
  }

  /** 新建会话 */
  const createMutation = useMutation({
    mutationFn: async () => {
      try {
        const created = await createChatSession('新对话')
        return created?.sessionId ?? `LOCAL-SESSION-${Date.now()}`
      } catch {
        return `LOCAL-SESSION-${Date.now()}`
      }
    },
    onSuccess: (sessionId) => {
      const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
      setSessions((prev) => [
        { sessionId, title: '新对话', lastMessage: '', createdAt: now, updatedAt: now },
        ...prev,
      ])
      setMessageMap((prev) => ({ ...prev, [sessionId]: [] }))
      setActiveSessionId(sessionId)
      void queryClient.invalidateQueries({ queryKey: ['ai-chat-sessions'] })
      message.success('已新建会话')
    },
  })

  /** 删除会话 */
  const deleteMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      try {
        await deleteChatSession(sessionId)
      } catch {
        // 回落态仅删除本地
      }
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
  })

  /** 提交重命名 */
  const submitRename = async (): Promise<void> => {
    if (!renameTarget || !renameValue.trim()) {
      message.warning('请输入会话标题')
      return
    }
    const title = renameValue.trim()
    try {
      await renameChatSession(renameTarget.sessionId, title)
    } catch {
      // 回落态仅更新本地
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

  return (
    <div style={{ padding: 24 }}>
      <Card
        styles={{ body: { padding: 0, height: 'calc(100vh - 152px)' } }}
        style={{ overflow: 'hidden' }}
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
                  locale={{ emptyText: <Empty description="暂无会话" /> }}
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
                              {item.title}
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
              {messages.length === 0 && (
                <Empty
                  description="开始提问吧，例如：番茄叶片出现水渍状斑点怎么防治？"
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
                  placeholder="请输入您的问题..."
                  autoSize={{ minRows: 2, maxRows: 5 }}
                  disabled={pending}
                />
                <Space style={{ width: '100%', justifyContent: 'space-between' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Enter 发送，Shift + Enter 换行
                  </Text>
                  <Button
                    type="primary"
                    icon={<SendOutlined />}
                    loading={pending}
                    disabled={!inputValue.trim()}
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
