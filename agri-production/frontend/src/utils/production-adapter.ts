/**
 * 用户端「首页看板 / 消息中心 / 团队管理 / 种养计划」通用适配层
 *
 * 存在背景：
 * 1. 后端 `core-platform/mod-produce` 返回的实体字段名与 `src/types` 契约存在命名差异
 *    （memberName↔realName、planCode↔planNo、msgType↔messageType、readFlag↔isRead 等），
 *    本模块统一做「双名读取 + 类型归一」，保证页面在任意一种数据形态下都能正确渲染。
 * 2. 后端 PageResult 结构为 `{ records, total, page, size }`，前端契约为
 *    `{ list, total, pageNum, pageSize, pages }`，由 normalizePageResult 统一转换。
 * 3. 状态枚举、Tag 颜色、角色/权限目录等字典集中在此，页面不重复定义。
 *
 * 只读 harness：本模块不发起任何网络请求，网络请求封装见 `src/api/production-view.ts`。
 */
import dayjs from 'dayjs'
import type {
  Alert,
  Member,
  MessageItem,
  PageResult,
  Plan,
  PlanStage,
  Plot,
  Task,
} from '@/types'

/** 未知结构记录的统一别名 */
export type UnknownRecord = Record<string, unknown>

/**
 * 将任意值安全地转换为对象记录
 * @param value 任意入参
 * @returns 对象记录；非对象返回空对象
 */
export function asRecord(value: unknown): UnknownRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as UnknownRecord
  }
  return {}
}

/**
 * 按候选键顺序读取第一个「有效」值（非 undefined / null / 空串）
 * @param source 数据来源
 * @param keys 候选字段名
 * @returns 命中的原始值，未命中返回 undefined
 */
export function readValue(source: unknown, keys: string[]): unknown {
  const record = asRecord(source)
  for (const key of keys) {
    const value = record[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return undefined
}

/**
 * 读取字符串（兼容数字 / 布尔）
 * @param source 数据来源
 * @param keys 候选字段名
 * @param fallback 缺省值
 * @returns 字符串结果
 */
export function readString(source: unknown, keys: string[], fallback = ''): string {
  const value = readValue(source, keys)
  if (value === undefined) return fallback
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return fallback
}

/**
 * 读取数字
 * @param source 数据来源
 * @param keys 候选字段名
 * @param fallback 缺省值
 * @returns 数字结果（非法值回落 fallback）
 */
export function readNumber(source: unknown, keys: string[], fallback = 0): number {
  const value = readValue(source, keys)
  if (value === undefined) return fallback
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * 读取布尔值（兼容 0/1、'0'/'1'、'true'/'false'、'Y'/'N'）
 * @param source 数据来源
 * @param keys 候选字段名
 * @param fallback 缺省值
 * @returns 布尔结果
 */
export function readBoolean(source: unknown, keys: string[], fallback = false): boolean {
  const value = readValue(source, keys)
  if (value === undefined) return fallback
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return value !== 0
  const text = String(value).trim().toLowerCase()
  if (text === 'true' || text === '1' || text === 'y' || text === 'yes') return true
  if (text === 'false' || text === '0' || text === 'n' || text === 'no') return false
  return fallback
}

/**
 * 读取并归一化日期字符串为 yyyy-MM-dd
 * @param source 数据来源
 * @param keys 候选字段名
 * @param fallback 缺省值
 * @returns yyyy-MM-dd 日期串
 */
export function readDate(source: unknown, keys: string[], fallback = ''): string {
  const value = readValue(source, keys)
  if (value === undefined) return fallback
  const text = String(value)
  if (!text) return fallback
  if (text.includes('T')) return text.slice(0, 10)
  return text.slice(0, 10)
}

/**
 * 读取字符串数组
 * @param source 数据来源
 * @param keys 候选字段名
 * @returns 字符串数组
 */
export function readStringList(source: unknown, keys: string[]): string[] {
  const value = readValue(source, keys)
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined && item !== null).map((item) => String(item))
  }
  if (typeof value === 'string' && value) {
    return [value]
  }
  return []
}

/**
 * 归一化后端分页结果为前端 PageResult 契约
 *
 * 同时兼容 `{ records, total, page, size }`（core-platform）与
 * `{ list, total, pageNum, pageSize }`（自身契约）两种形态。
 *
 * @param raw 后端原始返回
 * @param pageNum 当前页码（兜底）
 * @param pageSize 每页条数（兜底）
 * @returns 前端分页结果
 */
export function normalizePageResult<T>(
  raw: unknown,
  pageNum = 1,
  pageSize = 10,
): PageResult<T> {
  const record = asRecord(raw)
  const listRaw = readValue(record, ['list', 'records', 'items', 'rows'])
  const list = Array.isArray(listRaw) ? (listRaw as T[]) : []
  const size = readNumber(record, ['pageSize', 'size'], pageSize) || pageSize
  const current = readNumber(record, ['pageNum', 'pageNo', 'page', 'current'], pageNum) || pageNum
  const total = readNumber(record, ['total', 'totalCount', 'count'], list.length)
  return {
    pageNum: current,
    pageSize: size,
    total,
    pages: Math.max(1, Math.ceil(total / Math.max(1, size))),
    list,
  }
}

/* ==================== 字典：状态标签 ==================== */

/** Tag 展示元信息 */
export interface TagMeta {
  /** 展示文案 */
  label: string
  /** antd Tag 颜色 */
  color: string
}

/** 通用下拉 / 筛选选项 */
export interface OptionLike<V = number> {
  /** 选项值 */
  value: V
  /** 展示文案 */
  label: string
}

/**
 * 计划状态标签
 *
 * 取值对齐 PRD 12.1.15 语义，并与后端 prod_plan_info.status 数值保持一致：
 * 0 作废 / 1 编制中 / 2 进行中 / 3 已完结 / 4 已取消。
 *
 * @param status 状态值
 * @returns Tag 元信息
 */
export function planStatusMeta(status: number): TagMeta {
  switch (status) {
    case 1:
      return { label: '编制中', color: 'default' }
    case 2:
      return { label: '进行中', color: 'processing' }
    case 3:
      return { label: '已完结', color: 'success' }
    case 4:
      return { label: '已取消', color: 'error' }
    case 5:
      return { label: '待审批', color: 'warning' }
    case 0:
      return { label: '已作废', color: 'default' }
    default:
      return { label: '未知', color: 'default' }
  }
}

/** 计划状态下拉选项 */
export const PLAN_STATUS_OPTIONS: OptionLike[] = [
  { value: 1, label: '编制中' },
  { value: 2, label: '进行中' },
  { value: 3, label: '已完结' },
  { value: 4, label: '已取消' },
]

/** 计划阶段状态：1未开始 2进行中 3已完成 0已取消（后端 prod_plan_stage.status） */
export function stageStatusMeta(status: number): TagMeta {
  switch (status) {
    case 2:
      return { label: '进行中', color: 'processing' }
    case 3:
      return { label: '已完成', color: 'success' }
    case 0:
      return { label: '已取消', color: 'default' }
    default:
      return { label: '未开始', color: 'default' }
  }
}

/**
 * 成员状态标签
 *
 * 1 在职 / 2 待激活 / 0 已停用（离职），与 MemberStatus 契约一致。
 *
 * @param status 状态值
 * @returns Tag 元信息
 */
export function memberStatusMeta(status: number): TagMeta {
  switch (status) {
    case 1:
      return { label: '在职', color: 'success' }
    case 2:
      return { label: '待激活', color: 'warning' }
    default:
      return { label: '已停用', color: 'default' }
  }
}

/** 成员状态下拉选项 */
export const MEMBER_STATUS_OPTIONS: OptionLike[] = [
  { value: 1, label: '在职' },
  { value: 2, label: '待激活' },
  { value: 0, label: '已停用' },
]

/** 成员类型：OWNER/AGRONOMIST/INSPECTOR/OPERATOR（后端 prod_member.member_type） */
export const MEMBER_TYPE_META: Record<string, TagMeta> = {
  OWNER: { label: '农场主', color: 'green' },
  AGRONOMIST: { label: '农艺师', color: 'blue' },
  INSPECTOR: { label: '巡检员', color: 'cyan' },
  OPERATOR: { label: '操作员', color: 'geekblue' },
}

/**
 * 成员类型标签
 * @param memberType 成员类型编码
 * @returns Tag 元信息
 */
export function memberTypeMeta(memberType: string): TagMeta {
  return MEMBER_TYPE_META[memberType] ?? { label: memberType || '未分配', color: 'default' }
}

/** 成员类型下拉选项 */
export const MEMBER_TYPE_OPTIONS: OptionLike<string>[] = [
  { value: 'OWNER', label: '农场主' },
  { value: 'AGRONOMIST', label: '农艺师' },
  { value: 'INSPECTOR', label: '巡检员' },
  { value: 'OPERATOR', label: '操作员' },
]

/** 消息类型：1 系统通知 2 任务提醒 3 告警通知 4 审批通知（PRD 6.1 #3） */
export const MESSAGE_TYPE_META: Record<number, TagMeta & { icon: string }> = {
  1: { label: '系统通知', color: 'blue', icon: '⚙️' },
  2: { label: '任务提醒', color: 'green', icon: '📋' },
  3: { label: '告警通知', color: 'red', icon: '⚠️' },
  4: { label: '审批通知', color: 'orange', icon: '✅' },
}

/**
 * 将后端消息类型（TASK/ALERT/QUALITY/SYSTEM）归一为数值编码
 * @param raw 类型原始值
 * @returns 消息类型数值：1 系统 2 任务 3 告警 4 审批
 */
export function normalizeMessageType(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return MESSAGE_TYPE_META[raw] ? raw : 1
  }
  const text = String(raw ?? '').trim().toUpperCase()
  switch (text) {
    case 'TASK':
      return 2
    case 'ALERT':
      return 3
    case 'QUALITY':
    case 'AUDIT':
    case 'APPROVAL':
      return 4
    case 'SYSTEM':
    default:
      return 1
  }
}

