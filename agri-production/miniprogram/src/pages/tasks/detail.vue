<template>
  <view class="page detail-page">
    <view v-if="loading" class="empty">正在加载详情…</view>
    <view v-else-if="error" class="error-box">{{ error }}<button class="btn-ghost" @click="load">重新加载</button></view>
    <template v-else-if="ready">

    <view class="card">
      <view class="row">
        <text class="strong" style="font-size: 32rpx">{{ task.taskName || '任务详情' }}</text>
        <text class="tag" :style="{ color: statusColor(task.status) }">{{ statusLabel(task.status) }}</text>
      </view>
      <view class="divider" />
      <view class="field"><text class="field-label">任务编号</text><text class="field-value">{{ task.taskNo || '—' }}</text></view>
      <view class="field"><text class="field-label">任务类型</text><text class="field-value">{{ taskTypeLabel(task.taskType) }}</text></view>
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
      <view v-if="task.resultDesc" style="white-space: pre-wrap; margin-top: 20rpx">作业成果：{{ task.resultDesc }}</view>
    </view>

    <view class="card">
      <view class="card-title"><text>🧾 执行记录（{{ records.length }}）</text></view>
      <view v-if="records.length === 0" class="muted">暂无执行记录</view>
      <view v-for="record in records" :key="record.recordId ?? record.id" class="field">
        <text class="field-label">{{ fmtDateTime(record.executeTime ?? record.createdAt ?? record.createTime ?? record.recordTime) }}</text>
        <text class="field-value">{{ recordTypeLabel(record) }} · {{ record.executorName || '未记录执行人' }}{{ record.abnormalDesc || record.resultDesc || record.content ? ' · ' + (record.abnormalDesc || record.resultDesc || record.content) : '' }}</text>
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

    <view class="mobile-action-bar" :class="{ busy: acting }">
      <view v-if="canStart" class="btn-primary" style="flex: 1" @click="onStart">开始执行</view>
      <view v-if="canSubmit" class="btn-primary" style="flex: 1" @click="onSubmit">提交作业成果</view>
      <view v-if="canAccept" class="btn-primary" style="flex: 1" @click="onAccept(true)">验收通过</view>
      <view v-if="canAccept" class="btn-danger" style="flex: 1" @click="onAccept(false)">驳回重做</view>
    </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { acceptTask, getTask, listInputUsages, listTaskRecords, startTask, submitTask } from '@/api/production'
import {
  fmtDate,
  taskTypeLabel,
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
const loading = ref(false)
const ready = ref(false)
const acting = ref(false)

const statusLabel = (value: any): string => TASK_STATUS_LABEL[String(value)] ?? String(value ?? '—')
const statusColor = (value: any): string => TASK_STATUS_COLOR[String(value)] ?? '#666666'
const priorityLabel = (value: any): string => TASK_PRIORITY_LABEL[Number(value)] ?? '普通'
const recordTypeLabel = (record: any): string => {
  const type = Number(record.executeType ?? record.recordType ?? 0)
  if (type === 1) return '开始'
  if (type === 3) return '完成'
  return '过程'
}

const canStart = computed(() => ['pending', 'assigned'].includes(String(task.value.status)))
const canSubmit = computed(() => String(task.value.status) === 'executing')
const canAccept = computed(() => ['completed', 'done'].includes(String(task.value.status)) && Number(task.value.acceptStatus ?? -1) === 0)

async function load(): Promise<void> {
  if (!taskId.value) { error.value = '缺少记录编号，请返回列表重新打开'; return }
  loading.value = true; ready.value = false
  error.value = ''
  try {
    const [detail, recordList] = await Promise.all([getTask(taskId.value), listTaskRecords(taskId.value)])
    task.value = detail ?? {}
    records.value = recordList
    // 关联投入品：按任务查使用记录（后端支持 taskId 过滤）
    const usagePage = await listInputUsages({ taskId: taskId.value, pageSize: 20 })
    usages.value = usagePage.list
    ready.value = Boolean(task.value.taskId || task.value.id)
    if (!ready.value) throw new Error('任务不存在或无权访问')
  } catch (err: any) {
    error.value = err?.message ?? '任务详情加载失败'
  } finally { loading.value = false }
}

function goPlot(): void {
  if (!task.value.plotId) return
  uni.navigateTo({ url: `/pages/plots/detail?id=${task.value.plotId}` })
}

async function onStart(): Promise<void> {
  if (acting.value || !ready.value) return
  acting.value = true
  try {
    await startTask(taskId.value)
    uni.showToast({ title: '已开始执行', icon: 'success' })
    void load()
  } catch (err: any) {
    uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
  } finally { acting.value = false }
}

async function onAccept(pass: boolean): Promise<void> {
  if (acting.value || !canAccept.value) return
  const result = await new Promise<{ confirm: boolean; content?: string }>((resolve) => uni.showModal({ title: pass ? '验收通过' : '驳回重做', editable: true, placeholderText: pass ? '验收说明（可留空）' : '请填写驳回原因', success: resolve, fail: () => resolve({ confirm: false }) }))
  if (!result.confirm) return
  if (!pass && !String(result.content || '').trim()) { uni.showToast({ title: '请填写驳回原因', icon: 'none' }); return }
  acting.value = true
  try { await acceptTask(taskId.value, pass, String(result.content || '').trim()); uni.showToast({ title: pass ? '已验收通过' : '已驳回重做', icon: 'success' }); await load() }
  catch (err: any) { uni.showToast({ title: err?.message ?? '验收失败', icon: 'none' }) }
  finally { acting.value = false }
}

function onSubmit(): void {
  if (acting.value || !ready.value) return
  acting.value = true
  uni.showModal({
    title: '提交作业成果',
    editable: true,
    placeholderText: '执行结果说明（可留空）',
    success: async (res) => {
      if (!res.confirm) { acting.value = false; return }
      try {
        const resultDesc = String(res.content ?? '').trim()
        await submitTask(taskId.value, { resultDesc })
        uni.showToast({ title: '已提交，等待验收', icon: 'success' })
        void load()
      } catch (err: any) {
        uni.showToast({ title: err?.message ?? '操作失败', icon: 'none' })
      } finally { acting.value = false }
    },
    fail: () => { acting.value = false },
  })
}

onLoad((options) => {
  taskId.value = String(options?.id ?? '')
  void load()
})
</script>
