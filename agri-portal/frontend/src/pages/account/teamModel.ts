export interface ProductionRole {
  roleId: string
  roleCode: string
  roleName: string
  description: string | null
  permissions: string[]
  dataScope: string
  builtIn: boolean
  memberCount: number
}

export interface TeamMember {
  id: number
  memberId: string
  userId: string | null
  realName: string
  phone: string
  farmId: string | null
  position: string | null
  memberType: string
  roleCode: string | null
  status: number
  joinedAt: string | null
}

export const MEMBER_TYPES = [
  { value: 'OWNER', label: '负责人' },
  { value: 'AGRONOMIST', label: '农艺师' },
  { value: 'INSPECTOR', label: '质检员' },
  { value: 'OPERATOR', label: '作业操作员' },
]

export const DATA_SCOPES = [
  { value: 'SELF', label: '仅本人数据' },
  { value: 'PLOT', label: '被分配地块' },
  { value: 'FARM', label: '所属农场' },
  { value: 'TENANT', label: '本主体全部' },
]

export interface PermissionGroup {
  domain: string
  name: string
  actions: string[]
  resources: { code: string; name: string }[]
}

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    domain: 'produce', name: '生产管理', actions: ['view', 'create', 'update', 'delete', 'export'],
    resources: [
      { code: 'dashboard', name: '生产看板' }, { code: 'farm', name: '农场档案' },
      { code: 'plot', name: '地块档案' }, { code: 'member', name: '团队与成员' },
      { code: 'role', name: '角色与权限' }, { code: 'plan', name: '种养计划' },
      { code: 'task', name: '农事任务' }, { code: 'input', name: '投入品' },
      { code: 'growth', name: '生长监测' }, { code: 'alert', name: '告警管理' },
      { code: 'iot', name: 'IoT设备' }, { code: 'harvest', name: '采收库存' },
      { code: 'quality', name: '质量检测' }, { code: 'trace', name: '溯源管理' },
      { code: 'report', name: '统计报表' },
    ],
  },
  {
    domain: 'ai', name: '智能决策', actions: ['view', 'run'],
    resources: [
      { code: 'pest', name: '病虫害识别' }, { code: 'assistant', name: 'AI问答助手' },
      { code: 'forecast', name: '产量预测' },
    ],
  },
  {
    domain: 'chain', name: '区块链存证', actions: ['view', 'verify', 'submit'],
    resources: [
      { code: 'record', name: '存证记录' }, { code: 'batch', name: '批次存证' },
    ],
  },
  {
    domain: 'system', name: '系统设置', actions: ['view', 'update'],
    resources: [
      { code: 'setting', name: '参数配置' }, { code: 'message', name: '消息通知' },
    ],
  },
]

export const ACTION_LABELS: Record<string, string> = {
  view: '查看', create: '新增', update: '编辑', delete: '删除',
  export: '导出', run: '调用', verify: '验真', submit: '提交',
}

export const ALL_PERMISSION_CODES = PERMISSION_GROUPS.flatMap((group) =>
  group.resources.flatMap((resource) =>
    group.actions.map((action) => `${group.domain}.${resource.code}.${action}`)))

export const ROLE_TEMPLATES: Record<string, string[]> = {
  FARM_OWNER: ALL_PERMISSION_CODES,
  TENANT_ADMIN: [
    'produce.dashboard.view', 'produce.member.view', 'produce.member.create',
    'produce.member.update', 'produce.role.view', 'produce.role.update',
    'produce.report.view', 'produce.report.export', 'system.setting.view', 'system.setting.update',
  ],
  FARM_MANAGER: [
    'produce.dashboard.view', 'produce.farm.view', 'produce.farm.update',
    'produce.plot.view', 'produce.plot.update', 'produce.plan.view',
    'produce.plan.create', 'produce.task.view', 'produce.task.create',
    'produce.input.view', 'produce.harvest.view', 'produce.alert.view',
  ],
  AGRONOMIST: [
    'produce.plan.view', 'produce.plan.create', 'produce.task.view',
    'produce.growth.view', 'produce.quality.view', 'ai.pest.run',
    'ai.assistant.run', 'ai.forecast.run',
  ],
  WORKER: [
    'produce.task.view', 'produce.task.update', 'produce.input.view',
    'produce.growth.view', 'produce.harvest.view',
  ],
  FINANCE: [
    'produce.dashboard.view', 'produce.input.view', 'produce.harvest.view',
    'produce.report.view', 'produce.report.export',
  ],
}

export function roleLabel(code: string | null | undefined, roles: ProductionRole[]): string {
  if (!code) return '未分配'
  return roles.find((role) => role.roleCode === code)?.roleName || code
}