/**
 * 消息类型标签
 * @param messageType 消息类型
 * @returns Tag 元信息（含图标）
 */
export function messageTypeMeta(messageType: number): TagMeta & { icon: string } {
  return MESSAGE_TYPE_META[messageType] ?? MESSAGE_TYPE_META[1]
}

/** 告警级别：1 提示 2 一般 3 严重 4 紧急（PRD 12.1.2） */
export function alertLevelMeta(level: number): TagMeta {
  switch (level) {
    case 4:
      return { label: '紧急', color: 'red' }
    case 3:
      return { label: '严重', color: 'volcano' }
    case 2:
      return { label: '一般', color: 'orange' }
    default:
      return { label: '提示', color: 'blue' }
  }
}

/** 告警状态：1 未处理 2 处理中 3 已处理 4 已忽略（PRD 12.1.13） */
export function alertStatusMeta(status: number): TagMeta {
  switch (status) {
    case 2:
      return { label: '处理中', color: 'processing' }
    case 3:
      return { label: '已解决', color: 'success' }
    case 4:
      return { label: '已忽略', color: 'default' }
    default:
      return { label: '待处理', color: 'error' }
  }
}

/** 任务优先级：1 低 2 中 3 高 4 紧急（types/task.ts） */
export function priorityMeta(priority: number): TagMeta {
  switch (priority) {
    case 4:
      return { label: '紧急', color: 'red' }
    case 3:
      return { label: '高', color: 'orange' }
    case 2:
      return { label: '中', color: 'blue' }
    default:
      return { label: '低', color: 'default' }
  }
}

/**
 * 任务状态标签。
 *
 * 迁移窗口内后端仍返回旧词，PRD 标准值也要认，两套字面量映射到同一展示：
 * `executing ≡ doing`（执行中）、`completed ≡ done`（已完成）。
 * `accepted` 仅为历史脏值兜底；`submitted` / `awaiting_acceptance` 一律不予支持，
 * 「待验收」在后端是 `acceptStatus === 0`，不是 status（见 `TASK_ACCEPT_PENDING`）。
 *
 * @param status 状态串
 * @returns Tag 元信息
 */
