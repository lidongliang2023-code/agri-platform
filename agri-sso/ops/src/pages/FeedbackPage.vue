<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="合规服务"
      title="反馈处理"
      :description="`${total} 条反馈 · 回复后用户端「意见反馈」与消息中心同时可见`"
    >
      <template #actions>
        <a-select
          :value="status"
          style="width: 140px"
          :options="statusOptions"
          @change="(val: string) => { status = val; pageNum = 1 }"
        />
        <a-select
          :value="type"
          style="width: 130px"
          :options="typeOptions"
          @change="(val: string) => { type = val; pageNum = 1 }"
        />
      </template>
    </PageTitle>

    <ErrorBlock v-if="error" :message="error" @retry="load" />

    <section class="surface-card">
      <a-table
        row-key="id"
        size="middle"
        :loading="loading"
        :data-source="rows"
        :scroll="{ x: 1060 }"
        :columns="columns"
        :pagination="{
          current: pageNum,
          pageSize: 20,
          total,
          showTotal: (count: number) => `共 ${count} 条`,
          onChange: (next: number) => { pageNum = next },
        }"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'createdAt'">{{ formatTime(text) }}</template>
          <a-tag v-else-if="column.key === 'feedbackType'" class="soft-tag">{{ FEEDBACK_TYPE_LABEL[text] ?? text }}</a-tag>
          <div v-else-if="column.key === 'title'">
            <b>{{ text }}</b>
            <div class="small muted">{{ String(record.content || '').slice(0, 60) }}</div>
          </div>
          <template v-else-if="column.key === 'contact'">{{ text || '—' }}</template>
          <span v-else-if="column.key === 'pagePath'" class="small muted">{{ text || '—' }}</span>
          <StatusTag v-else-if="column.key === 'status'" :status="text" />
          <template v-else-if="column.key === 'action'">
            <a-button
              v-if="record.status !== 'closed'"
              size="small"
              type="primary"
              ghost
              @click="openReply(record as FeedbackRecord)"
            >
              {{ record.status === 'replied' ? '再回复' : '回复' }}
            </a-button>
            <span v-else class="small muted">已关闭</span>
          </template>
        </template>
      </a-table>
    </section>

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

const columns = [
  { title: '提交时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '类型', dataIndex: 'feedbackType', key: 'feedbackType', width: 100 },
  { title: '标题 / 内容', dataIndex: 'title', key: 'title' },
  { title: '联系方式', dataIndex: 'contact', key: 'contact', width: 150 },
  { title: '来源页面', dataIndex: 'pagePath', key: 'pagePath', width: 160 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 100 },
  { title: '操作', key: 'action', width: 100 },
]

const rows = ref<FeedbackRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
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
    pageSize: 20,
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

watch([pageNum, status, type], load, { immediate: true })

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
