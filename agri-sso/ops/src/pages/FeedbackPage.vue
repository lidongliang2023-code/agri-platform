<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="合规服务"
      title="反馈处理"
      :description="`${total} 条反馈 · 回复后用户端「意见反馈」与消息中心同时可见`"
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
      column-settings-storage-key="uc-ops:feedbacks"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="2" :loading="loading" @search="load" @reset="resetFilters">
          <div class="agri-vue-filter-field">
            <label>处理状态</label>
            <a-select
              v-model:value="status"
              :options="statusOptions"
              @change="pageNum = 1"
            />
          </div>
          <div class="agri-vue-filter-field">
            <label>反馈类型</label>
            <a-select
              v-model:value="type"
              :options="typeOptions"
              @change="pageNum = 1"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-createdAt="{ value }">{{ formatTime(String(value ?? '')) }}</template>
      <template #cell-feedbackType="{ value }">
        <a-tag class="soft-tag">{{ FEEDBACK_TYPE_LABEL[String(value ?? '')] ?? value }}</a-tag>
      </template>
      <template #cell-title="{ value, record }">
        <div>
          <b>{{ value }}</b>
          <div class="small muted">{{ String(record.content || '').slice(0, 60) }}</div>
        </div>
      </template>
      <template #cell-contact="{ value }">{{ value || '—' }}</template>
      <template #cell-pagePath="{ value }">
        <span class="small muted">{{ value || '—' }}</span>
      </template>
      <template #cell-status="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
      <template #cell-action="{ record }">
        <AgriVueRowActions
          v-if="record.status !== 'closed'"
          :actions="[{ key: 'reply', label: record.status === 'replied' ? '再回复' : '回复', onClick: () => openReply(record as FeedbackRecord) }]"
        />
        <span v-else class="small muted">已关闭</span>
      </template>
    </AgriAntdvListTable>

    <a-modal
      :open="Boolean(target)"
      :title="`回复反馈：${target?.title ?? ''}`"
      :confirm-loading="sending"
      ok-text="发送回复"
      @cancel="target = null"
      @ok="submit"
    >
      <div class="stack" style="margin-top: 12px">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="用户反馈">{{ target?.content || '—' }}</a-descriptions-item>
          <a-descriptions-item label="联系方式">{{ target?.contact || '—' }}</a-descriptions-item>
          <a-descriptions-item label="来源页面">{{ target?.pagePath || '—' }}</a-descriptions-item>
        </a-descriptions>
        <a-textarea v-model:value="reply" :rows="4" placeholder="回复内容会推送到用户消息中心" />
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
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
import type { FeedbackRecord } from '../types'

const FEEDBACK_TYPE_LABEL: Record<string, string> = {
  suggestion: '建议',
  bug: '缺陷',
  complaint: '投诉',
  other: '其他',
}

const statusOptions = [
  { label: '待回复', value: 'pending' },
  { label: '已回复', value: 'replied' },
  { label: '已关闭', value: 'closed' },
  { label: '全部', value: '' },
]

const typeOptions = [
  { label: '全部类型', value: '' },
  ...Object.entries(FEEDBACK_TYPE_LABEL).map(([value, label]) => ({ value, label })),
]

const columns: VueListColumn[] = [
  { key: 'createdAt', prop: 'createdAt', label: '提交时间', width: 160 },
  { key: 'feedbackType', prop: 'feedbackType', label: '类型', width: 100 },
  { key: 'title', prop: 'title', label: '标题 / 内容', minWidth: 220 },
  { key: 'contact', prop: 'contact', label: '联系方式', width: 150 },
  { key: 'pagePath', prop: 'pagePath', label: '来源页面', width: 160 },
  { key: 'status', prop: 'status', label: '状态', width: 100 },
  { key: 'action', label: '操作', width: 100, fixed: 'right' },
]

const rows = ref<FeedbackRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const status = ref('pending')
const type = ref('')
const loading = ref(true)
const error = ref('')
const target = ref<FeedbackRecord | null>(null)
const reply = ref('')
const sending = ref(false)

function load() {
  loading.value = true
  error.value = ''
  ucApi.feedbacks({
    pageNum: pageNum.value,
    pageSize: pageSize.value,
    status: status.value || undefined,
    type: type.value || undefined,
  })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, status, type], load, { immediate: true })

function resetFilters() {
  const same = status.value === 'pending' && !type.value && pageNum.value === 1
  status.value = 'pending'
  type.value = ''
  pageNum.value = 1
  if (same) load()
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}

function openReply(row: FeedbackRecord) {
  target.value = row
  reply.value = row.replyContent ?? ''
}

function submit() {
  if (!target.value) return
  if (!reply.value.trim()) {
    message.warning('请填写回复内容')
    return
  }
  sending.value = true
  ucApi.replyFeedback(target.value.id, reply.value.trim())
    .then(() => {
      message.success('已回复，用户会在消息中心收到通知')
      target.value = null
      reply.value = ''
      load()
    })
    .catch((reason: Error) => message.error(reason.message))
    .finally(() => { sending.value = false })
}
</script>