export function taskStatusMeta(status: string): TagMeta {
  switch (status) {
    case 'pending':
      return { label: '待执行', color: 'default' }
    case 'assigned':
      return { label: '已派发', color: 'blue' }
    case 'executing':
    case 'doing':
      return { label: '执行中', color: 'processing' }
    case 'accepted':
    case 'done':
    case 'completed':
      return { label: '已完成', color: 'success' }
    case 'suspended':
      return { label: '已暂停', color: 'gold' }
    case 'cancelled':
      return { label: '已取消', color: 'default' }
    case 'expired':
      return { label: '已过期', color: 'volcano' }
    case 'rejected':
      return { label: '已驳回', color: 'red' }
    default:
      return { label: status || '未知', color: 'default' }
  }
}

/** 地块状态：0 停用 1 空闲 2 在种 3 采收期 4 休耕（PRD 12.1.5） */
export function plotStatusMeta(status: number): TagMeta {
  switch (status) {
    case 2:
      return { label: '在种', color: 'green' }
    case 3:
      return { label: '采收期', color: 'gold' }
    case 4:
      return { label: '休耕', color: 'default' }
    case 0:
      return { label: '停用', color: 'default' }
    default:
      return { label: '空闲', color: 'blue' }
  }
}

/** 任务类型中文映射（PRD 12.1.6） */
export const TASK_TYPE_META: Record<string, string> = {
  tillage: '整地',
  sowing: '播种/移栽',
  fertilizing: '施肥',
  irrigating: '灌溉',
  pest_control: '植保/施药',
  pruning: '修剪/整枝',
  weeding: '除草',
  pollination: '授粉',
  harvesting: '采收',
  patrol: '巡田/巡检',
  other: '其他',
}

/**
 * 任务类型展示文案
 * @param taskType 任务类型编码或中文
 * @returns 展示文案
 */
export function taskTypeLabel(taskType: string): string {
  if (!taskType) return '-'
  return TASK_TYPE_META[taskType] ?? taskType
}

/* ==================== 字典：角色与权限 ==================== */

/** 角色目录项（对齐 PRD 3.1 用户端角色定义） */
export interface RoleCatalogItem {
  /** 角色编码 */
  roleCode: string
  /** 角色名称 */
  roleName: string
  /** 职责描述 */
  description: string
  /** 默认数据范围 */
  defaultScope: string
}

/** 用户端内置角色目录（PRD 3.1） */
export const ROLE_CATALOG: RoleCatalogItem[] = [
  {
    roleCode: 'farm_owner',
    roleName: '农场主',
    description: '主体经营者，拥有主体内全部数据权限，负责经营决策、告警处置、对外授权',
    defaultScope: 'TENANT',
  },
  {
    roleCode: 'tenant_admin',
    roleName: '主体管理员',
    description: '主体系统管理员，负责账号开通、角色分配、系统配置',
    defaultScope: 'TENANT',
  },
  {
    roleCode: 'farm_manager',
    roleName: '农场管理员',
    description: '单农场管理，负责任务派发与验收、库存管理、日常运营',
    defaultScope: 'FARM',
  },
  {
    roleCode: 'agronomist',
    roleName: '农艺师',
    description: '技术专家，负责SOP编制审核、种植方案制定、病虫害诊断、防治指导',
    defaultScope: 'FARM',
  },
  {
    roleCode: 'worker',
    roleName: '作业员工',
    description: '一线执行者，执行生产任务、登记投入品使用、上传作业凭证',
    defaultScope: 'PLOT',
  },
  {
    roleCode: 'finance',
    roleName: '财务人员',
    description: '查看投入品成本、采收产量与产值数据，导出经营报表',
    defaultScope: 'TENANT',
  },
]

/**
 * 按角色编码查询角色名称
 * @param roleCode 角色编码
 * @returns 角色名称，未命中返回编码本身
 */
export function roleName(roleCode: string): string {
  const hit = ROLE_CATALOG.find((item) => item.roleCode === roleCode)
  return hit ? hit.roleName : roleCode || '未分配'
}

/** 数据范围选项（PRD 3.4 数据范围约束 + 平台级扩展） */
export const DATA_SCOPE_OPTIONS: OptionLike<string>[] = [
  { value: 'SELF', label: '仅本人数据（SELF）' },
  { value: 'PLOT', label: '被分配地块（PLOT）' },
  { value: 'FARM', label: '所属农场（FARM）' },
  { value: 'TENANT', label: '本主体全部（TENANT）' },
  { value: 'DEPT', label: '所属部门（DEPT）' },
  { value: 'ORG', label: '所属机构（ORG）' },
  { value: 'REGION', label: '所属区域（REGION）' },
  { value: 'CHANNEL', label: '所属渠道（CHANNEL）' },
  { value: 'PLATFORM', label: '全平台（PLATFORM）' },
]

/**
 * 数据范围展示文案
 * @param scope 数据范围编码
 * @returns 展示文案
 */
export function dataScopeLabel(scope: string): string {
  const hit = DATA_SCOPE_OPTIONS.find((item) => item.value === scope)
  return hit ? hit.label.split('（')[0] : scope || '-'
}

/** 权限点（功能域 → 资源 → 动作） */
export interface PermissionPoint {
  /** 权限编码，形如 produce.task.create */
  code: string
  /** 权限名称 */
  name: string
}

/** 权限分组 */
export interface PermissionGroup {
  /** 功能域编码 */
  domain: string
  /** 功能域名称 */
  domainName: string
  /** 资源动作 */
  actions: string[]
  /** 资源清单 */
  resources: { code: string; name: string }[]
}

/**
 * 权限点目录
 *
 * 权限点命名遵循 `{域}.{资源}.{动作}`（PRD 3.4 RBAC 三层模型），
 * 覆盖用户端六大功能域：农场/地块、种养计划、农事任务、投入品、采收库存、质量溯源 + 系统管理。
 */
