<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="安全风控"
      title="账号冻结与解封"
      :description="`当前筛选 ${total} 条 · 冻结会同时改 platform_user.status，两处必须一致 · 申诉受理即解封`"
    />

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <AgriAntdvListTable
      v-else
      :columns="columns"
      :data="rows"
      row-key="id"
      :loading="loading"
      :page="pageNum"
      :page-size="pageSize"
      :total="total"
      column-settings-storage-key="uc-ops:account-freezes"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="3" :loading="loading" @search="submitSearch" @reset="resetFilters">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <a-input
              v-model:value="draft"
              allow-clear
              placeholder="搜账号 / 原因"
              @press-enter="submitSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>冻结状态</label>
            <a-select
              v-model:value="status"
              :options="statusOptions"
              @change="pageNum = 1"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>申诉状态</label>
            <a-select
              v-model:value="appealStatus"
              :options="appealOptions"
              @change="pageNum = 1"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <a-button type="primary" danger @click="createOpen = true">＋ 手动冻结</a-button>
      </template>

      <template #cell-username="{ value, record }">
        <div>
          <b>{{ value || `用户 ${record.userId}` }}</b>
          <div class="small muted">{{ record.userId }}</div>
        </div>
      </template>
      <template #cell-freezeType="{ value }">
        <a-tag class="soft-tag tone-up">{{ FREEZE_TYPE_LABEL[String(value ?? '')] ?? value }}</a-tag>
      </template>
      <template #cell-reason="{ value }">
        <span class="small">{{ value || '—' }}</span>
      </template>
      <template #cell-freezeTime="{ value }">{{ formatTime(String(value ?? '')) }}</template>
      <template #cell-expireTime="{ value }">{{ value ? formatTime(String(value)) : '永久' }}</template>
      <template #cell-status="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
      <template #cell-operatorName="{ value }">{{ value || '—' }}</template>
      <template #cell-appealStatus="{ value, record }">
        <span v-if="!value || value === 'none'" class="small muted">未申诉</span>
        <div v-else>
          <StatusTag :status="String(value)" />
          <div v-if="record.appealReason" class="small muted" style="margin-top: 4px">
            {{ String(record.appealReason).slice(0, 28) }}{{ String(record.appealReason).length > 28 ? '…' : '' }}
          </div>
          <div v-if="record.appealRemark" class="small muted">处理意见：{{ String(record.appealRemark).slice(0, 24) }}</div>
        </div>
      </template>
      <template #cell-action="{ record }">
        <AgriVueRowActions v-if="rowActions(record as FreezeRecord).length" :actions="rowActions(record as FreezeRecord)" />
        <span v-else class="small muted">{{ formatTime(String(record.unfreezeTime ?? '')) }}</span>
      </template>
    </AgriAntdvListTable>

    <a-modal
      v-model:open="createOpen"
      title="手动冻结账号"
      :confirm-loading="creating"
      ok-text="确认冻结"
      :ok-button-props="{ danger: true }"
      @ok="freeze"
    >
      <a-form ref="formRef" :model="formState" layout="vertical" style="margin-top: 12px">
        <a-form-item
          name="userId"
          label="用户 ID"
          :rules="[{ required: true, message: '请填写用户 ID（雪花 ID，可从用户详情页复制）' }]"
        >
          <a-input v-model:value="formState.userId" placeholder="19 位用户 ID" />
        </a-form-item>
        <a-form-item name="freezeType" label="冻结类型">
          <a-select v-model:value="formState.freezeType" :options="freezeTypeOptions" />
        </a-form-item>
        <a-form-item name="reason" label="冻结原因" :rules="[{ required: true, message: '请填写原因' }]">
          <a-textarea v-model:value="formState.reason" :rows="3" placeholder="会记入冻结记录，用于后续申诉核对" />
        </a-form-item>
      </a-form>
      <div class="uc-inline-note">
        冻结会同时把 <code>platform_user.status</code> 置 0，账号立即无法登录。
        解封时两处一起恢复 —— 只改一处会出现「记录说冻了、人还能登」。
      </div>
    </a-modal>

    <a-modal
      :open="Boolean(unfreezeTarget)"
      :title="`解封：${unfreezeTarget?.username ?? ''}`"
      ok-text="确认解封"
      @cancel="unfreezeTarget = null"
      @ok="unfreeze"
    >
      <div class="stack" style="margin-top: 12px">
        <div class="small muted">冻结原因：{{ unfreezeTarget?.reason || '—' }}</div>
        <a-textarea v-model:value="remark" :rows="3" placeholder="解封说明（如申诉通过、误判等）" />
      </div>
    </a-modal>

    <a-modal
      :open="Boolean(appealTarget)"
      :title="`处理申诉：${appealTarget?.username ?? ''}`"
      :confirm-loading="appealBusy"
      :ok-text="appealPass ? '受理并解封' : '驳回申诉'"
      :ok-button-props="{ danger: !appealPass }"
      :width="560"
      @cancel="appealTarget = null"
      @ok="submitAppeal"
    >
      <div class="stack" style="margin-top: 12px">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="冻结类型">
            {{ FREEZE_TYPE_LABEL[appealTarget?.freezeType ?? ''] ?? appealTarget?.freezeType ?? '—' }}
          </a-descriptions-item>
          <a-descriptions-item label="冻结原因">{{ appealTarget?.reason || '—' }}</a-descriptions-item>
          <a-descriptions-item label="冻结时间">{{ formatTime(appealTarget?.freezeTime) }}</a-descriptions-item>
          <a-descriptions-item label="申诉提交">{{ formatTime(appealTarget?.appealTime) }}</a-descriptions-item>
          <a-descriptions-item label="申诉理由">{{ appealTarget?.appealReason || '—' }}</a-descriptions-item>
        </a-descriptions>
        <a-select
          :value="appealPass ? 'pass' : 'reject'"
          style="width: 100%"
          :options="[
            { label: '受理（复核通过，立即解封）', value: 'pass' },
            { label: '驳回（账号保持冻结）', value: 'reject' },
          ]"
          @change="(val: unknown) => { appealPass = val === 'pass' }"
        />
        <a-textarea
          v-model:value="appealRemark"
          :rows="3"
          :placeholder="appealPass ? '受理说明（可选）' : '驳回理由（必填，用户需要知道为什么）'"
        />
        <div class="small muted">
          受理会同时解除冻结并恢复账号可用（与「解封」走同一段逻辑）；
          驳回则保持冻结，但申诉状态改为「已驳回」，用户可补充说明后重新提交。
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { message, type FormInstance } from 'ant-design-vue'
import {
  AgriAntdvListTable,
  AgriVueFilterBar,
  AgriVueRowActions,
  type VueListColumn,
  type VueRowActionItem,
} from '@agri/shared/vue/antdv'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'
import { FREEZE_TYPE_LABEL, formatTime } from '../components/ui-constants'
import type { FreezeRecord } from '../types'

