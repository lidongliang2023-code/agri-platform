/**
 * 团队成员 / 角色权限 / 消息 实体类型
 */
import type { EnableStatus } from './common'

/** 成员状态：1 在职 2 待激活 0 已停用 */
export type MemberStatus = 0 | 1 | 2

/** 团队成员 */
export interface Member {
  /** 成员 ID */
  memberId: string
  /** 用户 ID */
  userId: string
  /** 姓名 */
  realName: string
  /** 手机号 */
  phone: string
  /** 邮箱 */
  email?: string
  /** 头像地址 */
  avatar?: string
  /** 所属农场 ID */
  farmId?: string
  /** 所属部门 */
  department?: string
  /** 岗位 */
  position?: string
  /** 角色 ID 列表 */
  roleIds: string[]
  /** 角色名称列表（冗余） */
  roleNames?: string[]
  /** 状态：1 在职 2 待激活 0 已停用 */
  status: MemberStatus
  /** 加入时间 */
  joinedAt: string
}

/** 角色 */
export interface Role {
  /** 角色 ID */
  roleId: string
  /** 角色编码 */
  roleCode: string
  /** 角色名称 */
  roleName: string
  /** 角色描述 */
  description?: string
  /** 是否内置角色（内置不可删除） */
  isSystem: boolean
  /** 关联成员数量 */
  memberCount?: number
  /** 状态：1 正常 0 停用 */
  status: EnableStatus
  /** 创建时间 */
  createdAt: string
}

/** 权限点 */
export interface Permission {
  /** 权限 ID */
  permissionId: string
  /** 权限编码 */
  permissionCode: string
  /** 权限名称 */
  permissionName: string
  /** 父级权限 ID */
  parentId?: string
  /** 权限类型：1 菜单 2 按钮 3 接口 */
  permissionType: 1 | 2 | 3
  /** 子权限 */
  children?: Permission[]
}

/** 消息类型：1 系统通知 2 任务提醒 3 告警通知 4 审批通知 */
export type MessageType = 1 | 2 | 3 | 4

/** 站内消息 */
export interface MessageItem {
  /** 消息 ID */
  messageId: string
  /** 消息标题 */
  title: string
  /** 消息内容 */
  content: string
  /** 消息类型：1 系统通知 2 任务提醒 3 告警通知 4 审批通知 */
  messageType: MessageType
  /** 是否已读 */
  isRead: boolean
  /** 业务跳转路径 */
  linkPath?: string
  /** 业务 ID */
  bizId?: string
  /** 接收时间 */
  createdAt: string
  /** 阅读时间 */
  readAt?: string
}