export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    domain: 'produce',
    domainName: '生产管理',
    actions: ['view', 'create', 'update', 'delete', 'export'],
    resources: [
      { code: 'dashboard', name: '生产看板' },
      { code: 'farm', name: '农场档案' },
      { code: 'plot', name: '地块档案' },
      { code: 'member', name: '团队人员' },
      { code: 'role', name: '角色权限' },
      { code: 'plan', name: '种养计划' },
      { code: 'task', name: '农事任务' },
      { code: 'input', name: '投入品' },
      { code: 'growth', name: '生长监测' },
      { code: 'alert', name: '告警管理' },
      { code: 'iot', name: 'IoT设备' },
      { code: 'harvest', name: '采收库存' },
      { code: 'quality', name: '质量检测' },
      { code: 'trace', name: '溯源管理' },
      { code: 'report', name: '统计报表' },
    ],
  },
  {
    domain: 'ai',
    domainName: '智能决策',
    actions: ['view', 'run'],
    resources: [
      { code: 'pest', name: '病虫害识别' },
      { code: 'assistant', name: 'AI问答助手' },
      { code: 'forecast', name: '产量预测' },
    ],
  },
  {
    domain: 'chain',
    domainName: '区块链存证',
    actions: ['view', 'verify', 'submit'],
    resources: [
      { code: 'record', name: '存证记录' },
      { code: 'batch', name: '批次存证' },
    ],
  },
  {
    domain: 'system',
    domainName: '系统设置',
    actions: ['view', 'update'],
    resources: [
      { code: 'setting', name: '参数配置' },
      { code: 'message', name: '消息通知' },
    ],
  },
]

/** 动作中文映射 */
const ACTION_LABEL: Record<string, string> = {
  view: '查看',
  create: '新增',
  update: '编辑',
  delete: '删除',
  export: '导出',
  run: '调用',
  verify: '验真',
  submit: '提交',
}

/**
 * 展开权限点目录为扁平列表
 * @returns 权限点列表
 */
export function flattenPermissions(): PermissionPoint[] {
  const result: PermissionPoint[] = []
  for (const group of PERMISSION_GROUPS) {
    for (const resource of group.resources) {
      for (const action of group.actions) {
        const prefix = group.domain === 'produce' ? 'produce' : group.domain
        result.push({
          code: `${prefix}.${resource.code}.${action}`,
          name: `${resource.name}-${ACTION_LABEL[action] ?? action}`,
        })
      }
    }
  }
  return result
}

/**
 * 权限编码 → 中文名称
 * @param code 权限编码
 * @returns 中文名称
 */
export function permissionName(code: string): string {
  const hit = flattenPermissions().find((item) => item.code === code)
  return hit ? hit.name : code
}

/** 角色默认权限建议（用于「按模板一键填充」） */
export const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  farm_owner: flattenPermissions().map((item) => item.code),
  tenant_admin: [
    'produce.member.view',
    'produce.member.create',
    'produce.member.update',
    'produce.role.view',
    'produce.role.update',
    'produce.dashboard.view',
    'produce.report.view',
    'produce.report.export',
    'system.setting.view',
    'system.setting.update',
    'system.message.view',
  ],
  farm_manager: [
    'produce.dashboard.view',
    'produce.farm.view',
    'produce.farm.update',
    'produce.plot.view',
    'produce.plot.update',
    'produce.plan.view',
    'produce.plan.create',
    'produce.plan.update',
    'produce.task.view',
    'produce.task.create',
    'produce.task.update',
    'produce.input.view',
    'produce.input.update',
    'produce.harvest.view',
    'produce.harvest.create',
    'produce.trace.view',
    'produce.trace.create',
    'produce.alert.view',
    'produce.alert.update',
    'produce.report.view',
  ],
  agronomist: [
    'produce.dashboard.view',
    'produce.plan.view',
    'produce.plan.create',
    'produce.plan.update',
    'produce.task.view',
    'produce.growth.view',
    'produce.growth.create',
    'produce.input.view',
    'produce.quality.view',
    'produce.alert.view',
    'ai.pest.run',
    'ai.assistant.run',
    'ai.forecast.run',
  ],
  worker: [
    'produce.task.view',
    'produce.task.update',
    'produce.input.view',
    'produce.growth.view',
    'produce.growth.create',
    'produce.harvest.view',
  ],
  finance: [
    'produce.dashboard.view',
    'produce.input.view',
    'produce.harvest.view',
    'produce.report.view',
    'produce.report.export',
  ],
}

/* ==================== 实体归一化 ==================== */

/**
 * 归一化团队成员
 * @param raw 后端原始记录
 * @returns Member
 */
export function normalizeMember(raw: unknown): Member {
  const record = asRecord(raw)
  const roleIds = readStringList(record, ['roleIds'])
  const roleCode = readString(record, ['roleCode'])
  if (roleIds.length === 0 && roleCode) {
    roleIds.push(roleCode)
  }
  return {
    id: readString(record, ['id'], ''),
    memberId: readString(record, ['memberId', 'id'], ''),
    userId: readString(record, ['userId'], ''),
    realName: readString(record, ['realName', 'memberName', 'userName'], '未命名成员'),
    phone: readString(record, ['phone', 'mobile'], '-'),
    email: readString(record, ['email'], ''),
    avatar: readString(record, ['avatar'], ''),
    farmId: readString(record, ['farmId'], ''),
    department: readString(record, ['department'], ''),
    position: readString(record, ['position', 'postName'], ''),
    roleIds,
    roleNames: readStringList(record, ['roleNames']),
    status: (readNumber(record, ['status'], 1) as Member['status']),
    joinedAt: readDate(record, ['joinedAt', 'joinDate', 'createdAt'], ''),
  }
}

/**
 * 归一化种养计划
 * @param raw 后端原始记录
 * @returns Plan
 */
