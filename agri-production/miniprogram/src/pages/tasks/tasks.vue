<template>
  <ops-scope-panel v-if="ops" :title="opsTitle" :subtitle="opsSubtitle" :entries="opsEntries" />
  <view v-else class="page has-fab">
    <view class="page-intro">按状态查看任务，进入详情填写作业成果。</view>
    <view class="tabs">
      <view v-for="tab in tabs" :key="tab.key" class="tab-item" :class="{ active: activeTab === tab.key }" @click="switchTab(tab.key)">{{ tab.label }}</view>
    </view>

    <view v-if="plotFilter" class="toolbar"><text class="filter-pill">地块：{{ plotFilter.name }}</text><button class="btn-ghost btn-sm" @click="plotFilter = null; load()">清除筛选</button></view>
    <view class="search-bar">
      <text class="search-icon">🔍</text>
      <input v-model="keyword" placeholder="搜索任务名称 / 地块" confirm-type="search" @confirm="load" />
      <text v-if="keyword" class="link" @click="keyword = ''; load()">清除</text>
    </view>



    <view v-for="task in tasks" :key="task.taskId" class="card task-card">
      <view @click="goDetail(task.taskId)">
        <view class="row">
          <text class="list-title">{{ task.taskName }}</text>
          <text class="tag" :style="{ color: priorityColor(task.priority) }">{{ priorityLabel(task.priority) }}</text>
        </view>
        <view class="task-meta">
          <text>📍 {{ task.plotName || '未关联地块' }}</text>
          <text>🗂 {{ taskTypeLabel(task.taskType) }}</text>
          <text>⏰ 截止 {{ fmtDate(task.planEndDate) }}</text>
          <text>👤 {{ task.assigneeName || task.executorName || '未指派' }}</text>
        </view>
      </view>
      <view class="task-foot">
        <view class="status-dot-wrap"><view class="status-dot" :style="{ background: statusColor(task.status) }" /><text :style="{ color: statusColor(task.status) }">{{ statusLabel(task.status) }}</text></view>
        <view class="row task-actions">
          <button v-if="canStart(task)" class="btn-ghost btn-sm" :disabled="!!acting" :loading="acting === String(task.taskId)" @click="onStart(task)">开始执行</button>
          <text v-if="canSubmit(task)" class="btn-primary btn-sm" @click="onSubmit(task)">提交成果</text>
          <text v-if="!canStart(task) && !canSubmit(task)" class="link" @click="goDetail(task.taskId)">查看详情 ›</text>
        </view>
      </view>
    </view>

    <view class="fab" @click="goCreate">＋ 新建任务</view>
    <mobile-list-state :loading="loading" :error="error" :count="tasks.length" :total="total" :has-more="hasMore" empty-text="该筛选条件下暂无任务" @retry="retry" @more="more" />
    <view class="more-management"><button class="btn-ghost" @click="goExport">按条件导出任务 CSV</button></view>
  </view>
</template>

<script setup lang="ts">
const goExport=()=>uni.navigateTo({url:'/pages/native/exports?kind=tasks'})
import MobileListState from '@/components/mobile-list-state/mobile-list-state.vue'
import { useMobileList } from '@/composables/use-mobile-list'

