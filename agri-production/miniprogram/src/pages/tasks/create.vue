<template>
  <view class="page">
    <view v-if="error" class="error-box">{{ error }}</view>

    <view class="card">
      <view class="card-title"><text>🌾 地块与类型</text></view>
      <view class="field">
        <text class="field-label">任务名称</text>
        <input :disabled="submitting || saved" v-model="form.taskName" class="input" placeholder="如：1 号田晚疫病防治" />
      </view>
      <picker :disabled="submitting || saved" mode="selector" :range="plotNames" @change="onPlotChange">
        <view class="field">
          <text class="field-label">关联地块</text>
          <text class="field-value">{{ plotLabel || '请选择' }}</text>
        </view>
      </picker>
      <picker :disabled="submitting || saved" mode="selector" :range="taskTypes" @change="onTypeChange">
        <view class="field">
          <text class="field-label">任务类型</text>
          <text class="field-value">{{ form.taskType || '请选择' }}</text>
        </view>
      </picker>
    </view>

    <view class="card">
      <view class="card-title"><text>⏰ 时间与人员</text></view>
      <picker :disabled="submitting || saved" mode="date" :value="form.planStartDate" @change="onStartDateChange">
        <view class="field">
          <text class="field-label">计划开始</text>
          <text class="field-value">{{ form.planStartDate }}</text>
        </view>
      </picker>
      <picker :disabled="submitting || saved" mode="date" :start="form.planStartDate" :value="form.planEndDate" @change="onEndDateChange">
        <view class="field">
          <text class="field-label">计划截止</text>
          <text class="field-value">{{ form.planEndDate }}</text>
        </view>
      </picker>
      <picker :disabled="submitting || saved" mode="selector" :range="memberNames" @change="onMemberChange">
        <view class="field">
          <text class="field-label">执行人</text>
          <text class="field-value">{{ memberLabel || '请选择' }}</text>
        </view>
      </picker>
      <picker :disabled="submitting || saved" mode="selector" :range="priorityNames" @change="onPriorityChange">
        <view class="field" style="border-bottom: none">
          <text class="field-label">优先级</text>
          <text class="field-value">{{ priorityLabelOf(form.priority) }}</text>
        </view>
      </picker>
    </view>

    <view class="card">
      <view class="card-title"><text>📝 作业说明</text></view>
      <textarea :disabled="submitting || saved" v-model="form.description" class="textarea" placeholder="执行要求 / 注意事项" />
    </view>

    <view class="form-actions">
      <button class="btn-primary" :disabled="submitting || saved" :loading="submitting" @click="submit">{{ saved ? '已创建' : '创建任务' }}</button>
      <text class="muted">创建后可在任务详情中开始执行和回填结果</text>
    </view>

    <view class="muted form-source-note">
      创建后可在任务详情中开始执行、提交完成并查看操作记录。
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { createTask, listMembers, listPlots } from '@/api/production'
import { currentUser, resolveCurrentFarm } from '@/utils/auth-helper'
import { addDays, today } from '@/utils/format'

/** 任务类型候选（与 PC 端任务页的分类口径一致，值是后端 task_type 文本） */
const taskTypes = ['施肥', '灌溉', '病虫害防治', '整枝打杈', '除草', '采收', '其他']

/** 优先级：4 紧急 / 3 重要 / 2 普通 / 1 低（后端 TaskSaveDTO.priority 为文本，故传数字字符串） */
const priorityOptions = [
  { value: '2', label: '普通' },
  { value: '3', label: '重要' },
  { value: '4', label: '紧急' },
  { value: '1', label: '低' },
]

const plots = ref<any[]>([])
const members = ref<any[]>([])
const error = ref('')
const submitting = ref(false)
const saved = ref(false)

const form = ref({
  taskName: '',
  taskType: '',
  plotId: '',
  assigneeId: '',
  assigneeName: '',
  priority: '2',
  planStartDate: today(),
  planEndDate: addDays(today(), 1),
  description: '',
})

/** 深链预选地块（`?plotId=`）：从地块详情/休药期对比"去建任务"时少一次选择 */
const presetPlotId = ref('')

onLoad((options) => {
  presetPlotId.value = String(options?.plotId ?? '')
})

const plotNames = computed(() => plots.value.map((plot) => plot.plotName))
const memberNames = computed(() =>
  members.value.map((member) => `${member.realName}${member.position ? `（${member.position}）` : ''}`),
)
const priorityNames = computed(() => priorityOptions.map((item) => item.label))

