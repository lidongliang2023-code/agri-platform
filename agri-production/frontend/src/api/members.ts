/**
 * 团队与角色权限 API
 */
import { http } from '@/utils/request'
import type { PageQuery, PageResult } from '@/types'
import type { Member, Permission, Role } from '@/types'

const BASE = '/members'

/** 成员列表查询参数 */
export interface MemberListParams extends PageQuery {
  farmId?: string
  realName?: string
  phone?: string
  status?: number
  roleId?: string
}

/** 分页查询团队成员 */
export function listMembers(params: MemberListParams): Promise<PageResult<Member>> {
  return http.get<PageResult<Member>>(BASE, params)
}

/** 查询成员详情 */
export function getMember(memberId: string): Promise<Member> {
  return http.get<Member>(`${BASE}/${memberId}`)
}

/** 邀请 / 新增成员 */
export function createMember(payload: Partial<Member>): Promise<string> {
  return http.post<string>(BASE, payload)
}

/** 更新成员信息 */
export function updateMember(memberId: string, payload: Partial<Member>): Promise<Member> {
  return http.put<Member>(`${BASE}/${memberId}`, payload)
}

/** 移除成员 */
export function deleteMember(memberId: string): Promise<void> {
  return http.delete<void>(`${BASE}/${memberId}`)
}

/** 分页查询角色列表 */
export function listRoles(params: PageQuery & { roleName?: string }): Promise<PageResult<Role>> {
  return http.get<PageResult<Role>>(`${BASE}/roles`, params)
}

/** 查询角色详情 */
export function getRole(roleId: string): Promise<Role> {
  return http.get<Role>(`${BASE}/roles/${roleId}`)
}

/** 新增角色 */
export function createRole(payload: Partial<Role>): Promise<Role> {
  return http.post<Role>(`${BASE}/roles`, payload)
}

/** 更新角色 */
export function updateRole(roleId: string, payload: Partial<Role>): Promise<Role> {
  return http.put<Role>(`${BASE}/roles/${roleId}`, payload)
}

/** 删除角色 */
export function deleteRole(roleId: string): Promise<boolean> {
  return http.delete<boolean>(`${BASE}/roles/${roleId}`)
}

/** 查询权限树 */
export function listPermissions(): Promise<Permission[]> {
  return http.get<Permission[]>(`${BASE}/roles/permissions`)
}

/** 配置角色权限 */
export function assignRolePermissions(
  roleId: string,
  permissionIds: string[],
): Promise<boolean> {
  return http.put<boolean>(`${BASE}/roles/${roleId}/permissions`, { permissionIds })
}
