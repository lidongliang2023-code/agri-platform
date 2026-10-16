/**
 * 路由注册表（唯一路由配置源）
 *
 * 用户端挂 /production、运营端挂 /admin/production，**页面条数不再写死**：
 * 由本文件末尾的 USER_PAGE_COUNT / ADMIN_PAGE_COUNT / TOTAL_PAGE_COUNT 从路由表实时派生，
 * 增删页面后数字自动跟随，避免注释里的「57 / 39 / 96」与真实路由漂移。
 * 其中 75 页来自 PRD 6.1 / 6.2，另 21 页来自高保真原型补充页面（meta.prd 标记为「原型补充」，
 * 具体原型 pageId 见各页面文件顶部 JSDoc）。
 * 排序约定：同一层级下静态段路由必须排在动态段路由之前，
 * 例如 /production/harvests/plan 必须早于 /production/harvests/:xxx，
 * 以保证 React Router 优先命中静态段。
 */
import { lazy } from 'react'
import type { RouteObject } from 'react-router-dom'
import { Navigate } from 'react-router-dom'

/** 路由元信息 */
export interface RouteMeta {
  /** 页面名称 */
  name: string
  /** 完整路由路径 */
  path: string
  /** 所属一级模块 */
  module: string
  /** PRD 序号 */
  prd: string
}

/** 应用路由对象（在 react-router RouteObject 上扩展元信息） */
export type AppRoute = RouteObject & {
  /** 路由元信息 */
  meta?: RouteMeta
}

/* ==================== 用户端页面（条数见 USER_PAGE_COUNT） ==================== */
// 首页看板
const DashboardHome = lazy(() => import('@/pages/user/dashboard/DashboardHome'))
const ProductionCockpit = lazy(() => import('@/pages/user/dashboard/ProductionCockpit'))
const MessageCenter = lazy(() => import('@/pages/user/dashboard/MessageCenter'))
// 农场数字化管理
const FarmList = lazy(() => import('@/pages/user/farms/FarmList'))
const FarmDetail = lazy(() => import('@/pages/user/farms/FarmDetail'))
const FarmCreate = lazy(() => import('@/pages/user/farms/Create'))
const PlotList = lazy(() => import('@/pages/user/plots/PlotList'))
const PlotDetail = lazy(() => import('@/pages/user/plots/PlotDetail'))
const PlotCreate = lazy(() => import('@/pages/user/plots/Create'))
const PlotSoilRecords = lazy(() => import('@/pages/user/plots/PlotSoilRecords'))
const MemberList = lazy(() => import('@/pages/user/members/MemberList'))
const RoleList = lazy(() => import('@/pages/user/members/RoleList'))
// 智能种养计划
const PlanList = lazy(() => import('@/pages/user/plans/PlanList'))
const PlanDetail = lazy(() => import('@/pages/user/plans/PlanDetail'))
const PlanCalendar = lazy(() => import('@/pages/user/plans/PlanCalendar'))
// 农事任务管理
const TaskList = lazy(() => import('@/pages/user/tasks/TaskList'))
const TaskDetail = lazy(() => import('@/pages/user/tasks/TaskDetail'))
const TaskCreate = lazy(() => import('@/pages/user/tasks/TaskCreate'))
const TaskTemplates = lazy(() => import('@/pages/user/tasks/TaskTemplates'))
const TaskAcceptance = lazy(() => import('@/pages/user/tasks/TaskAcceptance'))
// 农资投入品管理
const InputList = lazy(() => import('@/pages/user/inputs/InputList'))
const InputCreate = lazy(() => import('@/pages/user/inputs/Create'))
const InputLedger = lazy(() => import('@/pages/user/inputs/Ledger'))
const InputDetail = lazy(() => import('@/pages/user/inputs/InputDetail'))
const InputStock = lazy(() => import('@/pages/user/inputs/InputStock'))
const InputUsages = lazy(() => import('@/pages/user/inputs/InputUsages'))
// 生长监测预警
const GrowthOverview = lazy(() => import('@/pages/user/growth/GrowthOverview'))
const GrowthRecords = lazy(() => import('@/pages/user/growth/GrowthRecords'))
const EnvironmentData = lazy(() => import('@/pages/user/growth/EnvironmentData'))
const AlertCenter = lazy(() => import('@/pages/user/alerts/AlertCenter'))
const AlertRules = lazy(() => import('@/pages/user/alerts/AlertRules'))
// IoT 设备管理
const DeviceList = lazy(() => import('@/pages/user/iot/DeviceList'))
const DeviceDetail = lazy(() => import('@/pages/user/iot/DeviceDetail'))
const DeviceBindings = lazy(() => import('@/pages/user/iot/DeviceBindings'))
// 生长监测与IoT
const MonitorDashboard = lazy(() => import('@/pages/user/monitor/Index'))
// 采收库存管理
const HarvestPlan = lazy(() => import('@/pages/user/harvests/HarvestPlan'))
const HarvestRecords = lazy(() => import('@/pages/user/harvests/HarvestRecords'))
const HarvestCreate = lazy(() => import('@/pages/user/harvests/Create'))
const HarvestDetail = lazy(() => import('@/pages/user/harvests/Detail'))
const InventoryManage = lazy(() => import('@/pages/user/harvests/InventoryManage'))
const InventoryCreate = lazy(() => import('@/pages/user/harvests/InventoryCreate'))
const InventoryDetail = lazy(() => import('@/pages/user/harvests/InventoryDetail'))
// 质量检测与溯源
const QualityInspection = lazy(() => import('@/pages/user/quality/QualityInspection'))
const QualityGrading = lazy(() => import('@/pages/user/quality/QualityGrading'))
const TraceCodeManage = lazy(() => import('@/pages/user/trace/TraceCodeManage'))
const FullChainTrace = lazy(() => import('@/pages/user/trace/FullChainTrace'))
const TraceReports = lazy(() => import('@/pages/user/trace/Reports'))
// 区块链增强
const BlockchainOverview = lazy(() => import('@/pages/user/blockchain/BlockchainOverview'))
const BlockchainRecords = lazy(() => import('@/pages/user/blockchain/BlockchainRecords'))
const BlockchainRecordDetail = lazy(() => import('@/pages/user/blockchain/RecordDetail'))
const BlockchainVerify = lazy(() => import('@/pages/user/blockchain/Verify'))
// 智能决策中心
const PestDetection = lazy(() => import('@/pages/user/ai/PestDetection'))
const AiAssistant = lazy(() => import('@/pages/user/ai/AiAssistant'))
const YieldForecast = lazy(() => import('@/pages/user/ai/YieldForecast'))
// 报表与设置
const AnalyticsOverview = lazy(() => import('@/pages/user/analytics/AnalyticsOverview'))
const ProductionReports = lazy(() => import('@/pages/user/analytics/ProductionReports'))
const SystemSettings = lazy(() => import('@/pages/user/settings/SystemSettings'))