const plotLabel = computed(
  () => plots.value.find((plot) => String(plot.plotId) === String(form.value.plotId))?.plotName ?? '',
)
const memberLabel = computed(
  () => members.value.find((member) => String(member.id) === String(form.value.assigneeId))?.realName ?? '',
)
const priorityLabelOf = (value: string): string =>
  priorityOptions.find((item) => item.value === value)?.label ?? '普通'

function onPlotChange(event: any): void {
  form.value.plotId = String(plots.value[Number(event.detail.value)]?.plotId ?? '')
}

function onTypeChange(event: any): void {
  form.value.taskType = taskTypes[Number(event.detail.value)] ?? ''
}

function onStartDateChange(event: any): void {
  form.value.planStartDate = String(event.detail.value)
  if (form.value.planEndDate < form.value.planStartDate) {
    form.value.planEndDate = form.value.planStartDate
  }
}

function onEndDateChange(event: any): void {
  form.value.planEndDate = String(event.detail.value)
}

function onMemberChange(event: any): void {
  const picked = members.value[Number(event.detail.value)]
  form.value.assigneeId = String(picked?.id ?? '')
  form.value.assigneeName = String(picked?.realName ?? '')
}

function onPriorityChange(event: any): void {
  form.value.priority = priorityOptions[Number(event.detail.value)]?.value ?? '2'
}

/** 提交：字段口径与 PC 端新建任务一致（farmId 必带，否则任务不归农场） */
async function submit(): Promise<void> {
  if (submitting.value || saved.value) return
  submitting.value = true
  try {
  error.value = ''
  const farm = await resolveCurrentFarm().catch((e: any) => { error.value = e?.message || '农场加载失败，请稍后重试'; return null })
  if (!farm) return
  if (form.value.planEndDate < form.value.planStartDate) { error.value = '截止日期不能早于开始日期'; return }
  if (!form.value.taskName.trim()) {
    error.value = '请填写任务名称'
    return
  }
  if (!form.value.taskType) {
    error.value = '请选择任务类型'
    return
  }
  if (!form.value.plotId) {
    error.value = '请选择关联地块'
    return
  }
  try {
    const payload: Record<string, any> = {
      taskName: form.value.taskName.trim(),
      taskType: form.value.taskType,
      farmId: farm.farmId,
      farmName: farm.farmName,
      plotId: form.value.plotId,
      plotName: plotLabel.value,
      planStartDate: form.value.planStartDate,
      planEndDate: form.value.planEndDate,
      priority: form.value.priority,
      description: form.value.description || undefined,
      cropName: plots.value.find((plot) => String(plot.plotId) === String(form.value.plotId))?.currentCrop,
      createdBy: currentUser().realName,
    }
    if (form.value.assigneeId) {
      payload.assigneeId = form.value.assigneeId
      payload.assigneeName = form.value.assigneeName
      // executorId 与 assigneeId 在 PC 端是两个字段名，后端 TaskSaveDTO 两个都收；
      // 都带上，避免"派了人但执行人为空"
      payload.executorId = form.value.assigneeId
      payload.executorName = form.value.assigneeName
    }
    const taskId = await createTask(payload)
    saved.value = true
    uni.showToast({ title: '任务已创建', icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: `/pages/tasks/detail?id=${taskId}` })
    }, 600)
  } catch (err: any) {
    error.value = err?.message ?? '创建失败，请稍后重试'
  }
  } finally { submitting.value = false }
}

onMounted(async () => {
  const farm = await resolveCurrentFarm().catch((e: any) => { error.value = e?.message || '农场加载失败，请稍后重试'; return null })
  if (!farm) return
  try {
    const [plotPage, memberList] = await Promise.all([
      listPlots({ farmId: farm.farmId, pageSize: 100 }),
      listMembers({ farmId: farm.farmId }),
    ])
    plots.value = plotPage.list.map((plot: any) => ({
      ...plot,
      plotId: String(plot.plotId ?? plot.id ?? ''),
    }))
    if (presetPlotId.value && plots.value.some((plot) => String(plot.plotId) === presetPlotId.value)) {
      form.value.plotId = presetPlotId.value
    }
    members.value = memberList
  } catch (err: any) {
    error.value = err?.message ?? '地块 / 人员加载失败'
  }
})
</script>

<style lang="scss" scoped>
.textarea { width: 100%; min-height: 180rpx; padding: 12rpx 0; font-size: 28rpx; line-height: 1.6; }
.form-actions { position: sticky; bottom: 0; z-index: 8; display: flex; flex-direction: column; gap: 10rpx; margin-top: 22rpx; padding: 18rpx 24rpx calc(18rpx + env(safe-area-inset-bottom)); background: rgba(245,247,245,.96); backdrop-filter: blur(14rpx); }
.form-source-note { display: block; text-align: center; padding: 0 48rpx 24rpx; }
</style>