const statusOptions = [
  { label: '冻结中', value: 'frozen' },
  { label: '已解封', value: 'unfrozen' },
  { label: '全部状态', value: '' },
]

const appealOptions = [
  { label: '申诉中', value: 'appealing' },
  { label: '申诉已受理', value: 'accepted' },
  { label: '申诉已驳回', value: 'rejected' },
  { label: '全部申诉', value: '' },
]

const freezeTypeOptions = Object.entries(FREEZE_TYPE_LABEL).map(([value, label]) => ({ value, label }))

const columns: VueListColumn[] = [
  { key: 'username', prop: 'username', label: '账号', width: 180 },
  { key: 'freezeType', prop: 'freezeType', label: '冻结类型', width: 120 },
  { key: 'reason', prop: 'reason', label: '原因', width: 200 },
  { key: 'freezeTime', prop: 'freezeTime', label: '冻结时间', width: 160 },
  { key: 'expireTime', prop: 'expireTime', label: '期限', width: 150 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'operatorName', prop: 'operatorName', label: '操作人', width: 100 },
  { key: 'appealStatus', prop: 'appealStatus', label: '申诉', width: 210 },
  { key: 'action', label: '操作', width: 150, fixed: 'right' },
]

const rows = ref<FreezeRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const draft = ref('')
const keyword = ref('')
const status = ref('frozen')
const appealStatus = ref('appealing')
const loading = ref(true)
const error = ref('')
const createOpen = ref(false)
const creating = ref(false)
const unfreezeTarget = ref<FreezeRecord | null>(null)
const remark = ref('')
const appealTarget = ref<FreezeRecord | null>(null)
const appealPass = ref(true)
const appealRemark = ref('')
const appealBusy = ref(false)
const formRef = ref<FormInstance>()

const formState = reactive({
  userId: '',
  freezeType: 'violation',
  reason: '',
})

function load() {
  loading.value = true
  error.value = ''
  ucApi.freezes({
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    keyword: keyword.value || undefined,
    status: status.value || undefined,
    appealStatus: appealStatus.value || undefined,
  })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, keyword, status, appealStatus], load, { immediate: true })

function submitSearch() {
  const next = draft.value.trim()
  const same = keyword.value === next && pageNum.value === 1
  keyword.value = next
  pageNum.value = 1
  if (same) load()
}

function resetFilters() {
  const same = !draft.value && !keyword.value && status.value === 'frozen' && appealStatus.value === 'appealing' && pageNum.value === 1
  draft.value = ''
  keyword.value = ''
  status.value = 'frozen'
  appealStatus.value = 'appealing'
  pageNum.value = 1
  if (same) load()
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}

function rowActions(row: FreezeRecord): VueRowActionItem[] {
  const list: VueRowActionItem[] = []
  if (row.appealStatus === 'appealing') {
    list.push({ key: 'appeal', label: '处理申诉', onClick: () => openAppeal(row) })
  }
  if (row.status === 'frozen') {
    list.push({ key: 'unfreeze', label: '解封', onClick: () => { unfreezeTarget.value = row } })
  }
  return list
}

function freeze() {
  formRef.value?.validate()
    .then(() => {
      creating.value = true
      return ucApi.freeze({ ...formState })
    })
    .then(() => {
      message.success('账号已冻结，同时置为停用状态')
      createOpen.value = false
      formRef.value?.resetFields()
      load()
    })
    .catch((reason: Error) => {
      if (reason?.message) message.error(reason.message)
    })
    .finally(() => { creating.value = false })
}

function openAppeal(row: FreezeRecord) {
  appealTarget.value = row
  appealPass.value = true
  appealRemark.value = ''
}

function submitAppeal() {
  if (!appealTarget.value) return
  if (!appealPass.value && !appealRemark.value.trim()) {
    message.warning('驳回申诉必须填写理由')
    return
  }
  appealBusy.value = true
  ucApi.handleAppeal(String(appealTarget.value.id), appealPass.value, appealRemark.value.trim())
    .then((result) => {
      message.success(result.message)
      appealTarget.value = null
      appealRemark.value = ''
      load()
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { appealBusy.value = false })
}

function unfreeze() {
  if (!unfreezeTarget.value) return
  ucApi.unfreeze(String(unfreezeTarget.value.id), remark.value)
    .then(() => {
      message.success('已解封，账号恢复可用')
      unfreezeTarget.value = null
      remark.value = ''
      load()
    })
    .catch((reason: Error) => message.error(reason.message))
}
</script>
