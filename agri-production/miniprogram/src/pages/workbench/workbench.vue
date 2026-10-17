<template>
  <view class="page">
    <!-- 用户信息条 -->
    <view class="wb-header">
      <view>
        <text class="wb-name">{{ user.realName || '未登录' }}</text>
        <text class="wb-sub">{{ farm ? farm.farmName : '未选择农场' }}</text>
      </view>
      <view class="wb-actions">
        <text class="link" @click="go('/pages/messages/messages')">消息</text>
        <text class="link" @click="go('/pages/profile/settings')">设置</text>
      </view>
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>

    <!-- 今日待办 -->
    <view class="card">
      <view class="card-title">
        <text>📋 今日待办（{{ pendingTasks.length }}）</text>
        <text class="link" @click="go('/pages/tasks/tasks')">查看全部 →</text>
      </view>
      <view v-if="pendingTasks.length === 0" class="muted">今天没有待执行的任务</view>
      <view
        v-for="task in pendingTasks.slice(0, 3)"
        :key="task.taskId"
        class="todo-item"
        @click="goDetail('/pages/tasks/detail', task.taskId)"
      >
        <view class="row">
          <text class="strong">{{ task.taskName }}</text>
          <text class="tag" :style="{ color: priorityColor(task.priority) }">
            {{ priorityLabel(task.priority) }}
          </text>
        </view>
        <view class="row" style="margin-top: 8rpx">
          <text class="muted">{{ task.plotName || '未关联地块' }} · 截止 {{ fmtDate(task.planEndDate) }}</text>
          <text class="link">{{ task.status === 'executing' ? '去完成' : '去执行' }}</text>
        </view>
      </view>
    </view>

    <!-- 快捷入口 -->
    <view class="card">
      <view class="card-title"><text>⚡ 快捷入口</text></view>
      <view class="grid">
        <view v-for="entry in quickEntries" :key="entry.label" class="grid-cell" @click="go(entry.path)">
          <text class="quick-icon">{{ entry.icon }}</text>
          <text class="quick-label">{{ entry.label }}</text>
        </view>
      </view>
    </view>

    <!-- 告警摘要 -->
    <view class="card">
      <view class="card-title">
        <text>🔔 告警摘要（{{ alerts.length }}）</text>
        <text class="link" @click="go('/pages/alerts/alerts')">查看全部告警 →</text>
      </view>
      <view v-if="alerts.length === 0" class="muted">暂无告警</view>
      <view v-for="alert in alerts.slice(0, 2)" :key="alert.alertId ?? alert.id" class="todo-item">
        <view class="row">
          <text class="strong">{{ alert.alertTitle ?? alert.title ?? alert.alertType ?? '告警' }}</text>
          <text class="tag" :style="{ color: alertLevelColor(alert.severity ?? alert.level) }">
            {{ alertLevelLabel(alert.severity ?? alert.level) }}
          </text>
        </view>
        <text class="muted">{{ alert.alertContent ?? alert.content ?? alert.message ?? '—' }}</text>
      </view>
    </view>

    <!-- 最近操作 -->
    <view class="card">
      <view class="card-title"><text>📝 最近操作</text></view>
      <view v-if="recentOps.length === 0" class="muted">暂无操作记录</view>
      <view v-for="(op, index) in recentOps" :key="index" class="muted recent-op">
        · {{ op.time }} {{ op.text }}
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listAlerts, listInputUsages, listTasks } from '@/api/production'
import { currentFarm, currentUser, ensureLogin } from '@/utils/auth-helper'
import { alertLevelColor, alertLevelLabel, fmtDate, fmtDateTime } from '@/utils/format'
import { TASK_PRIORITY_COLOR, TASK_PRIORITY_LABEL } from '@/utils/format'

