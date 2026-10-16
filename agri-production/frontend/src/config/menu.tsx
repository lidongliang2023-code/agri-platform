/**
 * 侧边栏菜单配置
 *
 * 用户端按 PRD 一级模块分组，并补充原型独有的「生长监测与IoT」分组；
 * （2026-10-16 调整：原「智能种养计划」与「农事任务管理」合并为一级菜单「智能种养」——
 *   两者是同一条业务链，详见该分组上的注释。分组数不再等于 PRD 模块数。）
 *
 * 运营端按 PRD 一级模块 + 原型补充的「食品安全」「AI与知识中心」两个分组组织。
 * 本文件是「菜单 - 路由」的唯一映射源，布局与面包屑均从此派生。
 * 说明：create / detail 类子页面由列表页跳转进入，仅注册路由、不出现在菜单中，
 * 因此「菜单叶子数」天然小于「路由页面总数」，两者均为派生值，见文件末尾计数常量。
 * 一致性保障：每个菜单 key 必须能在路由表中命中，由 scripts/check-menu-route-map.mjs 硬校验。
 */
import {
  AlertOutlined,
  ApiOutlined,
  AuditOutlined,
  BarChartOutlined,
  BlockOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  HomeOutlined,
  InboxOutlined,
  LineChartOutlined,
  MonitorOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import type { ReactNode } from 'react'

/** 菜单叶子节点 */
export interface MenuLeaf {
  /** 唯一 key，取值与路由路径一致 */
  key: string
  /** 菜单名称 */
  label: string
}

/** 菜单分组（对应一级模块） */
export interface MenuGroup {
  /** 分组 key */
  key: string
  /** 分组名称 */
  label: string
  /** 分组图标 */
  icon: ReactNode
  /** 分组下的页面 */
  children: MenuLeaf[]
}

/** 用户端菜单（PRD 十二个一级模块 + 原型补充的「生长监测与IoT」分组） */
export const USER_MENU: MenuGroup[] = [
  {
    key: 'dashboard',
    label: '首页看板',
    icon: <DashboardOutlined />,
    children: [
      { key: '/production/dashboard', label: '生产数据看板' },
      { key: '/production/dashboard/production', label: '生产驾驶舱' },
      { key: '/production/messages', label: '消息中心' },
    ],
  },
  {
    key: 'farm',
    label: '农场数字化管理',
    icon: <HomeOutlined />,
    children: [
      { key: '/production/farms', label: '农场列表' },
      { key: '/production/plots', label: '地块管理' },
      { key: '/production/members', label: '团队与人员' },
      { key: '/production/members/roles', label: '角色与权限' },
    ],
  },
  {
    // 2026-10-16 合并：原「智能种养计划」+「农事任务管理」两个一级菜单。
    // 两者本来就是一条链上的东西 —— 计划定阶段 → 阶段生成任务 → 任务回填计划进度，
    // 页面之间互相跳（计划详情里就是任务列表、农事日历里"任务"与"计划阶段"并列展示）。
    // 拆成两个一级菜单只会让"计划 ↔ 任务"的来回切换要跨菜单找。
    //
    // 叶子路径与数量都没变（5 条），所以 USER_MENU_LEAF_COUNT 与菜单↔路由校验不受影响；
    // 面包屑读的是 group.label（buildBreadcrumb），这两组页面下一律显示「智能种养」。
    key: 'smart-farming',
    label: '智能种养',
    icon: <CalendarOutlined />,
    children: [
      { key: '/production/plans', label: '种养计划列表' },
      { key: '/production/plans/calendar', label: '农事日历' },
      // 2026-10-16：改名为「农事任务」；「创建任务」入口撤掉（新建走列表页的按钮，
      // 不占一级菜单的一个叶子 —— 与 /production/farms/create、/production/plots/create 同处理）。
      { key: '/production/tasks', label: '农事任务' },
      { key: '/production/tasks/templates', label: '任务模板库' },
    ],
  },
  {
    key: 'input',
    label: '农资投入品管理',
    icon: <ExperimentOutlined />,
    children: [
      { key: '/production/inputs', label: '投入品台账' },
      { key: '/production/inputs/ledger', label: '投入品使用台账' },
      { key: '/production/inputs/stock', label: '出入库管理' },
      { key: '/production/inputs/usages', label: '使用记录' },
    ],
  },
  {
    key: 'growth',
    label: '生长监测预警',
    icon: <LineChartOutlined />,
    children: [
      { key: '/production/growth', label: '生长监测总览' },
      { key: '/production/growth/records', label: '生长记录' },
      { key: '/production/growth/environment', label: '环境数据' },
      { key: '/production/alerts', label: '告警中心' },
      { key: '/production/alerts/rules', label: '告警规则配置' },
    ],
  },
  {
    key: 'iot',
    label: 'IoT设备管理',
    icon: <ApiOutlined />,
    children: [
      { key: '/production/iot', label: '设备列表' },
      { key: '/production/iot/bindings', label: '设备绑定管理' },
    ],
  },
  {
    key: 'monitor',
    label: '生长监测与IoT',
    icon: <MonitorOutlined />,
    children: [{ key: '/production/monitor', label: '生产监控看板' }],
  },
  {
    key: 'harvest',
    label: '采收库存管理',
    icon: <InboxOutlined />,
    children: [
      { key: '/production/harvests/plan', label: '地块采收记录' },
      { key: '/production/harvests', label: '采收记录' },
      { key: '/production/harvests/inventory', label: '库存管理' },
    ],
  },
  {
    key: 'quality',
    label: '质量检测与溯源',
    icon: <SafetyCertificateOutlined />,
    children: [
      { key: '/production/quality', label: '质量检测管理' },
      { key: '/production/quality/grading', label: '质量分级管理' },
      { key: '/production/trace', label: '溯源码管理' },
      { key: '/production/trace/full-chain', label: '生产全链路溯源' },
      { key: '/production/trace/reports', label: '溯源报告' },
    ],
  },
  {
    key: 'blockchain',
    label: '区块链增强',
    icon: <BlockOutlined />,
    children: [
      { key: '/production/blockchain', label: '区块链概览' },
      { key: '/production/blockchain/records', label: '上链记录' },
      { key: '/production/blockchain/verify', label: '存证验证' },
    ],
  },
  {
    key: 'ai',
    label: '智能决策中心',
    icon: <RobotOutlined />,
    children: [
      { key: '/production/ai/pest-detection', label: '病虫害识别' },
      { key: '/production/ai/assistant', label: 'AI问答助手' },
      { key: '/production/ai/yield-forecast', label: '产量预测' },
    ],
  },
  {
    key: 'analytics',
    label: '报表与设置',
    icon: <BarChartOutlined />,
    children: [
      { key: '/production/analytics', label: '数据分析总览' },
      { key: '/production/analytics/reports', label: '生产报表' },
      { key: '/production/settings', label: '系统设置' },
    ],
  },
]

/** 运营端菜单（PRD 八个一级模块 + 原型补充的「食品安全」「AI与知识中心」分组）
 *
 * 说明：原「SOP与知识库」分组已撤销，其下的 SOP 与知识库页面并入「AI与知识中心」。
 */
export const ADMIN_MENU: MenuGroup[] = [
  {
    key: 'ops-dashboard',
    label: '运营仪表盘',
    icon: <DashboardOutlined />,
    children: [
      { key: '/admin/production/dashboard', label: '运营管理大盘' },
      { key: '/admin/production/dashboard/overview', label: '生产总览' },
      { key: '/admin/production/dashboard/screen', label: '数据大屏驾驶舱' },
    ],
  },
  {
    key: 'tenant',
    label: '租户管理',
    icon: <TeamOutlined />,
    children: [
      { key: '/admin/production/tenants', label: '租户列表' },
      { key: '/admin/production/tenants/quotas', label: '配额管理' },
      { key: '/admin/production/tenants/segments', label: '租户分层运营' },
    ],
  },
  {
    key: 'farm-supervision',
    label: '农场监管',
    icon: <HomeOutlined />,
    children: [
      { key: '/admin/production/farms', label: '农场监管列表' },
      { key: '/admin/production/farms/map', label: 'GIS地图监管' },
      { key: '/admin/production/farms/compliance', label: '合规检查' },
    ],
  },
  {
    // 基础数据：生产域的主数据由**平台运营**维护（2026-10-16 口径）。
    // 农户在用户端只做选择（计划 / 地块的作物下拉），没有维护入口。
    key: 'base-data',
    label: '基础数据',
    icon: <DatabaseOutlined />,
    children: [{ key: '/admin/production/crops', label: '作物管理' }],
  },
  {
    key: 'monitor',
    label: '生产监控',
    icon: <MonitorOutlined />,
    children: [
      { key: '/admin/production/monitor', label: '生产监控中心' },
      { key: '/admin/production/monitor/tasks', label: '任务执行监控' },
      { key: '/admin/production/monitor/iot', label: 'IoT设备监控' },
      { key: '/admin/production/monitor/inputs', label: '投入品使用监管' },
      { key: '/admin/production/monitor/environment', label: '环境数据监控' },
    ],
  },
  {
    key: 'trace',
    label: '质量追溯管理',
    icon: <SafetyCertificateOutlined />,
    children: [
      { key: '/admin/production/trace', label: '溯源管理总览' },
      { key: '/admin/production/trace/codes', label: '溯源码管理' },
      { key: '/admin/production/quality/labs', label: '检测机构管理' },
      { key: '/admin/production/quality/recalls', label: '不合格品处置' },
      { key: '/admin/production/quality/inspections', label: '检测报告管理' },
    ],
  },
  {
    key: 'food-safety',
    label: '食品安全',
    icon: <SafetyOutlined />,
    children: [
      { key: '/admin/production/food-safety', label: '食品安全监控中心' },
      { key: '/admin/production/food-safety/circulation', label: '流通异常检测' },
      { key: '/admin/production/food-safety/compliance', label: '合规校验管理' },
      { key: '/admin/production/food-safety/trust-label', label: '可信农产品管理' },
      { key: '/admin/production/food-safety/cold-chain', label: '冷链资源撮合' },
    ],
  },
  {
    key: 'ai-center',
    label: 'AI与知识中心',
    icon: <RobotOutlined />,
    children: [
      { key: '/admin/production/ai/models', label: 'AI模型管理' },
      { key: '/admin/production/knowledge', label: 'AI知识库' },
      { key: '/admin/production/sop', label: 'SOP管理' },
    ],
  },
  {
    key: 'approval',
    label: '审批管理',
    icon: <AuditOutlined />,
    children: [
      { key: '/admin/production/approvals', label: '待审批列表' },
      { key: '/admin/production/approvals/history', label: '审批历史' },
      { key: '/admin/production/approvals/config', label: '审批流程配置' },
    ],
  },
  {
    key: 'alert',
    label: '异常告警处理',
    icon: <AlertOutlined />,
    children: [
      { key: '/admin/production/alerts', label: '告警中心' },
      { key: '/admin/production/alerts/emergency', label: '应急预案' },
      { key: '/admin/production/alerts/review', label: '灾害事件复盘' },
    ],
  },
  {
    key: 'report',
    label: '统计报表',
    icon: <BarChartOutlined />,
    children: [
      { key: '/admin/production/reports', label: '报表中心' },
      { key: '/admin/production/reports/production', label: '生产报表' },
      { key: '/admin/production/reports/quality', label: '质量报表' },
    ],
  },
]

/* ==================== 菜单条数（全部从菜单配置派生，禁止写死） ==================== */

/**
 * 统计一组菜单分组下的叶子节点数
 * @param groups 菜单分组
 * @returns 叶子节点数量
 */
function countLeaves(groups: MenuGroup[]): number {
  return groups.reduce((sum, group) => sum + group.children.length, 0)
}

/** 用户端菜单叶子数（从 USER_MENU 派生） */
export const USER_MENU_LEAF_COUNT: number = countLeaves(USER_MENU)

/** 运营端菜单叶子数（从 ADMIN_MENU 派生） */
export const ADMIN_MENU_LEAF_COUNT: number = countLeaves(ADMIN_MENU)

/** 菜单叶子总数（用户端 + 运营端，从菜单配置派生） */
export const MENU_LEAF_COUNT: number = USER_MENU_LEAF_COUNT + ADMIN_MENU_LEAF_COUNT

/** 菜单匹配结果 */
export interface MenuMatch {
  /** 命中的一级模块 */
  group: MenuGroup
  /** 命中的叶子节点 */
  leaf: MenuLeaf
}

/**
 * 根据当前路径匹配菜单项，采用「最长前缀匹配」以支持详情子路径高亮。
 * @param pathname 当前路由路径
 * @param groups 菜单分组
 * @returns 匹配结果，未命中返回 null
 */
export function matchMenu(pathname: string, groups: MenuGroup[]): MenuMatch | null {
  let best: MenuMatch | null = null
  let bestLength = -1
  for (const group of groups) {
    for (const leaf of group.children) {
      if (pathname === leaf.key || pathname.startsWith(`${leaf.key}/`)) {
        if (leaf.key.length > bestLength) {
          bestLength = leaf.key.length
          best = { group, leaf }
        }
      }
    }
  }
  return best
}

/**
 * 生成面包屑层级。
 * @param pathname 当前路由路径
 * @param groups 菜单分组
 * @returns 面包屑文案数组，顺序为 [根, 一级模块, 页面, (详情)]
 */
export function buildBreadcrumb(pathname: string, groups: MenuGroup[]): string[] {
  const matched = matchMenu(pathname, groups)
  if (!matched) {
    return ['首页']
  }
  const trail = ['首页', matched.group.label, matched.leaf.label]
  if (pathname.length > matched.leaf.key.length) {
    trail.push('详情')
  }
  return trail
}