import { isProductionOps, openWorkspace, ensureWorkspaceSession, workspaceMode } from '@/utils/workspace'
import { ref } from 'vue'
import OpsScopePanel from '@/components/ops-scope-panel/ops-scope-panel.vue'
/** 平台管理员不归属具体农场：本 Tab 改为运营端对应入口（与电脑端运营菜单同名） */
const ops = ref(isProductionOps())
const opsTitle = '农事运营监管'
const opsSubtitle = '查看全平台农事任务的执行与合规情况'
const opsEntries = [
  { icon: '🛰️', label: '任务执行监控', desc: '各农场农事任务进度、逾期与异常', path: '/admin/production/monitor/tasks' },
  { icon: '📋', label: '任务模板库', desc: '维护各作物的标准农事任务模板', path: '/admin/production/tasks/templates' },
  { icon: '🧴', label: '投入品使用监管', desc: '农药、肥料等投入品使用记录核查', path: '/admin/production/monitor/inputs' },
  { icon: '🏞️', label: '农场监管', desc: '农场档案、合规检查', path: '/admin/production/farms' },
]
import { onShow } from '@dcloudio/uni-app'
import { listTasks, startTask, submitTask } from '@/api/production'
import { ensureLogin, resolveCurrentFarm } from '@/utils/auth-helper'
import {
  fmtDate,
  taskTypeLabel,
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

const plotFilter = ref<{ id: string; name: string } | null>(null)
const activeTab = ref('all')
const keyword = ref('')

const { rows: tasks, loading, error, total, hasMore, reload: load, more, retry, cancel } = useMobileList(async (pageNum, pageSize) => {
  if (!await ensureWorkspaceSession() || workspaceMode() === 'ops') throw new Error('请切换到用户端查看农事任务')
  const farm = await resolveCurrentFarm()
  if (!farm) throw new Error('请在「我的」选择农场')
  return listTasks({ farmId: farm.farmId, plotId: plotFilter.value?.id, status: tabs.find(t => t.key === activeTab.value)?.status, taskName: keyword.value.trim() || undefined, pageNum, pageSize })
}, row => String(row.taskId ?? row.id))

const priorityLabel = (value: any): string => TASK_PRIORITY_LABEL[Number(value)] ?? '普通'
const priorityColor = (value: any): string => TASK_PRIORITY_COLOR[Number(value)] ?? '#666666'
const statusLabel = (value: any): string => TASK_STATUS_LABEL[String(value)] ?? String(value ?? '—')
const statusColor = (value: any): string => TASK_STATUS_COLOR[String(value)] ?? '#666666'

/** 待执行 / 已派发 → 可开始 */
const canStart = (task: any): boolean => ['pending', 'assigned'].includes(String(task.status))
/** 执行中 → 可完成 */
const canSubmit = (task: any): boolean => String(task.status) === 'executing'

function switchTab(key: string): void {
  activeTab.value = key
  void load()
}

const acting = ref('')
async function onStart(task: any): Promise<void> {
  if (acting.value) return
  acting.value = String(task.taskId)
  try {
    await startTask(String(task.taskId))
    uni.showToast({ title: '已开始执行', icon: 'success' })
    void load()
  } catch (err: any) {
    uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
  } finally { acting.value = '' }
}

function onSubmit(task: any): void { goDetail(String(task.taskId)) }

const goDetail = (taskId: string): void => {
  uni.navigateTo({ url: `/pages/tasks/detail?id=${taskId}` })
}

const goCreate = (): void => {
  uni.navigateTo({ url: '/pages/tasks/create' })
}

onShow(async () => {
  cancel(); tasks.value = []
  if (!await ensureWorkspaceSession()) return
  ops.value = workspaceMode() === 'ops'
  if (ops.value) return
  const filter = uni.getStorageSync('agri_task_plot_filter')
  uni.removeStorageSync('agri_task_plot_filter')
  plotFilter.value = filter?.id ? filter : null
  void load()
})
</script>

<style scoped>
.task-card { padding: 24rpx; }
.task-meta { display: flex; flex-wrap: wrap; gap: 8rpx 24rpx; margin-top: 14rpx; font-size: 24rpx; color: #5b6b62; line-height: 1.5; }
.task-foot { display: flex; align-items: center; justify-content: space-between; gap: 16rpx; margin-top: 20rpx; padding-top: 20rpx; border-top: 1rpx solid #edf1ee; }
.status-dot-wrap { display: flex; align-items: center; gap: 10rpx; min-width: 0; font-size: 24rpx; }
.status-dot { flex: none; width: 12rpx; height: 12rpx; border-radius: 50%; }
.task-actions { flex: none; gap: 12rpx; }

/* 2026-11-20：逐页实测控件的48px触控区。 */
.fab { min-height:48px; }
</style>
