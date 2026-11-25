<template>
  <div class="mds-page">
    <PageHeader
      title="检测任务"
      subtitle="质量检测任务的调度与执行记录。规则引擎尚未实现：这里的「执行」只登记一次巡检，不做真实规则计算。"
      source="数据治理 · 检测任务"
    />

    <StatGrid :items="statItems" />

    <AgriVueTable
      :columns="columns"
      :data="filteredTasks"
      row-key="id"
      :loading="loading"
      loading-text="正在加载检测任务…"
      column-settings-storage-key="mds:cols:quality-task"
      client-pagination
      @refresh="loadData"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="() => {}" @reset="resetFilter">
          <div class="agri-vue-filter-field">
            <label>任务名称</label>
            <input v-model="filterKeyword" class="mds-input" type="search" placeholder="搜索任务名称" />
          </div>
          <div class="agri-vue-filter-field">
            <label>状态</label>
            <select v-model="filterStatus" class="mds-select">
              <option value="all">全部状态</option>
              <option value="scheduled">待执行</option>
              <option value="running">执行中</option>
              <option value="completed">已完成</option>
              <option value="failed">失败</option>
              <option value="paused">已暂停</option>
            </select>
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <button v-point="'POST /admin/masterdata/quality/tasks'" class="mds-btn mds-btn--primary" @click="openCreate">+ 新建任务</button>
      </template>

      <template #empty>
        <EmptyState
          :title="tasks.length ? '没有符合条件的任务' : '还没有检测任务'"
          :description="tasks.length ? '调整状态或关键字筛选。' : '新建任务并关联至少一条质量规则。'"
        />
      </template>

      <template #cell-name="{ row }">
        <div class="task-name">
          <span>{{ taskIcon(row.type) }}</span>
          <span class="mds-name">{{ row.name }}</span>
        </div>
        <div class="mds-hint mds-mono">{{ row.code }}</div>
      </template>
      <template #cell-ruleNames="{ row }">
        <template v-if="row.ruleNames?.length">
          <StatusTag v-for="name in row.ruleNames" :key="name" :text="name" tone="gray" plain />
        </template>
        <span v-else class="mds-muted">未关联规则</span>
      </template>
      <template #cell-type="{ row }">
        <StatusTag :text="typeText(row.type)" :tone="typeTone(row.type)" plain />
      </template>
      <template #cell-nextRunTime="{ row }">
        <span class="mds-muted">{{ row.nextRunTime || '—' }}</span>
      </template>
      <template #cell-status="{ row }">
        <StatusTag :text="statusText(row.status)" :tone="statusTone(row.status)" />
      </template>
      <template #cell-lastRunTime="{ row }">
        <span class="mds-muted">{{ row.lastRunTime || '—' }}</span>
      </template>
      <template #cell-successRate="{ row }">
        <div class="rate">
          <div class="rate-bar">
            <div class="rate-fill" :class="rateClass(row.successRate)" :style="{ width: (row.successRate ?? 0) + '%' }" />
          </div>
          <span>{{ row.successRate == null ? '—' : row.successRate + '%' }}</span>
        </div>
      </template>
      <template #cell-actions="{ row }">
        <MdsRowActions
          :actions="[
            { key: 'run', label: '执行', point: 'POST /admin/masterdata/quality/tasks/{id}/run', disabled: busyId === row.id || row.status === 'running', onClick: () => runTask(row) },
            { key: 'edit', label: '编辑', point: 'PUT /admin/masterdata/quality/tasks/{id}', onClick: () => editTask(row) },
            { key: 'delete', label: '删除', danger: true, point: 'DELETE /admin/masterdata/quality/tasks/{id}', disabled: busyId === row.id, onClick: () => deleteTask(row) },
          ]"
        />
      </template>
    </AgriVueTable>

    <div v-if="showAddModal" class="mds-mask" @click="closeAddModal">
      <div class="mds-modal" @click.stop>
        <div class="mds-card-head">
          <h2 class="mds-card-title">{{ isEdit ? '编辑任务' : '新建任务' }}</h2>
          <button class="mds-btn mds-btn--link" @click="closeAddModal">关闭</button>
        </div>
        <div class="mds-card-body">
          <div class="mds-form">
            <label class="mds-field">
              <span class="mds-field__label mds-required">任务编码</span>
              <input v-model="form.code" class="mds-input" :disabled="isEdit" placeholder="如 TASK-USER-DAILY" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">任务名称</span>
              <input v-model="form.name" class="mds-input" placeholder="如 用户主数据每日巡检" />
            </label>
            <label class="mds-field">
              <span class="mds-field__label mds-required">执行类型</span>
              <select v-model="form.type" class="mds-select" @change="onTypeChange">
                <option value="manual">手动执行</option>
                <option value="scheduled">定时执行</option>
                <option value="realtime">实时检测</option>
              </select>
            </label>
            <label v-if="form.type === 'scheduled'" class="mds-field">
              <span class="mds-field__label mds-required">执行周期</span>
              <select v-model="form.cronExpression" class="mds-select">
                <option value="0 0 2 * * ?">每天凌晨 2 点</option>
                <option value="0 0 2 * * MON">每周一凌晨 2 点</option>
                <option value="0 0 2 1 * ?">每月 1 日凌晨 2 点</option>
                <option value="0 */30 * * * ?">每 30 分钟</option>
                <option value="0 0 * * * ?">每小时</option>
              </select>
            </label>
            <label class="mds-field">
              <span class="mds-field__label">启用</span>
              <select v-model="form.enabled" class="mds-select">
                <option :value="true">启用</option>
                <option :value="false">暂停</option>
              </select>
            </label>
            <div class="mds-field mds-field--full">
              <span class="mds-field__label mds-required">关联规则（可多选）</span>
              <div v-if="!availableRules.length" class="mds-hint">还没有可用规则，请先到「质量规则」新建。</div>
              <div v-else class="rule-picker">
                <label
                  v-for="rule in availableRules"
                  :key="rule.id"
                  class="rule-option"
                  :class="{ 'is-selected': form.ruleIds.includes(rule.id) }"
                >
                  <input type="checkbox" :checked="form.ruleIds.includes(rule.id)" @change="toggleRule(rule.id)" />
                  <span>{{ rule.name }}</span>
                </label>
              </div>
            </div>
          </div>
          <div class="mds-form-actions">
            <button class="mds-btn" @click="closeAddModal">取消</button>
            <button class="mds-btn mds-btn--primary" :disabled="saving" @click="saveTask">
              {{ saving ? '保存中…' : isEdit ? '保存修改' : '创建任务' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { message } from 'ant-design-vue'
import PageHeader from '@/components/ui/PageHeader.vue'
import StatGrid from '@/components/ui/StatGrid.vue'
import StatusTag from '@/components/ui/StatusTag.vue'
import EmptyState from '@/components/ui/EmptyState.vue'
import MdsRowActions from '@/components/ui/MdsRowActions.vue'
import { AgriVueFilterBar, AgriVueTable } from '@agri/shared/vue/list'

const columns = [
  { prop: 'name', label: '任务名称', width: 200, locked: true, ellipsis: false },
  { prop: 'ruleNames', label: '检测规则', minWidth: 180, ellipsis: false },
  { prop: 'type', label: '执行类型', width: 105, align: 'center', ellipsis: false },
  { prop: 'nextRunTime', label: '下次执行', width: 150 },
  { prop: 'status', label: '状态', width: 96, kind: 'status' },
  { prop: 'lastRunTime', label: '最近执行', width: 150 },
  { prop: 'successRate', label: '成功率', width: 125, align: 'right', ellipsis: false },
  { key: 'actions', label: '操作', width: 120, kind: 'action' },
]

function resetFilter() {
  filterKeyword.value = ''
  filterStatus.value = 'all'
}
import {
  createQualityTask,
  deleteQualityTask,
  getQualityRuleList,
  getQualityTaskList,
  runQualityTask,
  updateQualityTask,
} from '../../utils/api'

const showAddModal = ref(false)
const isEdit = ref(false)
const filterStatus = ref('all')
const filterKeyword = ref('')
const tasks = ref([])
const availableRules = ref([])
const loading = ref(false)
const saving = ref(false)
const busyId = ref(null)

const form = reactive({
  id: null,
  code: '',
  name: '',
  type: 'manual',
  cronExpression: '0 0 2 * * ?',
  ruleIds: [],
  enabled: true,
})

const filteredTasks = computed(() =>
  tasks.value.filter((task) => {
    const matchStatus = filterStatus.value === 'all' || task.status === filterStatus.value
    const matchKeyword =
      !filterKeyword.value || String(task.name || '').toLowerCase().includes(filterKeyword.value.toLowerCase())
    return matchStatus && matchKeyword
  }),
)

const statItems = computed(() => {
  const list = tasks.value
  return [
    { label: '总任务数', value: list.length },
    { label: '执行中', value: list.filter((task) => task.status === 'running').length, tone: 'brand' },
    { label: '已完成', value: list.filter((task) => task.status === 'completed').length },
    {
      label: '失败',
      value: list.filter((task) => task.status === 'failed').length,
      tone: list.some((task) => task.status === 'failed') ? 'danger' : undefined,
    },
  ]
})

const TYPE_META = {
  manual: { icon: '▶️', text: '手动', tone: 'gray' },
  scheduled: { icon: '⏰', text: '定时', tone: 'warning' },
  realtime: { icon: '⚡', text: '实时', tone: 'success' },
}
const taskIcon = (type) => TYPE_META[type]?.icon ?? '📋'
const typeText = (type) => TYPE_META[type]?.text ?? type ?? '—'
const typeTone = (type) => TYPE_META[type]?.tone ?? 'gray'

const STATUS_TEXT = {
  scheduled: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  paused: '已暂停',
}
const STATUS_TONE = { scheduled: 'info', running: 'brand', completed: 'success', failed: 'danger', paused: 'gray' }
const statusText = (status) => STATUS_TEXT[status] ?? status ?? '—'
const statusTone = (status) => STATUS_TONE[status] ?? 'gray'

/** 成功率为 null 时不套配色：原来 null 落到 poor 的红色，把「暂无数据」画成了「差」 */
const rateClass = (rate) => {
  if (rate == null) return ''
  if (rate >= 95) return 'excellent'
  if (rate >= 90) return 'good'
  if (rate >= 80) return 'normal'
  return 'poor'
}

const toggleRule = (ruleId) => {
  const index = form.ruleIds.indexOf(ruleId)
  if (index === -1) form.ruleIds.push(ruleId)
  else form.ruleIds.splice(index, 1)
}

const onTypeChange = () => {
  if (form.type === 'scheduled') form.cronExpression = '0 0 2 * * ?'
}

/** 接口行 → 页面行（接口字段是 taskName / taskType / runCount / lastFailCount） */
const toRow = (row) => ({
  id: row.id,
  code: row.taskCode,
  name: row.taskName,
  type: row.taskType || 'manual',
  ruleIds: row.ruleIds ?? [],
  ruleNames: row.ruleNames ?? [],
  nextRunTime: row.nextRunTime,
  status: row.status || 'scheduled',
  lastRunTime: row.lastRunTime,
  successRate: row.successRate,
  runCount: row.runCount ?? 0,
  lastFailCount: row.lastFailCount,
  cronExpression: row.cronExpression,
})

const loadData = async () => {
  loading.value = true
  try {
    const [taskRes, ruleRes] = await Promise.all([getQualityTaskList(), getQualityRuleList()])
    if (taskRes.code !== 200) throw new Error(taskRes.message || '加载检测任务失败')
    tasks.value = (taskRes.data ?? []).map(toRow)
    if (ruleRes.code === 200) {
      availableRules.value = (ruleRes.data ?? []).map((rule) => ({ id: rule.id, name: rule.ruleName }))
    }
  } catch (error) {
    tasks.value = []
    message.error(error instanceof Error ? error.message : '加载检测任务失败')
  } finally {
    loading.value = false
  }
}

const resetForm = () => {
  Object.assign(form, {
    id: null,
    code: '',
    name: '',
    type: 'manual',
    cronExpression: '0 0 2 * * ?',
    ruleIds: [],
    enabled: true,
  })
}

const openCreate = () => {
  resetForm()
  isEdit.value = false
  showAddModal.value = true
}

const editTask = (task) => {
  isEdit.value = true
  Object.assign(form, {
    id: task.id,
    code: task.code,
    name: task.name,
    type: task.type,
    cronExpression: task.cronExpression || '0 0 2 * * ?',
    ruleIds: [...task.ruleIds],
    enabled: task.status !== 'paused',
  })
  showAddModal.value = true
}

const closeAddModal = () => {
  showAddModal.value = false
  isEdit.value = false
}

const deleteTask = async (task) => {
  if (!window.confirm(`确定删除任务「${task.name}」吗？`)) return
  busyId.value = task.id
  try {
    const response = await deleteQualityTask(task.id)
    if (response.code !== 200) throw new Error(response.message || '删除失败')
    message.success('任务已删除')
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败')
  } finally {
    busyId.value = null
  }
}

const runTask = async (task) => {
  busyId.value = task.id
  try {
    const response = await runQualityTask(task.id)
    if (response.code !== 200) throw new Error(response.message || '触发失败')
    // 如实说明这一步做了什么：只记录了一次巡检，检测引擎尚未实现
    message.success(
      `已记录一次巡检（关联 ${response.data?.lastSuccessCount ?? 0} 条规则；检测引擎尚未实现，非真实规则计算）`,
    )
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '触发失败')
  } finally {
    busyId.value = null
  }
}

const saveTask = async () => {
  if (!form.code.trim()) {
    message.warning('请填写任务编码')
    return
  }
  if (!form.name.trim() || form.ruleIds.length === 0) {
    message.warning('请填写任务名称并选择至少一个检测规则')
    return
  }
  saving.value = true
  const payload = {
    taskCode: form.code.trim(),
    taskName: form.name.trim(),
    taskType: form.type,
    cronExpression: form.type === 'scheduled' ? form.cronExpression : null,
    status: form.enabled ? 'scheduled' : 'paused',
    ruleIds: form.ruleIds,
  }
  try {
    const response = isEdit.value
      ? await updateQualityTask(form.id, payload)
      : await createQualityTask(payload)
    if (response.code !== 200) throw new Error(response.message || '保存失败')
    message.success(isEdit.value ? '任务已更新' : '任务已创建')
    closeAddModal()
    await loadData()
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(loadData)
</script>

<style scoped>
.task-table {
  min-width: 1080px;
}

.task-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rate {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12.5px;
  color: var(--mds-text-2);
}

.rate-bar {
  width: 60px;
  height: 6px;
  border-radius: 3px;
  background: var(--mds-line-soft);
  overflow: hidden;
}

.rate-fill {
  height: 100%;
  border-radius: 3px;
  background: var(--mds-line);
}

.rate-fill.excellent {
  background: var(--mds-brand);
}

.rate-fill.good {
  background: #5bb98a;
}

.rate-fill.normal {
  background: var(--mds-warning);
}

.rate-fill.poor {
  background: var(--mds-danger);
}

.rule-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.rule-option {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid #d7dbe0;
  border-radius: 6px;
  font-size: 12.5px;
  cursor: pointer;
}

.rule-option.is-selected {
  border-color: var(--mds-brand);
  background: var(--mds-brand-soft);
  color: var(--mds-brand-deep);
}

.mds-mask {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
  padding: 20px;
}

.mds-modal {
  width: 720px;
  max-width: 100%;
  max-height: 88vh;
  overflow: auto;
  border-radius: var(--mds-radius);
  background: var(--mds-card);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
}
</style>
