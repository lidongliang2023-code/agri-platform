<template>
  <view v-if="ops" class="page">
    <view class="page-hero">
      <text class="hero-title">运营工作台</text>
      <text class="hero-sub">{{ user.realName || user.username }}，查看全平台生产运行情况</text>
    </view>
    <view class="card">
      <view class="grid cols-4">
        <view v-for="entry in opsEntries" :key="entry.path" class="grid-cell" @click="go(entry.path)">
          <view class="grid-icon">{{ entry.icon }}</view>
          <text class="grid-label">{{ entry.label }}</text>
        </view>
      </view>
    </view>
    <view class="card is-tappable" @click="openBusiness">
      <view class="row"><text class="list-title">全部运营业务</text><text class="field-arrow">›</text></view>
      <view class="list-meta">农场监管、质量安全、AI 与知识中心、统计报表等运营功能，与电脑端菜单一致。</view>
    </view>
  </view>
  <view v-else class="page">
    <view class="page-hero">
      <text class="hero-title">{{ greeting }}，{{ user.realName || user.username || '你好' }}</text>
      <text class="hero-sub">今天也把田间的事安排得明明白白</text>
      <view class="ui-action-target hero-chip" @click="go('/pages/profile/profile')">🏡 {{ farm ? farm.farmName : '未选择农场' }} ›</view>
    </view>
    <view class="stat-card">
      <view class="stat" @click="go('/pages/tasks/tasks')"><text class="stat-value">{{ pendingTasks.length }}</text><text class="stat-label">待办任务</text></view>
      <view class="stat" @click="go('/pages/tasks/tasks')"><text class="stat-value">{{ executingCount }}</text><text class="stat-label">执行中</text></view>
      <view class="stat" @click="go('/pages/alerts/alerts')"><text :class="['stat-value', alerts.length ? 'is-danger' : '']">{{ alerts.length }}</text><text class="stat-label">告警</text></view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>

    <view class="card">
      <view class="grid cols-4">
        <view v-for="entry in quickEntries" :key="entry.label" class="grid-cell" @click="go(entry.path)">
          <view class="grid-icon">{{ entry.icon }}</view>
          <text class="grid-label">{{ entry.label }}</text>
        </view>
      </view>
    </view>

    <view class="section-title"><text>待办任务</text><text class="link" @click="go('/pages/tasks/tasks')">全部任务 ›</text></view>
    <view class="card">
      <view v-if="pendingTasks.length === 0" class="empty-inline">暂无待处理任务</view>
      <view v-for="task in pendingTasks.slice(0, 3)" :key="task.taskId" class="list-item" @click="goDetail('/pages/tasks/detail', task.taskId)">
        <view class="row">
          <text class="list-title">{{ task.taskName }}</text>
          <text class="tag" :style="{ color: priorityColor(task.priority) }">{{ priorityLabel(task.priority) }}</text>
        </view>
        <view class="row list-meta">
          <text>{{ task.plotName || '未关联地块' }} · <text :class="isOverdue(task) ? 'overdue-text' : ''">{{ isOverdue(task) ? '已逾期' : '截止 ' + fmtDate(task.planEndDate) }}</text></text>
          <text class="link">{{ task.status === 'executing' ? '去完成 ›' : '去执行 ›' }}</text>
        </view>
      </view>
    </view>

    <view class="section-title"><text>告警摘要</text><text class="link" @click="go('/pages/alerts/alerts')">全部告警 ›</text></view>
    <view class="card">
      <view v-if="alerts.length === 0" class="empty-inline">暂无告警，生产运行平稳</view>
      <view v-for="alert in alerts.slice(0, 2)" :key="alert.alertId ?? alert.id" class="list-item">
        <view class="row">
          <text class="list-title">{{ alert.alertTitle ?? alert.title ?? alert.alertType ?? '告警' }}</text>
          <text class="tag" :style="{ color: alertLevelColor(alert.severity ?? alert.level) }">{{ alertLevelLabel(alert.severity ?? alert.level) }}</text>
        </view>
        <view class="list-meta">{{ alert.alertContent ?? alert.content ?? alert.message ?? '—' }}</view>
      </view>
    </view>

    <view class="section-title"><text>最近操作</text></view>
    <view class="card">
      <view v-if="recentOps.length === 0" class="empty-inline">暂无操作记录</view>
      <view v-for="(op, index) in recentOps" :key="index" class="timeline-item">
        <view class="timeline-dot" />
        <view><view class="timeline-text">{{ op.text }}</view><view class="muted">{{ op.time }}</view></view>
      </view>
    </view>

    <view class="card is-tappable" @click="openBusiness">
      <view class="row"><text class="list-title">完整生产业务</text><text class="field-arrow">›</text></view>
      <view class="list-meta">农事计划、采收排程、质检溯源、产销对接与经营分析，与电脑端共用业务规则。</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { isProductionOps, openWorkspace, ensureWorkspaceSession, workspaceMode } from '@/utils/workspace'
