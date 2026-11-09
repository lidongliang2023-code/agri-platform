/**
 * 侧边栏菜单配置
 *
 * 用户端按生产业务流程组织两级分类；
 * （2026-10-16 调整：原「农事生产」与「农事任务管理」合并为一级菜单「农事生产」——
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
  AuditOutlined,
  BarChartOutlined,
  CalendarOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  HomeOutlined,
  InboxOutlined,
  MonitorOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  SettingOutlined,
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

/** 用户端采用两级导航，按工作入口、生产作业、履约和分析配置组织；详情及新建由业务页进入。 */
export const USER_MENU: MenuGroup[] = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: <DashboardOutlined />,
    children: [
      { key: '/production/dashboard', label: '生产数据看板' },
      { key: '/production/messages', label: '消息中心' },
    ],
  },
  {
    key: 'farm',
    label: '农场与地块',
    icon: <HomeOutlined />,
    children: [
      { key: '/production/farms', label: '农场管理' },
      { key: '/production/plots', label: '地块管理' },
    ],
  },
  {
    key: 'smart-farming',
    label: '农事生产',
    icon: <CalendarOutlined />,
    children: [
      { key: '/production/plans', label: '农事计划' },
      { key: '/production/tasks', label: '农事任务' },
      { key: '/production/plans/calendar', label: '农事日历' },
    ],
  },
  {
    key: 'input',
    label: '农资管理',
    icon: <ExperimentOutlined />,
    children: [
      { key: '/production/inputs', label: '农资台账' },
    ],
  },
  {
    key: 'growth',
    label: '监测与设备',
    icon: <MonitorOutlined />,
    children: [
      { key: '/production/monitor', label: '生产监控看板' },
      { key: '/production/growth', label: '生长监测总览' },
      { key: '/production/growth/records', label: '生长记录' },
      { key: '/production/growth/environment', label: '环境数据' },
      { key: '/production/alerts', label: '告警处置与复盘' },
      { key: '/production/alerts/rules', label: '告警规则配置' },
      { key: '/production/iot', label: '设备列表' },
      { key: '/production/iot/bindings', label: '设备绑定管理' },
    ],
  },
  {
    key: 'harvest',
    label: '采收与库存',
    icon: <InboxOutlined />,
    children: [
      { key: '/production/harvests', label: '采收记录' },
      { key: '/production/harvests/inventory', label: '库存管理' },
    ],
  },
  {
    key: 'quality',
    label: '质量检测与溯源',
    icon: <SafetyCertificateOutlined />,
    children: [
      { key: '/production/quality', label: '质量检测与批次等级' },
      { key: '/production/process', label: '加工记录' },
      { key: '/production/trace', label: '单品溯源码管理' },
      { key: '/production/trace/full-chain', label: '生产溯源与报告' },
      { key: '/production/blockchain', label: '存证中心' },
    ],
  },
  {
    key: 'p2t',
    label: '产销对接',
    icon: <SwapOutlined />,
    children: [
      { key: '/production/p2t', label: '产销工作台' },
      { key: '/production/p2t/offers', label: '供给管理' },
      { key: '/production/p2t/subscriptions', label: '认购台账' },
      { key: '/production/p2t/diffs', label: '差异协同' },
      { key: '/production/p2t/trace', label: '供给与履约追踪' },
      { key: '/production/p2t/demand', label: '需求分析' },
    ],
  },
  {
    key: 'analytics',
    label: '分析与决策',
    icon: <BarChartOutlined />,
    children: [
      { key: '/production/analytics', label: '数据分析总览' },
      { key: '/production/analytics/reports', label: '生产报表' },
      { key: '/production/ai/assistant', label: '农事智能助手' },
    ],
  },
  {
    key: 'settings',
    label: '系统设置',
    icon: <SettingOutlined />,
    children: [
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
    children: [
      { key: '/admin/production/crops', label: '作物管理' },
      // 从用户端搬过来的任务模板库：与作物管理同属"运营维护、主体使用"的基础数据
      { key: '/admin/production/tasks/templates', label: '任务模板库' },
    ],
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
    label: '质量安全与溯源',
    icon: <SafetyCertificateOutlined />,
    children: [
      { key: '/admin/production/trace', label: '质量安全总览' },
      { key: '/admin/production/trace/codes', label: '单品溯源码管理' },
      { key: '/admin/production/quality/labs', label: '检测机构管理' },
      { key: '/admin/production/quality/recalls', label: '不合格品处置' },
      { key: '/admin/production/quality/inspections', label: '检测报告管理' },
      { key: '/admin/production/food-safety/circulation', label: '流通异常台账' },
      { key: '/admin/production/food-safety/compliance', label: '合规核验台账' },
      { key: '/admin/production/food-safety/trust-label', label: '产品认证台账' },
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
    // 产销对接不在运营端：意向发布与认领归经营主体自己（见用户端「产销对接」组），
    // 平台侧只保留下面的审批、差异兜底等治理动作。
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
      { key: '/admin/production/alerts', label: '告警处置与复盘' },
      { key: '/admin/production/alerts/emergency', label: '应急预案' },
    ],
  },
  {
    key: 'report',
    label: '统计报表',
    icon: <BarChartOutlined />,
    children: [
      { key: '/admin/production/reports', label: '生产与质量报表' },
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
