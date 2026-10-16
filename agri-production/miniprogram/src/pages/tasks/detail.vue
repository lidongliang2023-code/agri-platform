<template>
  <view class="page">
    <view v-if="error" class="error-box">{{ error }}</view>

    <view class="card">
      <view class="row">
        <text class="strong" style="font-size: 32rpx">{{ task.taskName || '任务详情' }}</text>
        <text class="tag" :style="{ color: statusColor(task.status) }">{{ statusLabel(task.status) }}</text>
      </view>
      <view class="divider" />
      <view class="field"><text class="field-label">任务编号</text><text class="field-value">{{ task.taskNo || '—' }}</text></view>
      <view class="field"><text class="field-label">任务类型</text><text class="field-value">{{ task.taskType || '—' }}</text></view>
      <view class="field" @click="goPlot">
        <text class="field-label">关联地块</text>
        <text class="field-value link">{{ task.plotName || '未关联' }}</text>
      </view>
      <view class="field"><text class="field-label">优先级</text><text class="field-value">{{ priorityLabel(task.priority) }}</text></view>
      <view class="field"><text class="field-label">执行人</text><text class="field-value">{{ task.assigneeName || task.executorName || '未指派' }}</text></view>
      <view class="field"><text class="field-label">计划时间</text><text class="field-value">{{ fmtDate(task.planStartDate) }} ~ {{ fmtDate(task.planEndDate) }}</text></view>
      <view class="field" style="border-bottom: none">
        <text class="field-label">实际时间</text>
        <text class="field-value">{{ fmtDateTime(task.actualStartDate) }} ~ {{ fmtDateTime(task.actualEndDate) }}</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title"><text>📝 任务内容</text></view>
      <view style="white-space: pre-wrap">{{ task.description || task.taskDesc || '（无说明）' }}</view>
    </view>

    <view class="card">
      <view class="card-title"><text>🧾 执行记录（{{ records.length }}）</text></view>
      <view v-if="records.length === 0" class="muted">暂无执行记录</view>
      <view v-for="record in records" :key="record.recordId ?? record.id" class="field">
        <text class="field-label">{{ fmtDateTime(record.createdAt ?? record.recordTime) }}</text>
        <text class="field-value">{{ recordTypeLabel(record) }} · {{ record.resultDesc || record.content || '' }}</text>
      </view>
    </view>

    <view class="card">
      <view class="card-title"><text>💊 本任务关联的投入品使用</text></view>
      <view v-if="usages.length === 0" class="muted">暂无投入品使用记录</view>
      <view v-for="usage in usages" :key="usage.usageId ?? usage.id" class="field">
        <text class="field-label">{{ usage.inputName || '—' }}</text>
        <text class="field-value">{{ fmtNumber(usage.dosage, usage.unit) }} · {{ fmtDate(usage.usedAt) }}</text>
      </view>
    </view>

    <view style="margin: 24rpx; display: flex; gap: 20rpx">
      <view v-if="canStart" class="btn-primary" style="flex: 1" @click="onStart">开始执行</view>
      <view v-if="canSubmit" class="btn-primary" style="flex: 1" @click="onSubmit">完成任务</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { addTaskRecord, getTask, listInputUsages, listTaskRecords, startTask, submitTask } from '@/api/production'
import {
  fmtDate,
  fmtDateTime,
  fmtNumber,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_COLOR,
  TASK_STATUS_LABEL,
} from '@/utils/format'

const taskId = ref('')
const task = ref<Record<string, any>>({})
const records = ref<any[]>([])
const usages = ref<any[]>([])
const error = ref('')

const statusLabel = (value: any): string => TASK_STATUS_LABEL[String(value)] ?? String(value ?? '—')
const statusColor = (value: any): string => TASK_STATUS_COLOR[String(value)] ?? '#8c8c8c'
const priorityLabel = (value: any): string => TASK_PRIORITY_LABEL[Number(value)] ?? '普通'
const recordTypeLabel = (record: any): string => {
  const type = Number(record.recordType ?? 0)
  if (type === 1) return '开始'
  if (type === 3) return '完成'
  return '过程'
}

const canStart = computed(() => ['pending', 'assigned'].includes(String(task.value.status)))
const canSubmit = computed(() => String(task.value.status) === 'executing')

async function load(): Promise<void> {
  error.value = ''
  try {
    const [detail, recordList] = await Promise.all([getTask(taskId.value), listTaskRecords(taskId.value)])
    task.value = detail ?? {}
    records.value = recordList
    // 关联投入品：按任务查使用记录（后端支持 taskId 过滤）
    const usagePage = await listInputUsages({ taskId: taskId.value, pageSize: 20 })
    usages.value = usagePage.list
  } catch (err: any) {
    error.value = err?.message ?? '任务详情加载失败'
  }
}

function goPlot(): void {
  if (!task.value.plotId) return
  uni.navigateTo({ url: `/pages/plots/detail?id=${task.value.plotId}` })
}

async function onStart(): Promise<void> {
  try {
    await startTask(taskId.value)
    uni.showToast({ title: '已开始执行', icon: 'success' })
    void load()
  } catch (err: any) {
    uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
  }
}

function onSubmit(): void {
  uni.showModal({
    title: '完成任务',
    editable: true,
    placeholderText: '执行结果说明（可留空）',
    success: async (res) => {
      if (!res.confirm) return
      try {
        const resultDesc = String(res.content ?? '').trim()
        if (resultDesc) {
          await addTaskRecord(taskId.value, { recordType: 3, resultDesc })
        }
        await submitTask(taskId.value, { resultDesc })
        uni.showToast({ title: '已提交完成', icon: 'success' })
        void load()
      } catch (err: any) {
        uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
      }
    },
  })
}

onLoad((options) => {
  taskId.value = String(options?.id ?? '')
  void load()
})
</script>