/* ==================== 运营端页面（条数见 ADMIN_PAGE_COUNT） ==================== */
// 运营仪表盘
const OpsDashboard = lazy(() => import('@/pages/admin/dashboard/OpsDashboard'))
const OpsProductionOverview = lazy(() => import('@/pages/admin/dashboard/OpsProductionOverview'))
const OpsDataScreen = lazy(() => import('@/pages/admin/dashboard/OpsDataScreen'))
// 租户管理
const TenantList = lazy(() => import('@/pages/admin/tenants/TenantList'))
const TenantDetail = lazy(() => import('@/pages/admin/tenants/TenantDetail'))
const TenantQuotas = lazy(() => import('@/pages/admin/tenants/TenantQuotas'))
const TenantSegments = lazy(() => import('@/pages/admin/tenants/TenantSegments'))
// 农场监管
const FarmSupervisionList = lazy(() => import('@/pages/admin/farms/FarmSupervisionList'))
// 作物主数据维护（运营端）：2026-10-16 产品口径 —— 作物放在生产管理模块，但由**运营端**维护，
// 所以页面在 admin 侧、用户端只在下拉里选。
const CropMasterList = lazy(() => import('@/pages/admin/production/crops/CropList'))
const FarmSupervisionDetail = lazy(() => import('@/pages/admin/farms/FarmSupervisionDetail'))
const FarmGisMap = lazy(() => import('@/pages/admin/farms/FarmGisMap'))
const ComplianceCheck = lazy(() => import('@/pages/admin/farms/ComplianceCheck'))
// 生产监控
const MonitorCenter = lazy(() => import('@/pages/admin/monitor/MonitorCenter'))
const TaskMonitor = lazy(() => import('@/pages/admin/monitor/TaskMonitor'))
const IotMonitor = lazy(() => import('@/pages/admin/monitor/IotMonitor'))
const InputMonitor = lazy(() => import('@/pages/admin/monitor/InputMonitor'))
const MonitorEnvironment = lazy(() => import('@/pages/admin/monitor/Environment'))
// 质量追溯管理
const TraceOverview = lazy(() => import('@/pages/admin/trace/TraceOverview'))
const AdminTraceCodeManage = lazy(() => import('@/pages/admin/trace/AdminTraceCodeManage'))
const AdminTraceDetail = lazy(() => import('@/pages/admin/trace/Detail'))
const LabManage = lazy(() => import('@/pages/admin/quality/LabManage'))
const RecallManage = lazy(() => import('@/pages/admin/quality/RecallManage'))
const QualityInspections = lazy(() => import('@/pages/admin/quality/Inspections'))
// 食品安全
const FoodSafetyIndex = lazy(() => import('@/pages/admin/foodSafety/Index'))
const FoodSafetyCirculation = lazy(() => import('@/pages/admin/foodSafety/Circulation'))
const FoodSafetyCompliance = lazy(() => import('@/pages/admin/foodSafety/Compliance'))
const FoodSafetyTrustLabel = lazy(() => import('@/pages/admin/foodSafety/TrustLabel'))
const FoodSafetyColdChain = lazy(() => import('@/pages/admin/foodSafety/ColdChain'))
// AI中心
const AiModels = lazy(() => import('@/pages/admin/ai/Models'))
// 审批管理
const ApprovalPending = lazy(() => import('@/pages/admin/approvals/ApprovalPending'))
const ApprovalHistory = lazy(() => import('@/pages/admin/approvals/ApprovalHistory'))
const ApprovalConfig = lazy(() => import('@/pages/admin/approvals/ApprovalConfig'))
// 异常告警处理
const AdminAlertCenter = lazy(() => import('@/pages/admin/alerts/AdminAlertCenter'))
const EmergencyPlan = lazy(() => import('@/pages/admin/alerts/EmergencyPlan'))
const DisasterReview = lazy(() => import('@/pages/admin/alerts/DisasterReview'))
// SOP 与知识库
const SopLibrary = lazy(() => import('@/pages/admin/sop/SopLibrary'))
const KnowledgeBase = lazy(() => import('@/pages/admin/knowledge/KnowledgeBase'))
// 统计报表
const ReportCenter = lazy(() => import('@/pages/admin/reports/ReportCenter'))
const AdminProductionReport = lazy(() => import('@/pages/admin/reports/AdminProductionReport'))
const AdminQualityReport = lazy(() => import('@/pages/admin/reports/AdminQualityReport'))

