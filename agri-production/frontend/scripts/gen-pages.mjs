/**
 * 页面占位组件生成脚本（脚手架工具）
 *
 * 依据 PAGE_MANIFEST 生成 src/pages 下的页面占位组件，保证全部页面的
 * JSDoc（页面名称 / 路由路径 / 所属模块 / 来源）与命名完全一致。
 *
 * 清单条数由 PAGE_MANIFEST.length 派生（运行时打印，不在注释里写死）：
 * PRD 6.1 / 6.2 定义的 75 页 + 高保真原型补充的 21 页。
 *
 * ⚠️ 幂等保护：文件已存在时直接跳过，绝不覆盖已被填充业务实现的页面。
 * 需要重新生成某个页面时，请先手动删除对应文件。
 *
 * 用法：node scripts/gen-pages.mjs
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(SCRIPT_DIR, '..')
const PAGES_ROOT = join(PROJECT_ROOT, 'src', 'pages')

/**
 * 页面清单
 * - name: 组件函数名（PascalCase）
 * - file: 文件名（与 name 一致，无扩展名）
 * - dir: src/pages 下的相对目录
 * - title: 页面中文名称
 * - path: 路由路径
 * - module: 所属一级模块
 * - prd: PRD 序号；原型补充页面固定为「原型补充」
 * - proto: 原型 pageId（仅原型补充页面填写，其余省略）
 * - kind: 占位骨架类型
 * - desc: 页面职责描述
 */