import { onShow } from '@dcloudio/uni-app'
import { listAlerts, listInputUsages, listTasks } from '@/api/production'
import { currentFarm, currentUser, ensureLogin, resolveCurrentFarm } from '@/utils/auth-helper'
import { alertLevelColor, alertLevelLabel, fmtDate, fmtDateTime, today } from '@/utils/format'
import { TASK_PRIORITY_COLOR, TASK_PRIORITY_LABEL } from '@/utils/format'

const user = ref(currentUser())
const ops = ref(isProductionOps())
const farm = ref(currentFarm())
/** 未完成任务（待执行 / 已派发 / 执行中），按优先级+截止时间排序 */
const openTasks = ref<any[]>([])
const completedTasks = ref<any[]>([])
const alerts = ref<any[]>([])
/** 最近的投入品使用记录，用来呈现"最近操作" */
const recentUsages = ref<any[]>([])
const error = ref('')

const pendingTasks = computed(() =>
  openTasks.value.slice().sort((a, b) => {
    const byPriority = Number(b.priority ?? 0) - Number(a.priority ?? 0)
    if (byPriority !== 0) return byPriority
    return String(a.planEndDate ?? '').localeCompare(String(b.planEndDate ?? ''))
  }),
)

/** 最近操作：投入品使用记录 + 已完成任务，按时间倒序取前 5 条 */
const recentOps = computed(() => {
  const ops: { time: string; text: string }[] = []
  recentUsages.value.forEach((usage) => {
    ops.push({
      time: fmtDateTime(usage.usedAt),
      text: `登记投入品使用：${usage.inputName ?? '—'}（用量 ${usage.dosage ?? '—'}${usage.unit ?? ''}）`,
    })
  })
  completedTasks.value
    .filter((task) => String(task.status) === 'completed' || String(task.status) === 'done')
    .forEach((task) => {
      ops.push({
        time: fmtDateTime(task.completedAt ?? task.actualEndDate),
        text: `完成任务：${task.taskName}`,
      })
    })
  return ops.filter((op) => op.time !== '—').sort((a,b) => b.time.localeCompare(a.time)).slice(0, 5)
})

/**
 * 快捷入口（对齐 PRD 4.1.1 与 V2 原型的八格）。
 *
 * <p>其中「AI 预警」与原型一致；「休药期对比」是 PRD §10.3 的入口，
 * 它背后是**真数据**（服务端多地块休药期校验），不是占位。</p>
 */
const quickEntries = [
  { icon: '📷', label: '病虫害诊断', path: '/production/ai/pest-detection' },
  { icon: '📋', label: '新建任务', path: '/pages/tasks/create' },
  { icon: '📦', label: '新建采收', path: '/pages/harvests/create' },
  { icon: '⏳', label: '休药期对比', path: '/pages/food-safety/harvest-block' },
  { icon: '🤖', label: '农事智能助手', path: '/production/ai/assistant' },
  { icon: '📖', label: '扫码溯源', path: '/pages/trace/scan' },
  { icon: '📍', label: '地块地图', path: '/pages/plots/map' },
  { icon: '💊', label: '投入品', path: '/pages/inputs/scan' },
]

