<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="第三方授权"
      title="第三方应用"
      :description="`已登记 ${total} 个应用 · 当前页待审 ${pendingCount} 个 · 审核通过后用户才能在其授权页看到`"
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
      total-unit="个应用"
      column-settings-storage-key="uc-ops:auth-apps"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="submitSearch" @reset="resetFilters">
          <div class="agri-vue-filter-field">
            <label>关键字</label>
            <a-input
              v-model:value="draft"
              allow-clear
              placeholder="搜应用名称 / 标识 / 申请方"
              @press-enter="submitSearch"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>上架状态</label>
            <a-select
              v-model:value="status"
              :options="statusOptions"
              @change="pageNum = 1"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #toolbar-left>
        <a-button type="primary" @click="createOpen = true">＋ 登记应用</a-button>
      </template>

      <template #cell-appName="{ value, record }">
        <div>
          <b>{{ value }}</b>
          <div class="small muted">{{ record.appKey }}</div>
        </div>
      </template>
      <template #cell-appType="{ value }">
        {{ APP_TYPE_LABEL[String(value ?? '')] ?? value }}
      </template>
      <template #cell-applicant="{ value }">{{ value || '—' }}</template>
      <template #cell-scopes="{ value }">
        <div class="tag-row">
          <a-tag v-for="scope in splitScopes(String(value ?? ''))" :key="scope" class="soft-tag">{{ scope }}</a-tag>
          <span v-if="!value" class="small muted">—</span>
        </div>
      </template>
      <template #cell-callCount="{ value, record }">
        <div>
          {{ Number(value ?? 0).toLocaleString() }}
          <div v-if="record.lastCallAt" class="small muted">{{ formatTime(String(record.lastCallAt)) }}</div>
        </div>
      </template>
      <template #cell-status="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
      <template #cell-action="{ record }">
        <AgriVueRowActions
          v-if="record.status === 'pending'"
          :actions="[{ key: 'review', label: '审核', onClick: () => { reviewTarget = record as ThirdPartyApp } }]"
        />
        <span v-else class="small muted">{{ record.reviewerName || '—' }}</span>
      </template>
    </AgriAntdvListTable>

    <a-modal
      v-model:open="createOpen"
      title="登记第三方应用"
      :confirm-loading="creating"
      ok-text="提交登记"
      :width="560"
      @ok="create"
    >
      <a-form ref="formRef" :model="formState" layout="vertical" style="margin-top: 12px">
        <a-form-item name="appKey" label="应用标识" :rules="[{ required: true, message: '请填写应用标识' }]">
          <a-input v-model:value="formState.appKey" placeholder="如 trace-open，小写字母与连字符" />
        </a-form-item>
        <a-form-item name="appName" label="应用名称" :rules="[{ required: true, message: '请填写应用名称' }]">
          <a-input v-model:value="formState.appName" placeholder="如 溯源小程序开放接口" />
        </a-form-item>
        <a-form-item name="appType" label="应用类型">
          <a-select v-model:value="formState.appType" :options="appTypeOptions" />
        </a-form-item>
        <a-form-item name="applicant" label="申请方">
          <a-input v-model:value="formState.applicant" placeholder="单位或团队名称" />
        </a-form-item>
        <a-form-item name="scopes" label="授权范围">
          <a-input v-model:value="formState.scopes" placeholder="逗号分隔，如 user:read,order:read" />
        </a-form-item>
        <a-form-item name="redirectUri" label="回调地址">
          <a-input v-model:value="formState.redirectUri" placeholder="https://example.com/cb" />
        </a-form-item>
      </a-form>
      <div class="uc-inline-note">
        登记后状态为「待审核」，不会立即对用户可见。审核通过才上架 ——
        应用一旦能拿到 <code>user:read</code>，就等于能读用户的资料。
      </div>
    </a-modal>

    <a-modal
      :open="Boolean(reviewTarget)"
      :title="`应用上架审核：${reviewTarget?.appName ?? ''}`"
      @cancel="reviewTarget = null"
    >
      <template #footer>
        <a-button danger @click="review(false)">驳回</a-button>
        <a-button type="primary" @click="review(true)">通过并上架</a-button>
      </template>
      <div class="stack" style="margin-top: 12px">
        <div class="small muted">
          申请方：{{ reviewTarget?.applicant || '—' }} · 授权范围：{{ reviewTarget?.scopes || '—' }}
        </div>
        <a-textarea v-model:value="remark" :rows="3" placeholder="审核意见（驳回时建议写明原因）" />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { message, type FormInstance } from 'ant-design-vue'
