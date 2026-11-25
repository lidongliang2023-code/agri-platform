<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="合规服务"
      title="隐私请求处理"
      description="数据导出与账号注销申请 · 法规要求 15 个工作日内答复，本页按提交时间正序排列"
    >
      <template #actions>
        <a-select
          :value="status"
          style="width: 150px"
          :options="statusOptions"
          @change="(val: string) => { status = val; pageNum = 1 }"
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
        :scroll="{ x: 1080 }"
        :columns="columns"
        :pagination="{
          current: pageNum,
          pageSize: 20,
          total,
          showTotal: (count: number) => `共 ${count} 件`,
          onChange: (next: number) => { pageNum = next },
        }"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.key === 'createdAt'">{{ formatTime(text) }}</template>
          <a-tag v-else-if="column.key === 'requestType'" class="soft-tag">{{ REQUEST_TYPE_LABEL[text] ?? text }}</a-tag>
          <template v-else-if="column.key === 'userId'">用户 {{ text }}</template>
          <div v-else-if="column.key === 'reason'">
            {{ text || '—' }}
            <div v-if="record.scope" class="small muted">范围：{{ record.scope }}</div>
          </div>
          <StatusTag v-else-if="column.key === 'status'" :status="text" />
          <template v-else-if="column.key === 'handlerName'">{{ text || '—' }}</template>
          <template v-else-if="column.key === 'action'">
            <a-button
              v-if="['pending', 'processing'].includes(record.status)"
              size="small"
              type="primary"
              ghost
              @click="openHandle(record as PrivacyRecord)"
            >
              处理
            </a-button>
            <span v-else class="small muted">{{ formatTime(record.handleTime) }}</span>
          </template>
        </template>
      </a-table>
    </section>

    <section class="surface-card">
      <SectionHeading kicker="边界说明" title="这张表只记录流转，不假装已经执行" />
      <div class="small muted" style="line-height: 1.9">
        数据导出要跨多个业务库取数、账号注销要连带处理主体归属与结算，系统目前能自动做的只有
        「收单 + 流转状态」。所以这里标记「已完成」表示<b>人工已办结</b>，不代表系统自动打包了数据。
        真要自动化，得先有跨库导出任务与注销编排，属独立改造。
      </div>
    </section>

    <a-modal
      :open="Boolean(target)"
      :title="`处理隐私请求：${target ? REQUEST_TYPE_LABEL[target.requestType] ?? target.requestType : ''}`"
      ok-text="保存处理结果"
      @cancel="target = null"
      @ok="submit"
    >
      <div class="stack" style="margin-top: 12px">
        <a-descriptions :column="1" size="small" bordered>
          <a-descriptions-item label="申请理由">{{ target?.reason || '—' }}</a-descriptions-item>
          <a-descriptions-item label="范围">{{ target?.scope || '—' }}</a-descriptions-item>
          <a-descriptions-item label="提交时间">{{ formatTime(target?.createdAt) }}</a-descriptions-item>
        </a-descriptions>
        <a-select
          v-model:value="nextStatus"
          style="width: 100%"
          :options="[
            { label: '标记为处理中', value: 'processing' },
            { label: '标记为已完成', value: 'completed' },
            { label: '驳回', value: 'rejected' },
          ]"
        />
        <a-textarea v-model:value="remark" :rows="3" placeholder="处理说明（会同步给申请人）" />
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
import SectionHeading from '../components/SectionHeading.vue'
import StatusTag from '../components/StatusTag.vue'
import { formatTime } from '../components/ui-constants'
import type { PrivacyRecord } from '../types'

const REQUEST_TYPE_LABEL: Record<string, string> = {
  export: '数据导出',
  deletion: '账号注销',
}

const statusOptions = [
  { label: '待处理', value: 'pending' },
  { label: '处理中', value: 'processing' },
  { label: '已完成', value: 'completed' },
  { label: '已驳回', value: 'rejected' },
  { label: '全部', value: '' },
]

const columns = [
  { title: '提交时间', dataIndex: 'createdAt', key: 'createdAt', width: 160 },
  { title: '类型', dataIndex: 'requestType', key: 'requestType', width: 120 },
  { title: '申请人', dataIndex: 'userId', key: 'userId', width: 200 },
  { title: '理由 / 范围', dataIndex: 'reason', key: 'reason' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  { title: '处理人', dataIndex: 'handlerName', key: 'handlerName', width: 110 },
  { title: '操作', key: 'action', width: 100 },
]

const rows = ref<PrivacyRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const status = ref('pending')
const loading = ref(true)
const error = ref('')
const target = ref<PrivacyRecord | null>(null)
const nextStatus = ref('processing')
const remark = ref('')

function load() {
  loading.value = true
  error.value = ''
  ucApi.privacyRequests({ pageNum: pageNum.value, pageSize: 20, status: status.value || undefined })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, status], load, { immediate: true })

function openHandle(row: PrivacyRecord) {
  target.value = row
  nextStatus.value = row.status === 'pending' ? 'processing' : 'completed'
  remark.value = ''
}

function submit() {
  if (!target.value) return
  ucApi.handlePrivacy(String(target.value.id), nextStatus.value, remark.value)
    .then(() => {
      message.success('已更新处理状态')
      target.value = null
      remark.value = ''
      load()
    })
    .catch((reason: Error) => message.error(reason.message))
}
</script>