export function normalizePlan(raw: unknown): Plan {
  const record = asRecord(raw)
  return {
    planId: readString(record, ['planId', 'id'], ''),
    planNo: readString(record, ['planNo', 'planCode'], '-'),
    planName: readString(record, ['planName'], '未命名计划'),
    farmId: readString(record, ['farmId'], ''),
    farmName: readString(record, ['farmName'], ''),
    plotId: readString(record, ['plotId'], ''),
    plotName: readString(record, ['plotName'], ''),
    cropId: readString(record, ['cropId'], ''),
    cropName: readString(record, ['cropName', 'cropId'], '-'),
    cropVariety: readString(record, ['cropVariety'], ''),
    startDate: readDate(record, ['startDate', 'planStartDate'], ''),
    endDate: readDate(record, ['endDate', 'planEndDate'], ''),
    expectedYield: readNumber(record, ['expectedYield', 'expectedOutput'], 0),
    planArea: readNumber(record, ['planArea', 'totalArea'], 0),
    managerId: readString(record, ['managerId', 'ownerId'], ''),
    managerName: readString(record, ['managerName', 'ownerName'], ''),
    status: (readNumber(record, ['status', 'planStatus'], 1) as Plan['status']),
    sopTemplateId: readString(record, ['sopTemplateId'], ''),
    remark: readString(record, ['remark', 'planSummary', 'description'], ''),
    createdAt: readString(record, ['createdAt'], ''),
    updatedAt: readString(record, ['updatedAt'], ''),
  }
}

/**
 * 归一化种养计划阶段
 * @param raw 后端原始记录
 * @returns PlanStage
 */
/**
 * 归一化计划生育期阶段
 *
 * 说明：`prod_plan_stage` 表**未提供** actual_start_date / actual_end_date 列，
 * 阶段是否完成以 `status`（1未开始 2进行中 3已完成 0取消）判定；
 * actualEndDate 仍做兜底读取，待后端补齐该列后自动生效。
 *
 * @param raw 后端原始记录
 * @returns 阶段数据（附加 status）
 */
export function normalizePlanStage(raw: unknown): PlanStage & { status: number; taskType: string } {
  const record = asRecord(raw)
  return {
    stageId: readString(record, ['stageId', 'id'], ''),
    planId: readString(record, ['planId'], ''),
    stageNo: readNumber(record, ['stageNo', 'stageSeq'], 0),
    stageName: readString(record, ['stageName'], '未命名阶段'),
    planStartDate: readDate(record, ['planStartDate', 'startDate'], ''),
    planEndDate: readDate(record, ['planEndDate', 'endDate'], ''),
    actualStartDate: readDate(record, ['actualStartDate'], ''),
    actualEndDate: readDate(record, ['actualEndDate'], ''),
    description: readString(record, ['description'], ''),
    taskCount: readNumber(record, ['taskCount'], 0),
    status: readNumber(record, ['status'], 1),
    taskType: readString(record, ['taskType'], ''),
  }
}

/**
 * 归一化站内消息
 * @param raw 后端原始记录
 * @returns MessageItem
 */
export function normalizeMessage(raw: unknown): MessageItem {
  const record = asRecord(raw)
  return {
    messageId: readString(record, ['messageId', 'id'], ''),
    title: readString(record, ['title'], '（无标题）'),
    content: readString(record, ['content'], ''),
    messageType: normalizeMessageType(
      readValue(record, ['messageType', 'msgType']),
    ) as MessageItem['messageType'],
    isRead: readBoolean(record, ['isRead', 'readFlag'], false),
    linkPath: readString(record, ['linkPath', 'bizUrl'], ''),
    bizId: readString(record, ['bizId'], ''),
    createdAt: readString(record, ['createdAt', 'sentAt'], ''),
    readAt: readString(record, ['readAt'], ''),
  }
}

/**
 * 将告警级别归一为数值：1 提示 2 一般 3 严重 4 紧急（PRD 12.1.2）
 *
 * 后端取值可能为字符串（INFO/WARN/CRITICAL）或数值，二者都需支持。
 *
 * @param raw 告警级别原始值
 * @returns 1-4 的级别值
 */
export function normalizeAlertLevel(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw >= 1 && raw <= 4 ? raw : 2
  }
  switch (String(raw ?? '').trim().toUpperCase()) {
    case 'INFO':
      return 1
    case 'IMPORTANT':
    case 'NORMAL':
    case 'WARN':
      return 2
    case 'SERIOUS':
    case 'CRITICAL':
      return 3
    case 'URGENT':
      return 4
    default:
      return 2
  }
}

/**
 * 将告警状态归一为数值：1 未处理 2 处理中 3 已处理 4 已忽略（PRD 12.1.13）
 * @param raw 状态原始值
 * @returns 1-4 的状态值
 */
export function normalizeAlertStatus(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw >= 1 && raw <= 4 ? raw : 1
  }
  switch (String(raw ?? '').trim().toUpperCase()) {
    case 'HANDLED':
    case 'RESOLVED':
      return 3
    case 'PROCESSING':
      return 2
    case 'IGNORED':
      return 4
    default:
      return 1
  }
}

/**
 * 归一化告警
 * @param raw 后端原始记录
 * @returns Alert
 */
export function normalizeAlert(raw: unknown): Alert {
  const record = asRecord(raw)
  return {
    alertId: readString(record, ['alertId', 'id'], ''),
    alertNo: readString(record, ['alertNo', 'alertCode'], '-'),
    alertTitle: readString(record, ['alertTitle', 'title'], '未命名告警'),
    alertContent: readString(record, ['alertContent', 'content', 'handleRemark'], ''),
    alertLevel: normalizeAlertLevel(
      readValue(record, ['alertLevel', 'level']),
    ) as Alert['alertLevel'],
    alertSource: (readNumber(record, ['alertSource', 'source'], 1) as Alert['alertSource']),
    farmId: readString(record, ['farmId'], ''),
    plotId: readString(record, ['plotId'], ''),
    plotName: readString(record, ['plotName'], ''),
    deviceId: readString(record, ['deviceId'], ''),
    ruleId: readString(record, ['ruleId'], ''),
    triggerValue: readString(record, ['triggerValue', 'metricValue'], ''),
    status: normalizeAlertStatus(readValue(record, ['status'])) as Alert['status'],
    handlerId: readString(record, ['handlerId', 'handleBy'], ''),
    handlerName: readString(record, ['handlerName', 'handleByName'], ''),
    handleRemark: readString(record, ['handleRemark'], ''),
    triggeredAt: readString(record, ['triggeredAt', 'alertTime', 'createdAt'], ''),
    handledAt: readString(record, ['handledAt', 'handleTime'], ''),
  }
}