/** 用户端路由（父级 /production），页面条数由下方 USER_PAGE_COUNT 派生 + 1 条索引重定向 */
export const USER_ROUTES: AppRoute[] = [
  {
    index: true,
    element: <Navigate to="/production/dashboard" replace />,
  },
  {
    path: 'dashboard',
    element: <DashboardHome />,
    meta: { name: '生产数据看板', path: '/production/dashboard', module: '首页看板', prd: 'PRD 6.1 #1' },
  },
  {
    path: 'dashboard/production',
    element: <ProductionCockpit />,
    meta: {
      name: '生产驾驶舱',
      path: '/production/dashboard/production',
      module: '首页看板',
      prd: 'PRD 6.1 #2',
    },
  },
  {
    path: 'messages',
    element: <MessageCenter />,
    meta: { name: '消息中心', path: '/production/messages', module: '首页看板', prd: 'PRD 6.1 #3' },
  },
  {
    path: 'farms',
    element: <FarmList />,
    meta: { name: '农场列表', path: '/production/farms', module: '农场数字化管理', prd: 'PRD 6.1 #4' },
  },
  {
    path: 'farms/create',
    element: <FarmCreate />,
    meta: {
      name: '新增农场',
      path: '/production/farms/create',
      module: '农场数字化管理',
      prd: '原型补充',
    },
  },
  {
    path: 'farms/:farmId',
    element: <FarmDetail />,
    meta: {
      name: '农场详情',
      path: '/production/farms/:farmId',
      module: '农场数字化管理',
      prd: 'PRD 6.1 #5',
    },
  },
  {
    path: 'plots',
    element: <PlotList />,
    meta: { name: '地块列表', path: '/production/plots', module: '农场数字化管理', prd: 'PRD 6.1 #6' },
  },
  {
    path: 'plots/create',
    element: <PlotCreate />,
    meta: {
      name: '新增地块',
      path: '/production/plots/create',
      module: '农场数字化管理',
      prd: '原型补充',
    },
  },
  {
    path: 'plots/:plotId',
    element: <PlotDetail />,
    meta: {
      name: '地块详情',
      path: '/production/plots/:plotId',
      module: '农场数字化管理',
      prd: 'PRD 6.1 #7',
    },
  },
  {
    path: 'plots/:plotId/soil',
    element: <PlotSoilRecords />,
    meta: {
      name: '土壤检测档案',
      path: '/production/plots/:plotId/soil',
      module: '农场数字化管理',
      prd: 'PRD 6.1 #8',
    },
  },
  {
    path: 'members',
    element: <MemberList />,
    meta: {
      name: '团队与人员',
      path: '/production/members',
      module: '农场数字化管理',
      prd: 'PRD 6.1 #9',
    },
  },
  {
    path: 'members/roles',
    element: <RoleList />,
    meta: {
      name: '角色与权限',
      path: '/production/members/roles',
      module: '农场数字化管理',
      prd: 'PRD 6.1 #10',
    },
  },
  {
    path: 'plans',
    element: <PlanList />,
    meta: {
      name: '种养计划列表',
      path: '/production/plans',
      module: '智能种养计划',
      prd: 'PRD 6.1 #11',
    },
  },
  {
    path: 'plans/calendar',
    element: <PlanCalendar />,
    meta: {
      name: '农事日历',
      path: '/production/plans/calendar',
      module: '智能种养计划',
      prd: 'PRD 6.1 #13',
    },
  },
  {
    path: 'plans/:planId',
    element: <PlanDetail />,
    meta: {
      name: '种养计划详情',
      path: '/production/plans/:planId',
      module: '智能种养计划',
      prd: 'PRD 6.1 #12',
    },
  },
  {
    path: 'tasks',
    element: <TaskList />,
    meta: { name: '任务列表', path: '/production/tasks', module: '农事任务管理', prd: 'PRD 6.1 #14' },
  },
  {
    path: 'tasks/create',
    element: <TaskCreate />,
    meta: {
      name: '创建任务',
      path: '/production/tasks/create',
      module: '农事任务管理',
      prd: 'PRD 6.1 #16',
    },
  },
  {
    path: 'tasks/templates',
    element: <TaskTemplates />,
    meta: {
      name: '任务模板库',
      path: '/production/tasks/templates',
      module: '农事任务管理',
      prd: 'PRD 6.1 #17',
    },
  },
  {
    path: 'tasks/:taskId',
    element: <TaskDetail />,
    meta: {
      name: '任务详情',
      path: '/production/tasks/:taskId',
      module: '农事任务管理',
      prd: 'PRD 6.1 #15',
    },
  },
  {
    path: 'tasks/:taskId/acceptance',
    element: <TaskAcceptance />,
    meta: {
      name: '任务验收',
      path: '/production/tasks/:taskId/acceptance',
      module: '农事任务管理',
      prd: 'PRD 6.1 #18',
    },
  },
  {
    path: 'inputs',
    element: <InputList />,
    meta: {
      name: '投入品台账',
      path: '/production/inputs',
      module: '农资投入品管理',
      prd: 'PRD 6.1 #19',
    },
  },
  {
    path: 'inputs/create',
    element: <InputCreate />,
    meta: {
      name: '新建投入品',
      path: '/production/inputs/create',
      module: '农资投入品管理',
      prd: '原型补充',
    },
  },
  {
    path: 'inputs/ledger',
    element: <InputLedger />,
    meta: {
      name: '投入品使用台账',
      path: '/production/inputs/ledger',
      module: '农资投入品管理',
      prd: '原型补充',
    },
  },
  {
    path: 'inputs/stock',
    element: <InputStock />,
    meta: {
      name: '出入库管理',
      path: '/production/inputs/stock',
      module: '农资投入品管理',
      prd: 'PRD 6.1 #21',
    },
  },
  {
    path: 'inputs/usages',
    element: <InputUsages />,
    meta: {
      name: '使用记录',
      path: '/production/inputs/usages',
      module: '农资投入品管理',
      prd: 'PRD 6.1 #22',
    },
  },
  {
    path: 'inputs/:inputId',
    element: <InputDetail />,
    meta: {
      name: '投入品详情',
      path: '/production/inputs/:inputId',
      module: '农资投入品管理',
      prd: 'PRD 6.1 #20',
    },
  },
  {
    path: 'growth',
    element: <GrowthOverview />,
    meta: {
      name: '生长监测总览',
      path: '/production/growth',
      module: '生长监测预警',
      prd: 'PRD 6.1 #23',
    },
  },
  {
    path: 'growth/records',
    element: <GrowthRecords />,
    meta: {
      name: '生长记录',
      path: '/production/growth/records',
      module: '生长监测预警',
      prd: 'PRD 6.1 #24',
    },
  },
  {
    path: 'growth/environment',
    element: <EnvironmentData />,
    meta: {
      name: '环境数据',
      path: '/production/growth/environment',
      module: '生长监测预警',
      prd: 'PRD 6.1 #25',
    },
  },
  {
    path: 'alerts',
    element: <AlertCenter />,
    meta: { name: '告警中心', path: '/production/alerts', module: '生长监测预警', prd: 'PRD 6.1 #26' },
  },
  {
    path: 'alerts/rules',
    element: <AlertRules />,
    meta: {
      name: '告警规则配置',
      path: '/production/alerts/rules',
      module: '生长监测预警',
      prd: 'PRD 6.1 #27',
    },
  },
  {
    path: 'iot',
    element: <DeviceList />,
    meta: { name: '设备列表', path: '/production/iot', module: 'IoT设备管理', prd: 'PRD 6.1 #28' },
  },
  {
    path: 'iot/bindings',
    element: <DeviceBindings />,
    meta: {
      name: '设备绑定管理',
      path: '/production/iot/bindings',
      module: 'IoT设备管理',
      prd: 'PRD 6.1 #30',
    },
  },
  {
    path: 'iot/:deviceId',
    element: <DeviceDetail />,
    meta: {
      name: '设备详情',
      path: '/production/iot/:deviceId',
      module: 'IoT设备管理',
      prd: 'PRD 6.1 #29',
    },
  },
  {
    path: 'monitor',
    element: <MonitorDashboard />,
    meta: {
      name: '生产监控看板',
      path: '/production/monitor',
      module: '生长监测与IoT',
      prd: '原型补充',
    },
  },
  {
    path: 'harvests/plan',
    element: <HarvestPlan />,
    meta: {
      // 后端 /harvests/plan 的语义是「按地块聚合采收记录」，不是采收计划，
      // 名称按真实语义对齐（采收计划功能后端尚未实现）。
      name: '地块采收记录',
      path: '/production/harvests/plan',
      module: '采收库存管理',
      prd: 'PRD 6.1 #31',
    },
  },
  {
    path: 'harvests',
    element: <HarvestRecords />,
    meta: {
      name: '采收记录',
      path: '/production/harvests',
      module: '采收库存管理',
      prd: 'PRD 6.1 #32',
    },
  },
  {
    path: 'harvests/create',
    element: <HarvestCreate />,
    meta: {
      name: '新建采收',
      path: '/production/harvests/create',
      module: '采收库存管理',
      prd: '原型补充',
    },
  },
  {
    path: 'harvests/inventory',
    element: <InventoryManage />,
    meta: {
      name: '库存管理',
      path: '/production/harvests/inventory',
      module: '采收库存管理',
      prd: 'PRD 6.1 #33',
    },
  },
  {
    path: 'harvests/inventory/create',
    element: <InventoryCreate />,
    meta: {
      name: '新增库存',
      path: '/production/harvests/inventory/create',
      module: '采收库存管理',
      prd: '原型补充',
    },
  },
  {
    path: 'harvests/inventory/:inventoryId',
    element: <InventoryDetail />,
    meta: {
      name: '库存详情',
      path: '/production/harvests/inventory/:inventoryId',
      module: '采收库存管理',
      prd: '原型补充',
    },
  },
  {
    path: 'harvests/:harvestId',
    element: <HarvestDetail />,
    meta: {
      name: '采收详情',
      path: '/production/harvests/:harvestId',
      module: '采收库存管理',
      prd: '原型补充',
    },
  },
  {
    path: 'quality',
    element: <QualityInspection />,
    meta: {
      name: '质量检测管理',
      path: '/production/quality',
      module: '质量检测与溯源',
      prd: 'PRD 6.1 #34',
    },
  },
  {
    path: 'quality/grading',
    element: <QualityGrading />,
    meta: {
      name: '质量分级管理',
      path: '/production/quality/grading',
      module: '质量检测与溯源',
      prd: 'PRD 6.1 #35',
    },
  },
  {
    path: 'trace',
    element: <TraceCodeManage />,
    meta: {
      name: '溯源码管理',
      path: '/production/trace',
      module: '质量检测与溯源',
      prd: 'PRD 6.1 #36',
    },
  },
  {
    path: 'trace/full-chain',
    element: <FullChainTrace />,
    meta: {
      name: '生产全链路溯源',
      path: '/production/trace/full-chain',
      module: '质量检测与溯源',
      prd: 'PRD 6.1 #37',
    },
  },
  {
    path: 'trace/reports',
    element: <TraceReports />,
    meta: {
      name: '溯源报告',
      path: '/production/trace/reports',
      module: '质量检测与溯源',
      prd: '原型补充',
    },
  },
  {
    path: 'blockchain',
    element: <BlockchainOverview />,
    meta: {
      name: '区块链概览',
      path: '/production/blockchain',
      module: '区块链增强',
      prd: 'PRD 6.1 #38',
    },
  },
  {
    path: 'blockchain/records',
    element: <BlockchainRecords />,
    meta: {
      name: '上链记录',
      path: '/production/blockchain/records',
      module: '区块链增强',
      prd: 'PRD 6.1 #39',
    },
  },
  {
    path: 'blockchain/records/:recordId',
    element: <BlockchainRecordDetail />,
    meta: {
      name: '存证详情',
      path: '/production/blockchain/records/:recordId',
      module: '区块链增强',
      prd: '原型补充',
    },
  },
  {
    path: 'blockchain/verify',
    element: <BlockchainVerify />,
    meta: {
      name: '存证验证',
      path: '/production/blockchain/verify',
      module: '区块链增强',
      prd: '原型补充',
    },
  },
  {
    path: 'ai/pest-detection',
    element: <PestDetection />,
    meta: {
      name: '病虫害识别',
      path: '/production/ai/pest-detection',
      module: '智能决策中心',
      prd: 'PRD 6.1 #40',
    },
  },
  {
    path: 'ai/assistant',
    element: <AiAssistant />,
    meta: {
      name: 'AI问答助手',
      path: '/production/ai/assistant',
      module: '智能决策中心',
      prd: 'PRD 6.1 #41',
    },
  },
  {
    path: 'ai/yield-forecast',
    element: <YieldForecast />,
    meta: {
      name: '产量预测',
      path: '/production/ai/yield-forecast',
      module: '智能决策中心',
      prd: 'PRD 6.1 #42',
    },
  },
  {
    path: 'analytics',
    element: <AnalyticsOverview />,
    meta: {
      name: '数据分析总览',
      path: '/production/analytics',
      module: '报表与设置',
      prd: 'PRD 6.1 #43',
    },
  },
  {
    path: 'analytics/reports',
    element: <ProductionReports />,
    meta: {
      name: '生产报表',
      path: '/production/analytics/reports',
      module: '报表与设置',
      prd: 'PRD 6.1 #44',
    },
  },
  {
    path: 'settings',
    element: <SystemSettings />,
    meta: { name: '系统设置', path: '/production/settings', module: '报表与设置', prd: 'PRD 6.1 #45' },
  },
]

