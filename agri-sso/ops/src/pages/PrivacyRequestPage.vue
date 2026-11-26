<template>
  <div class="page-stack">
    <PageTitle
      eyebrow="合规服务"
      title="隐私请求处理"
      description="数据导出与账号注销申请 · 法规要求 15 个工作日内答复，本页按提交时间正序排列"
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
      total-unit="件"
      column-settings-storage-key="uc-ops:privacy-requests"
      @page-change="handlePageChange"
      @refresh="load"
    >
      <template #filter>
        <AgriVueFilterBar :field-count="1" :loading="loading" @search="load" @reset="resetFilters">
          <div class="agri-vue-filter-field">
            <label>处理状态</label>
            <a-select
              v-model:value="status"
              :options="statusOptions"
              @change="pageNum = 1"
            />
          </div>
        </AgriVueFilterBar>
      </template>

      <template #cell-createdAt="{ value }">{{ formatTime(String(value ?? '')) }}</template>
      <template #cell-requestType="{ value }">
        <a-tag class="soft-tag">{{ REQUEST_TYPE_LABEL[String(value ?? '')] ?? value }}</a-tag>
      </template>
      <template #cell-userId="{ value }">用户 {{ value }}</template>
      <template #cell-reason="{ value, record }">
        <div>
          {{ value || '—' }}
          <div v-if="record.scope" class="small muted">范围：{{ record.scope }}</div>
        </div>
      </template>
      <template #cell-status="{ value }">
        <StatusTag :status="String(value ?? '')" />
      </template>
      <template #cell-handlerName="{ value }">{{ value || '—' }}</template>
      <template #cell-action="{ record }">
        <AgriVueRowActions
          v-if="['pending', 'processing'].includes(String(record.status ?? ''))"
          :actions="[{ key: 'handle', label: '处理', onClick: () => openHandle(record as PrivacyRecord) }]"
        />
        <span v-else class="small muted">{{ formatTime(String(record.handleTime ?? '')) }}</span>
      </template>
    </AgriAntdvListTable>

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
import {
  AgriAntdvListTable,
  AgriVueFilterBar,
  AgriVueRowActions,
  type VueListColumn,
} from '@agri/shared/vue/antdv'
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

const columns: VueListColumn[] = [
  { key: 'createdAt', prop: 'createdAt', label: '提交时间', width: 160 },
  { key: 'requestType', prop: 'requestType', label: '类型', width: 120 },
  { key: 'userId', prop: 'userId', label: '申请人', width: 180 },
  { key: 'reason', prop: 'reason', label: '理由 / 范围', minWidth: 220 },
  { key: 'status', prop: 'status', label: '状态', width: 110 },
  { key: 'handlerName', prop: 'handlerName', label: '处理人', width: 110 },
  { key: 'action', label: '操作', width: 100, fixed: 'right' },
]

const rows = ref<PrivacyRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const status = ref('pending')
const loading = ref(true)
const error = ref('')
const target = ref<PrivacyRecord | null>(null)
const nextStatus = ref('processing')
const remark = ref('')

function load() {
  loading.value = true
  error.value = ''
  ucApi.privacyRequests({ pageNum: pageNum.value, pageSize: pageSize.value, status: status.value || undefined })
    .then((data) => {
      rows.value = data.records
      total.value = data.total
    })
    .catch((reason: Error) => { error.value = reason.message })
    .finally(() => { loading.value = false })
}

watch([pageNum, pageSize, status], load, { immediate: true })

function resetFilters() {
  const same = status.value === 'pending' && pageNum.value === 1
  status.value = 'pending'
  pageNum.value = 1
  if (same) load()
}

function handlePageChange(next: number, nextSize: number) {
  pageSize.value = nextSize
  pageNum.value = next
}

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