/**
 * 归一化农事任务
 * @param raw 后端原始记录
 * @returns Task
 */
export function normalizeTask(raw: unknown): Task {
  const record = asRecord(raw)
  return {
    taskId: readString(record, ['taskId', 'id'], ''),
    taskNo: readString(record, ['taskNo', 'taskCode'], '-'),
    planId: readString(record, ['planId'], ''),
    plotId: readString(record, ['plotId'], ''),
    plotName: readString(record, ['plotName'], ''),
    taskType: readString(record, ['taskType'], 'other'),
    taskName: readString(record, ['taskName'], '未命名任务'),
    description: readString(record, ['description'], ''),
    planStartDate: readString(record, ['planStartDate'], ''),
    planEndDate: readString(record, ['planEndDate'], ''),
    actualStartDate: readString(record, ['actualStartDate'], ''),
    actualEndDate: readString(record, ['actualEndDate'], ''),
    assigneeId: readString(record, ['assigneeId'], ''),
    assigneeName: readString(record, ['assigneeName'], ''),
    assignerId: readString(record, ['assignerId'], ''),
    assignerName: readString(record, ['assignerName'], ''),
    status: (readString(record, ['status'], 'pending') as Task['status']),
    priority: (readNumber(record, ['priority'], 2) as Task['priority']),
    templateId: readString(record, ['templateId'], ''),
    rejectCount: readNumber(record, ['rejectCount'], 0),
    acceptStatus: (readNumber(record, ['acceptStatus'], 0) as Task['acceptStatus']),
    acceptRemark: readString(record, ['acceptRemark'], ''),
    completedAt: readString(record, ['completedAt'], ''),
    createdAt: readString(record, ['createdAt'], ''),
    updatedAt: readString(record, ['updatedAt'], ''),
  }
}

/**
 * 归一化地块
 * @param raw 后端原始记录
 * @returns Plot
 */
export function normalizePlot(raw: unknown): Plot {
  const record = asRecord(raw)
  return {
    plotId: readString(record, ['plotId', 'id'], ''),
    plotCode: readString(record, ['plotCode'], '-'),
    plotName: readString(record, ['plotName'], '未命名地块'),
    farmId: readString(record, ['farmId'], ''),
    farmName: readString(record, ['farmName'], ''),
    area: readNumber(record, ['area'], 0),
    // 2026-10-17：plot 表里没有 planting_type 列，后端从不返回该字段。
    // 原来默认给 1，列表/看板于是把每块地都显示成「露天」—— 现在没有就不给，界面显示「—」。
    plantingType: (readNumber(record, ['plantingType'], Number.NaN) || undefined) as Plot['plantingType'],
    soilType: readString(record, ['soilType'], '-'),
    irrigationType: readString(record, ['irrigationType'], '-'),
    cropId: readString(record, ['cropId'], ''),
    currentCrop: readString(record, ['currentCrop'], ''),
    cropVariety: readString(record, ['cropVariety'], ''),
    currentPlanId: readString(record, ['currentPlanId'], ''),
    // 后端真实的列叫 boundary；geoBoundary 是历史前端自造的键（后端从不返回），
    // 两个都认是为了兼容老响应，但优先取 boundary。
    geoBoundary: readString(record, ['geoBoundary', 'boundary'], ''),
    centerLongitude: readNumber(record, ['centerLongitude'], Number.NaN) || undefined,
    centerLatitude: readNumber(record, ['centerLatitude'], Number.NaN) || undefined,
    boundary: readString(record, ['boundary'], ''),
    status: (readNumber(record, ['status'], 1) as Plot['status']),
    createdAt: readString(record, ['createdAt'], ''),
    updatedAt: readString(record, ['updatedAt'], ''),
  }
}

/* ==================== 看板总览（只承载后端真实返回的指标） ==================== */

/**
 * 总览指标字段 → 中文名。
 *
 * 仅用于「后端未提供该指标数据源」的可见提示文案，不参与任何取值兜底。
 */
export const OVERVIEW_METRIC_LABELS: Record<string, string> = {
  metricCount: '已接入指标数',
  yieldTotal: '累计产量',
  passRate: '检测合格率',
  avgCostPerMu: '亩均生产成本',
  farmCount: '农场数量',
  plotCount: '地块数量',
  plantingArea: '在田面积',
  runningPlanCount: '进行中计划数',
  pendingTaskCount: '待办任务数',
  monthTaskTotal: '本月任务总数',
  monthTaskDone: '本月已完成任务数',
  taskCompletionRate: '本月任务完成率',
  alertCount: '未处理告警数',
  monthHarvestQty: '本月采收量',
  activeDeviceCount: '在线设备数',
  cropCount: '在田作物种类数',
  traceCodeCount: '溯源码总量',
}

/**
 * 总览指标字段 → 后端候选键名。
 *
 * 后端 `GET /analytics/overview` 目前返回 `prod_analytics_snapshot` 的
 * `metricCode → metricValue` 映射（种子数据里是 YIELD / PASS_RATE / COST），
 * 因此这里同时兼容大写下划线与驼峰两种键名；**命中不到就是没有这个数据源**。
 */
