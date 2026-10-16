<template>
  <view class="page">
    <view class="tabs">
      <view
        v-for="tab in tabs"
        :key="tab.key"
        class="tab-item"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </view>
    </view>

    <view class="card" style="margin-top: 16rpx">
      <input v-model="keyword" class="input" style="text-align: left" placeholder="搜索任务名称 / 地块" @confirm="load" />
    </view>

    <view v-if="error" class="error-box">{{ error }}</view>
    <view v-if="!error && tasks.length === 0" class="empty">该筛选条件下暂无任务</view>

    <view v-for="task in tasks" :key="task.taskId" class="card">
      <view class="row" @click="goDetail(task.taskId)">
        <text class="strong">{{ task.taskName }}</text>
        <text class="tag" :style="{ color: priorityColor(task.priority) }">{{ priorityLabel(task.priority) }}</text>
      </view>
      <view class="muted" style="margin-top: 8rpx" @click="goDetail(task.taskId)">
        {{ task.plotName || '未关联地块' }} · {{ task.taskType || '—' }} · 截止 {{ fmtDate(task.planEndDate) }}
      </view>
      <view class="muted" style="margin-top: 4rpx" @click="goDetail(task.taskId)">
        执行人 {{ task.assigneeName || task.executorName || '未指派' }} ·
        <text :style="{ color: statusColor(task.status) }">{{ statusLabel(task.status) }}</text>
      </view>
      <view class="row" style="margin-top: 16rpx">
        <text class="muted">{{ task.taskNo || '' }}</text>
        <view class="row" style="gap: 16rpx">
          <text v-if="canStart(task)" class="btn-ghost btn-sm" @click="onStart(task)">开始执行</text>
          <text v-if="canSubmit(task)" class="btn-primary btn-sm" @click="onSubmit(task)">完成</text>
        </view>
      </view>
    </view>

    <view style="margin: 24rpx">
      <view class="btn-primary" @click="goCreate">＋ 新建任务</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { listTasks, startTask, submitTask } from '@/api/production'
import { currentFarm, ensureLogin } from '@/utils/auth-helper'
import {
  fmtDate,
  TASK_PRIORITY_COLOR,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
} from '@/utils/format'

/** 状态 Tab：全部 / 待执行 / 执行中 / 已完成（与 PRD 4.3.1 一致） */
const tabs = [
  { key: 'all', label: '全部', status: undefined as string | undefined },
  { key: 'pending', label: '待执行', status: 'pending' },
  { key: 'executing', label: '执行中', status: 'executing' },
  { key: 'completed', label: '已完成', status: 'completed' },
]

const activeTab = ref('all')
const keyword = ref('')
const tasks = ref<any[]>([])
const error = ref('')

const priorityLabel = (value: any): string => TASK_PRIORITY_LABEL[Number(value)] ?? '普通'
const priorityColor = (value: any): string => TASK_PRIORITY_COLOR[Number(value)] ?? '#8c8c8c'
const statusLabel = (value: any): string => TASK_STATUS_LABEL[String(value)] ?? String(value ?? '—')
const statusColor = (value: any): string => TASK_STATUS_COLOR[String(value)] ?? '#8c8c8c'

/** 待执行 / 已派发 → 可开始 */
const canStart = (task: any): boolean => ['pending', 'assigned'].includes(String(task.status))
/** 执行中 → 可完成 */
const canSubmit = (task: any): boolean => String(task.status) === 'executing'

async function load(): Promise<void> {
  error.value = ''
  const farm = currentFarm()
  if (!farm) {
    error.value = '当前账号未关联农场，请到「我的」页选择农场'
    return
  }
  try {
    const tab = tabs.find((item) => item.key === activeTab.value)
    const page = await listTasks({
      farmId: farm.farmId,
      status: tab?.status,
      taskName: keyword.value || undefined,
      pageSize: 50,
    })
    // 排序口径：优先级高的在前，同优先级按截止日期近的在前（田间的实际关注顺序）
    tasks.value = page.list.slice().sort((a, b) => {
      const byPriority = Number(b.priority ?? 0) - Number(a.priority ?? 0)
      if (byPriority !== 0) return byPriority
      return String(a.planEndDate ?? '').localeCompare(String(b.planEndDate ?? ''))
    })
  } catch (err: any) {
    error.value = err?.message ?? '任务列表加载失败'
  }
}

function switchTab(key: string): void {
  activeTab.value = key
  void load()
}

async function onStart(task: any): Promise<void> {
  try {
    await startTask(String(task.taskId))
    uni.showToast({ title: '已开始执行', icon: 'success' })
    void load()
  } catch (err: any) {
    uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
  }
}

function onSubmit(task: any): void {
  uni.showModal({
    title: '完成任务',
    content: `确认完成「${task.taskName}」？`,
    success: async (res) => {
      if (!res.confirm) return
      try {
        await submitTask(String(task.taskId))
        uni.showToast({ title: '已提交完成', icon: 'success' })
        void load()
      } catch (err: any) {
        uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
      }
    },
  })
}

const goDetail = (taskId: string): void => {
  uni.navigateTo({ url: `/pages/tasks/detail?id=${taskId}` })
}

const goCreate = (): void => {
  uni.navigateTo({ url: '/pages/tasks/create' })
}

onShow(() => {
  if (!ensureLogin()) return
  void load()
})
</script>
