import { defineComponent, h, onMounted, watchEffect } from 'vue'
import type { RouteRecordRaw } from 'vue-router'
import { useRoute, useRouter } from 'vue-router'

const IOT_USER_ORIGIN = () => `${window.location.protocol}//${window.location.hostname}:8101`

function createIotRedirect(target: string | ((params: Record<string, string>) => string)) {
  return defineComponent({
    name: 'ProductionIotUserRedirect',
    setup() {
      const route = useRoute()
      const destinationUrl = () => {
        const path = typeof target === 'function' ? target(route.params as Record<string, string>) : target
        const destination = new URL(path, IOT_USER_ORIGIN())
        const search = route.fullPath.includes('?') ? route.fullPath.split('?')[1].split('#')[0] : ''
        new URLSearchParams(search).forEach((value, key) => {
          if (!destination.searchParams.has(key)) destination.searchParams.append(key, value)
        })
        destination.hash = route.hash
        return destination.toString()
      }
      onMounted(() => { window.location.replace(destinationUrl()) })
      return () => h('div', { style: { padding: '24px' } }, '正在打开物联网管理页面…')
    },
  })
}

const LegacyUsageRedirect = defineComponent({
  name: 'ProductionLegacyUsageRedirect',
  setup() {
    const route = useRoute()
    const router = useRouter()
    watchEffect(() => {
      void router.replace({ path: '/production/inputs', query: { ...route.query, tab: 'ledger' }, hash: route.hash })
    })
    return () => null
  },
})

