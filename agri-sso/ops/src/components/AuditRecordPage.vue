<template>
  <div class="page-stack">
    <PageTitle eyebrow="认证审核" :title="title" :description="description" />

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
      :column-settings-storage-key="`uc-ops:audit:${kind}`"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="filterCount" :loading="loading" @search="search" @reset="resetFilters">
          <div v-if="kind === 'identity' || kind === 'qualification' || kind === 'org'" class="agri-vue-filter-field">
            <label>{{ kind === 'qualification' ? '主体名称' : '关键字' }}</label>
            <a-input
              v-model:value="draft"
              allow-clear
              :placeholder="keywordPlaceholder"
              @press-enter="search"
            />
          </div>
          <div v-if="kind === 'identity'" class="agri-vue-filter-field">
            <label>申请身份</label>
            <a-select
              v-model:value="identityType"
              :options="[{ label: '全部身份', value: '' }, ...IDENTITY_TYPE_OPTIONS]"
              @change="onFilterChange"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>审核状态</label>
            <a-select
              v-model:value="status"
              :options="statusOptions"
              @change="onFilterChange"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-status="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
      <template #cell-time="{ value, record }">
        {{ formatTime(String(value || record.createdAt || '')) }}
      </template>
      <template #cell-identityType="{ value }">
        {{ identityTypeText(String(value ?? '')) }}
      </template>
      <template #cell-verification="{ record }">
        <a-tag :class="`soft-tag tone-${record.policeVerified ? 'green' : 'default'}`">
          公安{{ record.policeVerified ? '通过' : '未过' }}
        </a-tag>
        <a-tag :class="`soft-tag tone-${record.livenessVerified ? 'green' : 'default'}`">
          活体{{ record.livenessVerified ? '通过' : '未过' }}
        </a-tag>
      </template>
      <template #cell-name="{ value, record }">
        <div>
          <b>{{ kind === 'identity' ? record.applicantName || `用户 ${record.userId}` : value || record.companyName || '—' }}</b>
          <div class="small muted">{{ kind === 'identity' ? `单号 ${record.id}` : record.code || '' }}</div>
        </div>
      </template>
      <template #cell-subject="{ value, record }">
        <div>
          <b>{{ value || '—' }}</b>
          <div class="small muted">{{ record.creditCode || '未填信用代码' }}</div>
        </div>
      </template>
      <template #cell-contact="{ value, record }">
        <div>
          {{ value || '—' }}
          <div class="small muted">{{ record.contactPhone || '—' }}</div>
        </div>
      </template>
      <template #cell-action="{ record }">
        <AgriVueRowActions v-if="rowActions(record).length" :actions="rowActions(record)" />
        <span v-else class="small muted">{{ record.reviewerName || record.reviewer || '已处理' }}</span>
      </template>
    </AgriAntdvListTable>

    <a-modal
      :open="!!target"
      :width="kind === 'identity' ? 760 : 560"
      :title="`${title}：${target?.subjectName || target?.merchantName || target?.realName || ''}`"
      :confirm-loading="submitting"
      ok-text="提交审核"
      :ok-button-props="{ danger: !approved, disabled: !target || !canReview(target) }"
      @cancel="target = null"
      @ok="submit"
    >
      <template v-if="target">
        <a-descriptions v-if="kind === 'identity'" :column="2" bordered size="small">
          <a-descriptions-item
            v-for="field in detailFields"
            :key="field.key"
            :label="field.label"
            :span="field.span || 1"
          >
            {{ detailValue(field.key) }}
          </a-descriptions-item>
        </a-descriptions>
        <div v-if="!canReview(target)" class="small muted" style="margin-top: 12px">
          审核人：{{ target.reviewerName || '—' }}　审核时间：{{ formatTime(target.reviewTime) }}<br />
          审核意见：{{ target.reviewRemark || '—' }}
        </div>
        <div v-else class="stack" style="margin-top: 12px">
          <a-select
            :value="approved ? 'pass' : 'reject'"
            :options="[{ label: '通过', value: 'pass' }, { label: '驳回', value: 'reject' }]"
            @change="(v: unknown) => { approved = v === 'pass' }"
          />
          <a-textarea
            v-model:value="remark"
            :rows="4"
            :placeholder="approved ? '审核意见（可选）' : '驳回理由（会回传给申请人）'"
          />
          <p class="small muted">
            审核结果记录审核人、时间和意见。{{ kind === 'identity' ? '通过后申请状态变为 approved，不自动开通 RBAC 权限。' : '沿用原有审核接口。' }}
          </p>
        </div>
      </template>
      <template v-if="target && !canReview(target)" #footer>
        <a-button @click="target = null">关闭</a-button>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import {
  AgriAntdvListTable,
  AgriVueFilterBar,
  AgriVueRowActions,
  type VueListColumn,
  type VueRowActionItem,
} from '@agri/shared/vue/antdv'
import { ucApi } from '../api'
import { useAppStore } from '../app-context'
import PageTitle from './PageTitle.vue'
import ErrorBlock from './ErrorBlock.vue'
import StatusTag from './StatusTag.vue'
import { formatTime, identityTypeText, IDENTITY_TYPE_OPTIONS } from './ui-constants'
import type { IdentityApplication, IdentityRecord, CertificationRecord, OrgRecord } from '../types'