const OVERVIEW_METRIC_KEYS: Record<string, string[]> = {
  metricCount: ['metricCount', 'METRIC_COUNT'],
  yieldTotal: ['yieldTotal', 'YIELD'],
  passRate: ['passRate', 'PASS_RATE'],
  avgCostPerMu: ['avgCostPerMu', 'COST'],
  farmCount: ['farmCount', 'farmTotal', 'FARM_COUNT'],
  plotCount: ['plotCount', 'plotTotal', 'PLOT_COUNT'],
  plantingArea: ['plantingArea', 'plantingAreaMu', 'PLANTING_AREA'],
  runningPlanCount: ['runningPlanCount', 'RUNNING_PLAN_COUNT'],
  pendingTaskCount: ['pendingTaskCount', 'todoTaskCount', 'PENDING_TASK_COUNT'],
  monthTaskTotal: ['monthTaskTotal', 'monthTaskCount', 'MONTH_TASK_TOTAL'],
  monthTaskDone: ['monthTaskDone', 'monthCompletedTaskCount', 'MONTH_TASK_DONE'],
  taskCompletionRate: ['taskCompletionRate', 'TASK_COMPLETION_RATE'],
  alertCount: ['alertCount', 'unhandledAlertCount', 'ALERT_COUNT'],
  monthHarvestQty: ['monthHarvestQty', 'MONTH_HARVEST_QTY'],
  activeDeviceCount: ['activeDeviceCount', 'deviceOnline', 'ACTIVE_DEVICE_COUNT'],
  cropCount: ['cropCount', 'cropVarietyCount', 'CROP_COUNT'],
  traceCodeCount: ['traceCodeCount', 'traceTotal', 'TRACE_CODE_COUNT'],
}

/**
 * 读取数字；后端未返回该字段时返回 null（**绝不回落示例值 / 0 / 随机数**）。
 *
 * @param source 数据来源
 * @param keys 候选字段名
 * @returns 数字；字段缺失或非法返回 null
 */