/** 运营账号的常用入口（与电脑端运营菜单同名） */
const opsEntries = [
  { icon: '📊', label: '运营大盘', path: '/admin/production/dashboard' },
  { icon: '🛰️', label: '任务监控', path: '/admin/production/monitor/tasks' },
  { icon: '🚨', label: '告警处置', path: '/admin/production/alerts' },
  { icon: '🏞️', label: '农场监管', path: '/admin/production/farms' },
  { icon: '🧪', label: '质量安全', path: '/admin/production/trace' },
  { icon: '📡', label: 'IoT 监控', path: '/admin/production/monitor/iot' },
  { icon: '📚', label: '生产 SOP', path: '/admin/production/sop' },
  { icon: '📈', label: '统计报表', path: '/admin/production/reports' },
]
const executingCount = computed(() => openTasks.value.filter((task) => String(task.status) === 'executing').length)
const greeting = computed(() => {
  const hour = new Date().getHours()
  return hour < 11 ? '早上好' : hour < 14 ? '中午好' : hour < 18 ? '下午好' : '晚上好'
})
const openBusiness = (): void => { uni.switchTab({ url: "/pages/business/business" }) }
const priorityLabel = (value: any): string => TASK_PRIORITY_LABEL[Number(value)] ?? '普通'
const priorityColor = (value: any): string => TASK_PRIORITY_COLOR[Number(value)] ?? '#666666'
const isOverdue = (task: any): boolean => {
  const end = String(task.planEndDate ?? '').slice(0, 10)
  return Boolean(end && end < today() && !['completed', 'done', 'cancelled', 'expired'].includes(String(task.status)))
}

const go = (path: string): void => {
  if (path.startsWith("/production/") || path.startsWith("/admin/production/")) { openWorkspace(path); return }
  if (["/pages/workbench/workbench", "/pages/tasks/tasks", "/pages/harvests/harvests", "/pages/profile/profile", "/pages/business/business"].includes(path)) uni.switchTab({ url: path })
  else uni.navigateTo({ url: path })
}

const goDetail = (base: string, id: string): void => {
  uni.navigateTo({ url: `${base}?id=${id}` })
}

/** 拉工作台数据：任务 / 告警 / 最近使用记录，三者任一失败都如实提示，不静默留空 */
let loadVersion = 0
async function load(): Promise<void> {
  const version = ++loadVersion
  openTasks.value = []; completedTasks.value = []; alerts.value = []; recentUsages.value = []
  error.value = ''
  user.value = currentUser()
  farm.value = await resolveCurrentFarm().catch((e: any) => { error.value = e?.message || '农场加载失败，请稍后重试'; return null })
  if (!farm.value || version !== loadVersion) return
  const farmId = farm.value.farmId
  try {
    const [all, executing, alertPage, usagePage] = await Promise.all([
      listTasks({ farmId, pageSize: 50 }),
      listTasks({ farmId, status: 'executing', pageSize: 50 }),
      listAlerts({ farmId, pageSize: 20 }),
      listInputUsages({ pageSize: 5 }),
    ])
    if (version !== loadVersion) return
    const merged = new Map<string, any>()
    all.list.concat(executing.list).forEach((task) => merged.set(String(task.taskId), task))
    completedTasks.value = all.list
    openTasks.value = [...merged.values()].filter(
      (task) => !['completed', 'done', 'cancelled', 'expired'].includes(String(task.status)),
    )
    alerts.value = alertPage.list
    recentUsages.value = usagePage.list
  } catch (err: any) {
    if (version !== loadVersion) return
    error.value = err?.message ?? '工作台数据加载失败'
  }
}

onShow(async () => {
  openTasks.value = []; completedTasks.value = []; alerts.value = []; recentUsages.value = []
  if (!await ensureWorkspaceSession()) return
  user.value = currentUser()
  ops.value = workspaceMode() === 'ops'
  if (ops.value) return
  void load()
})
</script>

<style lang="scss" scoped>
.empty-inline { color: #93a19a; font-size: 26rpx; text-align: center; padding: 24rpx 0; }
.timeline-item { display: flex; gap: 20rpx; padding: 14rpx 0; }
.timeline-dot { flex: none; width: 14rpx; height: 14rpx; border-radius: 50%; background: #13a05a; margin-top: 14rpx; box-shadow: 0 0 0 6rpx #e8f6ee; }
.timeline-text { font-size: 26rpx; color: #1f2a24; line-height: 1.6; }
</style>