/** 生产管理用户端全部 Vue 路由（挂于 /production 下）。 */
export const productionUserVueRoutes: RouteRecordRaw[] = [
  { path: '', redirect: '/production/dashboard' },
  { path: 'dashboard', component: () => import('@/vue/business/pages/user/dashboard/DashboardHome'), meta: { name: '生产数据看板', module: '工作台', prd: 'PRD 6.1 #1', requiresAuth: true } },
  { path: 'dashboard/production', component: () => import('@/vue/business/pages/user/dashboard/ProductionCockpit'), meta: { name: '生产驾驶舱', requiresAuth: true } },
  { path: 'messages', component: () => import('@/vue/business/pages/user/dashboard/MessageCenter'), meta: { name: '消息中心', module: '工作台', prd: 'PRD 6.1 #3', requiresAuth: true } },
  { path: 'farms', component: () => import('@/vue/business/pages/user/farms/FarmList'), meta: { name: '农场管理', module: '农场与地块', prd: 'PRD 6.1 #4', requiresAuth: true } },
  { path: 'farms/create', component: () => import('@/vue/business/pages/user/farms/Create'), meta: { name: '新增农场', module: '农场与地块', prd: '原型补充', requiresAuth: true } },
  { path: 'farms/:farmId', component: () => import('@/vue/business/pages/user/farms/FarmDetail'), meta: { name: '农场详情', module: '农场与地块', prd: 'PRD 6.1 #5', requiresAuth: true } },
  { path: 'plots', component: () => import('@/vue/business/pages/user/plots/PlotList'), meta: { name: '地块列表', module: '农场与地块', prd: 'PRD 6.1 #6', requiresAuth: true } },
  { path: 'plots/create', component: () => import('@/vue/business/pages/user/plots/Create'), meta: { name: '新增地块', module: '农场与地块', prd: '原型补充', requiresAuth: true } },
  { path: 'plots/:plotId', component: () => import('@/vue/business/pages/user/plots/PlotDetail'), meta: { name: '地块详情', module: '农场与地块', prd: 'PRD 6.1 #7', requiresAuth: true } },
  { path: 'plots/:plotId/soil', component: () => import('@/vue/business/pages/user/plots/PlotSoilRecords'), meta: { name: '土壤检测档案', module: '农场与地块', prd: 'PRD 6.1 #8', requiresAuth: true } },
  { path: 'plans', component: () => import('@/vue/business/pages/user/plans/PlanList'), meta: { name: '农事计划', module: '农事生产', prd: 'PRD 6.1 #11', requiresAuth: true } },
  { path: 'plans/calendar', component: () => import('@/vue/business/pages/user/plans/PlanCalendar'), meta: { name: '农事日历', module: '农事生产', prd: 'PRD 6.1 #13', requiresAuth: true } },
  { path: 'plans/create', component: () => import('@/vue/business/pages/user/plans/PlanCreate'), meta: { name: '新建农事计划', module: '农事生产', prd: 'PRD 6.1 #11', requiresAuth: true } },
  { path: 'plans/:planId/edit', component: () => import('@/vue/business/pages/user/plans/PlanCreate'), meta: { name: '编辑农事计划', module: '农事生产', prd: 'PRD 6.1 #11', requiresAuth: true } },
  { path: 'plans/:planId', component: () => import('@/vue/business/pages/user/plans/PlanDetail'), meta: { name: '农事计划详情', module: '农事生产', prd: 'PRD 6.1 #12', requiresAuth: true } },
  { path: 'tasks', component: () => import('@/vue/business/pages/user/tasks/TaskList'), meta: { name: '任务列表', module: '农事任务管理', prd: 'PRD 6.1 #14', requiresAuth: true } },
  { path: 'tasks/voice-records', component: () => import('@/vue/business/pages/user/tasks/VoiceFarmRecords'), meta: { name: '语音农事归档', module: '农事生产', prd: 'AI 场景47', requiresAuth: true } },
  { path: 'tasks/create', component: () => import('@/vue/business/pages/user/tasks/TaskCreate'), meta: { name: '创建任务', module: '农事任务管理', prd: 'PRD 6.1 #16', requiresAuth: true } },
  { path: 'tasks/:taskId', component: () => import('@/vue/business/pages/user/tasks/TaskDetail'), meta: { name: '任务详情', module: '农事任务管理', prd: 'PRD 6.1 #15', requiresAuth: true } },
  { path: 'tasks/:taskId/acceptance', component: () => import('@/vue/business/pages/user/tasks/TaskAcceptance'), meta: { name: '任务验收', module: '农事任务管理', prd: 'PRD 6.1 #18', requiresAuth: true } },
  { path: 'inputs', component: () => import('@/vue/business/pages/user/inputs/InputList'), meta: { name: '农资管理', module: '农资管理', prd: 'PRD 6.1 #19', requiresAuth: true } },
  { path: 'inputs/create', component: () => import('@/vue/business/pages/user/inputs/Create'), meta: { name: '新建投入品', module: '农资管理', prd: '原型补充', requiresAuth: true } },
  { path: 'inputs/ledger', redirect: '/production/inputs', meta: { name: '农资管理（旧链接回落）', module: '农资管理', prd: '原型补充' } },
  { path: 'inputs/stock', redirect: '/production/inputs', meta: { name: '出入库管理（旧链接回落）', module: '农资管理', prd: 'PRD 6.1 #21' } },
  { path: 'inputs/usages', component: LegacyUsageRedirect, meta: { name: '使用台账（旧链接回落）', module: '农资管理', prd: 'PRD 6.1 #22' } },
  { path: 'inputs/:inputId', component: () => import('@/vue/business/pages/user/inputs/InputDetail'), meta: { name: '投入品详情', module: '农资管理', prd: 'PRD 6.1 #20', requiresAuth: true } },
  { path: 'growth', component: () => import('@/vue/business/pages/user/growth/GrowthOverview'), meta: { name: '生长监测总览', module: '生产监测与设备关联', prd: 'PRD 6.1 #23', requiresAuth: true } },
  { path: 'growth/records', component: () => import('@/vue/business/pages/user/growth/GrowthRecords'), meta: { name: '生长记录', module: '生产监测与设备关联', prd: 'PRD 6.1 #24', requiresAuth: true } },
  { path: 'growth/environment', component: () => import('@/vue/business/pages/user/growth/EnvironmentData'), meta: { name: '环境数据', module: '生产监测与设备关联', prd: 'PRD 6.1 #25', requiresAuth: true } },
  { path: 'alerts', component: () => import('@/vue/business/pages/user/alerts/AlertCenter'), meta: { name: '告警中心', module: '生产监测与设备关联', prd: 'PRD 6.1 #26', requiresAuth: true } },
  { path: 'alerts/rules', component: createIotRedirect('/alerts?tab=rules'), meta: { name: '告警规则配置', module: '生产监测与设备关联', prd: 'PRD 6.1 #27', requiresAuth: true } },
  { path: 'iot', component: createIotRedirect('/devices'), meta: { name: '设备列表', module: '生产监测与设备关联', prd: 'PRD 6.1 #28', requiresAuth: true } },
  { path: 'iot/bindings', component: () => import('@/vue/business/pages/user/iot/DeviceBindings'), meta: { name: '设备绑定管理', module: '生产监测与设备关联', prd: 'PRD 6.1 #30', requiresAuth: true } },
  { path: 'iot/:deviceId', component: createIotRedirect((p) => `/devices/${encodeURIComponent(p.deviceId ?? '')}`), meta: { name: '设备详情', module: '生产监测与设备关联', prd: 'PRD 6.1 #29', requiresAuth: true } },
  { path: 'monitor', component: () => import('@/vue/business/pages/user/monitor/Index'), meta: { name: '生产监控看板', module: '生产监测与设备关联', prd: '原型补充', requiresAuth: true } },
  { path: 'harvests/plan', component: () => import('@/vue/business/pages/user/harvests/HarvestPlan'), meta: { name: '采收记录', module: '采收与库存', prd: 'PRD 6.1 #31', requiresAuth: true } },
  { path: 'harvests/window-decision', component: () => import('@/vue/business/pages/user/harvests/HarvestWindowDecision'), meta: { name: '采收窗口决策与用工排程', module: '采收与库存', prd: '场景 204', requiresAuth: true } },
  { path: 'harvests/labor-workers', component: () => import('@/vue/business/pages/user/harvests/LaborWorkerLibrary'), meta: { name: '劳务人员库', module: '采收与库存', prd: '场景 204 配套', requiresAuth: true } },
  { path: 'harvests', component: () => import('@/vue/business/pages/user/harvests/HarvestRecords'), meta: { name: '采收记录', module: '采收与库存', prd: 'PRD 6.1 #32', requiresAuth: true } },
  { path: 'harvests/create', component: () => import('@/vue/business/pages/user/harvests/Create'), meta: { name: '新建采收', module: '采收与库存', prd: '原型补充', requiresAuth: true } },
  { path: 'harvests/inventory', component: () => import('@/vue/business/pages/user/harvests/InventoryManage'), meta: { name: '库存管理', module: '采收与库存', prd: 'PRD 6.1 #33', requiresAuth: true } },
  { path: 'harvests/inventory/create', component: () => import('@/vue/business/pages/user/harvests/InventoryCreate'), meta: { name: '新增库存', module: '采收与库存', prd: '原型补充', requiresAuth: true } },
  { path: 'harvests/inventory/:inventoryId', component: () => import('@/vue/business/pages/user/harvests/InventoryDetail'), meta: { name: '库存详情', module: '采收与库存', prd: '原型补充', requiresAuth: true } },
  { path: 'harvests/:harvestId', component: () => import('@/vue/business/pages/user/harvests/Detail'), meta: { name: '采收详情', module: '采收与库存', prd: '原型补充', requiresAuth: true } },
  { path: 'quality', component: () => import('@/vue/business/pages/user/quality/QualityInspection'), meta: { name: '质量检测管理', module: '质量检测与溯源', prd: 'PRD 6.1 #34', requiresAuth: true } },
  { path: 'quality/grading', component: () => import('@/vue/business/pages/user/quality/QualityGrading'), meta: { name: '质量分级管理', module: '质量检测与溯源', prd: 'PRD 6.1 #35', requiresAuth: true } },
  { path: 'trace', component: () => import('@/vue/business/pages/user/trace/TraceCodeManage'), meta: { name: '溯源码管理', module: '质量检测与溯源', prd: 'PRD 6.1 #36', requiresAuth: true } },
  { path: 'trace/full-chain', component: () => import('@/vue/business/pages/user/trace/FullChainTrace'), meta: { name: '生产全链路溯源', module: '质量检测与溯源', prd: 'PRD 6.1 #37', requiresAuth: true } },
  { path: 'process', component: () => import('@/vue/business/pages/user/trace/ProcessRecordManage'), meta: { name: '加工记录', module: '质量检测与溯源', prd: 'PRD 6.1 #37（加工环节）', requiresAuth: true } },
  { path: 'trace/reports', component: () => import('@/vue/business/pages/user/trace/Reports'), meta: { name: '溯源报告', module: '质量检测与溯源', prd: '原型补充', requiresAuth: true } },
  { path: 'blockchain', component: () => import('@/vue/business/pages/user/blockchain/BlockchainOverview'), meta: { name: '区块链概览', module: '质量检测与溯源', prd: 'PRD 6.1 #38', requiresAuth: true } },
  { path: 'blockchain/records', component: () => import('@/vue/business/pages/user/blockchain/BlockchainRecords'), meta: { name: '上链记录', module: '质量检测与溯源', prd: 'PRD 6.1 #39', requiresAuth: true } },
  { path: 'blockchain/records/:recordId', component: () => import('@/vue/business/pages/user/blockchain/RecordDetail'), meta: { name: '存证详情', module: '质量检测与溯源', prd: '原型补充', requiresAuth: true } },
  { path: 'blockchain/verify', component: () => import('@/vue/business/pages/user/blockchain/Verify'), meta: { name: '存证验证', module: '质量检测与溯源', prd: '原型补充', requiresAuth: true } },
  { path: 'ai/pest-detection', component: () => import('@/vue/business/pages/user/ai/PestDetection'), meta: { name: '病虫害识别', module: '分析与决策', prd: 'PRD 6.1 #40', requiresAuth: true } },
  { path: 'ai/input-safety', component: () => import('@/vue/business/pages/user/ai/InputSafety'), meta: { name: '投入品推荐与安全校验', module: '分析与决策', prd: '场景 48', requiresAuth: true } },
  { path: 'ai/assistant', component: () => import('@/vue/business/pages/user/ai/AiAssistant'), meta: { name: 'AI问答助手', module: '分析与决策', prd: 'PRD 6.1 #41', requiresAuth: true } },
  { path: 'ai/tech-learning', component: () => import('@/vue/business/pages/user/ai/TechLearning'), meta: { name: '农技知识问答与培训陪练', module: '分析与决策', prd: '场景 50', requiresAuth: true } },
  { path: 'ai/yield-forecast', component: () => import('@/vue/business/pages/user/ai/YieldForecast'), meta: { name: '产量预测', module: '分析与决策', prd: 'PRD 6.1 #42', requiresAuth: true } },
  { path: 'ai/processing-schedule', component: () => import('@/vue/business/pages/user/ai/ProcessingSchedule'), meta: { name: '加工产能与订单协同排产', module: '分析与决策', prd: '场景 203', requiresAuth: true } },
  { path: 'ai/process-optimization', component: () => import('@/vue/business/pages/user/ai/ProcessOptimization'), meta: { name: '产后初加工工艺优化', module: '分析与决策', prd: '场景 201', requiresAuth: true } },
  { path: 'analytics', component: () => import('@/vue/business/pages/user/analytics/AnalyticsOverview'), meta: { name: '数据分析总览', module: '分析与决策', prd: 'PRD 6.1 #43', requiresAuth: true } },
  { path: 'analytics/reports', component: () => import('@/vue/business/pages/user/analytics/ProductionReports'), meta: { name: '生产报表', module: '分析与决策', prd: 'PRD 6.1 #44', requiresAuth: true } },
  { path: 'settings', component: () => import('@/vue/business/pages/user/settings/SystemSettings'), meta: { name: '系统设置', module: '系统设置', prd: 'PRD 6.1 #45', requiresAuth: true } },
  { path: 'p2t', component: () => import('@/vue/business/pages/user/p2t/Overview'), meta: { name: '产销对接总览', module: '产销对接', prd: '产销对接原型 v1', requiresAuth: true } },
  { path: 'p2t/variety', component: () => import('@/vue/business/pages/user/p2t/VarietyMap'), meta: { name: '品种对接表', module: '产销对接', prd: '产销对接原型 v1', requiresAuth: true } },
  { path: 'p2t/batches', component: () => import('@/vue/business/pages/user/p2t/Batches'), meta: { name: '采收批次与可售量', module: '产销对接', prd: '产销对接原型 v1', requiresAuth: true } },
  { path: 'p2t/offers', component: () => import('@/vue/business/pages/user/p2t/Offers'), meta: { name: '供给意向发布', module: '产销对接', prd: '产销对接原型 v1', requiresAuth: true } },
  { path: 'p2t/subscriptions', component: () => import('@/vue/business/pages/user/p2t/Subscriptions'), meta: { name: '认购台账', module: '产销对接', prd: '产销对接原型 v1', requiresAuth: true } },
  { path: 'p2t/demand', component: () => import('@/vue/business/pages/user/p2t/Demand'), meta: { name: '需求反哺与排产建议', module: '产销对接', prd: '产销对接原型 v1', requiresAuth: true } },
  { path: 'p2t/diffs', component: () => import('@/vue/business/pages/user/p2t/Diffs'), meta: { name: '差异与异常处置', module: '产销对接', prd: '产销对接原型 v1', requiresAuth: true } },
  { path: 'p2t/trace', component: () => import('@/vue/business/pages/user/p2t/Trace'), meta: { name: '全链路追踪（生产侧）', module: '产销对接', prd: '产销对接原型 v1', requiresAuth: true } },
  { path: 'p2t/boundary', component: () => import('@/vue/business/pages/user/p2t/Boundary'), meta: { name: '边界与归位说明', module: '产销对接', prd: '产销对接原型 v1', requiresAuth: true } },
]