type Row = IdentityApplication | IdentityRecord | CertificationRecord | OrgRecord

const props = defineProps<{ kind: 'identity' | 'realname' | 'qualification' | 'org' }>()
const app = useAppStore()
const rows = ref<Row[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const status = ref('pending')
const identityType = ref('')
const keyword = ref('')
const draft = ref('')
const loading = ref(false)
const error = ref('')
const target = ref<Record<string, any> | null>(null)
const approved = ref(true)
const remark = ref('')
const submitting = ref(false)

const title = computed(() => ({
  identity: '身份申请审核',
  realname: '实名认证审核',
  qualification: '资质审核',
  org: '组织认证审核',
}[props.kind]))

const description = computed(() => ({
  identity: '审核业务身份申请；通过不自动开通 RBAC 权限',
  realname: '证件号已转为掩码与哈希，运营端不显示明文',
  qualification: '经营主体材料审核；通过后主体认证状态变 approved',
  org: '主体认证状态总览；具体材料审核请进入资质审核',
}[props.kind]))

const filterCount = computed(() => {
  if (props.kind === 'identity') return 3
  if (props.kind === 'realname') return 1
  return 2
})

const keywordPlaceholder = computed(() => {
  if (props.kind === 'identity') return '搜申请人 / 主体名称 / 信用代码 / 电话'
  if (props.kind === 'qualification') return '搜经营主体名称'
  return '搜组织名称 / 编码 / 信用代码'
})

const statusOptions = computed(() => [
  { label: props.kind === 'org' ? '待认证' : '待审核', value: 'pending' },
  { label: '已通过', value: props.kind === 'realname' ? 'verified' : 'approved' },
  { label: '已驳回', value: 'rejected' },
  ...(props.kind === 'identity' ? [{ label: '已撤回', value: 'cancelled' }] : []),
  { label: '全部状态', value: '' },
])

const col = (label: string, prop: string, key = prop, width = 150): VueListColumn => ({
  key,
  prop: prop || undefined,
  label,
  width,
})

const columns = computed<VueListColumn[]>(() => {
  const tail: VueListColumn[] = [
    col('状态', props.kind === 'qualification' ? 'certStatus' : props.kind === 'org' ? 'verifyStatus' : 'status', 'status', 110),
    { key: 'action', label: '操作', width: 110, fixed: 'right' },
  ]
  if (props.kind === 'identity') {
    return [
      col('申请人', 'applicantName', 'name', 170),
      col('申请身份', 'identityType', 'identityType', 120),
      col('主体名称 / 信用代码', 'subjectName', 'subject', 220),
      col('联系人', 'contactName', 'contact', 150),
      col('申请时间', 'applyTime', 'time', 160),
      ...tail,
    ]
  }
  if (props.kind === 'realname') {
    return [
      col('真实姓名', 'realName', 'name', 130),
      col('证件号（掩码）', 'idNoMasked', 'idNoMasked', 180),
      col('公安库 / 活体', '', 'verification', 180),
      col('联系方式', 'contactPhone', 'contactPhone', 150),
      col('提交时间', 'submitTime', 'time', 160),
      ...tail,
    ]
  }
  if (props.kind === 'qualification') {
    return [
      col('主体名称', 'merchantName', 'subject', 220),
      col('证书编号', 'certNo', 'certNo', 160),
      col('法人', 'legalPerson', 'legalPerson', 120),
      col('联系人', 'contactName', 'contact', 150),
      col('提交时间', 'submitTime', 'time', 160),
      ...tail,
    ]
  }
  return [
    col('组织', 'name', 'name', 240),
    col('信用代码', 'creditCode', 'creditCode', 200),
    col('联系人', 'contactName', 'contactName', 140),
    col('创建时间', 'createdAt', 'time', 160),
    ...tail,
  ]
})

const detailFields = [
  { key: 'applicantName', label: '申请人' },
  { key: 'id', label: '申请单号' },
  { key: 'identityType', label: '申请身份' },
  { key: 'status', label: '当前状态' },
  { key: 'subjectName', label: '主体名称' },
  { key: 'creditCode', label: '统一社会信用代码' },
  { key: 'businessPlace', label: '经营地' },
  { key: 'businessCategory', label: '经营范围' },
  { key: 'annualVolume', label: '年交易量' },
  { key: 'contactName', label: '联系人' },
  { key: 'contactPhone', label: '联系电话', span: 2 },
  { key: 'applyTime', label: '提交时间', span: 2 },
  { key: 'applyNote', label: '申请说明', span: 2 },
]

function detailValue(key: string) {
  if (!target.value) return '—'
  if (key === 'identityType') return identityTypeText(target.value[key])
  if (key === 'applyTime') return formatTime(target.value.applyTime ?? target.value.createdAt)
  if (key === 'applicantName') return target.value[key] || `用户 ${target.value.userId}`
  return target.value[key] ?? '—'
}

function rowActions(record: Record<string, any>): VueRowActionItem[] {
  if (props.kind === 'org') {
    return [{ key: 'detail', label: '查看详情', onClick: () => app.navigate('org-detail', String(record.id)) }]
  }
  if (props.kind === 'identity' || canReview(record)) {
    return [{ key: 'review', label: canReview(record) ? '审核' : '查看', onClick: () => open(record) }]
  }
  return []
}

let requestId = 0

async function load() {
  const id = ++requestId
  loading.value = true
  error.value = ''
  try {
    const p = { pageNum: pageNum.value, pageSize: pageSize.value }
    const result = props.kind === 'identity'
      ? await ucApi.identityApplications({
        ...p,
        status: status.value || undefined,
        identityType: identityType.value || undefined,
        keyword: keyword.value || undefined,
      })
      : props.kind === 'realname'
        ? await ucApi.realnameList({ ...p, status: status.value || undefined })
        : props.kind === 'qualification'
          ? await ucApi.certifications({
            ...p,
            certStatus: status.value || undefined,
            merchantName: keyword.value || undefined,
          })
          : await ucApi.orgs({
            ...p,
            verifyStatus: status.value || undefined,
            keyword: keyword.value || undefined,
          })
    if (id === requestId) {
      rows.value = result.records
      total.value = result.total
    }
  } catch (e) {
    if (id === requestId) error.value = e instanceof Error ? e.message : '读取失败'
  } finally {
    if (id === requestId) loading.value = false
  }
}

watch(() => props.kind, () => {
  status.value = 'pending'
  identityType.value = ''
  keyword.value = ''
  draft.value = ''
  pageNum.value = 1
})

watch([pageNum, pageSize, status, identityType, keyword, () => props.kind], load, { immediate: true })

function search() {
  const nextKeyword = draft.value.trim()
  const same = keyword.value === nextKeyword && pageNum.value === 1
  keyword.value = nextKeyword
  pageNum.value = 1
  if (same) void load()
}

function resetFilters() {
  const same = !keyword.value && !draft.value && !identityType.value && status.value === 'pending' && pageNum.value === 1
  draft.value = ''
  keyword.value = ''
  identityType.value = ''
  status.value = 'pending'
  pageNum.value = 1
  if (same) void load()
}

function onFilterChange() {
  pageNum.value = 1
}

function handlePageChange(nextPage: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = nextPage
}

function canReview(row: Record<string, any>) {
  return props.kind === 'qualification'
    ? ['pending', 'submitted', 'reviewing'].includes(row.certStatus)
    : props.kind !== 'org' && row.status === 'pending'
}

function open(row: Record<string, any>) {
  target.value = row
  approved.value = true
  remark.value = ''
}

async function submit() {
  if (!target.value || !canReview(target.value) || submitting.value) return
  submitting.value = true
  try {
    const id = String(target.value.id)
    if (props.kind === 'identity') await ucApi.reviewIdentityApplication(id, approved.value, remark.value)
    else if (props.kind === 'realname') await ucApi.reviewRealname(id, approved.value, remark.value)
    else if (props.kind === 'qualification') await ucApi.auditCertification(id, approved.value ? 'approved' : 'rejected', remark.value)
    message.success(approved.value ? '审核已通过' : '已驳回')
    target.value = null
    await load()
  } catch (e) {
    message.error(e instanceof Error ? e.message : '审核失败')
  } finally {
    submitting.value = false
  }
}
</script>