const PAGE_MANIFEST = [
  // ========== 用户端 45 页 ==========
  { name: 'DashboardHome', dir: 'user/dashboard', title: '生产数据看板', path: '/production/dashboard', module: '首页看板', prd: 'PRD 6.1 #1', kind: 'dashboard', desc: '展示当前农场生产核心指标：在种面积、任务进度、待办告警、本月采收量等。' },
  { name: 'ProductionCockpit', dir: 'user/dashboard', title: '生产驾驶舱', path: '/production/dashboard/production', module: '首页看板', prd: 'PRD 6.1 #2', kind: 'dashboard', desc: '以驾驶舱形式汇总种植/养殖全过程数据，支持下钻到地块与计划。' },
  { name: 'MessageCenter', dir: 'user/dashboard', title: '消息中心', path: '/production/messages', module: '首页看板', prd: 'PRD 6.1 #3', kind: 'table', desc: '集中展示系统通知、任务提醒、告警通知与审批通知，支持已读/删除。' },
  { name: 'FarmList', dir: 'user/farms', title: '农场列表', path: '/production/farms', module: '农场数字化管理', prd: 'PRD 6.1 #4', kind: 'table', desc: '展示租户下全部农场，支持检索、新增、编辑、启停与切换当前农场。' },
  { name: 'FarmDetail', dir: 'user/farms', title: '农场详情', path: '/production/farms/:farmId', module: '农场数字化管理', prd: 'PRD 6.1 #5', kind: 'detail', desc: '展示农场基础信息、地块分布、成员构成与生产统计概览。' },
  { name: 'PlotList', dir: 'user/plots', title: '地块列表', path: '/production/plots', module: '农场数字化管理', prd: 'PRD 6.1 #6', kind: 'table', desc: '展示农场下全部地块，支持按种植类型与状态筛选，可绘制地块边界。' },
  { name: 'PlotDetail', dir: 'user/plots', title: '地块详情', path: '/production/plots/:plotId', module: '农场数字化管理', prd: 'PRD 6.1 #7', kind: 'detail', desc: '展示地块基础信息、当前作物、关联计划、环境数据与农事记录。' },
  { name: 'PlotSoilRecords', dir: 'user/plots', title: '土壤检测档案', path: '/production/plots/:plotId/soil', module: '农场数字化管理', prd: 'PRD 6.1 #8', kind: 'table', desc: '记录地块历次土壤检测指标（pH、有机质、氮磷钾等）与检测报告。' },
  { name: 'MemberList', dir: 'user/members', title: '团队与人员', path: '/production/members', module: '农场数字化管理', prd: 'PRD 6.1 #9', kind: 'table', desc: '管理农场团队成员，支持邀请、编辑岗位、分配角色与停用成员。' },
  { name: 'RoleList', dir: 'user/members', title: '角色与权限', path: '/production/members/roles', module: '农场数字化管理', prd: 'PRD 6.1 #10', kind: 'table', desc: '维护农场角色并配置菜单/按钮/接口权限点。' },
  { name: 'PlanList', dir: 'user/plans', title: '种养计划列表', path: '/production/plans', module: '智能种养计划', prd: 'PRD 6.1 #11', kind: 'table', desc: '展示种养计划台账，支持按作物/状态检索、复制计划与提交审批。' },
  { name: 'PlanDetail', dir: 'user/plans', title: '种养计划详情', path: '/production/plans/:planId', module: '智能种养计划', prd: 'PRD 6.1 #12', kind: 'detail', desc: '展示计划基本信息、阶段划分、关联任务与产量预估。' },
  { name: 'PlanCalendar', dir: 'user/plans', title: '农事日历', path: '/production/plans/calendar', module: '智能种养计划', prd: 'PRD 6.1 #13', kind: 'detail', desc: '以日历视图呈现各计划阶段的农事安排与执行进度。' },
  { name: 'TaskList', dir: 'user/tasks', title: '任务列表', path: '/production/tasks', module: '农事任务管理', prd: 'PRD 6.1 #14', kind: 'table', desc: '展示农事任务台账，支持按状态/优先级/执行人筛选与批量派发。' },
  { name: 'TaskDetail', dir: 'user/tasks', title: '任务详情', path: '/production/tasks/:taskId', module: '农事任务管理', prd: 'PRD 6.1 #15', kind: 'detail', desc: '展示任务基本信息、执行记录、投入品使用与验收结果。' },
  { name: 'TaskCreate', dir: 'user/tasks', title: '创建任务', path: '/production/tasks/create', module: '农事任务管理', prd: 'PRD 6.1 #16', kind: 'form', desc: '基于模板或自定义创建农事任务，配置地块、时间、执行人与优先级。' },
  { name: 'TaskTemplates', dir: 'user/tasks', title: '任务模板库', path: '/production/tasks/templates', module: '农事任务管理', prd: 'PRD 6.1 #17', kind: 'table', desc: '维护标准农事任务模板，包含作业内容、标准工时与投入品清单。' },
  { name: 'TaskAcceptance', dir: 'user/tasks', title: '任务验收', path: '/production/tasks/:taskId/acceptance', module: '农事任务管理', prd: 'PRD 6.1 #18', kind: 'form', desc: '查看任务执行成果并提交验收结论，支持驳回并填写整改意见。' },
  { name: 'InputList', dir: 'user/inputs', title: '投入品台账', path: '/production/inputs', module: '农资投入品管理', prd: 'PRD 6.1 #19', kind: 'table', desc: '维护种子/肥料/农药等投入品基础台账与库存数量。' },
  { name: 'InputDetail', dir: 'user/inputs', title: '投入品详情', path: '/production/inputs/:inputId', module: '农资投入品管理', prd: 'PRD 6.1 #20', kind: 'detail', desc: '展示投入品登记证号、厂家、安全间隔期、库存与出入库流水。' },
  { name: 'InputStock', dir: 'user/inputs', title: '出入库管理', path: '/production/inputs/stock', module: '农资投入品管理', prd: 'PRD 6.1 #21', kind: 'table', desc: '记录投入品入库与出库流水，实时联动库存数量。' },
  { name: 'InputUsages', dir: 'user/inputs', title: '使用记录', path: '/production/inputs/usages', module: '农资投入品管理', prd: 'PRD 6.1 #22', kind: 'table', desc: '记录投入品在地块上的实际使用明细，支持上链存证。' },
  { name: 'GrowthOverview', dir: 'user/growth', title: '生长监测总览', path: '/production/growth', module: '生长监测预警', prd: 'PRD 6.1 #23', kind: 'dashboard', desc: '汇总作物长势、生育期分布与异常地块提示。' },
  { name: 'GrowthRecords', dir: 'user/growth', title: '生长记录', path: '/production/growth/records', module: '生长监测预警', prd: 'PRD 6.1 #24', kind: 'table', desc: '记录各作物生育期的株高、叶面积指数、长势评级与病虫害情况。' },
  { name: 'EnvironmentData', dir: 'user/growth', title: '环境数据', path: '/production/growth/environment', module: '生长监测预警', prd: 'PRD 6.1 #25', kind: 'table', desc: '展示空气温湿度、土壤温湿度、光照等环境数据及趋势曲线。' },
  { name: 'AlertCenter', dir: 'user/alerts', title: '告警中心', path: '/production/alerts', module: '生长监测预警', prd: 'PRD 6.1 #26', kind: 'table', desc: '集中处理环境、设备、病虫害、任务与投入品告警。' },
  { name: 'AlertRules', dir: 'user/alerts', title: '告警规则配置', path: '/production/alerts/rules', module: '生长监测预警', prd: 'PRD 6.1 #27', kind: 'table', desc: '配置监测指标阈值、持续时间、告警级别与通知方式。' },
  { name: 'DeviceList', dir: 'user/iot', title: '设备列表', path: '/production/iot', module: 'IoT设备管理', prd: 'PRD 6.1 #28', kind: 'table', desc: '展示传感器、摄像头、控制器等物联网设备台账与在线状态。' },
  { name: 'DeviceDetail', dir: 'user/iot', title: '设备详情', path: '/production/iot/:deviceId', module: 'IoT设备管理', prd: 'PRD 6.1 #29', kind: 'detail', desc: '展示设备基础信息、运行状态、遥测数据与绑定关系。' },
  { name: 'DeviceBindings', dir: 'user/iot', title: '设备绑定管理', path: '/production/iot/bindings', module: 'IoT设备管理', prd: 'PRD 6.1 #30', kind: 'table', desc: '维护设备与地块/大棚/农场的绑定关系及采集频率。' },
  { name: 'HarvestPlan', dir: 'user/harvests', title: '采收计划', path: '/production/harvests/plan', module: '采收库存管理', prd: 'PRD 6.1 #31', kind: 'table', desc: '制定地块采收计划，安排采收日期、预计产量与负责人。' },
  { name: 'HarvestRecords', dir: 'user/harvests', title: '采收记录', path: '/production/harvests', module: '采收库存管理', prd: 'PRD 6.1 #32', kind: 'table', desc: '登记采收批次，记录数量、等级、采收人并生成溯源码。' },
  { name: 'InventoryManage', dir: 'user/harvests', title: '库存管理', path: '/production/harvests/inventory', module: '采收库存管理', prd: 'PRD 6.1 #33', kind: 'table', desc: '管理批次库存、库位、冻结状态与出入库流水。' },
  { name: 'QualityInspection', dir: 'user/quality', title: '质量检测管理', path: '/production/quality', module: '质量检测与溯源', prd: 'PRD 6.1 #34', kind: 'table', desc: '管理农残、重金属等检测单据，登记检测结果与检测报告。' },
  { name: 'QualityGrading', dir: 'user/quality', title: '质量分级管理', path: '/production/quality/grading', module: '质量检测与溯源', prd: 'PRD 6.1 #35', kind: 'table', desc: '维护作物质量分级规则、判定标准与价格系数。' },
  { name: 'TraceCodeManage', dir: 'user/trace', title: '溯源码管理', path: '/production/trace', module: '质量检测与溯源', prd: 'PRD 6.1 #36', kind: 'table', desc: '批量生成、激活、作废溯源码，并查看扫码统计。' },
  { name: 'FullChainTrace', dir: 'user/trace', title: '生产全链路溯源', path: '/production/trace/full-chain', module: '质量检测与溯源', prd: 'PRD 6.1 #37', kind: 'detail', desc: '以时间轴展示从种子到采收、检测、仓储的全链路溯源节点。' },
  { name: 'BlockchainOverview', dir: 'user/blockchain', title: '区块链概览', path: '/production/blockchain', module: '区块链增强', prd: 'PRD 6.1 #38', kind: 'dashboard', desc: '展示上链总量、成功率、区块高度与上链趋势。' },
  { name: 'BlockchainRecords', dir: 'user/blockchain', title: '上链记录', path: '/production/blockchain/records', module: '区块链增强', prd: 'PRD 6.1 #39', kind: 'table', desc: '查询各类业务数据的上链记录、交易哈希与验真结果。' },
  { name: 'PestDetection', dir: 'user/ai', title: '病虫害识别', path: '/production/ai/pest-detection', module: '智能决策中心', prd: 'PRD 6.1 #40', kind: 'form', desc: '上传作物图片进行病虫害 AI 识别，返回病害类型与防治建议。' },
  { name: 'AiAssistant', dir: 'user/ai', title: 'AI问答助手', path: '/production/ai/assistant', module: '智能决策中心', prd: 'PRD 6.1 #41', kind: 'detail', desc: '基于农业知识库的智能问答，支持多轮会话与知识引用。' },
  { name: 'YieldForecast', dir: 'user/ai', title: '产量预测', path: '/production/ai/yield-forecast', module: '智能决策中心', prd: 'PRD 6.1 #42', kind: 'dashboard', desc: '基于历史与环境数据预测产量区间、预计采收期与关键影响因素。' },
  { name: 'AnalyticsOverview', dir: 'user/analytics', title: '数据分析总览', path: '/production/analytics', module: '报表与设置', prd: 'PRD 6.1 #43', kind: 'dashboard', desc: '多维度分析生产数据：产量趋势、任务完成率、投入品消耗与作物分布。' },
  { name: 'ProductionReports', dir: 'user/analytics', title: '生产报表', path: '/production/analytics/reports', module: '报表与设置', prd: 'PRD 6.1 #44', kind: 'table', desc: '按日/周/月/季/年生成生产报表，支持导出与下载。' },
  { name: 'SystemSettings', dir: 'user/settings', title: '系统设置', path: '/production/settings', module: '报表与设置', prd: 'PRD 6.1 #45', kind: 'form', desc: '维护农场级系统配置：告警阈值默认值、数据保留策略与通知偏好。' },

  // ========== 运营端 30 页 ==========
  { name: 'OpsDashboard', dir: 'admin/dashboard', title: '运营管理大盘', path: '/admin/production/dashboard', module: '运营仪表盘', prd: 'PRD 6.2 #1', kind: 'dashboard', desc: '展示平台租户数、农场数、设备在线率、待审批与未处理告警等核心指标。' },
  { name: 'OpsProductionOverview', dir: 'admin/dashboard', title: '生产总览', path: '/admin/production/dashboard/overview', module: '运营仪表盘', prd: 'PRD 6.2 #2', kind: 'dashboard', desc: '按租户与区域聚合展示全平台生产数据与同比环比变化。' },
  { name: 'OpsDataScreen', dir: 'admin/dashboard', title: '数据大屏驾驶舱', path: '/admin/production/dashboard/screen', module: '运营仪表盘', prd: 'PRD 6.2 #3', kind: 'dashboard', desc: '面向大屏的可视化驾驶舱，含地图分布、实时指标滚动与告警播报。' },
  { name: 'TenantList', dir: 'admin/tenants', title: '租户列表', path: '/admin/production/tenants', module: '租户管理', prd: 'PRD 6.2 #4', kind: 'table', desc: '管理平台租户，支持开通、冻结、续费与等级调整。' },
  { name: 'TenantDetail', dir: 'admin/tenants', title: '租户详情', path: '/admin/production/tenants/:tenantId', module: '租户管理', prd: 'PRD 6.2 #5', kind: 'detail', desc: '展示租户基础信息、农场与成员规模、配额使用情况与业务趋势。' },
  { name: 'TenantQuotas', dir: 'admin/tenants', title: '配额管理', path: '/admin/production/tenants/quotas', module: '租户管理', prd: 'PRD 6.2 #6', kind: 'table', desc: '配置各租户的农场数、地块数、成员数、设备数与 API 调用配额。' },
  { name: 'TenantSegments', dir: 'admin/tenants', title: '租户分层运营', path: '/admin/production/tenants/segments', module: '租户管理', prd: 'PRD 6.2 #7', kind: 'table', desc: '按规模与贡献度对租户分层，并维护对应的运营策略。' },
  { name: 'FarmSupervisionList', dir: 'admin/farms', title: '农场监管列表', path: '/admin/production/farms', module: '农场监管', prd: 'PRD 6.2 #8', kind: 'table', desc: '全平台农场监管台账，支持按租户、地区、类型检索与启停。' },
  { name: 'FarmSupervisionDetail', dir: 'admin/farms', title: '农场详情监管', path: '/admin/production/farms/:farmId', module: '农场监管', prd: 'PRD 6.2 #9', kind: 'detail', desc: '查看单个农场的生产数据、合规记录与设备运行情况。' },
  { name: 'FarmGisMap', dir: 'admin/farms', title: 'GIS地图监管', path: '/admin/production/farms/map', module: '农场监管', prd: 'PRD 6.2 #10', kind: 'dashboard', desc: '基于 GIS 地图展示农场与地块空间分布，支持区域下钻。' },
  { name: 'ComplianceCheck', dir: 'admin/farms', title: '合规检查', path: '/admin/production/farms/compliance', module: '农场监管', prd: 'PRD 6.2 #11', kind: 'table', desc: '登记农场合规检查结果，跟踪整改要求与整改期限。' },
  { name: 'MonitorCenter', dir: 'admin/monitor', title: '生产监控中心', path: '/admin/production/monitor', module: '生产监控', prd: 'PRD 6.2 #12', kind: 'dashboard', desc: '实时监控全平台任务执行、设备在线与投入品使用情况。' },
  { name: 'TaskMonitor', dir: 'admin/monitor', title: '任务执行监控', path: '/admin/production/monitor/tasks', module: '生产监控', prd: 'PRD 6.2 #13', kind: 'table', desc: '监控任务执行进度与超时情况，支持催办与干预。' },
  { name: 'IotMonitor', dir: 'admin/monitor', title: 'IoT设备监控', path: '/admin/production/monitor/iot', module: '生产监控', prd: 'PRD 6.2 #14', kind: 'table', desc: '监控全平台设备在线率、离线告警与远程运维操作。' },
  { name: 'InputMonitor', dir: 'admin/monitor', title: '投入品使用监管', path: '/admin/production/monitor/inputs', module: '生产监控', prd: 'PRD 6.2 #15', kind: 'table', desc: '监管投入品使用记录，识别超量使用与违禁投入品风险。' },
  { name: 'TraceOverview', dir: 'admin/trace', title: '溯源管理总览', path: '/admin/production/trace', module: '质量追溯管理', prd: 'PRD 6.2 #16', kind: 'dashboard', desc: '展示平台溯源码总量、激活量、扫码次数与异常扫码预警。' },
  { name: 'AdminTraceCodeManage', dir: 'admin/trace', title: '溯源码管理', path: '/admin/production/trace/codes', module: '质量追溯管理', prd: 'PRD 6.2 #17', kind: 'table', desc: '查询平台全部溯源码，支持冻结与作废处置。' },
  { name: 'LabManage', dir: 'admin/quality', title: '检测机构管理', path: '/admin/production/quality/labs', module: '质量追溯管理', prd: 'PRD 6.2 #18', kind: 'table', desc: '维护合作检测机构资质、联系人与合作关系状态。' },
  { name: 'RecallManage', dir: 'admin/quality', title: '不合格品处置', path: '/admin/production/quality/recalls', module: '质量追溯管理', prd: 'PRD 6.2 #19', kind: 'table', desc: '登记不合格品召回、销毁、降级与返工处置流程并跟踪进度。' },
  { name: 'ApprovalPending', dir: 'admin/approvals', title: '待审批列表', path: '/admin/production/approvals', module: '审批管理', prd: 'PRD 6.2 #20', kind: 'table', desc: '集中处理农场入驻、计划变更、投入品采购等待审批事项。' },
  { name: 'ApprovalHistory', dir: 'admin/approvals', title: '审批历史', path: '/admin/production/approvals/history', module: '审批管理', prd: 'PRD 6.2 #21', kind: 'table', desc: '查询历史审批记录、审批人与审批意见，支持按类型与时间筛选。' },
  { name: 'ApprovalConfig', dir: 'admin/approvals', title: '审批流程配置', path: '/admin/production/approvals/config', module: '审批管理', prd: 'PRD 6.2 #22', kind: 'form', desc: '配置各类审批的流程节点、审批角色、会签/或签与超时规则。' },
  { name: 'AdminAlertCenter', dir: 'admin/alerts', title: '告警中心', path: '/admin/production/alerts', module: '异常告警处理', prd: 'PRD 6.2 #23', kind: 'table', desc: '处理全平台告警，支持按租户与级别分派处理人并跟踪闭环。' },
  { name: 'EmergencyPlan', dir: 'admin/alerts', title: '应急预案', path: '/admin/production/alerts/emergency', module: '异常告警处理', prd: 'PRD 6.2 #24', kind: 'table', desc: '维护各类告警的应急预案、响应级别、处置流程与责任人。' },
  { name: 'DisasterReview', dir: 'admin/alerts', title: '灾害事件复盘', path: '/admin/production/alerts/review', module: '异常告警处理', prd: 'PRD 6.2 #25', kind: 'form', desc: '记录灾害事件影响范围、处置过程、损失评估与改进措施。' },
  { name: 'SopAudit', dir: 'admin/sop', title: 'SOP模板审核', path: '/admin/production/sop', module: 'SOP与知识库', prd: 'PRD 6.2 #26', kind: 'table', desc: '审核租户提交的 SOP 模板，通过后纳入平台标准模板库。' },
  { name: 'KnowledgeBase', dir: 'admin/knowledge', title: '农业知识库', path: '/admin/production/knowledge', module: 'SOP与知识库', prd: 'PRD 6.2 #27', kind: 'table', desc: '维护种植技术、病虫害防治、政策法规等知识文章的发布与下架。' },
  { name: 'ReportCenter', dir: 'admin/reports', title: '报表中心', path: '/admin/production/reports', module: '统计报表', prd: 'PRD 6.2 #28', kind: 'table', desc: '汇总平台全部报表，支持按周期、租户检索与下载。' },
  { name: 'AdminProductionReport', dir: 'admin/reports', title: '生产报表', path: '/admin/production/reports/production', module: '统计报表', prd: 'PRD 6.2 #29', kind: 'table', desc: '按周期生成全平台生产报表，含产量、面积与任务完成情况。' },
  { name: 'AdminQualityReport', dir: 'admin/reports', title: '质量报表', path: '/admin/production/reports/quality', module: '统计报表', prd: 'PRD 6.2 #30', kind: 'table', desc: '按周期生成全平台质量报表，含合格率、不合格处置与检测分布。' },

  // ========== 原型补充页面 21 页（用户端 12 + 运营端 9） ==========
  { name: 'Create', dir: 'user/farms', title: '新增农场', path: '/production/farms/create', module: '农场数字化管理', prd: '原型补充', proto: 'farm-create', kind: 'form', desc: '录入农场名称、类型、所在地区、经营面积与负责人信息，提交后完成农场创建。' },
  { name: 'Create', dir: 'user/plots', title: '新增地块', path: '/production/plots/create', module: '农场数字化管理', prd: '原型补充', proto: 'plot-create', kind: 'form', desc: '在当前农场下新建地块，维护地块编号、面积、土壤类型、灌溉方式并绘制地块边界。' },
  { name: 'Create', dir: 'user/inputs', title: '新建投入品', path: '/production/inputs/create', module: '农资投入品管理', prd: '原型补充', proto: 'input-create', kind: 'form', desc: '登记投入品档案：品类、名称、登记证号、生产厂家、有效成分、安全间隔期与初始库存。' },
  { name: 'Ledger', dir: 'user/inputs', title: '投入品流转台账', path: '/production/inputs/ledger', module: '农资投入品管理', prd: '原型补充', proto: 'input-ledger', kind: 'table', desc: '按批次汇总投入品的入库、出库与使用流水，支持按投入品、地块与时间范围检索并对账。' },
  { name: 'Create', dir: 'user/harvests', title: '新建采收', path: '/production/harvests/create', module: '采收库存管理', prd: '原型补充', proto: 'harvest-create', kind: 'form', desc: '登记采收批次：采收地块、作物、采收数量、质量等级、采收人与采收时间，提交后生成批次编号。' },
  { name: 'Detail', dir: 'user/harvests', title: '采收详情', path: '/production/harvests/:harvestId', module: '采收库存管理', prd: '原型补充', proto: 'harvest-detail', kind: 'detail', desc: '展示采收批次的基础信息、等级分布、检测结论、关联溯源码与入库流向，支持编辑与作废。' },
  { name: 'InventoryCreate', dir: 'user/harvests', title: '新增库存', path: '/production/harvests/inventory/create', module: '采收库存管理', prd: '原型补充', proto: 'inventory-create', kind: 'form', desc: '为采收批次登记入库信息：仓库、库位、入库数量、存储温区与保质期，提交后生成库存流水。' },
  { name: 'InventoryDetail', dir: 'user/harvests', title: '库存详情', path: '/production/harvests/inventory/:inventoryId', module: '采收库存管理', prd: '原型补充', proto: 'inventory-detail', kind: 'detail', desc: '展示库存记录的基础信息、库位分布、在库时长、温湿度曲线与出入库流水，支持冻结、盘点与调拨。' },
  { name: 'Index', dir: 'user/monitor', title: '生产监控看板', path: '/production/monitor', module: '生长监测与IoT', prd: '原型补充', proto: 'monitor', kind: 'dashboard', desc: '集中呈现农场实时生产态势：设备在线率、环境指标曲线、告警分布、任务进度与地块异常提示。' },
  { name: 'Reports', dir: 'user/trace', title: '溯源报告', path: '/production/trace/reports', module: '质量检测与溯源', prd: '原型补充', proto: 'trace-report', kind: 'table', desc: '按批次、作物或时间范围生成溯源报告，汇总全链路节点、检测结论与扫码统计，支持预览与导出。' },
  { name: 'RecordDetail', dir: 'user/blockchain', title: '存证详情', path: '/production/blockchain/records/:recordId', module: '区块链增强', prd: '原型补充', proto: 'blockchain-record-detail', kind: 'detail', desc: '展示存证记录的业务单据、数据摘要、交易哈希、区块高度、上链时间与验真结果，支持下载存证证书。' },
  { name: 'Verify', dir: 'user/blockchain', title: '存证验证', path: '/production/blockchain/verify', module: '区块链增强', prd: '原型补充', proto: 'blockchain-verify', kind: 'form', desc: '输入交易哈希、数据摘要或扫描溯源码校验链上存证的真实性与完整性，并展示验真结论。' },
  { name: 'Environment', dir: 'admin/monitor', title: '环境数据监控', path: '/admin/production/monitor/environment', module: '生产监控', prd: '原型补充', proto: 'admin-monitor-environment', kind: 'table', desc: '全平台监控空气温湿度、土壤温湿度、光照、CO2 等环境指标，支持按租户/区域检索并识别数据异常。' },
  { name: 'Detail', dir: 'admin/trace', title: '溯源链路详情', path: '/admin/production/trace/:code', module: '质量追溯管理', prd: '原型补充', proto: 'admin-trace-detail', kind: 'detail', desc: '按溯源码展示种植、投入品、采收、检测、仓储、流通全链路节点与责任主体，支持定位异常节点。' },
  { name: 'Inspections', dir: 'admin/quality', title: '检测报告管理', path: '/admin/production/quality/inspections', module: '质量追溯管理', prd: '原型补充', proto: 'admin-quality-inspection', kind: 'table', desc: '审核各检测机构上传的农残、重金属等检测报告，标记不合格项并联动不合格品处置流程。' },
  { name: 'Index', dir: 'admin/foodSafety', title: '食品安全监控中心', path: '/admin/production/food-safety', module: '食品安全', prd: '原型补充', proto: 'food-safety', kind: 'dashboard', desc: '汇总平台食品安全态势：风险批次、检测合格率、流通异常、合规校验通过率与冷链达标率。' },
  { name: 'Circulation', dir: 'admin/foodSafety', title: '流通异常检测', path: '/admin/production/food-safety/circulation', module: '食品安全', prd: '原型补充', proto: 'food-safety-circulation', kind: 'table', desc: '基于扫码与流通节点数据识别窜货、重复扫码、链路断点与超时未达等异常，支持复核与派发处置工单。' },
  { name: 'Compliance', dir: 'admin/foodSafety', title: '合规校验管理', path: '/admin/production/food-safety/compliance', module: '食品安全', prd: '原型补充', proto: 'food-safety-compliance', kind: 'table', desc: '维护食品安全合规规则（限量标准、禁限用投入品、标签规范）并执行批量校验，记录结果与整改要求。' },
  { name: 'TrustLabel', dir: 'admin/foodSafety', title: '可信农产品管理', path: '/admin/production/food-safety/trust-label', module: '食品安全', prd: '原型补充', proto: 'food-safety-trust-label', kind: 'table', desc: '管理可信农产品标识的申请、审核、授予与撤销，维护评定标准、有效期与公示信息。' },
  { name: 'ColdChain', dir: 'admin/foodSafety', title: '冷链资源撮合', path: '/admin/production/food-safety/cold-chain', module: '食品安全', prd: '原型补充', proto: 'food-safety-cold-chain', kind: 'table', desc: '汇聚冷链仓储与冷藏运力资源，按产地、容量、温区与时段撮合供需，跟踪温度记录并预警超标事件。' },
  { name: 'Models', dir: 'admin/ai', title: 'AI模型管理', path: '/admin/production/ai/models', module: 'AI中心', prd: '原型补充', proto: 'admin-ai-models', kind: 'table', desc: '管理平台侧 AI 模型的版本、上线状态、调用配额与准确率指标，支持灰度发布与回滚。' },
]