export function readNumberOrNull(source: unknown, keys: string[]): number | null {
  const value = readValue(source, keys)
  if (value === undefined) return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** 看板总览视图模型（每个指标都可能为 null，表示后端暂无该数据源） */
export interface DashboardOverview {
  /** 后端已接入的指标条数 */
  metricCount: number | null
  /** 累计产量（kg，metricCode=YIELD） */
  yieldTotal: number | null
  /** 检测合格率（%，metricCode=PASS_RATE） */
  passRate: number | null
  /** 亩均生产成本（元/亩，metricCode=COST） */
  avgCostPerMu: number | null
  /** 农场数量 */
  farmCount: number | null
  /** 地块数量 */
  plotCount: number | null
  /** 在田面积（亩） */
  plantingArea: number | null
  /** 进行中计划数 */
  runningPlanCount: number | null
  /** 待办任务数 */
  pendingTaskCount: number | null
  /** 本月任务总数 */
  monthTaskTotal: number | null
  /** 本月已完成任务数 */
  monthTaskDone: number | null
  /** 本月任务完成率（%） */
  taskCompletionRate: number | null
  /** 未处理告警数 */
  alertCount: number | null
  /** 本月采收量（kg） */
  monthHarvestQty: number | null
  /** 在线设备数 */
  activeDeviceCount: number | null
  /** 后端尚未接入的指标（原始响应里连字段都没有），与「已接入但当前无数据」是两回事 */
  unwiredFields: string[]
  /** 后端已接入、但当前确实无数据（字段存在且为 null） */
  emptyFields: string[]
  /** 在田作物种类数 */
  cropCount: number | null
  /** 溯源码总量 */
  traceCodeCount: number | null
  /** 后端未提供数据源的指标中文名清单（页面据此展示可见提示） */
  missingFields: string[]
  /** 总览接口本次是否可用（false = 请求失败 / 后端不可达，页面须显式告知） */
  available: boolean
}

/**
 * 将后端返回值映射为看板总览。
 *
 * 纪律：后端没有的字段一律为 null，**不做任何示例值回填**。
 * 调用方必须把 null 渲染成「— / 未接入」并给出可见提示，不许当成 0 展示。
 *
 * @param raw 后端返回（对象形态不限）；传 null 表示本次请求不可用
 * @param available 接口是否可用
 * @returns DashboardOverview
 */
export function buildOverview(raw: unknown, available = true): DashboardOverview {
  const record = asRecord(raw)
  const pick = (field: string): number | null =>
    readNumberOrNull(record, OVERVIEW_METRIC_KEYS[field] ?? [field])

  const metricCount = pick('metricCount')
  const yieldTotal = pick('yieldTotal')
  const passRate = pick('passRate')
  const avgCostPerMu = pick('avgCostPerMu')
  const farmCount = pick('farmCount')
  const plotCount = pick('plotCount')
  const plantingArea = pick('plantingArea')
  const runningPlanCount = pick('runningPlanCount')
  const pendingTaskCount = pick('pendingTaskCount')
  const monthTaskTotal = pick('monthTaskTotal')
  const monthTaskDone = pick('monthTaskDone')
  const taskCompletionRate = pick('taskCompletionRate')
  const alertCount = pick('alertCount')
  const monthHarvestQty = pick('monthHarvestQty')
  const activeDeviceCount = pick('activeDeviceCount')
  const cropCount = pick('cropCount')
  const traceCodeCount = pick('traceCodeCount')

  const pairs: [string, number | null][] = [
    ['metricCount', metricCount],
    ['yieldTotal', yieldTotal],
    ['passRate', passRate],
    ['avgCostPerMu', avgCostPerMu],
    ['farmCount', farmCount],
    ['plotCount', plotCount],
    ['plantingArea', plantingArea],
    ['runningPlanCount', runningPlanCount],
    ['pendingTaskCount', pendingTaskCount],
    ['monthTaskTotal', monthTaskTotal],
    ['monthTaskDone', monthTaskDone],
    ['taskCompletionRate', taskCompletionRate],
    ['alertCount', alertCount],
    ['monthHarvestQty', monthHarvestQty],
    ['activeDeviceCount', activeDeviceCount],
    ['cropCount', cropCount],
    ['traceCodeCount', traceCodeCount],
  ]

  return {
    metricCount,
    yieldTotal,
    passRate,
    avgCostPerMu,
    farmCount,
    plotCount,
    plantingArea,
    runningPlanCount,
    pendingTaskCount,
    monthTaskTotal,
    monthTaskDone,
    taskCompletionRate,
    alertCount,
    monthHarvestQty,
    activeDeviceCount,
    cropCount,
    traceCodeCount,
    missingFields: pairs
      .filter(([, value]) => value === null)
      .map(([field]) => OVERVIEW_METRIC_LABELS[field] ?? field),
    // 区分两种「显示为 —」：字段缺失（后端未接入） vs 字段存在但为 null（已接入、当前无数据）。
    //
    // 判据必须用 hasOwnProperty 直接看**原始响应有没有这个键**，不能用 readValue：
    // 实测 readValue 对「键存在且值为 null」同样返回 undefined，会把两类都误判成「未接入」。
    unwiredFields: pairs
      .filter(([field, value]) => value === null
        && !hasOverviewKey(record, field))
      .map(([field]) => OVERVIEW_METRIC_LABELS[field] ?? field),
    emptyFields: pairs
      .filter(([field, value]) => value === null
        && hasOverviewKey(record, field))
      .map(([field]) => OVERVIEW_METRIC_LABELS[field] ?? field),
    available,
  }
}

/**
 * 原始响应里是否存在该指标的任一候选字段名（含值为 null 的情况）。
 *
 * 用途：区分「后端未接入」（键不存在）与「已接入但当前无数据」（键存在且为 null）。
 *
 * @param record 原始响应对象
 * @param field  归一化字段名
 * @returns 命中任一候选字段名时为 true
 */
function hasOverviewKey(record: Record<string, unknown>, field: string): boolean {
  return (OVERVIEW_METRIC_KEYS[field] ?? [field]).some((key) =>
    Object.prototype.hasOwnProperty.call(record, key),
  )
}

/**
 * 指标值展示文案：null 显示为「—」（区别于真实数值 0）。
 *
 * @param value 指标值
 * @param precision 小数位
 * @param suffix 单位后缀
 * @returns 展示文案
 */
export function metricText(value: number | null, precision = 0, suffix = ''): string {
  if (value === null) return '—'
  return `${value.toLocaleString('zh-CN', {
    minimumFractionDigits: precision,
    maximumFractionDigits: precision,
  })}${suffix}`
}

/** 指标值缺失时的统一提示文案 */
export const MISSING_METRIC_TIP = '后端暂无该指标数据源，显示为「—」，接口补齐后自动填充'

/**
 * 计算两个日期间按天展开的日期数组（含首尾）
 * @param startDate 开始日期
 * @param endDate 结束日期
 * @returns 日期数组
 */
export function expandDateRange(startDate: string, endDate: string): string[] {
  const start = dayjs(startDate)
  const end = dayjs(endDate)
  if (!start.isValid() || !end.isValid() || end.isBefore(start)) return []
  const result: string[] = []
  let cursor = start
  while (!cursor.isAfter(end)) {
    result.push(cursor.format('YYYY-MM-DD'))
    cursor = cursor.add(1, 'day')
  }
  return result
}

/** 排行条目 */
export interface RankItem {
  /** 名称 */
  name: string
  /** 数值 */
  value: number
}

/**
 * 按真实投入品使用记录聚合「消耗排行」。
 *
 * ⚠️ 键名口径（代码级比对结论，勿改回 `quantity`）：
 * 后端 `prod_input_usage` 实体与建表列都是 **`dosage`**（InputUsageEntity.dosage），
 * 前端 `InputUsage` 类型里写的却是 `quantity`——两者**对不上**。
 * 若按 `quantity` 读取，每条记录都取到 undefined，`|| 0` 之后排行全为 0，
 * 图表会渲染出一排「看起来正常、值全是 0」的柱条，比保留兜底更难发现。
 * 因此这里优先读 `dosage`，`quantity` 仅作为前向兼容的备选键。
 *
 * ⚠️ 单位口径：不同记录的 `unit` 可能不同（kg / 袋 / L），跨单位相加没有意义，
 * 所以按「投入品名称 + 单位」分组，分组名里带上单位，不做跨单位累加。
 *
 * @param usages 投入品使用记录（后端原始或已归一化的对象均可）
 * @param topN 取前 N 条，缺省 5
 * @returns 排行条目（name 形如「腐熟有机肥(kg)」）
 */
export function aggregateInputRanking(usages: unknown[], topN = 5): RankItem[] {
  const buckets = new Map<string, number>()
  for (const item of usages) {
    const record = asRecord(item)
    const name = readString(record, ['inputName', 'input_name'], '') || readString(record, ['inputId', 'input_id'], '') || '未命名投入品'
    const unit = readString(record, ['unit'], '') || '无单位'
    const amount = readNumberOrNull(record, ['dosage', 'quantity'])
    if (amount === null) continue
    const key = `${name}(${unit})`
    buckets.set(key, (buckets.get(key) ?? 0) + amount)
  }
  return Array.from(buckets.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN)
}

/**
 * 计算种养计划时间进度百分比
 * @param plan 计划
 * @returns 0-100 的进度值
 */
export function calcPlanProgress(plan: Plan): number {
  const start = dayjs(plan.startDate)
  const end = dayjs(plan.endDate)
  if (!start.isValid() || !end.isValid()) return 0
  if (plan.status === 3) return 100
  const total = end.diff(start, 'day') + 1
  if (total <= 0) return 0
  const passed = Math.min(total, Math.max(0, dayjs().diff(start, 'day') + 1))
  return Math.min(100, Math.round((passed / total) * 100))
}

/**
 * 数字千分位格式化
 * @param value 数值
 * @param fractionDigits 小数位
 * @returns 格式化字符串
 */
export function formatNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return '-'
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })
}

/**
 * 格式化面积（亩）为**最多 2 位小数、不补零**的数字串（不含单位）。

 *
 * <p>为什么不直接用 {@link formatNumber}：它的 fractionDigits 同时是 min 与 max ——
 * 传 0 会把 88.5 显示成 89（用户填进去的数与看到的数对不上，实测于计划面积），
 * 传 2 又会把整数面积补成 88.00。面积属于"填多少就该看到多少"的量，
 * 所以这里按"最多 2 位"处理。</p>
 *
 * @param value 面积数值（亩），可为 null / undefined / 非有限数
 * @returns 格式化后的数字串；取不到时返回 '-'
 */
export function formatAreaNumber(value: number | null | undefined): string {
  const num = Number(value)
  if (value === null || value === undefined || !Number.isFinite(num)) return '-'
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}