/** 运营端路由（父级 /admin/production），页面条数由下方 ADMIN_PAGE_COUNT 派生 + 1 条索引重定向 */
export const ADMIN_ROUTES: AppRoute[] = [
  {
    index: true,
    element: <Navigate to="/admin/production/dashboard" replace />,
  },
  {
    path: 'dashboard',
    element: <OpsDashboard />,
    meta: {
      name: '运营管理大盘',
      path: '/admin/production/dashboard',
      module: '运营仪表盘',
      prd: 'PRD 6.2 #1',
    },
  },
  {
    path: 'dashboard/overview',
    element: <OpsProductionOverview />,
    meta: {
      name: '生产总览',
      path: '/admin/production/dashboard/overview',
      module: '运营仪表盘',
      prd: 'PRD 6.2 #2',
    },
  },
  {
    path: 'dashboard/screen',
    element: <OpsDataScreen />,
    meta: {
      name: '数据大屏驾驶舱',
      path: '/admin/production/dashboard/screen',
      module: '运营仪表盘',
      prd: 'PRD 6.2 #3',
    },
  },
  {
    path: 'tenants',
    element: <TenantList />,
    meta: { name: '租户列表', path: '/admin/production/tenants', module: '租户管理', prd: 'PRD 6.2 #4' },
  },
  {
    path: 'tenants/quotas',
    element: <TenantQuotas />,
    meta: {
      name: '配额管理',
      path: '/admin/production/tenants/quotas',
      module: '租户管理',
      prd: 'PRD 6.2 #6',
    },
  },
  {
    path: 'tenants/segments',
    element: <TenantSegments />,
    meta: {
      name: '租户分层运营',
      path: '/admin/production/tenants/segments',
      module: '租户管理',
      prd: 'PRD 6.2 #7',
    },
  },
  {
    path: 'tenants/:tenantId',
    element: <TenantDetail />,
    meta: {
      name: '租户详情',
      path: '/admin/production/tenants/:tenantId',
      module: '租户管理',
      prd: 'PRD 6.2 #5',
    },
  },
  {
    path: 'farms',
    element: <FarmSupervisionList />,
    meta: {
      name: '农场监管列表',
      path: '/admin/production/farms',
      module: '农场监管',
      prd: 'PRD 6.2 #8',
    },
  },
  {
    path: 'crops',
    element: <CropMasterList />,
    meta: {
      name: '作物管理',
      path: '/admin/production/crops',
      module: '基础数据',
      prd: '原型补充（作物主数据，运营端维护）',
    },
  },
  {
    path: 'farms/map',
    element: <FarmGisMap />,
    meta: {
      name: 'GIS地图监管',
      path: '/admin/production/farms/map',
      module: '农场监管',
      prd: 'PRD 6.2 #10',
    },
  },
  {
    path: 'farms/compliance',
    element: <ComplianceCheck />,
    meta: {
      name: '合规检查',
      path: '/admin/production/farms/compliance',
      module: '农场监管',
      prd: 'PRD 6.2 #11',
    },
  },
  {
    path: 'farms/:farmId',
    element: <FarmSupervisionDetail />,
    meta: {
      name: '农场详情监管',
      path: '/admin/production/farms/:farmId',
      module: '农场监管',
      prd: 'PRD 6.2 #9',
    },
  },
  {
    path: 'monitor',
    element: <MonitorCenter />,
    meta: {
      name: '生产监控中心',
      path: '/admin/production/monitor',
      module: '生产监控',
      prd: 'PRD 6.2 #12',
    },
  },
  {
    path: 'monitor/tasks',
    element: <TaskMonitor />,
    meta: {
      name: '任务执行监控',
      path: '/admin/production/monitor/tasks',
      module: '生产监控',
      prd: 'PRD 6.2 #13',
    },
  },
  {
    path: 'monitor/iot',
    element: <IotMonitor />,
    meta: {
      name: 'IoT设备监控',
      path: '/admin/production/monitor/iot',
      module: '生产监控',
      prd: 'PRD 6.2 #14',
    },
  },
  {
    path: 'monitor/inputs',
    element: <InputMonitor />,
    meta: {
      name: '投入品使用监管',
      path: '/admin/production/monitor/inputs',
      module: '生产监控',
      prd: 'PRD 6.2 #15',
    },
  },
  {
    path: 'monitor/environment',
    element: <MonitorEnvironment />,
    meta: {
      name: '环境数据监控',
      path: '/admin/production/monitor/environment',
      module: '生产监控',
      prd: '原型补充',
    },
  },
  {
    path: 'trace',
    element: <TraceOverview />,
    meta: {
      name: '溯源管理总览',
      path: '/admin/production/trace',
      module: '质量追溯管理',
      prd: 'PRD 6.2 #16',
    },
  },
  {
    path: 'trace/codes',
    element: <AdminTraceCodeManage />,
    meta: {
      name: '溯源码管理',
      path: '/admin/production/trace/codes',
      module: '质量追溯管理',
      prd: 'PRD 6.2 #17',
    },
  },
  {
    path: 'trace/:code',
    element: <AdminTraceDetail />,
    meta: {
      name: '溯源链路详情',
      path: '/admin/production/trace/:code',
      module: '质量追溯管理',
      prd: '原型补充',
    },
  },
  {
    path: 'quality/labs',
    element: <LabManage />,
    meta: {
      name: '检测机构管理',
      path: '/admin/production/quality/labs',
      module: '质量追溯管理',
      prd: 'PRD 6.2 #18',
    },
  },
  {
    path: 'quality/recalls',
    element: <RecallManage />,
    meta: {
      name: '不合格品处置',
      path: '/admin/production/quality/recalls',
      module: '质量追溯管理',
      prd: 'PRD 6.2 #19',
    },
  },
  {
    path: 'quality/inspections',
    element: <QualityInspections />,
    meta: {
      name: '检测报告管理',
      path: '/admin/production/quality/inspections',
      module: '质量追溯管理',
      prd: '原型补充',
    },
  },
  {
    path: 'food-safety',
    element: <FoodSafetyIndex />,
    meta: {
      name: '食品安全监控中心',
      path: '/admin/production/food-safety',
      module: '食品安全',
      prd: '原型补充',
    },
  },
  {
    path: 'food-safety/circulation',
    element: <FoodSafetyCirculation />,
    meta: {
      name: '流通异常检测',
      path: '/admin/production/food-safety/circulation',
      module: '食品安全',
      prd: '原型补充',
    },
  },
  {
    path: 'food-safety/compliance',
    element: <FoodSafetyCompliance />,
    meta: {
      name: '合规校验管理',
      path: '/admin/production/food-safety/compliance',
      module: '食品安全',
      prd: '原型补充',
    },
  },
  {
    path: 'food-safety/trust-label',
    element: <FoodSafetyTrustLabel />,
    meta: {
      name: '可信农产品管理',
      path: '/admin/production/food-safety/trust-label',
      module: '食品安全',
      prd: '原型补充',
    },
  },
  {
    path: 'food-safety/cold-chain',
    element: <FoodSafetyColdChain />,
    meta: {
      name: '冷链资源撮合',
      path: '/admin/production/food-safety/cold-chain',
      module: '食品安全',
      prd: '原型补充',
    },
  },
  {
    path: 'ai/models',
    element: <AiModels />,
    meta: {
      name: 'AI模型管理',
      path: '/admin/production/ai/models',
      module: 'AI中心',
      prd: '原型补充',
    },
  },
  {
    path: 'approvals',
    element: <ApprovalPending />,
    meta: {
      name: '待审批列表',
      path: '/admin/production/approvals',
      module: '审批管理',
      prd: 'PRD 6.2 #20',
    },
  },
  {
    path: 'approvals/history',
    element: <ApprovalHistory />,
    meta: {
      name: '审批历史',
      path: '/admin/production/approvals/history',
      module: '审批管理',
      prd: 'PRD 6.2 #21',
    },
  },
  {
    path: 'approvals/config',
    element: <ApprovalConfig />,
    meta: {
      name: '审批流程配置',
      path: '/admin/production/approvals/config',
      module: '审批管理',
      prd: 'PRD 6.2 #22',
    },
  },
  {
    path: 'alerts',
    element: <AdminAlertCenter />,
    meta: {
      name: '告警中心',
      path: '/admin/production/alerts',
      module: '异常告警处理',
      prd: 'PRD 6.2 #23',
    },
  },
  {
    path: 'alerts/emergency',
    element: <EmergencyPlan />,
    meta: {
      name: '应急预案',
      path: '/admin/production/alerts/emergency',
      module: '异常告警处理',
      prd: 'PRD 6.2 #24',
    },
  },
  {
    path: 'alerts/review',
    element: <DisasterReview />,
    meta: {
      name: '灾害事件复盘',
      path: '/admin/production/alerts/review',
      module: '异常告警处理',
      prd: 'PRD 6.2 #25',
    },
  },
  {
    path: 'sop',
    element: <SopLibrary />,
    meta: {
      name: 'SOP标准作业规程库',
      path: '/admin/production/sop',
      module: 'SOP与知识库',
      prd: 'PRD 6.2 #26',
    },
  },
  {
    path: 'knowledge',
    element: <KnowledgeBase />,
    meta: {
      name: '农业知识库',
      path: '/admin/production/knowledge',
      module: 'SOP与知识库',
      prd: 'PRD 6.2 #27',
    },
  },
  {
    path: 'reports',
    element: <ReportCenter />,
    meta: {
      name: '报表中心',
      path: '/admin/production/reports',
      module: '统计报表',
      prd: 'PRD 6.2 #28',
    },
  },
  {
    path: 'reports/production',
    element: <AdminProductionReport />,
    meta: {
      name: '生产报表',
      path: '/admin/production/reports/production',
      module: '统计报表',
      prd: 'PRD 6.2 #29',
    },
  },
  {
    path: 'reports/quality',
    element: <AdminQualityReport />,
    meta: {
      name: '质量报表',
      path: '/admin/production/reports/quality',
      module: '统计报表',
      prd: 'PRD 6.2 #30',
    },
  },
]

/* ==================== 页面条数（全部从路由表派生，禁止写死） ==================== */

/**
 * 判断一条路由是否为「页面路由」
 *
 * 索引重定向（{ index: true, element: <Navigate /> }）没有 path，不算页面。
 * @param route 路由对象
 * @returns 是页面路由返回 true
 */
function isPageRoute(route: AppRoute): boolean {
  return typeof route.path === 'string' && route.path.length > 0
}

/** 用户端页面条数（从 USER_ROUTES 派生） */
export const USER_PAGE_COUNT: number = USER_ROUTES.filter(isPageRoute).length

/** 运营端页面条数（从 ADMIN_ROUTES 派生） */
export const ADMIN_PAGE_COUNT: number = ADMIN_ROUTES.filter(isPageRoute).length

/** 全量页面条数（用户端 + 运营端，从路由表派生） */
export const TOTAL_PAGE_COUNT: number = USER_PAGE_COUNT + ADMIN_PAGE_COUNT