/** 骨架说明文案 */
const SKELETON_COMMENT = {
  table: ' * - ProTable：columns + request（分页查询）+ search（筛选表单）+ toolBarRender（新增）',
  form: ' * - ProForm：分组表单 + 校验规则 + onFinish 提交',
  detail: ' * - Row/Col + Descriptions（基础信息）+ Tabs（关联数据）+ Timeline（流转记录）',
  dashboard: ' * - Row/Col + 指标卡 + ReactECharts（折线/柱状/饼图）',
}

/**
 * 生成单个页面文件内容
 * @param {object} page 页面清单项
 * @returns {string} 文件文本内容
 */
function renderPageFile(page) {
  return `/**
 * 页面名称：${page.title}
 * 路由路径：${page.path}
 * 所属模块：${page.module}
 * ${page.prd ? `PRD 序号：${page.prd}\n` : ''}${page.proto ? ` * 原型 pageId：${page.proto}（PRD 外，原型补充页面）\n` : ''} */
import PagePlaceholder from '@/components/PagePlaceholder'

/**
 * ${page.title}
 *
 * 业务职责：${page.desc}
 *
 * 标准骨架预留：
${SKELETON_COMMENT[page.kind]}
 *
 * @returns 页面内容
 */
export default function ${page.name}(): JSX.Element {
  return (
    <PagePlaceholder
      title="${page.title}"
      kind="${page.kind}"
      description="${page.desc}"
    />
  )
}
`
}

let created = 0
let skipped = 0
for (const page of PAGE_MANIFEST) {
  const dir = join(PAGES_ROOT, page.dir)
  const file = join(dir, `${page.name}.tsx`)
  if (existsSync(file)) {
    // 幂等保护：已存在的页面（可能已被填充业务实现）绝不覆盖
    skipped += 1
    continue
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(file, renderPageFile(page), 'utf-8')
  created += 1
}

console.log(
  `manifest: ${PAGE_MANIFEST.length} pages, created ${created}, skipped ${skipped} (already exist) under ${PAGES_ROOT}`,
)