import {
  AgriAntdvListTable,
  AgriVueFilterBar,
  AgriVueRowActions,
  type VueListColumn,
} from '@agri/shared/vue/antdv'
import { ucApi } from '../api'
import ErrorBlock from '../components/ErrorBlock.vue'
import PageTitle from '../components/PageTitle.vue'
import StatusTag from '../components/StatusTag.vue'
import { formatTime } from '../components/ui-constants'
import type { ThirdPartyApp } from '../types'

const APP_TYPE_LABEL: Record<string, string> = {
  internal: '内部系统',
  partner: '合作机构',
  open: '开放平台',
}

const appTypeOptions = Object.entries(APP_TYPE_LABEL).map(([value, label]) => ({ value, label }))
const statusOptions = [
  { label: '全部状态', value: '' },
  { label: '待审核', value: 'pending' },
  { label: '已上架', value: 'online' },
  { label: '已驳回', value: 'rejected' },
  { label: '已下架', value: 'offline' },
]

const columns: VueListColumn[] = [
  { key: 'appName', prop: 'appName', label: '应用', minWidth: 200 },
  { key: 'appType', prop: 'appType', label: '类型', width: 110 },
  { key: 'applicant', prop: 'applicant', label: '申请方', width: 160 },
  { key: 'scopes', prop: 'scopes', label: '授权范围', minWidth: 200 },
  { key: 'callCount', prop: 'callCount', label: '调用量', width: 130 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'action', label: '操作', width: 110, fixed: 'right' },
]

const rows = ref<ThirdPartyApp[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const draft = ref('')
const keyword = ref('')
const status = ref('')
const loading = ref(true)
const error = ref('')
const createOpen = ref(false)
const creating = ref(false)
const reviewTarget = ref<ThirdPartyApp | null>(null)
const remark = ref('')
const formRef = ref<FormInstance>()

const formState = reactive({
  appKey: '',
  appName: '',
  appType: 'partner',
  applicant: '',
  scopes: '',
  redirectUri: '',
})

function splitScopes(val?: string | null): string[] {
  return (val || '').split(',').map((s) => s.trim()).filter(Boolean)
}

function load() {
  loading.value = true
  error.value = ''
  ucApi.authApps({
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    keyword: keyword.value || undefined,
    status: status.value || undefined,
  })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, keyword, status], load, { immediate: true })

const pendingCount = computed(() => rows.value.filter((row) => row.status === 'pending').length)

function submitSearch() {
  const next = draft.value.trim()
  const same = keyword.value === next && pageNum.value === 1
  keyword.value = next
  pageNum.value = 1
  if (same) load()
}

function resetFilters() {
  const same = !draft.value && !keyword.value && !status.value && pageNum.value === 1
  draft.value = ''
  keyword.value = ''
  status.value = ''
  pageNum.value = 1
  if (same) load()
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}

function create() {
  formRef.value?.validate()
    .then(() => {
      creating.value = true
      return ucApi.createAuthApp({ ...formState })
    })
    .then(() => {
      message.success('应用已登记，等待审核上架')
      createOpen.value = false
      formRef.value?.resetFields()
      load()
    })
    .catch((reason: Error) => {
      if (reason?.message) message.error(reason.message)
    })
    .finally(() => { creating.value = false })
}

function review(approved: boolean) {
  if (!reviewTarget.value) return
  ucApi.reviewAuthApp(String(reviewTarget.value.id), approved, remark.value)
    .then(() => {
      message.success(approved ? '已上架该应用' : '已驳回该应用')
      reviewTarget.value = null
      remark.value = ''
      load()
    })
    .catch((reason: Error) => message.error(reason.message))
}
</script>
