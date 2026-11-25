<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="第三方授权"
      title="第三方应用"
      :description="`已登记 ${total} 个应用 · 当前页待审 ${pendingCount} 个 · 审核通过后用户才能在其授权页看到`"
    >
      <template #actions>
        <a-select
          :value="status"
          style="width: 150px"
          :options="statusOptions"
          @change="(val: string) => { status = val; pageNum = 1 }"
        />
        <a-button type="primary" @click="createOpen = true">＋ 登记应用</a-button>
      </template>
    </PageTitle>

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <section class="surface-card">
      <a-table
        row-key="id"
        size="middle"
        :loading="loading"
        :data-source="rows"
        :scroll="{ x: 1240 }"
        :columns="columns"
        :pagination="{
          current: pageNum,
          pageSize: 20,
          total,
          showTotal: (count: number) => `共 ${count} 个应用`,
          onChange: (next: number) => { pageNum = next },
        }"
      >
        <template #bodyCell="{ column, record, text }">
          <div v-if="column.key === 'appName'">
            <b>{{ text }}</b>
            <div class="small muted">{{ record.appKey }}</div>
          </div>
          <template v-else-if="column.key === 'appType'">{{ APP_TYPE_LABEL[text] ?? text }}</template>
          <template v-else-if="column.key === 'applicant'">{{ text || '—' }}</template>
          <div v-else-if="column.key === 'scopes'" class="tag-row">
            <a-tag v-for="scope in splitScopes(text)" :key="scope" class="soft-tag">{{ scope }}</a-tag>
            <span v-if="!text" class="small muted">—</span>
          </div>
          <div v-else-if="column.key === 'callCount'">
            {{ text?.toLocaleString() ?? 0 }}
            <div v-if="record.lastCallAt" class="small muted">{{ formatTime(record.lastCallAt) }}</div>
          </div>
          <StatusTag v-else-if="column.key === 'status'" :status="text" />
          <template v-else-if="column.key === 'action'">
            <a-button v-if="record.status === 'pending'" size="small" type="primary" ghost @click="reviewTarget = record as ThirdPartyApp">
              审核
            </a-button>
            <span v-else class="small muted">{{ record.reviewerName || '—' }}</span>
          </template>
        </template>
      </a-table>
    </section>

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

const columns = [
  { title: '应用', dataIndex: 'appName', key: 'appName' },
  { title: '类型', dataIndex: 'appType', key: 'appType', width: 110 },
  { title: '申请方', dataIndex: 'applicant', key: 'applicant', width: 160 },
  { title: '授权范围', dataIndex: 'scopes', key: 'scopes' },
  { title: '调用量', dataIndex: 'callCount', key: 'callCount', width: 120 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 110 },
]

const rows = ref<ThirdPartyApp[]>([])
const total = ref(0)
const pageNum = ref(1)
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
  ucApi.authApps({ pageNum: pageNum.value, pageSize: 20, status: status.value || undefined })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, status], load, { immediate: true })

const pendingCount = computed(() => rows.value.filter((row) => row.status === 'pending').length)

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