const user = ref(currentUser())
const farm = ref(currentFarm())
/** 未完成任务（待执行 / 已派发 / 执行中），按优先级+截止时间排序 */
const openTasks = ref<any[]>([])
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
  openTasks.value
    .filter((task) => String(task.status) === 'completed' || String(task.status) === 'done')
    .forEach((task) => {
      ops.push({
        time: fmtDateTime(task.completedAt ?? task.actualEndDate),
        text: `完成任务：${task.taskName}`,
      })
    })
  return ops.filter((op) => op.time !== '—').slice(0, 5)
})

/**
 * 快捷入口（对齐 PRD 4.1.1 与 V2 原型的八格）。
 *
 * <p>其中「AI 预警」与原型一致；「休药期对比」是 PRD §10.3 的入口，
 * 它背后是**真数据**（服务端多地块休药期校验），不是占位。</p>
 */
const quickEntries = [
  { icon: '📷', label: 'AI 识病', path: '/pages/ai/pest-detection' },
  { icon: '📋', label: '新建任务', path: '/pages/tasks/create' },
  { icon: '📦', label: '新建采收', path: '/pages/harvests/create' },
  { icon: '⏳', label: '休药期对比', path: '/pages/food-safety/harvest-block' },
  { icon: '🤖', label: 'AI 预警', path: '/pages/ai/alerts' },
  { icon: '📖', label: '扫码溯源', path: '/pages/trace/scan' },
  { icon: '📍', label: '地块地图', path: '/pages/plots/map' },
  { icon: '💊', label: '投入品', path: '/pages/inputs/scan' },
]

const priorityLabel = (value: any): string => TASK_PRIORITY_LABEL[Number(value)] ?? '普通'
const priorityColor = (value: any): string => TASK_PRIORITY_COLOR[Number(value)] ?? '#8c8c8c'

const go = (path: string): void => {
  uni.navigateTo({ url: path })
}

const goDetail = (base: string, id: string): void => {
  uni.navigateTo({ url: `${base}?id=${id}` })
}

/** 拉工作台数据：任务 / 告警 / 最近使用记录，三者任一失败都如实提示，不静默留空 */
async function load(): Promise<void> {
  error.value = ''
  user.value = currentUser()
  farm.value = currentFarm()
  if (!farm.value) {
    error.value = '当前账号未关联农场，请到「我的」页选择农场'
    return
  }
  const farmId = farm.value.farmId
  try {
    const [all, executing, alertPage, usagePage] = await Promise.all([
      listTasks({ farmId, pageSize: 50 }),
      listTasks({ farmId, status: 'executing', pageSize: 50 }),
      listAlerts({ farmId, pageSize: 20 }),
      listInputUsages({ pageSize: 5 }),
    ])
    const merged = new Map<string, any>()
    all.list.concat(executing.list).forEach((task) => merged.set(String(task.taskId), task))
    openTasks.value = [...merged.values()].filter(
      (task) => !['completed', 'done', 'cancelled', 'expired'].includes(String(task.status)),
    )
    alerts.value = alertPage.list
    recentUsages.value = usagePage.list
  } catch (err: any) {
    error.value = err?.message ?? '工作台数据加载失败'
  }
}

onShow(() => {
  if (!ensureLogin()) return
  void load()
})
</script>

<style lang="scss" scoped>
.wb-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: #ffffff;
  padding: 32rpx 24rpx;
}

.wb-name {
  display: block;
  font-size: 34rpx;
  font-weight: 600;
}

.wb-sub {
  display: block;
  color: #8c8c8c;
  font-size: 24rpx;
  margin-top: 6rpx;
}

.wb-actions {
  display: flex;
  gap: 24rpx;
}

.todo-item {
  padding: 20rpx 0;
  border-bottom: 1rpx solid #f0f0f0;
}

.quick-icon {
  display: block;
  font-size: 44rpx;
}

.quick-label {
  display: block;
  font-size: 24rpx;
  color: #4b5563;
  margin-top: 6rpx;
}

.recent-op {
  padding: 8rpx 0;
}
</style>
